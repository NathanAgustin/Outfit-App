"use client";

import { getCompatibilityMatches, CompatibilityFocus } from "@/lib/compatibility";
import { friendlySupabaseError } from "@/lib/supabase/errors";
import { createClient } from "@/lib/supabase/client";
import { publicImageUrl } from "@/lib/storage";
import { ClothingItem, SavedOutfit, displayName } from "@/lib/types";
import { SupabaseClient } from "@supabase/supabase-js";
import { useCallback, useEffect, useMemo, useState } from "react";

const FOCUS_OPTIONS: { value: CompatibilityFocus; label: string }[] = [
  { value: "tops", label: "Top" },
  { value: "bottoms", label: "Bottom" },
  { value: "shoes", label: "Shoes" },
];

function safeIndex(index: number, count: number) {
  if (count === 0) return 0;
  return ((index % count) + count) % count;
}

export function CompatibilityView() {
  const supabase = useMemo(() => createClient(), []);
  const [items, setItems] = useState<ClothingItem[]>([]);
  const [outfits, setOutfits] = useState<SavedOutfit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [focus, setFocus] = useState<CompatibilityFocus>("tops");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [matchIndexes, setMatchIndexes] = useState({
    tops: 0,
    bottoms: 0,
    shoes: 0,
    accessories: 0,
  });

  const focusItems = useMemo(
    () => items.filter((item) => item.category === focus),
    [items, focus]
  );

  const selectedItem = focusItems[safeIndex(selectedIndex, focusItems.length)] ?? null;

  const matches = useMemo(() => {
    if (!selectedItem) {
      return { tops: [], bottoms: [], shoes: [], accessories: [] };
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
    else setItems(itemsRes.data ?? []);

    if (outfitsRes.error) setError(friendlySupabaseError(outfitsRes.error.message));
    else setOutfits(outfitsRes.data ?? []);

    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    setSelectedIndex(0);
    setMatchIndexes({ tops: 0, bottoms: 0, shoes: 0, accessories: 0 });
  }, [focus]);

  useEffect(() => {
    setSelectedIndex((i) => safeIndex(i, focusItems.length));
  }, [focusItems.length]);

  useEffect(() => {
    setMatchIndexes({ tops: 0, bottoms: 0, shoes: 0, accessories: 0 });
  }, [selectedItem?.id]);

  if (loading) {
    return <p className="text-sm text-zinc-500">Loading compatibility...</p>;
  }

  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-xl font-bold text-zinc-900">Compatibility</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Pick a piece and browse what you&apos;ve already worn with it in saved outfits.
        </p>
      </section>

      {error && (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <section className="rounded-2xl border border-zinc-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-zinc-800">Select category</h2>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {FOCUS_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setFocus(option.value)}
              className={`rounded-xl py-2.5 text-sm font-medium ${
                focus === option.value
                  ? "bg-zinc-900 text-white"
                  : "border border-zinc-200 text-zinc-700"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-zinc-800">Selected {FOCUS_OPTIONS.find((o) => o.value === focus)?.label}</h2>
        {focusItems.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">
            No {focus} in your closet yet. Add some in Closet, then save outfits.
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

      {selectedItem && outfits.length === 0 && (
        <p className="rounded-xl bg-white p-4 text-sm text-zinc-600 shadow-sm ring-1 ring-zinc-200">
          No saved outfits yet. Save outfits in Outfit Manager so compatibility can find matches.
        </p>
      )}

      {selectedItem && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-zinc-800">Matches from your outfits</h2>

          {focus !== "tops" && (
            <MatchRow
              title="Tops"
              items={matches.tops}
              index={matchIndexes.tops}
              onPrev={() =>
                setMatchIndexes((m) => ({
                  ...m,
                  tops: safeIndex(m.tops - 1, matches.tops.length),
                }))
              }
              onNext={() =>
                setMatchIndexes((m) => ({
                  ...m,
                  tops: safeIndex(m.tops + 1, matches.tops.length),
                }))
              }
              emptyLabel="No tops paired with this piece yet."
              supabase={supabase}
            />
          )}

          {focus !== "bottoms" && (
            <MatchRow
              title="Bottoms"
              items={matches.bottoms}
              index={matchIndexes.bottoms}
              onPrev={() =>
                setMatchIndexes((m) => ({
                  ...m,
                  bottoms: safeIndex(m.bottoms - 1, matches.bottoms.length),
                }))
              }
              onNext={() =>
                setMatchIndexes((m) => ({
                  ...m,
                  bottoms: safeIndex(m.bottoms + 1, matches.bottoms.length),
                }))
              }
              emptyLabel="No bottoms paired with this piece yet."
              supabase={supabase}
            />
          )}

          {focus !== "shoes" && (
            <MatchRow
              title="Shoes"
              items={matches.shoes}
              index={matchIndexes.shoes}
              onPrev={() =>
                setMatchIndexes((m) => ({
                  ...m,
                  shoes: safeIndex(m.shoes - 1, matches.shoes.length),
                }))
              }
              onNext={() =>
                setMatchIndexes((m) => ({
                  ...m,
                  shoes: safeIndex(m.shoes + 1, matches.shoes.length),
                }))
              }
              emptyLabel="No shoes paired with this piece yet."
              supabase={supabase}
            />
          )}

          <MatchRow
            title="Accessories"
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
        </section>
      )}
    </div>
  );
}

function MatchRow({
  title,
  items,
  index,
  onPrev,
  onNext,
  emptyLabel,
  supabase,
}: {
  title: string;
  items: ClothingItem[];
  index: number;
  onPrev: () => void;
  onNext: () => void;
  emptyLabel: string;
  supabase: SupabaseClient;
}) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-800">{title}</h3>
        {items.length > 0 && (
          <span className="text-xs text-zinc-500">
            {safeIndex(index, items.length) + 1} of {items.length}
          </span>
        )}
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-zinc-500">{emptyLabel}</p>
      ) : (
        <ItemCarousel
          items={items}
          index={safeIndex(index, items.length)}
          onPrev={onPrev}
          onNext={onNext}
          supabase={supabase}
        />
      )}
    </div>
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
            className="h-48 w-full rounded-xl object-contain bg-zinc-50"
          />
          <div className="flex w-full items-center gap-3">
            <button type="button" onClick={onPrev} className="rounded-lg border px-3 py-2 text-sm">
              ‹
            </button>
            <div className="min-w-0 flex-1 text-center">
              <p className="truncate text-sm font-medium">{displayName(item.name)}</p>
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
              className="h-16 w-16 shrink-0 rounded-lg object-cover bg-zinc-100"
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{displayName(item.name)}</p>
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
