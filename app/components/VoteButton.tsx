"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { joinComplaint, leaveComplaint } from "@/app/report/[token]/actions";

export default function VoteButton({
  complaintId,
  initialVoteCount,
  initialHasVoted,
  isLoggedIn,
  loginNext,
}: {
  complaintId: string;
  initialVoteCount: number;
  initialHasVoted: boolean;
  isLoggedIn: boolean;
  loginNext: string;
}) {
  const [voteCount, setVoteCount] = useState(initialVoteCount);
  const [hasVoted, setHasVoted] = useState(initialHasVoted);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!isLoggedIn) {
    return (
      <Link
        href={`/login?next=${encodeURIComponent(loginNext)}`}
        className="rounded-md border border-neutral-300 px-3 py-1 text-xs"
      >
        Log in to vote
      </Link>
    );
  }

  function toggle() {
    startTransition(async () => {
      setError(null);
      const result = hasVoted
        ? await leaveComplaint(complaintId)
        : await joinComplaint(complaintId);

      if (result.error) {
        setError(result.error);
        return;
      }
      if (result.voteCount !== null && result.voteCount !== undefined) {
        setVoteCount(result.voteCount);
      }
      setHasVoted(!hasVoted);
    });
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={toggle}
        disabled={pending}
        className={
          hasVoted
            ? "rounded-md bg-neutral-900 px-3 py-1 text-xs text-white disabled:opacity-40"
            : "rounded-md border border-neutral-300 px-3 py-1 text-xs disabled:opacity-40"
        }
      >
        {hasVoted ? `✓ Joined (${voteCount})` : `Join (${voteCount})`}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
