import { invalidateCache } from "./cache";

/**
 * Returns a media streaming URL that routes through Redis cache and Backblaze B2.
 * Browser caching headers ensure repeat visits on client-side are instantaneous,
 * and Redis caching prevents costly B2/database egress calls.
 */
export function getMediaUrl(storagePath: string | null | undefined): string | null {
  if (!storagePath) return null;
  // If it's already a full URL (legacy or external), return as is
  if (storagePath.startsWith("http://") || storagePath.startsWith("https://")) {
    return storagePath;
  }
  return `/api/media?path=${encodeURIComponent(storagePath)}`;
}

/**
 * Invalidates Redis cache for a specific media storage path (e.g. after modification/deletion)
 */
export async function invalidateMediaCache(storagePath: string) {
  if (!storagePath) return;
  const cacheKey = `media:v1:${storagePath}`;
  await invalidateCache(cacheKey);
}
