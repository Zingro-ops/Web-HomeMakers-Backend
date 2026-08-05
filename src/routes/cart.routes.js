import { Router } from "express";
import { requireAuth } from "../middlewares/auth.js";
import * as ctrl from "../controllers/cart.controller.js";

const router = Router();
router.use(requireAuth);

router.get("/", ctrl.get);
router.post("/items", ctrl.addItem);
router.patch("/items/:dishId", ctrl.updateItem);
router.delete("/items/:dishId", ctrl.removeItem);
router.delete("/", ctrl.clear);
router.post("/checkout", ctrl.checkout);

export default router;
