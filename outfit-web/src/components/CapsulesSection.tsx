"use client";

import { DragHandleHint, SortableIdList } from "@/components/SortableIdList";
import { DEFAULT_CAPSULE_NAME, sortCapsulesForDisplay } from "@/lib/defaultCapsule";
import { outfitSummary, previewForOutfit } from "@/lib/outfitDisplay";
import {
  capsuleCoverPath,
  deleteImage,
  outfitPreviewPath,
  publicImageUrl,
  resizeImageFile,
  uploadImage,
} from "@/lib/storage";
import { friendlySupabaseError } from "@/lib/supabase/errors";
import { Capsule, CapsuleOutfit, ClothingItem, SavedOutfit } from "@/lib/types";
import { SupabaseClient } from "@supabase/supabase-js";
import { useEffect, useMemo, useRef, useState } from "react";

type CapsulesSectionProps = {
  supabase: SupabaseClient;
  items: ClothingItem[];
  outfits: SavedOutfit[];
  capsules: Capsule[];
  capsuleOutfits: CapsuleOutfit[];
  onRefresh: () => Promise<void>;
  onError: (message: string | null) => void;
  onLoadOutfit: (outfit: SavedOutfit) => void;
  onDeleteOutfit: (outfitId: string) => Promise<void>;
};

export function CapsulesSection({
  supabase,
  items,
  outfits,
  capsules,
  capsuleOutfits,
  onRefresh,
  onError,
  onLoadOutfit,
  onDeleteOutfit,
}: CapsulesSectionProps) {
  const [openCapsuleId, setOpenCapsuleId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");

  const orderedCapsules = useMemo(() => sortCapsulesForDisplay(capsules), [capsules]);
  const openCapsule = capsules.find((c) => c.id === openCapsuleId) ?? null;

  async function createCapsule() {
    const name = newName.trim();
    if (!name) return;
    onError(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const custom = capsules.filter((capsule) => !capsule.is_default);
    const sortOrder =
      custom.reduce((max, capsule) => Math.max(max, capsule.sort_order), 0) + 1;

    const { error } = await supabase.from("capsules").insert({
      user_id: user.id,
      name,
      sort_order: sortOrder,
      is_default: false,
    });

    if (error) {
      onError(friendlySupabaseError(error.message));
      return;
    }

    setNewName("");
    setCreating(false);
    await onRefresh();
  }

  async function deleteCapsule(capsule: Capsule) {
    if (capsule.is_default) return;
    if (!confirm(`Delete capsule “${capsule.name}”? Outfits stay in ${DEFAULT_CAPSULE_NAME}.`)) {
      return;
    }
    onError(null);
    const coverPath = capsule.cover_image_path;
    const { error } = await supabase.from("capsules").delete().eq("id", capsule.id);
    if (error) {
      onError(friendlySupabaseError(error.message));
      return;
    }
    if (coverPath) {
      try {
        await deleteImage(supabase, coverPath);
      } catch {
        // best-effort
      }
    }
    if (openCapsuleId === capsule.id) setOpenCapsuleId(null);
    await onRefresh();
  }

  if (openCapsule) {
    return (
      <CapsuleDetail
        capsule={openCapsule}
        supabase={supabase}
        items={items}
        outfits={outfits}
        memberships={capsuleOutfits.filter((row) => row.capsule_id === openCapsule.id)}
        onBack={() => setOpenCapsuleId(null)}
        onRefresh={onRefresh}
        onError={onError}
        onLoadOutfit={onLoadOutfit}
        onDeleteOutfit={onDeleteOutfit}
        onDeleted={() => setOpenCapsuleId(null)}
      />
    );
  }

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-zinc-800">Capsules</h2>
        <button
          type="button"
          onClick={() => {
            setEditing((v) => !v);
            setCreating(false);
          }}
          className="text-sm font-medium text-zinc-700"
        >
          {editing ? "Done" : "Edit"}
        </button>
      </div>

      {creating && (
        <div className="mt-3 flex items-center gap-2">
          <input
            type="text"
            placeholder="Capsule name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="min-w-0 flex-1 rounded-lg border border-zinc-200 px-3 py-2 text-sm"
            autoFocus
          />
          <button
            type="button"
            disabled={!newName.trim()}
            onClick={createCapsule}
            className="rounded-lg bg-zinc-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
          >
            Add
          </button>
          <button
            type="button"
            onClick={() => {
              setCreating(false);
              setNewName("");
            }}
            className="rounded-lg border px-3 py-2 text-xs"
          >
            Cancel
          </button>
        </div>
      )}

      <ul className="-mx-1 mt-4 flex gap-3 overflow-x-auto px-1 pb-1">
        <li className="w-24 shrink-0">
          <button
            type="button"
            onClick={() => {
              setCreating(true);
              setEditing(false);
            }}
            className="w-full text-left"
          >
            <span className="flex aspect-square w-full items-center justify-center rounded-xl border border-dashed border-zinc-300 bg-zinc-50 text-3xl text-zinc-400">
              +
            </span>
            <p className="mt-2 truncate text-center text-xs font-medium text-zinc-700">New</p>
          </button>
        </li>

        {orderedCapsules.map((capsule) => {
          const count = capsuleOutfits.filter((row) => row.capsule_id === capsule.id).length;
          const cover =
            publicImageUrl(supabase, capsule.cover_image_path) ??
            firstOutfitCover(supabase, capsule.id, capsuleOutfits, outfits, items);

          return (
            <li key={capsule.id} className="w-24 shrink-0">
              <button
                type="button"
                onClick={() => setOpenCapsuleId(capsule.id)}
                className="w-full text-left"
              >
                <div className="aspect-square w-full overflow-hidden rounded-xl bg-zinc-100">
                  {cover ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={cover} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-[10px] text-zinc-400">
                      Empty
                    </div>
                  )}
                </div>
                <p className="mt-2 truncate text-center text-xs font-medium text-zinc-900">
                  {capsule.name}
                </p>
                <p className="truncate text-center text-[10px] text-zinc-500">
                  {count} {count === 1 ? "Outfit" : "Outfits"}
                </p>
              </button>
              {editing && !capsule.is_default && (
                <button
                  type="button"
                  onClick={() => deleteCapsule(capsule)}
                  className="mt-1 w-full rounded-lg border border-red-200 py-1 text-[10px] text-red-600"
                >
                  Delete
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function firstOutfitCover(
  supabase: SupabaseClient,
  capsuleId: string,
  memberships: CapsuleOutfit[],
  outfits: SavedOutfit[],
  items: ClothingItem[]
): string | null {
  const ordered = memberships
    .filter((row) => row.capsule_id === capsuleId)
    .sort((a, b) => a.sort_order - b.sort_order);
  for (const row of ordered) {
    const outfit = outfits.find((o) => o.id === row.outfit_id);
    if (!outfit) continue;
    const url = previewForOutfit(supabase, outfit, items);
    if (url) return url;
  }
  return null;
}

function CapsuleDetail({
  capsule,
  supabase,
  items,
  outfits,
  memberships,
  onBack,
  onRefresh,
  onError,
  onLoadOutfit,
  onDeleteOutfit,
  onDeleted,
}: {
  capsule: Capsule;
  supabase: SupabaseClient;
  items: ClothingItem[];
  outfits: SavedOutfit[];
  memberships: CapsuleOutfit[];
  onBack: () => void;
  onRefresh: () => Promise<void>;
  onError: (message: string | null) => void;
  onLoadOutfit: (outfit: SavedOutfit) => void;
  onDeleteOutfit: (outfitId: string) => Promise<void>;
  onDeleted: () => void;
}) {
  const orderedOutfits = useMemo(() => {
    const sorted = [...memberships].sort((a, b) => a.sort_order - b.sort_order);
    return sorted
      .map((row) => outfits.find((outfit) => outfit.id === row.outfit_id))
      .filter((outfit): outfit is SavedOutfit => Boolean(outfit));
  }, [memberships, outfits]);

  const [index, setIndex] = useState(0);
  const [adding, setAdding] = useState(false);
  const [reorderMode, setReorderMode] = useState(false);
  const [coverPath, setCoverPath] = useState<string | null>(capsule.cover_image_path);
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    setIndex(0);
  }, [capsule.id]);

  useEffect(() => {
    setCoverPath(capsule.cover_image_path);
  }, [capsule.id, capsule.cover_image_path]);

  useEffect(() => {
    if (orderedOutfits.length === 0) {
      setIndex(0);
      return;
    }
    setIndex((i) => ((i % orderedOutfits.length) + orderedOutfits.length) % orderedOutfits.length);
  }, [orderedOutfits.length]);

  const current = orderedOutfits[index] ?? null;
  const availableToAdd = useMemo(() => {
    if (capsule.is_default) return [];
    return outfits.filter(
      (outfit) => !memberships.some((row) => row.outfit_id === outfit.id)
    );
  }, [capsule.is_default, outfits, memberships]);

  async function renameCapsule() {
    if (capsule.is_default) return;
    const name = prompt("Capsule name", capsule.name)?.trim();
    if (!name) return;
    onError(null);
    const { error } = await supabase.from("capsules").update({ name }).eq("id", capsule.id);
    if (error) onError(friendlySupabaseError(error.message));
    else await onRefresh();
  }

  async function setCover(file: File) {
    onError(null);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    try {
      const path = capsuleCoverPath(user.id, capsule.id);
      const blob = await resizeImageFile(file);
      await uploadImage(supabase, path, blob);
      const { error } = await supabase
        .from("capsules")
        .update({ cover_image_path: path })
        .eq("id", capsule.id);
      if (error) throw error;
      setCoverPath(path);
      await onRefresh();
    } catch (err) {
      onError(friendlySupabaseError(err instanceof Error ? err.message : "Failed to upload cover"));
    }
  }

  async function clearCover() {
    if (!coverPath) return;
    onError(null);
    const pathToRemove = coverPath;
    const { error } = await supabase
      .from("capsules")
      .update({ cover_image_path: null })
      .eq("id", capsule.id);
    if (error) {
      onError(friendlySupabaseError(error.message));
      return;
    }
    setCoverPath(null);
    try {
      await deleteImage(supabase, pathToRemove);
    } catch {
      // best-effort
    }
    await onRefresh();
  }

  async function deleteCapsule() {
    if (capsule.is_default) return;
    if (!confirm(`Delete capsule “${capsule.name}”? Outfits stay in ${DEFAULT_CAPSULE_NAME}.`)) {
      return;
    }
    onError(null);
    const coverPath = capsule.cover_image_path;
    const { error } = await supabase.from("capsules").delete().eq("id", capsule.id);
    if (error) {
      onError(friendlySupabaseError(error.message));
      return;
    }
    if (coverPath) {
      try {
        await deleteImage(supabase, coverPath);
      } catch {
        // best-effort
      }
    }
    await onRefresh();
    onDeleted();
  }

  async function addOutfit(outfitId: string) {
    onError(null);
    const sortOrder =
      memberships.reduce((max, row) => Math.max(max, row.sort_order), -1) + 1;
    const { error } = await supabase.from("capsule_outfits").insert({
      capsule_id: capsule.id,
      outfit_id: outfitId,
      sort_order: sortOrder,
    });
    if (error) onError(friendlySupabaseError(error.message));
    else {
      setAdding(false);
      await onRefresh();
    }
  }

  async function removeOrDeleteOutfit(outfitId: string) {
    if (capsule.is_default) {
      if (!confirm("Delete this outfit permanently?")) return;
      await onDeleteOutfit(outfitId);
      return;
    }
    if (!confirm(`Remove this outfit from “${capsule.name}”? It stays in ${DEFAULT_CAPSULE_NAME}.`)) {
      return;
    }
    onError(null);
    const { error } = await supabase
      .from("capsule_outfits")
      .delete()
      .eq("capsule_id", capsule.id)
      .eq("outfit_id", outfitId);
    if (error) onError(friendlySupabaseError(error.message));
    else await onRefresh();
  }

  async function setOutfitCover(file: File) {
    if (!current) return;
    onError(null);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    try {
      const path = outfitPreviewPath(user.id, current.id);
      const blob = await resizeImageFile(file);
      await uploadImage(supabase, path, blob);
      const { error } = await supabase
        .from("saved_outfits")
        .update({ preview_image_path: path, date_modified: new Date().toISOString() })
        .eq("id", current.id);
      if (error) throw error;
      await onRefresh();
    } catch (err) {
      onError(friendlySupabaseError(err instanceof Error ? err.message : "Failed to upload cover"));
    }
  }

  async function clearOutfitCover() {
    if (!current?.preview_image_path) return;
    onError(null);
    const { error } = await supabase
      .from("saved_outfits")
      .update({ preview_image_path: null, date_modified: new Date().toISOString() })
      .eq("id", current.id);
    if (error) onError(friendlySupabaseError(error.message));
    else await onRefresh();
  }

  async function reorderOutfits(activeId: string, overId: string) {
    const ids = orderedOutfits.map((outfit) => outfit.id);
    const oldIndex = ids.indexOf(activeId);
    const newIndex = ids.indexOf(overId);
    if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return;

    const next = [...ids];
    const [removed] = next.splice(oldIndex, 1);
    next.splice(newIndex, 0, removed);

    onError(null);
    const updates = next.map((outfitId, sort_order) =>
      supabase
        .from("capsule_outfits")
        .update({ sort_order })
        .eq("capsule_id", capsule.id)
        .eq("outfit_id", outfitId)
    );
    const results = await Promise.all(updates);
    const failed = results.find((result) => result.error);
    if (failed?.error) onError(friendlySupabaseError(failed.error.message));
    else await onRefresh();
  }

  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.changedTouches[0]?.clientX ?? null;
  }

  function onTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current == null || orderedOutfits.length < 2) return;
    const endX = e.changedTouches[0]?.clientX ?? touchStartX.current;
    const delta = endX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(delta) < 40) return;
    setIndex((i) => {
      const next = delta < 0 ? i + 1 : i - 1;
      return ((next % orderedOutfits.length) + orderedOutfits.length) % orderedOutfits.length;
    });
  }

  return (
    <section className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-4">
      <div className="flex items-start justify-between gap-2">
        <button type="button" onClick={onBack} className="text-sm font-medium text-zinc-600">
          ‹ Capsules
        </button>
        <div className="flex flex-wrap justify-end gap-2">
          {!capsule.is_default && (
            <button type="button" onClick={renameCapsule} className="rounded-lg border px-2 py-1 text-xs">
              Rename
            </button>
          )}
          <CoverPhotoButton label="Capsule Cover" onPick={setCover} />
          {coverPath && (
            <button
              type="button"
              onClick={clearCover}
              className="rounded-xl border border-zinc-200 px-3 py-2 text-sm"
            >
              Clear Cover
            </button>
          )}
          {!capsule.is_default && (
            <button
              type="button"
              onClick={deleteCapsule}
              className="rounded-lg border border-red-200 px-2 py-1 text-xs text-red-600"
            >
              Delete
            </button>
          )}
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-zinc-900">{capsule.name}</h2>
        <p className="text-xs text-zinc-500">
          {orderedOutfits.length} {orderedOutfits.length === 1 ? "outfit" : "outfits"} · swipe to browse
        </p>
      </div>

      {orderedOutfits.length === 0 ? (
        <p className="text-sm text-zinc-500">
          {capsule.is_default
            ? "No outfits yet. Save one from the builder above."
            : `No outfits in this capsule yet. Add some from ${DEFAULT_CAPSULE_NAME}.`}
        </p>
      ) : (
        <div className="select-none" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                setIndex(
                  (i) =>
                    ((i - 1) % orderedOutfits.length + orderedOutfits.length) %
                    orderedOutfits.length
                )
              }
              className="shrink-0 rounded-lg border border-zinc-200 px-3 py-10 text-lg text-zinc-700"
              aria-label="Previous outfit"
            >
              ‹
            </button>
            <div className="min-w-0 flex-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewForOutfit(supabase, current!, items) ?? ""}
                alt=""
                className="h-56 w-full rounded-xl object-contain bg-white"
              />
              <p className="mt-2 text-center text-xs text-zinc-500">
                {index + 1} of {orderedOutfits.length}
              </p>
              <p className="mt-1 line-clamp-2 text-center text-xs text-zinc-600">
                {outfitSummary(current!, items)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIndex((i) => (i + 1) % orderedOutfits.length)}
              className="shrink-0 rounded-lg border border-zinc-200 px-3 py-10 text-lg text-zinc-700"
              aria-label="Next outfit"
            >
              ›
            </button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={orderedOutfits.length < 2}
              onClick={() => setReorderMode((v) => !v)}
              className="flex-1 rounded-xl border border-zinc-300 py-2 text-sm font-medium disabled:opacity-50"
            >
              {reorderMode ? "Done Sorting" : "Reorder"}
            </button>
            <CoverPhotoButton label="The Look" onPick={setOutfitCover} />
            {current?.preview_image_path && (
              <button
                type="button"
                onClick={clearOutfitCover}
                className="rounded-xl border border-zinc-300 px-3 py-2 text-sm font-medium"
              >
                Default image
              </button>
            )}
            <button
              type="button"
              onClick={() => current && removeOrDeleteOutfit(current.id)}
              className="rounded-xl border border-red-200 px-3 py-2 text-sm text-red-600"
            >
              {capsule.is_default ? "Delete" : "Remove"}
            </button>
          </div>
        </div>
      )}

      <div className="flex gap-2">
        {!capsule.is_default && (
          <button
            type="button"
            onClick={() => setAdding((v) => !v)}
            className="flex-1 rounded-xl border border-zinc-300 py-2 text-sm font-medium"
          >
            {adding ? "Done adding" : `Add from ${DEFAULT_CAPSULE_NAME}`}
          </button>
        )}
        {orderedOutfits.length > 0 && (
          <button
            type="button"
            onClick={() => current && onLoadOutfit(current)}
            className="flex-1 rounded-xl bg-zinc-900 py-2 text-sm font-semibold text-white"
          >
            Load in Builder
          </button>
        )}
      </div>

      {adding && !capsule.is_default && (
        <div className="rounded-xl border border-zinc-200 p-3">
          {availableToAdd.length === 0 ? (
            <p className="text-sm text-zinc-500">
              All outfits from {DEFAULT_CAPSULE_NAME} are already in this capsule.
            </p>
          ) : (
            <ul className="grid grid-cols-3 gap-2">
              {availableToAdd.map((outfit) => (
                <li key={outfit.id}>
                  <button
                    type="button"
                    onClick={() => addOutfit(outfit.id)}
                    className="w-full overflow-hidden rounded-lg border border-zinc-200"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={previewForOutfit(supabase, outfit, items) ?? ""}
                      alt=""
                      className="aspect-square w-full object-cover bg-zinc-100"
                    />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {reorderMode && orderedOutfits.length > 0 && (
        <div className="rounded-xl border border-zinc-200 p-3">
          <p className="mb-2 text-xs text-zinc-500">Hold the grip, then drag to reorder.</p>
          <SortableIdList
            ids={orderedOutfits.map((outfit) => outfit.id)}
            onReorder={reorderOutfits}
          >
            {(id, drag) => {
              const outfit = orderedOutfits.find((entry) => entry.id === id);
              if (!outfit) return null;
              return (
                <div className="flex items-center gap-3 rounded-xl border border-zinc-200 p-2">
                  <DragHandleHint {...drag} />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={previewForOutfit(supabase, outfit, items) ?? ""}
                    alt=""
                    className="h-12 w-12 rounded-lg object-cover bg-zinc-100"
                  />
                  <p className="min-w-0 flex-1 truncate text-xs text-zinc-600">
                    {outfitSummary(outfit, items)}
                  </p>
                </div>
              );
            }}
          </SortableIdList>
        </div>
      )}
    </section>
  );
}

function CoverPhotoButton({
  onPick,
  label = "Cover photo",
}: {
  onPick: (file: File) => void;
  label?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const isTheLook = label === "The Look";
  return (
    <>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className={
          isTheLook
            ? "flex-1 rounded-xl border border-zinc-300 py-2 text-sm font-medium"
            : "rounded-xl border border-zinc-200 px-3 py-2 text-sm"
        }
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
