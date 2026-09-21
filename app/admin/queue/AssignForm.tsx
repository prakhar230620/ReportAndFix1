"use client";

import { useState, useTransition } from "react";
import { assignComplaint, unassignComplaint } from "./actions";

type Worker = { id: string; display_name: string | null };
type Department = { id: string; name: string };

export default function AssignForm({
  complaintId,
  workers,
  departments,
  currentWorkerId,
  currentWorkerName,
}: {
  complaintId: string;
  workers: Worker[];
  departments: Department[];
  currentWorkerId?: string | null;
  currentWorkerName?: string | null;
}) {
  const [workerId, setWorkerId] = useState(currentWorkerId || workers[0]?.id || "");
  const [departmentId, setDepartmentId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleAssign() {
    if (!workerId) {
      setError("Choose a worker.");
      return;
    }
    startTransition(async () => {
      setError(null);
      const result = await assignComplaint(complaintId, workerId, departmentId || null);
      if (result.error) setError(result.error);
    });
  }

  function handleUnassign() {
    startTransition(async () => {
      setError(null);
      const result = await unassignComplaint(complaintId);
      if (result.error) setError(result.error);
    });
  }

  const isReassign = !!currentWorkerId;

  return (
    <div className="flex flex-col gap-2 rounded-md border border-neutral-300 p-3">
      <h3 className="text-sm font-semibold">
        {isReassign ? "Reassign" : "Assign"}
      </h3>
      {isReassign && (
        <p className="text-xs text-neutral-500">
          Currently with <span className="font-medium">{currentWorkerName ?? "a worker"}</span>.
          Picking someone else moves it away from them; they&apos;ll be notified either way.
        </p>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
      <select
        value={workerId}
        onChange={(e) => setWorkerId(e.target.value)}
        className="rounded-md border border-neutral-300 px-2 py-1 text-sm"
      >
        {workers.length === 0 && <option value="">No workers in this organisation</option>}
        {workers.map((w) => (
          <option key={w.id} value={w.id}>{w.display_name ?? w.id}</option>
        ))}
      </select>
      <select
        value={departmentId}
        onChange={(e) => setDepartmentId(e.target.value)}
        className="rounded-md border border-neutral-300 px-2 py-1 text-sm"
      >
        <option value="">No department</option>
        {departments.map((d) => (
          <option key={d.id} value={d.id}>{d.name}</option>
        ))}
      </select>
      <div className="flex gap-2">
        <button
          onClick={handleAssign}
          disabled={pending || workers.length === 0}
          className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm text-white disabled:opacity-40"
        >
          {pending ? "Saving…" : isReassign ? "Reassign" : "Assign"}
        </button>
        {isReassign && (
          <button
            onClick={handleUnassign}
            disabled={pending}
            className="rounded-md border border-red-200 px-3 py-1.5 text-sm text-red-600 disabled:opacity-40"
          >
            Unassign
          </button>
        )}
      </div>
    </div>
  );
}
