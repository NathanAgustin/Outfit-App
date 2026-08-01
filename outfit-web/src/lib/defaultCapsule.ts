import { Capsule, CapsuleOutfit, SavedOutfit } from "@/lib/types";
import { SupabaseClient } from "@supabase/supabase-js";

export const DEFAULT_CAPSULE_NAME = "Saved Outfits";

export function sortCapsulesForDisplay(capsules: Capsule[]): Capsule[] {
  return [...capsules].sort((a, b) => {
    if (a.is_default !== b.is_default) return a.is_default ? -1 : 1;
    return a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at);
  });
}

/** Ensure each user has an undeletable default capsule and orphan outfits are linked. */
export async function ensureDefaultCapsule(
  supabase: SupabaseClient,
  userId: string,
  capsules: Capsule[],
  outfits: SavedOutfit[],
  memberships: CapsuleOutfit[]
): Promise<{ capsules: Capsule[]; memberships: CapsuleOutfit[] }> {
  let nextCapsules = [...capsules];
  let nextMemberships = [...memberships];

  let defaultCapsule = nextCapsules.find((capsule) => capsule.is_default) ?? null;

  if (!defaultCapsule) {
    const named = nextCapsules.find(
      (capsule) => capsule.name.trim().toLowerCase() === DEFAULT_CAPSULE_NAME.toLowerCase()
    );
    if (named) {
      const { data, error } = await supabase
        .from("capsules")
        .update({ is_default: true, name: DEFAULT_CAPSULE_NAME, sort_order: 0 })
        .eq("id", named.id)
        .select("*")
        .single();
      if (error) throw error;
      defaultCapsule = data as Capsule;
      nextCapsules = nextCapsules.map((capsule) =>
        capsule.id === named.id ? defaultCapsule! : capsule
      );
    } else {
      const { data, error } = await supabase
        .from("capsules")
        .insert({
          user_id: userId,
          name: DEFAULT_CAPSULE_NAME,
          is_default: true,
          sort_order: 0,
        })
        .select("*")
        .single();
      if (error) throw error;
      defaultCapsule = data as Capsule;
      nextCapsules = [defaultCapsule, ...nextCapsules];
    }
  }

  const linked = new Set(
    nextMemberships
      .filter((row) => row.capsule_id === defaultCapsule!.id)
      .map((row) => row.outfit_id)
  );
  const missing = outfits.filter((outfit) => !linked.has(outfit.id));
  if (missing.length > 0) {
    const maxOrder = nextMemberships
      .filter((row) => row.capsule_id === defaultCapsule!.id)
      .reduce((max, row) => Math.max(max, row.sort_order), -1);
    const rows = missing.map((outfit, index) => ({
      capsule_id: defaultCapsule!.id,
      outfit_id: outfit.id,
      sort_order: maxOrder + 1 + index,
    }));
    const { error } = await supabase.from("capsule_outfits").insert(rows);
    if (error) throw error;
    nextMemberships = [...nextMemberships, ...rows];
  }

  return { capsules: nextCapsules, memberships: nextMemberships };
}
