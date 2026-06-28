import dotenv from "dotenv";
dotenv.config();

const required = ["MONGO_URI", "JWT_SECRET"];
for (const k of required) {
  if (!process.env[k]) throw new Error(`Missing env: ${k}`);
}

export const env = {
  port: Number(process.env.PORT) || 5000,
  nodeEnv: process.env.NODE_ENV || "development",
  isProd: process.env.NODE_ENV === "production",
  mongoUri: process.env.MONGO_URI,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpires: process.env.JWT_EXPIRES || "7d",
  cookieDomain: process.env.COOKIE_DOMAIN || "localhost",
  clientOrigin: process.env.CLIENT_ORIGIN || "http://localhost:5173",
  otpMock: process.env.OTP_MOCK || "123456",
};
