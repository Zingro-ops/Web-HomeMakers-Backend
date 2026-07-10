import { Cook } from "../models/Cook.js";

export async function me(req, res, next) {
  try {
    let cook = await Cook.findOne({ zingroUserId: req.user.id });

    if (!cook) {
      cook = await Cook.create({
        zingroUserId: req.user.id,
        phone: req.user.phone,
      });
    }

    res.json({
      id: cook._id,
      zingroUserId: cook.zingroUserId,
      phone: cook.phone,
      status: cook.status,
      currentStep: cook.currentStep,
      name: cook.personal?.name,
    });
  } catch (e) {
    next(e);
  }
}
