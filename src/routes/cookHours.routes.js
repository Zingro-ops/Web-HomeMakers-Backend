import { Router } from "express";
import { requireAuth } from "../middlewares/auth.js";
import { requireCook } from "../middlewares/cook.js";
import { getHours, updateHours } from "../controllers/hours.controller.js";

const router = Router();
router.use(requireAuth, requireCook);
router.get("/", getHours);
router.patch("/", updateHours);

export default router;
