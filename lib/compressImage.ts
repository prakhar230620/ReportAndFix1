/**
 * Client-side Adaptive Image Compression Engine
 *
 * Workflow Rules:
 * 1. Always stores and caches original clicked/selected image in browser cache (memory Map).
 * 2. Starts with maximum compression budget under 100 KB (102,400 bytes).
 * 3. Never pads empty bits to hit the limit (if good quality at 70 KB, keep 70 KB).
 * 4. If image quality degrades at 100 KB, discards compressed file and re-compresses
 *    the pristine ORIGINAL image from browser cache with +25 KB increment (125 KB).
 * 5. Repeats incrementation (+25 KB steps: 100KB -> 125KB -> 150KB -> 175KB max).
 * 6. Hard limit of 175 KB. If quality still degraded at 175 KB, converts the original
 *    image into a thumbnail and compresses under 300 KB.
 * 7. Lightning-fast execution using createImageBitmap and optimized canvas encoding.
 */

// Browser memory cache for original pristine images
const originalImageCache = new Map<string, { file: File; bitmap?: ImageBitmap }>();

const KB = 1024;
const INITIAL_BUDGET = 100 * KB; // 100 KB
const BUDGET_INCREMENT = 25 * KB; // +25 KB
const MAX_BUDGET = 175 * KB; // 175 KB
const THUMBNAIL_FALLBACK_BUDGET = 300 * KB; // 300 KB for thumbnail fallback

const STANDARD_MAX_DIMENSION = 1600;
const THUMBNAIL_MAX_DIMENSION = 800;

// Quality threshold: Below 0.73 in WebP/JPEG, human eye begins noticing compression artifacts/banding
const MIN_ACCEPTABLE_QUALITY = 0.73;

export function cacheOriginalImage(key: string, file: File) {
  originalImageCache.set(key, { file });
}

export function getCachedOriginalImage(key: string): File | undefined {
  return originalImageCache.get(key)?.file;
}

export function clearOriginalImageCache() {
  for (const item of originalImageCache.values()) {
    item.bitmap?.close?.();
  }
  originalImageCache.clear();
}

/**
 * Checks whether an encoded image has acceptable quality vs degraded.
 * Evaluates quality factor, size ratio, and samples pixel fidelity (MSE/PSNR).
 */
async function assessQuality(
  originalCanvas: HTMLCanvasElement | OffscreenCanvas,
  compressedBlob: Blob,
  appliedQuality: number
): Promise<boolean> {
  // If quality factor dropped below acceptable threshold, it's considered degraded
  if (appliedQuality < MIN_ACCEPTABLE_QUALITY) {
    return false;
  }

  // Fast pixel fidelity check using a small 64x64 sample
  try {
    const compBitmap = await createImageBitmap(compressedBlob);
    const sampleSize = 64;
    const testCanvas = document.createElement("canvas");
    testCanvas.width = sampleSize;
    testCanvas.height = sampleSize;
    const ctx = testCanvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) {
      compBitmap.close?.();
      return true;
    }

    // Draw original sampled
    ctx.drawImage(originalCanvas as CanvasImageSource, 0, 0, sampleSize, sampleSize);
    const origData = ctx.getImageData(0, 0, sampleSize, sampleSize).data;

    // Draw compressed sampled
    ctx.clearRect(0, 0, sampleSize, sampleSize);
    ctx.drawImage(compBitmap, 0, 0, sampleSize, sampleSize);
    const compData = ctx.getImageData(0, 0, sampleSize, sampleSize).data;
    compBitmap.close?.();

    // Calculate Mean Squared Error (MSE)
    let sumSquaredError = 0;
    const totalPixels = sampleSize * sampleSize;
    for (let i = 0; i < origData.length; i += 4) {
      const dr = origData[i] - compData[i];
      const dg = origData[i + 1] - compData[i + 1];
      const db = origData[i + 2] - compData[i + 2];
      sumSquaredError += (dr * dr + dg * dg + db * db) / 3;
    }
    const mse = sumSquaredError / totalPixels;

    // PSNR calculation: 10 * log10(255^2 / MSE)
    // PSNR < 30 dB indicates noticeable visual degradation
    if (mse > 0) {
      const psnr = 10 * Math.log10((255 * 255) / mse);
      if (psnr < 30) {
        return false; // Quality degraded
      }
    }
  } catch {
    // If browser doesn't support sampling, rely on appliedQuality check
  }

  return true; // Quality preserved
}

/**
 * Encodes canvas to Blob with target format (WebP with JPEG fallback)
 */
async function encodeCanvas(
  canvas: HTMLCanvasElement,
  format: "image/webp" | "image/jpeg",
  quality: number
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else if (format === "image/webp") {
          // Fallback to JPEG if WebP encoding is unsupported
          canvas.toBlob(resolve, "image/jpeg", quality);
        } else {
          resolve(null);
        }
      },
      format,
      quality
    );
  });
}

/**
 * Attempts to compress a pristine original image to fit within a specific byte budget
 * without degrading quality.
 */
async function attemptCompression(
  originalFile: File,
  maxDimension: number,
  byteBudget: number
): Promise<{ blob: Blob | null; isHighQuality: boolean; finalQuality: number }> {
  const bitmap = await createImageBitmap(originalFile);
  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) {
    bitmap.close?.();
    return { blob: null, isHighQuality: false, finalQuality: 0 };
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();

  // Try high quality first (0.85). If it fits within budget, we are done in 1 pass!
  let quality = 0.85;
  let blob = await encodeCanvas(canvas, "image/webp", quality);

  // Fast binary-style quality search if needed
  if (blob && blob.size > byteBudget) {
    let low = 0.65;
    let high = 0.85;
    let bestBlob: Blob | null = null;
    let bestQuality = quality;

    for (let i = 0; i < 4; i++) {
      const mid = (low + high) / 2;
      const testBlob = await encodeCanvas(canvas, "image/webp", mid);
      if (testBlob) {
        if (testBlob.size <= byteBudget) {
          bestBlob = testBlob;
          bestQuality = mid;
          low = mid; // Try to get higher quality still under budget
        } else {
          high = mid; // Needs more compression
        }
      }
    }

    if (bestBlob) {
      blob = bestBlob;
      quality = bestQuality;
    } else {
      // Smallest attempt
      blob = await encodeCanvas(canvas, "image/webp", low);
      quality = low;
    }
  }

  if (!blob) {
    return { blob: null, isHighQuality: false, finalQuality: 0 };
  }

  const isHighQuality =
    blob.size <= byteBudget && (await assessQuality(canvas, blob, quality));

  return { blob, isHighQuality, finalQuality: quality };
}

/**
 * Main adaptive client-side compression function:
 * 1. Caches original clicked image.
 * 2. Attempts compression under 100 KB.
 * 3. If quality degrades, increments budget by 25 KB (125KB, 150KB, 175KB max),
 *    recompressing from the original cached image each time.
 * 4. If quality cannot be preserved at 175 KB, creates a thumbnail under 300 KB.
 */
export async function compressImage(file: File): Promise<File> {
  // Not an image file - return as is
  if (!file.type.startsWith("image/")) {
    return file;
  }

  // 1. Store original pristine image in browser cache
  const cacheKey = `${file.name}-${file.size}-${file.lastModified}`;
  cacheOriginalImage(cacheKey, file);

  try {
    let currentBudget = INITIAL_BUDGET; // Start at 100 KB
    let chosenBlob: Blob | null = null;

    // Iterative adaptive loop: 100 KB -> 125 KB -> 150 KB -> 175 KB
    while (currentBudget <= MAX_BUDGET) {
      // ALWAYS retrieve the pristine original from cache
      const pristineOriginal = getCachedOriginalImage(cacheKey) || file;

      const result = await attemptCompression(
        pristineOriginal,
        STANDARD_MAX_DIMENSION,
        currentBudget
      );

      if (result.blob && result.blob.size <= currentBudget && result.isHighQuality) {
        // High quality achieved within the current budget! Do NOT pad empty bits.
        chosenBlob = result.blob;
        break;
      }

      // If quality is degraded or size exceeded, remove attempt and increment budget by 25 KB
      currentBudget += BUDGET_INCREMENT;
    }

    // Fallback: If 175 KB limit was crossed without achieving high quality,
    // convert into a thumbnail and recompress under 300 KB
    if (!chosenBlob) {
      const pristineOriginal = getCachedOriginalImage(cacheKey) || file;
      const thumbnailResult = await attemptCompression(
        pristineOriginal,
        THUMBNAIL_MAX_DIMENSION,
        THUMBNAIL_FALLBACK_BUDGET
      );

      if (thumbnailResult.blob && thumbnailResult.blob.size <= THUMBNAIL_FALLBACK_BUDGET) {
        chosenBlob = thumbnailResult.blob;
      }
    }

    if (!chosenBlob) {
      return file;
    }

    // Keep clean file extension (.webp or .jpg)
    const ext = chosenBlob.type === "image/webp" ? ".webp" : ".jpg";
    const newName = file.name.replace(/\.[^.]+$/, "") + ext;
    return new File([chosenBlob], newName, { type: chosenBlob.type });
  } catch (err) {
    console.error("Client-side compression fallback to original:", err);
    return file;
  }
}
