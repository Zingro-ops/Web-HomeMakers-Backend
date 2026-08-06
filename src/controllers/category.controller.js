import { z } from "zod";
import * as svc from "../services/category.service.js";
import { ok, fail } from "../utils/apiResponse.js";

const mealTypes = [
  "breakfast",
  "lunch",
  "dinner",
  "snacks",
  "desserts",
  "beverages",
];
const baseSchema = z.object({
  name: z.string().min(1),
  image: z.string().optional(),
  mealType: z.enum(mealTypes),
  displayOrder: z.number().optional(),
  isActive: z.boolean().optional(),
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

// Public — customer-facing
export const list = wrap(async (req, res) => {
  const { mealType, page, limit } = req.query;
  const result = await svc.list({ mealType, page, limit });
  ok(res, result, "Categories fetched");
});

// Admin-only — mount behind requireAuth + role check
export const create = wrap(async (req, res) => {
  const dto = baseSchema.parse(req.body);
  ok(res, await svc.create(dto), "Category created", 201);
});

export const update = wrap(async (req, res) => {
  const dto = baseSchema.partial().parse(req.body);
  ok(res, await svc.update(req.params.id, dto), "Category updated");
});

export const remove = wrap(async (req, res) => {
  ok(res, await svc.remove(req.params.id), "Category deactivated");
});
