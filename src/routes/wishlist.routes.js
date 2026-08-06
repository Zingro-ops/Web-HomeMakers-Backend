import { Router } from "express";
import { requireAuth } from "../middlewares/auth.js";
import * as c from "../controllers/wishlist.controller.js";

const router = Router();
router.use(requireAuth);
router.get("/", c.list);
router.post("/", c.add);
router.delete("/:dishId", c.remove);

export default router;
