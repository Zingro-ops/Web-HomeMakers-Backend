import mongoose from "mongoose";

const { Schema } = mongoose;

const cookSchema = new Schema(
  {
    zingroUserId: { type: String, required: true, unique: true, index: true },
    phone: { type: String, required: true, index: true },

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
    consent: { terms_accepted_at: Date, privacy_accepted_at: Date, ip: String },
  },
  { timestamps: true },
);

export const Cook = mongoose.model("Cook", cookSchema);
