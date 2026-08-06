import { z } from "zod";

export const createDishSchema = z.object({
  name: z.string().trim().min(1).max(100),
  category: z.string().trim().min(1),
  categoryId: z.string().optional(),
  price: z.coerce.number().min(0).max(100000),
  desc: z.string().trim().max(500).optional().default(""),
  imageKey: z.string().min(5).optional(),
  spicyLevel: z.coerce.number().min(0).max(3).optional().default(0),
  discount: z.coerce.number().min(0).max(100).optional().default(0),
});

export const updateDishSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  category: z.string().trim().min(1).optional(),
  categoryId: z.string().optional(),
  price: z.coerce.number().min(0).max(100000).optional(),
  desc: z.string().trim().max(500).optional(),
  available: z.boolean().optional(),
  imageKey: z.string().min(5).optional(),
  spicyLevel: z.coerce.number().min(0).max(3).optional(),
  discount: z.coerce.number().min(0).max(100).optional(),
});
