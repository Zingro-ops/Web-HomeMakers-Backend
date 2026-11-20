// Test harness. MUST be imported before anything under src/.
//
// Safety: env vars are set here BEFORE src/config/env.js runs dotenv. dotenv
// never overrides an existing variable, so the developer's real `.env`
// (production Mongo URI, Razorpay keys…) can never be used by a test run:
// every variable the code under test reads is pinned below, and Mongo is an
// in-memory server started per test file.
import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

export const ZINGRO_JWT_SECRET = "test-zingro-jwt-secret-" + crypto.randomBytes(8).toString("hex");
export const COURIER_SECRET = crypto.randomBytes(32).toString("hex"); // 64 chars
export const RAZORPAY_SECRET = "test_rzp_secret_" + crypto.randomBytes(8).toString("hex");

Object.assign(process.env, {
  NODE_ENV: "test",
  MONGO_URI: "mongodb://127.0.0.1:1/never-used",
  JWT_SECRET: "test-legacy-jwt-secret",
  ZINGRO_JWT_SECRET,
  RAZORPAY_KEY_ID: "rzp_test_dummy",
  RAZORPAY_KEY_SECRET: RAZORPAY_SECRET,
  COURIER_WEBHOOK_SECRET: COURIER_SECRET,
  CLIENT_ORIGINS: "http://localhost:5173",
  S3_BUCKET: "test-bucket",
  DIGIO_CLIENT_ID: "",
  DIGIO_CLIENT_SECRET: "",
  // Dummy keys so no outbound mail/SMS provider can ever be reached with a
  // real credential from the developer's .env.
  RESEND_API_KEY: "re_test_dummy",
  RESEND_FROM_EMAIL: "test@example.invalid",
  GOOGLE_MAPS_API_KEY: "",
  DIGIO_BASE_URL: "http://127.0.0.1:1",
  DASHBOARD_URL: "http://127.0.0.1:1",
  KYC_MOCK: "true",
  OTP_MOCK: "000000",
  AWS_REGION: "ap-south-1",
  SMTP_HOST: "127.0.0.1",
  SMTP_USER: "",
  SMTP_PASS: "",
});

if (process.cwd().replace(/\\/g, "/").endsWith("/Web-HomeMakers-Backend")) {
  // dotenv resolves .env from cwd; the npm script runs from test/ so the real
  // .env is never read. Refuse to run if invoked from the repo root.
  throw new Error(
    "Run backend tests with `npm test` (cwd=test/), never from the repo root: " +
      "the root .env holds real credentials.",
  );
}

let mongod;

export async function startDb() {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri(), { dbName: "zingro-test" });
  // Import the app first so EVERY model is registered, then build all indexes
  // synchronously. Unique indexes (CourierWebhookEvent.eventId,
  // Payment.razorpayOrderId…) must exist before any test relies on them —
  // otherwise a concurrency test could pass/fail on an index-build race.
  await import("../src/app.js");
  for (const m of Object.values(mongoose.models)) await m.syncIndexes();
}

export async function stopDb() {
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
}

export async function clearDb() {
  const collections = await mongoose.connection.db.collections();
  await Promise.all(collections.map((c) => c.deleteMany({})));
}

export const oid = () => new mongoose.Types.ObjectId().toString();

/** A real, correctly signed token — exactly what Zingro-Auth issues. */
export function tokenFor({ id = oid(), role = "customer", phone = "9876543210" } = {}) {
  return jwt.sign({ id, phone, role }, ZINGRO_JWT_SECRET, { expiresIn: "1h" });
}

export const bearer = (t) => ({ Authorization: `Bearer ${t}` });

/** Signs a courier webhook body the way a configured provider adapter must. */
export function signCourier(body, { ts = Math.floor(Date.now() / 1000), secret = COURIER_SECRET } = {}) {
  const raw = typeof body === "string" ? body : JSON.stringify(body);
  const sig = crypto
    .createHmac("sha256", secret)
    .update(`${ts}.`)
    .update(raw)
    .digest("hex");
  return { raw, headers: {
    "Content-Type": "application/json",
    "x-zingro-courier-timestamp": String(ts),
    "x-zingro-courier-signature": sig,
  } };
}

export function razorpaySignature(orderId, paymentId) {
  return crypto
    .createHmac("sha256", RAZORPAY_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");
}
