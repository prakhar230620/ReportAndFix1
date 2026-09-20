"use client";

import { useTransition } from "react";
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
                    className="rounded-md bg-neutral-900 px-3 py-1 text-xs text-white disabled:opacity-40"
                  >
                    Approve
                  </button>
                  <button
                    disabled={pending}
                    onClick={() => handle(() => rejectAdminRequest(r.id, "Rejected by super admin"))}
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

      <section>
        <h2 className="mb-3 text-lg font-semibold">Admin signup availability</h2>
        <div className="flex flex-col gap-2">
          {colleges.map((c) => (
            <label
              key={c.id}
              className="flex items-center justify-between rounded-md border border-neutral-200 p-3 text-sm"
            >
              {c.name}
              <input
                type="checkbox"
                defaultChecked={c.allow_admin_signup}
                disabled={pending}
                onChange={(e) => handle(() => toggleAdminSignup(c.id, e.target.checked))}
              />
            </label>
          ))}
        </div>
      </section>
    </div>
  );
}
