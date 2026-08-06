import { z } from "zod";
import * as svc from "../services/coupon.service.js";
import { ok, fail } from "../utils/apiResponse.js";

const baseSchema = z.object({
  code: z.string().min(3),
  type: z.enum(["flat", "percentage"]),
  value: z.number().positive(),
  maxDiscount: z.number().positive().optional(),
  minOrderValue: z.number().min(0).optional(),
  cookId: z.string().nullable().optional(),
  usageLimit: z.number().positive().nullable().optional(),
  usageLimitPerUser: z.number().positive().optional(),
  startsAt: z.string().datetime().optional(),
  expiresAt: z.string().datetime(),
  isActive: z.boolean().optional(),
});

const validateSchema = z.object({
  code: z.string().min(3),
  cookId: z.string().optional(),
  orderValue: z.number().positive(),
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

export const list = wrap(async (req, res) => {
  const { cookId, page, limit } = req.query;
  ok(res, await svc.list({ cookId, page, limit }), "Coupons fetched");
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
  const dto = baseSchema.parse(req.body);
  ok(res, await svc.create(dto), "Coupon created", 201);
});

export const update = wrap(async (req, res) => {
  const dto = baseSchema.partial().parse(req.body);
  ok(res, await svc.update(req.params.id, dto), "Coupon updated");
});

export const remove = wrap(async (req, res) => {
  ok(res, await svc.remove(req.params.id), "Coupon deactivated");
});
