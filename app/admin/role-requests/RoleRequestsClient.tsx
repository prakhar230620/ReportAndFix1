"use client";

import { useState, useTransition } from "react";
import Toggle from "@/app/components/Toggle";
import { ButtonSpinner } from "@/app/components/Spinner";
import {
  approveWorker,
  approveAsOrgAdmin,
  approveAsDeptAdmin,
  rejectRequest,
  toggleWorkerSignup,
} from "./actions";
import { ShieldCheck, Building2, UserX } from "lucide-react";

type Req = {
  id: string;
  created_at: string;
  user_id: string;
  profiles: { display_name: string | null } | null;
};
type Department = { id: string; name: string };

export default function RoleRequestsClient({
  college,
  workerRequests,
  adminRequests,
  departments,
}: {
  college: { id: string; name: string; allow_worker_signup: boolean };
  workerRequests: Req[];
  adminRequests: Req[];
  approvalCounts: Record<string, number>;
  adminCountNeeded: number;
  myApprovedIds: string[];
  departments: Department[];
}) {
  const [pending, startTransition] = useTransition();
  const [allowWorker, setAllowWorker] = useState(college.allow_worker_signup);

  function handle(fn: () => Promise<{ error?: string; ok?: boolean }>) {
    startTransition(async () => {
      const result = await fn();
      if (result.error) alert(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Worker requests */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-neutral-900">Worker requests</h2>
            <p className="text-xs text-neutral-500">
              Assign workers to a department and grant work access.
            </p>
          </div>
          <label className="flex items-center gap-2 text-xs text-neutral-500 cursor-pointer">
            Allow new worker signups
            <Toggle
              checked={allowWorker}
              onChange={(next) => {
                setAllowWorker(next);
                handle(() => toggleWorkerSignup(college.id, next));
              }}
            />
          </label>
        </div>
        {workerRequests.length === 0 && (
          <p className="text-sm text-neutral-500 rounded-lg border border-dashed border-neutral-200 p-4 text-center">
            No pending worker requests.
          </p>
        )}
        <div className="flex flex-col gap-2">
          {workerRequests.map((r) => (
            <WorkerRequestRow
              key={r.id}
              req={r}
              departments={departments}
              pending={pending}
              handle={handle}
            />
          ))}
        </div>
      </section>

      {/* Admin requests: Decide between Organisation Admin vs Departmental Admin */}
      <section>
        <div className="mb-3">
          <h2 className="text-lg font-semibold text-neutral-900">Admin Requests</h2>
          <p className="text-xs text-neutral-500">
            Decide whether to grant full <strong>Organisation Admin</strong> access or assign as a <strong>Departmental Admin</strong> for a specific department.
          </p>
        </div>

        {adminRequests.length === 0 && (
          <p className="text-sm text-neutral-500 rounded-lg border border-dashed border-neutral-200 p-4 text-center">
            No pending admin requests.
          </p>
        )}

        <div className="flex flex-col gap-3">
          {adminRequests.map((r) => (
            <AdminRequestRow
              key={r.id}
              req={r}
              departments={departments}
              pending={pending}
              handle={handle}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

function AdminRequestRow({
  req,
  departments,
  pending,
  handle,
}: {
  req: Req;
  departments: Department[];
  pending: boolean;
  handle: (fn: () => Promise<{ error?: string; ok?: boolean }>) => void;
}) {
  const [selectedDeptId, setSelectedDeptId] = useState(departments[0]?.id || "");
  const [mode, setMode] = useState<"idle" | "dept">("idle");

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm transition">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-100 pb-3">
        <div>
          <div className="font-semibold text-neutral-900 text-sm">
            {req.profiles?.display_name ?? "Unnamed Applicant"}
          </div>
          <div className="text-xs text-neutral-400">
            Requested on {new Date(req.created_at).toLocaleDateString()} · Pending role decision
          </div>
        </div>

        <button
          disabled={pending}
          onClick={() => handle(() => rejectRequest(req.id, "Rejected by Organisation Admin"))}
          className="inline-flex items-center gap-1 rounded-md border border-neutral-200 px-2.5 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-40"
        >
          <UserX size={13} /> Reject
        </button>
      </div>

      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {mode === "idle" ? (
          <div className="flex flex-wrap items-center gap-2">
            <button
              disabled={pending}
              onClick={() => handle(() => approveAsOrgAdmin(req.id))}
              className="inline-flex items-center gap-1.5 rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-neutral-800 disabled:opacity-50"
            >
              <ShieldCheck size={14} />
              Approve as Organisation Admin
            </button>

            <button
              disabled={pending}
              onClick={() => setMode("dept")}
              className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50"
            >
              <Building2 size={14} />
              Approve as Departmental Admin…
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2 bg-blue-50/60 p-2.5 rounded-lg border border-blue-200 w-full sm:w-auto">
            <span className="text-xs font-medium text-neutral-700">Select Department:</span>
            <select
              value={selectedDeptId}
              onChange={(e) => setSelectedDeptId(e.target.value)}
              className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-xs text-neutral-900"
            >
              {departments.length === 0 ? (
                <option value="">No active departments found</option>
              ) : (
                departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))
              )}
            </select>

            <button
              disabled={pending || !selectedDeptId}
              onClick={() => handle(() => approveAsDeptAdmin(req.id, selectedDeptId))}
              className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1 text-xs font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
            >
              Confirm Dept Admin
            </button>

            <button
              onClick={() => setMode("idle")}
              className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-xs text-neutral-600 hover:bg-neutral-50"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function WorkerRequestRow({
  req,
  departments,
  pending,
  handle,
}: {
  req: Req;
  departments: Department[];
  pending: boolean;
  handle: (fn: () => Promise<{ error?: string; ok?: boolean }>) => void;
}) {
  const [deptId, setDeptId] = useState<string>("");
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-neutral-200 bg-white p-3 text-sm shadow-sm">
      <div>
        <div className="font-medium text-neutral-900">{req.profiles?.display_name ?? "Unnamed"}</div>
        <div className="text-xs text-neutral-400">
          Applied on {new Date(req.created_at).toLocaleDateString()}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={deptId}
          onChange={(e) => setDeptId(e.target.value)}
          className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-xs"
        >
          <option value="">No department</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
        <button
          disabled={pending}
          onClick={() => handle(() => approveWorker(req.id, deptId || null))}
          className="flex items-center gap-1.5 rounded-md bg-green-600 px-3 py-1 text-xs font-medium text-white shadow-sm hover:bg-green-700 disabled:opacity-50"
        >
          {pending && <ButtonSpinner />}
          Approve
        </button>
        <button
          disabled={pending}
          onClick={() => handle(() => rejectRequest(req.id, "Rejected by admin"))}
          className="rounded-md border border-red-200 px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
        >
          Reject
        </button>
      </div>
    </div>
  );
}
