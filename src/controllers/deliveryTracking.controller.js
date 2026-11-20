import { z } from "zod";
import * as svc from "../services/deliveryTracking.service.js";
import { ok, fail } from "../utils/apiResponse.js";

// Strict: unknown keys are rejected, every string is bounded, and the partner
// fields that are shown to customers are format-checked so a payload cannot
// carry markup, URLs or arbitrary text into the customer's order screen.
const webhookSchema = z
  .object({
    eventId: z.string().regex(/^[A-Za-z0-9._:-]{1,128}$/),
    orderId: z.string().regex(/^[a-f\d]{24}$/i),
    event: z.enum(["assigned", "picked_up", "out_for_delivery", "delivered"]),
    partner: z
      .object({
        name: z
          .string()
          .trim()
          .regex(/^[\p{L}\p{M} .'-]{1,80}$/u, "Invalid partner name")
          .optional(),
        phone: z
          .string()
          .regex(/^\+?\d{10,13}$/, "Invalid partner phone")
          .optional(),
        trackingId: z
          .string()
          .regex(/^[A-Za-z0-9_-]{1,64}$/, "Invalid tracking id")
          .optional(),
      })
      .strict()
      .optional(),
    timestamp: z.string().datetime().optional(),
  })
  .strict();

export const courierWebhook = async (req, res) => {
  try {
    const dto = webhookSchema.parse(req.body);
    const result = await svc.handleCourierWebhook(dto);
    ok(
      res,
      {
        orderId: result.order._id,
        status: result.order.status,
        duplicate: result.duplicate,
      },
      result.duplicate ? "Event already processed" : "Tracking updated",
    );
  } catch (e) {
    if (e instanceof z.ZodError)
      return fail(res, "Validation failed", 400, "VALIDATION");
    // Retryable: another delivery of this event is mid-flight. A non-2xx makes
    // the provider retry; it is never acknowledged as processed.
    if (e?.code === "EVENT_IN_PROGRESS") res.set("Retry-After", "30");
    fail(res, e.status ? e.message : "Server error", e.status || 500, e.code);
  }
};

export const getTracking = async (req, res) => {
  try {
    ok(
      res,
      await svc.getTrackingStatus(req.user.id, req.params.id),
      "Tracking status fetched",
    );
  } catch (e) {
    if (e?.name === "CastError")
      return fail(res, "Order not found", 404);
    fail(res, e.message || "Server error", e.status || 500, e.code);
  }
};
