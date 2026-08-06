import { z } from "zod";
import * as svc from "../services/address.service.js";
import { ok, fail } from "../utils/apiResponse.js";

const baseSchema = z.object({
  type: z.enum(["home", "work", "other"]).optional(),
  label: z.string().max(40).optional(),
  line1: z.string().min(1),
  line2: z.string().optional(),
  landmark: z.string().optional(),
  city: z.string().min(1),
  state: z.string().min(1),
  pincode: z.string().regex(/^\d{6}$/),
  contactName: z.string().optional(),
  contactPhone: z.string().regex(/^[6-9]\d{9}$/).optional(),
  placeId: z.string().optional(),
  isDefault: z.boolean().optional(),
});

const wrap = (fn) => async (req, res) => {
  try { await fn(req, res); }
  catch (e) {
    if (e instanceof z.ZodError) return fail(res, "Validation failed", 400, "VALIDATION");
    fail(res, e.message || "Server error", e.status || 500);
  }
};

export const list = wrap(async (req, res) =>
  ok(res, await svc.list(req.user.id), "Addresses fetched"));

export const create = wrap(async (req, res) => {
  const dto = baseSchema.parse(req.body);
  ok(res, await svc.create(req.user.id, dto), "Address created", 201);
});

export const update = wrap(async (req, res) => {
  const dto = baseSchema.partial().parse(req.body);
  ok(res, await svc.update(req.user.id, req.params.id, dto), "Address updated");
});

export const remove = wrap(async (req, res) => {
  await svc.remove(req.user.id, req.params.id);
  ok(res, null, "Address deleted");
});

export const setDefault = wrap(async (req, res) =>
  ok(res, await svc.setDefault(req.user.id, req.params.id), "Default address set"));
