"use client";

import { useCategoryOrder } from "@/components/CategoryOrderProvider";
import { getCompatibilityMatches, CompatibilityFocus } from "@/lib/compatibility";
import { friendlySupabaseError } from "@/lib/supabase/errors";
import { createClient } from "@/lib/supabase/client";
import { publicImageUrl } from "@/lib/storage";
import { categoryLabel, slotLabel } from "@/lib/categoryOrder";
import { ClothingCategory, ClothingItem, SavedOutfit, displayName } from "@/lib/types";
import { SupabaseClient } from "@supabase/supabase-js";
import { useCallback, useEffect, useMemo, useState } from "react";

type MatchKey = keyof ReturnType<typeof getCompatibilityMatches>;

function matchKeyForCategory(category: ClothingCategory): MatchKey {
  return category;
}

function safeIndex(index: number, count: number) {
  if (count === 0) return 0;
  return ((index % count) + count) % count;
}

const emptyIndexes = {
  tops: 0,
  bottoms: 0,
  dresses: 0,
  outerwear: 0,
  shoes: 0,
  accessories: 0,
};

export function CompatibilityView() {
  const supabase = useMemo(() => createClient(), []);
  const { order } = useCategoryOrder();
  const [items, setItems] = useState<ClothingItem[]>([]);
  const [outfits, setOutfits] = useState<SavedOutfit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [focus, setFocus] = useState<CompatibilityFocus>("tops");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [matchIndexes, setMatchIndexes] = useState(emptyIndexes);

  const focusOptions = useMemo(
    () => order.filter((category): category is CompatibilityFocus => category !== "accessories"),
    [order]
  );

  const focusItems = useMemo(
    () => items.filter((item) => item.category === focus),
    [items, focus]
  );

  const selectedItem = focusItems[safeIndex(selectedIndex, focusItems.length)] ?? null;

  const matches = useMemo(() => {
    if (!selectedItem) {
      return {
        tops: [],
        bottoms: [],
        dresses: [],
        outerwear: [],
        shoes: [],
        accessories: [],
      };
    }
    return getCompatibilityMatches(selectedItem, outfits, items);
  }, [selectedItem, outfits, items]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

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
    if (!focusOptions.includes(focus) && focusOptions[0]) {
      setFocus(focusOptions[0]);
    }
  }, [focus, focusOptions]);

  useEffect(() => {
    setSelectedIndex(0);
    setMatchIndexes(emptyIndexes);
  }, [focus]);

  useEffect(() => {
    setSelectedIndex((i) => safeIndex(i, focusItems.length));
  }, [focusItems.length]);

  useEffect(() => {
    setMatchIndexes(emptyIndexes);
  }, [selectedItem?.id]);

  if (loading) {
    return <p className="text-sm text-zinc-500">Loading style...</p>;
  }

  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-xl font-bold text-zinc-900">Style</h1>
      </section>

      {error && (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <div className="space-y-3">
        {order.map((category) => {
          const label = slotLabel(category);

          if (category === focus) {
            return (
              <section key={category} className="rounded-2xl border border-zinc-900 bg-white p-4">
                <h2 className="mb-2 text-sm font-semibold text-zinc-900">Selected {label}</h2>
                {focusItems.length === 0 ? (
                  <p className="mt-2 text-sm text-zinc-500">
                    No {categoryLabel(category).toLowerCase()} in your wardrobe yet.
                  </p>
                ) : (
                  <ItemCarousel
                    items={focusItems}
                    index={safeIndex(selectedIndex, focusItems.length)}
                    onPrev={() => setSelectedIndex((i) => safeIndex(i - 1, focusItems.length))}
                    onNext={() => setSelectedIndex((i) => safeIndex(i + 1, focusItems.length))}
                    supabase={supabase}
                    large
                  />
                )}
              </section>
            );
          }

          if (category === "accessories") {
            return (
              <section key={category} className="rounded-2xl border border-zinc-200 bg-white p-4">
                <h2 className="mb-2 text-sm font-semibold text-zinc-800">Accessories</h2>
                {!selectedItem ? (
                  <p className="text-sm text-zinc-500">Select a piece to see accessory matches.</p>
                ) : (
                  <MatchBody
                    items={matches.accessories}
                    index={matchIndexes.accessories}
                    onPrev={() =>
                      setMatchIndexes((m) => ({
                        ...m,
                        accessories: safeIndex(m.accessories - 1, matches.accessories.length),
                      }))
                    }
                    onNext={() =>
                      setMatchIndexes((m) => ({
                        ...m,
                        accessories: safeIndex(m.accessories + 1, matches.accessories.length),
                      }))
                    }
                    emptyLabel="No accessories paired with this piece yet."
                    supabase={supabase}
                  />
                )}
              </section>
            );
          }

          if (!selectedItem) {
            return (
              <section key={category} className="rounded-2xl border border-zinc-200 bg-white p-4">
                <button
                  type="button"
                  onClick={() => setFocus(category)}
                  className="mb-2 text-left text-sm font-semibold text-zinc-800"
                >
                  {label}
                </button>
                <p className="text-sm text-zinc-500">Tap the title to select this category.</p>
              </section>
            );
          }

          const key = matchKeyForCategory(category);
          const matchItems = matches[key];

          return (
            <section key={category} className="rounded-2xl border border-zinc-200 bg-white p-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setFocus(category)}
                  className="text-left text-sm font-semibold text-zinc-800"
                >
                  {label}
                </button>
                {matchItems.length > 0 && (
                  <span className="text-xs text-zinc-500">
                    {safeIndex(matchIndexes[key], matchItems.length) + 1} of {matchItems.length}
                  </span>
                )}
              </div>
              <MatchBody
                items={matchItems}
                index={matchIndexes[key]}
                onPrev={() =>
                  setMatchIndexes((m) => ({
                    ...m,
                    [key]: safeIndex(m[key] - 1, matchItems.length),
                  }))
                }
                onNext={() =>
                  setMatchIndexes((m) => ({
                    ...m,
                    [key]: safeIndex(m[key] + 1, matchItems.length),
                  }))
                }
                emptyLabel={`No ${categoryLabel(category).toLowerCase()} paired with this piece yet.`}
                supabase={supabase}
              />
            </section>
          );
        })}
      </div>

      {selectedItem && outfits.length === 0 && (
        <p className="rounded-xl bg-white p-4 text-sm text-zinc-600 shadow-sm ring-1 ring-zinc-200">
          No saved outfits yet. Save outfits in Browse so style matches can appear.
        </p>
      )}
    </div>
  );
}

function MatchBody({
  items,
  index,
  onPrev,
  onNext,
  emptyLabel,
  supabase,
}: {
  items: ClothingItem[];
  index: number;
  onPrev: () => void;
  onNext: () => void;
  emptyLabel: string;
  supabase: SupabaseClient;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-zinc-500">{emptyLabel}</p>;
  }

  return (
    <ItemCarousel
      items={items}
      index={safeIndex(index, items.length)}
      onPrev={onPrev}
      onNext={onNext}
      supabase={supabase}
    />
  );
}

function ItemCarousel({
  items,
  index,
  onPrev,
  onNext,
  supabase,
  large = false,
}: {
  items: ClothingItem[];
  index: number;
  onPrev: () => void;
  onNext: () => void;
  supabase: SupabaseClient;
  large?: boolean;
}) {
  const item = items[index];

  return (
    <div className={`mt-3 flex items-center gap-3 ${large ? "flex-col" : ""}`}>
      {large ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={publicImageUrl(supabase, item.image_path) ?? ""}
            alt={displayName(item.name)}
            className="h-48 w-full rounded-xl object-contain bg-white"
          />
          <div className="flex w-full items-center gap-3">
            <button type="button" onClick={onPrev} className="rounded-lg border px-3 py-2 text-sm">
              ‹
            </button>
            <div className="min-w-0 flex-1 text-center">
              <p className="truncate text-sm font-medium">{item.name.trim() || " "}</p>
              <p className="text-xs text-zinc-500">
                {index + 1} of {items.length}
              </p>
            </div>
            <button type="button" onClick={onNext} className="rounded-lg border px-3 py-2 text-sm">
              ›
            </button>
          </div>
        </>
      ) : (
        <>
          <button type="button" onClick={onPrev} className="rounded-lg border px-3 py-2 text-sm">
            ‹
          </button>
          <div className="flex min-w-0 flex-1 items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={publicImageUrl(supabase, item.image_path) ?? ""}
              alt={displayName(item.name)}
              className="h-16 w-16 shrink-0 rounded-lg object-cover bg-white"
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{item.name.trim() || " "}</p>
            </div>
          </div>
          <button type="button" onClick={onNext} className="rounded-lg border px-3 py-2 text-sm">
            ›
          </button>
        </>
      )}
    </div>
  );
}
