import { getDashboardStats } from "../services/dashboard.service.js";

export async function stats(req, res, next) {
  try {
    res.json(await getDashboardStats(req.cookId));
  } catch (e) {
    next(e);
  }
}
