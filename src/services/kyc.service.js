import * as digio from "./digio.service.js";

const MATCH_THRESHOLD = 0.85; // internal 0-1 scale

export const KycService = {
  verifyPan: (pan, name, dob) => digio.verifyPan(pan, name, dob),
  verifyBank: (account, ifsc, holderName) =>
    digio.verifyBank(account, ifsc, holderName),
  verifyFssai: (license) => digio.verifyFssai(license),
};

// Pure decision: reads the Cook's already-stored real verification results.
export function decideKyc(cook) {
  const panOk = cook.tax?.verified === true && cook.tax?.name_matched === true;
  const bankOk = cook.bank?.verified === true;
  const fssaiNeedsReview = cook.fssai?.manual_review_required !== false;

  const bankScore =
    typeof cook.bank?.fuzzy_match_score === "number"
      ? cook.bank.fuzzy_match_score / 100
      : 0;
  const panScore = cook.tax?.name_matched === true ? 1 : 0;
  const score = Math.min(panScore, bankScore);

  const allOk = panOk && bankOk && !fssaiNeedsReview;
  const decision =
    allOk && score >= MATCH_THRESHOLD ? "approved" : "manual_review";

  return { decision, score: Number(score.toFixed(3)) };
}

export { MATCH_THRESHOLD };
