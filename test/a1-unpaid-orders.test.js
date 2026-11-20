// A1 — no order can be created without payment; the paid path still works.
import { test, before, after, beforeEach, describe } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import {
  startDb, stopDb, clearDb, tokenFor, bearer, oid, razorpaySignature,
} from "./helpers.js";
import { seedKitchenWithDish, seedAddress, seedCart } from "./fixtures.js";

let app, Order, Cart, Payment, razorpay;

before(async () => {
  await startDb();
  app = (await import("../src/app.js")).createApp();
  ({ Order } = await import("../src/models/Order.js"));
  ({ Cart } = await import("../src/models/Cart.js"));
  ({ Payment } = await import("../src/models/Payment.js"));
  ({ razorpay } = await import("../src/services/razorpay.client.js"));
  // No network: the gateway is stubbed for every test in this file.
  razorpay.orders.create = async ({ amount }) => ({ id: `order_${oid()}`, amount });
});
after(stopDb);
beforeEach(clearDb);

describe("removed unpaid-order endpoints", () => {
  test("POST /api/orders → 410 and no order is created", async () => {
    const { cook, dish } = await seedKitchenWithDish();
    const res = await request(app)
      .post("/api/orders")
      .set(bearer(tokenFor()))
      .send({
        cookId: String(cook._id),
        items: [{ dishId: String(dish._id), qty: 1 }],
        deliveryAddress: { building: "A", locality: "B", pincode: "560034" },
      });
    assert.equal(res.status, 410);
    assert.equal(res.body.code, "ENDPOINT_REMOVED_PAYMENT_REQUIRED");
    assert.equal(await Order.countDocuments(), 0);
  });

  test("POST /api/cart/checkout → 410, no order, cart untouched", async () => {
    const userId = oid();
    const { cook, dish } = await seedKitchenWithDish();
    await seedCart(userId, cook, dish, 3);
    const res = await request(app)
      .post("/api/cart/checkout")
      .set(bearer(tokenFor({ id: userId })))
      .send({ deliveryAddress: { building: "A", locality: "B", pincode: "560034" } });
    assert.equal(res.status, 410);
    assert.equal(await Order.countDocuments(), 0);
    const cart = await Cart.findOne({ customerId: userId });
    assert.equal(cart.items.length, 1);
    assert.equal(cart.items[0].qty, 3);
  });

  test("unauthenticated calls are still 401 (auth runs first)", async () => {
    assert.equal((await request(app).post("/api/orders").send({})).status, 401);
    assert.equal((await request(app).post("/api/cart/checkout").send({})).status, 401);
  });
});

describe("legitimate paid workflow still works", () => {
  test("cart → preview → create-order → verify → order paid", async () => {
    const userId = oid();
    const auth = bearer(tokenFor({ id: userId }));
    const { cook, dish } = await seedKitchenWithDish({ price: 200 });
    const address = await seedAddress(userId);

    // Cart API (used by the web client; Flutter sync is B-001/A4).
    const add = await request(app)
      .post("/api/cart/items")
      .set(auth)
      .send({ cookId: String(cook._id), dishId: String(dish._id), qty: 2 });
    assert.equal(add.status, 200, JSON.stringify(add.body));

    const preview = await request(app)
      .post("/api/v1/checkout/preview")
      .set(auth)
      .send({ addressId: String(address._id) });
    assert.equal(preview.status, 200, JSON.stringify(preview.body));
    const grandTotal = preview.body.data.grandTotal;
    assert.ok(grandTotal > 400);

    const create = await request(app)
      .post("/api/v1/payment/create-order")
      .set(auth)
      .send({ addressId: String(address._id), customerName: "Test User" });
    assert.equal(create.status, 201, JSON.stringify(create.body));
    assert.equal(create.body.data.amount, grandTotal);
    const { razorpayOrderId, orderId } = create.body.data;

    const paymentId = "pay_test_1";
    const verify = await request(app)
      .post("/api/v1/payment/verify")
      .set(auth)
      .send({
        razorpayOrderId,
        razorpayPaymentId: paymentId,
        razorpaySignature: razorpaySignature(razorpayOrderId, paymentId),
      });
    assert.equal(verify.status, 200, JSON.stringify(verify.body));

    const order = await Order.findById(orderId);
    assert.equal(order.status, "accepted");
    const payment = await Payment.findOne({ orderId });
    assert.equal(payment.status, "paid");
  });

  test("verify with a forged signature is refused and nothing is marked paid", async () => {
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
    const res = await request(app)
      .post("/api/v1/payment/verify")
      .set(auth)
      .send({ razorpayOrderId, razorpayPaymentId: "pay_x", razorpaySignature: "0".repeat(64) });
    assert.equal(res.status, 400);
    assert.equal((await Order.findById(orderId)).status, "pending");
    assert.equal((await Payment.findOne({ orderId })).status, "failed");
  });
});
