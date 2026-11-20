import crypto from "crypto";

/**
 * Authenticates courier/delivery-provider webhooks.
 *
 * Scheme (provider-agnostic; a real courier's adapter must produce it):
 *   x-zingro-courier-timestamp: <unix seconds>
 *   x-zingro-courier-signature: hex( HMAC_SHA256(secret, `${timestamp}.${rawBody}`) )
 *                                (an optional "sha256=" prefix is accepted)
 *
 * Properties:
 *  - Fails CLOSED: if COURIER_WEBHOOK_SECRET is unset or too short, every
 *    request is refused with 503. An unconfigured deployment can never accept
 *    an unauthenticated status change.
 *  - Signs the RAW request bytes (captured by express.json's `verify` hook in
 *    app.js), so re-serialisation cannot change what was verified.
 *  - Constant-time comparison.
 *  - Timestamp is bound into the MAC and must be within ±TOLERANCE_SECONDS, so
 *    a captured request cannot be replayed later. Exact duplicates inside the
 *    window are stopped by the eventId de-duplication in the service layer.
 */
export const TOLERANCE_SECONDS = 300;
const MIN_SECRET_LENGTH = 32;

function deny(res, status, code, message) {
  return res.status(status).json({ success: false, code, message });
}

export function computeCourierSignature(secret, timestamp, rawBody) {
  return crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.`)
    .update(rawBody)
    .digest("hex");
}

export function verifyCourierSignature(req, res, next) {
  const secret = process.env.COURIER_WEBHOOK_SECRET;
  if (!secret || secret.length < MIN_SECRET_LENGTH) {
    console.error(
      "[security] courier webhook rejected: COURIER_WEBHOOK_SECRET is not configured",
    );
    return deny(res, 503, "WEBHOOK_NOT_CONFIGURED", "Webhook not configured");
  }

  const tsHeader = req.get("x-zingro-courier-timestamp");
  const sigHeader = req.get("x-zingro-courier-signature");
  if (!tsHeader || !sigHeader) {
    return deny(res, 401, "SIGNATURE_MISSING", "Missing signature");
  }

  if (!/^\d{1,12}$/.test(tsHeader)) {
    return deny(res, 401, "TIMESTAMP_INVALID", "Invalid timestamp");
  }
  const ts = Number(tsHeader);
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - ts) > TOLERANCE_SECONDS) {
    return deny(res, 401, "TIMESTAMP_OUT_OF_RANGE", "Stale or future request");
  }

  if (!Buffer.isBuffer(req.rawBody) || req.rawBody.length === 0) {
    return deny(res, 400, "BODY_REQUIRED", "JSON body required");
  }

  const provided = sigHeader.replace(/^sha256=/, "").trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(provided)) {
    return deny(res, 401, "SIGNATURE_INVALID", "Invalid signature");
  }
  const expected = computeCourierSignature(secret, tsHeader, req.rawBody);
  const a = Buffer.from(provided, "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    console.warn(
      `[security] courier webhook signature mismatch ip=${req.ip}`,
    );
    return deny(res, 401, "SIGNATURE_INVALID", "Invalid signature");
  }

  next();
}
