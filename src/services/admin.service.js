import { Cook } from "../models/Cook.js";
import { presignGet } from "./s3.service.js";
import { decideKyc } from "./kyc.service.js";

const LIST_FIELDS =
  "phone email status currentStep personal.name food.cuisine kyc.name_match_score kyc.decision aadhaar.status createdAt updatedAt";
// Added aadhaar.status to the list projection so the cooks list can show
// Aadhaar state per row too, not just on the detail screen.

export async function listCooks({ status, page, limit }) {
  const filter = status ? { status } : {};
  const [items, total] = await Promise.all([
    Cook.find(filter)
      .select(LIST_FIELDS)
      .sort({ updatedAt: -1 })
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

  // Presign photo URLs for review (private bucket).
  const photos = {};
  if (cook.photos?.kitchen_s3_key)
    photos.kitchen = await presignGet(cook.photos.kitchen_s3_key);
  if (cook.photos?.profile_s3_key)
    photos.profile = await presignGet(cook.photos.profile_s3_key);

  // Computed verdict — same threshold/logic the system actually uses to
  // decide approval, so the admin sees the real automated decision instead
  // of eyeballing raw fields and guessing.
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
  return { id: cook._id, status: cook.status, decision };
}
