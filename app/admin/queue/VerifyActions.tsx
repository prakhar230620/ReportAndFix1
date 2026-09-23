"use client";

import { useState, useTransition } from "react";
import { ButtonSpinner } from "@/app/components/Spinner";
import { approveComplaint, reopenComplaint } from "./actions";

export default function VerifyActions({ complaintId }: { complaintId: string }) {
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleApprove() {
    startTransition(async () => {
      setError(null);
      const result = await approveComplaint(complaintId);
      if (result.error) setError(result.error);
    });
  }

  function handleReopen() {
    startTransition(async () => {
      setError(null);
      const result = await reopenComplaint(complaintId, comment);
      if (result.error) setError(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-neutral-800">Verify work</h3>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <button
        onClick={handleApprove}
        disabled={pending}
        className="flex items-center justify-center gap-2 rounded-md bg-green-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-green-700 disabled:opacity-50"
      >
        {pending && <ButtonSpinner />}
        Approve — mark completed
      </button>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Required comment if rejecting/reopening…"
        rows={2}
        className="rounded-md border border-neutral-300 px-2 py-1.5 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
      />
      <button
        onClick={handleReopen}
        disabled={pending || !comment.trim()}
        className="flex items-center justify-center gap-2 rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-red-700 disabled:opacity-50"
      >
        {pending && <ButtonSpinner />}
        Reject — reopen
      </button>
    </div>
  );
}
