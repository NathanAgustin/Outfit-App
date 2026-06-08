import type { SupabaseClient } from "@supabase/supabase-js";

const BUCKET = "clothing-images";

export function clothingImagePath(userId: string, itemId: string) {
  return `${userId}/items/${itemId}.jpg`;
}

export function outfitPreviewPath(userId: string, outfitId: string) {
  return `${userId}/outfits/${outfitId}/preview.jpg`;
}

export function publicImageUrl(
  supabase: SupabaseClient,
  path: string | null | undefined
): string | null {
  if (!path) return null;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export async function uploadImage(
  supabase: SupabaseClient,
  path: string,
  file: File | Blob
) {
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    upsert: true,
    contentType: "image/jpeg",
  });
  if (error) throw error;
}

export async function deleteImage(supabase: SupabaseClient, path: string) {
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) throw error;
}

export async function resizeImageFile(file: File, maxSize = 1400): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not process image");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Could not compress image"))),
      "image/jpeg",
      0.82
    );
  });
}
