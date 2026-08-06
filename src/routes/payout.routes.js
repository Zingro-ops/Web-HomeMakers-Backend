import { Router } from "express";
import { requireAuth } from "../middlewares/auth.js";
import { requireCook } from "../middlewares/cook.js"; // your existing cook-provisioning middleware
import * as c from "../controllers/payout.controller.js";

const router = Router();
router.use(requireAuth, requireCook);
router.get("/settings", c.getSettings);
router.patch("/settings", c.upsertSettings);
router.get("/summary", c.summary);
router.get("/history", c.history);

export default router;
