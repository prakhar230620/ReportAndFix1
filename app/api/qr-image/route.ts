import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const token = req.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.json({ error: "token required" }, { status: 400 });

  const { data: location } = await supabase
    .from("locations")
    .select("id, college_id, qr_token")
    .eq("qr_token", token)
    .single();
  if (!location) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, college_id")
    .eq("id", user.id)
    .single();
  const authorized =
    profile?.role === "super_admin" ||
    (profile?.role === "college_admin" && profile.college_id === location.college_id);
  if (!authorized) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  const url = `${req.nextUrl.origin}/report/${token}`;
  const png = await QRCode.toBuffer(url, { margin: 1, width: 400 });

  return new NextResponse(new Uint8Array(png), {
    status: 200,
    headers: { "Content-Type": "image/png", "Cache-Control": "private, max-age=60" },
  });
}
