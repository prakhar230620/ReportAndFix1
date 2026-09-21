"use client";

import { useState, useTransition } from "react";
import Toggle from "@/app/components/Toggle";
import {
  approveWorker,
  rejectRequest,
  endorseAdminRequest,
  toggleWorkerSignup,
} from "./actions";

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
  approvalCounts,
  adminCountNeeded,
  myApprovedIds,
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
  const approved = new Set(myApprovedIds);

  function handle(fn: () => Promise<{ error?: string; ok?: boolean }>) {
    startTransition(async () => {
      const result = await fn();
      if (result.error) alert(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-8">
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Worker requests</h2>
          <label className="flex items-center gap-2 text-xs text-neutral-500">
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
          <p className="text-sm text-neutral-500">No pending worker requests.</p>
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

      <section>
        <h2 className="mb-3 text-lg font-semibold">Admin requests</h2>
        <p className="mb-3 text-xs text-neutral-500">
          Every current admin ({adminCountNeeded}) must endorse before Super
          Admin can grant the role.
        </p>
        {adminRequests.length === 0 && (
          <p className="text-sm text-neutral-500">No pending admin requests.</p>
        )}
        <div className="flex flex-col gap-2">
          {adminRequests.map((r) => {
            const count = approvalCounts[r.id] ?? 0;
            const iEndorsed = approved.has(r.id);
            return (
              <div
                key={r.id}
                className="flex items-center justify-between rounded-md border border-neutral-200 p-3 text-sm"
              >
                <div>
                  <div>{r.profiles?.display_name ?? "Unnamed"}</div>
                  <div className="text-xs text-neutral-500">
                    {count} / {adminCountNeeded} admin endorsements
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    disabled={pending || iEndorsed}
                    onClick={() => handle(() => endorseAdminRequest(r.id))}
                    className="rounded-md bg-neutral-900 px-3 py-1 text-xs text-white disabled:opacity-40"
                  >
                    {iEndorsed ? "Endorsed" : "Endorse"}
                  </button>
                  <button
                    disabled={pending}
                    onClick={() => handle(() => rejectRequest(r.id, "Rejected by admin"))}
                    className="rounded-md border border-neutral-300 px-3 py-1 text-xs disabled:opacity-40"
                  >
                    Reject
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>
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
  const [deptId, setDeptId] = useState("");
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-neutral-200 p-3 text-sm">
      <span>{req.profiles?.display_name ?? "Unnamed"}</span>
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={deptId}
          onChange={(e) => setDeptId(e.target.value)}
          className="rounded-md border border-neutral-300 px-2 py-1 text-xs"
        >
          <option value="">No department</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
        <button
          disabled={pending}
          onClick={() => handle(() => approveWorker(req.id, deptId || null))}
          className="rounded-md bg-neutral-900 px-3 py-1 text-xs text-white disabled:opacity-40"
        >
          Approve
        </button>
        <button
          disabled={pending}
          onClick={() => handle(() => rejectRequest(req.id, "Rejected by admin"))}
          className="rounded-md border border-neutral-300 px-3 py-1 text-xs disabled:opacity-40"
        >
          Reject
        </button>
      </div>
    </div>
  );
}
