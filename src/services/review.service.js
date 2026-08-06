import mongoose from "mongoose";
import { Review } from "../models/Review.js";
import { Order } from "../models/Order.js";
import { Cook } from "../models/Cook.js";
import { Dish } from "../models/Dish.js";

async function recalcCookRating(cookId) {
  const agg = await Review.aggregate([
    { $match: { cookId } },
    { $group: { _id: null, avg: { $avg: "$rating" }, count: { $sum: 1 } } },
  ]);
  const { avg = 0, count = 0 } = agg[0] || {};
  await Cook.updateOne(
    { _id: cookId },
    { ratingAvg: Math.round(avg * 10) / 10, ratingCount: count },
  );
}

async function recalcDishRating(dishId) {
  const objectId = new mongoose.Types.ObjectId(dishId);
  const agg = await Review.aggregate([
    { $unwind: "$dishRatings" },
    { $match: { "dishRatings.dishId": objectId } },
    {
      $group: {
        _id: null,
        avg: { $avg: "$dishRatings.rating" },
        count: { $sum: 1 },
      },
    },
  ]);
  const { avg = 0, count = 0 } = agg[0] || {};
  await Dish.updateOne(
    { _id: dishId },
    { ratingAvg: Math.round(avg * 10) / 10, ratingCount: count },
  );
}

export async function create(customerId, orderId, dto) {
  const order = await Order.findOne({ _id: orderId, customerId });
  if (!order)
    throw Object.assign(new Error("Order not found"), { status: 404 });

  if (order.status !== "completed") {
    throw Object.assign(new Error("You can only review completed orders"), {
      status: 409,
      code: "ORDER_NOT_COMPLETED",
    });
  }

  const existing = await Review.findOne({ orderId });
  if (existing)
    throw Object.assign(new Error("You've already reviewed this order"), {
      status: 409,
      code: "ALREADY_REVIEWED",
    });

  const review = await Review.create({
    orderId,
    customerId,
    cookId: order.cookId,
    rating: dto.rating,
    text: dto.text,
    images: dto.images || [],
    dishRatings: dto.dishRatings || [],
  });

  await recalcCookRating(order.cookId);
  for (const dr of dto.dishRatings || []) {
    await recalcDishRating(dr.dishId);
  }

  return review;
}

export async function listForCook(cookId, { page = 1, limit = 20 } = {}) {
  const skip = (Number(page) - 1) * Number(limit);
  const [items, total] = await Promise.all([
    Review.find({ cookId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit)),
    Review.countDocuments({ cookId }),
  ]);
  return { items, total, page: Number(page), limit: Number(limit) };
}

export async function toggleLike(userId, reviewId) {
  const review = await Review.findById(reviewId);
  if (!review)
    throw Object.assign(new Error("Review not found"), { status: 404 });

  const idx = review.likes.indexOf(userId);
  if (idx === -1) review.likes.push(userId);
  else review.likes.splice(idx, 1);

  await review.save();
  return { liked: idx === -1, likeCount: review.likes.length };
}


