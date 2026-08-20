import { Cook } from "../models/Cook.js";
import { KycService, decideKyc } from "./kyc.service.js";

export async function submitOnboarding(cookId, consent) {
  const cook = await Cook.findById(cookId);
  if (!cook) throw Object.assign(new Error("Cook not found"), { status: 404 });
  if (cook.status === "approved")
    throw Object.assign(new Error("Already approved"), { status: 409 });

  const requiredSteps = ["personal", "address", "tax", "bank", "fssai", "food"];
  for (const s of requiredSteps) {
    if (!cook[s] || Object.keys(cook[s].toObject?.() ?? cook[s]).length === 0)
      throw Object.assign(new Error(`Incomplete: ${s}`), { status: 400 });
  }

  cook.consent = {
    terms_accepted_at: new Date(),
    privacy_accepted_at: new Date(),
    ip: consent.ip,
  };
  cook.status = "verification_pending";
  await cook.save();

  runBatchKyc(cookId).catch((e) =>
    console.error("KYC batch failed", cookId, e),
  );

  return { status: "verification_pending" };
}

// PAN and Bank are already verified in real time at their onboarding steps.
// This only handles FSSAI (still mock, pending a real provider) and the
// final decision.
async function runBatchKyc(cookId) {
  const cook = await Cook.findById(cookId);
  if (!cook) return;

  if (cook.fssai?.active == null) {
    const v = await KycService.verifyFssai(cook.fssai.license_masked);
    cook.fssai.active = v.active;
    cook.fssai.registered_name = v.registered_name;
    cook.fssai.expiry = v.expiry;
    cook.fssai.ref_id = v.ref_id;
    cook.fssai.manual_review_required = v.manual_review_required;
  }

  const { decision, score } = decideKyc(cook);

  // `decision`/`score` are stored as a *recommendation* for the admin
  // reviewing this application (surfaced in AdminCookDetail's "Computed
  // verdict") — they must NEVER be allowed to set status to "approved"
  // on their own. Zingro carries liability for who's allowed to sell food
  // and receive payouts on the platform; that decision requires a human
  // to actually click Approve via decideCook(), regardless of how clean
  // the automated checks look. Every submission lands in manual_review.
  cook.kyc = {
    name_match_score: score,
    decision, // recommendation only — "approved" here does NOT set cook.status
    decided_at: new Date(),
    decided_by: "system",
  };
  cook.status = "manual_review";
  await cook.save();
}
