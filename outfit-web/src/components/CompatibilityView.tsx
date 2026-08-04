"use client";

import { useItemOrder } from "@/components/ItemOrderProvider";
import { getCompatibilityMatches, CompatibilityFocus } from "@/lib/compatibility";
import { friendlySupabaseError } from "@/lib/supabase/errors";
import { createClient } from "@/lib/supabase/client";
import { publicImageUrl } from "@/lib/storage";
import { categoryLabel } from "@/lib/categoryOrder";
import {
  ClothingItem,
  OUTFIT_SLOT_CATEGORIES,
  SavedOutfit,
  displayName,
} from "@/lib/types";
import { SupabaseClient } from "@supabase/supabase-js";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type MatchKey = keyof ReturnType<typeof getCompatibilityMatches>;

const FOCUS_OPTIONS: { value: CompatibilityFocus; label: string }[] =
  OUTFIT_SLOT_CATEGORIES.map((slot) => ({ value: slot.value, label: slot.label }));

const MATCH_ROWS: {
  key: MatchKey;
  title: string;
  emptyLabel: string;
  focusValue?: CompatibilityFocus;
}[] = [
  { key: "tops", title: "Tops", emptyLabel: "No tops paired with this piece yet.", focusValue: "tops" },
  {
    key: "bottoms",
    title: "Bottoms",
    emptyLabel: "No bottoms paired with this piece yet.",
    focusValue: "bottoms",
  },
  {
    key: "dresses",
    title: "Dresses",
    emptyLabel: "No dresses paired with this piece yet.",
    focusValue: "dresses",
  },
  {
    key: "outerwear",
    title: "Outerwear",
    emptyLabel: "No outerwear paired with this piece yet.",
    focusValue: "outerwear",
  },
  {
    key: "shoes",
    title: "Shoes",
    emptyLabel: "No shoes paired with this piece yet.",
    focusValue: "shoes",
  },
  {
    key: "accessories",
    title: "Accessories",
    emptyLabel: "No accessories paired with this piece yet.",
  },
];

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
  const { orderedItems } = useItemOrder();
  const [items, setItems] = useState<ClothingItem[]>([]);
  const [outfits, setOutfits] = useState<SavedOutfit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [focus, setFocus] = useState<CompatibilityFocus>("tops");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [matchIndexes, setMatchIndexes] = useState(emptyIndexes);

  const focusItems = useMemo(() => orderedItems(focus, items), [orderedItems, focus, items]);
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

  const matchRows = useMemo(
    () => MATCH_ROWS.filter((row) => row.key !== focus),
    [focus]
  );

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

  const focusLabel = FOCUS_OPTIONS.find((option) => option.value === focus)?.label ?? "Item";

  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-xl font-bold text-zinc-900">Style</h1>
        <p className="mt-1 text-xs text-zinc-500">
          Pick a category, flip through pieces, and see what you’ve worn with them.
        </p>
      </section>

      {error && (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <section className="rounded-2xl border border-zinc-200 bg-white p-3">
        <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-zinc-500">
          Browse by
        </p>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {FOCUS_OPTIONS.map((option) => {
            const active = focus === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setFocus(option.value)}
                className={`shrink-0 rounded-xl px-3 py-2 text-sm font-semibold ${
                  active
                    ? "bg-zinc-900 text-white"
                    : "border border-zinc-200 bg-zinc-50 text-zinc-700"
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-900 bg-white p-4">
        <h2 className="text-sm font-semibold text-zinc-900">Selected {focusLabel}</h2>
        {focusItems.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">
            No {categoryLabel(focus).toLowerCase()} in your wardrobe yet.
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

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-zinc-800">Goes well with</h2>
        {!selectedItem ? (
          <p className="rounded-2xl border border-zinc-200 bg-white p-4 text-sm text-zinc-500">
            Add pieces in Wardrobe to start checking style matches.
          </p>
        ) : (
          matchRows.map((row) => {
            const matchItems = matches[row.key];
            return (
              <section key={row.key} className="rounded-2xl border border-zinc-200 bg-white p-4">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-zinc-800">{row.title}</h3>
                  <div className="flex items-center gap-2">
                    {matchItems.length > 0 && (
                      <span className="text-xs text-zinc-500">
                        {safeIndex(matchIndexes[row.key], matchItems.length) + 1} of{" "}
                        {matchItems.length}
                      </span>
                    )}
                    {row.focusValue && (
                      <button
                        type="button"
                        onClick={() => setFocus(row.focusValue!)}
                        className="rounded-lg border border-zinc-200 px-2 py-1 text-[11px] font-medium text-zinc-600"
                      >
                        Browse these
                      </button>
                    )}
                  </div>
                </div>
                <MatchBody
                  items={matchItems}
                  index={matchIndexes[row.key]}
                  onPrev={() =>
                    setMatchIndexes((m) => ({
                      ...m,
                      [row.key]: safeIndex(m[row.key] - 1, matchItems.length),
                    }))
                  }
                  onNext={() =>
                    setMatchIndexes((m) => ({
                      ...m,
                      [row.key]: safeIndex(m[row.key] + 1, matchItems.length),
                    }))
                  }
                  emptyLabel={row.emptyLabel}
                  supabase={supabase}
                />
              </section>
            );
          })
        )}
      </section>

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
  if (!item) return null;

  const touchStartX = useRef<number | null>(null);

  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.changedTouches[0]?.clientX ?? null;
  }

  function onTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current == null) return;
    const endX = e.changedTouches[0]?.clientX ?? touchStartX.current;
    const delta = endX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(delta) < 40) return;
    if (delta < 0) onNext();
    else onPrev();
  }

  return (
    <div
      className={`mt-3 flex items-center gap-3 ${large ? "flex-col" : ""}`}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
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
