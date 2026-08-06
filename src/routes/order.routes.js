import { Router } from "express";
import { requireAuth } from "../middlewares/auth.js";
import * as ctrl from "../controllers/order.controller.js";

const router = Router();
router.use(requireAuth);
router.post("/", ctrl.create);
router.get("/mine", ctrl.mine);
router.get("/:id", ctrl.getOne);
router.post("/:id/cancel", ctrl.cancel);
router.post("/:id/reorder", ctrl.reorder);

export default router;


