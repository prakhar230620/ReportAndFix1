"use client";

import { useState, useTransition } from "react";
import {
  Plus, Pencil, Ban, CheckCircle2, Trash2, UserMinus,
  ShieldCheck, ShieldOff, ArrowUpCircle, ArrowDownCircle,
  ChevronDown, ChevronUp, RefreshCw, UserX, UserCheck, History,
  Users, UserPlus,
} from "lucide-react";
import { ButtonSpinner } from "@/app/components/Spinner";
import {
  createDepartment, renameDepartment, setDepartmentSuspended,
  deleteDepartment, setWorkerDepartment, promoteWorkerToDeptAdmin,
  setDeptAdminToWorker, reassignDeptAdminDepartment, demoteDeptAdminToUser,
  proposeForOrgAdmin, suspendWorker, unsuspendWorker, demoteWorkerToUser,
  reinstateAsWorker, assignUserAsWorker,
} from "./actions";

type Department = { id: string; name: string; suspended: boolean; created_at: string };
type Worker = { id: string; display_name: string | null; department_id: string | null; suspended: boolean };
type DeptAdmin = { id: string; display_name: string | null; department_id: string | null };
type FormerWorker = { id: string; display_name: string | null; role: string };
type AvailableUser = {
  id: string;
  display_name: string | null;
  role: string;
  sourceLabel: string;
  isDemoted: boolean;
};

export default function DepartmentsClient({
  departments, workers, deptAdmins, pendingAdminUserIds,
  totalOrgAdmins, formerWorkers, availableUsers,
}: {
  departments: Department[];
  workers: Worker[];
  deptAdmins: DeptAdmin[];
  pendingAdminUserIds: string[];
  totalOrgAdmins: number;
  formerWorkers: FormerWorker[];
  availableUsers: AvailableUser[];
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
  const deptAdminsOf = (deptId: string) => deptAdmins.filter((a) => a.department_id === deptId);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-xl font-semibold">Departments & Roles</h1>
        <p className="text-sm text-neutral-500">
          Manage departments, assign workers, promote to Departmental Admin, and manage role transitions.
        </p>
      </div>

      {/* Create department */}
      <div className="flex gap-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New department name (e.g. Electrical, Housekeeping)"
          className="flex-1 rounded-md border border-neutral-300 px-3 py-1.5 text-sm"
        />
        <button
          disabled={pending || !newName.trim()}
          onClick={() => { const n = newName; setNewName(""); run(() => createDepartment(n)); }}
          className="flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
        >
          {pending ? <ButtonSpinner /> : <Plus size={15} />} Add
        </button>
      </div>

      {/* Department cards */}
      <div className="flex flex-col gap-4">
        {departments.map((d) => (
          <DepartmentCard
            key={d.id}
            dept={d}
            workers={workersOf(d.id)}
            deptAdmins={deptAdminsOf(d.id)}
            allWorkers={workers}
            allDepartments={departments}
            pendingAdminUserIds={pendingAdminUserIds}
            totalOrgAdmins={totalOrgAdmins}
            pending={pending}
            run={run}
          />
        ))}
        {departments.length === 0 && <p className="text-sm text-neutral-500">No departments yet — add one above.</p>}
      </div>

      {/* Assign Eligible Worker (Applicants & Former Workers only) */}
      {availableUsers.length > 0 && departments.filter((d) => !d.suspended).length > 0 && (
        <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-4">
          <div className="flex items-center gap-2 mb-2">
            <UserPlus size={16} className="text-blue-600" />
            <h2 className="text-sm font-semibold text-blue-900">
              Assign Eligible Worker ({availableUsers.length} available)
            </h2>
          </div>
          <p className="text-xs text-neutral-500 mb-3">
            Only users who applied for the worker role during signup or former workers removed by an admin appear here. Normal members remain anonymous.
          </p>
          <AssignMemberForm
            availableUsers={availableUsers}
            departments={departments.filter((d) => !d.suspended)}
            pending={pending}
            run={run}
          />
        </div>
      )}

      {/* Unassigned Dept Admins */}
      {deptAdmins.filter((a) => !a.department_id).length > 0 && (
        <div className="rounded-lg border border-dashed border-amber-300 bg-amber-50 p-4">
          <h2 className="mb-2 text-sm font-semibold text-amber-800">
            Unassigned Dept. Admins ({deptAdmins.filter((a) => !a.department_id).length})
          </h2>
          <div className="flex flex-col gap-2">
            {deptAdmins.filter((a) => !a.department_id).map((a) => (
              <UnassignedDeptAdmin key={a.id} admin={a} departments={departments}
                pendingAdminUserIds={pendingAdminUserIds} totalOrgAdmins={totalOrgAdmins}
                pending={pending} run={run} />
            ))}
          </div>
        </div>
      )}

      {/* Unassigned Workers */}
      {unassigned.length > 0 && (
        <div className="rounded-lg border border-dashed border-neutral-300 p-4">
          <h2 className="mb-2 text-sm font-semibold text-neutral-700">
            Unassigned Workers ({unassigned.length})
          </h2>
          <div className="flex flex-col gap-2">
            {unassigned.map((w) => (
              <UnassignedWorkerRow key={w.id} worker={w} departments={departments}
                pendingAdminUserIds={pendingAdminUserIds} totalOrgAdmins={totalOrgAdmins}
                pending={pending} run={run} />
            ))}
          </div>
        </div>
      )}

      {/* Former Workers (role=user, demoted) */}
      {formerWorkers.length > 0 && (
        <div className="rounded-lg border border-dashed border-neutral-200 bg-neutral-50 p-4">
          <div className="flex items-center gap-2 mb-2">
            <History size={15} className="text-neutral-400" />
            <h2 className="text-sm font-semibold text-neutral-600">Former Workers ({formerWorkers.length})</h2>
          </div>
          <p className="text-xs text-neutral-400 mb-3">
            These users were previously workers and can be reinstated. Their identities are kept private.
          </p>
          <div className="flex flex-col gap-2">
            {formerWorkers.map((fw) => (
              <FormerWorkerRow key={fw.id} former={fw} departments={departments} pending={pending} run={run} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Assign Member Form ─── */
function AssignMemberForm({
  availableUsers,
  departments,
  pending,
  run,
}: {
  availableUsers: AvailableUser[];
  departments: Department[];
  pending: boolean;
  run: (fn: () => Promise<{ error?: string }>) => void;
}) {
  const [userId, setUserId] = useState("");
  const [deptId, setDeptId] = useState("");

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <select
        value={userId}
        onChange={(e) => setUserId(e.target.value)}
        className="rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-xs font-medium"
      >
        <option value="">Select applicant or former worker...</option>
        {availableUsers.map((u) => (
          <option key={u.id} value={u.id}>
            {u.display_name ?? "User"} [{u.sourceLabel}]
          </option>
        ))}
      </select>

      <select
        value={deptId}
        onChange={(e) => setDeptId(e.target.value)}
        className="rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-xs font-medium"
      >
        <option value="">Select department...</option>
        {departments.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name}
          </option>
        ))}
      </select>

      <button
        disabled={pending || !userId || !deptId}
        onClick={() => {
          const u = userId;
          const d = deptId;
          setUserId("");
          setDeptId("");
          run(() => assignUserAsWorker(u, d));
        }}
        className="flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-40"
      >
        <UserPlus size={13} /> Assign to Department
      </button>
    </div>
  );
}

/* ─── Department Card ─── */
function DepartmentCard({ dept, workers, deptAdmins, allWorkers, allDepartments, pendingAdminUserIds, totalOrgAdmins, pending, run }: {
  dept: Department; workers: Worker[]; deptAdmins: DeptAdmin[];
  allWorkers: Worker[]; allDepartments: Department[];
  pendingAdminUserIds: string[]; totalOrgAdmins: number;
  pending: boolean; run: (fn: () => Promise<{ error?: string }>) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(dept.name);
  const [addWorkerId, setAddWorkerId] = useState("");
  const [collapsed, setCollapsed] = useState(false);
  const available = allWorkers.filter((w) => w.department_id !== dept.id);

  return (
    <div className={`rounded-lg border p-4 ${dept.suspended ? "border-neutral-200 bg-neutral-50 opacity-70" : "border-neutral-200 bg-white shadow-sm"}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button onClick={() => setCollapsed((v) => !v)} className="text-neutral-400 hover:text-neutral-700">
            {collapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
          </button>
          {editing ? (
            <input value={name} onChange={(e) => setName(e.target.value)} className="rounded-md border border-neutral-300 px-2 py-1 text-sm" />
          ) : (
            <span className="font-medium">{dept.name}</span>
          )}
          <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-500">
            {deptAdmins.length} admin{deptAdmins.length === 1 ? "" : "s"} · {workers.length} worker{workers.length === 1 ? "" : "s"}
          </span>
          {dept.suspended && <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700">Suspended</span>}
        </div>
        <div className="flex gap-2 text-neutral-500">
          {editing ? (
            <button onClick={() => { run(() => renameDepartment(dept.id, name)); setEditing(false); }} className="text-xs font-medium text-blue-600">Save</button>
          ) : (
            <button onClick={() => setEditing(true)} title="Rename"><Pencil size={14} /></button>
          )}
          <button disabled={pending} onClick={() => run(() => setDepartmentSuspended(dept.id, !dept.suspended))} title={dept.suspended ? "Unsuspend" : "Suspend"}>
            {dept.suspended ? <CheckCircle2 size={14} /> : <Ban size={14} />}
          </button>
          <button disabled={pending} onClick={() => { if (confirm(`Delete "${dept.name}"?`)) run(() => deleteDepartment(dept.id)); }} title="Delete" className="text-red-500">
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {!collapsed && (
        <div className="mt-3 space-y-3">
          {deptAdmins.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-amber-700">Departmental Admins</p>
              <div className="flex flex-col gap-1.5">
                {deptAdmins.map((a) => (
                  <DeptAdminRow key={a.id} admin={a} currentDept={dept} allDepartments={allDepartments}
                    pendingAdminUserIds={pendingAdminUserIds} totalOrgAdmins={totalOrgAdmins} pending={pending} run={run} />
                ))}
              </div>
            </div>
          )}

          {workers.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">Workers</p>
              <div className="flex flex-col gap-1.5">
                {workers.map((w) => (
                  <WorkerRow key={w.id} worker={w} currentDept={dept} allDepartments={allDepartments}
                    pendingAdminUserIds={pendingAdminUserIds} totalOrgAdmins={totalOrgAdmins} pending={pending} run={run} />
                ))}
              </div>
            </div>
          )}

          {!dept.suspended && (
            <div className="mt-1 flex gap-2">
              <select value={addWorkerId} onChange={(e) => setAddWorkerId(e.target.value)} className="flex-1 rounded-md border border-neutral-300 px-2 py-1 text-xs">
                <option value="">Add worker to this dept (multi-dept allowed)...</option>
                {allWorkers.filter((w) => w.department_id !== dept.id).map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.display_name ?? w.id} {w.department_id ? "(also in other dept)" : "(unassigned)"}
                  </option>
                ))}
              </select>
              <button disabled={pending || !addWorkerId} onClick={() => { const id = addWorkerId; setAddWorkerId(""); run(() => setWorkerDepartment(id, dept.id)); }} className="rounded-md bg-neutral-900 px-3 py-1 text-xs text-white disabled:opacity-40">Add</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Dept Admin Row ─── */
function DeptAdminRow({ admin, currentDept, allDepartments, pendingAdminUserIds, totalOrgAdmins, pending, run }: {
  admin: DeptAdmin; currentDept: Department; allDepartments: Department[];
  pendingAdminUserIds: string[]; totalOrgAdmins: number;
  pending: boolean; run: (fn: () => Promise<{ error?: string }>) => void;
}) {
  const [showActions, setShowActions] = useState(false);
  const [reassignDeptId, setReassignDeptId] = useState("");
  const alreadyProposed = pendingAdminUserIds.includes(admin.id);
  const otherDepts = allDepartments.filter((d) => d.id !== currentDept.id && !d.suspended);

  return (
    <div className="rounded-md border border-amber-100 bg-amber-50 px-2.5 py-2 text-sm">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ShieldCheck size={13} className="text-amber-600" />
          <span className="font-medium">{admin.display_name ?? "Unnamed"}</span>
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">Dept Admin</span>
          {alreadyProposed && <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700">Org Admin Proposed</span>}
        </div>
        <button onClick={() => setShowActions((v) => !v)} className="flex items-center gap-1 rounded-md px-2 py-0.5 text-xs text-neutral-600 hover:bg-amber-100">
          Actions {showActions ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>
      </div>
      {showActions && (
        <div className="mt-2 flex flex-wrap gap-2 border-t border-amber-100 pt-2">
          <button disabled={pending} onClick={() => { if (confirm(`Demote "${admin.display_name ?? "this user"}" to Worker in ${currentDept.name}?`)) run(() => setDeptAdminToWorker(admin.id, currentDept.id)); }} className="flex items-center gap-1 rounded-md border border-neutral-300 bg-white px-2.5 py-1 text-xs text-neutral-700 hover:bg-red-50 hover:border-red-300 disabled:opacity-40">
            <ArrowDownCircle size={12} className="text-red-500" /> Demote to Worker
          </button>
          <button disabled={pending} onClick={() => { if (confirm(`Remove "${admin.display_name ?? "this user"}" from Dept Admin role entirely?`)) run(() => demoteDeptAdminToUser(admin.id)); }} className="flex items-center gap-1 rounded-md border border-red-300 bg-white px-2.5 py-1 text-xs text-red-700 hover:bg-red-50 disabled:opacity-40">
            <ShieldOff size={12} /> Remove Role (User)
          </button>
          {otherDepts.length > 0 && (
            <div className="flex items-center gap-1">
              <select value={reassignDeptId} onChange={(e) => setReassignDeptId(e.target.value)} className="rounded-md border border-neutral-300 px-2 py-1 text-xs">
                <option value="">Move to dept...</option>
                {otherDepts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
              <button disabled={pending || !reassignDeptId} onClick={() => { const id = reassignDeptId; setReassignDeptId(""); run(() => reassignDeptAdminDepartment(admin.id, id)); }} className="flex items-center gap-1 rounded-md border border-neutral-300 bg-white px-2.5 py-1 text-xs text-neutral-700 hover:bg-neutral-50 disabled:opacity-40">
                <RefreshCw size={11} /> Move
              </button>
            </div>
          )}
          {!alreadyProposed && (
            <button disabled={pending} onClick={() => { if (confirm(totalOrgAdmins > 1 ? `Propose for Org Admin? All ${totalOrgAdmins} Org Admins must endorse, then Super Admin approves.` : `Propose for Org Admin? Super Admin must approve.`)) run(() => proposeForOrgAdmin(admin.id)); }} className="flex items-center gap-1 rounded-md border border-blue-300 bg-blue-50 px-2.5 py-1 text-xs text-blue-700 hover:bg-blue-100 disabled:opacity-40">
              <ArrowUpCircle size={12} /> Propose for Org Admin
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Worker Row (inside department) ─── */
function WorkerRow({ worker, currentDept, allDepartments, pendingAdminUserIds, totalOrgAdmins, pending, run }: {
  worker: Worker; currentDept: Department; allDepartments: Department[];
  pendingAdminUserIds: string[]; totalOrgAdmins: number;
  pending: boolean; run: (fn: () => Promise<{ error?: string }>) => void;
}) {
  const [showActions, setShowActions] = useState(false);
  const [promoteDeptId, setPromoteDeptId] = useState(currentDept.id);
  const otherDepts = allDepartments.filter((d) => d.id !== currentDept.id && !d.suspended);
  const [moveDeptId, setMoveDeptId] = useState("");

  return (
    <div className={`rounded-md px-2.5 py-2 text-sm ${worker.suspended ? "bg-red-50 border border-red-200" : "bg-neutral-50"}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-medium text-neutral-800">{worker.display_name ?? "Unnamed"}</span>
          {worker.suspended && (
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
              Suspended
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowActions((v) => !v)} className="flex items-center gap-1 rounded-md px-2 py-0.5 text-xs text-neutral-500 hover:bg-neutral-200">
            Actions {showActions ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
          <button disabled={pending} onClick={() => run(() => setWorkerDepartment(worker.id, null))} className="flex items-center gap-1 text-xs text-neutral-500 hover:text-red-600">
            <UserMinus size={12} /> Remove
          </button>
        </div>
      </div>
      {showActions && (
        <div className="mt-2 flex flex-wrap gap-2 border-t border-neutral-200 pt-2">
          {/* Suspend / Unsuspend */}
          {worker.suspended ? (
            <button
              disabled={pending}
              onClick={() => { if (confirm(`Unsuspend "${worker.display_name ?? "this worker"}"?`)) run(() => unsuspendWorker(worker.id)); }}
              className="flex items-center gap-1 rounded-md border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-xs text-emerald-700 hover:bg-emerald-100 disabled:opacity-40"
            >
              <UserCheck size={12} /> Unsuspend
            </button>
          ) : (
            <button
              disabled={pending}
              onClick={() => { if (confirm(`Suspend "${worker.display_name ?? "this worker"}"?`)) run(() => suspendWorker(worker.id)); }}
              className="flex items-center gap-1 rounded-md border border-orange-300 bg-orange-50 px-2.5 py-1 text-xs text-orange-700 hover:bg-orange-100 disabled:opacity-40"
            >
              <Ban size={12} /> Suspend
            </button>
          )}

          {/* Demote to User */}
          <button disabled={pending} onClick={() => { if (confirm(`Remove worker role from "${worker.display_name ?? "this user"}"? They will become a regular user. A record is kept for reinstatement.`)) run(() => demoteWorkerToUser(worker.id)); }} className="flex items-center gap-1 rounded-md border border-red-300 bg-white px-2.5 py-1 text-xs text-red-700 hover:bg-red-50 disabled:opacity-40">
            <UserX size={12} /> Remove Worker Role
          </button>

          {/* Move to another department */}
          {otherDepts.length > 0 && (
            <div className="flex items-center gap-1">
              <select value={moveDeptId} onChange={(e) => setMoveDeptId(e.target.value)} className="rounded-md border border-neutral-300 px-2 py-1 text-xs">
                <option value="">Move to dept...</option>
                {otherDepts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
              <button disabled={pending || !moveDeptId} onClick={() => { const id = moveDeptId; setMoveDeptId(""); run(() => setWorkerDepartment(worker.id, id)); }} className="flex items-center gap-1 rounded-md border border-neutral-300 bg-white px-2.5 py-1 text-xs text-neutral-700 hover:bg-neutral-50 disabled:opacity-40">
                <RefreshCw size={11} /> Move
              </button>
            </div>
          )}

          {/* Promote to Dept Admin */}
          <div className="flex items-center gap-1">
            <select value={promoteDeptId} onChange={(e) => setPromoteDeptId(e.target.value)} className="rounded-md border border-neutral-300 px-2 py-1 text-xs">
              {allDepartments.filter((d) => !d.suspended).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            <button disabled={pending || !promoteDeptId} onClick={() => { if (confirm(`Promote "${worker.display_name ?? "this worker"}" to Departmental Admin?`)) run(() => promoteWorkerToDeptAdmin(worker.id, promoteDeptId)); }} className="flex items-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs text-amber-800 hover:bg-amber-100 disabled:opacity-40">
              <ArrowUpCircle size={12} /> Promote to Dept Admin
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Unassigned Dept Admin ─── */
function UnassignedDeptAdmin({ admin, departments, pendingAdminUserIds, totalOrgAdmins, pending, run }: {
  admin: DeptAdmin; departments: Department[];
  pendingAdminUserIds: string[]; totalOrgAdmins: number;
  pending: boolean; run: (fn: () => Promise<{ error?: string }>) => void;
}) {
  const [assignDeptId, setAssignDeptId] = useState("");
  const alreadyProposed = pendingAdminUserIds.includes(admin.id);
  const activeDepts = departments.filter((d) => !d.suspended);

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <ShieldCheck size={13} className="text-amber-500" />
      <span className="font-medium">{admin.display_name ?? "Unnamed"}</span>
      {alreadyProposed && <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700">Org Admin Proposed</span>}
      {activeDepts.length > 0 && (
        <>
          <select value={assignDeptId} onChange={(e) => setAssignDeptId(e.target.value)} className="rounded-md border border-neutral-300 px-2 py-1 text-xs">
            <option value="">Assign to dept...</option>
            {activeDepts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <button disabled={pending || !assignDeptId} onClick={() => { const id = assignDeptId; setAssignDeptId(""); run(() => reassignDeptAdminDepartment(admin.id, id)); }} className="rounded-md bg-neutral-900 px-3 py-1 text-xs text-white disabled:opacity-40">Assign</button>
        </>
      )}
      <button disabled={pending} onClick={() => { if (confirm(`Demote "${admin.display_name ?? "this user"}" to regular User?`)) run(() => demoteDeptAdminToUser(admin.id)); }} className="flex items-center gap-1 rounded-md border border-red-300 px-2.5 py-1 text-xs text-red-700 hover:bg-red-50 disabled:opacity-40">
        <ShieldOff size={12} /> Remove Role
      </button>
      {!alreadyProposed && (
        <button disabled={pending} onClick={() => { if (confirm(`Propose "${admin.display_name ?? "this user"}" for Organisation Admin?`)) run(() => proposeForOrgAdmin(admin.id)); }} className="flex items-center gap-1 rounded-md border border-blue-300 bg-blue-50 px-2.5 py-1 text-xs text-blue-700 hover:bg-blue-100 disabled:opacity-40">
          <ArrowUpCircle size={12} /> Propose for Org Admin
        </button>
      )}
    </div>
  );
}

/* ─── Unassigned Worker Row ─── */
function UnassignedWorkerRow({ worker, departments, pendingAdminUserIds, totalOrgAdmins, pending, run }: {
  worker: Worker; departments: Department[];
  pendingAdminUserIds: string[]; totalOrgAdmins: number;
  pending: boolean; run: (fn: () => Promise<{ error?: string }>) => void;
}) {
  const [deptId, setDeptId] = useState("");
  const [promoteDeptId, setPromoteDeptId] = useState("");
  const [showPromote, setShowPromote] = useState(false);
  const active = departments.filter((d) => !d.suspended);

  return (
    <div className={`flex flex-wrap items-center gap-2 text-sm ${worker.suspended ? "opacity-60" : ""}`}>
      <span className="min-w-[120px] font-medium">{worker.display_name ?? "Unnamed"}</span>
      {worker.suspended && (
        <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
          Suspended
        </span>
      )}
      <select value={deptId} onChange={(e) => setDeptId(e.target.value)} className="rounded-md border border-neutral-300 px-2 py-1 text-xs">
        <option value="">Assign to dept...</option>
        {active.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
      </select>
      <button disabled={pending || !deptId} onClick={() => { const id = deptId; setDeptId(""); run(() => setWorkerDepartment(worker.id, id)); }} className="rounded-md bg-neutral-900 px-3 py-1 text-xs text-white disabled:opacity-40">Assign</button>
      {/* Suspend / Unsuspend */}
      {worker.suspended ? (
        <button disabled={pending} onClick={() => run(() => unsuspendWorker(worker.id))} className="flex items-center gap-1 rounded-md border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-xs text-emerald-700 hover:bg-emerald-100 disabled:opacity-40">
          <UserCheck size={12} /> Unsuspend
        </button>
      ) : (
        <button disabled={pending} onClick={() => run(() => suspendWorker(worker.id))} className="flex items-center gap-1 rounded-md border border-orange-300 bg-orange-50 px-2.5 py-1 text-xs text-orange-700 hover:bg-orange-100 disabled:opacity-40">
          <Ban size={12} /> Suspend
        </button>
      )}
      <button disabled={pending} onClick={() => { if (confirm(`Remove worker role from "${worker.display_name ?? "this user"}"?`)) run(() => demoteWorkerToUser(worker.id)); }} className="flex items-center gap-1 rounded-md border border-red-300 px-2.5 py-1 text-xs text-red-700 hover:bg-red-50 disabled:opacity-40">
        <UserX size={12} /> Remove Role
      </button>
      <button onClick={() => setShowPromote((v) => !v)} className="flex items-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs text-amber-800 hover:bg-amber-100">
        <ArrowUpCircle size={12} /> Promote
      </button>
      {showPromote && (
        <>
          <select value={promoteDeptId} onChange={(e) => setPromoteDeptId(e.target.value)} className="rounded-md border border-amber-300 px-2 py-1 text-xs">
            <option value="">Select dept for admin...</option>
            {active.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <button disabled={pending || !promoteDeptId} onClick={() => { if (confirm(`Promote "${worker.display_name ?? "this worker"}" to Departmental Admin?`)) run(() => promoteWorkerToDeptAdmin(worker.id, promoteDeptId)); }} className="rounded-md bg-amber-600 px-3 py-1 text-xs text-white disabled:opacity-40">Confirm</button>
        </>
      )}
    </div>
  );
}

/* ─── Former Worker Row ─── */
function FormerWorkerRow({ former, departments, pending, run }: {
  former: FormerWorker; departments: Department[];
  pending: boolean; run: (fn: () => Promise<{ error?: string }>) => void;
}) {
  const [reinstDeptId, setReinstDeptId] = useState("");
  const active = departments.filter((d) => !d.suspended);

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm text-neutral-600">
      <span className="italic">{former.display_name ?? "Anonymous User"}</span>
      <span className="rounded-full bg-neutral-200 px-2 py-0.5 text-xs text-neutral-500">Former Worker</span>
      <select value={reinstDeptId} onChange={(e) => setReinstDeptId(e.target.value)} className="rounded-md border border-neutral-300 px-2 py-1 text-xs">
        <option value="">Reinstate to dept (optional)...</option>
        {active.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
      </select>
      <button disabled={pending} onClick={() => { if (confirm(`Reinstate "${former.display_name ?? "this user"}" as a worker?`)) run(() => reinstateAsWorker(former.id, reinstDeptId || null)); }} className="flex items-center gap-1 rounded-md border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-xs text-emerald-700 hover:bg-emerald-100 disabled:opacity-40">
        <RefreshCw size={12} /> Reinstate as Worker
      </button>
    </div>
  );
}
