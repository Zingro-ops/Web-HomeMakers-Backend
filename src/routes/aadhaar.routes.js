import { Router } from "express";
import { requireAuth } from "../middlewares/auth.js";
import { requireCook } from "../middlewares/cook.js";
import { createRequest, webhook } from "../controllers/aadhaar.controller.js";

const router = Router();

router.post("/webhook", webhook); // public — Digio calls this, no user JWT
router.post("/create-request", requireAuth, requireCook, createRequest);

export default router;
