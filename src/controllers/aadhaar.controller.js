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
// This is the source of truth for verification status.
export async function webhook(req, res) {
  console.log("AADHAAR WEBHOOK RECEIVED:", JSON.stringify(req.body, null, 2));
  try {
    const payload = req.body?.payload;
    const requestId = payload?.request_id || payload?.id;
    const status = payload?.status;
    if (requestId) {
      const update = {
        "aadhaar.status": status,
        "aadhaar.updated_at": new Date(),
      };
      if (status === "verified") {
        update["aadhaar.verified_at"] = new Date();
      }
      await Cook.updateOne(
        { "aadhaar.request_id": requestId },
        { $set: update },
      );
    }
    res.status(200).send("ok"); // Digio expects a fast 200, per their docs
  } catch (e) {
    console.error("Aadhaar webhook error:", e);
    res.status(200).send("ok"); // still ack, don't make Digio retry on our bug
  }
}

// Called by the frontend right after the Digio widget's client-side
// callback fires. This is NOT proof of verification on its own — a client
// can call this endpoint directly without ever completing Aadhaar. The
// actual source of truth is `aadhaar.status`, which only the webhook (a
// server-to-server call from Digio) is allowed to set to "verified".
//
// So this endpoint now just reads back whatever the webhook has already
// recorded, rather than unconditionally overwriting it to "verified".
export async function confirm(req, res, next) {
  try {
    const cook = await Cook.findById(req.cookId).select("aadhaar").lean();
    if (!cook) return res.status(404).json({ error: "Cook not found" });

    const status = cook.aadhaar?.status;

    if (status === "verified") {
      return res.json({ status: "verified" });
    }

    // Webhook hasn't landed yet (common — client callback often fires
    // before the server-to-server webhook, especially locally). Don't
    // fabricate success; tell the frontend to poll or show a pending state.
    return res.json({
      status: status || "pending",
      message:
        "Aadhaar verification is still being confirmed by Digio. This can take a few seconds.",
    });
  } catch (e) {
    next(e);
  }
}
