"use client";

import { useState, useTransition } from "react";
import { assignComplaint, unassignComplaint } from "./actions";
import { Building2, User, ArrowRight, UserCheck } from "lucide-react";
import { ButtonSpinner } from "@/app/components/Spinner";

type Worker = { id: string; display_name: string | null; department_id?: string | null };
type Department = { id: string; name: string };

export default function AssignForm({
  complaintId,
  workers,
  departments,
  currentWorkerId,
  currentWorkerName,
  currentDepartmentId,
}: {
  complaintId: string;
  workers: Worker[];
  departments: Department[];
  currentWorkerId?: string | null;
  currentWorkerName?: string | null;
  currentDepartmentId?: string | null;
}) {
  const [departmentId, setDepartmentId] = useState(currentDepartmentId || "");
  const [workerId, setWorkerId] = useState(currentWorkerId || "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleAssign() {
    if (!departmentId && !workerId) {
      setError("Please select a department or worker.");
      return;
    }
    startTransition(async () => {
      setError(null);
      const result = await assignComplaint(complaintId, workerId || null, departmentId || null);
      if (result.error) setError(result.error);
    });
  }

  function handleUnassign() {
    startTransition(async () => {
      setError(null);
      const result = await unassignComplaint(complaintId);
      if (result.error) setError(result.error);
      else {
        setWorkerId("");
        setDepartmentId("");
      }
    });
  }

  const isAssigned = !!currentWorkerId || !!currentDepartmentId;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between border-b border-neutral-100 pb-2">
        <h3 className="text-sm font-semibold text-neutral-900 flex items-center gap-1.5">
          <Building2 className="h-4 w-4 text-blue-600" />
          {isAssigned ? "Manage Assignment" : "Assign to Department / Worker"}
        </h3>
        {isAssigned && (
          <button
            type="button"
            disabled={pending}
            onClick={handleUnassign}
            className="text-xs text-red-600 hover:underline disabled:opacity-50"
          >
            Unassign
          </button>
        )}
      </div>

      {isAssigned && (
        <div className="rounded-lg bg-blue-50/60 p-2.5 text-xs text-blue-900 border border-blue-100 flex items-center gap-2">
          <UserCheck className="h-4 w-4 text-blue-600 shrink-0" />
          <span>
            {currentWorkerName
              ? `Currently assigned to worker ${currentWorkerName}`
              : "Assigned to Department · Awaiting Departmental Admin delegation"}
          </span>
        </div>
      )}

      {error && <p className="text-xs text-red-600 font-medium">{error}</p>}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {/* Department Select */}
        <label className="flex flex-col gap-1 text-xs font-medium text-neutral-700">
          <span className="flex items-center gap-1">
            <Building2 className="h-3.5 w-3.5 text-neutral-500" />
            Select Department (Routes to Dept Admin)
          </span>
          <select
            value={departmentId}
            onChange={(e) => {
              setDepartmentId(e.target.value);
            }}
            className="rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-sm text-neutral-900 focus:border-neutral-900 focus:outline-none"
          >
            <option value="">-- No Department --</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>

        {/* Worker Select */}
        <label className="flex flex-col gap-1 text-xs font-medium text-neutral-700">
          <span className="flex items-center gap-1">
            <User className="h-3.5 w-3.5 text-neutral-500" />
            Specific Worker
          </span>
          <select
            value={workerId}
            onChange={(e) => {
              setWorkerId(e.target.value);
              // Workers can belong to multiple departments — do not auto-lock dept
            }}
            className="rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-sm text-neutral-900 focus:border-neutral-900 focus:outline-none"
          >
            <option value="">Let Departmental Admin assign worker</option>
            {workers.map((w) => (
              <option key={w.id} value={w.id}>
                {w.display_name ?? w.id} {w.department_id ? `(${departments.find((d) => d.id === w.department_id)?.name ?? "Dept"})` : "(No dept yet)"}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-1 flex justify-end">
        <button
          type="button"
          onClick={handleAssign}
          disabled={pending || (!departmentId && !workerId)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-neutral-900 px-4 py-2 text-xs font-medium text-white shadow-sm hover:bg-neutral-800 disabled:opacity-40 transition-colors"
        >
          {pending && <ButtonSpinner />}
          <ArrowRight className="h-3.5 w-3.5" />
          {workerId ? "Assign Worker & Department" : "Assign to Department"}
        </button>
      </div>
    </div>
  );
}
