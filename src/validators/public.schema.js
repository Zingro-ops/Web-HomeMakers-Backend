import { z } from "zod";

export const nearbyCooksSchema = z.object({
  lat: z.coerce.number().optional(),
  lng: z.coerce.number().optional(),
  radiusKm: z.coerce.number().min(1).max(50).default(10),
  cuisine: z.string().trim().optional(),
  category: z
    .enum(["Vegetarian", "Non-Vegetarian", "Both", "Vegan"])
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
