"use client";

import { useState, useTransition } from "react";
import Toggle from "@/app/components/Toggle";
import { ButtonSpinner } from "@/app/components/Spinner";
import { approveAdmin, rejectAdminRequest, toggleAdminSignup } from "./actions";

type Req = {
  id: string;
  created_at: string;
  college_id: string;
  colleges: { name: string } | null;
  profiles: { display_name: string | null } | null;
};

type College = { id: string; name: string; allow_admin_signup: boolean };

export default function AdminRequestsClient({
  requests,
  approvalCounts,
  adminCounts,
  colleges,
}: {
  requests: Req[];
  approvalCounts: Record<string, number>;
  adminCounts: Record<string, number>;
  colleges: College[];
}) {
  const [pending, startTransition] = useTransition();
  const [allowAdmin, setAllowAdmin] = useState<Record<string, boolean>>(
    () => Object.fromEntries(colleges.map((c) => [c.id, c.allow_admin_signup]))
  );

  function handle(fn: () => Promise<{ error?: string; ok?: boolean }>) {
    startTransition(async () => {
      const result = await fn();
      if (result.error) alert(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-8">
      <section>
        <h2 className="mb-3 text-lg font-semibold">Pending Admin requests</h2>
        {requests.length === 0 && (
          <p className="text-sm text-neutral-500">Nothing pending.</p>
        )}
        <div className="flex flex-col gap-2">
          {requests.map((r) => {
            const need = adminCounts[r.college_id] ?? 0;
            const have = approvalCounts[r.id] ?? 0;
            const fullyEndorsed = have >= need;
            return (
              <div
                key={r.id}
                className="flex items-center justify-between rounded-md border border-neutral-200 p-3 text-sm"
              >
                <div>
                  <div>
                    {r.profiles?.display_name ?? "Unnamed"} · {r.colleges?.name}
                  </div>
                  <div className="text-xs text-neutral-500">
                    {have} / {need} admin endorsements
                    {fullyEndorsed ? " · ready" : ""}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    disabled={pending || !fullyEndorsed}
                    onClick={() => handle(() => approveAdmin(r.id))}
                    className="flex items-center gap-1.5 rounded-md bg-green-600 px-3 py-1 text-xs font-medium text-white shadow-sm hover:bg-green-700 disabled:opacity-40"
                  >
                    {pending && <ButtonSpinner />}
                    Approve
                  </button>
                  <button
                    disabled={pending}
                    onClick={() => handle(() => rejectAdminRequest(r.id, "Rejected by super admin"))}
                    className="rounded-md border border-red-200 px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-40"
                  >
                    Reject
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Admin signup availability</h2>
        <div className="flex flex-col gap-2">
          {colleges.map((c) => (
            <label
              key={c.id}
              className="flex items-center justify-between rounded-md border border-neutral-200 p-3 text-sm"
            >
              {c.name}
              <Toggle
                checked={allowAdmin[c.id] ?? c.allow_admin_signup}
                onChange={(next) => {
                  setAllowAdmin((prev) => ({ ...prev, [c.id]: next }));
                  handle(() => toggleAdminSignup(c.id, next));
                }}
              />
            </label>
          ))}
        </div>
      </section>
    </div>
  );
}
