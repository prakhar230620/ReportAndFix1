import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const maxDuration = 30;

function csvEscape(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function POST(req: Request) {
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

  let body: { college_id?: string } = {};
  try {
    body = await req.json();
  } catch {
    // no body sent -- fine, defaults below apply
  }

  // college_admin is always scoped to their own college. super_admin may
  // pick one college, or omit it entirely to export across all colleges.
  const targetCollegeId = profile.role === "college_admin" ? profile.college_id : body.college_id;

  let query = supabase
    .from("complaints")
    .select(
      "public_id, title, status, priority, created_at, completed_at, resolution_seconds, is_anonymous, location_id, college_id, categories(name), locations(name), colleges(name)"
    )
    .order("created_at", { ascending: false });
  if (targetCollegeId) query = query.eq("college_id", targetCollegeId);

  const { data: complaints, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const includeOrgColumn = profile.role === "super_admin" && !targetCollegeId;
  const header = [
    ...(includeOrgColumn ? ["organisation"] : []),
    "public_id", "title", "category", "location", "status", "priority",
    "created_at", "completed_at", "resolution_hours", "anonymous",
  ];
  const rows = await Promise.all(
    (complaints ?? []).map(async (c) => {
      const locId = (c as any).location_id as string | undefined;
      let locationPath = (c as any).locations?.name ?? "";
      if (locId) {
        const { data: path } = await supabase.rpc("location_full_path" as never, {
          p_location_id: locId,
        } as never);
        if (path) locationPath = path as unknown as string;
      }
      return [
        ...(includeOrgColumn ? [(c as any).colleges?.name ?? ""] : []),
        c.public_id,
        c.title,
        (c as any).categories?.name ?? "",
        locationPath,
        c.status,
        c.priority,
        c.created_at,
        c.completed_at ?? "",
        c.resolution_seconds ? (c.resolution_seconds / 3600).toFixed(1) : "",
        c.is_anonymous ? "yes" : "no",
      ];
    })
  );

  const csv = [header, ...rows].map((r) => r.map(csvEscape).join(",")).join("\n");
  const storagePath = `${targetCollegeId ?? "all"}/complaints-export-${Date.now()}.csv`;

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
