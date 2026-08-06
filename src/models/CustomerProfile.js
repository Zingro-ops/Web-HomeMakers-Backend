import mongoose from "mongoose";

const CustomerProfileSchema = new mongoose.Schema(
  {
    customerId: { type: String, required: true, unique: true, index: true },
    dietaryType: {
      type: String,
      enum: ["veg", "non-veg", "vegan", "eggetarian"],
      default: null,
    },
    allergies: [{ type: String, trim: true }],
  },
  { timestamps: true },
);

export const CustomerProfile = mongoose.model(
  "CustomerProfile",
  CustomerProfileSchema,
);
