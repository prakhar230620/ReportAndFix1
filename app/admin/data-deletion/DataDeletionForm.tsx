"use client";

import { useState } from "react";
import { AlertTriangle, Trash2, CheckSquare, Square } from "lucide-react";
import { ButtonSpinner } from "@/app/components/Spinner";
import { createDeletionRequest } from "@/app/admin/data-deletion/actions";


type Complaint = {
  id: string;
  public_id: string;
  title: string;
  created_at: string;
  completed_at: string | null;
  categories: { name: string } | null;
};

export default function DataDeletionForm({
  complaints,
  collegeId,
  userId,
  orgAdminCount,
  downloadChargePaise,
  downloadFree,
}: {
  complaints: Complaint[];
  collegeId: string;
  userId: string;
  orgAdminCount: number;
  downloadChargePaise: number;
  downloadFree: boolean;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  function toggleAll() {
    if (selected.size === complaints.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(complaints.map((c) => c.id)));
    }
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (selected.size === 0) { setError("Please select at least one complaint."); return; }
    if (!confirmed) { setError("Please confirm you understand this is irreversible."); return; }
    setLoading(true); setError(null);
    const res = await createDeletionRequest({
      collegeId,
      userId,
      complaintIds: Array.from(selected),
    });
    setLoading(false);
    if (res.error) { setError(res.error); return; }
    window.location.reload();
  }

  if (complaints.length === 0) {
    return (
      <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-8 text-center">
        <p className="font-semibold text-neutral-700">No completed complaints</p>
        <p className="text-sm text-neutral-500 mt-1">
          Only completed complaints can be deleted. Nothing to delete at this time.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Selection header */}
      <div className="flex items-center justify-between rounded-xl border border-neutral-200 bg-white p-4">
        <div>
          <p className="font-semibold text-sm text-neutral-900">
            {selected.size === 0
              ? "Select complaints to delete"
              : `${selected.size} complaint${selected.size > 1 ? "s" : ""} selected`}
          </p>
          <p className="text-xs text-neutral-500">
            {complaints.length} completed complaint{complaints.length > 1 ? "s" : ""} available
          </p>
        </div>
        <button type="button" onClick={toggleAll}
          className="text-xs font-medium text-blue-600 hover:text-blue-700">
          {selected.size === complaints.length ? "Deselect All" : "Select All"}
        </button>
      </div>

      {/* Complaint list */}
      <div className="rounded-xl border border-neutral-200 bg-white divide-y divide-neutral-100 max-h-80 overflow-y-auto">
        {complaints.map((c) => {
          const isSelected = selected.has(c.id);
          return (
            <label key={c.id} className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition ${isSelected ? "bg-red-50" : "hover:bg-neutral-50"}`}>
              <input type="checkbox" checked={isSelected} onChange={() => toggle(c.id)} className="sr-only" />
              {isSelected
                ? <CheckSquare className="h-5 w-5 text-red-600 shrink-0" />
                : <Square className="h-5 w-5 text-neutral-400 shrink-0" />}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-neutral-900 truncate">{c.title}</p>
                <p className="text-xs text-neutral-500">
                  #{c.public_id} · {(c.categories as any)?.name ?? "General"} ·
                  Completed {c.completed_at ? new Date(c.completed_at).toLocaleDateString("en-IN") : "—"}
                </p>
              </div>
            </label>
          );
        })}
      </div>

      {/* Confirmation */}
      {selected.size > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-semibold text-red-900 mb-2">
            You are about to delete {selected.size} complaint{selected.size > 1 ? "s" : ""} permanently.
          </p>
          {orgAdminCount > 1 && (
            <p className="text-xs text-red-700 mb-3">
              This will require approval from all {orgAdminCount} organisation admins before proceeding.
            </p>
          )}
          {!downloadFree && downloadChargePaise > 0 && (
            <p className="text-xs text-red-700 mb-3">
              A download charge of <strong>₹{downloadChargePaise / 100}</strong> will apply before the data archive is generated.
            </p>
          )}
          <label className="flex items-start gap-2 cursor-pointer">
            <input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-red-400" />
            <span className="text-xs text-red-800">
              I understand this deletion is <strong>permanent and irreversible</strong>. I have read and agree to the deletion policy.
            </span>
          </label>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={loading || selected.size === 0 || !confirmed}
        className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? <ButtonSpinner /> : <Trash2 className="h-4 w-4" />}
        Initiate Deletion Request
      </button>
    </form>
  );
}
