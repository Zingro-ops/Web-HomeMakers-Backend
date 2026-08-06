import crypto from "crypto";
import { razorpay } from "./razorpay.client.js";
import { Payment } from "../models/Payment.js";
import { Order } from "../models/Order.js";
import Address from "../models/Address.js";
import { computeBreakdown } from "./checkout.service.js";
import * as couponSvc from "./coupon.service.js";
import { createPayoutForOrder } from "./payout.service.js";

export async function createOrder({
  userId,
  userPhone,
  addressId,
  couponCode,
  customerName,
  notes,
  orderType = "quick",
  scheduledFor = null,
}) {
  const breakdown = await computeBreakdown({
    userId,
    addressId,
    couponCode,
    orderType,
    scheduledFor,
  });
  const address = await Address.findById(addressId);

  const order = await Order.create({
    cookId: breakdown.cookId,
    customerId: userId,
    customerName,
    customerPhone: userPhone,
    items: breakdown.lineItems,
    subtotal: breakdown.subtotal,
    total: breakdown.grandTotal,
    isCluster: breakdown.isCluster,
    clusterDiscountPercent: breakdown.clusterDiscountPercent,
    orderType: breakdown.orderType,
    scheduledFor: breakdown.scheduledFor,
    deliveryAddress: {
      building: address.line1,
      locality: address.city,
      pincode: address.pincode,
    },
    notes,
  });

  const rpOrder = await razorpay.orders.create({
    amount: Math.round(breakdown.grandTotal * 100),
    currency: "INR",
    receipt: String(order._id),
    notes: { orderId: String(order._id) },
  });

  await Payment.create({
    orderId: order._id,
    customerId: userId,
    razorpayOrderId: rpOrder.id,
    amount: breakdown.grandTotal,
  });

  return {
    orderId: order._id,
    razorpayOrderId: rpOrder.id,
    amount: breakdown.grandTotal,
    keyId: process.env.RAZORPAY_KEY_ID,
  };
}

export async function verifyPayment({
  razorpayOrderId,
  razorpayPaymentId,
  razorpaySignature,
  userId,
  couponCode,
}) {
  const expected = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest("hex");

  if (expected !== razorpaySignature) {
    await Payment.updateOne(
      { razorpayOrderId },
      { status: "failed", failureReason: "Signature mismatch" },
    );
    throw Object.assign(new Error("Payment verification failed"), {
      status: 400,
      code: "SIGNATURE_MISMATCH",
    });
  }

  const payment = await Payment.findOneAndUpdate(
    { razorpayOrderId },
    { razorpayPaymentId, razorpaySignature, status: "paid" },
    { new: true },
  );
  if (!payment)
    throw Object.assign(new Error("Payment record not found"), { status: 404 });

  const order = await Order.findByIdAndUpdate(
    payment.orderId,
    {},
    { new: true },
  );

  if (couponCode) {
    await couponSvc.apply({
      couponId: order.appliedCouponId,
      userId,
      orderId: order._id,
      discountApplied: order.couponDiscount || 0,
    });
  }

  await createPayoutForOrder(order); // writes PayoutLedger entry, held or settle-now per cook's schedule

  return { orderId: order._id, status: "paid" };
}
