import { CLOTHING_CATEGORIES, ClothingCategory } from "@/lib/types";

export const DEFAULT_CATEGORY_ORDER: ClothingCategory[] = CLOTHING_CATEGORIES.map(
  (category) => category.value
);

export const CATEGORY_ORDER_STORAGE_KEY = "wardrobe_category_order_v1";

export function normalizeCategoryOrder(order: unknown): ClothingCategory[] {
  const valid = new Set(DEFAULT_CATEGORY_ORDER);
  const cleaned: ClothingCategory[] = [];

  if (Array.isArray(order)) {
    for (const value of order) {
      if (typeof value === "string" && valid.has(value as ClothingCategory)) {
        const category = value as ClothingCategory;
        if (!cleaned.includes(category)) cleaned.push(category);
      }
    }
  }

  for (const category of DEFAULT_CATEGORY_ORDER) {
    if (!cleaned.includes(category)) cleaned.push(category);
  }

  return cleaned;
}

export function categoryLabel(category: ClothingCategory): string {
  return CLOTHING_CATEGORIES.find((entry) => entry.value === category)?.label ?? category;
}

export function slotLabel(category: ClothingCategory): string {
  switch (category) {
    case "tops":
      return "Top";
    case "bottoms":
      return "Bottom";
    case "dresses":
      return "Dress";
    case "outerwear":
      return "Outerwear";
    case "shoes":
      return "Shoes";
    case "accessories":
      return "Accessories";
    default:
      return category;
  }
}
