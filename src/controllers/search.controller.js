import * as svc from "../services/search.service.js";
import { ok, fail } from "../utils/apiResponse.js";

export const search = async (req, res) => {
  try {
    ok(res, await svc.search(req.query), "Search results");
  } catch (e) {
    fail(res, e.message || "Server error", e.status || 500);
  }
};
