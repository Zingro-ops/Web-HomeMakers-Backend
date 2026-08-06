import { z } from "zod";
import * as svc from "../services/checkout.service.js";
import { ok, fail } from "../utils/apiResponse.js";

const schema = z.object({
  addressId: z.string(),
  couponCode: z.string().optional(),
});

export const preview = async (req, res) => {
  try {
    const dto = schema.parse(req.body);
    const breakdown = await svc.computeBreakdown({
      userId: req.user.id,
      ...dto,
    });
    ok(res, breakdown, "Checkout breakdown computed");
  } catch (e) {
    if (e instanceof z.ZodError)
      return fail(res, "Validation failed", 400, "VALIDATION");
    fail(res, e.message || "Server error", e.status || 500, e.code);
  }
};
