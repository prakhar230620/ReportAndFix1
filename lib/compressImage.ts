/**
 * Compresses an image File in the browser before upload.
 * - Caps the longest side at MAX_DIMENSION (detail like cracks/labels stays
 *   readable at this size; going smaller starts to lose the thing that
 *   actually shows what's wrong).
 * - Re-encodes as JPEG, stepping quality down until under TARGET_BYTES,
 *   but never below MIN_QUALITY -- past that point quality loss stops
 *   saving meaningful bytes and starts costing legibility, so we accept a
 *   slightly larger file over a blurry one.
 */

const MAX_DIMENSION = 1600;
const TARGET_BYTES = 300 * 1024;
const MIN_QUALITY = 0.5;

export async function compressImage(file: File): Promise<File> {
  // Not a raster type we can safely re-encode (or already tiny) -- skip.
  if (!file.type.startsWith("image/") || file.size < TARGET_BYTES) {
    return file;
  }

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();

    let quality = 0.85;
    let blob: Blob | null = await canvasToBlob(canvas, quality);

    while (blob && blob.size > TARGET_BYTES && quality > MIN_QUALITY) {
      quality -= 0.1;
      blob = await canvasToBlob(canvas, quality);
    }

    if (!blob) return file;

    const newName = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], newName, { type: "image/jpeg" });
  } catch {
    // Any failure (unsupported format, browser quirk) -- fall back to the
    // original file rather than blocking the report.
    return file;
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
}
