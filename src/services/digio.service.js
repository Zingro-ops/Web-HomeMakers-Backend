import { env } from "../config/env.js";

const MOCK = env.nodeEnv !== "production" || process.env.KYC_MOCK === "1";
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// Each fn returns a normalized verdict. Cached verdicts handled by caller.
export async function verifyPan(pan) {
  if (MOCK) {
    await wait(150);
    return {
      verified: true,
      name: "Test",
      ref_id: `mock_pan_${pan.slice(-4)}`,
    };
  }
  throw new Error("Digio PAN not configured");
}

export async function verifyBank(account, ifsc) {
  if (MOCK) {
    await wait(150);
    return {
      verified: true,
      name: "Test",
      ref_id: `mock_bank_${account.slice(-4)}`,
    };
  }
  throw new Error("Digio bank not configured");
}

export async function verifyFssai(license) {
  if (MOCK) {
    await wait(150);
    return {
      active: true,
      registered_name: "Test",
      expiry: "2027-12-31",
      ref_id: `mock_fssai_${license.slice(-4)}`,
    };
  }
  throw new Error("Digio FSSAI not configured");
}

export async function verifyGst(gstin) {
  if (MOCK) {
    await wait(100);
    return {
      verified: true,
      name: "Test",
      ref_id: `mock_gst_${gstin.slice(-4)}`,
    };
  }
  throw new Error("Digio GST not configured");
}
