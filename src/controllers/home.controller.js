import * as svc from "../services/homepage.service.js";
import { ok, fail } from "../utils/apiResponse.js";

export const getHome = async (req, res) => {
  try {
    ok(res, await svc.getHome(req.user.id, req.query), "Homepage data fetched");
  } catch (e) {
    fail(res, e.message || "Server error", e.status || 500);
  }
};
