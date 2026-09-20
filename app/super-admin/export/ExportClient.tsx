"use client";

import { useState } from "react";

export default function ExportClient({ colleges }: { colleges: { id: string; name: string }[] }) {
  const [collegeId, setCollegeId] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ url: string; row_count: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleExport() {
    setBusy(true);
    setError(null);
    setResult(null);
    const res = await fetch("/api/exports/csv", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(collegeId ? { college_id: collegeId } : {}),
    });
    const body = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(body.error ?? "Export failed");
      return;
    }
    setResult(body);
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Export</h1>
      <p className="text-sm text-neutral-600">
        Generates a real CSV of complaints across the platform (or one organisation), stored
        privately with a 1-hour signed download link.
      </p>

      <label className="flex flex-col gap-1 text-sm">
        Organisation
        <select
          value={collegeId}
          onChange={(e) => setCollegeId(e.target.value)}
          className="w-64 rounded-md border border-neutral-300 px-2 py-1.5"
        >
          <option value="">All organisations</option>
          {colleges.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        onClick={handleExport}
        disabled={busy}
        className="self-start rounded-md bg-neutral-900 px-4 py-2 text-sm text-white disabled:opacity-40"
      >
        {busy ? "Generating…" : "Generate CSV export"}
      </button>
      {result && (
        <div className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">
          {result.row_count} rows.{" "}
          <a
            href={result.url}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700"
            target="_blank"
            rel="noreferrer"
          >
            Download (link expires in 1 hour)
          </a>
        </div>
      )}
    </div>
  );
}
