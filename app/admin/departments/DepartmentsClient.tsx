"use client";

import { useState, useTransition } from "react";
import { Plus, Pencil, Ban, CheckCircle2, Trash2, UserMinus } from "lucide-react";
import { ButtonSpinner } from "@/app/components/Spinner";
import {
  createDepartment,
  renameDepartment,
  setDepartmentSuspended,
  deleteDepartment,
  setWorkerDepartment,
} from "./actions";

type Department = { id: string; name: string; suspended: boolean; created_at: string };
type Worker = { id: string; display_name: string | null; department_id: string | null };

export default function DepartmentsClient({
  departments,
  workers,
}: {
  departments: Department[];
  workers: Worker[];
}) {
  const [pending, startTransition] = useTransition();
  const [newName, setNewName] = useState("");

  function run(fn: () => Promise<{ error?: string }>) {
    startTransition(async () => {
      const res = await fn();
      if (res.error) alert(res.error);
    });
  }

  const unassigned = workers.filter((w) => !w.department_id);
  const workersOf = (deptId: string) => workers.filter((w) => w.department_id === deptId);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Departments</h1>
        <p className="text-sm text-neutral-500">
          Organise workers into departments. A suspended department can&apos;t be assigned new
          complaints or workers.
        </p>
      </div>

      <div className="flex gap-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New department name (e.g. Electrical, Housekeeping)"
          className="flex-1 rounded-md border border-neutral-300 px-3 py-1.5 text-sm"
        />
        <button
          disabled={pending || !newName.trim()}
          onClick={() => {
            const n = newName;
            setNewName("");
            run(() => createDepartment(n));
          }}
          className="flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
        >
          {pending ? <ButtonSpinner /> : <Plus size={15} />} Add
        </button>
      </div>

      <div className="flex flex-col gap-3">
        {departments.map((d) => (
          <DepartmentCard
            key={d.id}
            dept={d}
            workers={workersOf(d.id)}
            allWorkers={workers}
            pending={pending}
            run={run}
          />
        ))}
        {departments.length === 0 && (
          <p className="text-sm text-neutral-500">No departments yet — add one above.</p>
        )}
      </div>

      {unassigned.length > 0 && (
        <div className="rounded-lg border border-dashed border-neutral-300 p-4">
          <h2 className="mb-2 text-sm font-semibold text-neutral-700">
            Unassigned workers ({unassigned.length})
          </h2>
          <div className="flex flex-col gap-2">
            {unassigned.map((w) => (
              <WorkerRow key={w.id} worker={w} departments={departments} pending={pending} run={run} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function DepartmentCard({
  dept,
  workers,
  allWorkers,
  pending,
  run,
}: {
  dept: Department;
  workers: Worker[];
  allWorkers: Worker[];
  pending: boolean;
  run: (fn: () => Promise<{ error?: string }>) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(dept.name);
  const [addWorkerId, setAddWorkerId] = useState("");

  const available = allWorkers.filter((w) => w.department_id !== dept.id);

  return (
    <div className={`rounded-lg border p-4 ${dept.suspended ? "border-neutral-200 bg-neutral-50 opacity-70" : "border-neutral-200 bg-white shadow-sm"}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {editing ? (
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded-md border border-neutral-300 px-2 py-1 text-sm"
            />
          ) : (
            <span className="font-medium">{dept.name}</span>
          )}
          <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-500">
            {workers.length} worker{workers.length === 1 ? "" : "s"}
          </span>
          {dept.suspended && (
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700">Suspended</span>
          )}
        </div>
        <div className="flex gap-2 text-neutral-500">
          {editing ? (
            <button
              onClick={() => {
                run(() => renameDepartment(dept.id, name));
                setEditing(false);
              }}
              className="text-xs font-medium text-blue-600"
            >
              Save
            </button>
          ) : (
            <button onClick={() => setEditing(true)} title="Rename">
              <Pencil size={14} />
            </button>
          )}
          <button
            disabled={pending}
            onClick={() => run(() => setDepartmentSuspended(dept.id, !dept.suspended))}
            title={dept.suspended ? "Unsuspend" : "Suspend"}
          >
            {dept.suspended ? <CheckCircle2 size={14} /> : <Ban size={14} />}
          </button>
          <button
            disabled={pending}
            onClick={() => {
              if (confirm(`Delete "${dept.name}"?`)) run(() => deleteDepartment(dept.id));
            }}
            title="Delete"
            className="text-red-500"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      <div className="mt-3 flex flex-col gap-1.5">
        {workers.map((w) => (
          <div key={w.id} className="flex items-center justify-between rounded-md bg-neutral-50 px-2.5 py-1.5 text-sm">
            <span>{w.display_name ?? "Unnamed"}</span>
            <button
              disabled={pending}
              onClick={() => run(() => setWorkerDepartment(w.id, null))}
              className="flex items-center gap-1 text-xs text-neutral-500 hover:text-red-600"
            >
              <UserMinus size={12} /> Remove
            </button>
          </div>
        ))}
      </div>

      {!dept.suspended && available.length > 0 && (
        <div className="mt-2 flex gap-2">
          <select
            value={addWorkerId}
            onChange={(e) => setAddWorkerId(e.target.value)}
            className="flex-1 rounded-md border border-neutral-300 px-2 py-1 text-xs"
          >
            <option value="">Add a worker…</option>
            {available.map((w) => (
              <option key={w.id} value={w.id}>{w.display_name ?? w.id}</option>
            ))}
          </select>
          <button
            disabled={pending || !addWorkerId}
            onClick={() => {
              const id = addWorkerId;
              setAddWorkerId("");
              run(() => setWorkerDepartment(id, dept.id));
            }}
            className="rounded-md bg-neutral-900 px-3 py-1 text-xs text-white disabled:opacity-40"
          >
            Add
          </button>
        </div>
      )}
    </div>
  );
}

function WorkerRow({
  worker,
  departments,
  pending,
  run,
}: {
  worker: Worker;
  departments: Department[];
  pending: boolean;
  run: (fn: () => Promise<{ error?: string }>) => void;
}) {
  const [deptId, setDeptId] = useState("");
  const active = departments.filter((d) => !d.suspended);
  return (
    <div className="flex items-center justify-between gap-2 text-sm">
      <span>{worker.display_name ?? "Unnamed"}</span>
      <div className="flex gap-2">
        <select
          value={deptId}
          onChange={(e) => setDeptId(e.target.value)}
          className="rounded-md border border-neutral-300 px-2 py-1 text-xs"
        >
          <option value="">Assign to…</option>
          {active.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
        <button
          disabled={pending || !deptId}
          onClick={() => {
            const id = deptId;
            setDeptId("");
            run(() => setWorkerDepartment(worker.id, id));
          }}
          className="rounded-md bg-neutral-900 px-3 py-1 text-xs text-white disabled:opacity-40"
        >
          Assign
        </button>
      </div>
    </div>
  );
}
