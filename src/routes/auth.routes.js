import { Router } from "express";
import rateLimit from "express-rate-limit";
import { requireAuth } from "../middlewares/auth.js";
import * as ctrl from "../controllers/auth.controller.js";

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 50 });

const router = Router();
router.post("/register", limiter, ctrl.register);
router.post("/otp/verify", requireAuth, ctrl.verifyOtp);
router.post("/login", limiter, ctrl.login);
router.post("/logout", ctrl.logout);
router.get("/me", requireAuth, ctrl.me);

export default router;
