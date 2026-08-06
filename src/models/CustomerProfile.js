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
    walletBalance: { type: Number, default: 0, min: 0 },
    referralCode: { type: String, unique: true, sparse: true },
  },
  { timestamps: true },
);

export const CustomerProfile = mongoose.model(
  "CustomerProfile",
  CustomerProfileSchema,
);

