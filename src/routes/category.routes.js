import { Router } from "express";
import { requireAuth } from "../middlewares/auth.js";
import { requireAdmin } from "../middlewares/admin.js";
import * as c from "../controllers/category.controller.js";

const router = Router();

router.get("/", c.list); // public — no auth, matches spec's public listing pattern

// Admin-only writes. Previously guarded by requireAuth alone, so any logged-in
// customer or homemaker could create, rename or deactivate categories.
router.post("/", requireAuth, requireAdmin, c.create);
router.patch("/:id", requireAuth, requireAdmin, c.update);
router.delete("/:id", requireAuth, requireAdmin, c.remove);

export default router;
