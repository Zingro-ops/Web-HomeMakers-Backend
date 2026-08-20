import {
  KycService,
  AADHAAR_SUCCESS_STATUSES,
  AADHAAR_TERMINAL_FAILURE_STATUSES,
} from "../services/kyc.service.js";
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
// Kept as a fast-path update when it does reach us, but `confirm` below no
// longer depends on this alone — it actively polls Digio's own status API.
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
      if (AADHAAR_SUCCESS_STATUSES.includes(status)) {
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

// Called by the frontend after the Digio widget's client-side callback
// fires. Rather than trusting the client (or waiting on a webhook that may
// never arrive — e.g. misconfigured, unreachable in dev), this actively
// asks Digio directly for the real, current status of the request.
export async function confirm(req, res, next) {
  try {
    const cook = await Cook.findById(req.cookId).select("aadhaar").lean();
    if (!cook) return res.status(404).json({ error: "Cook not found" });

    const requestId = cook.aadhaar?.request_id;
    if (!requestId) {
      return res
        .status(409)
        .json({ error: "No Aadhaar request found for this account." });
    }

    // Already confirmed by a previous call or by the webhook — no need to
    // hit Digio again.
    if (AADHAAR_SUCCESS_STATUSES.includes(cook.aadhaar?.status)) {
      return res.json({ status: "verified" });
    }

    const digioResult = await KycService.getAadhaarStatus(requestId);
    const digioStatus = digioResult.status;

    const update = {
      "aadhaar.status": digioStatus,
      "aadhaar.updated_at": new Date(),
    };
    if (AADHAAR_SUCCESS_STATUSES.includes(digioStatus)) {
      update["aadhaar.verified_at"] = new Date();
    }
    await Cook.updateOne({ _id: req.cookId }, { $set: update });

    if (AADHAAR_SUCCESS_STATUSES.includes(digioStatus)) {
      return res.json({ status: "verified" });
    }

    if (AADHAAR_TERMINAL_FAILURE_STATUSES.includes(digioStatus)) {
      return res.json({
        status: "failed",
        message: `Aadhaar verification ${digioStatus}. Please try again.`,
      });
    }

    // Still in progress (requested / approval_pending / skipped-but-retryable)
    return res.json({
      status: "pending",
      message: "Aadhaar verification is still in progress with Digio.",
    });
  } catch (e) {
    next(e);
  }
}
