import { z } from "zod";

export const createOrderSchema = z
  .object({
    cookId: z.string().min(1),
    orderType: z.enum(["quick", "prebooking"]).default("quick"),
    items: z
      .array(
        z.object({ dishId: z.string().min(1), qty: z.number().int().min(1) }),
      )
      .min(1),
    scheduledFor: z.coerce.date().optional(),
    deliveryAddress: z.object({
      building: z.string().trim().min(1),
      locality: z.string().trim().min(1),
      pincode: z.string().regex(/^\d{6}$/),
    }),
    customerName: z.string().trim().max(100).optional(),
    notes: z.string().trim().max(300).optional().default(""),
  })
  .superRefine((data, ctx) => {
    if (data.orderType === "prebooking") {
      if (!data.scheduledFor) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["scheduledFor"],
          message: "scheduledFor is required for pre-booking orders.",
        });
      } else if (data.scheduledFor.getTime() <= Date.now() + 60 * 60 * 1000) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["scheduledFor"],
          message: "scheduledFor must be at least 1 hour in the future.",
        });
      }
    }
  });

export const updateOrderStatusSchema = z.object({
  status: z.enum(["preparing", "ready", "completed", "rejected"]),
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
