import Coupon from "../models/Coupon.js";
import CouponUsage from "../models/CouponUsage.js";

function calcDiscount(coupon, orderValue) {
  let discount =
    coupon.type === "flat" ? coupon.value : (orderValue * coupon.value) / 100;
  if (coupon.type === "percentage" && coupon.maxDiscount) {
    discount = Math.min(discount, coupon.maxDiscount);
  }
  return Math.min(Math.round(discount * 100) / 100, orderValue);
}

export async function validate({ code, userId, cookId, orderValue }) {
  const coupon = await Coupon.findOne({
    code: code.toUpperCase(),
    isActive: true,
  });
  if (!coupon)
    throw Object.assign(new Error("Invalid coupon code"), {
      status: 404,
      code: "COUPON_NOT_FOUND",
    });

  const now = new Date();
  if (now < coupon.startsAt || now > coupon.expiresAt)
    throw Object.assign(new Error("Coupon expired or not yet active"), {
      status: 400,
      code: "COUPON_EXPIRED",
    });

  if (coupon.cookId && String(coupon.cookId) !== String(cookId))
    throw Object.assign(new Error("Coupon not valid for this kitchen"), {
      status: 400,
      code: "COUPON_WRONG_COOK",
    });

  if (orderValue < coupon.minOrderValue)
    throw Object.assign(
      new Error(`Minimum order value ₹${coupon.minOrderValue} required`),
      { status: 400, code: "COUPON_MIN_ORDER" },
    );

  if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit)
    throw Object.assign(new Error("Coupon usage limit reached"), {
      status: 400,
      code: "COUPON_EXHAUSTED",
    });

  const userUsage = await CouponUsage.countDocuments({
    couponId: coupon._id,
    userId,
  });
  if (userUsage >= coupon.usageLimitPerUser)
    throw Object.assign(new Error("You've already used this coupon"), {
      status: 400,
      code: "COUPON_ALREADY_USED",
    });

  const discount = calcDiscount(coupon, orderValue);
  return { coupon, discount };
}

// Called at order-confirmation time, not at validate time — increments counters
export async function apply({ couponId, userId, orderId, discountApplied }) {
  await Coupon.updateOne({ _id: couponId }, { $inc: { usedCount: 1 } });
  return CouponUsage.create({ couponId, userId, orderId, discountApplied });
}

export async function list({ cookId, page = 1, limit = 20 } = {}) {
  const q = { isActive: true, expiresAt: { $gte: new Date() } };
  if (cookId) q.$or = [{ cookId }, { cookId: null }];
  const skip = (Number(page) - 1) * Number(limit);
  const [items, total] = await Promise.all([
    Coupon.find(q).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
    Coupon.countDocuments(q),
  ]);
  return { items, total, page: Number(page), limit: Number(limit) };
}

export async function create(dto) {
  const exists = await Coupon.findOne({ code: dto.code.toUpperCase() });
  if (exists)
    throw Object.assign(new Error("Coupon code already exists"), {
      status: 409,
    });
  return Coupon.create({ ...dto, code: dto.code.toUpperCase() });
}

export async function update(id, dto) {
  const c = await Coupon.findById(id);
  if (!c) throw Object.assign(new Error("Coupon not found"), { status: 404 });
  if (dto.code) dto.code = dto.code.toUpperCase();
  Object.assign(c, dto);
  return c.save();
}

export async function remove(id) {
  const c = await Coupon.findByIdAndUpdate(
    id,
    { isActive: false },
    { new: true },
  );
  if (!c) throw Object.assign(new Error("Coupon not found"), { status: 404 });
  return c;
}
