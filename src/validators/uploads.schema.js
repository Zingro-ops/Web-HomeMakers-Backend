import { z } from "zod";

export const presignSchema = z.object({
  type: z.enum(["kitchen", "profile", "dish"]),
  contentType: z.enum(["image/jpeg", "image/png"]),
});

export const confirmSchema = z.object({
  type: z.enum(["kitchen", "profile"]),
  key: z.string().min(5),
});
