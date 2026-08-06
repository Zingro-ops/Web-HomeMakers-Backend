import { Subscription } from "../models/Subscription.js";
import { isDueOn } from "../utils/subscriptionSchedule.js";

export async function create(customerId, dto) {
  return Subscription.create({ ...dto, customerId });
}

export async function list(customerId) {
  return Subscription.find({ customerId }).sort({ createdAt: -1 });
}

async function findOwned(customerId, id) {
  const sub = await Subscription.findOne({ _id: id, customerId });
  if (!sub)
    throw Object.assign(new Error("Subscription not found"), { status: 404 });
  return sub;
}

export async function getById(customerId, id) {
  return findOwned(customerId, id);
}

export async function update(customerId, id, dto) {
  const sub = await findOwned(customerId, id);
  Object.assign(sub, dto);
  return sub.save();
}

export async function pause(customerId, id) {
  const sub = await findOwned(customerId, id);
  if (sub.status === "cancelled")
    throw Object.assign(new Error("Cannot pause a cancelled subscription"), {
      status: 409,
      code: "SUB_CANCELLED",
    });
  sub.status = "paused";
  return sub.save();
}

export async function resume(customerId, id) {
  const sub = await findOwned(customerId, id);
  if (sub.status === "cancelled")
    throw Object.assign(new Error("Cannot resume a cancelled subscription"), {
      status: 409,
      code: "SUB_CANCELLED",
    });
  sub.status = "active";
  return sub.save();
}

export async function skip(customerId, id, date) {
  const sub = await findOwned(customerId, id);
  sub.skippedDates.push(new Date(date));
  return sub.save();
}

export async function vacation(customerId, id, from, to) {
  const sub = await findOwned(customerId, id);
  sub.vacationRanges.push({ from: new Date(from), to: new Date(to) });
  return sub.save();
}

export async function renew(customerId, id, newEndDate) {
  const sub = await findOwned(customerId, id);
  if (sub.status === "cancelled")
    throw Object.assign(new Error("Cannot renew a cancelled subscription"), {
      status: 409,
      code: "SUB_CANCELLED",
    });
  sub.endDate = new Date(newEndDate);
  return sub.save();
}

export async function cancel(customerId, id) {
  const sub = await findOwned(customerId, id);
  sub.status = "cancelled";
  return sub.save();
}

export async function dueToday(customerId) {
  const subs = await Subscription.find({ customerId, status: "active" });
  const today = new Date();
  return subs.filter((s) => isDueOn(s, today));
}
