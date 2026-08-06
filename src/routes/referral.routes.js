import { Router } from "express";
import { requireAuth } from "../middlewares/auth.js";
import * as c from "../controllers/referral.controller.js";

const router = Router();
router.use(requireAuth);
router.get("/my-code", c.getMyCode);
router.post("/apply", c.applyCode);
router.get("/history", c.history);

export default router;
