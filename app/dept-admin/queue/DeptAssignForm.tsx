"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ButtonSpinner } from "@/app/components/Spinner";
import { assignComplaint, unassignComplaint } from "@/app/admin/queue/actions";
import { UserCheck, UserMinus, AlertCircle } from "lucide-react";

type Worker = { id: string; display_name: string | null };

export default function DeptAssignForm({
  complaintId,
  departmentId,
  workers,
  currentWorkerId,
  currentWorkerName,
}: {
  complaintId: string;
  departmentId: string;
  workers: Worker[];
  currentWorkerId: string | null;
  currentWorkerName?: string | null;
}) {
  const router = useRouter();
  const [workerId, setWorkerId] = useState(currentWorkerId || "");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleAssign(e: React.FormEvent) {
    e.preventDefault();
    if (!workerId) {
      setError("Please choose a worker from your department.");
      return;
    }

    startTransition(async () => {
      setError(null);
      setSuccess(null);
      const res = await assignComplaint(complaintId, workerId, departmentId);
      if (res.error) {
        setError(res.error);
      } else {
        setSuccess("Worker assigned successfully!");
        router.refresh();
      }
    });
  }

  function handleUnassign() {
    startTransition(async () => {
      setError(null);
      setSuccess(null);
      const res = await unassignComplaint(complaintId);
      if (res.error) {
        setError(res.error);
      } else {
        setSuccess("Complaint unassigned.");
        setWorkerId("");
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between border-b border-neutral-100 pb-2">
        <div className="flex items-center gap-2">
          <UserCheck className="h-4 w-4 text-neutral-600" />
          <h3 className="text-sm font-semibold text-neutral-900">
            {currentWorkerId ? "Reassign Department Worker" : "Assign to Department Worker"}
          </h3>
        </div>
        {currentWorkerName && (
          <span className="text-xs text-neutral-500">
            Current: <strong className="font-semibold text-neutral-800">{currentWorkerName}</strong>
          </span>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-1.5 rounded-md bg-red-50 p-2 text-xs text-red-700">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-md bg-emerald-50 p-2 text-xs text-emerald-800">
          {success}
        </div>
      )}

      {workers.length === 0 ? (
        <div className="rounded-lg border border-dashed border-amber-300 bg-amber-50/50 p-3 text-xs text-amber-800">
          No workers are currently registered under your department. Please ask your Organisation Admin to assign workers to your department.
        </div>
      ) : (
        <form onSubmit={handleAssign} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-neutral-700">Select Worker:</label>
            <select
              value={workerId}
              onChange={(e) => setWorkerId(e.target.value)}
              className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">-- Choose a worker --</option>
              {workers.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.display_name || w.id}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={pending || !workerId}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-neutral-800 disabled:opacity-50 transition-colors"
            >
              {pending && <ButtonSpinner />}
              {currentWorkerId ? "Update Assignment" : "Assign Worker"}
            </button>

            {currentWorkerId && (
              <button
                type="button"
                onClick={handleUnassign}
                disabled={pending}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
              >
                <UserMinus className="h-4 w-4" />
                Unassign
              </button>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
