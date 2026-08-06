import { razorpay } from "./razorpay.client.js";
import { PayoutSettings } from "../models/PayoutSettings.js";
import { PayoutLedger } from "../models/PayoutLedger.js";
import { Cook } from "../models/Cook.js";

function nextReleaseDate({
  payoutFrequency,
  payoutDayOfWeek,
  payoutDayOfMonth,
}) {
  const now = new Date();
  if (payoutFrequency === "daily") return now;

  if (payoutFrequency === "weekly") {
    const d = new Date(now);
    const diff = (payoutDayOfWeek - d.getDay() + 7) % 7 || 7;
    d.setDate(d.getDate() + diff);
    return d;
  }

  // monthly
  const d = new Date(now.getFullYear(), now.getMonth(), payoutDayOfMonth);
  if (d <= now) d.setMonth(d.getMonth() + 1);
  return d;
}

export async function getSettings(cookId) {
  return PayoutSettings.findOne({ cookId });
}

export async function upsertSettings(cookId, dto) {
  const settings = await PayoutSettings.findOneAndUpdate(
    { cookId },
    { $set: { cookId, ...dto } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  if (settings.linkedAccountStatus === "not_created") {
    await createLinkedAccount(settings);
  }
  return settings;
}

async function createLinkedAccount(settings) {
  const cook = await Cook.findById(settings.cookId);
  const account = await razorpay.accounts.create({
    email: cook.personal?.email,
    phone: cook.personal?.phone,
    type: "route",
    legal_business_name: cook.personal?.name,
    business_type: "individual",
    contact_name: cook.personal?.name,
    profile: {
      category: "food",
      subcategory: "restaurant",
      addresses: { registered: cook.address },
    },
  });
  settings.razorpayAccountId = account.id;
  settings.linkedAccountStatus = "pending";
  await settings.save();
}

export async function createPayoutForOrder(order) {
  const settings = await PayoutSettings.findOne({ cookId: order.cookId });
  if (!settings || settings.linkedAccountStatus !== "active") return; // no payout engine live yet for this cook

  const commissionDeducted =
    Math.round(((order.total * settings.commissionPercent) / 100) * 100) / 100;
  const netAmount = order.total - commissionDeducted;
  const releaseDate = nextReleaseDate(settings);
  const holdUntil =
    settings.payoutFrequency === "daily" ? undefined : releaseDate;

  const transfer = await razorpay.transfers.create({
    account: settings.razorpayAccountId,
    amount: Math.round(netAmount * 100),
    currency: "INR",
    on_hold: settings.payoutFrequency !== "daily",
    ...(holdUntil && { on_hold_until: Math.floor(holdUntil.getTime() / 1000) }),
  });

  await PayoutLedger.create({
    cookId: order.cookId,
    orderId: order._id,
    razorpayTransferId: transfer.id,
    grossAmount: order.total,
    commissionDeducted,
    netAmount,
    status: settings.payoutFrequency === "daily" ? "settled" : "held",
    scheduledReleaseDate: releaseDate,
  });
}

export async function releaseDuePayouts() {
  const due = await PayoutLedger.find({
    status: "held",
    scheduledReleaseDate: { $lte: new Date() },
  });
  for (const entry of due) {
    try {
      await razorpay.transfers.edit(entry.razorpayTransferId, {
        on_hold: false,
      });
      entry.status = "settled";
      entry.settledAt = new Date();
      await entry.save();
    } catch (e) {
      entry.status = "failed";
      await entry.save();
    }
  }
  return due.length;
}

export async function summary(cookId) {
  const pending = await PayoutLedger.aggregate([
    { $match: { cookId, status: "held" } },
    { $group: { _id: null, total: { $sum: "$netAmount" } } },
  ]);
  const settings = await PayoutSettings.findOne({ cookId });
  return {
    nextPayoutDate: settings ? nextReleaseDate(settings) : null,
    pendingAmount: pending[0]?.total || 0,
  };
}

export async function history(cookId, { page = 1, limit = 20 } = {}) {
  const skip = (Number(page) - 1) * Number(limit);
  const [items, total] = await Promise.all([
    PayoutLedger.find({ cookId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit)),
    PayoutLedger.countDocuments({ cookId }),
  ]);
  return { items, total, page: Number(page), limit: Number(limit) };
}
