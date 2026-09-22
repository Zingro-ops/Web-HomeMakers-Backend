import { Cook } from "../models/Cook.js";
import { presignGet } from "./s3.service.js";
import { decideKyc } from "./kyc.service.js";
import { sendApprovalEmail, sendReminderEmail } from "./mail.service.js";

const LIST_FIELDS =
  "phone email status currentStep personal.name food.cuisine kyc.name_match_score kyc.decision aadhaar.status createdAt updatedAt reminderCount";

export async function listCooks({ status, page, limit }) {
  const filter = status ? { status } : {};
  const [items, total] = await Promise.all([
    Cook.find(filter)
      .select(LIST_FIELDS)
      .sort({ currentStep: -1, updatedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Cook.countDocuments(filter),
  ]);
  return { items, total, page, limit, pages: Math.ceil(total / limit) };
}

export async function getCookDetail(id) {
  const cook = await Cook.findById(id).select("-passwordHash -otp").lean();
  if (!cook) throw Object.assign(new Error("Cook not found"), { status: 404 });

  const photos = {};
  if (cook.photos?.kitchen_s3_key)
    photos.kitchen = await presignGet(cook.photos.kitchen_s3_key);
  if (cook.photos?.profile_s3_key)
    photos.profile = await presignGet(cook.photos.profile_s3_key);

  const kycVerdict = decideKyc(cook);

  return { ...cook, photoUrls: photos, kycVerdict };
}

export async function decideCook(id, adminId, { decision, note }) {
  const cook = await Cook.findById(id);
  if (!cook) throw Object.assign(new Error("Cook not found"), { status: 404 });
  if (cook.status !== "manual_review")
    throw Object.assign(new Error("Cook is not in manual_review"), {
      status: 409,
    });

  cook.status = decision;
  cook.kyc = {
    ...cook.kyc,
    decision,
    decided_at: new Date(),
    decided_by: adminId,
    note,
  };
  await cook.save();

  if (decision === "approved") {
    sendApprovalEmail(cook).catch((e) =>
      console.error("Unexpected error sending approval email:", e),
    );
  }

  return { id: cook._id, status: cook.status, decision };
}

export async function sendCookReminder(id) {
  const cook = await Cook.findById(id).lean();
  if (!cook) throw Object.assign(new Error("Cook not found"), { status: 404 });
  if (cook.status !== "draft")
    throw Object.assign(
      new Error("Reminder only applies to cooks still in draft"),
      { status: 409 },
    );

  const result = await sendReminderEmail(cook);
  if (!result.sent) {
    throw Object.assign(
      new Error(`Could not send reminder: ${result.reason}`),
      { status: 502 },
    );
  }

  const updated = await Cook.findByIdAndUpdate(
    id,
    {
      $inc: { reminderCount: 1 },
      $set: { lastReminderAt: new Date() },
    },
    { new: true },
  ).lean();

  return { id: cook._id, sent: true, reminderCount: updated.reminderCount };
}
