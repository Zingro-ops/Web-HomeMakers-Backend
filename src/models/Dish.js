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
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: "Category", default: null },
    spicyLevel: { type: Number, min: 0, max: 3, default: 0 },
    discount: { type: Number, min: 0, max: 100, default: 0 },
    price: { type: Number, required: true, min: 0 },
    desc: { type: String, trim: true, default: "" },
    tag: { type: String, default: null },
    ratingAvg: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },
    available: { type: Boolean, default: true },
    image_s3_key: { type: String, default: null }, // ADD THIS
  },
  { timestamps: true },
);

dishSchema.index({ name: "text", category: "text", tag: "text" });
export const Dish = mongoose.model("Dish", dishSchema);



