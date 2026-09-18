import { createClient } from "@/lib/supabase/server";
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

  const { data: complaint, error: complaintError } = await supabase
    .from("complaints")
    .select("id, college_id")
    .eq("id", complaintId)
    .maybeSingle();

  if (complaintError || !complaint) {
    return NextResponse.json({ error: "Complaint not found" }, { status: 404 });
  }

  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const storagePath = `${complaint.college_id}/${complaintId}/${crypto.randomUUID()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("complaint-media")
    .upload(storagePath, buffer, { contentType: file.type });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 400 });
  }

  const { data: mediaRow, error: mediaError } = await supabase
    .from("complaint_media")
    .insert({
      complaint_id: complaintId,
      uploaded_by: user.id,
      storage_path: storagePath,
      media_type: mediaType,
    })
    .select("id, storage_path")
    .single();

  if (mediaError) {
    return NextResponse.json({ error: mediaError.message }, { status: 400 });
  }

  return NextResponse.json({ media: mediaRow });
}
