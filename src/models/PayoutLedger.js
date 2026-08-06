import mongoose from "mongoose";

const PayoutLedgerSchema = new mongoose.Schema(
  {
    cookId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Cook",
      required: true,
      index: true,
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
    },
    razorpayTransferId: { type: String },
    grossAmount: { type: Number, required: true },
    commissionDeducted: { type: Number, required: true },
    netAmount: { type: Number, required: true },
    status: {
      type: String,
      enum: ["held", "settled", "failed"],
      default: "held",
    },
    scheduledReleaseDate: { type: Date, required: true },
    settledAt: { type: Date },
  },
  { timestamps: true },
);

PayoutLedgerSchema.index({ cookId: 1, status: 1 });

export const PayoutLedger = mongoose.model("PayoutLedger", PayoutLedgerSchema);
