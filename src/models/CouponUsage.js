import mongoose from "mongoose";

const CouponUsageSchema = new mongoose.Schema(
  {
    couponId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Coupon",
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order" },
    discountApplied: { type: Number, required: true },
  },
  { timestamps: true },
);

CouponUsageSchema.index({ couponId: 1, userId: 1 });

export default mongoose.model("CouponUsage", CouponUsageSchema);
