import { Order } from "../models/Order.js";
import { Dish } from "../models/Dish.js";
import { Cook } from "../models/Cook.js";
import { completeReferralIfEligible } from "./referral.service.js";
import { Cart } from "../models/Cart.js";

const TRANSITIONS = {
  pending: ["preparing", "rejected"],
  preparing: ["ready"],
  ready: ["completed"],
};

export async function createOrder(customer, data) {
  const cook = await Cook.findOne({ _id: data.cookId, status: "approved" });
  if (!cook) throw Object.assign(new Error("Cook not found"), { status: 404 });

  const dishIds = data.items.map((i) => i.dishId);
  const dishes = await Dish.find({
    _id: { $in: dishIds },
    cookId: data.cookId,
    available: true,
  });
  const dishMap = new Map(dishes.map((d) => [d._id.toString(), d]));

  const items = data.items.map((i) => {
    const dish = dishMap.get(i.dishId);
    if (!dish)
      throw Object.assign(new Error(`Dish ${i.dishId} not available`), {
        status: 400,
      });
    return { dishId: dish._id, name: dish.name, price: dish.price, qty: i.qty };
  });

  const totalQty = items.reduce((sum, i) => sum + i.qty, 0);
  const subtotal = items.reduce((sum, i) => sum + i.price * i.qty, 0);

  const cluster = cook.clusterSettings || {};
  const isCluster = !!cluster.enabled && totalQty >= (cluster.minQty || Infinity);
  const clusterDiscountPercent = isCluster ? cluster.discountPercent || 0 : 0;
  const total = Math.round(subtotal * (1 - clusterDiscountPercent / 100));

  return Order.create({
    cookId: data.cookId,
    customerId: customer.id,
    customerPhone: customer.phone,
    customerName: data.customerName || null,
    orderType: data.orderType,
    scheduledFor: data.scheduledFor || null,
    isCluster,
    clusterDiscountPercent,
    items,
    subtotal,
    total,
    deliveryAddress: data.deliveryAddress,
    notes: data.notes,
  });
}

export async function listCustomerOrders(customerId, { page, limit }) {
  const filter = { customerId };
  const [items, total] = await Promise.all([
    Order.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Order.countDocuments(filter),
  ]);
  return { items, total, page, limit };
}

export async function listCookOrders(cookId, { status, orderType, isCluster, page, limit }) {
  const filter = {
    cookId,
    ...(status ? { status } : {}),
    ...(orderType ? { orderType } : {}),
    ...(isCluster !== undefined ? { isCluster } : {}),
  };
  const [items, total] = await Promise.all([
    Order.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Order.countDocuments(filter),
  ]);
  return { items, total, page, limit };
}

export async function updateOrderStatus(cookId, orderId, status, readyPhoto) {
  const order = await Order.findOne({ _id: orderId, cookId });
  if (!order) throw Object.assign(new Error("Order not found"), { status: 404 });

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
      throw Object.assign(new Error("A food photo is required before marking ready"), { status: 400, code: "PHOTO_REQUIRED" });
    }
    order.readyPhoto = photo;
  }

  order.status = status;
  await order.save();

  if (status === "completed") {
    await completeReferralIfEligible(order.customerId).catch((e) => console.error("Referral completion check failed:", e.message));
  }

  return order;
}


export async function getById(customerId, orderId) {
  const order = await Order.findOne({ _id: orderId, customerId });
  if (!order) throw Object.assign(new Error("Order not found"), { status: 404 });
  return order;
}

export async function cancelOrder(customerId, orderId) {
  const order = await Order.findOne({ _id: orderId, customerId });
  if (!order) throw Object.assign(new Error("Order not found"), { status: 404 });

  if (order.status !== "pending") {
    throw Object.assign(
      new Error(`Cannot cancel an order that is already ${order.status}`),
      { status: 409, code: "ORDER_NOT_CANCELLABLE" }
    );
  }

  order.status = "rejected";
  order.notes = order.notes ? `${order.notes} | Cancelled by customer` : "Cancelled by customer";
  await order.save();
  return order;
}

export async function reorder(customerId, orderId) {
  const original = await Order.findOne({ _id: orderId, customerId });
  if (!original) throw Object.assign(new Error("Order not found"), { status: 404 });

  const dishIds = original.items.map((i) => i.dishId);
  const dishes = await Dish.find({ _id: { $in: dishIds }, cookId: original.cookId, available: true });
  const dishMap = new Map(dishes.map((d) => [d._id.toString(), d]));

  const unavailable = original.items.filter((i) => !dishMap.has(i.dishId.toString()));
  if (unavailable.length === original.items.length) {
    throw Object.assign(new Error("None of the items from this order are currently available"), { status: 409, code: "REORDER_UNAVAILABLE" });
  }

  await Cart.deleteOne({ customerId });
  const cartItems = original.items
    .filter((i) => dishMap.has(i.dishId.toString()))
    .map((i) => ({ dishId: i.dishId, qty: i.qty }));

  const cart = await Cart.create({ customerId, cookId: original.cookId, items: cartItems });

  return {
    cart,
    skippedItems: unavailable.map((i) => ({ dishId: i.dishId, name: i.name })),
  };
}




