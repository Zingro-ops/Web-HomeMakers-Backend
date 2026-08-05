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

export const checkoutSchema = z.object({
  orderType: z.enum(["quick", "prebooking"]).default("quick"),
  scheduledFor: z.coerce.date().optional(),
  deliveryAddress: z.object({
    building: z.string().trim().min(1),
    locality: z.string().trim().min(1),
    pincode: z.string().regex(/^\d{6}$/),
  }),
  customerName: z.string().trim().max(100).optional(),
  notes: z.string().trim().max(300).optional().default(""),
});
