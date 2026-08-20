import {
  KycService,
  AADHAAR_SUCCESS_STATUSES,
  AADHAAR_TERMINAL_FAILURE_STATUSES,
} from "../services/kyc.service.js";
import { Cook } from "../models/Cook.js";
import { nameMatchScore } from "../utils/nameMatch.js";

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

// Extracts the OCR'd name/DOB from a detail_response=true Digio payload.
//
// ⚠️ PROVISIONAL: this path (actions[].ocr_result.name / .dob) is based on
// Digio's *documented* schema, not a real response confirmed from this
// account. Logs the raw actions array so the real shape can be verified
// against actual data — if this path is wrong, extraction just silently
// yields null (no crash), which shows up as "unknown" everywhere identity
// match is used, never as a false failure.
function extractAadhaarOcr(digioDetailResult) {
  const actions = digioDetailResult?.actions || [];
  const idAction = actions.find(
    (a) => a.type === "digilocker" || a.type === "aadhaar_verification",
  );
  const ocr = idAction?.ocr_result;
  if (!ocr) {
    console.warn(
      "AADHAAR OCR EXTRACTION: no ocr_result found. Raw actions:",
      JSON.stringify(actions, null, 2),
    );
    return { name: null, dob: null };
  }
  return { name: ocr.name || null, dob: ocr.dob || null };
}

// Called by the frontend after the Digio widget's client-side callback
// fires. Rather than trusting the client (or waiting on a webhook that may
// never arrive), this actively asks Digio directly for the real, current
// status of the request — and on success, also fetches OCR detail to
// cross-check identity against the name used for PAN verification.
export async function confirm(req, res, next) {
  try {
    const cook = await Cook.findById(req.cookId)
      .select("aadhaar personal tax")
      .lean();
    if (!cook) return res.status(404).json({ error: "Cook not found" });

    const requestId = cook.aadhaar?.request_id;
    if (!requestId) {
      return res
        .status(409)
        .json({ error: "No Aadhaar request found for this account." });
    }

    if (AADHAAR_SUCCESS_STATUSES.includes(cook.aadhaar?.status)) {
      return res.json({ status: "verified" });
    }

    // Request detail_response=true so we get OCR data for the identity
    // cross-match, not just the bare status.
    const digioResult = await KycService.getAadhaarStatus(requestId, true);
    const digioStatus = digioResult.status;

    const update = {
      "aadhaar.status": digioStatus,
      "aadhaar.updated_at": new Date(),
    };

    if (AADHAAR_SUCCESS_STATUSES.includes(digioStatus)) {
      update["aadhaar.verified_at"] = new Date();

      const { name: ocrName, dob: ocrDob } = extractAadhaarOcr(digioResult);
      if (ocrName) {
        update["aadhaar.ocr_name"] = ocrName;
        update["aadhaar.identity_match_score"] = nameMatchScore(
          ocrName,
          cook.tax?.name || cook.personal?.name,
        );
      }
      if (ocrDob) {
        update["aadhaar.ocr_dob"] = ocrDob;
      }
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

    return res.json({
      status: "pending",
      message: "Aadhaar verification is still in progress with Digio.",
    });
  } catch (e) {
    next(e);
  }
}
