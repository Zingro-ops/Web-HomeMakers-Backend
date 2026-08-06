import { Router } from "express";
import { requireAuth } from "../middlewares/auth.js";
import * as c from "../controllers/category.controller.js";

const router = Router();

router.get("/", c.list); // public — no auth, matches spec's public listing pattern

// admin-only writes — swap requireAuth for a role-checking middleware if you have one
router.post("/", requireAuth, c.create);
router.patch("/:id", requireAuth, c.update);
router.delete("/:id", requireAuth, c.remove);

export default router;
