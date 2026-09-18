import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const maxDuration = 30;

function csvEscape(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, college_id")
    .eq("id", user.id)
    .single();
  if (!profile || (profile.role !== "college_admin" && profile.role !== "super_admin")) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const { data: complaints, error } = await supabase
    .from("complaints")
    .select(
      "public_id, title, status, priority, created_at, completed_at, resolution_seconds, is_anonymous, categories(name), locations(name)"
    )
    .eq("college_id", profile.college_id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const header = [
    "public_id", "title", "category", "location", "status", "priority",
    "created_at", "completed_at", "resolution_hours", "anonymous",
  ];
  const rows = (complaints ?? []).map((c) => [
    c.public_id,
    c.title,
    (c as any).categories?.name ?? "",
    (c as any).locations?.name ?? "",
    c.status,
    c.priority,
    c.created_at,
    c.completed_at ?? "",
    c.resolution_seconds ? (c.resolution_seconds / 3600).toFixed(1) : "",
    c.is_anonymous ? "yes" : "no",
  ]);

  const csv = [header, ...rows].map((r) => r.map(csvEscape).join(",")).join("\n");
  const storagePath = `${profile.college_id}/complaints-export-${Date.now()}.csv`;

  const { error: uploadError } = await supabase.storage
    .from("exports")
    .upload(storagePath, csv, { contentType: "text/csv" });

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 400 });

  const { data: signed, error: signError } = await supabase.storage
    .from("exports")
    .createSignedUrl(storagePath, 3600);

  if (signError || !signed) {
    return NextResponse.json({ error: signError?.message ?? "Failed to sign URL" }, { status: 400 });
  }

  return NextResponse.json({ url: signed.signedUrl, row_count: rows.length });
}
