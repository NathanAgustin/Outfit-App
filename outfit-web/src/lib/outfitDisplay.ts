import { publicImageUrl } from "@/lib/storage";
import { ClothingItem, OUTFIT_SLOT_CATEGORIES, SavedOutfit, displayName } from "@/lib/types";
import { SupabaseClient } from "@supabase/supabase-js";

export function previewForOutfit(
  supabase: SupabaseClient,
  outfit: SavedOutfit,
  items: ClothingItem[]
): string | null {
  if (outfit.preview_image_path) {
    return publicImageUrl(supabase, outfit.preview_image_path);
  }
  const fallbackId =
    outfit.top_id ||
    outfit.dress_id ||
    outfit.outerwear_id ||
    outfit.bottom_id ||
    outfit.shoes_id ||
    outfit.accessory_ids?.[0];
  const piece = fallbackId ? items.find((i) => i.id === fallbackId) : null;
  return piece ? publicImageUrl(supabase, piece.image_path) : null;
}

export function outfitSummary(outfit: SavedOutfit, items: ClothingItem[]): string {
  const parts: string[] = [];
  for (const slot of OUTFIT_SLOT_CATEGORIES) {
    const id = outfit[slot.outfitKey];
    if (!id) continue;
    const item = items.find((i) => i.id === id);
    parts.push(`${slot.label}: ${item ? displayName(item.name) : "Missing"}`);
  }
  if ((outfit.accessory_ids ?? []).length > 0) {
    parts.push(`${outfit.accessory_ids.length} accessories`);
  }
  return parts.join(" · ") || "Empty outfit";
}
