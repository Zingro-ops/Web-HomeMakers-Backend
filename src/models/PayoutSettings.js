import mongoose from "mongoose";

const PayoutSettingsSchema = new mongoose.Schema(
  {
    cookId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Cook",
      required: true,
      unique: true,
      index: true,
    },
    razorpayAccountId: { type: String },
    linkedAccountStatus: {
      type: String,
      enum: ["not_created", "pending", "active", "rejected"],
      default: "not_created",
    },
    payoutFrequency: {
      type: String,
      enum: ["daily", "weekly", "monthly"],
      required: true,
    },
    payoutDayOfWeek: { type: Number, min: 0, max: 6 }, // 0=Sun, required if weekly
    payoutDayOfMonth: { type: Number, min: 1, max: 28 }, // required if monthly
    commissionPercent: { type: Number, default: 12 },
  },
  { timestamps: true },
);

export const PayoutSettings = mongoose.model(
  "PayoutSettings",
  PayoutSettingsSchema,
);
