import { Wishlist } from "../models/Wishlist.js";
import { Dish } from "../models/Dish.js";

export async function add(customerId, dishId) {
  const dish = await Dish.findById(dishId);
  if (!dish) throw Object.assign(new Error("Dish not found"), { status: 404 });

  const existing = await Wishlist.findOne({ customerId, dishId });
  if (existing)
    throw Object.assign(new Error("Already in wishlist"), {
      status: 409,
      code: "ALREADY_WISHLISTED",
    });

  return Wishlist.create({ customerId, dishId });
}

export async function list(customerId) {
  const items = await Wishlist.find({ customerId })
    .sort({ createdAt: -1 })
    .lean();
  const dishIds = items.map((i) => i.dishId);
  const dishes = await Dish.find({ _id: { $in: dishIds } }).lean();
  const dishMap = new Map(dishes.map((d) => [d._id.toString(), d]));

  return items.map((i) => ({
    wishlistId: i._id,
    addedAt: i.createdAt,
    dish: dishMap.get(i.dishId.toString()) || null,
  }));
}

export async function remove(customerId, dishId) {
  const result = await Wishlist.findOneAndDelete({ customerId, dishId });
  if (!result)
    throw Object.assign(new Error("Not in wishlist"), { status: 404 });
  return result;
}
