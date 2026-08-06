import { z } from "zod";
import * as svc from "../services/referral.service.js";
import { ok, fail } from "../utils/apiResponse.js";

const applySchema = z.object({ code: z.string().min(3) });

const wrap = (fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (e) {
    if (e instanceof z.ZodError)
      return fail(res, "Validation failed", 400, "VALIDATION");
    fail(res, e.message || "Server error", e.status || 500, e.code);
  }
};

export const getMyCode = wrap(async (req, res) =>
  ok(res, await svc.getMyCode(req.user.id), "Referral code fetched"),
);

export const applyCode = wrap(async (req, res) => {
  const { code } = applySchema.parse(req.body);
  ok(res, await svc.applyCode(req.user.id, code), "Referral applied", 201);
});

export const history = wrap(async (req, res) =>
  ok(res, await svc.history(req.user.id), "Referral history fetched"),
);
