import { Referral } from "../models/Referral.js";
import { CustomerProfile } from "../models/CustomerProfile.js";
import { Order } from "../models/Order.js";

const REWARD_AMOUNT = 50;

function generateCode(customerId) {
  return `ZNG${customerId.slice(-6).toUpperCase()}`;
}

export async function getMyCode(customerId) {
  let profile = await CustomerProfile.findOne({ customerId });
  if (!profile) profile = await CustomerProfile.create({ customerId });
  if (!profile.referralCode) {
    profile.referralCode = generateCode(customerId);
    await profile.save();
  }
  return { code: profile.referralCode, walletBalance: profile.walletBalance };
}

export async function applyCode(newCustomerId, code) {
  const referrerProfile = await CustomerProfile.findOne({ referralCode: code });
  if (!referrerProfile)
    throw Object.assign(new Error("Invalid referral code"), {
      status: 404,
      code: "INVALID_CODE",
    });

  if (referrerProfile.customerId === newCustomerId) {
    throw Object.assign(new Error("You cannot refer yourself"), {
      status: 400,
      code: "SELF_REFERRAL",
    });
  }

  const existing = await Referral.findOne({
    referredCustomerId: newCustomerId,
  });
  if (existing)
    throw Object.assign(new Error("You've already used a referral code"), {
      status: 409,
      code: "ALREADY_REFERRED",
    });

  return Referral.create({
    referrerCustomerId: referrerProfile.customerId,
    referredCustomerId: newCustomerId,
    code,
    rewardAmount: REWARD_AMOUNT,
  });
}

export async function history(customerId) {
  return Referral.find({ referrerCustomerId: customerId }).sort({
    createdAt: -1,
  });
}

// Called when a referred customer's FIRST order completes â€” see Stage 2
export async function completeReferralIfEligible(customerId) {
  const referral = await Referral.findOne({
    referredCustomerId: customerId,
    status: "pending",
  });
  if (!referral) return null;

  const completedOrderCount = await Order.countDocuments({ customerId, status: "completed" });
  if (completedOrderCount !== 1) return null;

  referral.status = "completed";
  referral.completedAt = new Date();
  await referral.save();

  await CustomerProfile.updateOne(
    { customerId: referral.referrerCustomerId },
    { $inc: { walletBalance: referral.rewardAmount } },
    { upsert: true },
  );
  await CustomerProfile.updateOne(
    { customerId: referral.referredCustomerId },
    { $inc: { walletBalance: referral.rewardAmount } },
    { upsert: true },
  );

  return referral;
}



