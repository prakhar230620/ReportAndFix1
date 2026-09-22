import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

const ALLOWED = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
const MAX_BYTES = 2 * 1024 * 1024;

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "super_admin") {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const form = await req.formData();
  const file = form.get("file") as File | null;
  const collegeId = form.get("college_id") as string | null;
  if (!file || !collegeId) return NextResponse.json({ error: "Missing file or college_id" }, { status: 400 });
  if (!ALLOWED.includes(file.type)) return NextResponse.json({ error: "Unsupported image type" }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "Logo must be under 2MB" }, { status: 400 });

  const ext = file.name.split(".").pop() || "png";
  const path = `${collegeId}/logo-${Date.now()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await supabase.storage
    .from("college-logos")
    .upload(path, buffer, { contentType: file.type, upsert: true });
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 400 });

  const { data: publicUrl } = supabase.storage.from("college-logos").getPublicUrl(path);

  const { error: updateError } = await supabase
    .from("colleges")
    .update({ logo_url: publicUrl.publicUrl })
    .eq("id", collegeId);
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 400 });

  return NextResponse.json({ url: publicUrl.publicUrl });
}
