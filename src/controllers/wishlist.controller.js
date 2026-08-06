import { z } from "zod";
import * as svc from "../services/wishlist.service.js";
import { ok, fail } from "../utils/apiResponse.js";

const addSchema = z.object({ dishId: z.string() });

const wrap = (fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (e) {
    if (e instanceof z.ZodError)
      return fail(res, "Validation failed", 400, "VALIDATION");
    fail(res, e.message || "Server error", e.status || 500, e.code);
  }
};

export const add = wrap(async (req, res) => {
  const { dishId } = addSchema.parse(req.body);
  ok(res, await svc.add(req.user.id, dishId), "Added to wishlist", 201);
});

export const list = wrap(async (req, res) =>
  ok(res, await svc.list(req.user.id), "Wishlist fetched"),
);

export const remove = wrap(async (req, res) =>
  ok(
    res,
    await svc.remove(req.user.id, req.params.dishId),
    "Removed from wishlist",
  ),
);
