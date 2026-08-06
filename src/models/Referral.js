import mongoose from "mongoose";

const ReferralSchema = new mongoose.Schema(
  {
    referrerCustomerId: { type: String, required: true, index: true },
    referredCustomerId: { type: String, required: true, unique: true }, // one referral per new customer, ever
    code: { type: String, required: true },
    status: {
      type: String,
      enum: ["pending", "completed"],
      default: "pending",
    },
    rewardAmount: { type: Number, default: 50 },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

export const Referral = mongoose.model("Referral", ReferralSchema);
