import { z } from "zod";
import * as svc from "../services/payment.service.js";
import { ok, fail } from "../utils/apiResponse.js";

const createSchema = z.object({
  addressId: z.string(),
  couponCode: z.string().optional(),
  customerName: z.string(),
  notes: z.string().optional(),
});

const verifySchema = z.object({
  razorpayOrderId: z.string(),
  razorpayPaymentId: z.string(),
  razorpaySignature: z.string(),
  couponCode: z.string().optional(),
});

const wrap = (fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (e) {
    if (e instanceof z.ZodError)
      return fail(res, "Validation failed", 400, "VALIDATION");
    fail(res, e.message || "Server error", e.status || 500, e.code);
  }
};

export const createOrder = wrap(async (req, res) => {
  const dto = createSchema.parse(req.body);
  ok(
    res,
    await svc.createOrder({
      userId: req.user.id,
      userPhone: req.user.phone,
      ...dto,
    }),
    "Razorpay order created",
    201,
  );
});

export const verify = wrap(async (req, res) => {
  const dto = verifySchema.parse(req.body);
  ok(
    res,
    await svc.verifyPayment({ userId: req.user.id, ...dto }),
    "Payment verified",
  );
});
