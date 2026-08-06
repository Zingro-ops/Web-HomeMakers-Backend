import { Router } from "express";
import { requireAuth } from "../middlewares/auth.js";
import * as c from "../controllers/address.controller.js";

const router = Router();

router.use(requireAuth);
router.get("/", c.list);
router.post("/", c.create);
router.patch("/:id", c.update);
router.delete("/:id", c.remove);
router.patch("/:id/default", c.setDefault);

export default router;
