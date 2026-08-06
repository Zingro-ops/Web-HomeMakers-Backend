import { Order } from "../models/Order.js";

const DELIVERY_TRANSITIONS = {
  ready: ["delivery_assigned"],
  delivery_assigned: ["picked_up"],
  picked_up: ["out_for_delivery"],
  out_for_delivery: ["delivered"],
};

const EVENT_TO_STATUS = {
  assigned: "delivery_assigned",
  picked_up: "picked_up",
  out_for_delivery: "out_for_delivery",
  delivered: "delivered",
};

export async function handleCourierWebhook({
  orderId,
  event,
  partner,
  timestamp,
}) {
  const status = EVENT_TO_STATUS[event];
  if (!status)
    throw Object.assign(new Error(`Unknown event: ${event}`), {
      status: 400,
      code: "UNKNOWN_EVENT",
    });

  const order = await Order.findById(orderId);
  if (!order)
    throw Object.assign(new Error("Order not found"), { status: 404 });

  const allowed = DELIVERY_TRANSITIONS[order.status] || [];
  if (!allowed.includes(status)) {
    throw Object.assign(
      new Error(`Cannot move order from ${order.status} to ${status}`),
      { status: 409, code: "INVALID_TRANSITION" },
    );
  }

  order.status = status;
  if (partner) {
    order.deliveryPartner = {
      name: partner.name || order.deliveryPartner?.name || null,
      phone: partner.phone || order.deliveryPartner?.phone || null,
      trackingId:
        partner.trackingId || order.deliveryPartner?.trackingId || null,
    };
  }
  await order.save();
  return order;
}

export async function getTrackingStatus(customerId, orderId) {
  const order = await Order.findOne({ _id: orderId, customerId }).select(
    "status deliveryPartner createdAt updatedAt",
  );
  if (!order)
    throw Object.assign(new Error("Order not found"), { status: 404 });
  return order;
}
