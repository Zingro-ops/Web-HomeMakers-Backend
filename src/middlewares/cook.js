import { Cook } from "../models/Cook.js";

export async function requireCook(req, res, next) {
  if (req.user.role !== "homemaker") {
    return res
      .status(403)
      .json({ error: "This action requires a homemaker account" });
  }
  try {
    const cook = await Cook.findOneAndUpdate(
      { zingroUserId: req.user.id },
      { $setOnInsert: { zingroUserId: req.user.id, phone: req.user.phone } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    req.cookId = cook._id.toString();
    next();
  } catch (e) {
    next(e);
  }
}
