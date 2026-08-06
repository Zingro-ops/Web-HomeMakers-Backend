import { z } from "zod";
import * as svc from "../services/support.service.js";
import { ok, fail } from "../utils/apiResponse.js";

const createSchema = z.object({
  subject: z.string().min(1).max(150),
  message: z.string().min(1).max(2000),
  category: z.enum(["order", "payment", "account", "other"]),
  orderId: z.string().optional(),
  priority: z.enum(["low", "medium", "high"]).optional(),
});

const responseSchema = z.object({ message: z.string().min(1).max(2000) });

const wrap = (fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (e) {
    if (e instanceof z.ZodError)
      return fail(res, "Validation failed", 400, "VALIDATION");
    fail(res, e.message || "Server error", e.status || 500, e.code);
  }
};

export const faqs = wrap(async (req, res) =>
  ok(res, svc.listFaqs(req.query.category), "FAQs fetched"),
);

export const createTicket = wrap(async (req, res) => {
  const dto = createSchema.parse(req.body);
  ok(res, await svc.createTicket(req.user.id, dto), "Ticket created", 201);
});

export const listTickets = wrap(async (req, res) =>
  ok(res, await svc.listTickets(req.user.id, req.query), "Tickets fetched"),
);
export const getTicket = wrap(async (req, res) =>
  ok(res, await svc.getTicket(req.user.id, req.params.id), "Ticket fetched"),
);

export const addResponse = wrap(async (req, res) => {
  const { message } = responseSchema.parse(req.body);
  ok(
    res,
    await svc.addResponse(req.user.id, req.params.id, message),
    "Response added",
  );
});
