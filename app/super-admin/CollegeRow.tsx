"use client";

import { useTransition } from "react";
import { setCollegeStatus } from "./actions";

type College = {
  id: string;
  name: string;
  subscription_status: string;
  user_count: number;
  worker_count: number;
  issue_count: number;
};

export default function CollegeRow({ college }: { college: College }) {
  const [pending, startTransition] = useTransition();

  function toggle() {
    const next = college.subscription_status === "suspended" ? "active" : "suspended";
    startTransition(async () => {
      const result = await setCollegeStatus(college.id, next);
      if (result.error) alert(result.error);
    });
  }

  const suspended = college.subscription_status === "suspended";

  return (
    <div className="flex items-center justify-between rounded-md border border-neutral-200 p-3 text-sm">
      <div>
        <div className="font-medium">{college.name}</div>
        <div className="text-neutral-500">
          {college.user_count} users · {college.worker_count} workers · {college.issue_count} issues
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span
          className={
            suspended
              ? "rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700"
              : "rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700"
          }
        >
          {college.subscription_status}
        </span>
        <button
          onClick={toggle}
          disabled={pending}
          className="rounded-md border border-neutral-300 px-3 py-1 text-xs disabled:opacity-40"
        >
          {suspended ? "Activate" : "Suspend"}
        </button>
      </div>
    </div>
  );
}
