"use client";

import { useState } from "react";

type ExportType = "analytics" | "storage" | "overview";

const EXPORT_OPTIONS: {
  type: ExportType;
  label: string;
  icon: string;
  description: string;
  includes: string[];
  excludes: string[];
  color: string;
  badgeColor: string;
}[] = [
  {
    type: "analytics",
    label: "Full Analytics Report",
    icon: "📊",
    description:
      "Complete per-organisation analytics summary — complaints, resolution rates, members, structure, and storage.",
    includes: [
      "Organisation name, category, status, join date",
      "Total & completed complaint counts",
      "Completion rate (%)",
      "Member & worker counts",
      "Location & category counts",
      "File storage size & count",
      "Estimated database storage",
    ],
    excludes: [
      "Complaint titles or descriptions",
      "User names or emails",
      "Anonymous submission details",
      "Internal IDs or private metadata",
    ],
    color: "border-indigo-200 bg-indigo-50/60",
    badgeColor: "bg-indigo-100 text-indigo-700",
  },
  {
    type: "storage",
    label: "Storage Report",
    icon: "🗄️",
    description:
      "Detailed file and database storage usage per organisation with platform totals.",
    includes: [
      "Organisation name & category",
      "File storage (bytes + formatted)",
      "Uploaded file count",
      "Estimated DB storage (bytes + formatted)",
      "Combined total storage",
      "Platform-wide totals footer row",
    ],
    excludes: [
      "Any complaint or issue data",
      "User or member information",
      "Internal content of any kind",
    ],
    color: "border-blue-200 bg-blue-50/60",
    badgeColor: "bg-blue-100 text-blue-700",
  },
  {
    type: "overview",
    label: "Organisation Overview",
    icon: "🏢",
    description:
      "Lightweight roster of all active organisations with headcount and structure summary.",
    includes: [
      "Organisation name, category, status",
      "Registration date",
      "Member & worker counts",
      "Location & category counts",
      "Total storage (formatted)",
    ],
    excludes: [
      "Complaint data of any kind",
      "User names or personal info",
      "Internal IDs or content",
    ],
    color: "border-emerald-200 bg-emerald-50/60",
    badgeColor: "bg-emerald-100 text-emerald-700",
  },
];

export default function ExportPageClient({
  colleges,
}: {
  colleges: { id: string; name: string }[];
}) {
  const [selected, setSelected] = useState<ExportType>("analytics");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{
    url: string;
    filename: string;
    row_count: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedOption = EXPORT_OPTIONS.find((o) => o.type === selected)!;

  async function handleExport() {
    setBusy(true);
    setError(null);
    setResult(null);

    const res = await fetch("/api/exports/analytics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: selected }),
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
    <div className="flex flex-col gap-6">
      {/* Page Header */}
      <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
          Analytics Export
        </h1>
        <p className="mt-1.5 max-w-2xl text-sm text-neutral-500">
          Export aggregated, anonymised platform analytics as CSV. These reports
          contain only statistical summaries — no complaint content, user names,
          or private data is ever included.
        </p>

        {/* Privacy badge */}
        <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
          <span className="text-lg leading-none">🔒</span>
          <div>
            <p className="text-xs font-semibold text-emerald-800">
              Privacy Protected Export
            </p>
            <p className="text-xs text-emerald-700">
              All exports are aggregate summaries only. Complaint details, user
              identities, and internal content are never exported to the super
              admin view.
            </p>
          </div>
        </div>
      </div>

      {/* Export Type Selector */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-neutral-700">
          Select Export Type
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {EXPORT_OPTIONS.map((opt) => (
            <button
              key={opt.type}
              onClick={() => {
                setSelected(opt.type);
                setResult(null);
                setError(null);
              }}
              className={`flex flex-col gap-2 rounded-xl border-2 p-4 text-left transition-all ${
                selected === opt.type
                  ? "border-neutral-800 bg-neutral-900 shadow-md"
                  : "border-neutral-200 bg-white hover:border-neutral-400"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-xl">{opt.icon}</span>
                <span
                  className={`text-sm font-semibold ${
                    selected === opt.type ? "text-white" : "text-neutral-900"
                  }`}
                >
                  {opt.label}
                </span>
              </div>
              <p
                className={`text-[11px] leading-relaxed ${
                  selected === opt.type ? "text-neutral-300" : "text-neutral-500"
                }`}
              >
                {opt.description}
              </p>
              {selected === opt.type && (
                <span className="mt-1 self-start rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-semibold text-white">
                  ✓ Selected
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Selected Export Details */}
      <div className={`rounded-xl border-2 p-5 ${selectedOption.color}`}>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xl">{selectedOption.icon}</span>
          <h3 className="font-semibold text-neutral-900">{selectedOption.label}</h3>
          <span className={`ml-auto rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${selectedOption.badgeColor}`}>
            CSV Export
          </span>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* What's included */}
          <div>
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
              ✅ What&apos;s Included
            </div>
            <ul className="flex flex-col gap-1">
              {selectedOption.includes.map((item) => (
                <li key={item} className="flex items-start gap-1.5 text-xs text-neutral-700">
                  <span className="mt-0.5 text-emerald-500">•</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* What's excluded */}
          <div>
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
              🚫 What&apos;s NOT Included
            </div>
            <ul className="flex flex-col gap-1">
              {selectedOption.excludes.map((item) => (
                <li key={item} className="flex items-start gap-1.5 text-xs text-neutral-500">
                  <span className="mt-0.5 text-red-400">✕</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Org count info */}
        <div className="mt-4 flex items-center gap-2 rounded-lg border border-neutral-200 bg-white/70 px-3 py-2 text-xs text-neutral-600">
          <span>🏢</span>
          <span>
            This export will cover <strong>{colleges.length}</strong> active organisation
            {colleges.length !== 1 ? "s" : ""} on the platform.
          </span>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <span>⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {/* Success */}
      {result && (
        <div className="flex flex-col gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <div className="flex items-center gap-2">
            <span className="text-xl">✅</span>
            <div>
              <p className="text-sm font-semibold text-emerald-800">Export Ready</p>
              <p className="text-xs text-emerald-600">
                {result.row_count} organisations exported · File: <code className="font-mono">{result.filename}</code>
              </p>
            </div>
          </div>
          <a
            href={result.url}
            target="_blank"
            rel="noreferrer"
            className="flex w-fit items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-800"
          >
            ⬇️ Download CSV
            <span className="text-[11px] opacity-75">(link valid for 1 hour)</span>
          </a>
        </div>
      )}

      {/* Generate Button */}
      <div className="flex items-center gap-4">
        <button
          onClick={handleExport}
          disabled={busy}
          className="flex items-center gap-2.5 rounded-xl bg-neutral-900 px-6 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-neutral-700 disabled:opacity-50"
        >
          {busy ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Generating Export…
            </>
          ) : (
            <>
              {selectedOption.icon} Generate {selectedOption.label}
            </>
          )}
        </button>
        <p className="text-xs text-neutral-400">
          Securely stored · Download link expires in 1 hour
        </p>
      </div>
    </div>
  );
}
