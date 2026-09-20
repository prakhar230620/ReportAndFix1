import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

import Link from "next/link";

export default async function AdminQueuePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; category?: string; location?: string }>;
}) {
  const { status, category, location } = await searchParams;
  const supabase = await createClient();

  const { data: gProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", (await supabase.auth.getUser()).data.user!.id)
    .single();
  if (gProfile?.role === "super_admin") redirect("/super-admin");

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("college_id")
    .eq("id", user!.id)
    .single();

  const collegeId = profile?.college_id;

  const STATUSES = [
    "submitted",
    "assigned",
    "processing",
    "waiting_for_verification",
    "completed",
    "reopened",
  ];

  const [{ data: categories }, { data: locations }, { data: queue }, { data: statusRows }] =
    await Promise.all([
      supabase.from("categories").select("id, name").eq("college_id", collegeId).order("name"),
      supabase.from("locations").select("id, name").eq("college_id", collegeId).order("name"),
      supabase.rpc("get_admin_queue" as never, {
        p_college_id: collegeId,
        p_status: status || null,
        p_category_id: category || null,
        p_location_id: location || null,
      } as never),
      supabase.from("complaints").select("status").eq("college_id", collegeId!),
    ]);

  const counts: Record<string, number> = {};
  for (const r of statusRows ?? []) {
    counts[r.status] = (counts[r.status] ?? 0) + 1;
  }
  const pendingTotal = STATUSES.filter((s) => s !== "completed").reduce(
    (sum, s) => sum + (counts[s] ?? 0),
    0
  );

  function filterUrl(overrides: Record<string, string | undefined>) {
    const params = new URLSearchParams();
    const merged = { status, category, location, ...overrides };
    for (const [k, v] of Object.entries(merged)) if (v) params.set(k, v);
    return `/admin/queue?${params.toString()}`;
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Admin Queue</h1>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryCard label="Pending (open)" value={pendingTotal} tone="amber" />
        <SummaryCard label="Assigned" value={counts["assigned"] ?? 0} tone="blue" />
        <SummaryCard label="Processing" value={counts["processing"] ?? 0} tone="blue" />
        <SummaryCard label="Completed" value={counts["completed"] ?? 0} tone="green" />
      </div>

      <div className="flex flex-wrap gap-2 text-sm">
        <Link
          href={filterUrl({ status: undefined })}
          className={`rounded-full px-3 py-1 ${!status ? "bg-neutral-900 text-white" : "bg-neutral-200"}`}
        >
          All statuses
        </Link>
        {STATUSES.map((s) => (
          <Link
            key={s}
            href={filterUrl({ status: s })}
            className={`rounded-full px-3 py-1 ${status === s ? "bg-neutral-900 text-white" : "bg-neutral-200"}`}
          >
            {s} {counts[s] ? `(${counts[s]})` : ""}
          </Link>
        ))}
      </div>

      <div className="flex flex-wrap gap-3 text-sm">
        <form method="get" className="flex gap-2">
          {status && <input type="hidden" name="status" value={status} />}
          {location && <input type="hidden" name="location" value={location} />}
          <select
            name="category"
            defaultValue={category ?? ""}
            className="rounded-md border border-neutral-300 px-2 py-1"
          >
            <option value="">All categories</option>
            {(categories ?? []).map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <button className="rounded-md border border-neutral-300 px-2 py-1">Apply</button>
        </form>
        <form method="get" className="flex gap-2">
          {status && <input type="hidden" name="status" value={status} />}
          {category && <input type="hidden" name="category" value={category} />}
          <select
            name="location"
            defaultValue={location ?? ""}
            className="rounded-md border border-neutral-300 px-2 py-1"
          >
            <option value="">All locations</option>
            {(locations ?? []).map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
          <button className="rounded-md border border-neutral-300 px-2 py-1">Apply</button>
        </form>
      </div>

      <div className="flex flex-col gap-2">
        {(queue ?? []).map((c: any) => (
          <Link
            key={c.id}
            href={`/admin/queue/${c.public_id}`}
            className="rounded-md border border-neutral-200 p-3 text-sm hover:bg-neutral-50"
          >
            <div className="flex items-center justify-between">
              <span className="font-medium">{c.title}</span>
              <span className="text-xs text-neutral-500">{c.public_id}</span>
            </div>
            <div className="mt-1 text-neutral-500">
              {c.category_name} · {c.location_name}
            </div>
            <div className="mt-1 flex items-center gap-2 text-xs text-neutral-500">
              <span className="rounded-full bg-neutral-200 px-2 py-0.5">{c.status}</span>
              <span className="rounded-full bg-neutral-200 px-2 py-0.5">{c.priority}</span>
              <span>{c.vote_count} joined</span>
              {c.assigned_worker_name && <span>· {c.assigned_worker_name}</span>}
            </div>
          </Link>
        ))}
        {(queue ?? []).length === 0 && (
          <p className="text-sm text-neutral-500">No complaints match these filters.</p>
        )}
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "blue" | "green" | "amber";
}) {
  const toneMap = { blue: "text-blue-600", green: "text-green-600", amber: "text-amber-600" };
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-3 shadow-sm">
      <div className={`text-2xl font-semibold ${toneMap[tone]}`}>{value}</div>
      <div className="text-xs text-neutral-500">{label}</div>
    </div>
  );
}
