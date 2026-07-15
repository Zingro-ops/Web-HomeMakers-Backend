import { Dish } from "../models/Dish.js";
import { presignGet } from "./s3.service.js";

function assertOwnedKey(cookId, imageKey) {
  if (imageKey && !imageKey.startsWith(`cooks/${cookId}/`)) {
    throw Object.assign(new Error("Image key does not belong to cook"), {
      status: 403,
    });
  }
}

async function withImageUrl(dish) {
  if (!dish) return dish;
  const obj = dish.toObject ? dish.toObject() : dish;
  if (obj.image_s3_key) {
    obj.imageUrl = await presignGet(obj.image_s3_key);
  }
  return obj;
}

export async function listDishes(cookId) {
  const dishes = await Dish.find({ cookId }).sort({ createdAt: -1 }).lean();
  return Promise.all(dishes.map(withImageUrl));
}

export async function createDish(cookId, { imageKey, ...data }) {
  assertOwnedKey(cookId, imageKey);
  const dish = await Dish.create({
    cookId,
    ...data,
    image_s3_key: imageKey || null,
  });
  return withImageUrl(dish);
}

export async function updateDish(cookId, dishId, { imageKey, ...data }) {
  assertOwnedKey(cookId, imageKey);
  const update = { ...data };
  if (imageKey) update.image_s3_key = imageKey;

  const dish = await Dish.findOneAndUpdate(
    { _id: dishId, cookId },
    { $set: update },
    { new: true },
  );
  if (!dish) throw Object.assign(new Error("Dish not found"), { status: 404 });
  return withImageUrl(dish);
}

export async function deleteDish(cookId, dishId) {
  const dish = await Dish.findOneAndDelete({ _id: dishId, cookId });
  if (!dish) throw Object.assign(new Error("Dish not found"), { status: 404 });
  return { deleted: true };
}
