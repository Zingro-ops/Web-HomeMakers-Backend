import { z } from "zod";

const recipeSchema = z.object({
  ingredients: z
    .array(z.string().trim().min(1))
    .min(1, "Add at least one ingredient"),
  steps: z
    .array(z.string().trim().min(1))
    .min(1, "Add at least one preparation step"),
});

export const createDishSchema = z.object({
  name: z.string().trim().min(1).max(100),
  category: z.string().trim().min(1),
  categoryId: z.string().optional(),
  price: z.coerce.number().min(0).max(100000),
  desc: z.string().trim().max(500).optional().default(""),
  tag: z.enum(["veg", "non-veg"]),
  recipe: recipeSchema,
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
  tag: z.enum(["veg", "non-veg"]).optional(),
  recipe: recipeSchema.optional(),
  available: z.boolean().optional(),
  imageKey: z.string().min(5).optional(),
  spicyLevel: z.coerce.number().min(0).max(3).optional(),
  discount: z.coerce.number().min(0).max(100).optional(),
});
