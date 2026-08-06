import { Router } from "express";
import { requireAuth } from "../middlewares/auth.js";
import { get, update } from "../controllers/customerProfile.controller.js";

const router = Router();
router.use(requireAuth);
router.get("/", get);
router.patch("/", update);

export default router;
