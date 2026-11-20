import { Router } from "express";
import { requireAuth } from "../middlewares/auth.js";
import { paymentRequiredGone } from "../middlewares/gone.js";
import * as ctrl from "../controllers/order.controller.js";

const router = Router();
router.use(requireAuth);

// REMOVED: `POST /api/orders` created an order with NO payment and put it
// straight into the kitchen's queue. Orders are now created only through
// `POST /api/v1/payment/create-order` (server-priced, Razorpay-backed).
router.post("/", paymentRequiredGone);

router.get("/mine", ctrl.mine);
router.get("/:id", ctrl.getOne);
router.post("/:id/cancel", ctrl.cancel);
router.post("/:id/reorder", ctrl.reorder);

export default router;
