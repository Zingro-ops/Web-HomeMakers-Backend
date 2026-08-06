import { Router } from "express";
import { requireAuth } from "../middlewares/auth.js";
import { preview } from "../controllers/checkout.controller.js";

const router = Router();
router.use(requireAuth);
router.post("/preview", preview);

export default router;
