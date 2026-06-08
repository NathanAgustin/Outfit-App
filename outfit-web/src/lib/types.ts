export type ClothingCategory = "tops" | "bottoms" | "shoes" | "accessories";

export const CLOTHING_CATEGORIES: { value: ClothingCategory; label: string }[] = [
  { value: "tops", label: "Tops" },
  { value: "bottoms", label: "Bottoms" },
  { value: "shoes", label: "Shoes" },
  { value: "accessories", label: "Accessories" },
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
  top_id: string;
  bottom_id: string;
  shoes_id: string;
  accessory_ids: string[];
  preview_image_path: string | null;
  date_modified: string;
};

export function displayName(name: string): string {
  return name.trim() || "Unnamed Item";
}
