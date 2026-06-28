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

  // Fire batch KYC in background; respond immediately.
  runBatchKyc(cookId).catch((e) =>
    console.error("KYC batch failed", cookId, e),
  );

  return { status: "verification_pending" };
}

// Cached: only call provider when verdict not already stored.
async function runBatchKyc(cookId) {
  const cook = await Cook.findById(cookId);
  if (!cook) return;

  if (cook.tax?.verified == null) {
    const v = await KycService.verifyPan(cook.tax.masked);
    cook.tax.verified = v.verified;
    cook.tax.name_on_pan = v.name;
    cook.tax.ref_id = v.ref_id;
  }
  if (cook.bank?.penny_drop_ok == null) {
    const v = await KycService.verifyBank(cook.bank.masked, cook.bank.ifsc);
    cook.bank.penny_drop_ok = v.verified;
    cook.bank.holder_name = v.name || cook.bank.holder_name;
    cook.bank.ref_id = v.ref_id;
  }
  if (cook.fssai?.active == null) {
    const v = await KycService.verifyFssai(cook.fssai.license_masked);
    cook.fssai.active = v.active;
    cook.fssai.registered_name = v.registered_name;
    cook.fssai.expiry = v.expiry;
    cook.fssai.ref_id = v.ref_id;
  }
  if (cook.tax?.gst && cook.tax?.gst_verified == null) {
    const v = await KycService.verifyGst(cook.tax.gst);
    cook.tax.gst_verified = v.verified;
  }

  const { decision, score } = decideKyc({
    enteredName: cook.personal?.name,
    pan: { verified: cook.tax.verified, name: cook.tax.name_on_pan },
    bank: { verified: cook.bank.penny_drop_ok, name: cook.bank.holder_name },
    fssai: { active: cook.fssai.active },
  });

  cook.kyc = {
    name_match_score: score,
    decision,
    decided_at: new Date(),
    decided_by: "system",
  };
  cook.status = decision === "approved" ? "approved" : "manual_review";
  await cook.save();
}
