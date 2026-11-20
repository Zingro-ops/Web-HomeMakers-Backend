import { z } from "zod";
import mongoose from "mongoose";
import * as svc from "../services/coupon.service.js";
import { ok, fail } from "../utils/apiResponse.js";
import { auditAdminAction } from "../middlewares/admin.js";

const objectId = z
  .string()
  .refine((v) => mongoose.Types.ObjectId.isValid(v) && /^[a-f\d]{24}$/i.test(v), {
    message: "Invalid id",
  });

// `.strict()` rejects unknown keys, so fields like `usedCount` cannot be set
// through the API (mass-assignment protection).
const fields = {
  code: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9_-]{3,32}$/, "Code must be 3-32 letters, digits, _ or -"),
  type: z.enum(["flat", "percentage"]),
  value: z.number().positive(),
  maxDiscount: z.number().positive().optional(),
  minOrderValue: z.number().min(0).optional(),
  cookId: objectId.nullable().optional(),
  usageLimit: z.number().int().positive().nullable().optional(),
  usageLimitPerUser: z.number().int().positive().optional(),
  startsAt: z.string().datetime().optional(),
  expiresAt: z.string().datetime(),
  isActive: z.boolean().optional(),
};

const percentageCap = (d) =>
  d.type !== "percentage" || d.value === undefined || d.value <= 100;
const datesOrdered = (d) =>
  !d.startsAt || !d.expiresAt || new Date(d.startsAt) < new Date(d.expiresAt);

const createSchema = z
  .object(fields)
  .strict()
  .refine(percentageCap, { message: "Percentage cannot exceed 100" })
  .refine(datesOrdered, { message: "startsAt must be before expiresAt" });

const updateSchema = z
  .object(fields)
  .partial()
  .strict()
  .refine((d) => Object.keys(d).length > 0, { message: "No fields to update" })
  .refine(percentageCap, { message: "Percentage cannot exceed 100" })
  .refine(datesOrdered, { message: "startsAt must be before expiresAt" });

const validateSchema = z.object({
  code: z.string().min(3),
  cookId: z.string().optional(),
  orderValue: z.number().positive(),
});

const listSchema = z.object({
  cookId: objectId.optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

const wrap = (fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (e) {
    if (e instanceof z.ZodError)
      return fail(res, "Validation failed", 400, "VALIDATION");
    if (e?.name === "CastError")
      return fail(res, "Invalid id", 400, "INVALID_ID");
    fail(res, e.message || "Server error", e.status || 500, e.code);
  }
};

const parseId = (req) => objectId.parse(req.params.id);

export const list = wrap(async (req, res) => {
  const q = listSchema.parse(req.query);
  ok(res, await svc.list(q), "Coupons fetched");
});

export const validate = wrap(async (req, res) => {
  const dto = validateSchema.parse(req.body);
  const { coupon, discount } = await svc.validate({
    ...dto,
    userId: req.user.id,
  });
  ok(res, { code: coupon.code, type: coupon.type, discount }, "Coupon valid");
});

export const create = wrap(async (req, res) => {
  const dto = createSchema.parse(req.body);
  const coupon = await svc.create(dto);
  auditAdminAction(req, "coupon.create", coupon._id);
  ok(res, coupon, "Coupon created", 201);
});

export const update = wrap(async (req, res) => {
  const id = parseId(req);
  const dto = updateSchema.parse(req.body);
  const coupon = await svc.update(id, dto);
  auditAdminAction(req, "coupon.update", id);
  ok(res, coupon, "Coupon updated");
});

export const remove = wrap(async (req, res) => {
  const id = parseId(req);
  const coupon = await svc.remove(id);
  auditAdminAction(req, "coupon.deactivate", id);
  ok(res, coupon, "Coupon deactivated");
});
