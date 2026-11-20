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

const httpError = (status, message, code) =>
  Object.assign(new Error(message), { status, code });

/**
 * Applies one AUTHENTICATED courier event (signature already verified by
 * middleware, payload already schema-validated by the controller).
 *
 * Guarantees:
 *  - Idempotent: the eventId is recorded under a unique index; a repeat is
 *    acknowledged and NOT applied again.
 *  - Only the forward delivery transitions are possible — a courier can never
 *    move an order backwards, mark an unprepared order delivered, or touch
 *    pending/rejected orders.
 *  - Atomic: the status change is a conditional update on the expected current
 *    status, so two concurrent events cannot both apply.
 *  - Once a trackingId is bound to an order, events for a different trackingId
 *    are refused (one courier job cannot overwrite another's order).
 */
export async function handleCourierWebhook({ eventId, orderId, event, partner }) {
  const status = EVENT_TO_STATUS[event];
  if (!status) throw httpError(400, `Unknown event`, "UNKNOWN_EVENT");

  try {
    await CourierWebhookEvent.create({ eventId, orderId, event });
  } catch (e) {
    if (e?.code === 11000) {
      const order = await Order.findById(orderId).select("status");
      if (!order) throw httpError(404, "Order not found");
      return { order, duplicate: true };
    }
    throw e;
  }

  try {
    const order = await Order.findById(orderId);
    if (!order) throw httpError(404, "Order not found");

    const boundTracking = order.deliveryPartner?.trackingId;
    if (
      boundTracking &&
      partner?.trackingId &&
      partner.trackingId !== boundTracking
    ) {
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

    const updated = await Order.findOneAndUpdate(
      { _id: orderId, status: from },
      { $set: set },
      { new: true },
    );
    if (!updated) {
      throw httpError(409, "Order changed concurrently; retry", "CONCURRENT_UPDATE");
    }
    return { order: updated, duplicate: false };
  } catch (e) {
    // Release the event id when it was NOT applied, so a legitimate retry from
    // the provider (e.g. after a transient DB error) can still succeed.
    await CourierWebhookEvent.deleteOne({ eventId }).catch(() => {});
    throw e;
  }
}

export async function getTrackingStatus(customerId, orderId) {
  const order = await Order.findOne({ _id: orderId, customerId }).select(
    "status deliveryPartner createdAt updatedAt",
  );
  if (!order)
    throw Object.assign(new Error("Order not found"), { status: 404 });
  return order;
}
