import { z } from "zod";

export const updateOrderStatusSchema = z.object({
  status: z.enum(["preparing", "ready", "completed", "rejected"]),
  readyPhoto: z.string().optional(),
});

export const listOrdersSchema = z.object({
  status: z
    .enum(["pending", "preparing", "ready", "completed", "rejected"])
    .optional(),
  orderType: z.enum(["quick", "prebooking"]).optional(),
  isCluster: z.coerce.boolean().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

