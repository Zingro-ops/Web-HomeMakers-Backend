import { Router } from "express";
import { requireAuth } from "../middlewares/auth.js";
import {
  courierWebhook,
  getTracking,
} from "../controllers/deliveryTracking.controller.js";

const router = Router();

// Public — couriers hit this, no customer JWT (needs its own auth, see note below)
router.post("/webhook", courierWebhook);

// Customer-facing tracking read
router.get("/:id", requireAuth, getTracking);

export default router;
