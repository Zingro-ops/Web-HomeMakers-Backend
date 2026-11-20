import crypto from "crypto";
import { Order } from "../models/Order.js";
import { CourierWebhookEvent } from "../models/CourierWebhookEvent.js";

const DELIVERY_TRANSITIONS = {
  ready: ["delivery_assigned"],
  delivery_assigned: ["picked_up"],
  picked_up: ["out_for_delivery"],
  out_for_delivery: ["delivered"],
};

const EVENT_TO_STATUS = {
  assigned: "delivery_assigned",
  picked_up: "picked_up",
  out_for_delivery: "out_for_delivery",
  delivered: "delivered",
};

// Which current status each target status may be reached from.
const FROM_STATUS = Object.fromEntries(
  Object.entries(DELIVERY_TRANSITIONS).flatMap(([from, tos]) =>
    tos.map((to) => [to, from]),
  ),
);

/**
 * How long a `processing` claim is honoured. A claim older than this is
 * treated as abandoned (the process died mid-flight) and may be re-claimed.
 * Must comfortably exceed the time one event takes to process.
 */
export const PROCESSING_LEASE_MS = 60_000;

/** Max events kept on an order for applied-detection (newest kept). */
const ORDER_EVENT_HISTORY = 50;

const httpError = (status, message, code) =>
  Object.assign(new Error(message), { status, code });

/** Stable hash of the validated event (key order independent). */
export function hashPayload(dto) {
  const canonical = JSON.stringify(dto, (_k, v) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, v[k]]))
      : v,
  );
  return crypto.createHash("sha256").update(canonical).digest("hex");
}

/**
 * Atomically claims an event for processing.
 * Returns one of:
 *   { kind: "claimed", event }    — this caller must process it
 *   { kind: "applied", event }    — already applied; acknowledge, don't redo
 *   { kind: "in_progress" }       — another worker holds a live claim
 *   { kind: "conflict" }          — eventId reused with a different payload
 */
async function claimEvent(dto, payloadHash, { now = new Date() } = {}) {
  const claimToken = crypto.randomUUID();
  try {
    const event = await CourierWebhookEvent.create({
      eventId: dto.eventId,
      orderId: dto.orderId,
      event: dto.event,
      payloadHash,
      payload: dto,
      state: "processing",
      attempts: 1,
      claimToken,
      claimedAt: now,
    });
    return { kind: "claimed", event };
  } catch (e) {
    if (e?.code !== 11000) throw e;
  }

  const existing = await CourierWebhookEvent.findOne({ eventId: dto.eventId });
  if (!existing) {
    // Row vanished between insert and read (TTL expiry). Treat as new.
    return claimEvent(dto, payloadHash, { now });
  }
  if (existing.payloadHash !== payloadHash) return { kind: "conflict" };
  if (existing.state === "applied") return { kind: "applied", event: existing };

  const reclaimed = await CourierWebhookEvent.findOneAndUpdate(
    {
      eventId: dto.eventId,
      payloadHash,
      $or: [
        { state: "failed" },
        {
          state: "processing",
          claimedAt: { $lt: new Date(now.getTime() - PROCESSING_LEASE_MS) },
        },
      ],
    },
    {
      $set: { state: "processing", claimToken, claimedAt: now },
      $inc: { attempts: 1 },
    },
    { new: true },
  );
  if (reclaimed) return { kind: "claimed", event: reclaimed };

  // Lost the race: someone else claimed it, or it was applied meanwhile.
  const latest = await CourierWebhookEvent.findOne({ eventId: dto.eventId });
  if (latest?.state === "applied") return { kind: "applied", event: latest };
  return { kind: "in_progress" };
}

async function markApplied(event) {
  // Unconditional on claimToken: "applied" is only written after the order
  // provably carries this eventId, so it is true whoever writes it.
  await CourierWebhookEvent.updateOne(
    { eventId: event.eventId, state: { $ne: "applied" } },
    { $set: { state: "applied", appliedAt: new Date() } },
  );
}

async function markFailed(event, err) {
  // Conditional on claimToken: a stale worker must not mark a NEWER claim as
  // failed underneath the worker that now owns it.
  await CourierWebhookEvent.updateOne(
    { eventId: event.eventId, claimToken: event.claimToken, state: "processing" },
    {
      $set: {
        state: "failed",
        lastError: {
          code: String(err?.code ?? "ERROR").slice(0, 64),
          message: String(err?.message ?? "").slice(0, 300),
        },
      },
    },
  );
}

/** Applies a claimed event to its order exactly once. */
async function applyClaimedEvent(event, { orderId, eventId, partner }, status) {
  const order = await Order.findById(orderId);
  if (!order) throw httpError(404, "Order not found", "ORDER_NOT_FOUND");

  // Recovery path: a previous attempt already applied this event to the
  // order but died before recording "applied". Record it now; change nothing.
  if (order.courierEventIds?.includes(eventId)) {
    await markApplied(event);
    return { order, duplicate: true, recovered: true };
  }

  const boundTracking = order.deliveryPartner?.trackingId;
  if (boundTracking && partner?.trackingId && partner.trackingId !== boundTracking) {
    throw httpError(409, "Tracking id does not match this order", "TRACKING_MISMATCH");
  }

  const from = FROM_STATUS[status];
  if (order.status !== from) {
    throw httpError(
      409,
      `Cannot move order from ${order.status} to ${status}`,
      "INVALID_TRANSITION",
    );
  }

  const set = { status };
  if (partner) {
    set.deliveryPartner = {
      name: partner.name || order.deliveryPartner?.name || null,
      phone: partner.phone || order.deliveryPartner?.phone || null,
      trackingId: partner.trackingId || boundTracking || null,
    };
  }

  // The status change and the "applied by eventId" marker are ONE atomic
  // write, guarded on the expected current status AND on the event not being
  // present — so no interleaving of workers, retries or recoveries can apply
  // the same event twice or apply two events from the same status.
  const updated = await Order.findOneAndUpdate(
    { _id: orderId, status: from, courierEventIds: { $ne: eventId } },
    {
      $set: set,
      $push: {
        courierEventIds: { $each: [eventId], $slice: -ORDER_EVENT_HISTORY },
      },
    },
    { new: true },
  );

  if (!updated) {
    const now = await Order.findById(orderId).select("status courierEventIds");
    if (now?.courierEventIds?.includes(eventId)) {
      await markApplied(event);
      return { order: now, duplicate: true, recovered: true };
    }
    throw httpError(409, "Order changed concurrently; retry", "CONCURRENT_UPDATE");
  }

  // If THIS write fails, the event stays "processing"; after the lease a retry
  // re-claims it, sees the eventId on the order, and only marks it applied.
  await markApplied(event);
  return { order: updated, duplicate: false };
}

/**
 * Handles one AUTHENTICATED, schema-validated courier event.
 *
 * Outcomes (the controller maps these to HTTP):
 *  - first successful delivery → applied, `duplicate: false`
 *  - repeat of an APPLIED event → `duplicate: true`, nothing re-applied
 *  - repeat while another delivery is still PROCESSING → 409
 *    EVENT_IN_PROGRESS (retryable; never acknowledged as done)
 *  - same eventId, different payload → 409 EVENT_ID_REUSED
 *  - processing error → event marked `failed` (re-claimable), error rethrown
 *    so the provider sees a non-2xx and retries
 */
export async function handleCourierWebhook(dto, opts = {}) {
  const status = EVENT_TO_STATUS[dto.event];
  if (!status) throw httpError(400, "Unknown event", "UNKNOWN_EVENT");

  const payloadHash = hashPayload(dto);
  const claim = await claimEvent(dto, payloadHash, opts);

  if (claim.kind === "conflict") {
    throw httpError(
      409,
      "This event id was already used with different content",
      "EVENT_ID_REUSED",
    );
  }
  if (claim.kind === "in_progress") {
    throw httpError(
      409,
      "This event is still being processed; retry later",
      "EVENT_IN_PROGRESS",
    );
  }
  if (claim.kind === "applied") {
    const order = await Order.findById(dto.orderId).select("status");
    if (!order) throw httpError(404, "Order not found", "ORDER_NOT_FOUND");
    return { order, duplicate: true };
  }

  try {
    return await applyClaimedEvent(claim.event, dto, status);
  } catch (e) {
    await markFailed(claim.event, e).catch(() => {});
    throw e;
  }
}

/**
 * Internal retry for events the provider may have stopped retrying: re-drives
 * `failed` events and `processing` events whose lease has expired, using the
 * stored validated payload. Safe to run concurrently with webhook traffic and
 * with itself — every attempt goes through the same atomic claim.
 *
 * NOT scheduled anywhere yet: wiring it to a single-instance job is an
 * operational decision. Returns a per-outcome summary.
 */
export async function reprocessPendingCourierEvents({ limit = 50, now = new Date() } = {}) {
  const candidates = await CourierWebhookEvent.find({
    $or: [
      { state: "failed" },
      {
        state: "processing",
        claimedAt: { $lt: new Date(now.getTime() - PROCESSING_LEASE_MS) },
      },
    ],
  })
    .sort({ receivedAt: 1 })
    .limit(limit)
    .lean();

  const summary = { examined: candidates.length, applied: 0, alreadyApplied: 0, stillFailing: 0, skipped: 0 };
  for (const c of candidates) {
    try {
      const r = await handleCourierWebhook(c.payload, { now });
      if (r.duplicate) summary.alreadyApplied++;
      else summary.applied++;
    } catch (e) {
      if (e?.code === "EVENT_IN_PROGRESS") summary.skipped++;
      else summary.stillFailing++;
    }
  }
  return summary;
}

export async function getTrackingStatus(customerId, orderId) {
  const order = await Order.findOne({ _id: orderId, customerId }).select(
    "status deliveryPartner createdAt updatedAt",
  );
  if (!order)
    throw Object.assign(new Error("Order not found"), { status: 404 });
  return order;
}
