import { Router } from "express";
import { requireAuth } from "../middlewares/auth.js";
import { paymentRequiredGone } from "../middlewares/gone.js";
import * as ctrl from "../controllers/cart.controller.js";

const router = Router();
router.use(requireAuth);

router.get("/", ctrl.get);
router.post("/items", ctrl.addItem);
router.patch("/items/:dishId", ctrl.updateItem);
router.delete("/items/:dishId", ctrl.removeItem);
router.delete("/", ctrl.clear);

// REMOVED: `POST /api/cart/checkout` turned the cart into an order with NO
// payment. Checkout now goes through `POST /api/v1/checkout/preview` then
// `POST /api/v1/payment/create-order` + `/verify`.
router.post("/checkout", paymentRequiredGone);

export default router;
