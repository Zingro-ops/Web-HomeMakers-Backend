import mongoose from "mongoose";

const ReviewSchema = new mongoose.Schema(
  {
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
      unique: true,
    },
    customerId: { type: String, required: true, index: true },
    cookId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Cook",
      required: true,
      index: true,
    },
    rating: { type: Number, required: true, min: 1, max: 5 },
    text: { type: String, trim: true, maxlength: 1000 },
    images: [{ type: String }], // S3 keys
    dishRatings: [
      {
        dishId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Dish",
          required: true,
        },
        rating: { type: Number, required: true, min: 1, max: 5 },
      },
    ],
    likes: [{ type: String }], // array of userIds who liked
  },
  { timestamps: true },
);

ReviewSchema.index({ cookId: 1, createdAt: -1 });

export const Review = mongoose.model("Review", ReviewSchema);
