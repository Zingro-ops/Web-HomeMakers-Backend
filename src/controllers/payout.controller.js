import { z } from "zod";
import * as svc from "../services/payout.service.js";
import { ok, fail } from "../utils/apiResponse.js";

const settingsSchema = z
  .object({
    payoutFrequency: z.enum(["daily", "weekly", "monthly"]),
    payoutDayOfWeek: z.number().min(0).max(6).optional(),
    payoutDayOfMonth: z.number().min(1).max(28).optional(),
  })
  .refine(
    (d) =>
      (d.payoutFrequency !== "weekly" || d.payoutDayOfWeek !== undefined) &&
      (d.payoutFrequency !== "monthly" || d.payoutDayOfMonth !== undefined),
    {
      message:
        "payoutDayOfWeek/payoutDayOfMonth required for the chosen frequency",
    },
  );

const wrap = (fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (e) {
    if (e instanceof z.ZodError)
      return fail(
        res,
        e.errors[0]?.message || "Validation failed",
        400,
        "VALIDATION",
      );
    fail(res, e.message || "Server error", e.status || 500, e.code);
  }
};

export const getSettings = wrap(async (req, res) =>
  ok(res, await svc.getSettings(req.cookId), "Payout settings fetched"),
);

export const upsertSettings = wrap(async (req, res) => {
  const dto = settingsSchema.parse(req.body);
  ok(res, await svc.upsertSettings(req.cookId, dto), "Payout settings saved");
});

export const summary = wrap(async (req, res) =>
  ok(res, await svc.summary(req.cookId), "Payout summary fetched"),
);

export const history = wrap(async (req, res) =>
  ok(res, await svc.history(req.cookId, req.query), "Payout history fetched"),
);
