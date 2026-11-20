import { Router } from "express";
import { requireAuth } from "../middlewares/auth.js";
import { requireAdmin } from "../middlewares/admin.js";
import * as c from "../controllers/coupon.controller.js";

const router = Router();

// Customer-facing reads — any authenticated user.
router.use(requireAuth);
router.get("/", c.list);
router.post("/validate", c.validate);

// Admin-only writes, enforced server-side. requireAdmin reads the role from the
// verified JWT only. These previously had NO role check: any logged-in customer
// could mint, edit or deactivate coupons.
router.post("/", requireAdmin, c.create);
router.patch("/:id", requireAdmin, c.update);
router.delete("/:id", requireAdmin, c.remove);

export default router;
