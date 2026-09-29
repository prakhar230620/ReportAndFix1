import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Building2, CheckCircle2, Clock, AlertCircle } from "lucide-react";

export default async function DeptAdminQueuePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; category?: string; location?: string }>;
}) {
  const { status, category, location } = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, college_id, department_id, departments(name)")
    .eq("id", user.id)
    .single();

  if (
    !profile ||
    (profile.role !== "dept_admin" &&
      profile.role !== "college_admin" &&
      profile.role !== "super_admin")
  ) {
    redirect("/");
  }

  const deptId = profile.department_id;
  const collegeId = profile.college_id;
  const deptName = (profile.departments as any)?.name ?? "Department";

  if (!deptId) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-center text-amber-800">
        <Building2 className="mx-auto mb-2 h-10 w-10 text-amber-600" />
        <h2 className="text-lg font-semibold">No Department Assigned</h2>
        <p className="mt-1 text-sm">Please ask your Organisation Admin to assign your department.</p>
      </div>
    );
  }

  const adminClient = createAdminClient();

  // Fetch departmental complaints with filters
  let query = adminClient
    .from("complaints")
    .select(
      "id, public_id, title, status, priority, created_at, assigned_worker_id, categories(id, name), locations(id, name)"
    )
    .eq("assigned_department_id", deptId)
    .order("created_at", { ascending: false });

  if (status) {
    if (status === "unassigned") {
      query = query.eq("status", "assigned").is("assigned_worker_id", null);
    } else {
      query = query.eq("status", status);
    }
  }
  if (category) {
    query = query.eq("category_id", category);
  }
  if (location) {
    query = query.eq("location_id", location);
  }

  const [
    { data: complaints },
    { data: allDeptComplaints },
    { data: workers },
    { data: allCollegeWorkers },
    { data: categories },
    { data: locations },
    { data: auditDeptVerified },
  ] = await Promise.all([
    query,
    adminClient.from("complaints").select("id, status, assigned_worker_id").eq("assigned_department_id", deptId),
    // Workers in this dept (for the assignment form)
    adminClient.from("profiles").select("id, display_name").eq("department_id", deptId).eq("role", "worker"),
    // All workers in the college (to resolve assigned_worker_id names on any complaint)
    adminClient.from("profiles").select("id, display_name").eq("college_id", collegeId!).eq("role", "worker"),
    adminClient.from("categories").select("id, name").eq("college_id", collegeId!).order("name"),
    adminClient.from("locations").select("id, name").eq("college_id", collegeId!).order("name"),
    adminClient.from("audit_log").select("entity_id").eq("action", "dept_verified"),
  ]);

  const verifiedComplaintIds = new Set((auditDeptVerified ?? []).map((a) => a.entity_id));
  // Build worker name map from ALL college workers so we can resolve any assigned worker's name
  const workerMap = new Map((allCollegeWorkers ?? []).map((w) => [w.id, w.display_name]));

  // Calculate status counts for department
  const counts: Record<string, number> = {
    unassigned: 0,
    processing: 0,
    waiting_for_verification: 0,
    completed: 0,
    reopened: 0,
  };

  for (const c of allDeptComplaints ?? []) {
    if (c.status === "assigned" && !c.assigned_worker_id) {
      counts.unassigned++;
    } else if (c.status === "processing" || (c.status === "assigned" && c.assigned_worker_id)) {
      counts.processing++;
    } else if (c.status === "waiting_for_verification") {
      counts.waiting_for_verification++;
    } else if (c.status === "completed") {
      counts.completed++;
    } else if (c.status === "reopened") {
      counts.reopened++;
    }
  }

  const pendingTotal = (allDeptComplaints ?? []).filter((c) => c.status !== "completed").length;

  function filterUrl(overrides: Record<string, string | undefined>) {
    const params = new URLSearchParams();
    const merged = { status, category, location, ...overrides };
    for (const [k, v] of Object.entries(merged)) if (v) params.set(k, v);
    return `/dept-admin/queue?${params.toString()}`;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-neutral-900">{deptName} Complaint Queue</h1>
          <p className="text-xs text-neutral-500">
            Issues routed to your department for worker assignment & verification
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryCard label="Pending (Open)" value={pendingTotal} tone="amber" />
        <SummaryCard label="Needs Worker" value={counts.unassigned} tone="blue" />
        <SummaryCard label="Needs Verification" value={counts.waiting_for_verification} tone="indigo" />
        <SummaryCard label="Completed" value={counts.completed} tone="green" />
      </div>

      {/* Status Filter Pills */}
      <div className="flex flex-wrap gap-2 text-xs">
        <Link
          href={filterUrl({ status: undefined })}
          className={`rounded-full px-3 py-1 font-medium transition-colors ${
            !status ? "bg-neutral-900 text-white" : "bg-neutral-200 text-neutral-700 hover:bg-neutral-300"
          }`}
        >
          All ({allDeptComplaints?.length ?? 0})
        </Link>
        <Link
          href={filterUrl({ status: "unassigned" })}
          className={`rounded-full px-3 py-1 font-medium transition-colors ${
            status === "unassigned" ? "bg-amber-600 text-white" : "bg-amber-100 text-amber-800 hover:bg-amber-200"
          }`}
        >
          Needs Worker ({counts.unassigned})
        </Link>
        <Link
          href={filterUrl({ status: "processing" })}
          className={`rounded-full px-3 py-1 font-medium transition-colors ${
            status === "processing" ? "bg-blue-600 text-white" : "bg-blue-100 text-blue-800 hover:bg-blue-200"
          }`}
        >
          In Progress ({counts.processing})
        </Link>
        <Link
          href={filterUrl({ status: "waiting_for_verification" })}
          className={`rounded-full px-3 py-1 font-medium transition-colors ${
            status === "waiting_for_verification"
              ? "bg-indigo-600 text-white"
              : "bg-indigo-100 text-indigo-800 hover:bg-indigo-200"
          }`}
        >
          Verification ({counts.waiting_for_verification})
        </Link>
        <Link
          href={filterUrl({ status: "completed" })}
          className={`rounded-full px-3 py-1 font-medium transition-colors ${
            status === "completed" ? "bg-emerald-600 text-white" : "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
          }`}
        >
          Completed ({counts.completed})
        </Link>
        <Link
          href={filterUrl({ status: "reopened" })}
          className={`rounded-full px-3 py-1 font-medium transition-colors ${
            status === "reopened" ? "bg-rose-600 text-white" : "bg-rose-100 text-rose-800 hover:bg-rose-200"
          }`}
        >
          Reopened ({counts.reopened})
        </Link>
      </div>

      {/* Filter Dropdowns */}
      <div className="flex flex-wrap gap-3 text-xs">
        <form method="get" className="flex gap-2">
          {status && <input type="hidden" name="status" value={status} />}
          {location && <input type="hidden" name="location" value={location} />}
          <select
            name="category"
            defaultValue={category ?? ""}
            className="rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-neutral-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">All categories</option>
            {(categories ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <button className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 font-medium hover:bg-neutral-50">
            Filter
          </button>
        </form>

        <form method="get" className="flex gap-2">
          {status && <input type="hidden" name="status" value={status} />}
          {category && <input type="hidden" name="category" value={category} />}
          <select
            name="location"
            defaultValue={location ?? ""}
            className="rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-neutral-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">All locations</option>
            {(locations ?? []).map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
          <button className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 font-medium hover:bg-neutral-50">
            Filter
          </button>
        </form>
      </div>

      {/* Complaints List */}
      <div className="flex flex-col gap-2">
        {(complaints ?? []).map((c: any) => {
          const workerName = c.assigned_worker_id ? workerMap.get(c.assigned_worker_id) : null;
          const isDeptVerified = verifiedComplaintIds.has(c.id);

          return (
            <Link
              key={c.id}
              href={`/dept-admin/queue/${c.public_id}`}
              className="rounded-xl border border-neutral-200 bg-white p-4 text-sm shadow-sm hover:border-neutral-300 hover:bg-neutral-50 transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-neutral-900">{c.title}</span>
                <span className="font-mono text-xs font-medium text-neutral-500 bg-neutral-100 px-2 py-0.5 rounded">
                  {c.public_id}
                </span>
              </div>

              <div className="mt-1 text-xs text-neutral-500">
                {c.categories?.name ?? "General"} · {c.locations?.name ?? "Location"}
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                {/* Status Badge */}
                {c.status === "waiting_for_verification" ? (
                  isDeptVerified ? (
                    <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 font-medium text-emerald-800">
                      Dept Verified ✓ (Awaiting Org Admin)
                    </span>
                  ) : (
                    <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 font-semibold text-indigo-800">
                      Tier 1 Verification Needed
                    </span>
                  )
                ) : (
                  <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 font-medium capitalize text-neutral-700">
                    {c.status}
                  </span>
                )}

                <span className="rounded-full bg-neutral-100 px-2 py-0.5 capitalize text-neutral-600">
                  {c.priority} priority
                </span>

                {/* Worker Assignment Status */}
                {workerName ? (
                  <span className="rounded-full bg-blue-50 px-2 py-0.5 font-medium text-blue-700">
                    Assigned: {workerName}
                  </span>
                ) : (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-800">
                    No worker assigned
                  </span>
                )}

                <span className="text-neutral-400">·</span>
                <span className="text-neutral-500">{new Date(c.created_at).toLocaleDateString()}</span>
              </div>
            </Link>
          );
        })}

        {(complaints ?? []).length === 0 && (
          <div className="rounded-xl border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-500">
            No complaints found matching the selected filters.
          </div>
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
  tone: "blue" | "green" | "amber" | "indigo";
}) {
  const toneMap = {
    blue: "text-blue-600",
    green: "text-green-600",
    amber: "text-amber-600",
    indigo: "text-indigo-600",
  };
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-3 shadow-sm">
      <div className={`text-2xl font-bold ${toneMap[tone]}`}>{value}</div>
      <div className="text-xs text-neutral-500">{label}</div>
    </div>
  );
}
