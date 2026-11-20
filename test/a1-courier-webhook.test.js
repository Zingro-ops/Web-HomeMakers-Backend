// A1 — courier webhook authentication, validation and safe state changes.
import { test, before, after, beforeEach, describe } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import {
  startDb, stopDb, clearDb, signCourier, oid, COURIER_SECRET, tokenFor, bearer,
} from "./helpers.js";
import { seedKitchenWithDish, seedOrder } from "./fixtures.js";

let app, Order;
const URL = "/api/v1/delivery/webhook";

before(async () => {
  await startDb();
  app = (await import("../src/app.js")).createApp();
  ({ Order } = await import("../src/models/Order.js"));
});
after(stopDb);
beforeEach(clearDb);

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

const send = (raw, headers) => request(app).post(URL).set(headers).send(raw);

describe("unauthenticated / forged requests never modify orders", () => {
  test("no signature headers → 401", async () => {
    const order = await readyOrder();
    const res = await request(app).post(URL).send(event(order._id));
    assert.equal(res.status, 401);
    assert.equal((await Order.findById(order._id)).status, "ready");
  });

  test("a customer JWT is not accepted in place of a signature → 401", async () => {
    const order = await readyOrder();
    const res = await request(app).post(URL).set(bearer(tokenFor())).send(event(order._id));
    assert.equal(res.status, 401);
  });

  test("signature made with the wrong secret → 401", async () => {
    const order = await readyOrder();
    const { raw, headers } = signCourier(event(order._id), { secret: "x".repeat(64) });
    const res = await send(raw, headers);
    assert.equal(res.status, 401);
    assert.equal((await Order.findById(order._id)).status, "ready");
  });

  test("valid signature but body tampered afterwards → 401", async () => {
    const order = await readyOrder();
    const { headers } = signCourier(event(order._id));
    const tampered = JSON.stringify(event(order._id, { event: "delivered" }));
    const res = await send(tampered, headers);
    assert.equal(res.status, 401);
    assert.equal((await Order.findById(order._id)).status, "ready");
  });

  test("stale timestamp (replay after window) → 401", async () => {
    const order = await readyOrder();
    const { raw, headers } = signCourier(event(order._id), { ts: Math.floor(Date.now() / 1000) - 3600 });
    const res = await send(raw, headers);
    assert.equal(res.status, 401);
  });

  test("future timestamp → 401", async () => {
    const order = await readyOrder();
    const { raw, headers } = signCourier(event(order._id), { ts: Math.floor(Date.now() / 1000) + 3600 });
    assert.equal((await send(raw, headers)).status, 401);
  });

  test("malformed signature header → 401", async () => {
    const order = await readyOrder();
    const { raw, headers } = signCourier(event(order._id));
    const res = await send(raw, { ...headers, "x-zingro-courier-signature": "abc" });
    assert.equal(res.status, 401);
  });

  test("secret not configured → 503 (fails closed)", async () => {
    const order = await readyOrder();
    const { raw, headers } = signCourier(event(order._id));
    const saved = process.env.COURIER_WEBHOOK_SECRET;
    delete process.env.COURIER_WEBHOOK_SECRET;
    try {
      const res = await send(raw, headers);
      assert.equal(res.status, 503);
    } finally {
      process.env.COURIER_WEBHOOK_SECRET = saved;
    }
    assert.equal((await Order.findById(order._id)).status, "ready");
  });
});

describe("signed but malicious payloads are rejected", () => {
  test("unknown top-level key → 400", async () => {
    const order = await readyOrder();
    const { raw, headers } = signCourier({ ...event(order._id), status: "delivered" });
    assert.equal((await send(raw, headers)).status, 400);
  });

  test("markup in partner name → 400", async () => {
    const order = await readyOrder();
    const { raw, headers } = signCourier(event(order._id, { partner: { name: "<script>x</script>" } }));
    assert.equal((await send(raw, headers)).status, 400);
  });

  test("non-phone partner phone → 400", async () => {
    const order = await readyOrder();
    const { raw, headers } = signCourier(event(order._id, { partner: { phone: "call evil.example" } }));
    assert.equal((await send(raw, headers)).status, 400);
  });

  test("missing eventId → 400", async () => {
    const order = await readyOrder();
    const { eventId, ...noId } = event(order._id);
    const { raw, headers } = signCourier(noId);
    assert.equal((await send(raw, headers)).status, 400);
  });

  test("invalid order id format → 400", async () => {
    const { raw, headers } = signCourier(event("not-an-object-id"));
    assert.equal((await send(raw, headers)).status, 400);
  });

  test("cannot skip states: ready → delivered is refused (409)", async () => {
    const order = await readyOrder();
    const { raw, headers } = signCourier(event(order._id, { event: "delivered" }));
    const res = await send(raw, headers);
    assert.equal(res.status, 409);
    assert.equal((await Order.findById(order._id)).status, "ready");
  });

  test("cannot touch an unprepared (pending) order (409)", async () => {
    const order = await readyOrder("pending");
    const { raw, headers } = signCourier(event(order._id));
    assert.equal((await send(raw, headers)).status, 409);
    assert.equal((await Order.findById(order._id)).status, "pending");
  });

  test("a different trackingId cannot hijack a bound order (409)", async () => {
    const order = await readyOrder();
    const first = signCourier(event(order._id));
    assert.equal((await send(first.raw, first.headers)).status, 200);
    const hijack = signCourier(event(order._id, {
      event: "picked_up",
      partner: { name: "Mallory", phone: "9000000000", trackingId: "OTHER" },
    }));
    const res = await send(hijack.raw, hijack.headers);
    assert.equal(res.status, 409);
    const after = await Order.findById(order._id);
    assert.equal(after.status, "delivery_assigned");
    assert.equal(after.deliveryPartner.phone, "9123456789");
  });
});

describe("authorized courier events succeed, idempotently", () => {
  test("valid signed sequence moves the order forward with partner details", async () => {
    const order = await readyOrder();
    for (const ev of ["assigned", "picked_up", "out_for_delivery", "delivered"]) {
      const { raw, headers } = signCourier(event(order._id, { event: ev }));
      const res = await send(raw, headers);
      assert.equal(res.status, 200, `${ev}: ${JSON.stringify(res.body)}`);
    }
    const after = await Order.findById(order._id);
    assert.equal(after.status, "delivered");
    assert.equal(after.deliveryPartner.name, "Ravi Kumar");
    assert.equal(after.deliveryPartner.trackingId, "TRK123");
  });

  test("re-delivery of the same eventId is acknowledged but not re-applied", async () => {
    const order = await readyOrder();
    const body = event(order._id);
    const a = signCourier(body);
    assert.equal((await send(a.raw, a.headers)).status, 200);
    const b = signCourier(body); // provider retry, fresh timestamp, same eventId
    const res = await send(b.raw, b.headers);
    assert.equal(res.status, 200);
    assert.equal(res.body.data.duplicate, true);
    assert.equal((await Order.findById(order._id)).status, "delivery_assigned");
  });

  test("accepts the optional sha256= prefix", async () => {
    const order = await readyOrder();
    const { raw, headers } = signCourier(event(order._id));
    headers["x-zingro-courier-signature"] = "sha256=" + headers["x-zingro-courier-signature"];
    assert.equal((await send(raw, headers)).status, 200);
  });
});

describe("raw-body signing, persistence and atomicity", () => {
  test("signature covers the RAW bytes: odd whitespace/key order still verifies", async () => {
    const order = await readyOrder();
    const e = event(order._id);
    // Hand-written JSON with unusual spacing and key order. A verifier that
    // re-serialised req.body would compute a different HMAC and reject this.
    const raw =
      `{ "partner" : {"trackingId":"TRK123","phone":"9123456789","name":"Ravi Kumar"},` +
      `  "event":"assigned", "orderId": "${e.orderId}" ,"eventId":"${e.eventId}" }`;
    const { headers } = signCourier(raw);
    const res = await send(raw, headers);
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal((await Order.findById(order._id)).status, "delivery_assigned");
  });

  test("signing a re-serialised body but sending the original bytes → 401", async () => {
    const order = await readyOrder();
    const e = event(order._id);
    const sent = JSON.stringify(e, null, 2); // pretty-printed bytes on the wire
    const { headers } = signCourier(JSON.stringify(e)); // MAC over compact form
    const res = await send(sent, headers);
    assert.equal(res.status, 401);
    assert.equal((await Order.findById(order._id)).status, "ready");
  });

  test("timestamp exactly at the tolerance edge is accepted; just past it is refused", async () => {
    const { TOLERANCE_SECONDS } = await import("../src/middlewares/courierSignature.js");
    const now = Math.floor(Date.now() / 1000);
    const o1 = await readyOrder();
    const edge = signCourier(event(o1._id), { ts: now - TOLERANCE_SECONDS + 2 });
    assert.equal((await send(edge.raw, edge.headers)).status, 200);
    const o2 = await readyOrder();
    const past = signCourier(event(o2._id), { ts: now - TOLERANCE_SECONDS - 5 });
    assert.equal((await send(past.raw, past.headers)).status, 401);
    assert.equal((await Order.findById(o2._id)).status, "ready");
  });

  test("replay protection is persistent: a fresh app instance still rejects a used eventId", async () => {
    const order = await readyOrder();
    const body = event(order._id);
    const a = signCourier(body);
    assert.equal((await send(a.raw, a.headers)).status, 200);
    const { CourierWebhookEvent } = await import("../src/models/CourierWebhookEvent.js");
    assert.equal(await CourierWebhookEvent.countDocuments({ eventId: body.eventId }), 1);
    // Simulate a process restart: new Express app, no in-memory state shared.
    const freshApp = (await import("../src/app.js")).createApp();
    const b = signCourier(body);
    const res = await request(freshApp).post(URL).set(b.headers).send(b.raw);
    assert.equal(res.status, 200);
    assert.equal(res.body.data.duplicate, true);
    assert.equal((await Order.findById(order._id)).status, "delivery_assigned");
  });

  test("concurrent duplicates of one event: applied exactly once", async () => {
    const order = await readyOrder();
    const body = event(order._id);
    const reqs = Array.from({ length: 8 }, () => {
      const s = signCourier(body);
      return send(s.raw, s.headers);
    });
    const results = await Promise.all(reqs);
    const statuses = results.map((r) => r.status);
    assert.ok(statuses.every((s) => s === 200), `statuses: ${statuses}`);
    const applied = results.filter((r) => r.body.data?.duplicate === false);
    assert.equal(applied.length, 1, "exactly one request applies the event");
    const { CourierWebhookEvent } = await import("../src/models/CourierWebhookEvent.js");
    assert.equal(await CourierWebhookEvent.countDocuments({ eventId: body.eventId }), 1);
    assert.equal((await Order.findById(order._id)).status, "delivery_assigned");
  });

  test("concurrent DIFFERENT events racing the same transition: at most one wins", async () => {
    const order = await readyOrder();
    const reqs = Array.from({ length: 6 }, () => {
      const s = signCourier(event(order._id)); // distinct eventIds, same "assigned"
      return send(s.raw, s.headers);
    });
    const results = await Promise.all(reqs);
    const ok = results.filter((r) => r.status === 200);
    const conflicts = results.filter((r) => r.status === 409);
    assert.equal(ok.length, 1, `statuses: ${results.map((r) => r.status)}`);
    assert.equal(conflicts.length, 5);
    assert.equal((await Order.findById(order._id)).status, "delivery_assigned");
  });

  test("a rejected event releases its id so a genuine later retry can apply", async () => {
    const order = await readyOrder("preparing"); // not yet ready → 409
    const body = event(order._id);
    const a = signCourier(body);
    assert.equal((await send(a.raw, a.headers)).status, 409);
    await Order.updateOne({ _id: order._id }, { status: "ready" });
    const b = signCourier(body);
    const res = await send(b.raw, b.headers);
    assert.equal(res.status, 200);
    assert.equal(res.body.data.duplicate, false);
  });

  test("every backwards or skipping transition is refused", async () => {
    const cases = [
      ["delivered", "assigned"],
      ["delivered", "out_for_delivery"],
      ["out_for_delivery", "picked_up"],
      ["picked_up", "assigned"],
      ["delivery_assigned", "out_for_delivery"],
      ["delivery_assigned", "delivered"],
      ["ready", "picked_up"],
      ["accepted", "assigned"],
      ["rejected", "assigned"],
      ["completed", "delivered"],
    ];
    for (const [from, ev] of cases) {
      const order = await readyOrder(from);
      const { raw, headers } = signCourier(event(order._id, { event: ev }));
      const res = await send(raw, headers);
      assert.equal(res.status, 409, `${from} --${ev}--> should be 409, got ${res.status}`);
      assert.equal((await Order.findById(order._id)).status, from);
    }
  });
});

test("secret length guard: COURIER_SECRET used by tests is ≥ 32 chars", () => {
  assert.ok(COURIER_SECRET.length >= 32);
});
