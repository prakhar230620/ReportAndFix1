"use client";

import { useState, useTransition } from "react";
import { assignComplaint } from "./actions";

type Worker = { id: string; display_name: string | null };
type Department = { id: string; name: string };

export default function AssignForm({
  complaintId,
  workers,
  departments,
}: {
  complaintId: string;
  workers: Worker[];
  departments: Department[];
}) {
  const [workerId, setWorkerId] = useState(workers[0]?.id ?? "");
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

  return (
    <div className="flex flex-col gap-2 rounded-md border border-neutral-300 p-3">
      <h3 className="text-sm font-semibold">Assign</h3>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <select
        value={workerId}
        onChange={(e) => setWorkerId(e.target.value)}
        className="rounded-md border border-neutral-300 px-2 py-1 text-sm"
      >
        {workers.length === 0 && <option value="">No workers in this college</option>}
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
      <button
        onClick={handleAssign}
        disabled={pending || workers.length === 0}
        className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm text-white disabled:opacity-40"
      >
        {pending ? "Assigning…" : "Assign"}
      </button>
    </div>
  );
}
