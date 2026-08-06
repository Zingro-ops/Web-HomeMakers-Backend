import { z } from "zod";
import * as svc from "../services/subscription.service.js";
import { ok, fail } from "../utils/apiResponse.js";

const createSchema = z.object({
  cookId: z.string(),
  frequency: z.enum(["daily", "weekly", "monthly", "custom"]),
  daysOfWeek: z.array(z.number().min(0).max(6)).optional(),
  dayOfMonth: z.number().min(1).max(28).optional(),
  dishes: z
    .array(z.object({ dishId: z.string(), qty: z.number().min(1) }))
    .min(1),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
});

const updateSchema = createSchema.partial();
const skipSchema = z.object({ date: z.string().datetime() });
const vacationSchema = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
});
const renewSchema = z.object({ newEndDate: z.string().datetime() });

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
  ok(res, await svc.create(req.user.id, dto), "Subscription created", 201);
});

export const list = wrap(async (req, res) =>
  ok(res, await svc.list(req.user.id), "Subscriptions fetched"),
);
export const getOne = wrap(async (req, res) =>
  ok(
    res,
    await svc.getById(req.user.id, req.params.id),
    "Subscription fetched",
  ),
);

export const update = wrap(async (req, res) => {
  const dto = updateSchema.parse(req.body);
  ok(
    res,
    await svc.update(req.user.id, req.params.id, dto),
    "Subscription updated",
  );
});

export const pause = wrap(async (req, res) =>
  ok(res, await svc.pause(req.user.id, req.params.id), "Subscription paused"),
);
export const resume = wrap(async (req, res) =>
  ok(res, await svc.resume(req.user.id, req.params.id), "Subscription resumed"),
);
export const cancel = wrap(async (req, res) =>
  ok(
    res,
    await svc.cancel(req.user.id, req.params.id),
    "Subscription cancelled",
  ),
);

export const skip = wrap(async (req, res) => {
  const { date } = skipSchema.parse(req.body);
  ok(res, await svc.skip(req.user.id, req.params.id, date), "Date skipped");
});

export const vacation = wrap(async (req, res) => {
  const { from, to } = vacationSchema.parse(req.body);
  ok(
    res,
    await svc.vacation(req.user.id, req.params.id, from, to),
    "Vacation added",
  );
});

export const renew = wrap(async (req, res) => {
  const { newEndDate } = renewSchema.parse(req.body);
  ok(
    res,
    await svc.renew(req.user.id, req.params.id, newEndDate),
    "Subscription renewed",
  );
});

export const dueToday = wrap(async (req, res) =>
  ok(res, await svc.dueToday(req.user.id), "Due-today subscriptions fetched"),
);
