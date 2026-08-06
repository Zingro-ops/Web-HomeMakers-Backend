import mongoose from "mongoose";

const { Schema } = mongoose;

const cookSchema = new Schema(
  {
    zingroUserId: { type: String, required: true, unique: true, index: true },
    phone: { type: String, required: true, index: true },
    email: { type: String, trim: true, lowercase: true, default: null },

    ratingAvg: { type: Number, default: 0 },

    ratingCount: { type: Number, default: 0 },

    status: {
      type: String,
      enum: [
        "draft",
        "verification_pending",
        "manual_review",
        "approved",
        "rejected",
      ],
      default: "draft",
      index: true,
    },
    currentStep: { type: Number, default: 1 },
    personal: { name: String, gender: String },
    address: { building: String, locality: String, pincode: String },
    tax: {
      masked: String,
      name_on_pan: String,
      verified: Boolean,
      ref_id: String,
      gst: String,
      gst_verified: Boolean,
    },
    bank: {
      masked: String,
      ifsc: String,
      holder_name: String,
      penny_drop_ok: Boolean,
      ref_id: String,
    },
    fssai: {
      license_masked: String,
      active: Boolean,
      registered_name: String,
      expiry: String,
      ref_id: String,
    },
    food: {
      cuisine: String,
      category: String,
      radius: String,
      description: String,
    },
    photos: {
      kitchen_s3_key: String,
      profile_s3_key: String,
      gps: { lat: Number, lng: Number },
    },
    kyc: {
      name_match_score: Number,
      decision: String,
      decided_at: Date,
      decided_by: String,
      note: String,
    },
    clusterSettings: {
      enabled: { type: Boolean, default: false },
      minQty: { type: Number, default: 20 },
      discountPercent: { type: Number, default: 10, min: 0, max: 50 },
    },
    consent: { terms_accepted_at: Date, privacy_accepted_at: Date, ip: String },
    location: {
      type: { type: String, enum: ["Point"], default: "Point" },
      coordinates: { type: [Number], default: [0, 0] }, // [lng, lat] â€” GeoJSON order, NOT [lat, lng]
    },
  },
  { timestamps: true },
);

cookSchema.index({ location: "2dsphere" });

cookSchema.index({ "personal.name": "text", "food.cuisine": "text", "food.category": "text", "food.description": "text" });
const DAY_HOURS = { open: { type: String, default: null }, close: { type: String, default: null }, closed: { type: Boolean, default: false } };
cookSchema.add({
  hours: {
    monday: DAY_HOURS, tuesday: DAY_HOURS, wednesday: DAY_HOURS,
    thursday: DAY_HOURS, friday: DAY_HOURS, saturday: DAY_HOURS, sunday: DAY_HOURS,
  },
});
export const Cook = mongoose.model("Cook", cookSchema);



