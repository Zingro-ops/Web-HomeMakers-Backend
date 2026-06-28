import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import { env } from "./config/env.js";
import authRoutes from "./routes/auth.routes.js";
import { notFound, errorHandler } from "./middlewares/error.js";
import onboardingRoutes from "./routes/onboarding.routes.js";

export function createApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use(cors({ origin: env.clientOrigin, credentials: true }));

  app.get("/api/health", (req, res) => res.json({ ok: true }));
  app.use("/api/auth", authRoutes);

  app.use("/api/onboarding", onboardingRoutes);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
