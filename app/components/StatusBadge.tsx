"use client";

import { useEffect, useState } from "react";
import { Clock, CheckCircle2, AlertTriangle, Flame, ArrowUpCircle } from "lucide-react";

export function StatusBadge({
  status,
  assignedWorkerId,
  assignedDepartmentId,
}: {
  status: string;
  assignedWorkerId?: string | null;
  assignedDepartmentId?: string | null;
}) {
  let normalized = (status || "").toLowerCase();

  // If a complaint has status "assigned" but neither worker nor department is assigned,
  // it is in an unassigned state.
  if (
    normalized === "assigned" &&
    assignedWorkerId === null &&
    assignedDepartmentId === null
  ) {
    normalized = "unassigned";
  }

  switch (normalized) {
    case "submitted":
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
          Submitted
        </span>
      );
    case "unassigned":
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
          Unassigned
        </span>
      );
    case "assigned":
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
          <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
          Assigned
        </span>
      );
    case "processing":
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700">
          <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 animate-ping" />
          In Progress
        </span>
      );
    case "waiting_for_verification":
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-orange-200 bg-orange-50 px-2.5 py-0.5 text-xs font-semibold text-orange-700">
          <Clock className="h-3 w-3 text-orange-600" />
          Awaiting Verification
        </span>
      );
    case "completed":
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
          <CheckCircle2 className="h-3 w-3 text-emerald-600" />
          Resolved
        </span>
      );
    case "reopened":
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-0.5 text-xs font-semibold text-rose-700">
          <AlertTriangle className="h-3 w-3 text-rose-600" />
          Reopened
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center rounded-full border border-neutral-200 bg-neutral-100 px-2.5 py-0.5 text-xs font-medium capitalize text-neutral-700">
          {status}
        </span>
      );
  }
}

export function PriorityBadge({ priority }: { priority: string }) {
  const normalized = (priority || "").toLowerCase();

  switch (normalized) {
    case "urgent":
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-red-300 bg-red-100 px-2 py-0.5 text-[11px] font-bold text-red-800">
          <Flame className="h-3 w-3 text-red-600 fill-red-500" />
          Urgent
        </span>
      );
    case "high":
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-900">
          <ArrowUpCircle className="h-3 w-3 text-amber-700" />
          High
        </span>
      );
    case "medium":
      return (
        <span className="inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-800">
          Medium
        </span>
      );
    case "low":
    default:
      return (
        <span className="inline-flex items-center rounded-full border border-neutral-200 bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-600">
          Low
        </span>
      );
  }
}

const STORAGE_KEY = "rf_read_complaints_v1";

export function UnreadDot({ complaintId, createdAt }: { complaintId: string; createdAt?: string }) {
  const [isUnread, setIsUnread] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const readSet = new Set(raw ? JSON.parse(raw) : []);
      if (!readSet.has(complaintId)) {
        // If created in the last 14 days and not in read set, mark as unread dot
        const createdMs = createdAt ? new Date(createdAt).getTime() : Date.now();
        const fourteenDaysAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
        if (createdMs > fourteenDaysAgo) {
          setIsUnread(true);
        }
      }
    } catch {
      // ignore
    }
  }, [complaintId, createdAt]);

  if (!isUnread) return null;

  return (
    <span
      className="inline-block h-2 w-2 rounded-full bg-red-500 ring-2 ring-white animate-pulse shrink-0"
      title="New complaint"
    />
  );
}

export function MarkAsRead({ complaintId }: { complaintId: string }) {
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const readSet = new Set(raw ? JSON.parse(raw) : []);
      if (!readSet.has(complaintId)) {
        readSet.add(complaintId);
        // keep at most last 500 items
        const arr = Array.from(readSet).slice(-500);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
      }
    } catch {
      // ignore
    }
  }, [complaintId]);

  return null;
}
