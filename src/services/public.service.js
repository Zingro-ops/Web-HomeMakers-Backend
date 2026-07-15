import { Cook } from "../models/Cook.js";
import { Dish } from "../models/Dish.js";
import { distanceMeters } from "../utils/geo.js";
import { presignGet } from "./s3.service.js";

const PUBLIC_COOK_FIELDS =
  "personal.name food.cuisine food.category food.description food.radius photos.gps status";

export async function listCooks({ lat, lng, radiusKm, page, limit }) {
  const cooks = await Cook.find({ status: "approved" })
    .select(PUBLIC_COOK_FIELDS)
    .lean();

  let filtered = cooks;
  if (lat != null && lng != null) {
    filtered = cooks
      .map((c) => {
        const gps = c.photos?.gps;
        if (!gps?.lat) return { ...c, distanceMeters: null };
        return { ...c, distanceMeters: distanceMeters({ lat, lng }, gps) };
      })
      .filter(
        (c) => c.distanceMeters == null || c.distanceMeters <= radiusKm * 1000,
      )
      .sort(
        (a, b) =>
          (a.distanceMeters ?? Infinity) - (b.distanceMeters ?? Infinity),
      );
  }

  const start = (page - 1) * limit;
  return {
    items: filtered.slice(start, start + limit),
    total: filtered.length,
    page,
    limit,
  };
}

export async function getCookMenu(cookId) {
  const cook = await Cook.findOne({ _id: cookId, status: "approved" }).select(
    PUBLIC_COOK_FIELDS,
  );
  if (!cook) throw Object.assign(new Error("Cook not found"), { status: 404 });

  const dishes = await Dish.find({ cookId, available: true })
    .select("name category price desc tag image_s3_key")
    .lean();

  const withUrls = await Promise.all(
    dishes.map(async (d) => {
      if (d.image_s3_key) d.imageUrl = await presignGet(d.image_s3_key);
      delete d.image_s3_key;
      return d;
    }),
  );

  return { cook, dishes: withUrls };
}
