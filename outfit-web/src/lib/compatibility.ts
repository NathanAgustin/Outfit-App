import { ClothingCategory, ClothingItem, SavedOutfit } from "@/lib/types";

export type CompatibilityFocus = Exclude<ClothingCategory, "accessories">;

export type CompatibilityMatches = {
  tops: ClothingItem[];
  bottoms: ClothingItem[];
  dresses: ClothingItem[];
  outerwear: ClothingItem[];
  shoes: ClothingItem[];
  accessories: ClothingItem[];
};

function uniqueById(items: ClothingItem[]): ClothingItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

function outfitContainsItem(outfit: SavedOutfit, item: ClothingItem): boolean {
  if (item.category === "tops") return outfit.top_id === item.id;
  if (item.category === "bottoms") return outfit.bottom_id === item.id;
  if (item.category === "dresses") return outfit.dress_id === item.id;
  if (item.category === "outerwear") return outfit.outerwear_id === item.id;
  if (item.category === "shoes") return outfit.shoes_id === item.id;
  if (item.category === "accessories") return (outfit.accessory_ids ?? []).includes(item.id);
  return false;
}

/**
 * Given a selected clothing piece, find all other pieces that have appeared
 * with it in at least one saved outfit.
 */
export function getCompatibilityMatches(
  selected: ClothingItem,
  outfits: SavedOutfit[],
  allItems: ClothingItem[]
): CompatibilityMatches {
  const byId = new Map(allItems.map((item) => [item.id, item]));
  const related = outfits.filter((outfit) => outfitContainsItem(outfit, selected));

  const tops: ClothingItem[] = [];
  const bottoms: ClothingItem[] = [];
  const dresses: ClothingItem[] = [];
  const outerwear: ClothingItem[] = [];
  const shoes: ClothingItem[] = [];
  const accessories: ClothingItem[] = [];

  for (const outfit of related) {
    if (selected.category !== "tops" && outfit.top_id) {
      const top = byId.get(outfit.top_id);
      if (top) tops.push(top);
    }
    if (selected.category !== "bottoms" && outfit.bottom_id) {
      const bottom = byId.get(outfit.bottom_id);
      if (bottom) bottoms.push(bottom);
    }
    if (selected.category !== "dresses" && outfit.dress_id) {
      const dress = byId.get(outfit.dress_id);
      if (dress) dresses.push(dress);
    }
    if (selected.category !== "outerwear" && outfit.outerwear_id) {
      const piece = byId.get(outfit.outerwear_id);
      if (piece) outerwear.push(piece);
    }
    if (selected.category !== "shoes" && outfit.shoes_id) {
      const shoe = byId.get(outfit.shoes_id);
      if (shoe) shoes.push(shoe);
    }
    for (const accessoryId of outfit.accessory_ids ?? []) {
      const accessory = byId.get(accessoryId);
      if (accessory) accessories.push(accessory);
    }
  }

  return {
    tops: uniqueById(tops),
    bottoms: uniqueById(bottoms),
    dresses: uniqueById(dresses),
    outerwear: uniqueById(outerwear),
    shoes: uniqueById(shoes),
    accessories: uniqueById(accessories),
  };
}
