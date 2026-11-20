import mongoose from "mongoose";

/**
 * One row per courier webhook event id we have accepted. The unique index on
 * `eventId` makes delivery idempotent: a provider retry, or a replay inside
 * the signature's timestamp window, is acknowledged without being applied
 * twice. Rows expire after 7 days (longer than any provider retry window).
 */
const CourierWebhookEventSchema = new mongoose.Schema({
  eventId: { type: String, required: true, unique: true },
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true },
  event: { type: String, required: true },
  receivedAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 7 },
});

export const CourierWebhookEvent = mongoose.model(
  "CourierWebhookEvent",
  CourierWebhookEventSchema,
);
