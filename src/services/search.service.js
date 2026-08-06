import { Dish } from "../models/Dish.js";
import { Cook } from "../models/Cook.js";

export async function search({
  q,
  category,
  veg,
  rating,
  price,
  sort,
  page = 1,
  limit = 20,
}) {
  const dishFilter = { available: true };
  const cookFilter = { status: "approved" };

  if (q) {
    dishFilter.$text = { $search: q };
    cookFilter.$text = { $search: q };
  }
  if (category) dishFilter.category = category;
  if (veg !== undefined) dishFilter.tag = veg === "true" ? "veg" : "non-veg";
  if (rating) {
    dishFilter.ratingAvg = { $gte: Number(rating) };
    cookFilter.ratingAvg = { $gte: Number(rating) };
  }
  if (price) {
    const [min, max] = price.split("-").map(Number);
    dishFilter.price = { $gte: min || 0, ...(max && { $lte: max }) };
  }

  const sortMap = {
    price: { price: 1 },
    rating: { ratingAvg: -1 },
    newest: { createdAt: -1 },
  };
  const dishSort =
    sortMap[sort] ||
    (q ? { score: { $meta: "textScore" } } : { createdAt: -1 });

  const skip = (Number(page) - 1) * Number(limit);

  const dishQuery = Dish.find(
    dishFilter,
    q ? { score: { $meta: "textScore" } } : {},
  )
    .sort(dishSort)
    .skip(skip)
    .limit(Number(limit));

  const [dishes, dishTotal, cooks, cookTotal] = await Promise.all([
    dishQuery,
    Dish.countDocuments(dishFilter),
    Cook.find(cookFilter).select("personal.name food.cuisine food.category food.description status location ratingAvg ratingCount").limit(10),
    Cook.countDocuments(cookFilter),
  ]);

  return {
    dishes: {
      items: dishes,
      total: dishTotal,
      page: Number(page),
      limit: Number(limit),
    },
    cooks: { items: cooks, total: cookTotal },
  };
}

