import { Router } from "express";
import { requireAuth } from "../middlewares/auth.js";
import * as c from "../controllers/subscription.controller.js";

const router = Router();
router.use(requireAuth);

router.get("/due-today", c.dueToday);
router.get("/", c.list);
router.post("/", c.create);
router.get("/:id", c.getOne);
router.patch("/:id", c.update);
router.post("/:id/pause", c.pause);
router.post("/:id/resume", c.resume);
router.post("/:id/skip", c.skip);
router.post("/:id/vacation", c.vacation);
router.post("/:id/renew", c.renew);
router.post("/:id/cancel", c.cancel);

export default router;
