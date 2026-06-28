import bcrypt from "bcryptjs";
import { Cook } from "../models/Cook.js";
import { env } from "../config/env.js";

export async function registerCook({ name, email, phone, password }) {
  const passwordHash = await bcrypt.hash(password, 10);
  const cook = await Cook.create({
    name,
    email,
    phone,
    passwordHash,
    personal: { name },
    otp: {
      code: env.otpMock,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      verified: false,
    },
  });
  return cook;
}

export async function verifyOtp(cookId, otp) {
  const cook = await Cook.findById(cookId);
  if (!cook) throw Object.assign(new Error("Cook not found"), { status: 404 });
  if (cook.otp?.verified) return cook;
  const valid = cook.otp?.code === otp && cook.otp?.expiresAt > new Date();
  if (!valid)
    throw Object.assign(new Error("Invalid or expired OTP"), { status: 400 });
  cook.otp.verified = true;
  await cook.save();
  return cook;
}

export async function loginCook({ identifier, password }) {
  const cook = await Cook.findOne({
    $or: [{ email: identifier }, { phone: identifier }],
  });
  if (!cook)
    throw Object.assign(new Error("Invalid credentials"), { status: 401 });
  const ok = await bcrypt.compare(password, cook.passwordHash);
  if (!ok)
    throw Object.assign(new Error("Invalid credentials"), { status: 401 });
  return cook;
}
