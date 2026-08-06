import Address from "../models/Address.js";
import { Cook } from "../models/Cook.js";
import { Dish } from "../models/Dish.js";
import Category from "../models/Category.js";
import { Order } from "../models/Order.js";
import { isOpenNow } from "../utils/isOpenNow.js";

const PUBLIC_COOK_FIELDS =
  "personal.name food.cuisine food.category food.description status location ratingAvg ratingCount hours";

export async function getHome(customerId, { lat, lng, addressId } = {}) {
  let currentAddress = null;
  if (addressId) {
    currentAddress = await Address.findOne({
      _id: addressId,
      userId: customerId,
    }).lean();
  } else {
    currentAddress = await Address.findOne({
      userId: customerId,
      isDefault: true,
    }).lean();
  }

  const coords =
    currentAddress?.location?.coordinates ||
    (lat && lng ? [Number(lng), Number(lat)] : null);

  let nearbyKitchens = [];
  if (coords) {
    nearbyKitchens = await Cook.aggregate([
      {
        $geoNear: {
          near: { type: "Point", coordinates: coords },
          distanceField: "distanceMeters",
          maxDistance: 10000, // 10km
          spherical: true,
          query: { status: "approved" },
        },
      },
      { $limit: 10 },
      {
        $project: PUBLIC_COOK_FIELDS.split(" ").reduce(
          (acc, f) => ({ ...acc, [f]: 1 }),
          { distanceMeters: 1 },
        ),
      },
    ]);
  }

  const featuredKitchens = await Cook.find({ status: "approved" })
    .select(PUBLIC_COOK_FIELDS)
    .sort({ ratingAvg: -1 })
    .limit(6)
    .lean();

  const popularMeals = await Dish.find({ available: true })
    .select(
      "name category price desc tag image_s3_key ratingAvg ratingCount cookId",
    )
    .sort({ ratingCount: -1 })
    .limit(10)
    .lean();

  const categories = await Category.find({ isActive: true })
    .sort({ displayOrder: 1 })
    .lean();

  const trending = await Dish.find({ available: true })
    .select("name category price desc tag ratingAvg ratingCount cookId")
    .sort({ createdAt: -1 })
    .limit(10)
    .lean();

  let recentlyOrdered = [];
  if (customerId) {
    const recentOrders = await Order.find({ customerId, status: "completed" })
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();
    recentlyOrdered = recentOrders.map((o) => ({
      orderId: o._id,
      cookId: o.cookId,
      items: o.items,
      total: o.total,
      orderedAt: o.createdAt,
    }));
  }

  return {
    currentAddress,
    nearbyKitchens: nearbyKitchens.map((k) => ({
      ...k,
      isOpenNow: isOpenNow(k.hours),
    })),
    featuredKitchens: featuredKitchens.map((k) => ({
      ...k,
      isOpenNow: isOpenNow(k.hours),
    })),
    popularMeals,
    categories,
    offers: [], // stub â€” Offers module not built
    subscriptions: [], // stub â€” Subscriptions module not built
    recommended: [], // stub â€” needs a real recommendation strategy
    trending,
    communityBanner: [], // stub â€” Banner model not built
    promotionalBanner: [], // stub â€” Banner model not built
    quickFilters: ["veg", "non-veg", "rating 4+", "under Rs 200"], // static for now
    recentlyOrdered,
    continueSubscription: null, // stub - Subscriptions not built
  };
}



