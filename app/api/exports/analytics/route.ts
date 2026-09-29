import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const maxDuration = 30;

function csvEscape(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function row(cells: unknown[]) {
  return cells.map(csvEscape).join(",");
}

function fmtBytes(bytes: number): string {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

export async function POST(req: Request) {
  const supabase = await createClient();

  // Auth guard — super_admin only
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "super_admin") {
    return NextResponse.json({ error: "Only super admins can export analytics" }, { status: 403 });
  }

  let body: { type?: string } = {};
  try {
    body = await req.json();
  } catch {
    /* no body */
  }

  const exportType = body.type ?? "analytics"; // "analytics" | "storage" | "overview"

  // ── Fetch all active organisations ────────────────────────────────────────
  const { data: colleges, error: colErr } = await supabase
    .from("colleges")
    .select("id, name, category, subscription_status, created_at")
    .order("name");

  if (colErr) return NextResponse.json({ error: colErr.message }, { status: 400 });

  const activeColleges = (colleges ?? []).filter(
    (c) => !c.subscription_status?.startsWith("pending_deletion")
  );

  // ── Fetch storage breakdown ───────────────────────────────────────────────
  const { data: storageRaw } = await supabase.rpc("get_storage_usage" as never);
  const storage = (storageRaw ?? {
    db_size_bytes: 0,
    storage_used_bytes: 0,
    by_college: [],
  }) as {
    db_size_bytes: number;
    storage_used_bytes: number;
    by_college: { college_id: string; bytes: number; object_count: number }[];
  };
  const storageMap = new Map(
    (storage.by_college ?? []).map((s) => [s.college_id, s])
  );

  const totalDbBytes = storage.db_size_bytes;

  // ── Build per-org aggregate stats ─────────────────────────────────────────
  const orgStats = await Promise.all(
    activeColleges.map(async (c) => {
      const [
        { count: complaints },
        { count: completed },
        { count: users },
        { count: workers },
        { count: deptAdmins },
        { count: orgAdmins },
        { count: locations },
        { count: categories },
      ] = await Promise.all([
        supabase.from("complaints").select("id", { count: "exact", head: true }).eq("college_id", c.id),
        supabase.from("complaints").select("id", { count: "exact", head: true }).eq("college_id", c.id).eq("status", "completed"),
        supabase.from("profiles").select("id", { count: "exact", head: true }).eq("college_id", c.id).eq("role", "user"),
        supabase.from("profiles").select("id", { count: "exact", head: true }).eq("college_id", c.id).eq("role", "worker"),
        supabase.from("profiles").select("id", { count: "exact", head: true }).eq("college_id", c.id).eq("role", "dept_admin"),
        supabase.from("profiles").select("id", { count: "exact", head: true }).eq("college_id", c.id).eq("role", "college_admin"),
        supabase.from("locations").select("id", { count: "exact", head: true }).eq("college_id", c.id),
        supabase.from("categories").select("id", { count: "exact", head: true }).eq("college_id", c.id),
      ]);

      const fileInfo = storageMap.get(c.id) ?? { bytes: 0, object_count: 0 };
      const dbRecords =
        (complaints ?? 0) +
        (users ?? 0) +
        (workers ?? 0) +
        (deptAdmins ?? 0) +
        (orgAdmins ?? 0) +
        (locations ?? 0) +
        (categories ?? 0);
      const dbBytesEst =
        dbRecords > 0 && totalDbBytes > 0
          ? Math.round(totalDbBytes * (dbRecords / Math.max(1, activeColleges.length * dbRecords)))
          : 0;
      const completionRate =
        (complaints ?? 0) > 0
          ? Math.round(((completed ?? 0) / (complaints ?? 0)) * 100)
          : 0;

      return {
        id: c.id,
        name: c.name,
        category: c.category ?? "—",
        status: c.subscription_status ?? "active",
        created_at: c.created_at?.slice(0, 10) ?? "",
        // Complaint counts only — no content
        total_complaints: complaints ?? 0,
        completed_complaints: completed ?? 0,
        completion_rate_pct: completionRate,
        pending_complaints: (complaints ?? 0) - (completed ?? 0),
        // People
        members: users ?? 0,
        workers: workers ?? 0,
        dept_admins: deptAdmins ?? 0,
        org_admins: orgAdmins ?? 0,
        // Structure
        locations: locations ?? 0,
        categories: categories ?? 0,
        // Storage
        file_bytes: fileInfo.bytes,
        file_count: fileInfo.object_count,
        file_size_fmt: fmtBytes(fileInfo.bytes),
        db_bytes_est: dbBytesEst,
        db_bytes_est_fmt: fmtBytes(dbBytesEst),
        total_bytes: fileInfo.bytes + dbBytesEst,
        total_size_fmt: fmtBytes(fileInfo.bytes + dbBytesEst),
      };
    })
  );

  let csv = "";
  let filename = "";

  // ── Export type: full analytics ───────────────────────────────────────────
  if (exportType === "analytics") {
    filename = `platform-analytics-${new Date().toISOString().slice(0, 10)}.csv`;
    const header = row([
      "Organisation", "Category", "Status", "Registered On",
      "Total Complaints", "Completed", "Completion Rate (%)", "Pending",
      "Members", "Workers", "Dept Admins", "Org Admins", "Locations", "Categories",
      "File Storage", "File Count", "Est. DB Storage", "Total Storage",
    ]);
    const dataRows = orgStats.map((o) =>
      row([
        o.name, o.category, o.status, o.created_at,
        o.total_complaints, o.completed_complaints, o.completion_rate_pct, o.pending_complaints,
        o.members, o.workers, o.dept_admins, o.org_admins, o.locations, o.categories,
        o.file_size_fmt, o.file_count, o.db_bytes_est_fmt, o.total_size_fmt,
      ])
    );
    csv = [header, ...dataRows].join("\n");

  // ── Export type: storage only ─────────────────────────────────────────────
  } else if (exportType === "storage") {
    filename = `storage-report-${new Date().toISOString().slice(0, 10)}.csv`;
    const header = row([
      "Organisation", "Category",
      "File Storage (bytes)", "File Storage", "File Count",
      "Est. DB Storage (bytes)", "Est. DB Storage",
      "Total Storage (bytes)", "Total Storage",
    ]);
    const dataRows = orgStats.map((o) =>
      row([
        o.name, o.category,
        o.file_bytes, o.file_size_fmt, o.file_count,
        o.db_bytes_est, o.db_bytes_est_fmt,
        o.total_bytes, o.total_size_fmt,
      ])
    );
    // Platform totals footer
    const totFileBytes = orgStats.reduce((s, o) => s + o.file_bytes, 0);
    const totDbBytes = orgStats.reduce((s, o) => s + o.db_bytes_est, 0);
    const totBytes = orgStats.reduce((s, o) => s + o.total_bytes, 0);
    const totRow = row([
      "PLATFORM TOTAL", "",
      totFileBytes, fmtBytes(totFileBytes), orgStats.reduce((s, o) => s + o.file_count, 0),
      totDbBytes, fmtBytes(totDbBytes),
      totBytes, fmtBytes(totBytes),
    ]);
    csv = [header, ...dataRows, "", totRow].join("\n");

  // ── Export type: organisation overview ────────────────────────────────────
  } else if (exportType === "overview") {
    filename = `org-overview-${new Date().toISOString().slice(0, 10)}.csv`;
    const header = row([
      "Organisation", "Category", "Status", "Registered On",
      "Members", "Workers", "Locations", "Categories",
      "Total Storage",
    ]);
    const dataRows = orgStats.map((o) =>
      row([
        o.name, o.category, o.status, o.created_at,
        o.members, o.workers, o.locations, o.categories,
        o.total_size_fmt,
      ])
    );
    csv = [header, ...dataRows].join("\n");
  } else {
    return NextResponse.json({ error: "Unknown export type" }, { status: 400 });
  }

  // ── Upload to private storage and return signed URL ───────────────────────
  const storagePath = `analytics/${user.id}/${filename}`;
  const { error: uploadErr } = await supabase.storage
    .from("exports")
    .upload(storagePath, csv, { contentType: "text/csv", upsert: true });

  if (uploadErr) return NextResponse.json({ error: uploadErr.message }, { status: 400 });

  const { data: signed, error: signErr } = await supabase.storage
    .from("exports")
    .createSignedUrl(storagePath, 3600);

  if (signErr || !signed)
    return NextResponse.json({ error: signErr?.message ?? "Sign URL failed" }, { status: 400 });

  return NextResponse.json({
    url: signed.signedUrl,
    filename,
    row_count: orgStats.length,
  });
}
