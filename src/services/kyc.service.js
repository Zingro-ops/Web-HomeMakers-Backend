import * as digio from "./digio.service.js";
import { nameMatchScore } from "../utils/nameMatch.js";

const MATCH_THRESHOLD = 0.85;

// KycService: all provider calls go through here. Swap digio.* to change vendor.
export const KycService = {
  verifyPan: (pan) => digio.verifyPan(pan),
  verifyBank: (account, ifsc) => digio.verifyBank(account, ifsc),
  verifyFssai: (license) => digio.verifyFssai(license),
  verifyGst: (gstin) => digio.verifyGst(gstin),
};

// Pure decision: given verdict bundle, return state + score.
export function decideKyc({ enteredName, pan, bank, fssai }) {
  const score = nameMatchScore(enteredName, pan?.name, bank?.name);
  const allOk = pan?.verified && bank?.verified && fssai?.active;
  const decision =
    allOk && score >= MATCH_THRESHOLD ? "approved" : "manual_review";
  return { decision, score };
}

export { MATCH_THRESHOLD };
