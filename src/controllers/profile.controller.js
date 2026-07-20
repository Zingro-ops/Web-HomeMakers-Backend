import { getMyProfile } from "../services/profile.service.js";

export async function me(req, res, next) {
  try {
    res.json(await getMyProfile(req.cookId));
  } catch (e) {
    next(e);
  }
}

export async function updateCluster(req, res, next) {
  try {
    const data = clusterSettingsSchema.parse(req.body);
    res.json(await updateClusterSettings(req.cookId, data));
  } catch (e) {
    next(e);
  }
}
