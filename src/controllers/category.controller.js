import { z } from "zod";
import mongoose from "mongoose";
import * as svc from "../services/category.service.js";
import { ok, fail } from "../utils/apiResponse.js";
import { auditAdminAction } from "../middlewares/admin.js";

const mealTypes = [
  "breakfast",
  "lunch",
  "dinner",
  "snacks",
  "desserts",
  "beverages",
];

const objectId = z
  .string()
  .refine((v) => mongoose.Types.ObjectId.isValid(v) && /^[a-f\d]{24}$/i.test(v), {
    message: "Invalid id",
  });

const fields = {
  name: z.string().trim().min(1).max(60),
  // Kept as a free string (URL or S3 key) for compatibility with existing data
  // and admin tooling; only length-bounded.
  image: z.string().max(2048).optional(),
  mealType: z.enum(mealTypes),
  displayOrder: z.number().int().min(0).max(10_000).optional(),
  isActive: z.boolean().optional(),
};

// `.strict()` rejects unknown keys (mass-assignment protection).
const createSchema = z.object(fields).strict();
const updateSchema = z
  .object(fields)
  .partial()
  .strict()
  .refine((d) => Object.keys(d).length > 0, { message: "No fields to update" });

const wrap = (fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (e) {
    if (e instanceof z.ZodError)
      return fail(res, "Validation failed", 400, "VALIDATION");
    if (e?.name === "CastError")
      return fail(res, "Invalid id", 400, "INVALID_ID");
    fail(res, e.message || "Server error", e.status || 500);
  }
};

const parseId = (req) => objectId.parse(req.params.id);

// Public — customer-facing
export const list = wrap(async (req, res) => {
  const { mealType, page, limit } = req.query;
  const result = await svc.list({ mealType, page, limit });
  ok(res, result, "Categories fetched");
});

// Admin-only — routes mount these behind requireAuth + requireAdmin.
export const create = wrap(async (req, res) => {
  const dto = createSchema.parse(req.body);
  const category = await svc.create(dto);
  auditAdminAction(req, "category.create", category?._id);
  ok(res, category, "Category created", 201);
});

export const update = wrap(async (req, res) => {
  const id = parseId(req);
  const dto = updateSchema.parse(req.body);
  const category = await svc.update(id, dto);
  auditAdminAction(req, "category.update", id);
  ok(res, category, "Category updated");
});

export const remove = wrap(async (req, res) => {
  const id = parseId(req);
  const category = await svc.remove(id);
  auditAdminAction(req, "category.deactivate", id);
  ok(res, category, "Category deactivated");
});
