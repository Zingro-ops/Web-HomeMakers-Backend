import { Cart } from "../models/Cart.js";
import { Dish } from "../models/Dish.js";
import { Cook } from "../models/Cook.js";
import { createOrder } from "./order.service.js";

async function hydrate(cart) {
  if (!cart || cart.items.length === 0) {
    return {
      cookId: cart?.cookId || null,
      items: [],
      subtotal: 0,
      isCluster: false,
      clusterDiscountPercent: 0,
      total: 0,
    };
  }

  const dishIds = cart.items.map((i) => i.dishId);
  const dishes = await Dish.find({ _id: { $in: dishIds } });
  const dishMap = new Map(dishes.map((d) => [d._id.toString(), d]));

  const items = cart.items.map((i) => {
    const dish = dishMap.get(i.dishId.toString());
    return {
      dishId: i.dishId,
      qty: i.qty,
      name: dish?.name || "Unavailable dish",
      price: dish?.price ?? 0,
      available: dish?.available ?? false,
    };
  });

  const subtotal = items.reduce((sum, i) => sum + i.price * i.qty, 0);
  const totalQty = items.reduce((sum, i) => sum + i.qty, 0);

  const cook = await Cook.findById(cart.cookId).select(
    "clusterSettings personal.name",
  );
  const cluster = cook?.clusterSettings || {};
  const isCluster =
    !!cluster.enabled && totalQty >= (cluster.minQty || Infinity);
  const clusterDiscountPercent = isCluster ? cluster.discountPercent || 0 : 0;
  const total = Math.round(subtotal * (1 - clusterDiscountPercent / 100));

  return {
    cookId: cart.cookId,
    cookName: cook?.personal?.name || null,
    items,
    subtotal,
    isCluster,
    clusterDiscountPercent,
    total,
  };
}

export async function getCart(customerId) {
  const cart = await Cart.findOne({ customerId });
  return hydrate(cart);
}

export async function addItem(customerId, { cookId, dishId, qty, replace }) {
  const dish = await Dish.findOne({ _id: dishId, cookId, available: true });
  if (!dish)
    throw Object.assign(new Error("Dish not available"), { status: 400 });

  let cart = await Cart.findOne({ customerId });

  if (
    cart &&
    cart.cookId &&
    cart.cookId.toString() !== cookId &&
    cart.items.length > 0
  ) {
    if (!replace) {
      throw Object.assign(
        new Error(
          "Cart has items from another cook. Pass replace:true to clear and switch.",
        ),
        { status: 409 },
      );
    }
    cart.items = [];
    cart.cookId = cookId;
  }

  if (!cart) {
    cart = new Cart({ customerId, cookId, items: [] });
  }
  cart.cookId = cookId;

  const existing = cart.items.find((i) => i.dishId.toString() === dishId);
  if (existing) {
    existing.qty += qty;
  } else {
    cart.items.push({ dishId, qty });
  }

  await cart.save();
  return hydrate(cart);
}

export async function updateItem(customerId, dishId, qty) {
  const cart = await Cart.findOne({ customerId });
  if (!cart) throw Object.assign(new Error("Cart not found"), { status: 404 });

  const item = cart.items.find((i) => i.dishId.toString() === dishId);
  if (!item)
    throw Object.assign(new Error("Item not in cart"), { status: 404 });

  item.qty = qty;
  await cart.save();
  return hydrate(cart);
}

export async function removeItem(customerId, dishId) {
  const cart = await Cart.findOne({ customerId });
  if (!cart) throw Object.assign(new Error("Cart not found"), { status: 404 });

  cart.items = cart.items.filter((i) => i.dishId.toString() !== dishId);
  if (cart.items.length === 0) cart.cookId = null;
  await cart.save();
  return hydrate(cart);
}

export async function clearCart(customerId) {
  await Cart.findOneAndUpdate(
    { customerId },
    { $set: { items: [], cookId: null } },
    { upsert: true },
  );
  return { cleared: true };
}

export async function checkout(customer, data) {
  const cart = await Cart.findOne({ customerId: customer.id });
  if (!cart || cart.items.length === 0) {
    throw Object.assign(new Error("Cart is empty"), { status: 400 });
  }

  const order = await createOrder(customer, {
    cookId: cart.cookId.toString(),
    items: cart.items.map((i) => ({ dishId: i.dishId.toString(), qty: i.qty })),
    ...data,
  });

  await Cart.findOneAndUpdate(
    { customerId: customer.id },
    { $set: { items: [], cookId: null } },
  );

  return order;
}
