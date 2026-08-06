import { Router } from "express";
import { requireAuth } from "../middlewares/auth.js";
import * as c from "../controllers/payment.controller.js";

const router = Router();
router.use(requireAuth);
router.post("/create-order", c.createOrder);
router.post("/verify", c.verify);

export default router;
