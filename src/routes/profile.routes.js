import { Router } from "express";
import { requireAuth } from "../middlewares/auth.js";
import { requireCook } from "../middlewares/cook.js";
import { me, updateCluster } from "../controllers/profile.controller.js";

const router = Router();
router.use(requireAuth, requireCook);
router.get("/me", me);
router.patch("/cluster-settings", updateCluster);

export default router;
