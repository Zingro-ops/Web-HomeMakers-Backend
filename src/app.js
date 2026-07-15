import express from "express";
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

export function createApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use(cors({ origin: env.clientOrigin, credentials: true }));

  app.get("/api/health", (req, res) => res.json({ ok: true }));
  app.use("/api/auth", authRoutes);

  app.use("/api/onboarding", onboardingRoutes);
  app.use("/api/uploads", uploadRoutes);

  app.use("/api/admin", adminRoutes);

  app.use("/api/menu", menuRoutes);
  app.use("/api/public", publicRoutes);
  app.use("/api/orders", orderRoutes);
  app.use("/api/cook/orders", cookOrdersRoutes);
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
