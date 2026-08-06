import { z } from "zod";
import * as svc from "../services/customerProfile.service.js";
import { ok, fail } from "../utils/apiResponse.js";

const schema = z.object({
  dietaryType: z.enum(["veg", "non-veg", "vegan", "eggetarian"]).optional(),
  allergies: z.array(z.string()).optional(),
});

const wrap = (fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (e) {
    if (e instanceof z.ZodError)
      return fail(res, "Validation failed", 400, "VALIDATION");
    fail(res, e.message || "Server error", e.status || 500);
  }
};

export const get = wrap(async (req, res) =>
  ok(res, await svc.get(req.user.id), "Preferences fetched"),
);

export const update = wrap(async (req, res) => {
  const dto = schema.parse(req.body);
  ok(res, await svc.upsert(req.user.id, dto), "Preferences updated");
});
