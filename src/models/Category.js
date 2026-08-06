import mongoose from "mongoose";

const CategorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    slug: { type: String, required: true, unique: true, index: true },
    image: { type: String, trim: true }, // S3 key
    mealType: {
      type: String,
      enum: ["breakfast", "lunch", "dinner", "snacks", "desserts", "beverages"],
      required: true,
    },
    displayOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

CategorySchema.index({ isActive: 1, displayOrder: 1 });

export default mongoose.model("Category", CategorySchema);
