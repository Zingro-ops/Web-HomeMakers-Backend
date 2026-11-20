import { z } from "zod";

export const addItemSchema = z.object({
  cookId: z.string().min(1),
  dishId: z.string().min(1),
  qty: z.number().int().min(1).default(1),
  replace: z.boolean().optional().default(false),
});

export const updateItemSchema = z.object({
  qty: z.number().int().min(1),
});
