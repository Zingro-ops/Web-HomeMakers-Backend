import { nearbyCooksSchema } from "../validators/public.schema.js";
import * as svc from "../services/public.service.js";

export async function listCooks(req, res, next) {
  try {
    const q = nearbyCooksSchema.parse(req.query);
    res.json(await svc.listCooks(q));
  } catch (e) {
    next(e);
  }
}

export async function getCookMenu(req, res, next) {
  try {
    res.json(await svc.getCookMenu(req.params.id));
  } catch (e) {
    next(e);
  }
}

export async function listCuisines(req, res, next) {
  try {
    res.json(await svc.listCuisines());
  } catch (e) {
    next(e);
  }
}

export async function getDish(req, res, next) {
  try {
    res.json(await svc.getDishById(req.params.id));
  } catch (e) {
    next(e);
  }
}
