import { Router } from "express";
import { requireAuth } from "../middlewares/auth.js";
import * as c from "../controllers/coupon.controller.js";

const router = Router();

router.use(requireAuth);
router.get("/", c.list);
router.post("/validate", c.validate);

// admin-only writes
router.post("/", c.create);
router.patch("/:id", c.update);
router.delete("/:id", c.remove);

export default router;
