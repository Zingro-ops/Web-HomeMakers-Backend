/**
 * Response for endpoints that used to create orders without payment.
 *
 * 410 Gone (not 404) so an outdated client gets an explicit, stable code it
 * can show as "please update the app", and so monitoring can tell a removed
 * capability apart from a typo'd path. No order is ever created here.
 */
export function paymentRequiredGone(req, res) {
  console.warn(
    `[security] blocked unpaid-order endpoint user=${req.user?.id ?? "-"} ${req.method} ${req.originalUrl}`,
  );
  res.status(410).json({
    success: false,
    code: "ENDPOINT_REMOVED_PAYMENT_REQUIRED",
    message:
      "Orders can only be placed with payment. Please update the app and try again.",
  });
}
