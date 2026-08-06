import { Router } from "express";
import { requireAuth } from "../middlewares/auth.js";
import * as c from "../controllers/support.controller.js";

const router = Router();

router.get("/faqs", c.faqs); // public — no auth needed for FAQs

router.use(requireAuth);
router.post("/tickets", c.createTicket);
router.get("/tickets", c.listTickets);
router.get("/tickets/:id", c.getTicket);
router.post("/tickets/:id/respond", c.addResponse);

export default router;
