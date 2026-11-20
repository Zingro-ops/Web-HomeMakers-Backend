import { Payment } from "../models/Payment.js";
import { razorpay } from "./razorpay.client.js";

/**
 * Customer-facing payment + refund state for an order, derived ONLY from what
 * the server actually knows. Nothing here predicts or promises an outcome.
 *
 * payment.status
 *   not_started       no payment record (legacy unpaid order)
 *   awaiting_payment  Razorpay order created, no verified payment yet
 *   paid              signature verified server-side
 *   failed            verification failed
 *
 * payment.refund.status
 *   none       nothing to refund (order not cancelled, or never paid)
 *   pending    order cancelled/rejected after payment, but NO refund has been
 *              started yet (e.g. kitchen rejection — refunds for that are not
 *              automated yet; support must act)
 *   initiated  refund created at Razorpay; bank has not confirmed it
 *   completed  Razorpay reports the refund processed
 *   failed     Razorpay reports the refund failed
 */
const CANCELLED_STATUSES = new Set(["rejected"]);

const REFUND_FROM_DB = {
  initiated: "initiated",
  processed: "completed",
  failed: "failed",
};

export function summarizePayment(order, payment) {
  if (!payment) {
    return { status: "not_started", amount: null, refund: { status: "none" } };
  }

  const base = {
    amount: payment.amount,
    currency: payment.currency || "INR",
  };

  if (payment.status === "created") {
    return { ...base, status: "awaiting_payment", refund: { status: "none" } };
  }
  if (payment.status === "failed") {
    return { ...base, status: "failed", refund: { status: "none" } };
  }

  // paid, or legacy "refunded" (which only ever meant "refund requested").
  let refundStatus = "none";
  if (payment.refundId) {
    refundStatus = REFUND_FROM_DB[payment.refundStatus] ?? "initiated";
  } else if (CANCELLED_STATUSES.has(order.status)) {
    refundStatus = "pending";
  }

  return {
    ...base,
    status: "paid",
    refund: {
      status: refundStatus,
      ...(payment.refundId && {
        amount: payment.refundAmount ?? payment.amount,
        reference: payment.refundId,
        initiatedAt: payment.refundInitiatedAt ?? null,
        completedAt: payment.refundProcessedAt ?? null,
      }),
    },
  };
}

const RAZORPAY_REFUND_TO_DB = {
  pending: "initiated",
  processed: "processed",
  failed: "failed",
};

/**
 * Asks Razorpay for the current state of an initiated refund and persists it.
 * Best-effort with a hard timeout: on any error the stored state is kept and
 * the customer sees "initiated", which is still true.
 */
export async function refreshRefundIfInFlight(payment, { timeoutMs = 3000 } = {}) {
  if (!payment?.refundId || !payment.razorpayPaymentId) return payment;
  if (!["none", "initiated"].includes(payment.refundStatus ?? "none")) return payment;

  let timer;
  try {
    const refund = await Promise.race([
      razorpay.payments.fetchRefund(payment.razorpayPaymentId, payment.refundId),
      new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(new Error("refund fetch timeout")),
          timeoutMs,
        );
      }),
    ]);
    const next = RAZORPAY_REFUND_TO_DB[refund?.status];
    if (next && next !== payment.refundStatus) {
      payment.refundStatus = next;
      if (next === "processed") payment.refundProcessedAt = new Date();
      await payment.save();
    }
  } catch (e) {
    console.warn(`Refund status refresh failed for payment ${payment._id}: ${e.message}`);
  } finally {
    clearTimeout(timer);
  }
  return payment;
}

/** Latest payment per order id, for list views (one query, no gateway calls). */
export async function latestPaymentsByOrder(orderIds) {
  const payments = await Payment.find({ orderId: { $in: orderIds } }).sort({
    createdAt: 1,
  });
  const map = new Map();
  for (const p of payments) map.set(String(p.orderId), p); // later wins
  return map;
}
