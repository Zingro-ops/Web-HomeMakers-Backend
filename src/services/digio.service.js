import axios from "axios";
import { env } from "../config/env.js";

const MOCK = env.nodeEnv !== "production" || process.env.KYC_MOCK === "1";
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const digioClient = axios.create({
  baseURL: env.digio.baseUrl,
  headers: {
    Authorization: `Basic ${Buffer.from(`${env.digio.clientId}:${env.digio.clientSecret}`).toString("base64")}`,
    "Content-Type": "application/json",
  },
  timeout: 15000,
});

export async function verifyPan(pan, name, dob) {
  if (MOCK) {
    await wait(150);
    return {
      verified: true,
      name_matched: true,
      dob_matched: true,
      category: "individual",
      status: "valid",
      remarks: null,
    };
  }

  try {
    const { data } = await digioClient.post(
      "/v3/client/kyc/fetch_id_data/PAN",
      {
        id_no: pan,
        name,
        dob, // must be dd/MM/yyyy
      },
    );

    return {
      verified: data.status === "valid" && data.name_as_per_pan_match === true,
      name_matched: data.name_as_per_pan_match,
      dob_matched: data.date_of_birth_match,
      category: data.category,
      status: data.status,
      remarks: data.remarks,
    };
  } catch (error) {
    if (error.response) {
      throw Object.assign(
        new Error(
          `Digio PAN verification failed: ${error.response.data?.remarks || error.response.status}`,
        ),
        { status: 502 },
      );
    }
    throw Object.assign(
      new Error("Unable to reach Digio PAN verification service."),
      { status: 502 },
    );
  }
}

export async function verifyBank(account, ifsc, holderName) {
  if (MOCK) {
    await wait(150);
    return {
      verified: true,
      name_with_bank: "Test",
      fuzzy_match_result: true,
      fuzzy_match_score: 95,
    };
  }

  try {
    const { data } = await digioClient.post("/v4/client/verify/bank_account", {
      beneficiary_account_no: account,
      beneficiary_ifsc: ifsc,
      beneficiary_name: holderName,
      validation_mode: "AUTO",
      unique_request_id: `zingro_bank_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    });

    return {
      verified: data.verified === true,
      name_with_bank: data.beneficiary_name_with_bank || null,
      fuzzy_match_result: data.fuzzy_match_result ?? null,
      fuzzy_match_score: data.fuzzy_match_score ?? null,
      error_msg: data.error_msg || null,
    };
  } catch (error) {
    if (error.response) {
      console.error(
        "DIGIO BANK ERROR RESPONSE:",
        JSON.stringify(error.response.data, null, 2),
      );
      throw Object.assign(
        new Error(
          `Digio bank verification failed: ${error.response.data?.error_msg || error.response.status}`,
        ),
        { status: 502 },
      );
    }
    throw Object.assign(
      new Error("Unable to reach Digio bank verification service."),
      { status: 502 },
    );
  }
}
export async function createAadhaarRequest(
  cookId,
  customerIdentifier,
  customerName,
) {
  if (MOCK) {
    await wait(150);
    return {
      id: `mock_kyc_${cookId}`,
      status: "requested",
      customer_identifier: customerIdentifier,
    };
  }

  try {
    const payload = {
      customer_identifier: customerIdentifier,
      customer_name: customerName,
      template_name: "Zingro Aadhaar Verification",
      notify_customer: false,
      reference_id: `cook_${cookId}`,
      transaction_id: `aadhaar_${cookId}_${Date.now()}`,
      generate_access_token: true,
      expire_in_days: 10,
    };
    console.log(
      "DIGIO AADHAAR REQUEST PAYLOAD:",
      JSON.stringify(payload, null, 2),
    );
    const { data } = await digioClient.post(
      "/client/kyc/v2/request/with_template",
      payload,
    );
  } catch (error) {
    if (error.response) {
      console.error(
        "DIGIO ERROR RESPONSE:",
        JSON.stringify(error.response.data, null, 2),
      );
      throw Object.assign(
        new Error(
          `Digio Aadhaar request creation failed: ${error.response.data?.error_msg || error.response.status}`,
        ),
        { status: 502 },
      );
    }
    throw Object.assign(new Error("Unable to reach Digio."), { status: 502 });
  }
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
  throw new Error(
    "Digio does not support FSSAI â€” needs a separate provider or manual review.",
  );
}
