import { CustomerProfile } from "../models/CustomerProfile.js";

export async function get(customerId) {
  const profile = await CustomerProfile.findOne({ customerId });
  return profile || { customerId, dietaryType: null, allergies: [] };
}

export async function upsert(customerId, dto) {
  return CustomerProfile.findOneAndUpdate(
    { customerId },
    { $set: dto },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
}
