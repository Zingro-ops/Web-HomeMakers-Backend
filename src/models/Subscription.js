import mongoose from "mongoose";

const SubscriptionSchema = new mongoose.Schema(
  {
    customerId: { type: String, required: true, index: true },
    cookId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Cook",
      required: true,
    },
    frequency: {
      type: String,
      enum: ["daily", "weekly", "monthly", "custom"],
      required: true,
    },
    daysOfWeek: [{ type: Number, min: 0, max: 6 }], // used for weekly/custom
    dayOfMonth: { type: Number, min: 1, max: 28 }, // used for monthly
    dishes: [
      {
        dishId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Dish",
          required: true,
        },
        qty: { type: Number, required: true, min: 1 },
      },
    ],
    status: {
      type: String,
      enum: ["active", "paused", "cancelled"],
      default: "active",
    },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    skippedDates: [{ type: Date }],
    vacationRanges: [{ from: Date, to: Date }],
  },
  { timestamps: true },
);

SubscriptionSchema.index({ customerId: 1, status: 1 });

export const Subscription = mongoose.model("Subscription", SubscriptionSchema);
