import { z } from "zod";

export const presignSchema = z.object({
  type: z.enum(["kitchen", "profile", "dish", "orderReady"]),
  contentType: z.enum(["image/jpeg", "image/png"]),
});

export const confirmSchema = z.object({
  type: z.enum(["kitchen", "profile", "orderReady", "dish"]),
  key: z.string().min(5),
});
