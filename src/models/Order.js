import mongoose from "mongoose";
const { Schema } = mongoose;

const orderItemSchema = new Schema(
  {
    dishId: { type: Schema.Types.ObjectId, ref: "Dish", required: true },
    name: { type: String, required: true },
    price: { type: Number, required: true },
    qty: { type: Number, required: true, min: 1 },
  },
  { _id: false },
);

const orderSchema = new Schema(
  {
    cookId: {
      type: Schema.Types.ObjectId,
      ref: "Cook",
      required: true,
      index: true,
    },
    customerId: { type: String, required: true, index: true },
    customerName: { type: String, default: null },
    customerPhone: { type: String, required: true },
    items: { type: [orderItemSchema], required: true },
    total: { type: Number, required: true },
    status: {
      type: String,
      enum: ["pending", "preparing", "ready", "completed", "rejected"],
      default: "pending",
      index: true,
    },
    deliveryAddress: {
      building: String,
      locality: String,
      pincode: String,
    },
    orderType: {
      type: String,
      enum: ["quick", "prebooking"],
      default: "quick",
      index: true,
    },
    scheduledFor: { type: Date, default: null },
    isCluster: { type: Boolean, default: false },
    subtotal: { type: Number, required: true },
    clusterDiscountPercent: { type: Number, default: 0 },
    notes: { type: String, default: "" },
  },
  { timestamps: true },
);

export const Order = mongoose.model("Order", orderSchema);
