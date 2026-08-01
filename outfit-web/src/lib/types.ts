export type ClothingCategory =
  | "tops"
  | "bottoms"
  | "dresses"
  | "outerwear"
  | "shoes"
  | "accessories";

export type OutfitSlotKey = "top_id" | "bottom_id" | "dress_id" | "outerwear_id" | "shoes_id";

export const CLOTHING_CATEGORIES: { value: ClothingCategory; label: string }[] = [
  { value: "tops", label: "Tops" },
  { value: "bottoms", label: "Bottoms" },
  { value: "dresses", label: "Dresses" },
  { value: "outerwear", label: "Outerwear" },
  { value: "shoes", label: "Shoes" },
  { value: "accessories", label: "Accessories" },
];

/** Main outfit slots shown in Browse (accessories stay multi-select). */
export const OUTFIT_SLOT_CATEGORIES: {
  value: Exclude<ClothingCategory, "accessories">;
  label: string;
  outfitKey: OutfitSlotKey;
}[] = [
  { value: "tops", label: "Top", outfitKey: "top_id" },
  { value: "bottoms", label: "Bottom", outfitKey: "bottom_id" },
  { value: "dresses", label: "Dress", outfitKey: "dress_id" },
  { value: "outerwear", label: "Outerwear", outfitKey: "outerwear_id" },
  { value: "shoes", label: "Shoes", outfitKey: "shoes_id" },
];

export type ClothingItem = {
  id: string;
  user_id: string;
  name: string;
  category: ClothingCategory;
  image_path: string;
  created_at: string;
};

export type SavedOutfit = {
  id: string;
  user_id: string;
  name: string;
  top_id: string | null;
  bottom_id: string | null;
  dress_id: string | null;
  outerwear_id: string | null;
  shoes_id: string | null;
  accessory_ids: string[];
  preview_image_path: string | null;
  date_modified: string;
};

export type Capsule = {
  id: string;
  user_id: string;
  name: string;
  cover_image_path: string | null;
  sort_order: number;
  created_at: string;
};

export type CapsuleOutfit = {
  capsule_id: string;
  outfit_id: string;
  sort_order: number;
};

export function displayName(name: string): string {
  return name.trim() || "Unnamed Item";
}

export function countOutfitPieces(selection: {
  topId: string | null;
  bottomId: string | null;
  dressId: string | null;
  outerwearId: string | null;
  shoesId: string | null;
  accessoryIds: string[];
}): number {
  let count = 0;
  if (selection.topId) count += 1;
  if (selection.bottomId) count += 1;
  if (selection.dressId) count += 1;
  if (selection.outerwearId) count += 1;
  if (selection.shoesId) count += 1;
  count += selection.accessoryIds.length;
  return count;
}
