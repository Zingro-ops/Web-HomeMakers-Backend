import { Router } from "express";
import { requireAuth } from "../middlewares/auth.js";
import { verifyCourierSignature } from "../middlewares/courierSignature.js";
import {
  courierWebhook,
  getTracking,
} from "../controllers/deliveryTracking.controller.js";

const router = Router();

// Courier → Zingro status webhook. No user JWT; authenticated instead by an
// HMAC signature over the raw body + timestamp (see courierSignature.js).
// Previously this route had NO authentication: anyone could mark any order
// delivered and inject a "delivery partner" name/phone shown to customers.
router.post("/webhook", verifyCourierSignature, courierWebhook);

// Customer-facing tracking read
router.get("/:id", requireAuth, getTracking);

export default router;
