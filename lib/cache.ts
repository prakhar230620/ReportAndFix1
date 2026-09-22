import { Redis } from "@upstash/redis";

let redis: Redis | null = null;
let checked = false;

function getRedis(): Redis | null {
  if (checked) return redis;
  checked = true;
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (url && token) {
    redis = new Redis({ url, token });
  }
  return redis;
}

/**
 * Cache-aside helper: returns the cached value if present, otherwise calls
 * `fetcher`, stores the result for `ttlSeconds`, and returns it.
 *
 * If Upstash Redis isn't connected (no env vars set), this is a pure
 * pass-through to `fetcher` -- callers work identically either way, so
 * connecting Redis later is a zero-code-change speed-up, not a
 * requirement.
 */
export async function cached<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>
): Promise<T> {
  const client = getRedis();
  if (!client) return fetcher();

  try {
    const hit = await client.get<T>(key);
    if (hit !== null && hit !== undefined) return hit;
  } catch {
    // Redis hiccup -- fall through to a normal (uncached) fetch rather
    // than failing the page.
  }

  const value = await fetcher();
  try {
    await client.set(key, value, { ex: ttlSeconds });
  } catch {
    // Non-fatal -- the page still got its data.
  }
  return value;
}

/** Delete one or more cache keys, e.g. after a write that invalidates them. */
export async function invalidateCache(...keys: string[]) {
  const client = getRedis();
  if (!client || keys.length === 0) return;
  try {
    await client.del(...keys);
  } catch {
    // Non-fatal.
  }
}
