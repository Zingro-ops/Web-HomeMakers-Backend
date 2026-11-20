// A2 — the API reports the real payment/refund state; never a promise.
import { test, before, after, beforeEach, describe } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import {
  startDb, stopDb, clearDb, tokenFor, bearer, oid, razorpaySignature,
} from "./helpers.js";
import { seedKitchenWithDish, seedAddress, seedCart } from "./fixtures.js";
import { summarizePayment } from "../src/services/paymentState.service.js";

let app, Order, Payment, razorpay, Cook;

before(async () => {
  await startDb();
  app = (await import("../src/app.js")).createApp();
  ({ Order } = await import("../src/models/Order.js"));
  ({ Payment } = await import("../src/models/Payment.js"));
  ({ Cook } = await import("../src/models/Cook.js"));
  ({ razorpay } = await import("../src/services/razorpay.client.js"));
  razorpay.orders.create = async ({ amount }) => ({ id: `order_${oid()}`, amount });
});
after(stopDb);
beforeEach(clearDb);

async function paidOrder() {
  const userId = oid();
  const auth = bearer(tokenFor({ id: userId }));
  const { cook, dish } = await seedKitchenWithDish();
  const address = await seedAddress(userId);
  await seedCart(userId, cook, dish, 1);
  const create = await request(app)
    .post("/api/v1/payment/create-order")
    .set(auth)
    .send({ addressId: String(address._id), customerName: "T" });
  const { razorpayOrderId, orderId } = create.body.data;
  const paymentId = `pay_${oid()}`;
  await request(app)
    .post("/api/v1/payment/verify")
    .set(auth)
    .send({ razorpayOrderId, razorpayPaymentId: paymentId, razorpaySignature: razorpaySignature(razorpayOrderId, paymentId) });
  return { userId, auth, orderId, cook };
}

describe("order responses carry the server's payment state", () => {
  test("awaiting payment before verify", async () => {
    const userId = oid();
    const auth = bearer(tokenFor({ id: userId }));
    const { cook, dish } = await seedKitchenWithDish();
    const address = await seedAddress(userId);
    await seedCart(userId, cook, dish, 1);
    const create = await request(app).post("/api/v1/payment/create-order").set(auth)
      .send({ addressId: String(address._id), customerName: "T" });
    const res = await request(app).get(`/api/orders/${create.body.data.orderId}`).set(auth);
    assert.equal(res.status, 200);
    assert.equal(res.body.payment.status, "awaiting_payment");
    assert.equal(res.body.payment.refund.status, "none");
  });

  test("paid after verify; list view carries it too", async () => {
    const { auth, orderId } = await paidOrder();
    const one = await request(app).get(`/api/orders/${orderId}`).set(auth);
    assert.equal(one.body.payment.status, "paid");
    assert.equal(one.body.payment.refund.status, "none");
    const list = await request(app).get("/api/orders/mine").set(auth);
    assert.equal(list.status, 200);
    assert.equal(list.body.items[0].payment.status, "paid");
  });

  test("customer cancel → refund INITIATED (not completed) when Razorpay says pending", async () => {
    const { auth, orderId } = await paidOrder();
    razorpay.payments.refund = async (_pid, { amount }) => ({ id: "rfnd_1", status: "pending", amount });
    razorpay.payments.fetchRefund = async () => ({ id: "rfnd_1", status: "pending" });
    const cancel = await request(app).post(`/api/orders/${orderId}/cancel`).set(auth);
    assert.equal(cancel.status, 200, JSON.stringify(cancel.body));
    assert.equal(cancel.body.payment.refund.status, "initiated");
    assert.equal(cancel.body.payment.refund.reference, "rfnd_1");
    const res = await request(app).get(`/api/orders/${orderId}`).set(auth);
    assert.equal(res.body.payment.refund.status, "initiated");
  });

  test("refund shown COMPLETED only after Razorpay reports processed", async () => {
    const { auth, orderId } = await paidOrder();
    razorpay.payments.refund = async (_pid, { amount }) => ({ id: "rfnd_2", status: "pending", amount });
    await request(app).post(`/api/orders/${orderId}/cancel`).set(auth);
    razorpay.payments.fetchRefund = async () => ({ id: "rfnd_2", status: "processed" });
    const res = await request(app).get(`/api/orders/${orderId}`).set(auth);
    assert.equal(res.body.payment.refund.status, "completed");
    assert.ok(res.body.payment.refund.completedAt);
    const p = await Payment.findOne({ orderId });
    assert.equal(p.refundStatus, "processed");
  });

  test("gateway lookup failure keeps 'initiated' — never upgrades on error", async () => {
    const { auth, orderId } = await paidOrder();
    razorpay.payments.refund = async (_pid, { amount }) => ({ id: "rfnd_3", status: "pending", amount });
    await request(app).post(`/api/orders/${orderId}/cancel`).set(auth);
    razorpay.payments.fetchRefund = async () => { throw new Error("network down"); };
    const res = await request(app).get(`/api/orders/${orderId}`).set(auth);
    assert.equal(res.status, 200);
    assert.equal(res.body.payment.refund.status, "initiated");
  });

  test("refund call failure → 502, order NOT cancelled, refund state stays none", async () => {
    const { auth, orderId } = await paidOrder();
    razorpay.payments.refund = async () => { throw new Error("gateway error"); };
    const cancel = await request(app).post(`/api/orders/${orderId}/cancel`).set(auth);
    assert.equal(cancel.status, 502);
    const res = await request(app).get(`/api/orders/${orderId}`).set(auth);
    assert.equal(res.body.payment.status, "paid");
    assert.equal(res.body.payment.refund.status, "none");
    assert.notEqual(res.body.status, "rejected");
  });

  test("kitchen rejects a paid order → refund PENDING (no refund exists yet)", async () => {
    const { auth, orderId, cook } = await paidOrder();
    const cookToken = bearer(tokenFor({ id: cook.zingroUserId, role: "homemaker" }));
    const rej = await request(app).patch(`/api/cook/orders/${orderId}/status`).set(cookToken).send({ status: "rejected" });
    assert.equal(rej.status, 200, JSON.stringify(rej.body));
    const res = await request(app).get(`/api/orders/${orderId}`).set(auth);
    assert.equal(res.body.payment.status, "paid");
    assert.equal(res.body.payment.refund.status, "pending");
  });

  test("another customer cannot read the order's payment state (404)", async () => {
    const { orderId } = await paidOrder();
    const res = await request(app).get(`/api/orders/${orderId}`).set(bearer(tokenFor()));
    assert.equal(res.status, 404);
  });
});

describe("summarizePayment unit cases", () => {
  test("no payment record → not_started", () => {
    assert.equal(summarizePayment({ status: "pending" }, null).status, "not_started");
  });
  test("failed verification → failed", () => {
    assert.equal(summarizePayment({ status: "pending" }, { status: "failed", amount: 10 }).status, "failed");
  });
  test("legacy 'refunded' with refundId but no refundStatus → initiated, not completed", () => {
    const s = summarizePayment({ status: "rejected" }, { status: "refunded", refundId: "r", amount: 10 });
    assert.equal(s.refund.status, "initiated");
  });
  test("refund failed at gateway → failed", () => {
    const s = summarizePayment({ status: "rejected" }, { status: "refunded", refundId: "r", refundStatus: "failed", amount: 10 });
    assert.equal(s.refund.status, "failed");
  });
});
