import { Router } from "express";
import { requireAuth } from "../middlewares/auth.js";
import * as ctrl from "../controllers/onboarding.controller.js";

const router = Router();
router.post("/draft", requireAuth, ctrl.saveDraft);
router.get("/status", requireAuth, ctrl.status);

router.post("/submit", requireAuth, ctrl.submit);

export default router;
