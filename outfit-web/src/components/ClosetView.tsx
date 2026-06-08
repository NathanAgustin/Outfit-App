"use client";

import { friendlySupabaseError } from "@/lib/supabase/errors";
import { createClient } from "@/lib/supabase/client";
import {
  clothingImagePath,
  publicImageUrl,
  resizeImageFile,
  uploadImage,
  deleteImage,
} from "@/lib/storage";
import {
  CLOTHING_CATEGORIES,
  ClothingCategory,
  ClothingItem,
  displayName,
} from "@/lib/types";
import { SupabaseClient } from "@supabase/supabase-js";
import { useCallback, useEffect, useMemo, useState } from "react";

export function ClosetView() {
  const supabase = useMemo(() => createClient(), []);
  const [items, setItems] = useState<ClothingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState<ClothingCategory>("tops");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [editing, setEditing] = useState<ClothingItem | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadItems = useCallback(async () => {
    setLoading(true);
    const { data, error: fetchError } = await supabase
      .from("clothing_items")
      .select("*")
      .order("created_at", { ascending: false });

    if (fetchError) {
      setError(friendlySupabaseError(fetchError.message));
    } else {
      setItems(data ?? []);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  function onFileChange(selected: File | null) {
    setFile(selected);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(selected ? URL.createObjectURL(selected) : null);
  }

  async function handleAddItem() {
    if (!file) return;
    setUploading(true);
    setError(null);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");

      const itemId = crypto.randomUUID();
      const path = clothingImagePath(user.id, itemId);
      const blob = await resizeImageFile(file);
      await uploadImage(supabase, path, blob);

      const { error: insertError } = await supabase.from("clothing_items").insert({
        id: itemId,
        user_id: user.id,
        name: name.trim(),
        category,
        image_path: path,
      });

      if (insertError) throw insertError;

      setName("");
      setCategory("tops");
      onFileChange(null);
      await loadItems();
    } catch (err) {
      setError(friendlySupabaseError(err instanceof Error ? err.message : "Failed to add item"));
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(item: ClothingItem) {
    if (!confirm(`Delete ${displayName(item.name)}?`)) return;
    setError(null);

    const { error: deleteRowError } = await supabase
      .from("clothing_items")
      .delete()
      .eq("id", item.id);

    if (deleteRowError) {
      setError(friendlySupabaseError(deleteRowError.message));
      return;
    }

    try {
      await deleteImage(supabase, item.image_path);
    } catch {
      // Row already deleted; storage cleanup is best-effort.
    }

    await loadItems();
  }

  async function handleSaveEdit(updated: ClothingItem) {
    setError(null);
    const { error: updateError } = await supabase
      .from("clothing_items")
      .update({ name: updated.name, category: updated.category })
      .eq("id", updated.id);

    if (updateError) {
      setError(friendlySupabaseError(updateError.message));
      return;
    }

    setEditing(null);
    await loadItems();
  }

  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-xl font-bold text-zinc-900">Closet</h1>
        <p className="mt-1 text-sm text-zinc-600">Add clothing items to build outfits.</p>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-zinc-800">Add clothing item</h2>

        <label className="mt-3 flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-zinc-300 bg-zinc-50 px-4 py-6 text-center">
          <span className="text-sm font-medium text-zinc-700">Select or take photo</span>
          <span className="mt-1 text-xs text-zinc-500">Camera or photo library</span>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
          />
        </label>

        {preview && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preview}
            alt="Selected clothing preview"
            className="mt-3 h-44 w-full rounded-xl object-contain bg-zinc-100"
          />
        )}

        <input
          type="text"
          placeholder="Item name (optional)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-3 w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-sm"
        />

        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as ClothingCategory)}
          className="mt-3 w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-sm"
        >
          {CLOTHING_CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>

        <button
          type="button"
          disabled={!file || uploading}
          onClick={handleAddItem}
          className="mt-4 w-full rounded-xl bg-zinc-900 py-3 text-sm font-semibold text-white disabled:opacity-50"
        >
          {uploading ? "Uploading..." : "Add item"}
        </button>
      </section>

      {error && (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      {loading ? (
        <p className="text-sm text-zinc-500">Loading closet...</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-zinc-500">No items yet. Add your first clothing item above.</p>
      ) : (
        CLOTHING_CATEGORIES.map((cat) => {
          const categoryItems = items.filter((item) => item.category === cat.value);
          if (categoryItems.length === 0) return null;

          return (
            <section key={cat.value}>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-500">
                {cat.label}
              </h2>
              <ul className="space-y-2">
                {categoryItems.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white p-3"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={publicImageUrl(supabase, item.image_path) ?? ""}
                      alt={displayName(item.name)}
                      className="h-14 w-14 shrink-0 rounded-lg object-cover bg-zinc-100"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-zinc-900">
                        {displayName(item.name)}
                      </p>
                      <p className="text-xs text-zinc-500">{cat.label}</p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <button
                        type="button"
                        onClick={() => setEditing(item)}
                        className="rounded-lg border border-zinc-200 px-2 py-1 text-xs"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(item)}
                        className="rounded-lg border border-red-200 px-2 py-1 text-xs text-red-600"
                      >
                        Delete
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          );
        })
      )}

      {editing && (
        <EditItemModal
          item={editing}
          onClose={() => setEditing(null)}
          onSave={handleSaveEdit}
        />
      )}
    </div>
  );
}

function EditItemModal({
  item,
  onClose,
  onSave,
}: {
  item: ClothingItem;
  onClose: () => void;
  onSave: (item: ClothingItem) => void;
}) {
  const [name, setName] = useState(item.name);
  const [category, setCategory] = useState(item.category);

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/40 p-4 sm:items-center sm:justify-center">
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
        <h3 className="text-lg font-semibold">Edit item</h3>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-4 w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-sm"
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as ClothingCategory)}
          className="mt-3 w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-sm"
        >
          {CLOTHING_CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
        <div className="mt-4 flex gap-2">
          <button type="button" onClick={onClose} className="flex-1 rounded-xl border py-2.5 text-sm">
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onSave({ ...item, name: name.trim(), category })}
            className="flex-1 rounded-xl bg-zinc-900 py-2.5 text-sm font-semibold text-white"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
