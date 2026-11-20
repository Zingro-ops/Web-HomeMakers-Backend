// A1 hardening — persistent courier event states, atomic claims, recovery.
//
// Contract under test:
//  - duplicate of an APPLIED event      → 200 duplicate:true, nothing re-applied
//  - duplicate of a PROCESSING event    → 409 EVENT_IN_PROGRESS (never 200)
//  - failed processing                  → recorded "failed", provider retry or
//                                         internal reprocess applies it once
//  - crash mid-flight / process restart → recovered after the lease, with no
//                                         second order-status change
import { test, before, after, beforeEach, afterEach, describe } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import request from "supertest";
import { startDb, stopDb, clearDb, signCourier, oid } from "./helpers.js";
import { seedKitchenWithDish, seedOrder } from "./fixtures.js";

let app, Order, CourierWebhookEvent, svc;
const URL = "/api/v1/delivery/webhook";
const restore = [];

before(async () => {
  await startDb();
  app = (await import("../src/app.js")).createApp();
  ({ Order } = await import("../src/models/Order.js"));
  ({ CourierWebhookEvent } = await import("../src/models/CourierWebhookEvent.js"));
  svc = await import("../src/services/deliveryTracking.service.js");
});
after(stopDb);
beforeEach(clearDb);
afterEach(() => { while (restore.length) restore.pop()(); });

/** Temporarily replace a model static; restored after each test. */
function stub(obj, name, impl) {
  const orig = obj[name];
  obj[name] = impl(orig);
  restore.push(() => { obj[name] = orig; });
}

async function readyOrder(status = "ready") {
  const { cook, dish } = await seedKitchenWithDish();
  return seedOrder({ cook, dish, status });
}

const event = (orderId, over = {}) => ({
  eventId: `evt_${oid()}`,
  orderId: String(orderId),
  event: "assigned",
  partner: { name: "Ravi Kumar", phone: "9123456789", trackingId: "TRK123" },
  ...over,
});

const deliver = (body) => {
  const s = signCourier(body);
  return request(app).post(URL).set(s.headers).send(s.raw);
};

/** Creates the persisted state a crashed/in-flight worker would leave. */
async function seedEventRow(body, { state, claimedAgoMs = 0, attempts = 1 }) {
  return CourierWebhookEvent.create({
    eventId: body.eventId,
    orderId: body.orderId,
    event: body.event,
    payloadHash: svc.hashPayload(body),
    payload: body,
    state,
    attempts,
    claimToken: crypto.randomUUID(),
    claimedAt: new Date(Date.now() - claimedAgoMs),
  });
}

const LEASE = () => svc.PROCESSING_LEASE_MS;

describe("duplicate of an APPLIED event", () => {
  test("returns 200 duplicate:true and does not re-apply", async () => {
    const order = await readyOrder();
    const body = event(order._id);
    const first = await deliver(body);
    assert.equal(first.status, 200);
    assert.equal(first.body.data.duplicate, false);
    const again = await deliver(body);
    assert.equal(again.status, 200);
    assert.equal(again.body.data.duplicate, true);
    const o = await Order.findById(order._id);
    assert.equal(o.status, "delivery_assigned");
    assert.deepEqual(o.courierEventIds, [body.eventId]);
    const row = await CourierWebhookEvent.findOne({ eventId: body.eventId });
    assert.equal(row.state, "applied");
    assert.equal(row.attempts, 1);
    assert.ok(row.appliedAt);
  });
});

describe("duplicate of a PROCESSING event", () => {
  test("is NOT acknowledged as completed: 409 EVENT_IN_PROGRESS + Retry-After", async () => {
    const order = await readyOrder();
    const body = event(order._id);
    await seedEventRow(body, { state: "processing", claimedAgoMs: 1_000 });
    const res = await deliver(body);
    assert.equal(res.status, 409);
    assert.equal(res.body.code, "EVENT_IN_PROGRESS");
    assert.equal(res.headers["retry-after"], "30");
    assert.equal((await Order.findById(order._id)).status, "ready");
    const row = await CourierWebhookEvent.findOne({ eventId: body.eventId });
    assert.equal(row.state, "processing");
    assert.equal(row.attempts, 1, "a live claim must not be taken over");
  });
});

describe("failure is recorded and recoverable", () => {
  test("transient DB error → 500, state failed; provider retry applies it once", async () => {
    const order = await readyOrder();
    const body = event(order._id);
    let thrown = false;
    stub(Order, "findOneAndUpdate", (orig) => function (...a) {
      if (!thrown) { thrown = true; throw new Error("simulated DB outage"); }
      return orig.apply(this, a);
    });
    const res1 = await deliver(body);
    assert.equal(res1.status, 500);
    let row = await CourierWebhookEvent.findOne({ eventId: body.eventId });
    assert.equal(row.state, "failed");
    assert.match(row.lastError.message, /simulated DB outage/);
    assert.equal((await Order.findById(order._id)).status, "ready");

    const res2 = await deliver(body); // provider retry
    assert.equal(res2.status, 200, JSON.stringify(res2.body));
    assert.equal(res2.body.data.duplicate, false);
    row = await CourierWebhookEvent.findOne({ eventId: body.eventId });
    assert.equal(row.state, "applied");
    assert.equal(row.attempts, 2);
    assert.deepEqual((await Order.findById(order._id)).courierEventIds, [body.eventId]);
  });

  test("order updated but recording 'applied' fails → retry recovers WITHOUT a second change", async () => {
    const order = await readyOrder();
    const body = event(order._id);
    let thrown = false;
    stub(CourierWebhookEvent, "updateOne", (orig) => function (filter, update, ...rest) {
      if (!thrown && update?.$set?.state === "applied") {
        thrown = true;
        throw new Error("simulated crash while recording applied");
      }
      return orig.call(this, filter, update, ...rest);
    });
    const res1 = await deliver(body);
    assert.equal(res1.status, 500);
    const mid = await Order.findById(order._id);
    assert.equal(mid.status, "delivery_assigned", "order change did happen");
    assert.equal((await CourierWebhookEvent.findOne({ eventId: body.eventId })).state, "failed");

    const res2 = await deliver(body);
    assert.equal(res2.status, 200);
    assert.equal(res2.body.data.duplicate, true, "recognised as already applied");
    const o = await Order.findById(order._id);
    assert.equal(o.status, "delivery_assigned", "not advanced a second time");
    assert.deepEqual(o.courierEventIds, [body.eventId]);
    assert.equal((await CourierWebhookEvent.findOne({ eventId: body.eventId })).state, "applied");
  });

  test("business rejection (invalid transition) is failed, then applies when valid", async () => {
    const order = await readyOrder("preparing");
    const body = event(order._id);
    assert.equal((await deliver(body)).status, 409);
    assert.equal((await CourierWebhookEvent.findOne({ eventId: body.eventId })).state, "failed");
    await Order.updateOne({ _id: order._id }, { status: "ready" });
    const res = await deliver(body);
    assert.equal(res.status, 200);
    assert.equal(res.body.data.duplicate, false);
  });
});

describe("process restart / crash recovery", () => {
  test("abandoned claim (lease expired, order untouched) is re-claimed and applied once", async () => {
    const order = await readyOrder();
    const body = event(order._id);
    await seedEventRow(body, { state: "processing", claimedAgoMs: LEASE() + 5_000 });
    const res = await deliver(body);
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.data.duplicate, false);
    const row = await CourierWebhookEvent.findOne({ eventId: body.eventId });
    assert.equal(row.state, "applied");
    assert.equal(row.attempts, 2);
    assert.deepEqual((await Order.findById(order._id)).courierEventIds, [body.eventId]);
  });

  test("crash AFTER the order write: recovery marks applied, no second status change", async () => {
    const order = await readyOrder();
    const body = event(order._id);
    // The state a process leaves if it dies right after the atomic order write.
    await Order.updateOne(
      { _id: order._id },
      { status: "delivery_assigned", courierEventIds: [body.eventId] },
    );
    await seedEventRow(body, { state: "processing", claimedAgoMs: LEASE() + 5_000 });
    const res = await deliver(body);
    assert.equal(res.status, 200);
    assert.equal(res.body.data.duplicate, true);
    const o = await Order.findById(order._id);
    assert.equal(o.status, "delivery_assigned");
    assert.deepEqual(o.courierEventIds, [body.eventId]);
    assert.equal((await CourierWebhookEvent.findOne({ eventId: body.eventId })).state, "applied");
  });

  test("same crash state but claim still LIVE → 409 in progress, not acknowledged", async () => {
    const order = await readyOrder();
    const body = event(order._id);
    await Order.updateOne({ _id: order._id }, { status: "delivery_assigned", courierEventIds: [body.eventId] });
    await seedEventRow(body, { state: "processing", claimedAgoMs: 1_000 });
    const res = await deliver(body);
    assert.equal(res.status, 409);
    assert.equal(res.body.code, "EVENT_IN_PROGRESS");
  });

  test("a fresh app instance (restart) sees the persisted state", async () => {
    const order = await readyOrder();
    const body = event(order._id);
    await seedEventRow(body, { state: "processing", claimedAgoMs: LEASE() + 5_000 });
    const freshApp = (await import("../src/app.js")).createApp();
    const s = signCourier(body);
    const res = await request(freshApp).post(URL).set(s.headers).send(s.raw);
    assert.equal(res.status, 200);
    assert.equal((await Order.findById(order._id)).status, "delivery_assigned");
  });
});

describe("concurrency", () => {
  test("concurrent retries of an abandoned event: exactly one re-claims and applies", async () => {
    const order = await readyOrder();
    const body = event(order._id);
    await seedEventRow(body, { state: "processing", claimedAgoMs: LEASE() + 5_000 });
    const results = await Promise.all(Array.from({ length: 8 }, () => deliver(body)));
    const applied = results.filter((r) => r.status === 200 && r.body.data.duplicate === false);
    assert.equal(applied.length, 1, `statuses: ${results.map((r) => r.status)}`);
    for (const r of results) {
      assert.ok(
        r.status === 200 || (r.status === 409 && r.body.code === "EVENT_IN_PROGRESS"),
        `unexpected ${r.status} ${JSON.stringify(r.body)}`,
      );
    }
    const row = await CourierWebhookEvent.findOne({ eventId: body.eventId });
    assert.equal(row.state, "applied");
    assert.equal(row.attempts, 2, "only one take-over happened");
    assert.deepEqual((await Order.findById(order._id)).courierEventIds, [body.eventId]);
  });

  test("first-delivery race: 8 concurrent copies → one applies; no 200 before it is applied", async () => {
    const order = await readyOrder();
    const body = event(order._id);
    const results = await Promise.all(Array.from({ length: 8 }, () => deliver(body)));
    const applied = results.filter((r) => r.status === 200 && r.body.data.duplicate === false);
    assert.equal(applied.length, 1);
    assert.deepEqual((await Order.findById(order._id)).courierEventIds, [body.eventId]);
  });
});

describe("event id integrity", () => {
  test("same eventId with different content → 409 EVENT_ID_REUSED, nothing applied", async () => {
    const order = await readyOrder();
    const body = event(order._id);
    assert.equal((await deliver(body)).status, 200);
    const tampered = { ...body, event: "picked_up" };
    const res = await deliver(tampered);
    assert.equal(res.status, 409);
    assert.equal(res.body.code, "EVENT_ID_REUSED");
    assert.equal((await Order.findById(order._id)).status, "delivery_assigned");
  });

  test("key order of the payload does not change its identity", async () => {
    const order = await readyOrder();
    const body = event(order._id);
    assert.equal((await deliver(body)).status, 200);
    const reordered = { partner: body.partner, event: body.event, orderId: body.orderId, eventId: body.eventId };
    const res = await deliver(reordered);
    assert.equal(res.status, 200);
    assert.equal(res.body.data.duplicate, true);
  });
});

describe("internal retry (reprocessPendingCourierEvents)", () => {
  test("re-drives a failed event once; a second run finds nothing", async () => {
    const order = await readyOrder();
    const body = event(order._id);
    let thrown = false;
    stub(Order, "findOneAndUpdate", (orig) => function (...a) {
      if (!thrown) { thrown = true; throw new Error("simulated DB outage"); }
      return orig.apply(this, a);
    });
    assert.equal((await deliver(body)).status, 500);
    const s1 = await svc.reprocessPendingCourierEvents();
    assert.deepEqual(
      { examined: s1.examined, applied: s1.applied },
      { examined: 1, applied: 1 },
    );
    assert.deepEqual((await Order.findById(order._id)).courierEventIds, [body.eventId]);
    const s2 = await svc.reprocessPendingCourierEvents();
    assert.equal(s2.examined, 0);
  });

  test("recovers an abandoned claim; ignores live claims", async () => {
    const o1 = await readyOrder();
    const o2 = await readyOrder();
    const abandoned = event(o1._id);
    const live = event(o2._id);
    await seedEventRow(abandoned, { state: "processing", claimedAgoMs: LEASE() + 5_000 });
    await seedEventRow(live, { state: "processing", claimedAgoMs: 1_000 });
    const s = await svc.reprocessPendingCourierEvents();
    assert.equal(s.examined, 1);
    assert.equal(s.applied, 1);
    assert.equal((await Order.findById(o1._id)).status, "delivery_assigned");
    assert.equal((await Order.findById(o2._id)).status, "ready", "live claim untouched");
  });

  test("internal retry racing a provider retry applies the event exactly once", async () => {
    const order = await readyOrder();
    const body = event(order._id);
    await seedEventRow(body, { state: "failed" });
    const [summary, res] = await Promise.all([
      svc.reprocessPendingCourierEvents(),
      deliver(body),
    ]);
    const providerApplied = res.status === 200 && res.body.data.duplicate === false;
    assert.equal(summary.applied + (providerApplied ? 1 : 0), 1);
    assert.deepEqual((await Order.findById(order._id)).courierEventIds, [body.eventId]);
  });
});
