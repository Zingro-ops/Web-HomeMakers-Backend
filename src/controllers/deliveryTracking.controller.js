import { z } from "zod";
import * as svc from "../services/deliveryTracking.service.js";
import { ok, fail } from "../utils/apiResponse.js";

const webhookSchema = z.object({
  orderId: z.string(),
  event: z.enum(["assigned", "picked_up", "out_for_delivery", "delivered"]),
  partner: z
    .object({
      name: z.string().optional(),
      phone: z.string().optional(),
      trackingId: z.string().optional(),
    })
    .optional(),
  timestamp: z.string().optional(),
});

export const courierWebhook = async (req, res) => {
  try {
    const dto = webhookSchema.parse(req.body);
    const order = await svc.handleCourierWebhook(dto);
    ok(res, { orderId: order._id, status: order.status }, "Tracking updated");
  } catch (e) {
    if (e instanceof z.ZodError)
      return fail(res, "Validation failed", 400, "VALIDATION");
    fail(res, e.message || "Server error", e.status || 500, e.code);
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
    fail(res, e.message || "Server error", e.status || 500, e.code);
  }
};
