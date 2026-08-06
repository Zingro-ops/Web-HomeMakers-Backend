import { Router } from "express";
import { requireAuth } from "../middlewares/auth.js";
import { getHome } from "../controllers/home.controller.js";

const router = Router();
router.use(requireAuth);
router.get("/", getHome);

export default router;
