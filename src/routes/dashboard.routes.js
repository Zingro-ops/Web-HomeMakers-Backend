import { Router } from "express";
import { requireAuth } from "../middlewares/auth.js";
import { requireCook } from "../middlewares/cook.js";
import { stats } from "../controllers/dashboard.controller.js";

const router = Router();
router.use(requireAuth, requireCook);
router.get("/stats", stats);

export default router;
