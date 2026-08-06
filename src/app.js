import express from "express";
import mongoose from "mongoose";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";
import cors from "cors";
import { env } from "./config/env.js";
import authRoutes from "./routes/auth.routes.js";
import { notFound, errorHandler } from "./middlewares/error.js";
import onboardingRoutes from "./routes/onboarding.routes.js";
import uploadRoutes from "./routes/uploads.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import menuRoutes from "./routes/menu.routes.js";
import publicRoutes from "./routes/public.routes.js";
import orderRoutes from "./routes/order.routes.js";
import cookOrdersRoutes from "./routes/cookOrders.routes.js";
import cookHoursRoutes from "./routes/cookHours.routes.js";
import dashboardRoutes from "./routes/dashboard.routes.js";
import profileRoutes from "./routes/profile.routes.js";
import cartRoutes from "./routes/cart.routes.js";
import addressRoutes from "./routes/address.routes.js";
import categoryRoutes from "./routes/category.routes.js";
import couponRoutes from "./routes/coupon.routes.js";
import checkoutRoutes from "./routes/checkout.routes.js";
import reviewRoutes from "./routes/review.routes.js";
import wishlistRoutes from "./routes/wishlist.routes.js";
import searchRoutes from "./routes/search.routes.js";
import homeRoutes from "./routes/home.routes.js";
import deliveryTrackingRoutes from "./routes/deliveryTracking.routes.js";
import paymentRoutes from "./routes/payment.routes.js";
import payoutRoutes from "./routes/payout.routes.js";
export function createApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 300, standardHeaders: true, legacyHeaders: false, message: { success: false, message: "Too many requests, please try again later.", code: "RATE_LIMITED" } }));
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || env.clientOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error("Not allowed by CORS"));
        }
      },
      credentials: true,
    }),
  );

  app.get("/api/health", (req, res) => res.json({ ok: true, dbConnected: mongoose.connection.readyState === 1, uptime: process.uptime() }));
  app.use("/api/auth", authRoutes);

  app.use("/api/onboarding", onboardingRoutes);
  app.use("/api/uploads", uploadRoutes);

  app.use("/api/admin", adminRoutes);

  app.use("/api/menu", menuRoutes);
  app.use("/api/public", publicRoutes);
  app.use("/api/orders", orderRoutes);
  app.use("/api/cook/orders", cookOrdersRoutes);
  app.use("/api/cook/hours", cookHoursRoutes);
  app.use("/api/dashboard", dashboardRoutes);
  app.use("/api/profile", profileRoutes);
  app.use("/api/cart", cartRoutes);
  app.use("/api/v1/addresses", addressRoutes);
  app.use("/api/v1/categories", categoryRoutes);
  app.use("/api/v1/coupons", couponRoutes);
  app.use("/api/v1/checkout", checkoutRoutes);
  app.use("/api/v1/reviews", reviewRoutes);
  app.use("/api/v1/wishlist", wishlistRoutes);
  app.use("/api/v1/search", searchRoutes);
  app.use("/api/v1/home", homeRoutes);
  app.use("/api/v1/delivery", deliveryTrackingRoutes);
  app.use("/api/v1/payment", paymentRoutes); // customer-facing
  app.use("/api/cook/payouts", payoutRoutes); // homemaker-facing, matches your existing /api/cook/* convention

  app.use(notFound);
  app.use(errorHandler);
  return app;
}











