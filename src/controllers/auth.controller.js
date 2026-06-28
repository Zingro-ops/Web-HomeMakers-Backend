import { signToken, cookieOpts } from "../utils/jwt.js";
import {
  registerSchema,
  loginSchema,
  otpSchema,
} from "../validators/auth.schema.js";
import * as authService from "../services/auth.service.js";
import { Cook } from "../models/Cook.js";

const setSession = (res, cook) =>
  res.cookie("zid", signToken({ sub: cook._id.toString() }), cookieOpts());

export async function register(req, res, next) {
  try {
    const data = registerSchema.parse(req.body);
    const cook = await authService.registerCook(data);
    setSession(res, cook);
    res
      .status(201)
      .json({ id: cook._id, status: cook.status, otpRequired: true });
  } catch (e) {
    next(e);
  }
}

export async function verifyOtp(req, res, next) {
  try {
    const { otp } = otpSchema.parse(req.body);
    const cook = await authService.verifyOtp(req.user.sub, otp);
    res.json({ id: cook._id, status: cook.status, verified: true });
  } catch (e) {
    next(e);
  }
}

export async function login(req, res, next) {
  try {
    const data = loginSchema.parse(req.body);
    const cook = await authService.loginCook(data);
    setSession(res, cook);
    res.json({
      id: cook._id,
      status: cook.status,
      currentStep: cook.currentStep,
    });
  } catch (e) {
    next(e);
  }
}

export async function logout(req, res) {
  res.clearCookie("zid", cookieOpts());
  res.json({ ok: true });
}

export async function me(req, res, next) {
  try {
    const cook = await Cook.findById(req.user.sub).select(
      "email phone status currentStep personal otp.verified",
    );
    if (!cook) return res.status(404).json({ error: "Not found" });
    res.json({
      id: cook._id,
      email: cook.email,
      phone: cook.phone,
      status: cook.status,
      currentStep: cook.currentStep,
      name: cook.personal?.name,
      otpVerified: cook.otp?.verified ?? false,
    });
  } catch (e) {
    next(e);
  }
}
