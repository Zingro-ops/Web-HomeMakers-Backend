// A1 — admin authorization on coupon & category writes.
import { test, before, after, beforeEach, describe } from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import request from "supertest";
import {
  startDb, stopDb, clearDb, tokenFor, bearer, oid,
} from "./helpers.js";

let app;
let Coupon;

before(async () => {
  await startDb();
  ({ createApp: app } = await import("../src/app.js"));
  app = app();
  ({ default: Coupon } = await import("../src/models/Coupon.js"));
});
after(stopDb);
beforeEach(clearDb);

const future = () => new Date(Date.now() + 7 * 864e5).toISOString();
const validCoupon = (over = {}) => ({
  code: "WELCOME50",
  type: "flat",
  value: 50,
  minOrderValue: 100,
  expiresAt: future(),
  ...over,
});

const admin = () => bearer(tokenFor({ role: "admin" }));
const customer = () => bearer(tokenFor({ role: "customer" }));
const homemaker = () => bearer(tokenFor({ role: "homemaker" }));

describe("coupons — unauthorized and malicious requests are refused", () => {
  test("no token → 401, nothing written", async () => {
    const res = await request(app).post("/api/v1/coupons").send(validCoupon());
    assert.equal(res.status, 401);
    assert.equal(await Coupon.countDocuments(), 0);
  });

  test("customer token → 403, nothing written", async () => {
    const res = await request(app).post("/api/v1/coupons").set(customer()).send(validCoupon());
    assert.equal(res.status, 403);
    assert.equal(await Coupon.countDocuments(), 0);
  });

  test("homemaker token → 403, nothing written", async () => {
    const res = await request(app).post("/api/v1/coupons").set(homemaker()).send(validCoupon());
    assert.equal(res.status, 403);
    assert.equal(await Coupon.countDocuments(), 0);
  });

  test("client-supplied role in body/headers/query is ignored → 403", async () => {
    const res = await request(app)
      .post("/api/v1/coupons?role=admin")
      .set(customer())
      .set("x-role", "admin")
      .set("x-user-role", "admin")
      .send({ ...validCoupon(), role: "admin", isAdmin: true });
    assert.equal(res.status, 403);
    assert.equal(await Coupon.countDocuments(), 0);
  });

  test("forged admin token (wrong secret) → 401", async () => {
    const forged = jwt.sign({ id: oid(), role: "admin" }, "attacker-secret");
    const res = await request(app).post("/api/v1/coupons").set(bearer(forged)).send(validCoupon());
    assert.equal(res.status, 401);
    assert.equal(await Coupon.countDocuments(), 0);
  });

  test("unsigned alg:none admin token → 401", async () => {
    const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
    const none = `${b64({ alg: "none", typ: "JWT" })}.${b64({ id: oid(), role: "admin" })}.`;
    const res = await request(app).post("/api/v1/coupons").set(bearer(none)).send(validCoupon());
    assert.equal(res.status, 401);
  });

  test("expired admin token → 401", async () => {
    const { ZINGRO_JWT_SECRET } = await import("./helpers.js");
    const expired = jwt.sign({ id: oid(), role: "admin", exp: Math.floor(Date.now() / 1000) - 60 }, ZINGRO_JWT_SECRET);
    const res = await request(app).post("/api/v1/coupons").set(bearer(expired)).send(validCoupon());
    assert.equal(res.status, 401);
  });

  test("customer cannot edit or deactivate an existing coupon", async () => {
    const c = await Coupon.create({ ...validCoupon(), expiresAt: new Date(future()) });
    const patch = await request(app).patch(`/api/v1/coupons/${c._id}`).set(customer()).send({ value: 99999 });
    const del = await request(app).delete(`/api/v1/coupons/${c._id}`).set(customer());
    assert.equal(patch.status, 403);
    assert.equal(del.status, 403);
    const after = await Coupon.findById(c._id);
    assert.equal(after.value, 50);
    assert.equal(after.isActive, true);
  });
});

describe("coupons — authorized admin requests succeed and are validated", () => {
  test("admin create → 201 and persisted", async () => {
    const res = await request(app).post("/api/v1/coupons").set(admin()).send(validCoupon());
    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.equal(res.body.data.code, "WELCOME50");
    assert.equal(await Coupon.countDocuments(), 1);
  });

  test("admin cannot mass-assign server fields (usedCount) → 400", async () => {
    const res = await request(app).post("/api/v1/coupons").set(admin()).send(validCoupon({ usedCount: -100 }));
    assert.equal(res.status, 400);
    assert.equal(await Coupon.countDocuments(), 0);
  });

  test("percentage above 100 → 400", async () => {
    const res = await request(app).post("/api/v1/coupons").set(admin()).send(validCoupon({ type: "percentage", value: 150 }));
    assert.equal(res.status, 400);
  });

  test("malformed coupon id → 400, not 500", async () => {
    const res = await request(app).patch("/api/v1/coupons/not-an-id").set(admin()).send({ value: 10 });
    assert.equal(res.status, 400);
  });

  test("admin update and deactivate succeed", async () => {
    const c = await Coupon.create({ ...validCoupon(), expiresAt: new Date(future()) });
    const patch = await request(app).patch(`/api/v1/coupons/${c._id}`).set(admin()).send({ value: 75 });
    assert.equal(patch.status, 200, JSON.stringify(patch.body));
    const del = await request(app).delete(`/api/v1/coupons/${c._id}`).set(admin());
    assert.equal(del.status, 200);
    const after = await Coupon.findById(c._id);
    assert.equal(after.value, 75);
    assert.equal(after.isActive, false);
  });
});

describe("coupons — legitimate customer reads still work", () => {
  test("customer can list and validate coupons", async () => {
    await Coupon.create({ ...validCoupon(), expiresAt: new Date(future()) });
    const list = await request(app).get("/api/v1/coupons").set(customer());
    assert.equal(list.status, 200);
    assert.equal(list.body.data.items.length, 1);
    const v = await request(app)
      .post("/api/v1/coupons/validate")
      .set(customer())
      .send({ code: "welcome50", orderValue: 300 });
    assert.equal(v.status, 200, JSON.stringify(v.body));
    assert.equal(v.body.data.discount, 50);
  });
});

describe("categories", () => {
  const cat = { name: "Breakfast Specials", mealType: "breakfast" };

  test("no token → 401; customer → 403; homemaker → 403", async () => {
    assert.equal((await request(app).post("/api/v1/categories").send(cat)).status, 401);
    assert.equal((await request(app).post("/api/v1/categories").set(customer()).send(cat)).status, 403);
    assert.equal((await request(app).post("/api/v1/categories").set(homemaker()).send(cat)).status, 403);
    const id = oid();
    assert.equal((await request(app).patch(`/api/v1/categories/${id}`).set(customer()).send({ name: "x" })).status, 403);
    assert.equal((await request(app).delete(`/api/v1/categories/${id}`).set(customer())).status, 403);
  });

  test("admin create succeeds; public list still works without auth", async () => {
    const res = await request(app).post("/api/v1/categories").set(admin()).send(cat);
    assert.equal(res.status, 201, JSON.stringify(res.body));
    const list = await request(app).get("/api/v1/categories");
    assert.equal(list.status, 200);
  });

  test("unknown keys rejected → 400", async () => {
    const res = await request(app).post("/api/v1/categories").set(admin()).send({ ...cat, slug: "evil" });
    assert.equal(res.status, 400);
  });
});

describe("existing admin routes still enforce admin", () => {
  test("customer → 403 on /api/admin/cooks", async () => {
    const res = await request(app).get("/api/admin/cooks").set(customer());
    assert.equal(res.status, 403);
  });
});
