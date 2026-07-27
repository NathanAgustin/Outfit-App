import { ClothingItem, SavedOutfit } from "@/lib/types";

export type CompatibilityFocus = "tops" | "bottoms" | "shoes";

export type CompatibilityMatches = {
  tops: ClothingItem[];
  bottoms: ClothingItem[];
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
  const related = outfits.filter((outfit) => {
    if (selected.category === "tops") return outfit.top_id === selected.id;
    if (selected.category === "bottoms") return outfit.bottom_id === selected.id;
    if (selected.category === "shoes") return outfit.shoes_id === selected.id;
    return false;
  });

  const tops: ClothingItem[] = [];
  const bottoms: ClothingItem[] = [];
  const shoes: ClothingItem[] = [];
  const accessories: ClothingItem[] = [];

  for (const outfit of related) {
    if (selected.category !== "tops") {
      const top = byId.get(outfit.top_id);
      if (top) tops.push(top);
    }
    if (selected.category !== "bottoms") {
      const bottom = byId.get(outfit.bottom_id);
      if (bottom) bottoms.push(bottom);
    }
    if (selected.category !== "shoes") {
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
    shoes: uniqueById(shoes),
    accessories: uniqueById(accessories),
  };
}
