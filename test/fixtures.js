import { Cook } from "../src/models/Cook.js";
import { Dish } from "../src/models/Dish.js";
import Address from "../src/models/Address.js";
import { Cart } from "../src/models/Cart.js";
import { Order } from "../src/models/Order.js";
import { oid } from "./helpers.js";

// Bengaluru coordinates, ~1.5 km apart.
const KITCHEN = [77.6101, 12.9352];
const HOME = [77.6245, 12.9411];

export async function seedKitchenWithDish({ price = 200 } = {}) {
  const cook = await Cook.create({
    zingroUserId: oid(),
    phone: "9000000001",
    status: "approved",
    location: { type: "Point", coordinates: KITCHEN },
  });
  const dish = await Dish.create({
    cookId: cook._id,
    name: "Dal Khichdi",
    category: "lunch",
    price,
    available: true,
  });
  return { cook, dish };
}

export async function seedAddress(userId) {
  return Address.create({
    userId,
    line1: "12 Test Street",
    city: "Bengaluru",
    state: "Karnataka",
    pincode: "560034",
    location: { type: "Point", coordinates: HOME },
  });
}

export async function seedCart(customerId, cook, dish, qty = 2) {
  return Cart.create({
    customerId,
    cookId: cook._id,
    items: [{ dishId: dish._id, qty }],
  });
}

export async function seedOrder({ cook, dish, customerId = oid(), status = "ready" }) {
  return Order.create({
    cookId: cook._id,
    customerId,
    customerPhone: "9876543210",
    items: [{ dishId: dish._id, name: dish.name, price: dish.price, qty: 1 }],
    subtotal: dish.price,
    total: dish.price,
    status,
  });
}
