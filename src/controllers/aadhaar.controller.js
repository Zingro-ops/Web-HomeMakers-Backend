import { KycService } from "../services/kyc.service.js";
import { Cook } from "../models/Cook.js";

export async function createRequest(req, res, next) {
  try {
    const cook = await Cook.findById(req.cookId);
    if (!cook) return res.status(404).json({ error: "Cook not found" });

    const identifier = cook.email || `${cook.phone}@zingro.in`; // Digio needs email or phone-as-identifier
    const result = await KycService.createAadhaarRequest(
      req.cookId,
      identifier,
      cook.personal?.name || "",
    );

    await Cook.updateOne(
      { _id: req.cookId },
      {
        $set: {
          "aadhaar.request_id": result.id,
          "aadhaar.status": "requested",
        },
      },
    );

    res.json({
      kycId: result.id,
      customerIdentifier: result.customer_identifier,
      accessToken: result.access_token,
    });
  } catch (e) {
    next(e);
  }
}

// Digio calls this when the user completes (or abandons) the Aadhaar flow.
export async function webhook(req, res) {
  try {
    const payload = req.body?.payload;
    const requestId = payload?.request_id || payload?.id;
    const status = payload?.status;

    if (requestId) {
      await Cook.updateOne(
        { "aadhaar.request_id": requestId },
        {
          $set: { "aadhaar.status": status, "aadhaar.updated_at": new Date() },
        },
      );
    }

    res.status(200).send("ok"); // Digio expects a fast 200, per their docs
  } catch (e) {
    console.error("Aadhaar webhook error:", e);
    res.status(200).send("ok"); // still ack, don't make Digio retry on our bug
  }
}

export async function confirm(req, res, next) {
  try {
    await Cook.updateOne(
      { _id: req.cookId },
      {
        $set: {
          "aadhaar.status": "verified",
          "aadhaar.verified_at": new Date(),
        },
      },
    );
    res.json({ status: "verified" });
  } catch (e) {
    next(e);
  }
}
