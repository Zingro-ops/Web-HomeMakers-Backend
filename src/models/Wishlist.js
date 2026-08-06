import mongoose from "mongoose";

const WishlistSchema = new mongoose.Schema(
  {
    customerId: { type: String, required: true, index: true },
    dishId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Dish",
      required: true,
    },
  },
  { timestamps: true },
);

WishlistSchema.index({ customerId: 1, dishId: 1 }, { unique: true });

export const Wishlist = mongoose.model("Wishlist", WishlistSchema);
