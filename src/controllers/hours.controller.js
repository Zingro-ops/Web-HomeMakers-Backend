import { z } from "zod";
import { Cook } from "../models/Cook.js";
import { ok, fail } from "../utils/apiResponse.js";

const dayShape = z.object({
  open: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .nullable()
    .optional(),
  close: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .nullable()
    .optional(),
  closed: z.boolean().optional(),
});
const hoursSchema = z.object({
  monday: dayShape.optional(),
  tuesday: dayShape.optional(),
  wednesday: dayShape.optional(),
  thursday: dayShape.optional(),
  friday: dayShape.optional(),
  saturday: dayShape.optional(),
  sunday: dayShape.optional(),
});

export const updateHours = async (req, res) => {
  try {
    const dto = hoursSchema.parse(req.body);
    const cook = await Cook.findByIdAndUpdate(
      req.cookId,
      { $set: { hours: dto } },
      { new: true },
    );
    ok(res, cook.hours, "Hours updated");
  } catch (e) {
    if (e instanceof z.ZodError)
      return fail(res, "Validation failed", 400, "VALIDATION");
    fail(res, e.message || "Server error", e.status || 500);
  }
};

export const getHours = async (req, res) => {
  try {
    const cook = await Cook.findById(req.cookId);
    ok(res, cook.hours, "Hours fetched");
  } catch (e) {
    fail(res, e.message || "Server error", e.status || 500);
  }
};
