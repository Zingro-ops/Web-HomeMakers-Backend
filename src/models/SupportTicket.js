import mongoose from "mongoose";

const SupportTicketSchema = new mongoose.Schema(
  {
    customerId: { type: String, required: true, index: true },
    subject: { type: String, required: true, trim: true, maxlength: 150 },
    message: { type: String, required: true, trim: true, maxlength: 2000 },
    category: {
      type: String,
      enum: ["order", "payment", "account", "other"],
      required: true,
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      default: null,
    },
    status: {
      type: String,
      enum: ["open", "in_progress", "resolved", "closed"],
      default: "open",
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high"],
      default: "medium",
    },
    responses: [
      {
        message: { type: String, required: true },
        respondedBy: {
          type: String,
          enum: ["customer", "support"],
          required: true,
        },
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true },
);

SupportTicketSchema.index({ customerId: 1, status: 1 });

export const SupportTicket = mongoose.model(
  "SupportTicket",
  SupportTicketSchema,
);
