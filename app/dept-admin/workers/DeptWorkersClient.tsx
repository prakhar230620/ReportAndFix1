"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Users, Briefcase, CheckCircle2, Ban, UserCheck, UserX,
  Building2, ChevronDown, ChevronUp,
} from "lucide-react";
import Link from "next/link";
import { suspendWorker, unsuspendWorker, demoteWorkerToUser } from "@/app/admin/departments/actions";

type Department = { id: string; name: string; suspended: boolean };
type Worker = {
  id: string;
  display_name: string | null;
  department_id: string | null;
  created_at: string;
  suspended: boolean;
};
type Complaint = {
  id: string;
  assigned_worker_id: string | null;
  status: string;
  resolution_seconds: number | null;
};

function workerStats(worker: Worker, complaints: Complaint[]) {
  const wc = complaints.filter((c) => c.assigned_worker_id === worker.id);
  const activeTasks = wc.filter((c) => c.status === "assigned" || c.status === "processing").length;
  const waitingVerification = wc.filter((c) => c.status === "waiting_for_verification").length;
  const completedTasks = wc.filter((c) => c.status === "completed").length;
  const completedWithTime = wc.filter((c) => c.status === "completed" && c.resolution_seconds);
  const avgSeconds =
    completedWithTime.length > 0
      ? completedWithTime.reduce((sum, c) => sum + (c.resolution_seconds ?? 0), 0) / completedWithTime.length
      : null;
  return { activeTasks, waitingVerification, completedTasks, avgResolutionHours: avgSeconds ? (avgSeconds / 3600).toFixed(1) : null };
}

export default function DeptWorkersClient({
  isOrgAdmin,
  departments,
  workers,
  complaints,
  myDeptId,
  myDeptName,
}: {
  isOrgAdmin: boolean;
  departments: Department[];
  workers: Worker[];
  complaints: Complaint[];
  myDeptId: string | null;
  myDeptName: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function run(fn: () => Promise<{ error?: string }>) {
    startTransition(async () => {
      const res = await fn();
      if (res.error) {
        alert(res.error);
      } else {
        router.refresh();
      }
    });
  }

  // For dept admin: flat single-dept view
  if (!isOrgAdmin) {
    return <SingleDeptView workers={workers} complaints={complaints} deptName={myDeptName ?? "Department"} pending={pending} run={run} />;
  }

  // For org admin: department-grouped view
  return <OrgAdminView departments={departments} workers={workers} complaints={complaints} pending={pending} run={run} />;
}

/* ─── Org Admin: grouped by department ─── */
function OrgAdminView({
  departments,
  workers,
  complaints,
  pending,
  run,
}: {
  departments: Department[];
  workers: Worker[];
  complaints: Complaint[];
  pending: boolean;
  run: (fn: () => Promise<{ error?: string }>) => void;
}) {
  const workersOf = (deptId: string) => workers.filter((w) => w.department_id === deptId);
  const unassigned = workers.filter((w) => !w.department_id);

  const totalWorkers = workers.length;
  const totalActive = workers.reduce((sum, w) => sum + workerStats(w, complaints).activeTasks, 0);
  const totalCompleted = workers.reduce((sum, w) => sum + workerStats(w, complaints).completedTasks, 0);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-neutral-900">All Workers — Organisation View</h1>
        <p className="text-xs text-neutral-500">Workers across all departments. You can suspend, manage or remove worker roles.</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-neutral-500">
            <span className="text-xs font-medium uppercase tracking-wider">Total Workers</span>
            <Users className="h-4 w-4 text-blue-500" />
          </div>
          <p className="mt-2 text-2xl font-bold text-neutral-900">{totalWorkers}</p>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-neutral-500">
            <span className="text-xs font-medium uppercase tracking-wider">Active Tasks</span>
            <Briefcase className="h-4 w-4 text-amber-500" />
          </div>
          <p className="mt-2 text-2xl font-bold text-amber-600">{totalActive}</p>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-neutral-500">
            <span className="text-xs font-medium uppercase tracking-wider">Resolved</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </div>
          <p className="mt-2 text-2xl font-bold text-emerald-600">{totalCompleted}</p>
        </div>
      </div>

      {/* Per-department sections */}
      <div className="flex flex-col gap-4">
        {departments.map((d) => {
          const dWorkers = workersOf(d.id);
          return (
            <DeptSection key={d.id} dept={d} workers={dWorkers} complaints={complaints} pending={pending} run={run} />
          );
        })}

        {unassigned.length > 0 && (
          <DeptSection
            dept={{ id: "__unassigned__", name: "Unassigned Workers", suspended: false }}
            workers={unassigned}
            complaints={complaints}
            pending={pending}
            run={run}
          />
        )}

        {departments.length === 0 && workers.length === 0 && (
          <div className="rounded-xl border border-dashed border-neutral-300 p-8 text-center">
            <Building2 className="mx-auto mb-2 h-8 w-8 text-neutral-400" />
            <p className="text-sm text-neutral-500">No departments or workers yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Collapsible department section ─── */
function DeptSection({ dept, workers, complaints, pending, run }: {
  dept: { id: string; name: string; suspended: boolean };
  workers: Worker[];
  complaints: Complaint[];
  pending: boolean;
  run: (fn: () => Promise<{ error?: string }>) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const suspended = workers.filter((w) => w.suspended).length;

  return (
    <div className="rounded-xl border border-neutral-200 bg-white shadow-sm overflow-hidden">
      <div
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-neutral-50 border-b border-neutral-100"
        onClick={() => setCollapsed((v) => !v)}
      >
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-neutral-400" />
          <span className="font-semibold text-neutral-900">{dept.name}</span>
          <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-500">
            {workers.length} worker{workers.length === 1 ? "" : "s"}
          </span>
          {suspended > 0 && (
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700">
              {suspended} suspended
            </span>
          )}
          {dept.suspended && (
            <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs text-orange-700">Dept Suspended</span>
          )}
        </div>
        {collapsed ? <ChevronDown className="h-4 w-4 text-neutral-400" /> : <ChevronUp className="h-4 w-4 text-neutral-400" />}
      </div>

      {!collapsed && (
        workers.length === 0 ? (
          <div className="p-4 text-center text-sm text-neutral-400">No workers in this department.</div>
        ) : (
          <div className="divide-y divide-neutral-100">
            {workers.map((w) => (
              <WorkerCard key={w.id} worker={w} complaints={complaints} pending={pending} run={run} isOrgAdmin={true} />
            ))}
          </div>
        )
      )}
    </div>
  );
}

/* ─── Dept Admin: single dept view ─── */
function SingleDeptView({ workers, complaints, deptName, pending, run }: {
  workers: Worker[];
  complaints: Complaint[];
  deptName: string;
  pending: boolean;
  run: (fn: () => Promise<{ error?: string }>) => void;
}) {
  const totalActiveTasks = workers.reduce((sum, w) => sum + workerStats(w, complaints).activeTasks, 0);
  const totalCompleted = workers.reduce((sum, w) => sum + workerStats(w, complaints).completedTasks, 0);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-neutral-900">{deptName} — Workers</h1>
        <p className="text-xs text-neutral-500">Your department workers. You can suspend or remove their worker role.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-neutral-500">
            <span className="text-xs font-medium uppercase tracking-wider">Team Size</span>
            <Users className="h-4 w-4 text-blue-500" />
          </div>
          <p className="mt-2 text-2xl font-bold text-neutral-900">{workers.length}</p>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-neutral-500">
            <span className="text-xs font-medium uppercase tracking-wider">Active Tasks</span>
            <Briefcase className="h-4 w-4 text-amber-500" />
          </div>
          <p className="mt-2 text-2xl font-bold text-amber-600">{totalActiveTasks}</p>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-neutral-500">
            <span className="text-xs font-medium uppercase tracking-wider">Resolved</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </div>
          <p className="mt-2 text-2xl font-bold text-emerald-600">{totalCompleted}</p>
        </div>
      </div>

      <div className="rounded-xl border border-neutral-200 bg-white shadow-sm overflow-hidden">
        <div className="p-4 border-b border-neutral-100">
          <h2 className="text-sm font-semibold text-neutral-900">Worker Roster</h2>
        </div>
        {workers.length === 0 ? (
          <div className="p-8 text-center text-sm text-neutral-500">
            <Users className="mx-auto mb-2 h-8 w-8 text-neutral-400" />
            <p>No workers assigned to {deptName} yet.</p>
          </div>
        ) : (
          <div className="divide-y divide-neutral-100">
            {workers.map((w) => (
              <WorkerCard key={w.id} worker={w} complaints={complaints} pending={pending} run={run} isOrgAdmin={false} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Worker Card ─── */
function WorkerCard({ worker, complaints, pending, run, isOrgAdmin }: {
  worker: Worker;
  complaints: Complaint[];
  pending: boolean;
  run: (fn: () => Promise<{ error?: string }>) => void;
  isOrgAdmin: boolean;
}) {
  const [showActions, setShowActions] = useState(false);
  const stats = workerStats(worker, complaints);

  return (
    <div className={`p-4 transition-colors ${worker.suspended ? "bg-red-50" : "hover:bg-neutral-50"}`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Worker info */}
        <div className="flex items-center gap-3">
          <div className={`h-10 w-10 rounded-full flex items-center justify-center font-bold text-sm ${worker.suspended ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-800"}`}>
            {worker.display_name?.charAt(0).toUpperCase() || "W"}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-neutral-900">{worker.display_name || "Unnamed Worker"}</h3>
              {worker.suspended && <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700 font-medium">Suspended</span>}
            </div>
            <p className="text-xs text-neutral-400">Joined {new Date(worker.created_at).toLocaleDateString()}</p>
          </div>
        </div>

        {/* Stats + Actions */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <div className="flex items-center gap-1 rounded-md bg-amber-50 border border-amber-200 px-2.5 py-1 text-amber-800">
            <Briefcase className="h-3.5 w-3.5" />
            <span><strong>{stats.activeTasks}</strong> active</span>
          </div>
          {stats.waitingVerification > 0 && (
            <div className="flex items-center gap-1 rounded-md bg-indigo-50 border border-indigo-200 px-2.5 py-1 text-indigo-800">
              <UserCheck className="h-3.5 w-3.5" />
              <span><strong>{stats.waitingVerification}</strong> awaiting verify</span>
            </div>
          )}
          <div className="flex items-center gap-1 rounded-md bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-emerald-800">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span><strong>{stats.completedTasks}</strong> done</span>
          </div>
          {stats.avgResolutionHours && (
            <span className="text-neutral-500">Avg: <strong>{stats.avgResolutionHours}h</strong></span>
          )}

          {/* Action toggle */}
          <button
            onClick={() => setShowActions((v) => !v)}
            className="flex items-center gap-1 rounded-md border border-neutral-300 bg-white px-2.5 py-1 text-neutral-600 hover:bg-neutral-50"
          >
            Manage {showActions ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
        </div>
      </div>

      {/* Action panel */}
      {showActions && (
        <div className="mt-3 flex flex-wrap gap-2 border-t border-neutral-200 pt-3">
          {worker.suspended ? (
            <button
              disabled={pending}
              onClick={() => { if (confirm(`Unsuspend "${worker.display_name ?? "this worker"}"?`)) run(() => unsuspendWorker(worker.id)); }}
              className="flex items-center gap-1.5 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-40"
            >
              <UserCheck className="h-3.5 w-3.5" /> Unsuspend Worker
            </button>
          ) : (
            <button
              disabled={pending}
              onClick={() => { if (confirm(`Suspend "${worker.display_name ?? "this worker"}"? They won't be able to accept new tasks.`)) run(() => suspendWorker(worker.id)); }}
              className="flex items-center gap-1.5 rounded-md border border-orange-300 bg-orange-50 px-3 py-1.5 text-xs font-medium text-orange-700 hover:bg-orange-100 disabled:opacity-40"
            >
              <Ban className="h-3.5 w-3.5" /> Suspend Worker
            </button>
          )}

          <button
            disabled={pending}
            onClick={() => {
              if (confirm(`Remove worker role from "${worker.display_name ?? "this user"}"?\n\nThey will become a regular user. Their record is preserved so they can be reinstated by an Org Admin.`))
                run(() => demoteWorkerToUser(worker.id));
            }}
            className="flex items-center gap-1.5 rounded-md border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-40"
          >
            <UserX className="h-3.5 w-3.5" /> Remove Worker Role
          </button>

          {stats.activeTasks > 0 && (
            <Link
              href="/dept-admin/queue?status=processing"
              className="flex items-center gap-1 rounded-md border border-blue-300 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100"
            >
              View Active Tasks
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
