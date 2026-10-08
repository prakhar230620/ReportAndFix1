import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/** Generate a random 6-char uppercase alphanumeric code */
function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Removed ambiguous chars
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const adminClient = createAdminClient();
  const { data: profile } = await adminClient
    .from("profiles")
    .select("role, college_id")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "college_admin") {
    return NextResponse.json({ error: "Only organisation admins can generate join codes." }, { status: 403 });
  }

  const collegeId = profile.college_id!;

  // Deactivate old codes (but DON'T invalidate existing sessions)
  await adminClient
    .from("org_join_codes")
    .update({ is_active: false })
    .eq("college_id", collegeId)
    .eq("is_active", true);

  // Generate unique code
  let code = generateCode();
  let attempts = 0;
  while (attempts < 10) {
    const { data: existing } = await adminClient
      .from("org_join_codes")
      .select("id")
      .eq("code", code)
      .maybeSingle();
    if (!existing) break;
    code = generateCode();
    attempts++;
  }

  const { data: newCode } = await adminClient
    .from("org_join_codes")
    .insert({
      college_id: collegeId,
      code,
      created_by: user.id,
    })
    .select("id, code, qr_token")
    .single();

  const origin = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;
  const qrUrl = `${origin}/signup?qr=${newCode?.qr_token}&org=${collegeId}&join_code=${newCode?.code}&code=${newCode?.code}`;

  return NextResponse.json({ ok: true, code: newCode?.code, qrUrl });
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const adminClient = createAdminClient();
  const { data: profile } = await adminClient
    .from("profiles")
    .select("role, college_id")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "college_admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { data: code } = await adminClient
    .from("org_join_codes")
    .select("code, qr_token, created_at")
    .eq("college_id", profile.college_id!)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!code) return NextResponse.json({ code: null });

  const origin = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;
  const qrUrl = `${origin}/signup?qr=${code.qr_token}&org=${profile.college_id}&join_code=${code.code}&code=${code.code}`;
  return NextResponse.json({ code: code.code, qrUrl, createdAt: code.created_at });
}
