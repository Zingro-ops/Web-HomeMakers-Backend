import mongoose from "mongoose";

/**
 * Durable state for each courier webhook event id.
 *
 *   processing ──► applied   (status change written to the order)
 *        │
 *        └──────► failed     (not applied; may be re-claimed and retried)
 *
 * A row is created atomically on first delivery (unique `eventId`), which is
 * the CLAIM. A later delivery may take over only by an atomic conditional
 * update, and only when the row is `failed` or its `processing` claim is older
 * than the processing lease (the claimer crashed). `claimToken` changes on
 * every claim so a stale worker can never overwrite a newer claimer's state.
 *
 * `payloadHash` binds the id to its payload: the same eventId with different
 * content is refused instead of silently treated as a duplicate.
 * `payload` (the validated event) is kept so failed events can be re-driven
 * internally (`reprocessPendingCourierEvents`) if the provider stops retrying.
 *
 * Rows expire 7 days after first receipt — longer than provider retry windows.
 */
const CourierWebhookEventSchema = new mongoose.Schema({
  eventId: { type: String, required: true, unique: true },
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true },
  event: { type: String, required: true },
  payloadHash: { type: String, required: true },
  payload: { type: mongoose.Schema.Types.Mixed, required: true },
  state: {
    type: String,
    enum: ["processing", "applied", "failed"],
    required: true,
    index: true,
  },
  attempts: { type: Number, default: 1 },
  claimToken: { type: String, required: true },
  claimedAt: { type: Date, required: true },
  appliedAt: { type: Date, default: null },
  lastError: {
    code: { type: String, default: null },
    message: { type: String, default: null },
  },
  receivedAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 7 },
});

export const CourierWebhookEvent = mongoose.model(
  "CourierWebhookEvent",
  CourierWebhookEventSchema,
);
