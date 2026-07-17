import { Order } from "../models/Order.js";

const ACTIVITY_META = {
  pending: {
    icon: "shopping_basket",
    fill: false,
    title: "New order received",
  },
  preparing: { icon: "outdoor_grill", fill: false, title: "Order accepted" },
  ready: {
    icon: "local_shipping",
    fill: false,
    title: "Order ready for pickup",
  },
  completed: { icon: "check_circle", fill: true, title: "Order completed" },
  rejected: { icon: "cancel", fill: false, title: "Order rejected" },
};

function timeAgo(date) {
  const mins = Math.floor((Date.now() - new Date(date).getTime()) / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export async function getDashboardStats(cookId) {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [todayOrders, monthOrders, recent] = await Promise.all([
    Order.countDocuments({ cookId, createdAt: { $gte: startOfDay } }),
    Order.find({
      cookId,
      status: "completed",
      createdAt: { $gte: startOfMonth },
    }).select("total"),
    Order.find({ cookId }).sort({ updatedAt: -1 }).limit(5).lean(),
  ]);

  const monthEarnings = monthOrders.reduce((sum, o) => sum + o.total, 0);

  const recentActivity = recent.map((o) => {
    const meta = ACTIVITY_META[o.status] || ACTIVITY_META.pending;
    return {
      icon: meta.icon,
      fill: meta.fill,
      title: meta.title,
      sub: `${o.customerName || "Customer"} · ₹${o.total}`,
      time: timeAgo(o.updatedAt),
      orderId: o._id,
    };
  });

  return { todayOrders, monthEarnings, recentActivity };
}
