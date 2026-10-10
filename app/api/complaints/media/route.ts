import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";
import { imageSize } from "image-size";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 8 * 1024 * 1024; // 8MB
const MIN_DIMENSION = 100;
const MAX_DIMENSION = 8000;

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file");
  const complaintId = String(formData.get("complaint_id") ?? "");
  const mediaType = String(formData.get("media_type") ?? "before");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  if (!complaintId) {
    return NextResponse.json({ error: "complaint_id required" }, { status: 400 });
  }
  if (mediaType !== "before" && mediaType !== "after") {
    return NextResponse.json({ error: "Invalid media_type" }, { status: 400 });
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: `Unsupported file type: ${file.type}. Use JPEG, PNG, or WebP.` },
      { status: 400 }
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File exceeds 8MB limit." }, { status: 400 });
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  let dimensions;
  try {
    dimensions = imageSize(buffer);
  } catch {
    return NextResponse.json(
      { error: "File is not a readable image (corrupt or invalid)." },
      { status: 400 }
    );
  }
  if (
    !dimensions.width ||
    !dimensions.height ||
    dimensions.width < MIN_DIMENSION ||
    dimensions.height < MIN_DIMENSION ||
    dimensions.width > MAX_DIMENSION ||
    dimensions.height > MAX_DIMENSION
  ) {
    return NextResponse.json(
      { error: `Image dimensions out of allowed range (${MIN_DIMENSION}-${MAX_DIMENSION}px).` },
      { status: 400 }
    );
  }

  const adminClient = createAdminClient();

  const { data: complaint, error: complaintError } = await adminClient
    .from("complaints")
    .select("id, college_id")
    .eq("id", complaintId)
    .maybeSingle();

  if (complaintError || !complaint) {
    return NextResponse.json({ error: "Complaint not found" }, { status: 404 });
  }

  // ── Plan Storage Quota Enforcement ──
  const { data: sub } = await adminClient
    .from("org_subscriptions")
    .select("status, plans(max_storage_gb)")
    .eq("college_id", complaint.college_id)
    .in("status", ["active", "trial", "grace", "manually_assigned"])
    .maybeSingle();

  const maxStorageGb = sub && (sub.plans as any)?.max_storage_gb !== undefined ? (sub.plans as any).max_storage_gb : 2; // Starter default (2 GB)
  if (maxStorageGb !== -1) {
    const maxStorageBytes = maxStorageGb * 1024 * 1024 * 1024;
    try {
      const { data: storageData } = await adminClient.rpc("get_storage_usage" as any);
      const collegeUsage = (storageData as any)?.by_college?.find(
        (c: any) => c.college_id === complaint.college_id
      );
      const currentBytes = collegeUsage?.bytes ?? 0;
      if (currentBytes + file.size > maxStorageBytes) {
        return NextResponse.json(
          {
            error: `Storage quota exceeded for your organisation's plan (${maxStorageGb} GB). Upgrade plan in Admin > Billing to upload more media.`,
          },
          { status: 403 }
        );
      }
    } catch (quotaErr) {
      console.warn("[media-upload] Storage quota check skipped due to RPC error:", quotaErr);
    }
  }

  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const storagePath = `${complaint.college_id}/${complaintId}/${crypto.randomUUID()}.${ext}`;

  // Upload to Backblaze B2 with Supabase Storage fallback
  let uploaded = false;
  try {
    const { uploadToB2 } = await import("@/lib/b2");
    await uploadToB2(storagePath, buffer, file.type);
    uploaded = true;
  } catch (err: any) {
    console.warn("Backblaze B2 upload error, attempting Supabase Storage fallback:", err);
    try {
      const { error: sbStorageErr } = await adminClient.storage
        .from("complaint-media")
        .upload(storagePath, buffer, { contentType: file.type, upsert: true });
      if (!sbStorageErr) {
        uploaded = true;
      } else {
        console.error("Supabase storage fallback error:", sbStorageErr);
      }
    } catch (fbErr) {
      console.error("Storage fallback failed:", fbErr);
    }
  }

  if (!uploaded) {
    return NextResponse.json({ error: "Failed to store image in storage backend." }, { status: 500 });
  }

  // Pre-warm in Redis cache so first view doesn't incur storage egress
  try {
    const { getRedis } = await import("@/lib/cache");
    const redis = getRedis();
    if (redis) {
      await redis.set(
        `media:v1:${storagePath}`,
        { base64: buffer.toString("base64"), contentType: file.type },
        { ex: 60 * 60 * 24 * 7 }
      );
    }
  } catch (err) {
    console.warn("Redis pre-cache warning:", err);
  }

  // Idempotency: if a row with the same key already exists, skip insert and return it
  const idempotencyKey = String(formData.get("idempotency_key") ?? "");
  if (idempotencyKey) {
    const { data: existing } = await adminClient
      .from("complaint_media")
      .select("id, storage_path")
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();
    if (existing) {
      return NextResponse.json({ media: existing });
    }
  }

  // Insert using adminClient to avoid RLS block for authenticated reporters
  const insertPayload: Record<string, any> = {
    complaint_id: complaintId,
    uploaded_by: user.id,
    storage_path: storagePath,
    media_type: mediaType,
  };
  if (idempotencyKey) insertPayload.idempotency_key = idempotencyKey;

  const { data: mediaRow, error: mediaError } = await adminClient
    .from("complaint_media")
    .insert(insertPayload)
    .select("id, storage_path")
    .single();

  if (mediaError) {
    return NextResponse.json({ error: mediaError.message }, { status: 400 });
  }

  return NextResponse.json({ media: mediaRow });
}
