import { draftSchema, stepSchemas } from "../validators/onboarding.schema.js";
import * as svc from "../services/onboarding.service.js";
import { submitSchema } from "../validators/onboarding.schema.js";
import { submitOnboarding } from "../services/submit.service.js";

export async function saveDraft(req, res, next) {
  try {
    const { step, data } = draftSchema.parse(req.body);
    const parsed = stepSchemas[step].parse(data); // re-validate per-step server-side
    const result = await svc.saveDraft(req.cookId, step, parsed);
    res.json(result);
  } catch (e) {
    next(e);
  }
}

export async function status(req, res, next) {
  try {
    res.json(await svc.getStatus(req.cookId));
  } catch (e) {
    next(e);
  }
}

export async function submit(req, res, next) {
  try {
    submitSchema.parse(req.body);
    const ip =
      req.headers["x-forwarded-for"]?.split(",")[0] || req.socket.remoteAddress;
    const result = await submitOnboarding(req.cookId, { ip });
    res.json(result);
  } catch (e) {
    next(e);
  }
}
