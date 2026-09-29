import { NextRequest, NextResponse } from "next/server";
import { getRedis } from "@/lib/cache";
import { getFromB2 } from "@/lib/b2";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const path = searchParams.get("path");

  if (!path) {
    return new NextResponse("Missing file path", { status: 400 });
  }

  const cacheKey = `media:v1:${path}`;
  const redis = getRedis();

  // 1. Check Redis cache first to prevent database/B2 egress costs
  if (redis) {
    try {
      const cached = await redis.get<{ base64: string; contentType: string }>(cacheKey);
      if (cached && cached.base64) {
        const buffer = Buffer.from(cached.base64, "base64");
        return new NextResponse(new Uint8Array(buffer), {
          status: 200,
          headers: {
            "Content-Type": cached.contentType || "image/jpeg",
            "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800, immutable",
            "X-Cache": "HIT-REDIS",
          },
        });
      }
    } catch (err) {
      console.warn("Redis read error for media:", err);
    }
  }

  // 2. Fetch from Backblaze B2
  let fileData: { buffer: Buffer; contentType: string } | null = null;
  try {
    fileData = await getFromB2(path);
  } catch (err) {
    console.error("B2 fetch error:", err);
  }

  // 3. Fallback to Supabase storage for backward compatibility with legacy uploaded files
  if (!fileData) {
    try {
      const adminClient = createAdminClient();
      const { data: blob, error } = await adminClient.storage
        .from("complaint-media")
        .download(path);

      if (!error && blob) {
        const arrayBuf = await blob.arrayBuffer();
        fileData = {
          buffer: Buffer.from(arrayBuf),
          contentType: blob.type || "image/jpeg",
        };
      }
    } catch (err) {
      // Legacy fallback error
    }
  }

  if (!fileData) {
    return new NextResponse("Media not found", { status: 404 });
  }

  // 4. Store in Redis cache for all subsequent requests
  if (redis) {
    try {
      // 7 days TTL (604800 seconds)
      await redis.set(
        cacheKey,
        {
          base64: fileData.buffer.toString("base64"),
          contentType: fileData.contentType,
        },
        { ex: 60 * 60 * 24 * 7 }
      );
    } catch (err) {
      console.warn("Redis write error for media:", err);
    }
  }

  return new NextResponse(new Uint8Array(fileData.buffer), {
    status: 200,
    headers: {
      "Content-Type": fileData.contentType,
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800, immutable",
      "X-Cache": "MISS-STORED-REDIS",
    },
  });
}
