import { z } from "zod";
import * as svc from "../services/review.service.js";
import { ok, fail } from "../utils/apiResponse.js";

const createSchema = z.object({
  rating: z.number().min(1).max(5),
  text: z.string().max(1000).optional(),
  images: z.array(z.string()).optional(),
  dishRatings: z
    .array(z.object({ dishId: z.string(), rating: z.number().min(1).max(5) }))
    .optional(),
});

const wrap = (fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (e) {
    if (e instanceof z.ZodError)
      return fail(res, "Validation failed", 400, "VALIDATION");
    fail(res, e.message || "Server error", e.status || 500, e.code);
  }
};

export const create = wrap(async (req, res) => {
  const dto = createSchema.parse(req.body);
  ok(
    res,
    await svc.create(req.user.id, req.params.orderId, dto),
    "Review submitted",
    201,
  );
});

export const listForCook = wrap(async (req, res) => {
  ok(
    res,
    await svc.listForCook(req.params.cookId, req.query),
    "Reviews fetched",
  );
});

export const toggleLike = wrap(async (req, res) => {
  ok(res, await svc.toggleLike(req.user.id, req.params.id), "Like toggled");
});
