import { Router } from "express";
import { requireAuth } from "../middlewares/auth.js";
import { requireCook } from "../middlewares/cook.js";
import {
  createRequest,
  webhook,
  confirm,
} from "../controllers/aadhaar.controller.js";

const router = Router();

router.post("/webhook", webhook); // public — Digio calls this, no user JWT
router.post("/create-request", requireAuth, requireCook, createRequest);
router.post(
  "/confirm",
  requireAuth,
  requireCook,
  createRequest === createRequest ? confirm : confirm,
);
export default router;
