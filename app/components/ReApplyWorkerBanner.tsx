"use client";

import { useState } from "react";
import { reApplyForWorker } from "@/app/auth/actions";
import { Briefcase, RefreshCcw, CheckCircle2, AlertCircle } from "lucide-react";

export default function ReApplyWorkerBanner() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ ok?: boolean; error?: string } | null>(null);

  async function handleReApply() {
    setLoading(true);
    setResult(null);
    const res = await reApplyForWorker();
    setResult(res);
    setLoading(false);
  }

  if (result?.ok) {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3.5">
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
        <div>
          <p className="text-sm font-semibold text-green-800">Re-application submitted!</p>
          <p className="text-xs text-green-600 mt-0.5">
            Your worker role request is now pending. You will be notified once reviewed by the organisation admin.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3.5">
      <Briefcase className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
      <div className="flex-1">
        <p className="text-sm font-semibold text-amber-800">Worker role request was rejected</p>
        <p className="text-xs text-amber-600 mt-0.5">
          Your previous worker application was not approved. You can re-apply and the organisation admin will review it.
        </p>
        {result?.error && (
          <div className="mt-2 flex items-center gap-1.5 text-xs text-red-600">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            {result.error}
          </div>
        )}
        <button
          onClick={handleReApply}
          disabled={loading}
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs transition hover:bg-amber-700 disabled:opacity-60"
        >
          <RefreshCcw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          {loading ? "Submitting..." : "Re-apply for Worker Role"}
        </button>
      </div>
    </div>
  );
}
