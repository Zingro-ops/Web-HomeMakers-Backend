import Address from "../models/Address.js";
import { geocode } from "./geocode.service.js";

async function resolveCoords({ placeId, line1, city, state, pincode }) {
  const address = [line1, city, state, pincode].filter(Boolean).join(", ");
  const g = await geocode({ placeId, address });
  return { placeId: g.placeId, location: { type: "Point", coordinates: [g.lng, g.lat] } };
}

async function unsetDefaults(userId, exceptId = null) {
  const q = { userId, isDefault: true };
  if (exceptId) q._id = { $ne: exceptId };
  await Address.updateMany(q, { $set: { isDefault: false } });
}

export async function list(userId) {
  return Address.find({ userId }).sort({ isDefault: -1, updatedAt: -1 });
}

export async function create(userId, dto) {
  const geo = await resolveCoords(dto);
  const count = await Address.countDocuments({ userId });
  const isDefault = dto.isDefault || count === 0;
  if (isDefault) await unsetDefaults(userId);
  return Address.create({ ...dto, ...geo, userId, isDefault });
}

export async function update(userId, id, dto) {
  const addr = await Address.findOne({ _id: id, userId });
  if (!addr) throw Object.assign(new Error("Address not found"), { status: 404 });
  const geoChanged = dto.placeId || dto.line1 || dto.city || dto.state || dto.pincode;
  const geo = geoChanged ? await resolveCoords({ ...addr.toObject(), ...dto }) : {};
  if (dto.isDefault) await unsetDefaults(userId, id);
  Object.assign(addr, dto, geo);
  return addr.save();
}

export async function remove(userId, id) {
  const addr = await Address.findOneAndDelete({ _id: id, userId });
  if (!addr) throw Object.assign(new Error("Address not found"), { status: 404 });
  if (addr.isDefault) {
    const next = await Address.findOne({ userId }).sort({ updatedAt: -1 });
    if (next) { next.isDefault = true; await next.save(); }
  }
  return addr;
}

export async function setDefault(userId, id) {
  const addr = await Address.findOne({ _id: id, userId });
  if (!addr) throw Object.assign(new Error("Address not found"), { status: 404 });
  await unsetDefaults(userId, id);
  addr.isDefault = true;
  return addr.save();
}
