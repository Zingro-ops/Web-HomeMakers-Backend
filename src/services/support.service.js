import { SupportTicket } from "../models/SupportTicket.js";
import { FAQS } from "../data/faqs.js";

export function listFaqs(category) {
  if (category) return FAQS.filter((f) => f.category === category);
  return FAQS;
}

export async function createTicket(customerId, dto) {
  return SupportTicket.create({ ...dto, customerId });
}

export async function listTickets(
  customerId,
  { status, page = 1, limit = 20 } = {},
) {
  const filter = { customerId, ...(status ? { status } : {}) };
  const skip = (Number(page) - 1) * Number(limit);
  const [items, total] = await Promise.all([
    SupportTicket.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit)),
    SupportTicket.countDocuments(filter),
  ]);
  return { items, total, page: Number(page), limit: Number(limit) };
}

export async function getTicket(customerId, id) {
  const ticket = await SupportTicket.findOne({ _id: id, customerId });
  if (!ticket)
    throw Object.assign(new Error("Ticket not found"), { status: 404 });
  return ticket;
}

export async function addResponse(customerId, id, message) {
  const ticket = await getTicket(customerId, id);
  if (ticket.status === "closed") {
    throw Object.assign(new Error("Cannot reply to a closed ticket"), {
      status: 409,
      code: "TICKET_CLOSED",
    });
  }
  ticket.responses.push({ message, respondedBy: "customer" });
  if (ticket.status === "resolved") ticket.status = "open"; // reopens if customer follows up
  return ticket.save();
}
