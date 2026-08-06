import { Router } from "express";
import { requireAuth } from "../middlewares/auth.js";
import * as c from "../controllers/review.controller.js";

const router = Router();

router.get("/cook/:cookId", c.listForCook); // public — no auth, matches Categories' pattern

router.use(requireAuth);
router.post("/order/:orderId", c.create);
router.post("/:id/like", c.toggleLike);

export default router;
