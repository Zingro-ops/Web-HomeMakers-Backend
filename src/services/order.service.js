import { Order } from "../models/Order.js";
import { Dish } from "../models/Dish.js";
import { Payment } from "../models/Payment.js";
import { razorpay } from "./razorpay.client.js";
import { completeReferralIfEligible } from "./referral.service.js";
import { Cart } from "../models/Cart.js";

const TRANSITIONS = {
  pending: ["preparing", "rejected"],
  accepted: ["preparing", "rejected"],
  preparing: ["ready"],
  ready: ["completed"],
};

// `createOrder` was removed: it built an order with no payment. The only order
// creation path is payment.service.createOrder, which is server-priced and
// backed by a Razorpay order.

export async function listCustomerOrders(customerId, { page, limit }) {
  const filter = { customerId };
  const [items, total] = await Promise.all([
    Order.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Order.countDocuments(filter),
  ]);
  return { items, total, page, limit };
}

export async function listCookOrders(
  cookId,
  { status, orderType, isCluster, page, limit },
) {
  const filter = {
    cookId,
    ...(status ? { status } : {}),
    ...(orderType ? { orderType } : {}),
    ...(isCluster !== undefined ? { isCluster } : {}),
  };
  const [items, total] = await Promise.all([
    Order.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Order.countDocuments(filter),
  ]);
  return { items, total, page, limit };
}

export async function updateOrderStatus(cookId, orderId, status, readyPhoto) {
  const order = await Order.findOne({ _id: orderId, cookId });
  if (!order)
    throw Object.assign(new Error("Order not found"), { status: 404 });

  const allowed = TRANSITIONS[order.status] || [];
  if (!allowed.includes(status)) {
    throw Object.assign(
      new Error(`Cannot move order from ${order.status} to ${status}`),
      { status: 409 },
    );
  }

  if (status === "ready") {
    const photo = readyPhoto || order.readyPhoto;
    if (!photo) {
      throw Object.assign(
        new Error("A food photo is required before marking ready"),
        { status: 400, code: "PHOTO_REQUIRED" },
      );
    }
    order.readyPhoto = photo;
  }

  order.status = status;
  await order.save();

  if (status === "completed") {
    await completeReferralIfEligible(order.customerId).catch((e) =>
      console.error("Referral completion check failed:", e.message),
    );
  }

  return order;
}

export async function getById(customerId, orderId) {
  const order = await Order.findOne({ _id: orderId, customerId });
  if (!order)
    throw Object.assign(new Error("Order not found"), { status: 404 });
  return order;
}

export async function cancelOrder(customerId, orderId) {
  const order = await Order.findOne({ _id: orderId, customerId });
  if (!order)
    throw Object.assign(new Error("Order not found"), { status: 404 });

  if (!["pending", "accepted"].includes(order.status)) {
    throw Object.assign(
      new Error(`Cannot cancel an order that is already ${order.status}`),
      { status: 409, code: "ORDER_NOT_CANCELLABLE" },
    );
  }

  // Refund automatically if this order was actually paid for.
  const payment = await Payment.findOne({ orderId: order._id, status: "paid" });
  if (payment) {
    try {
      const refund = await razorpay.payments.refund(payment.razorpayPaymentId, {
        amount: Math.round(payment.amount * 100),
        speed: "optimum",
        notes: { orderId: String(order._id), reason: "Cancelled by customer" },
      });
      payment.status = "refunded";
      payment.refundId = refund.id;
      await payment.save();
    } catch (e) {
      console.error(
        `Refund failed for order ${order._id}, payment ${payment._id}:`,
        e.message,
      );
      throw Object.assign(
        new Error(
          "Cancellation failed — refund could not be processed. Please contact support.",
        ),
        { status: 502, code: "REFUND_FAILED" },
      );
    }
  }

  order.status = "rejected";
  order.notes = order.notes
    ? `${order.notes} | Cancelled by customer`
    : "Cancelled by customer";
  await order.save();
  return order;
}

export async function reorder(customerId, orderId) {
  const original = await Order.findOne({ _id: orderId, customerId });
  if (!original)
    throw Object.assign(new Error("Order not found"), { status: 404 });

  const dishIds = original.items.map((i) => i.dishId);
  const dishes = await Dish.find({
    _id: { $in: dishIds },
    cookId: original.cookId,
    available: true,
  });
  const dishMap = new Map(dishes.map((d) => [d._id.toString(), d]));

  const unavailable = original.items.filter(
    (i) => !dishMap.has(i.dishId.toString()),
  );
  if (unavailable.length === original.items.length) {
    throw Object.assign(
      new Error("None of the items from this order are currently available"),
      { status: 409, code: "REORDER_UNAVAILABLE" },
    );
  }

  await Cart.deleteOne({ customerId });
  const cartItems = original.items
    .filter((i) => dishMap.has(i.dishId.toString()))
    .map((i) => ({ dishId: i.dishId, qty: i.qty }));

  const cart = await Cart.create({
    customerId,
    cookId: original.cookId,
    items: cartItems,
  });

  return {
    cart,
    skippedItems: unavailable.map((i) => ({ dishId: i.dishId, name: i.name })),
  };
}
