import { z } from "zod";

export const createDishSchema = z.object({
  name: z.string().trim().min(1).max(100),
  category: z.string().trim().min(1),
  price: z.coerce.number().min(0).max(100000),
  desc: z.string().trim().max(500).optional().default(""),
  imageKey: z.string().min(5).optional(),
});

export const updateDishSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  category: z.string().trim().min(1).optional(),
  price: z.coerce.number().min(0).max(100000).optional(),
  desc: z.string().trim().max(500).optional(),
  available: z.boolean().optional(),
  imageKey: z.string().min(5).optional(),
});
