import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  ClipboardList,
  UserCheck,
  CheckCircle2,
  Clock,
  ArrowRight,
  AlertCircle,
  Building2,
  Users,
} from "lucide-react";

export default async function DeptAdminDashboard() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, college_id, department_id, display_name, colleges(name), departments(name)")
    .eq("id", user.id)
    .single();

  if (!profile || (profile.role !== "dept_admin" && profile.role !== "college_admin" && profile.role !== "super_admin")) {
    redirect("/");
  }

  const deptId = profile.department_id;
  const deptName = (profile.departments as any)?.name ?? "Department";
  const collegeName = (profile.colleges as any)?.name ?? "Organisation";

  if (!deptId && profile.role === "dept_admin") {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-center text-amber-800">
        <Building2 className="mx-auto mb-2 h-10 w-10 text-amber-600" />
        <h2 className="text-lg font-semibold">No Department Assigned</h2>
        <p className="mt-1 text-sm">
          Your account has the Departmental Admin role, but no specific department has been linked to your profile yet.
        </p>
        <p className="mt-1 text-xs text-amber-700">
          Please ask your Organisation Admin to assign you to a department in the Role Requests or Departments panel.
        </p>
      </div>
    );
  }

  // Fetch departmental complaints and workers
  const [
    { data: complaints },
    { data: workers },
    { data: auditEntries },
  ] = await Promise.all([
    supabase
      .from("complaints")
      .select("id, public_id, title, status, priority, created_at, assigned_worker_id, categories(name), locations(name)")
      .eq("assigned_department_id", deptId!)
      .order("created_at", { ascending: false }),
    supabase
      .from("profiles")
      .select("id, display_name")
      .eq("department_id", deptId!)
      .eq("role", "worker"),
    supabase
      .from("audit_log")
      .select("entity_id, action")
      .eq("action", "dept_verified"),
  ]);

  const verifiedComplaintIds = new Set((auditEntries ?? []).map((a) => a.entity_id));

  const allComplaints = complaints ?? [];
  const allWorkers = workers ?? [];

  // Metrics
  const unassignedWorkerCount = allComplaints.filter(
    (c) => c.status === "assigned" && !c.assigned_worker_id
  ).length;

  const inProgressCount = allComplaints.filter(
    (c) => c.status === "processing" || (c.status === "assigned" && !!c.assigned_worker_id)
  ).length;

  const waitingVerificationCount = allComplaints.filter(
    (c) => c.status === "waiting_for_verification" && !verifiedComplaintIds.has(c.id)
  ).length;

  const completedCount = allComplaints.filter((c) => c.status === "completed").length;

  const activeTickets = allComplaints.filter((c) => c.status !== "completed");

  return (
    <div className="flex flex-col gap-8">
      {/* Header Banner */}
      <div className="flex flex-col gap-2 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700 border border-blue-200">
              <Building2 className="h-3.5 w-3.5" />
              {deptName}
            </span>
            <span className="text-xs text-neutral-500">· {collegeName}</span>
          </div>
          <h1 className="mt-2 text-2xl font-bold text-neutral-900">
            Welcome, {profile.display_name || "Departmental Admin"}
          </h1>
          <p className="text-sm text-neutral-500">
            Oversee department tickets, assign workers, and verify resolved tasks.
          </p>
        </div>

        <div className="flex gap-2">
          <Link
            href="/dept-admin/queue"
            className="inline-flex items-center gap-2 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-neutral-800"
          >
            <ClipboardList className="h-4 w-4" />
            Manage Queue
          </Link>
          <Link
            href="/dept-admin/workers"
            className="inline-flex items-center gap-2 rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 shadow-sm hover:bg-neutral-50"
          >
            <Users className="h-4 w-4" />
            Workers ({allWorkers.length})
          </Link>
        </div>
      </div>

      {/* Action Alerts */}
      {waitingVerificationCount > 0 && (
        <div className="flex items-center justify-between gap-4 rounded-xl border border-indigo-200 bg-indigo-50/70 p-4 text-indigo-900 shadow-sm">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-indigo-600 shrink-0" />
            <div>
              <p className="font-semibold text-sm">
                {waitingVerificationCount} ticket{waitingVerificationCount > 1 ? "s" : ""} waiting for your verification
              </p>
              <p className="text-xs text-indigo-700">
                Workers have submitted completion proofs. Review and verify them to send to Organisation Admin.
              </p>
            </div>
          </div>
          <Link
            href="/dept-admin/queue?status=waiting_for_verification"
            className="shrink-0 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700"
          >
            Review Now →
          </Link>
        </div>
      )}

      {unassignedWorkerCount > 0 && (
        <div className="flex items-center justify-between gap-4 rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-amber-900 shadow-sm">
          <div className="flex items-center gap-3">
            <Clock className="h-5 w-5 text-amber-600 shrink-0" />
            <div>
              <p className="font-semibold text-sm">
                {unassignedWorkerCount} complaint{unassignedWorkerCount > 1 ? "s" : ""} waiting for worker assignment
              </p>
              <p className="text-xs text-amber-700">
                Organisation Admin assigned these complaints to your department. Choose a worker to begin resolution.
              </p>
            </div>
          </div>
          <Link
            href="/dept-admin/queue?status=assigned"
            className="shrink-0 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700"
          >
            Assign Workers →
          </Link>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-neutral-500">
            <span className="text-xs font-medium uppercase tracking-wider">Need Worker</span>
            <Clock className="h-4 w-4 text-amber-500" />
          </div>
          <p className="mt-2 text-3xl font-bold text-neutral-900">{unassignedWorkerCount}</p>
          <span className="text-[11px] text-neutral-500">Assigned to dept</span>
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-neutral-500">
            <span className="text-xs font-medium uppercase tracking-wider">In Progress</span>
            <UserCheck className="h-4 w-4 text-blue-500" />
          </div>
          <p className="mt-2 text-3xl font-bold text-neutral-900">{inProgressCount}</p>
          <span className="text-[11px] text-neutral-500">With assigned workers</span>
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-neutral-500">
            <span className="text-xs font-medium uppercase tracking-wider">Verify Work</span>
            <AlertCircle className="h-4 w-4 text-indigo-500" />
          </div>
          <p className="mt-2 text-3xl font-bold text-indigo-600">{waitingVerificationCount}</p>
          <span className="text-[11px] text-neutral-500">Tier 1 sign-off</span>
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-neutral-500">
            <span className="text-xs font-medium uppercase tracking-wider">Completed</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </div>
          <p className="mt-2 text-3xl font-bold text-emerald-600">{completedCount}</p>
          <span className="text-[11px] text-neutral-500">Officially closed</span>
        </div>
      </div>

      {/* Active Complaints List */}
      <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-neutral-900">Active Department Issues</h2>
            <p className="text-xs text-neutral-500">
              Complaints currently routed to {deptName}
            </p>
          </div>
          <Link
            href="/dept-admin/queue"
            className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700"
          >
            View all ({activeTickets.length}) <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {activeTickets.length === 0 ? (
          <div className="py-8 text-center text-sm text-neutral-500">
            <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-emerald-500" />
            No active issues in this department!
          </div>
        ) : (
          <div className="divide-y divide-neutral-100">
            {activeTickets.slice(0, 6).map((c) => {
              const workerObj = allWorkers.find((w) => w.id === c.assigned_worker_id);
              const isWaitingDeptVerify =
                c.status === "waiting_for_verification" && !verifiedComplaintIds.has(c.id);

              return (
                <Link
                  key={c.id}
                  href={`/dept-admin/queue/${c.public_id}`}
                  className="flex items-center justify-between py-3 px-2 rounded-lg hover:bg-neutral-50 transition-colors"
                >
                  <div className="flex flex-col gap-1 min-w-0 pr-4">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-neutral-600 bg-neutral-100 px-1.5 py-0.5 rounded">
                        {c.public_id}
                      </span>
                      <span className="truncate text-sm font-medium text-neutral-900">
                        {c.title}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-neutral-500">
                      <span>{(c.categories as any)?.name ?? "General"}</span>
                      <span>·</span>
                      <span>{(c.locations as any)?.name ?? "Location"}</span>
                      <span>·</span>
                      <span>{new Date(c.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {isWaitingDeptVerify ? (
                      <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-semibold text-indigo-800 animate-pulse">
                        Action Required: Verify
                      </span>
                    ) : !c.assigned_worker_id ? (
                      <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
                        Assign Worker
                      </span>
                    ) : (
                      <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700">
                        {workerObj?.display_name ?? "Worker assigned"}
                      </span>
                    )}
                    <span className="text-neutral-400">→</span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
