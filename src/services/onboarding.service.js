import { Cook } from "../models/Cook.js";
import { STEP_ORDER } from "../validators/onboarding.schema.js";
import { maskPan, maskTail, maskFssai } from "../utils/mask.js";
import { KycService } from "./kyc.service.js";

// Map a validated step payload to Cook field updates.
// Sensitive values are masked; raw PAN/account/license are NOT stored.
async function mapStep(step, data, cook) {
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
    case "tax": {
      const enteredName = cook.personal?.name || "";
      const result = await KycService.verifyPan(
        data.pan,
        enteredName,
        data.dob,
      );
      return {
        "tax.masked": maskPan(data.pan),
        "tax.dob": data.dob,
        "tax.gst": data.gst || "",
        "tax.verified": result.verified,
        "tax.name_matched": result.name_matched,
        "tax.dob_matched": result.dob_matched,
        "tax.category": result.category,
        "tax.status": result.status,
        "tax.remarks": result.remarks,
      };
    }
    case "bank": {
      const result = await KycService.verifyBank(
        data.account,
        data.ifsc,
        data.holder,
      );
      return {
        "bank.masked": maskTail(data.account),
        "bank.ifsc": data.ifsc,
        "bank.holder_name": data.holder,
        "bank.verified": result.verified,
        "bank.name_with_bank": result.name_with_bank,
        "bank.fuzzy_match_score": result.fuzzy_match_score,
        "bank.error_msg": result.error_msg,
      };
    }
    case "fssai": {
      const result = await KycService.verifyFssai(data.license);
      return {
        "fssai.license_masked": maskFssai(data.license),
        "fssai.active": result.active,
        "fssai.registered_name": result.registered_name,
        "fssai.expiry": result.expiry,
        "fssai.ref_id": result.ref_id,
        "fssai.manual_review_required": result.manual_review_required,
      };
    }
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
        location: { type: "Point", coordinates: [data.gps.lng, data.gps.lat] },
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

  const update = await mapStep(step, data, cook);
  const stepIndex = STEP_ORDER.indexOf(step) + 1;
  const nextStep = Math.max(cook.currentStep, stepIndex + 1);

  await Cook.updateOne(
    { _id: cookId },
    {
      $set: { ...update, currentStep: Math.min(nextStep, 8), status: "draft" },
    },
  );

  return {
    savedStep: step,
    currentStep: Math.min(nextStep, 8),
    verification: update["tax.verified"],
  };
}

export async function getStatus(cookId) {
  const cook = await Cook.findById(cookId).select(
    "status currentStep personal.name tax.verified bank.penny_drop_ok fssai.active tax.gst_verified kyc.decision",
  );
  if (!cook) throw Object.assign(new Error("Cook not found"), { status: 404 });
  return {
    status: cook.status,
    currentStep: cook.currentStep,
    name: cook.personal?.name || null,
    verdicts: {
      pan: cook.tax?.verified ?? null,
      bank: cook.bank?.penny_drop_ok ?? null,
      fssai: cook.fssai?.active ?? null,
      gst: cook.tax?.gst_verified ?? null,
    },
    kycDecision: cook.kyc?.decision ?? null,
  };
}
