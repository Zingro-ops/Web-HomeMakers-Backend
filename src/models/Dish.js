import mongoose from "mongoose";
const { Schema } = mongoose;

const dishSchema = new Schema(
  {
    cookId: {
      type: Schema.Types.ObjectId,
      ref: "Cook",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true },
    price: { type: Number, required: true, min: 0 },
    desc: { type: String, trim: true, default: "" },
    tag: { type: String, default: null },
    available: { type: Boolean, default: true },
    image_s3_key: { type: String, default: null }, // ADD THIS
  },
  { timestamps: true },
);

export const Dish = mongoose.model("Dish", dishSchema);
