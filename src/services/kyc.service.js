import * as digio from "./digio.service.js";

const MATCH_THRESHOLD = 0.85; // internal 0-1 scale

// Digio's real terminal-success status is "approved" (see their documented
// enum: requested|approval_pending|approved|rejected|failed|expired|skipped).
// There is no "verified" value in their API. Checking both here for
// backward compatibility with any records already written under the old
// (incorrect) assumption, but "approved" is the one that actually matters.
const AADHAAR_SUCCESS_STATUSES = ["approved", "verified"];
const AADHAAR_TERMINAL_FAILURE_STATUSES = ["rejected", "failed", "expired"];

export const KycService = {
  verifyPan: (pan, name, dob) => digio.verifyPan(pan, name, dob),
  verifyBank: (account, ifsc, holderName) =>
    digio.verifyBank(account, ifsc, holderName),
  verifyFssai: (license) => digio.verifyFssai(license),
  createAadhaarRequest: (cookId, customerIdentifier, customerName) =>
    digio.createAadhaarRequest(cookId, customerIdentifier, customerName),
  getAadhaarStatus: (requestId, detailResponse = false) =>
    digio.getRequestStatus(requestId, detailResponse),
};

// Pure decision: reads the Cook's already-stored real verification results.
// NOTE: this is a recommendation surfaced to admins (AdminCookDetail's
// "Computed verdict"), never an authority that sets cook.status directly —
// see submit.service.js. Every application always requires an explicit
// human decision via decideCook().
export function decideKyc(cook) {
  const panOk = cook.tax?.verified === true && cook.tax?.name_matched === true;
  const bankOk = cook.bank?.verified === true;
  const fssaiNeedsReview = cook.fssai?.manual_review_required !== false;
  const aadhaarOk = AADHAAR_SUCCESS_STATUSES.includes(cook.aadhaar?.status);

  // Identity cross-match (Aadhaar OCR name vs. the name used for PAN) is
  // informational only for now — its extraction path is still provisional
  // (see aadhaar.controller.js), so a missing/null score is NOT treated as
  // a failure here. Only an explicitly LOW score counts against the verdict.
  const identityScore = cook.aadhaar?.identity_match_score;
  const identityOk = identityScore == null || identityScore >= MATCH_THRESHOLD;

  const bankScore =
    typeof cook.bank?.fuzzy_match_score === "number"
      ? cook.bank.fuzzy_match_score / 100
      : 0;
  const panScore = cook.tax?.name_matched === true ? 1 : 0;
  const score = Math.min(panScore, bankScore);

  const allOk = panOk && bankOk && !fssaiNeedsReview && aadhaarOk && identityOk;
  const decision =
    allOk && score >= MATCH_THRESHOLD ? "approved" : "manual_review";

  return { decision, score: Number(score.toFixed(3)) };
}

export {
  MATCH_THRESHOLD,
  AADHAAR_SUCCESS_STATUSES,
  AADHAAR_TERMINAL_FAILURE_STATUSES,
};
