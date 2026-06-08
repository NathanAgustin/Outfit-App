"use client";

import { friendlySupabaseError } from "@/lib/supabase/errors";
import { createClient } from "@/lib/supabase/client";
import {
  outfitPreviewPath,
  publicImageUrl,
  resizeImageFile,
  uploadImage,
} from "@/lib/storage";
import { ClothingItem, SavedOutfit, displayName } from "@/lib/types";
import { SupabaseClient } from "@supabase/supabase-js";
import { useCallback, useEffect, useMemo, useState } from "react";

function itemsForCategory(items: ClothingItem[], category: ClothingItem["category"]) {
  return items.filter((item) => item.category === category);
}

function safeIndex(index: number, count: number) {
  if (count === 0) return 0;
  return ((index % count) + count) % count;
}

export function OutfitsView() {
  const supabase = useMemo(() => createClient(), []);
  const [items, setItems] = useState<ClothingItem[]>([]);
  const [outfits, setOutfits] = useState<SavedOutfit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [topIndex, setTopIndex] = useState(0);
  const [bottomIndex, setBottomIndex] = useState(0);
  const [shoesIndex, setShoesIndex] = useState(0);
  const [accessoryIds, setAccessoryIds] = useState<string[]>([]);
  const [loadedOutfitId, setLoadedOutfitId] = useState<string | null>(null);
  const [newOutfitName, setNewOutfitName] = useState("");

  const tops = useMemo(() => itemsForCategory(items, "tops"), [items]);
  const bottoms = useMemo(() => itemsForCategory(items, "bottoms"), [items]);
  const shoes = useMemo(() => itemsForCategory(items, "shoes"), [items]);
  const accessories = useMemo(() => itemsForCategory(items, "accessories"), [items]);

  const selectedTop = tops[safeIndex(topIndex, tops.length)] ?? null;
  const selectedBottom = bottoms[safeIndex(bottomIndex, bottoms.length)] ?? null;
  const selectedShoes = shoes[safeIndex(shoesIndex, shoes.length)] ?? null;
  const canBuildOutfit = Boolean(selectedTop && selectedBottom && selectedShoes);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [itemsRes, outfitsRes] = await Promise.all([
      supabase.from("clothing_items").select("*").order("created_at", { ascending: false }),
      supabase.from("saved_outfits").select("*").order("date_modified", { ascending: false }),
    ]);

    if (itemsRes.error) setError(friendlySupabaseError(itemsRes.error.message));
    else setItems(itemsRes.data ?? []);

    if (outfitsRes.error) setError(friendlySupabaseError(outfitsRes.error.message));
    else setOutfits(outfitsRes.data ?? []);

    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    setTopIndex((i) => safeIndex(i, tops.length));
    setBottomIndex((i) => safeIndex(i, bottoms.length));
    setShoesIndex((i) => safeIndex(i, shoes.length));
    setAccessoryIds((ids) => ids.filter((id) => accessories.some((a) => a.id === id)));
  }, [tops.length, bottoms.length, shoes.length, accessories]);

  function toggleAccessory(id: string) {
    setAccessoryIds((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id]
    );
  }

  async function saveOutfit() {
    if (!canBuildOutfit || !newOutfitName.trim()) return;
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
        top_id: selectedTop!.id,
        bottom_id: selectedBottom!.id,
        shoes_id: selectedShoes!.id,
        accessory_ids: accessoryIds,
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
    if (!loadedOutfitId || !canBuildOutfit) return;
    setError(null);

    const { error: updateError } = await supabase
      .from("saved_outfits")
      .update({
        top_id: selectedTop!.id,
        bottom_id: selectedBottom!.id,
        shoes_id: selectedShoes!.id,
        accessory_ids: accessoryIds,
        date_modified: new Date().toISOString(),
      })
      .eq("id", loadedOutfitId);

    if (updateError) setError(friendlySupabaseError(updateError.message));
    else await loadData();
  }

  function loadOutfit(outfit: SavedOutfit) {
    const topIdx = tops.findIndex((i) => i.id === outfit.top_id);
    const bottomIdx = bottoms.findIndex((i) => i.id === outfit.bottom_id);
    const shoesIdx = shoes.findIndex((i) => i.id === outfit.shoes_id);
    if (topIdx < 0 || bottomIdx < 0 || shoesIdx < 0) {
      setError("Some items in this outfit are no longer available.");
      return;
    }
    setTopIndex(topIdx);
    setBottomIndex(bottomIdx);
    setShoesIndex(shoesIdx);
    setAccessoryIds(outfit.accessory_ids.filter((id) => accessories.some((a) => a.id === id)));
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
    const top = items.find((i) => i.id === outfit.top_id);
    return top ? publicImageUrl(supabase, top.image_path) : null;
  }

  if (loading) {
    return <p className="text-sm text-zinc-500">Loading outfit manager...</p>;
  }

  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-xl font-bold text-zinc-900">Outfit Manager</h1>
        <p className="mt-1 text-sm text-zinc-600">Build outfits and save them to your account.</p>
      </section>

      {error && (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-zinc-800">Outfit preview</h2>
        {!canBuildOutfit ? (
          <p className="rounded-xl bg-white p-4 text-sm text-zinc-600 shadow-sm ring-1 ring-zinc-200">
            Add at least one top, bottom, and shoes in Closet to preview a full outfit.
          </p>
        ) : (
          <div className="space-y-3">
            <PreviewCard label="Top" item={selectedTop} supabase={supabase} />
            <PreviewCard label="Bottom" item={selectedBottom} supabase={supabase} />
            <PreviewCard label="Shoes" item={selectedShoes} supabase={supabase} />
          </div>
        )}
      </section>

      <SelectorRow
        title="Top"
        items={tops}
        index={topIndex}
        onPrev={() => setTopIndex((i) => safeIndex(i - 1, tops.length))}
        onNext={() => setTopIndex((i) => safeIndex(i + 1, tops.length))}
        supabase={supabase}
      />
      <SelectorRow
        title="Bottom"
        items={bottoms}
        index={bottomIndex}
        onPrev={() => setBottomIndex((i) => safeIndex(i - 1, bottoms.length))}
        onNext={() => setBottomIndex((i) => safeIndex(i + 1, bottoms.length))}
        supabase={supabase}
      />
      <SelectorRow
        title="Shoes"
        items={shoes}
        index={shoesIndex}
        onPrev={() => setShoesIndex((i) => safeIndex(i - 1, shoes.length))}
        onNext={() => setShoesIndex((i) => safeIndex(i + 1, shoes.length))}
        supabase={supabase}
      />

      <section className="rounded-2xl border border-zinc-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-zinc-800">Accessories</h2>
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

      <section className="rounded-2xl border border-zinc-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-zinc-800">Saved outfits</h2>
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
            disabled={!canBuildOutfit || !newOutfitName.trim()}
            onClick={saveOutfit}
            className="shrink-0 rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            Save
          </button>
        </div>

        {loadedOutfitId && (
          <button
            type="button"
            disabled={!canBuildOutfit}
            onClick={updateLoadedOutfit}
            className="mt-2 w-full rounded-xl border border-zinc-300 py-2 text-sm font-medium"
          >
            Update loaded outfit
          </button>
        )}

        {outfits.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">No saved outfits yet.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {outfits.map((outfit) => (
              <li
                key={outfit.id}
                className="rounded-xl border border-zinc-200 p-3"
              >
                <div className="flex gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={previewForOutfit(outfit) ?? ""}
                    alt={outfit.name}
                    className="h-16 w-16 shrink-0 rounded-lg object-cover bg-zinc-100"
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
                    <p className="mt-1 line-clamp-2 text-xs text-zinc-500">
                      Top: {displayName(items.find((i) => i.id === outfit.top_id)?.name ?? "")}
                    </p>
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
                  <label className="cursor-pointer rounded-lg border px-3 py-1.5 text-xs">
                    Preview photo
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) setOutfitPreview(outfit, file);
                        e.currentTarget.value = "";
                      }}
                    />
                  </label>
                  {outfit.preview_image_path && (
                    <button
                      type="button"
                      onClick={() => resetOutfitPreview(outfit)}
                      className="rounded-lg border px-3 py-1.5 text-xs"
                    >
                      Use top image
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

function PreviewCard({
  label,
  item,
  supabase,
}: {
  label: string;
  item: ClothingItem;
  supabase: SupabaseClient;
}) {
  return (
    <article className="rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm">
      <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">{label}</p>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={publicImageUrl(supabase, item.image_path) ?? ""}
        alt={displayName(item.name)}
        className="mt-2 h-40 w-full rounded-xl object-contain bg-zinc-50"
      />
      <p className="mt-2 truncate text-sm font-medium text-zinc-800">{displayName(item.name)}</p>
    </article>
  );
}

function SelectorRow({
  title,
  items,
  index,
  onPrev,
  onNext,
  supabase,
}: {
  title: string;
  items: ClothingItem[];
  index: number;
  onPrev: () => void;
  onNext: () => void;
  supabase: SupabaseClient;
}) {
  const item = items[safeIndex(index, items.length)];

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-zinc-800">{title}</h2>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-zinc-500">No {title.toLowerCase()} items available.</p>
      ) : (
        <div className="mt-3 flex items-center gap-3">
          <button type="button" onClick={onPrev} className="rounded-lg border px-3 py-2 text-sm">
            ‹
          </button>
          <div className="flex min-w-0 flex-1 items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={publicImageUrl(supabase, item.image_path) ?? ""}
              alt=""
              className="h-14 w-14 shrink-0 rounded-lg object-cover"
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{displayName(item.name)}</p>
              <p className="text-xs text-zinc-500">
                {index + 1} of {items.length}
              </p>
            </div>
          </div>
          <button type="button" onClick={onNext} className="rounded-lg border px-3 py-2 text-sm">
            ›
          </button>
        </div>
      )}
    </section>
  );
}
