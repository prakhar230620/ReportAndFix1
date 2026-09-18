"use client";

import { useState, useTransition } from "react";
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
    <div className="flex flex-col gap-2 rounded-md border border-neutral-300 p-3">
      <h3 className="text-sm font-semibold">Verify work</h3>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <button
        onClick={handleApprove}
        disabled={pending}
        className="rounded-md bg-green-700 px-3 py-1.5 text-sm text-white disabled:opacity-40"
      >
        Approve — mark completed
      </button>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Required comment if rejecting/reopening…"
        rows={2}
        className="rounded-md border border-neutral-300 px-2 py-1 text-sm"
      />
      <button
        onClick={handleReopen}
        disabled={pending || !comment.trim()}
        className="rounded-md bg-red-700 px-3 py-1.5 text-sm text-white disabled:opacity-40"
      >
        Reject — reopen
      </button>
    </div>
  );
}
