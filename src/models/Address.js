import mongoose from "mongoose";

const AddressSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: { type: String, enum: ["home", "work", "other"], default: "home" },
    label: { type: String, trim: true, maxlength: 40 },
    line1: { type: String, required: true, trim: true },
    line2: { type: String, trim: true },
    landmark: { type: String, trim: true },
    city: { type: String, required: true, trim: true },
    state: { type: String, required: true, trim: true },
    pincode: { type: String, required: true, trim: true, match: /^\d{6}$/ },
    contactName: { type: String, trim: true },
    contactPhone: { type: String, trim: true, match: /^[6-9]\d{9}$/ },
    placeId: { type: String, trim: true },
    location: {
      type: { type: String, enum: ["Point"], default: "Point" },
      coordinates: { type: [Number], required: true },
    },
    isDefault: { type: Boolean, default: false },
  },
  { timestamps: true }
);

AddressSchema.index({ location: "2dsphere" });
AddressSchema.index({ userId: 1, isDefault: 1 });

export default mongoose.model("Address", AddressSchema);
