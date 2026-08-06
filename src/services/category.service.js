import Category from "../models/Category.js";

const slugify = (s) =>
  s
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

export async function list({ mealType, page = 1, limit = 20 } = {}) {
  const q = { isActive: true };
  if (mealType) q.mealType = mealType;
  const skip = (Number(page) - 1) * Number(limit);
  const [items, total] = await Promise.all([
    Category.find(q)
      .sort({ displayOrder: 1, name: 1 })
      .skip(skip)
      .limit(Number(limit)),
    Category.countDocuments(q),
  ]);
  return { items, total, page: Number(page), limit: Number(limit) };
}

export async function create(dto) {
  const slug = slugify(dto.name);
  const exists = await Category.findOne({
    $or: [{ name: dto.name }, { slug }],
  });
  if (exists)
    throw Object.assign(new Error("Category already exists"), { status: 409 });
  return Category.create({ ...dto, slug });
}

export async function update(id, dto) {
  const cat = await Category.findById(id);
  if (!cat)
    throw Object.assign(new Error("Category not found"), { status: 404 });
  if (dto.name) dto.slug = slugify(dto.name);
  Object.assign(cat, dto);
  return cat.save();
}

export async function remove(id) {
  const cat = await Category.findByIdAndUpdate(
    id,
    { isActive: false },
    { new: true },
  );
  if (!cat)
    throw Object.assign(new Error("Category not found"), { status: 404 });
  return cat;
}
