import { KycService } from "./kyc.service.js";

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
