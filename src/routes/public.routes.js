import { Router } from "express";
import * as ctrl from "../controllers/public.controller.js";

const router = Router();
router.get("/cooks", ctrl.listCooks);
router.get("/cooks/:id/menu", ctrl.getCookMenu);
router.get("/dishes/:id", ctrl.getDish);
router.get("/cuisines", ctrl.listCuisines);

export default router;

