"use client";

import { useState } from "react";

export default function ExportPage() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ url: string; row_count: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleExport() {
    setBusy(true);
    setError(null);
    setResult(null);
    const res = await fetch("/api/exports/csv", { method: "POST" });
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
        Generates a real CSV of your organisation&apos;s complaints, stored privately with a
        1-hour signed download link.
      </p>
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
