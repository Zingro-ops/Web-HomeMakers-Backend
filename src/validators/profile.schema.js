import { z } from "zod";

export const clusterSettingsSchema = z.object({
  enabled: z.boolean(),
  minQty: z.number().int().min(5).max(1000),
  discountPercent: z.number().min(0).max(50),
});
