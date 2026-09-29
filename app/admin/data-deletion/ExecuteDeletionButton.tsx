"use client";

import { useState } from "react";
import { Trash2, AlertTriangle } from "lucide-react";
import { ButtonSpinner } from "@/app/components/Spinner";
import { executePermanentDeletion } from "./actions";

export default function ExecuteDeletionButton({
  requestId,
  complaintCount,
}: {
  requestId: string;
  complaintCount: number;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  async function handleExecute() {
    if (!confirmed) {
      setError("You must confirm that you understand this action is permanent and irreversible.");
      return;
    }
    setLoading(true);
    setError(null);
    const res = await executePermanentDeletion(requestId);
    setLoading(false);
    if (res.error) {
      setError(res.error);
    } else {
      window.location.reload();
    }
  }

  return (
    <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />
        <div className="flex-1">
          <p className="font-semibold text-sm text-red-900">Final Step: Permanent Deletion</p>
          <p className="text-xs text-red-700 mt-1">
            Data archive has been generated and ready for backup. Once you execute permanent deletion,
            all {complaintCount} complaint attachments will be permanently purged from Backblaze B2,
            and database records will be soft-deleted.
          </p>

          <label className="mt-3 flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-red-300 text-red-600"
            />
            <span className="text-xs font-medium text-red-800">
              I have downloaded the backup archive and confirm permanent deletion.
            </span>
          </label>

          {error && <p className="mt-2 text-xs font-medium text-red-600">{error}</p>}

          <button
            type="button"
            disabled={loading || !confirmed}
            onClick={handleExecute}
            className="mt-3 inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50 transition"
          >
            {loading ? <ButtonSpinner /> : <Trash2 className="h-4 w-4" />}
            Execute Permanent Deletion
          </button>
        </div>
      </div>
    </div>
  );
}
