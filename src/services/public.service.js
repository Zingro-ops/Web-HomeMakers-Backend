import { Cook } from "../models/Cook.js";
import { Dish } from "../models/Dish.js";
import { isOpenNow } from "../utils/isOpenNow.js";
import { presignGet } from "./s3.service.js";

const PUBLIC_COOK_FIELDS =
  "personal.name food.cuisine food.category food.description food.radius photos.gps status location ratingAvg ratingCount hours";

export async function listCooks({
  lat,
  lng,
  radiusKm,
  cuisine,
  category,
  page,
  limit,
}) {
  const filter = { status: "approved" };
  if (cuisine) filter["food.cuisine"] = cuisine;
  if (category) filter["food.category"] = category;

  if (lat != null && lng != null) {
    const pipeline = [
      {
        $geoNear: {
          near: { type: "Point", coordinates: [lng, lat] },
          distanceField: "distanceMeters",
          maxDistance: radiusKm * 1000,
          spherical: true,
          query: filter,
        },
      },
      {
        $project: PUBLIC_COOK_FIELDS.split(" ").reduce(
          (acc, f) => ({ ...acc, [f]: 1 }),
          { distanceMeters: 1 },
        ),
      },
      { $skip: (page - 1) * limit },
      { $limit: limit },
    ];
    const items = await Cook.aggregate(pipeline);
    const total = await Cook.countDocuments(filter);
    return { items, total, page, limit };
  }

  const [items, total] = await Promise.all([
    Cook.find(filter)
      .select(PUBLIC_COOK_FIELDS)
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Cook.countDocuments(filter),
  ]);
  return { items, total, page, limit };
}

export async function getCookMenu(cookId) {
  const cook = await Cook.findOne({ _id: cookId, status: "approved" }).select(
    PUBLIC_COOK_FIELDS,
  );
  if (!cook) throw Object.assign(new Error("Cook not found"), { status: 404 });

  const dishes = await Dish.find({ cookId, available: true })
    .select("name category categoryId price desc tag image_s3_key ratingAvg ratingCount spicyLevel discount")
    .populate("categoryId", "mealType name")
    .lean();

  const withUrls = await Promise.all(
    dishes.map(async (d) => {
      if (d.image_s3_key) d.imageUrl = await presignGet(d.image_s3_key);
      delete d.image_s3_key;
      return d;
    }),
  );

  const grouped = {};
  for (const d of withUrls) {
    const mealType = d.categoryId?.mealType || "uncategorized";
    if (!grouped[mealType]) grouped[mealType] = [];
    grouped[mealType].push(d);
  }

  return { cook: { ...cook.toObject(), isOpenNow: isOpenNow(cook.hours) }, menu: grouped };
}

export async function listCuisines() {
  return Cook.distinct("food.cuisine", { status: "approved" });
}




