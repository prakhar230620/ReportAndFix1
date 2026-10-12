import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Building2, TrendingUp, CheckCircle2, Clock, Users, Tag } from "lucide-react";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function DeptAnalyticsPage() {
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

  // Fetch complaints and workers for this department
  const [
    { data: complaints },
    { data: workers },
  ] = await Promise.all([
    supabase
      .from("complaints")
      .select("id, status, priority, resolution_seconds, assigned_worker_id, categories(name)")
      .eq("assigned_department_id", deptId),
    supabase
      .from("profiles")
      .select("id, display_name")
      .eq("department_id", deptId)
      .eq("role", "worker"),
  ]);

  const allComplaints = complaints ?? [];
  const allWorkers = workers ?? [];

  const total = allComplaints.length;
  const completed = allComplaints.filter((c) => c.status === "completed");
  const completionRate = total > 0 ? Math.round((completed.length / total) * 100) : 0;

  // Average resolution seconds for completed tasks
  const completedWithTime = completed.filter((c) => c.resolution_seconds != null);
  const avgSeconds =
    completedWithTime.length > 0
      ? completedWithTime.reduce((sum, c) => sum + (c.resolution_seconds ?? 0), 0) /
        completedWithTime.length
      : null;
  const avgHours = avgSeconds ? (avgSeconds / 3600).toFixed(1) : "—";

  // Category Breakdown
  const categoryCounts: Record<string, number> = {};
  for (const c of allComplaints) {
    const catName = (c.categories as any)?.name ?? "Uncategorized";
    categoryCounts[catName] = (categoryCounts[catName] ?? 0) + 1;
  }
  const categoryList = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1]);

  // Worker Performance Breakdown
  const workerPerformance = allWorkers.map((w) => {
    const workerComplaints = allComplaints.filter((c) => c.assigned_worker_id === w.id);
    const workerCompleted = workerComplaints.filter((c) => c.status === "completed");
    const workerCompletedWithTime = workerCompleted.filter((c) => c.resolution_seconds != null);
    const wAvgSeconds =
      workerCompletedWithTime.length > 0
        ? workerCompletedWithTime.reduce((sum, c) => sum + (c.resolution_seconds ?? 0), 0) /
          workerCompletedWithTime.length
        : null;

    return {
      id: w.id,
      name: w.display_name || "Unnamed Worker",
      totalAssigned: workerComplaints.length,
      completed: workerCompleted.length,
      avgHours: wAvgSeconds ? (wAvgSeconds / 3600).toFixed(1) : "—",
    };
  }).sort((a, b) => b.completed - a.completed);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-neutral-900">{deptName} Analytics</h1>
        <p className="text-xs text-neutral-500">
          Resolution performance, turnaround times, and departmental worker metrics.
        </p>
      </div>

      {/* Top Level KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-neutral-500">
            <span className="text-xs font-medium uppercase tracking-wider">Total Received</span>
            <TrendingUp className="h-4 w-4 text-neutral-500" />
          </div>
          <p className="mt-2 text-2xl font-bold text-neutral-900">{total}</p>
          <span className="text-[11px] text-neutral-500">Department tickets</span>
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-neutral-500">
            <span className="text-xs font-medium uppercase tracking-wider">Resolved</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </div>
          <p className="mt-2 text-2xl font-bold text-emerald-600">{completed.length}</p>
          <span className="text-[11px] text-neutral-500">{completionRate}% completion rate</span>
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-neutral-500">
            <span className="text-xs font-medium uppercase tracking-wider">Avg Resolution</span>
            <Clock className="h-4 w-4 text-blue-500" />
          </div>
          <p className="mt-2 text-2xl font-bold text-neutral-900">{avgHours}h</p>
          <span className="text-[11px] text-neutral-500">Turnaround time</span>
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-neutral-500">
            <span className="text-xs font-medium uppercase tracking-wider">Staff Count</span>
            <Users className="h-4 w-4 text-purple-500" />
          </div>
          <p className="mt-2 text-2xl font-bold text-neutral-900">{allWorkers.length}</p>
          <span className="text-[11px] text-neutral-500">Assigned workers</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Worker Performance Table */}
        <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-neutral-900">Worker Performance</h2>
            <Users className="h-4 w-4 text-neutral-400" />
          </div>

          {workerPerformance.length === 0 ? (
            <p className="text-xs text-neutral-500 py-6 text-center">No workers assigned to this department yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-neutral-200 text-neutral-500">
                    <th className="pb-2 font-medium">Worker</th>
                    <th className="pb-2 font-medium text-center">Tasks</th>
                    <th className="pb-2 font-medium text-center">Resolved</th>
                    <th className="pb-2 font-medium text-right">Avg Speed</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {workerPerformance.map((w) => (
                    <tr key={w.id} className="hover:bg-neutral-50">
                      <td className="py-2.5 font-medium text-neutral-900">{w.name}</td>
                      <td className="py-2.5 text-center text-neutral-600">{w.totalAssigned}</td>
                      <td className="py-2.5 text-center font-semibold text-emerald-600">{w.completed}</td>
                      <td className="py-2.5 text-right text-neutral-600">{w.avgHours}{w.avgHours !== "—" ? "h" : ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Category Breakdown */}
        <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-neutral-900">Complaints by Category</h2>
            <Tag className="h-4 w-4 text-neutral-400" />
          </div>

          {categoryList.length === 0 ? (
            <p className="text-xs text-neutral-500 py-6 text-center">No complaints recorded yet.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {categoryList.map(([cat, count]) => {
                const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                return (
                  <div key={cat} className="flex flex-col gap-1">
                    <div className="flex justify-between text-xs">
                      <span className="font-medium text-neutral-800">{cat}</span>
                      <span className="text-neutral-500">
                        {count} ({pct}%)
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-neutral-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-blue-600 transition-all duration-300"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
