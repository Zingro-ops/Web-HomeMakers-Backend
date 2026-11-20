#!/usr/bin/env node
/**
 * READ-ONLY coupon exposure report (A1 follow-up).
 *
 * Context: before b3154d1, POST/PATCH/DELETE /api/v1/coupons had no admin
 * check, so any logged-in user could create or alter coupons. The Coupon
 * schema has NO createdBy field, and no client application ever created
 * coupons, so the creator of an existing coupon CANNOT be determined from the
 * data. This report therefore lists every coupon with risk flags for a human
 * to review. It changes nothing.
 *
 * Read-only by construction:
 *  - raw MongoDB driver only; NO Mongoose models are imported, because model
 *    compilation can trigger automatic index builds (a write);
 *  - only find() / aggregate() with no write stages ($out/$merge rejected);
 *  - readPreference secondaryPreferred;
 *  - the connection string is never printed; coupon codes are masked.
 *
 * Usage (from the repo root, uses MONGO_URI from .env):
 *   node scripts/report-coupons.readonly.mjs > coupon-report.md
 */
import dotenv from "dotenv";
import mongoose from "mongoose";

dotenv.config();
const uri = process.env.MONGO_URI;
if (!uri) {
  console.error("MONGO_URI is not set");
  process.exit(2);
}

const host = (() => {
  try {
    return new URL(uri.replace(/^mongodb(\+srv)?:\/\//, "http://")).host;
  } catch {
    return "<unparseable>";
  }
})();

const { MongoClient } = mongoose.mongo;
const client = new MongoClient(uri, {
  readPreference: "secondaryPreferred",
  appName: "zingro-readonly-coupon-report",
  serverSelectionTimeoutMS: 20_000,
});

const mask = (code) =>
  typeof code === "string" && code.length > 3
    ? code.slice(0, 3) + "*".repeat(Math.max(3, code.length - 3))
    : "***";

const iso = (d) => (d ? new Date(d).toISOString() : "—");

function flags(c, now) {
  const f = [];
  const active = c.isActive !== false && (!c.expiresAt || new Date(c.expiresAt) > now);
  if (active) f.push("ACTIVE");
  if (c.type === "percentage" && c.value > 100) f.push("PCT>100");
  else if (c.type === "percentage" && c.value >= 50) f.push("PCT>=50");
  if (c.type === "percentage" && !c.maxDiscount) f.push("NO_MAX_CAP");
  if (c.type === "flat" && c.value >= 200) f.push("FLAT>=200");
  if (c.usageLimit === null || c.usageLimit === undefined) f.push("UNLIMITED_TOTAL");
  if ((c.usageLimitPerUser ?? 1) > 3) f.push("PER_USER>3");
  if (!c.minOrderValue) f.push("NO_MIN_ORDER");
  if (c.expiresAt && new Date(c.expiresAt) - new Date(c.createdAt || now) > 365 * 864e5)
    f.push("VALID>1Y");
  return f;
}

try {
  await client.connect();
  const db = client.db(); // database named in the URI (driver default otherwise)
  const now = new Date();

  const coupons = await db
    .collection("coupons")
    .find({}, { projection: { _id: 1, code: 1, type: 1, value: 1, maxDiscount: 1,
      minOrderValue: 1, cookId: 1, usageLimit: 1, usageLimitPerUser: 1,
      usedCount: 1, isActive: 1, startsAt: 1, expiresAt: 1, createdAt: 1, updatedAt: 1 } })
    .sort({ createdAt: 1 })
    .toArray();

  const usage = await db
    .collection("couponusages")
    .aggregate([
      { $group: { _id: "$couponId", redemptions: { $sum: 1 },
        users: { $addToSet: "$userId" }, discount: { $sum: "$discountApplied" } } },
      { $project: { redemptions: 1, distinctUsers: { $size: "$users" }, discount: 1 } },
    ])
    .toArray();
  const usageBy = new Map(usage.map((u) => [String(u._id), u]));

  const lines = [];
  lines.push("# Coupon exposure report (READ-ONLY)");
  lines.push("");
  lines.push(`- Generated: ${now.toISOString()}`);
  lines.push(`- Cluster host: \`${host}\` · database: \`${db.databaseName}\``);
  lines.push(`- Coupons found: **${coupons.length}**`);
  lines.push(
    "- **Creator attribution: NOT POSSIBLE.** The Coupon schema has no " +
      "createdBy field and no client app ever created coupons, so any coupon " +
      "may have been created by an admin script/tool OR by an ordinary user " +
      "via the previously unguarded API. Review each against your records.",
  );
  lines.push(
    "- Redemption figures come from `couponusages`; they are recorded only on " +
      "payment verification.",
  );
  lines.push("");
  lines.push("| # | id | code (masked) | type | value | max cap | min order | cook | limit total/per user | used | redemptions / users / ₹discount | active | starts | expires | created | updated | flags |");
  lines.push("|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|");
  coupons.forEach((c, i) => {
    const u = usageBy.get(String(c._id));
    lines.push(
      `| ${i + 1} | \`${c._id}\` | \`${mask(c.code)}\` | ${c.type} | ${c.value} | ` +
        `${c.maxDiscount ?? "—"} | ${c.minOrderValue ?? 0} | ${c.cookId ? "`" + c.cookId + "`" : "all"} | ` +
        `${c.usageLimit ?? "∞"}/${c.usageLimitPerUser ?? 1} | ${c.usedCount ?? 0} | ` +
        `${u ? `${u.redemptions} / ${u.distinctUsers} / ${u.discount}` : "0 / 0 / 0"} | ` +
        `${c.isActive !== false ? "yes" : "no"} | ${iso(c.startsAt)} | ${iso(c.expiresAt)} | ` +
        `${iso(c.createdAt)} | ${iso(c.updatedAt)} | ${flags(c, now).join(" ") || "—"} |`,
    );
  });
  const highRisk = coupons.filter((c) => {
    const f = flags(c, now);
    return f.includes("ACTIVE") && (f.includes("PCT>100") || f.includes("PCT>=50") ||
      f.includes("FLAT>=200") || (f.includes("UNLIMITED_TOTAL") && f.includes("NO_MIN_ORDER")));
  });
  lines.push("");
  lines.push(`**Active coupons with high-risk terms:** ${highRisk.length}` +
    (highRisk.length ? " — " + highRisk.map((c) => "`" + c._id + "`").join(", ") : ""));
  lines.push("");
  lines.push("_No records were modified. Remediation (deactivation) requires explicit approval._");
  console.log(lines.join("\n"));
} catch (e) {
  console.error(`Report failed: ${e.name}: ${e.message}`);
  process.exitCode = 1;
} finally {
  await client.close().catch(() => {});
}
