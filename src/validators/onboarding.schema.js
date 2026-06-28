import { z } from "zod";

const PAN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const IFSC = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const GSTIN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

export const stepSchemas = {
  personal: z.object({
    name: z.string().min(2),
    email: z.string().email(),
    gender: z.string().min(1),
  }),
  address: z.object({
    building: z.string().min(1),
    locality: z.string().min(1),
    pincode: z.string().regex(/^\d{6}$/, "Invalid pincode"),
  }),
  tax: z.object({
    pan: z.string().regex(PAN, "Invalid PAN"),
    gst: z
      .union([z.string().regex(GSTIN, "Invalid GST"), z.literal("")])
      .optional()
      .default(""),
  }),
  bank: z.object({
    holder: z.string().min(2),
    account: z.string().regex(/^\d{9,18}$/, "Invalid account number"),
    ifsc: z.string().regex(IFSC, "Invalid IFSC"),
  }),
  fssai: z.object({
    license: z.string().regex(/^\d{14}$/, "FSSAI must be 14 digits"),
  }),
  food: z.object({
    cuisine: z.string().min(1),
    category: z.string().min(1),
    radius: z.string().min(1),
    description: z.string().min(1),
  }),
  photos: z.object({
    gps: z.object({ lat: z.number(), lng: z.number() }),
    kitchenName: z.string().min(1),
    profileName: z.string().min(1),
  }),
};

export const STEP_ORDER = [
  "personal",
  "address",
  "tax",
  "bank",
  "fssai",
  "food",
  "photos",
];

export const draftSchema = z.object({
  step: z.enum(STEP_ORDER),
  data: z.record(z.any()),
});

export const submitSchema = z.object({
  terms: z.literal(true),
  privacy: z.literal(true),
});
