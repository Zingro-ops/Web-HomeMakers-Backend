import { Cook } from "../models/Cook.js";
import { STEP_ORDER } from "../validators/onboarding.schema.js";
import { maskPan, maskTail, maskFssai } from "../utils/mask.js";

// Map a validated step payload to Cook field updates.
// Sensitive values are masked; raw PAN/account/license are NOT stored.
function mapStep(step, data) {
  switch (step) {
    case "personal":
      return {
        "personal.name": data.name,
        "personal.gender": data.gender,
        email: data.email,
      };
    case "address":
      return {
        "address.building": data.building,
        "address.locality": data.locality,
        "address.pincode": data.pincode,
      };
    case "tax":
      return { "tax.masked": maskPan(data.pan), "tax.gst": data.gst || "" };
    case "bank":
      return {
        "bank.masked": maskTail(data.account),
        "bank.ifsc": data.ifsc,
        "bank.holder_name": data.holder,
      };
    case "fssai":
      return { "fssai.license_masked": maskFssai(data.license) };
    case "food":
      return {
        "food.cuisine": data.cuisine,
        "food.category": data.category,
        "food.radius": data.radius,
        "food.description": data.description,
      };
    case "photos":
      return {
        "photos.gps.lat": data.gps.lat,
        "photos.gps.lng": data.gps.lng,
        // s3 keys are set by the uploads flow; names are transient hints
      };
    default:
      return {};
  }
}

export async function saveDraft(cookId, step, data) {
  const cook = await Cook.findById(cookId);
  if (!cook) throw Object.assign(new Error("Cook not found"), { status: 404 });
  if (["approved", "verification_pending"].includes(cook.status)) {
    throw Object.assign(new Error("Onboarding locked"), { status: 409 });
  }

  const update = mapStep(step, data);
  const stepIndex = STEP_ORDER.indexOf(step) + 1; // 1-based
  const nextStep = Math.max(cook.currentStep, stepIndex + 1);

  await Cook.updateOne(
    { _id: cookId },
    {
      $set: { ...update, currentStep: Math.min(nextStep, 8), status: "draft" },
    },
  );

  return { savedStep: step, currentStep: Math.min(nextStep, 8) };
}

export async function getStatus(cookId) {
  const cook = await Cook.findById(cookId).select(
    "status currentStep tax.verified bank.penny_drop_ok fssai.active tax.gst_verified kyc.decision",
  );
  if (!cook) throw Object.assign(new Error("Cook not found"), { status: 404 });
  return {
    status: cook.status,
    currentStep: cook.currentStep,
    verdicts: {
      pan: cook.tax?.verified ?? null,
      bank: cook.bank?.penny_drop_ok ?? null,
      fssai: cook.fssai?.active ?? null,
      gst: cook.tax?.gst_verified ?? null,
    },
    kycDecision: cook.kyc?.decision ?? null,
  };
}
