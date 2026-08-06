import mongoose from "mongoose";

const CouponSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    type: { type: String, enum: ["flat", "percentage"], required: true },
    value: { type: Number, required: true, min: 0 },
    maxDiscount: { type: Number, min: 0 }, // cap for percentage type
    minOrderValue: { type: Number, default: 0 },
    cookId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Cook",
      default: null,
    }, // null = platform-wide
    usageLimit: { type: Number, default: null }, // null = unlimited
    usageLimitPerUser: { type: Number, default: 1 },
    usedCount: { type: Number, default: 0 },
    startsAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

CouponSchema.index({ cookId: 1, isActive: 1 });

export default mongoose.model("Coupon", CouponSchema);
