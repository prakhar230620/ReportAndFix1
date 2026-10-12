"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ButtonSpinner } from "@/app/components/Spinner";
import { deptAdminVerifyComplaint, deptAdminReopenComplaint } from "@/app/admin/queue/actions";
import { CheckCircle2, RotateCcw, AlertTriangle } from "lucide-react";

export default function DeptVerifyActions({
  complaintId,
  isAlreadyDeptVerified,
}: {
  complaintId: string;
  isAlreadyDeptVerified: boolean;
}) {
  const router = useRouter();
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleVerify() {
    startTransition(async () => {
      setError(null);
      setSuccess(null);
      const res = await deptAdminVerifyComplaint(complaintId);
      if (res.error) {
        setError(res.error);
      } else {
        setSuccess("Work verified successfully! Forwarded to Organisation Admin for final double-check sign-off.");
        router.refresh();
      }
    });
  }

  function handleReopen() {
    if (!comment.trim()) {
      setError("Please write a reason so the worker knows what needs rework.");
      return;
    }
    startTransition(async () => {
      setError(null);
      setSuccess(null);
      const res = await deptAdminReopenComplaint(complaintId, comment);
      if (res.error) {
        setError(res.error);
      } else {
        setSuccess("Complaint reopened and sent back to worker with feedback.");
        setComment("");
        router.refresh();
      }
    });
  }

  if (isAlreadyDeptVerified) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
          <div>
            <h4 className="font-semibold text-sm">Department Verification Completed (Stage 1 of 2)</h4>
            <p className="text-xs text-emerald-700 mt-0.5">
              You verified this resolution. It is now awaiting final sign-off from the Organisation Admin.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-indigo-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2 border-b border-neutral-100 pb-2">
        <CheckCircle2 className="h-5 w-5 text-indigo-600 shrink-0" />
        <div>
          <h3 className="text-sm font-bold text-neutral-900">
            Tier-1 Verification · Departmental Inspection
          </h3>
          <p className="text-xs text-neutral-500">
            Worker has submitted completion proof. Inspect the work before forwarding to Organisation Admin.
          </p>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-1.5 rounded-md bg-red-50 p-2 text-xs font-medium text-red-700">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          {error}
        </div>
      )}
      {success && (
        <div className="flex items-center gap-1.5 rounded-md bg-emerald-50 p-2 text-xs font-medium text-emerald-800">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
          {success}
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <button
          onClick={handleVerify}
          disabled={pending}
          className="flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50 transition-colors"
        >
          {pending && <ButtonSpinner />}
          Approve (Verify & Forward to Org Admin)
        </button>
      </div>

      <div className="mt-2 flex flex-col gap-2 border-t border-neutral-100 pt-3">
        <label className="text-xs font-semibold text-neutral-700">
          Reject Work & Send Back to Worker (with required feedback):
        </label>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Specify what was incomplete or unsatisfactory..."
          rows={2}
          className="w-full rounded-lg border border-neutral-300 p-2.5 text-xs text-neutral-800 focus:border-red-400 focus:outline-none focus:ring-1 focus:ring-red-400"
        />
        <div>
          <button
            onClick={handleReopen}
            disabled={pending || !comment.trim()}
            className="flex items-center justify-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-rose-700 disabled:opacity-50 transition-colors"
          >
            {pending && <ButtonSpinner />}
            <RotateCcw className="h-3.5 w-3.5" />
            Reject & Reopen to Worker
          </button>
        </div>
      </div>
    </div>
  );
}
