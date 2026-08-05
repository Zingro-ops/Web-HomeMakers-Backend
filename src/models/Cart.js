import mongoose from "mongoose";
const { Schema } = mongoose;

const cartItemSchema = new Schema(
  {
    dishId: { type: Schema.Types.ObjectId, ref: "Dish", required: true },
    qty: { type: Number, required: true, min: 1 },
  },
  { _id: false },
);

const cartSchema = new Schema(
  {
    customerId: { type: String, required: true, unique: true, index: true },
    cookId: { type: Schema.Types.ObjectId, ref: "Cook", default: null },
    items: { type: [cartItemSchema], default: [] },
  },
  { timestamps: true },
);

export const Cart = mongoose.model("Cart", cartSchema);
