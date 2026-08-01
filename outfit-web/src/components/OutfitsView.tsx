"use client";

import { CapsulesSection } from "@/components/CapsulesSection";
import { useCategoryOrder } from "@/components/CategoryOrderProvider";
import { useItemOrder } from "@/components/ItemOrderProvider";
import { CategoryDragHint, SortableCategoryList } from "@/components/SortableCategoryList";
import { ensureDefaultCapsule, sortCapsulesForDisplay } from "@/lib/defaultCapsule";
import { friendlySupabaseError } from "@/lib/supabase/errors";
import { createClient } from "@/lib/supabase/client";
import {
  outfitPreviewPath,
  publicImageUrl,
  resizeImageFile,
  uploadImage,
} from "@/lib/storage";
import {
  Capsule,
  CapsuleOutfit,
  ClothingItem,
  SavedOutfit,
  countOutfitPieces,
  displayName,
} from "@/lib/types";
import { SupabaseClient } from "@supabase/supabase-js";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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
  const { orderedItems } = useItemOrder();
  const [items, setItems] = useState<ClothingItem[]>([]);
  const [outfits, setOutfits] = useState<SavedOutfit[]>([]);
  const [capsules, setCapsules] = useState<Capsule[]>([]);
  const [capsuleOutfits, setCapsuleOutfits] = useState<CapsuleOutfit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [topIndex, setTopIndex] = useState(0);
  const [bottomIndex, setBottomIndex] = useState(0);
  const [dressIndex, setDressIndex] = useState(0);
  const [outerwearIndex, setOuterwearIndex] = useState(0);
  const [shoesIndex, setShoesIndex] = useState(0);
  const [accessoryIds, setAccessoryIds] = useState<string[]>([]);
  const [loadedOutfitId, setLoadedOutfitId] = useState<string | null>(null);
  const [saveCapsuleIds, setSaveCapsuleIds] = useState<string[]>([]);
  const [capsulePickerOpen, setCapsulePickerOpen] = useState(false);
  const [saveCoverFile, setSaveCoverFile] = useState<File | null>(null);
  const [saveCoverPreview, setSaveCoverPreview] = useState<string | null>(null);

  const tops = useMemo(() => orderedItems("tops", items), [orderedItems, items]);
  const bottoms = useMemo(() => orderedItems("bottoms", items), [orderedItems, items]);
  const dresses = useMemo(() => orderedItems("dresses", items), [orderedItems, items]);
  const outerwear = useMemo(() => orderedItems("outerwear", items), [orderedItems, items]);
  const shoes = useMemo(() => orderedItems("shoes", items), [orderedItems, items]);
  const accessories = useMemo(() => orderedItems("accessories", items), [orderedItems, items]);

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

  const loadData = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    const [itemsRes, outfitsRes, capsulesRes, membershipRes] = await Promise.all([
      supabase.from("clothing_items").select("*").order("created_at", { ascending: false }),
      supabase.from("saved_outfits").select("*").order("date_modified", { ascending: false }),
      supabase.from("capsules").select("*").order("sort_order", { ascending: true }),
      supabase.from("capsule_outfits").select("*").order("sort_order", { ascending: true }),
    ]);

    if (itemsRes.error) setError(friendlySupabaseError(itemsRes.error.message));
    else setItems((itemsRes.data as ClothingItem[]) ?? []);

    const loadedOutfits = outfitsRes.error
      ? []
      : ((outfitsRes.data as SavedOutfit[]) ?? []);
    if (outfitsRes.error) setError(friendlySupabaseError(outfitsRes.error.message));
    else setOutfits(loadedOutfits);

    if (capsulesRes.error) {
      const msg = friendlySupabaseError(capsulesRes.error.message);
      if (
        capsulesRes.error.message.includes("capsules") ||
        capsulesRes.error.message.includes("schema cache") ||
        capsulesRes.error.message.includes("does not exist") ||
        capsulesRes.error.message.includes("is_default")
      ) {
        setError(
          "Capsules need a database update. In Supabase → SQL Editor, run outfit-web/supabase/migration_capsules.sql and migration_default_capsule.sql, then refresh."
        );
        setCapsules([]);
        setCapsuleOutfits([]);
      } else {
        setError(msg);
      }
    } else {
      let nextCapsules = (capsulesRes.data as Capsule[]) ?? [];
      let nextMemberships = membershipRes.error
        ? []
        : ((membershipRes.data as CapsuleOutfit[]) ?? []);
      if (membershipRes.error) setError(friendlySupabaseError(membershipRes.error.message));

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        try {
          const ensured = await ensureDefaultCapsule(
            supabase,
            user.id,
            nextCapsules,
            loadedOutfits,
            nextMemberships
          );
          nextCapsules = ensured.capsules;
          nextMemberships = ensured.memberships;
        } catch (err) {
          const message =
            err && typeof err === "object" && "message" in err
              ? String((err as { message: string }).message)
              : "Failed to set up Saved Outfits capsule";
          if (message.includes("is_default")) {
            setError(
              "Capsules need a database update. In Supabase → SQL Editor, run outfit-web/supabase/migration_default_capsule.sql, then refresh."
            );
          } else {
            setError(friendlySupabaseError(message));
          }
        }
      }

      setCapsules(nextCapsules);
      setCapsuleOutfits(nextMemberships);
    }

    if (!opts?.silent) setLoading(false);
  }, [supabase]);

  const refreshQuietly = useCallback(() => loadData({ silent: true }), [loadData]);

  const defaultCapsule = useMemo(
    () => capsules.find((capsule) => capsule.is_default) ?? null,
    [capsules]
  );
  const selectableCapsules = useMemo(() => sortCapsulesForDisplay(capsules), [capsules]);

  useEffect(() => {
    if (!defaultCapsule) return;
    setSaveCapsuleIds((current) => {
      const withoutMissing = current.filter((id) => capsules.some((c) => c.id === id));
      if (!withoutMissing.includes(defaultCapsule.id)) {
        return [defaultCapsule.id, ...withoutMissing];
      }
      return withoutMissing.length > 0 ? withoutMissing : [defaultCapsule.id];
    });
  }, [defaultCapsule, capsules]);

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

  function clearSaveCover() {
    if (saveCoverPreview) URL.revokeObjectURL(saveCoverPreview);
    setSaveCoverFile(null);
    setSaveCoverPreview(null);
  }

  function onSaveCoverChange(file: File | null) {
    if (saveCoverPreview) URL.revokeObjectURL(saveCoverPreview);
    setSaveCoverFile(file);
    setSaveCoverPreview(file ? URL.createObjectURL(file) : null);
  }

  function toggleSaveCapsule(id: string) {
    if (defaultCapsule && id === defaultCapsule.id) return;
    setSaveCapsuleIds((current) => {
      const base = defaultCapsule ? [defaultCapsule.id] : [];
      const others = current.filter((x) => x !== defaultCapsule?.id);
      if (others.includes(id)) {
        return [...base, ...others.filter((x) => x !== id)];
      }
      return [...base, ...others, id];
    });
  }

  async function addOutfitToCapsules(outfitId: string, capsuleIds: string[]) {
    const uniqueIds = Array.from(new Set(capsuleIds));
    for (const capsuleId of uniqueIds) {
      const existing = capsuleOutfits.filter((row) => row.capsule_id === capsuleId);
      const sortOrder = existing.reduce((max, row) => Math.max(max, row.sort_order), -1) + 1;
      const { error } = await supabase.from("capsule_outfits").upsert({
        capsule_id: capsuleId,
        outfit_id: outfitId,
        sort_order: sortOrder,
      });
      if (error) throw error;
    }
  }

  async function saveOutfit() {
    if (!canSaveOutfit || !defaultCapsule) return;
    setSaving(true);
    setError(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setSaving(false);
      return;
    }

    const outfitId = crypto.randomUUID();
    let previewPath: string | null = null;

    try {
      if (saveCoverFile) {
        previewPath = outfitPreviewPath(user.id, outfitId);
        const blob = await resizeImageFile(saveCoverFile);
        await uploadImage(supabase, previewPath, blob);
      }

      const { data, error: insertError } = await supabase
        .from("saved_outfits")
        .insert({
          id: outfitId,
          user_id: user.id,
          name: "",
          preview_image_path: previewPath,
          ...currentSelectionPayload(),
        })
        .select("*")
        .single();

      if (insertError) throw insertError;

      const targets = saveCapsuleIds.includes(defaultCapsule.id)
        ? saveCapsuleIds
        : [defaultCapsule.id, ...saveCapsuleIds];
      await addOutfitToCapsules(data.id, targets);

      setLoadedOutfitId(data.id);
      clearSaveCover();
      setCapsulePickerOpen(false);
      await refreshQuietly();
    } catch (err) {
      const message =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: string }).message)
          : err instanceof Error
            ? err.message
            : "Failed to save outfit";
      setError(friendlySupabaseError(message));
    } finally {
      setSaving(false);
    }
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
    else await refreshQuietly();
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

  async function deleteOutfit(id: string) {
    if (!confirm("Delete this outfit permanently?")) return;

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
    await refreshQuietly();
  }

  const saveTargetLabel = useMemo(() => {
    if (!defaultCapsule) return "Select capsules";
    const selected = selectableCapsules.filter((capsule) => saveCapsuleIds.includes(capsule.id));
    if (selected.length <= 1) return defaultCapsule.name;
    return selected.map((capsule) => capsule.name).join(", ");
  }, [defaultCapsule, selectableCapsules, saveCapsuleIds]);

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
            <PreviewCard
              label={slot.label}
              item={slot.selected}
              index={safeSlotIndex(slot.index, slot.items.length)}
              count={slot.items.length + 1}
              onPrev={slot.onPrev}
              onNext={slot.onNext}
              supabase={supabase}
              drag={drag}
            />
          );
        }}
      </SortableCategoryList>

      <section className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-4">
        <div>
          <button
            type="button"
            onClick={() => setCapsulePickerOpen((v) => !v)}
            className="flex w-full items-center justify-between gap-3 rounded-xl border border-zinc-200 px-4 py-3 text-left"
          >
            <div className="min-w-0">
              <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
                Select capsules
              </p>
              <p className="truncate text-sm font-medium text-zinc-900">{saveTargetLabel}</p>
            </div>
            <span className="shrink-0 text-zinc-400" aria-hidden>
              {capsulePickerOpen ? "▴" : "▾"}
            </span>
          </button>

          {capsulePickerOpen && (
            <ul className="mt-2 space-y-1 rounded-xl border border-zinc-200 p-2">
              {selectableCapsules.map((capsule) => {
                const checked = saveCapsuleIds.includes(capsule.id);
                const locked = Boolean(capsule.is_default);
                return (
                  <li key={capsule.id}>
                    <label
                      className={`flex items-center gap-3 rounded-lg px-2 py-2 ${
                        locked ? "bg-zinc-50" : "hover:bg-zinc-50"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={locked}
                        onChange={() => toggleSaveCapsule(capsule.id)}
                        className="h-4 w-4"
                      />
                      <span className="text-sm text-zinc-800">
                        {capsule.name}
                        {locked ? " (always)" : ""}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="rounded-xl border border-dashed border-zinc-300 p-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-sm font-medium text-zinc-800">Outfit cover</p>
              <p className="text-xs text-zinc-500">Optional photo for this outfit</p>
            </div>
            <CoverPickerButton
              label={saveCoverFile ? "Change" : "Add photo"}
              onPick={onSaveCoverChange}
            />
          </div>
          {saveCoverPreview && (
            <div className="mt-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={saveCoverPreview}
                alt="Outfit cover preview"
                className="h-36 w-full rounded-xl object-contain bg-zinc-50"
              />
              <button
                type="button"
                onClick={clearSaveCover}
                className="mt-2 text-xs text-zinc-600 underline"
              >
                Remove cover
              </button>
            </div>
          )}
        </div>

        <button
          type="button"
          disabled={!canSaveOutfit || saving || !defaultCapsule}
          onClick={saveOutfit}
          className="w-full rounded-xl bg-zinc-900 py-3 text-sm font-semibold text-white disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save outfit"}
        </button>
        <p className="text-xs text-zinc-500">Select at least 2 pieces. Saves into Saved Outfits plus any others you pick.</p>
        {loadedOutfitId && (
          <button
            type="button"
            disabled={!canSaveOutfit}
            onClick={updateLoadedOutfit}
            className="w-full rounded-xl border border-zinc-300 py-2 text-sm font-medium disabled:opacity-50"
          >
            Update loaded outfit
          </button>
        )}
      </section>

      <CapsulesSection
        supabase={supabase}
        items={items}
        outfits={outfits}
        capsules={capsules}
        capsuleOutfits={capsuleOutfits}
        onRefresh={refreshQuietly}
        onError={setError}
        onLoadOutfit={loadOutfit}
        onDeleteOutfit={deleteOutfit}
      />
    </div>
  );
}

function CoverPickerButton({
  onPick,
  label,
}: {
  onPick: (file: File) => void;
  label: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="rounded-lg border px-3 py-1.5 text-xs font-medium"
      >
        {label}
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
  drag,
}: {
  label: string;
  item: ClothingItem | null;
  index: number;
  count: number;
  onPrev: () => void;
  onNext: () => void;
  supabase: SupabaseClient;
  drag: Parameters<typeof CategoryDragHint>[0];
}) {
  return (
    <article className="rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">{label}</p>
        <div className="flex items-center gap-2">
          <p className="text-xs text-zinc-500">
            {index === 0 ? "None" : `${index} of ${count - 1}`}
          </p>
          <CategoryDragHint {...drag} />
        </div>
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
