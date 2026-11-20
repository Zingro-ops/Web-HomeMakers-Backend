import mongoose from "mongoose";

const PaymentSchema = new mongoose.Schema(
  {
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
      index: true,
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    razorpayOrderId: { type: String, required: true, unique: true },
    razorpayPaymentId: { type: String },
    razorpaySignature: { type: String },
    amount: { type: Number, required: true },
    currency: { type: String, default: "INR" },
    status: {
      type: String,
      enum: ["created", "paid", "failed", "refunded"],
      default: "created",
    },
    failureReason: { type: String },
    refundId: { type: String, default: null },
    // Lifecycle of the refund AT RAZORPAY, kept separate from `status` so the
    // customer is never told a refund is complete when it was only requested.
    //   none      — no refund has been requested
    //   initiated — refund created at Razorpay (their status "pending")
    //   processed — Razorpay reports the refund processed (money sent back)
    //   failed    — Razorpay reports the refund failed; needs manual action
    // `status: "refunded"` (legacy) is still set when a refund is requested,
    // for backward compatibility; read refundStatus for what actually happened.
    refundStatus: {
      type: String,
      enum: ["none", "initiated", "processed", "failed"],
      default: "none",
    },
    refundAmount: { type: Number, default: null },
    refundInitiatedAt: { type: Date, default: null },
    refundProcessedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

export const Payment = mongoose.model("Payment", PaymentSchema);
