import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

export const signToken = (payload) =>
  jwt.sign(payload, env.jwtSecret, { expiresIn: env.jwtExpires });

export const verifyToken = (token) => jwt.verify(token, env.jwtSecret);

export const cookieOpts = () => ({
  httpOnly: true,
  secure: env.isProd,
  sameSite: env.isProd ? "none" : "lax",
  domain: env.cookieDomain,
  maxAge: 7 * 24 * 60 * 60 * 1000,
});
