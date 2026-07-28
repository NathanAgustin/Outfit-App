"use client";

import { useCategoryOrder } from "@/components/CategoryOrderProvider";
import { CategoryDragHint, SortableCategoryList } from "@/components/SortableCategoryList";
import { friendlySupabaseError } from "@/lib/supabase/errors";
import { createClient } from "@/lib/supabase/client";
import {
  outfitPreviewPath,
  publicImageUrl,
  resizeImageFile,
  uploadImage,
} from "@/lib/storage";
import {
  ClothingItem,
  OUTFIT_SLOT_CATEGORIES,
  SavedOutfit,
  countOutfitPieces,
  displayName,
} from "@/lib/types";
import { SupabaseClient } from "@supabase/supabase-js";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

function itemsForCategory(items: ClothingItem[], category: ClothingItem["category"]) {
  return items.filter((item) => item.category === category);
}

/** Index 0 = None, 1..n = clothing items */
function safeSlotIndex(index: number, itemCount: number) {
  const total = itemCount + 1;
  return ((index % total) + total) % total;
}

function selectedFromSlot(items: ClothingItem[], index: number): ClothingItem | null {
  const safe = safeSlotIndex(index, items.length);
  if (safe === 0) return null;
  return items[safe - 1] ?? null;
}

function indexForItemOrNone(items: ClothingItem[], itemId: string | null): number {
  if (!itemId) return 0;
  const idx = items.findIndex((item) => item.id === itemId);
  return idx < 0 ? 0 : idx + 1;
}

export function OutfitsView() {
  const supabase = useMemo(() => createClient(), []);
  const { order } = useCategoryOrder();
  const [items, setItems] = useState<ClothingItem[]>([]);
  const [outfits, setOutfits] = useState<SavedOutfit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [topIndex, setTopIndex] = useState(0);
  const [bottomIndex, setBottomIndex] = useState(0);
  const [dressIndex, setDressIndex] = useState(0);
  const [outerwearIndex, setOuterwearIndex] = useState(0);
  const [shoesIndex, setShoesIndex] = useState(0);
  const [accessoryIds, setAccessoryIds] = useState<string[]>([]);
  const [loadedOutfitId, setLoadedOutfitId] = useState<string | null>(null);
  const [newOutfitName, setNewOutfitName] = useState("");

  const tops = useMemo(() => itemsForCategory(items, "tops"), [items]);
  const bottoms = useMemo(() => itemsForCategory(items, "bottoms"), [items]);
  const dresses = useMemo(() => itemsForCategory(items, "dresses"), [items]);
  const outerwear = useMemo(() => itemsForCategory(items, "outerwear"), [items]);
  const shoes = useMemo(() => itemsForCategory(items, "shoes"), [items]);
  const accessories = useMemo(() => itemsForCategory(items, "accessories"), [items]);

  const selectedTop = selectedFromSlot(tops, topIndex);
  const selectedBottom = selectedFromSlot(bottoms, bottomIndex);
  const selectedDress = selectedFromSlot(dresses, dressIndex);
  const selectedOuterwear = selectedFromSlot(outerwear, outerwearIndex);
  const selectedShoes = selectedFromSlot(shoes, shoesIndex);

  const pieceCount = countOutfitPieces({
    topId: selectedTop?.id ?? null,
    bottomId: selectedBottom?.id ?? null,
    dressId: selectedDress?.id ?? null,
    outerwearId: selectedOuterwear?.id ?? null,
    shoesId: selectedShoes?.id ?? null,
    accessoryIds,
  });
  const canSaveOutfit = pieceCount >= 2;

  const loadData = useCallback(async () => {
    setLoading(true);
    const [itemsRes, outfitsRes] = await Promise.all([
      supabase.from("clothing_items").select("*").order("created_at", { ascending: false }),
      supabase.from("saved_outfits").select("*").order("date_modified", { ascending: false }),
    ]);

    if (itemsRes.error) setError(friendlySupabaseError(itemsRes.error.message));
    else setItems((itemsRes.data as ClothingItem[]) ?? []);

    if (outfitsRes.error) setError(friendlySupabaseError(outfitsRes.error.message));
    else setOutfits((outfitsRes.data as SavedOutfit[]) ?? []);

    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    setTopIndex((i) => safeSlotIndex(i, tops.length));
    setBottomIndex((i) => safeSlotIndex(i, bottoms.length));
    setDressIndex((i) => safeSlotIndex(i, dresses.length));
    setOuterwearIndex((i) => safeSlotIndex(i, outerwear.length));
    setShoesIndex((i) => safeSlotIndex(i, shoes.length));
    setAccessoryIds((ids) => ids.filter((id) => accessories.some((a) => a.id === id)));
  }, [tops.length, bottoms.length, dresses.length, outerwear.length, shoes.length, accessories]);

  function toggleAccessory(id: string) {
    setAccessoryIds((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id]
    );
  }

  function currentSelectionPayload() {
    return {
      top_id: selectedTop?.id ?? null,
      bottom_id: selectedBottom?.id ?? null,
      dress_id: selectedDress?.id ?? null,
      outerwear_id: selectedOuterwear?.id ?? null,
      shoes_id: selectedShoes?.id ?? null,
      accessory_ids: accessoryIds,
    };
  }

  async function saveOutfit() {
    if (!canSaveOutfit || !newOutfitName.trim()) return;
    setError(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error: insertError } = await supabase
      .from("saved_outfits")
      .insert({
        user_id: user.id,
        name: newOutfitName.trim(),
        ...currentSelectionPayload(),
      })
      .select("*")
      .single();

    if (insertError) {
      setError(friendlySupabaseError(insertError.message));
      return;
    }

    setLoadedOutfitId(data.id);
    setNewOutfitName("");
    await loadData();
  }

  async function updateLoadedOutfit() {
    if (!loadedOutfitId || !canSaveOutfit) return;
    setError(null);

    const { error: updateError } = await supabase
      .from("saved_outfits")
      .update({
        ...currentSelectionPayload(),
        date_modified: new Date().toISOString(),
      })
      .eq("id", loadedOutfitId);

    if (updateError) setError(friendlySupabaseError(updateError.message));
    else await loadData();
  }

  function loadOutfit(outfit: SavedOutfit) {
    const missing =
      (outfit.top_id && !tops.some((i) => i.id === outfit.top_id)) ||
      (outfit.bottom_id && !bottoms.some((i) => i.id === outfit.bottom_id)) ||
      (outfit.dress_id && !dresses.some((i) => i.id === outfit.dress_id)) ||
      (outfit.outerwear_id && !outerwear.some((i) => i.id === outfit.outerwear_id)) ||
      (outfit.shoes_id && !shoes.some((i) => i.id === outfit.shoes_id));

    if (missing) {
      setError("Some items in this outfit are no longer available.");
      return;
    }

    setTopIndex(indexForItemOrNone(tops, outfit.top_id));
    setBottomIndex(indexForItemOrNone(bottoms, outfit.bottom_id));
    setDressIndex(indexForItemOrNone(dresses, outfit.dress_id));
    setOuterwearIndex(indexForItemOrNone(outerwear, outfit.outerwear_id));
    setShoesIndex(indexForItemOrNone(shoes, outfit.shoes_id));
    setAccessoryIds((outfit.accessory_ids ?? []).filter((id) => accessories.some((a) => a.id === id)));
    setLoadedOutfitId(outfit.id);
  }

  async function renameOutfit(outfit: SavedOutfit) {
    const name = prompt("Outfit name", outfit.name)?.trim();
    if (!name) return;

    const { error: updateError } = await supabase
      .from("saved_outfits")
      .update({ name, date_modified: new Date().toISOString() })
      .eq("id", outfit.id);

    if (updateError) setError(friendlySupabaseError(updateError.message));
    else await loadData();
  }

  async function deleteOutfit(id: string) {
    if (!confirm("Delete this saved outfit?")) return;

    const outfit = outfits.find((o) => o.id === id);
    const { error: deleteError } = await supabase.from("saved_outfits").delete().eq("id", id);
    if (deleteError) {
      setError(friendlySupabaseError(deleteError.message));
      return;
    }

    if (outfit?.preview_image_path) {
      try {
        await supabase.storage.from("clothing-images").remove([outfit.preview_image_path]);
      } catch {
        // best-effort
      }
    }

    if (loadedOutfitId === id) setLoadedOutfitId(null);
    await loadData();
  }

  async function setOutfitPreview(outfit: SavedOutfit, file: File) {
    setError(null);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    try {
      const path = outfitPreviewPath(user.id, outfit.id);
      const blob = await resizeImageFile(file);
      await uploadImage(supabase, path, blob);

      const { error: updateError } = await supabase
        .from("saved_outfits")
        .update({ preview_image_path: path, date_modified: new Date().toISOString() })
        .eq("id", outfit.id);

      if (updateError) throw updateError;
      await loadData();
    } catch (err) {
      setError(friendlySupabaseError(err instanceof Error ? err.message : "Failed to upload preview"));
    }
  }

  async function resetOutfitPreview(outfit: SavedOutfit) {
    if (!outfit.preview_image_path) return;
    await supabase
      .from("saved_outfits")
      .update({ preview_image_path: null, date_modified: new Date().toISOString() })
      .eq("id", outfit.id);
    await loadData();
  }

  function previewForOutfit(outfit: SavedOutfit) {
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

  function outfitSummary(outfit: SavedOutfit) {
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

  const slotByCategory = useMemo(() => {
    return {
      tops: {
        label: "Top",
        items: tops,
        index: topIndex,
        selected: selectedTop,
        onPrev: () => setTopIndex((i) => safeSlotIndex(i - 1, tops.length)),
        onNext: () => setTopIndex((i) => safeSlotIndex(i + 1, tops.length)),
      },
      bottoms: {
        label: "Bottom",
        items: bottoms,
        index: bottomIndex,
        selected: selectedBottom,
        onPrev: () => setBottomIndex((i) => safeSlotIndex(i - 1, bottoms.length)),
        onNext: () => setBottomIndex((i) => safeSlotIndex(i + 1, bottoms.length)),
      },
      dresses: {
        label: "Dress",
        items: dresses,
        index: dressIndex,
        selected: selectedDress,
        onPrev: () => setDressIndex((i) => safeSlotIndex(i - 1, dresses.length)),
        onNext: () => setDressIndex((i) => safeSlotIndex(i + 1, dresses.length)),
      },
      outerwear: {
        label: "Outerwear",
        items: outerwear,
        index: outerwearIndex,
        selected: selectedOuterwear,
        onPrev: () => setOuterwearIndex((i) => safeSlotIndex(i - 1, outerwear.length)),
        onNext: () => setOuterwearIndex((i) => safeSlotIndex(i + 1, outerwear.length)),
      },
      shoes: {
        label: "Shoes",
        items: shoes,
        index: shoesIndex,
        selected: selectedShoes,
        onPrev: () => setShoesIndex((i) => safeSlotIndex(i - 1, shoes.length)),
        onNext: () => setShoesIndex((i) => safeSlotIndex(i + 1, shoes.length)),
      },
    } as const;
  }, [
    tops,
    bottoms,
    dresses,
    outerwear,
    shoes,
    topIndex,
    bottomIndex,
    dressIndex,
    outerwearIndex,
    shoesIndex,
    selectedTop,
    selectedBottom,
    selectedDress,
    selectedOuterwear,
    selectedShoes,
  ]);

  if (loading) {
    return <p className="text-sm text-zinc-500">Loading browse...</p>;
  }

  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-xl font-bold text-zinc-900">Browse</h1>
        <p className="mt-1 text-xs text-zinc-500">Hold the ⋮⋮ grip on a category, then drag to reorder.</p>
      </section>

      {error && (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <SortableCategoryList ids={order}>
        {(category, drag) => {
          if (category === "accessories") {
            return (
              <section className="rounded-2xl border border-zinc-200 bg-white p-4">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h2 className="text-sm font-semibold text-zinc-800">Accessories</h2>
                  <CategoryDragHint {...drag} />
                </div>
                {accessories.length === 0 ? (
                  <p className="mt-2 text-sm text-zinc-500">No accessories available yet.</p>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {accessories.map((item) => {
                      const selected = accessoryIds.includes(item.id);
                      return (
                        <li key={item.id}>
                          <button
                            type="button"
                            onClick={() => toggleAccessory(item.id)}
                            className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left ${
                              selected ? "border-zinc-900 bg-zinc-50" : "border-zinc-200"
                            }`}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={publicImageUrl(supabase, item.image_path) ?? ""}
                              alt=""
                              className="h-10 w-10 rounded-lg object-cover"
                            />
                            <span className="flex-1 text-sm">{displayName(item.name)}</span>
                            <span className="text-xs">{selected ? "✓" : ""}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            );
          }

          const slot = slotByCategory[category];
          return (
            <div className="relative">
              <div className="absolute right-3 top-3 z-10">
                <CategoryDragHint {...drag} />
              </div>
              <PreviewCard
                label={slot.label}
                item={slot.selected}
                index={safeSlotIndex(slot.index, slot.items.length)}
                count={slot.items.length + 1}
                onPrev={slot.onPrev}
                onNext={slot.onNext}
                supabase={supabase}
              />
            </div>
          );
        }}
      </SortableCategoryList>

      <section className="rounded-2xl border border-zinc-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-zinc-800">Saved outfits</h2>
        <p className="mt-1 text-xs text-zinc-500">Select at least 2 pieces to save.</p>
        <div className="mt-3 flex gap-2">
          <input
            type="text"
            placeholder="Outfit name"
            value={newOutfitName}
            onChange={(e) => setNewOutfitName(e.target.value)}
            className="min-w-0 flex-1 rounded-xl border border-zinc-200 px-3 py-2 text-sm"
          />
          <button
            type="button"
            disabled={!canSaveOutfit || !newOutfitName.trim()}
            onClick={saveOutfit}
            className="shrink-0 rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            Save
          </button>
        </div>

        {loadedOutfitId && (
          <button
            type="button"
            disabled={!canSaveOutfit}
            onClick={updateLoadedOutfit}
            className="mt-2 w-full rounded-xl border border-zinc-300 py-2 text-sm font-medium disabled:opacity-50"
          >
            Update loaded outfit
          </button>
        )}

        {outfits.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">No saved outfits yet.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {outfits.map((outfit) => (
              <li key={outfit.id} className="rounded-xl border border-zinc-200 p-3">
                <div className="flex gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={previewForOutfit(outfit) ?? ""}
                    alt={outfit.name}
                    className="h-16 w-16 shrink-0 rounded-lg object-cover bg-white"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium text-zinc-900">{outfit.name}</p>
                      {loadedOutfitId === outfit.id && (
                        <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-700">
                          Loaded
                        </span>
                      )}
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs text-zinc-500">{outfitSummary(outfit)}</p>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => loadOutfit(outfit)}
                    className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white"
                  >
                    Load
                  </button>
                  <button
                    type="button"
                    onClick={() => renameOutfit(outfit)}
                    className="rounded-lg border px-3 py-1.5 text-xs"
                  >
                    Rename
                  </button>
                  <PreviewPhotoButton onPick={(file) => setOutfitPreview(outfit, file)} />
                  {outfit.preview_image_path && (
                    <button
                      type="button"
                      onClick={() => resetOutfitPreview(outfit)}
                      className="rounded-lg border px-3 py-1.5 text-xs"
                    >
                      Use default image
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => deleteOutfit(outfit.id)}
                    className="rounded-lg border border-red-200 px-3 py-1.5 text-xs text-red-600"
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function PreviewPhotoButton({ onPick }: { onPick: (file: File) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="rounded-lg border px-3 py-1.5 text-xs"
      >
        Preview photo
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onPick(file);
          e.currentTarget.value = "";
        }}
      />
    </>
  );
}

function PreviewCard({
  label,
  item,
  index,
  count,
  onPrev,
  onNext,
  supabase,
}: {
  label: string;
  item: ClothingItem | null;
  index: number;
  count: number;
  onPrev: () => void;
  onNext: () => void;
  supabase: SupabaseClient;
}) {
  return (
    <article className="rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">{label}</p>
        <p className="text-xs text-zinc-500">
          {index === 0 ? "None" : `${index} of ${count - 1}`}
        </p>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onPrev}
          className="shrink-0 rounded-lg border border-zinc-200 px-3 py-8 text-lg leading-none text-zinc-700"
          aria-label={`Previous ${label}`}
        >
          ‹
        </button>

        <div className="min-w-0 flex-1">
          {item ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={publicImageUrl(supabase, item.image_path) ?? ""}
                alt={displayName(item.name)}
                className="h-44 w-full rounded-xl object-contain bg-white"
              />
              {item.name.trim() ? (
                <p className="mt-2 truncate text-center text-sm font-medium text-zinc-800">
                  {item.name.trim()}
                </p>
              ) : null}
            </>
          ) : (
            <div className="flex h-44 w-full items-center justify-center rounded-xl border border-dashed border-zinc-200 bg-white">
              <p className="text-sm text-zinc-400">None</p>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={onNext}
          className="shrink-0 rounded-lg border border-zinc-200 px-3 py-8 text-lg leading-none text-zinc-700"
          aria-label={`Next ${label}`}
        >
          ›
        </button>
      </div>
    </article>
  );
}
