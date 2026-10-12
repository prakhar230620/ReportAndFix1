"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ButtonSpinner } from "@/app/components/Spinner";
import { approveComplaint, reopenComplaint } from "./actions";
import { CheckCircle2, AlertTriangle, ShieldCheck, Clock } from "lucide-react";

export default function VerifyActions({
  complaintId,
  isDeptVerified = false,
  hasDepartment = false,
  departmentName,
}: {
  complaintId: string;
  isDeptVerified?: boolean;
  hasDepartment?: boolean;
  departmentName?: string | null;
}) {
  const router = useRouter();
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleApprove() {
    startTransition(async () => {
      setError(null);
      const result = await approveComplaint(complaintId);
      if (result.error) {
        setError(result.error);
      } else {
        router.refresh();
      }
    });
  }

  function handleReopen() {
    startTransition(async () => {
      setError(null);
      const result = await reopenComplaint(complaintId, comment);
      if (result.error) {
        setError(result.error);
      } else {
        setComment("");
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-indigo-200 bg-white p-5 shadow-sm">
      <div className="border-b border-neutral-100 pb-3">
        {hasDepartment && !isDeptVerified ? (
          <div className="flex items-start gap-2.5">
            <Clock className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                  Stage 1 of 2 Pending
                </span>
                <span className="text-xs text-neutral-500">Awaiting Dept Admin</span>
              </div>
              <h3 className="mt-1 text-sm font-semibold text-neutral-900">
                Departmental Admin verification is currently pending
              </h3>
              <p className="text-xs text-neutral-500">
                The {departmentName ? `"${departmentName}"` : "assigned"} department admin should inspect the work first. You may wait for them or use the Org Admin override below.
              </p>
            </div>
          </div>
        ) : isDeptVerified ? (
          <div className="flex items-start gap-2.5">
            <ShieldCheck className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">
                  Stage 2 of 2 · Ready
                </span>
                <span className="text-xs text-emerald-700 font-medium">Department Admin Verified ✓</span>
              </div>
              <h3 className="mt-1 text-sm font-semibold text-neutral-900">
                Final Sign-off Verification
              </h3>
              <p className="text-xs text-neutral-500">
                The departmental admin has verified the work. Review before giving final sign-off to officially close this issue.
              </p>
            </div>
          </div>
        ) : (
          <div>
            <h3 className="text-sm font-semibold text-neutral-900">Verify Resolution</h3>
            <p className="text-xs text-neutral-500">
              Review photos and proof before officially marking this issue as completed.
            </p>
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-1.5 rounded-md bg-red-50 p-2 text-xs text-red-700">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          {error}
        </div>
      )}

      <div>
        <button
          onClick={handleApprove}
          disabled={pending}
          className={`flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors disabled:opacity-50 ${
            hasDepartment && !isDeptVerified
              ? "bg-amber-600 hover:bg-amber-700"
              : "bg-emerald-600 hover:bg-emerald-700"
          }`}
        >
          {pending && <ButtonSpinner />}
          <CheckCircle2 className="h-4 w-4" />
          {hasDepartment && !isDeptVerified
            ? "Org Admin Override — Mark Completed"
            : "Final Sign-off — Mark Completed"}
        </button>
      </div>

      <div className="mt-1 flex flex-col gap-2 border-t border-neutral-100 pt-3">
        <label className="text-xs font-medium text-neutral-700">
          Or reject resolution and reopen (requires reason):
        </label>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Specify reason for reopening..."
          rows={2}
          className="rounded-lg border border-neutral-300 p-2 text-xs focus:border-red-400 focus:outline-none focus:ring-1 focus:ring-red-400"
        />
        <div>
          <button
            onClick={handleReopen}
            disabled={pending || !comment.trim()}
            className="flex items-center justify-center gap-2 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-rose-700 disabled:opacity-50 transition-colors"
          >
            {pending && <ButtonSpinner />}
            Reject — Reopen Issue
          </button>
        </div>
      </div>
    </div>
  );
}
