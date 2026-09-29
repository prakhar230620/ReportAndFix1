"use client";

import { useMemo, useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";

export type OrgTableBreakdown = {
  table: string;
  icon: string;
  records: number;
  isFile?: boolean;
};

export type OrgAnalytics = {
  id: string;
  name: string;
  category: string;
  status: string;
  logo_url: string | null;
  // Storage
  file_bytes: number;
  file_count: number;
  file_pct: number;
  db_records: number;
  db_bytes_estimated: number;
  db_pct: number;
  total_storage_bytes: number;
  // Itemized breakdown per table
  table_breakdown: OrgTableBreakdown[];
  // Issues
  total_issues: number;
  submitted_issues: number;
  assigned_issues: number;
  processing_issues: number;
  completed_issues: number;
  reopened_issues: number;
  completion_rate: number;
  avg_resolution_seconds: number | null;
  // People & structure
  users_count: number;
  workers_count: number;
  dept_admins_count: number;
  admins_count: number;
  locations_count: number;
  categories_count: number;
  // Deep dive
  by_category: { name: string; count: number }[];
  by_worker: { display_name: string; count: number; avg_resolution_seconds?: number }[];
  by_location: { name: string; count: number }[];
};

export type GlobalStorageStats = {
  db_size_bytes: number;
  storage_used_bytes: number;
  storage_object_count: number;
};

function formatBytes(bytes: number, decimals = 2) {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

function formatDuration(seconds: number | null) {
  if (!seconds || seconds <= 0) return "—";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} min`;
  const hrs = (seconds / 3600).toFixed(1);
  return `${hrs} hrs`;
}

export default function AnalyticsDashboardClient({
  organizations,
  storageStats,
}: {
  organizations: OrgAnalytics[];
  storageStats: GlobalStorageStats;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [lastUpdated, setLastUpdated] = useState<string>("");
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<
    "name" | "file_storage" | "db_storage" | "total_storage" | "issues" | "completion"
  >("total_storage");
  const [selectedOrg, setSelectedOrg] = useState<OrgAnalytics | null>(null);

  // Set initial last updated time
  useEffect(() => {
    setLastUpdated(new Date().toLocaleTimeString());
  }, [organizations]);

  // Optional auto-refresh every 20 seconds
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      startTransition(() => {
        router.refresh();
      });
    }, 20000);
    return () => clearInterval(interval);
  }, [autoRefresh, router]);

  function handleManualRefresh() {
    startTransition(() => {
      router.refresh();
    });
  }

  // Global calculations
  const totalComplaints = useMemo(
    () => organizations.reduce((acc, o) => acc + o.total_issues, 0),
    [organizations]
  );
  const totalCompleted = useMemo(
    () => organizations.reduce((acc, o) => acc + o.completed_issues, 0),
    [organizations]
  );
  const totalUsers = useMemo(
    () => organizations.reduce((acc, o) => acc + o.users_count + o.workers_count, 0),
    [organizations]
  );
  const platformCompletionRate = totalComplaints > 0 ? Math.round((totalCompleted / totalComplaints) * 100) : 0;

  // Filter & Sort
  const sortedAndFiltered = useMemo(() => {
    return [...organizations]
      .filter((o) => {
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        return o.name.toLowerCase().includes(q) || o.category.toLowerCase().includes(q);
      })
      .sort((a, b) => {
        switch (sortBy) {
          case "file_storage":
            return b.file_bytes - a.file_bytes;
          case "db_storage":
            return b.db_bytes_estimated - a.db_bytes_estimated;
          case "total_storage":
            return b.total_storage_bytes - a.total_storage_bytes;
          case "issues":
            return b.total_issues - a.total_issues;
          case "completion":
            return b.completion_rate - a.completion_rate;
          case "name":
          default:
            return a.name.localeCompare(b.name);
        }
      });
  }, [organizations, search, sortBy]);

  return (
    <div className="flex flex-col gap-6">
      {/* Top Header with Live Status & Controls */}
      <div className="flex flex-col justify-between gap-4 rounded-xl border border-neutral-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
              Live Platform Analytics
            </h1>
            <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              LIVE DATA
            </span>
          </div>
          <p className="mt-1 text-xs text-neutral-500">
            Real-time breakdown of storage usage (file & database), complaints, and performance per organisation.
          </p>
        </div>

        {/* Live Controls */}
        <div className="flex flex-wrap items-center gap-3 text-xs">
          {lastUpdated && (
            <span className="text-neutral-500">
              Updated: <strong className="text-neutral-700">{lastUpdated}</strong>
            </span>
          )}

          <label className="flex cursor-pointer items-center gap-1.5 rounded-md border border-neutral-200 bg-neutral-50 px-2.5 py-1.5 font-medium text-neutral-700 hover:bg-neutral-100">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded border-neutral-300"
            />
            Auto-refresh (20s)
          </label>

          <button
            onClick={handleManualRefresh}
            disabled={isPending}
            className="flex items-center gap-1.5 rounded-lg bg-neutral-900 px-3.5 py-1.5 font-medium text-white shadow-sm transition hover:bg-neutral-800 disabled:opacity-50"
          >
            <span className={isPending ? "animate-spin" : ""}>🔄</span>
            {isPending ? "Syncing..." : "Refresh Live"}
          </button>
        </div>
      </div>

      {/* Global Metric Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-medium text-neutral-500">Organisations</div>
          <div className="mt-1 text-2xl font-bold text-neutral-900">{organizations.length}</div>
          <div className="mt-1 text-[11px] text-neutral-400">Tenants active</div>
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-medium text-neutral-500">Total File Storage</div>
          <div className="mt-1 text-2xl font-bold text-blue-600">
            {formatBytes(storageStats.storage_used_bytes)}
          </div>
          <div className="mt-1 text-[11px] text-neutral-400">
            {storageStats.storage_object_count} uploaded files
          </div>
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-medium text-neutral-500">Database Size</div>
          <div className="mt-1 text-2xl font-bold text-indigo-600">
            {formatBytes(storageStats.db_size_bytes)}
          </div>
          <div className="mt-1 text-[11px] text-neutral-400">PostgreSQL data</div>
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-medium text-neutral-500">Total Combined Storage</div>
          <div className="mt-1 text-2xl font-bold text-neutral-900">
            {formatBytes(storageStats.storage_used_bytes + storageStats.db_size_bytes)}
          </div>
          <div className="mt-1 text-[11px] text-neutral-400">Files + DB combined</div>
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-medium text-neutral-500">Total Complaints</div>
          <div className="mt-1 text-2xl font-bold text-neutral-900">{totalComplaints}</div>
          <div className="mt-1 text-[11px] text-emerald-600 font-medium">
            {platformCompletionRate}% resolved ({totalCompleted})
          </div>
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-medium text-neutral-500">Platform Users</div>
          <div className="mt-1 text-2xl font-bold text-neutral-900">{totalUsers}</div>
          <div className="mt-1 text-[11px] text-neutral-400">Members & staff</div>
        </div>
      </div>

      {/* Global Storage Distribution Bar */}
      <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-base font-semibold text-neutral-900">Storage Distribution by Organisation</h2>
            <p className="text-xs text-neutral-500">
              Live consumption across file storage (media uploads, logos) and database records.
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-sm bg-blue-500" /> File Storage
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-sm bg-indigo-500" /> Database Records
            </span>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3">
          {organizations.map((org) => {
            return (
              <div key={org.id} className="flex flex-col gap-1.5 rounded-lg border border-neutral-100 bg-neutral-50/50 p-3">
                <div className="flex flex-wrap items-center justify-between text-xs">
                  <div className="flex items-center gap-2 font-medium text-neutral-900">
                    {org.logo_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={org.logo_url} alt="" className="h-5 w-5 rounded object-contain" />
                    )}
                    <span>{org.name}</span>
                    <span className="rounded bg-neutral-200/70 px-1.5 py-0.2 text-[10px] text-neutral-600 uppercase">
                      {org.category}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-neutral-500">
                    <span>
                      📁 Files: <strong className="text-neutral-800">{formatBytes(org.file_bytes)}</strong> ({org.file_count} files)
                    </span>
                    <span>
                      🗄️ DB: <strong className="text-neutral-800">{formatBytes(org.db_bytes_estimated)}</strong> ({org.db_records} records)
                    </span>
                    <span className="font-semibold text-neutral-900">
                      Total: {formatBytes(org.total_storage_bytes)}
                    </span>
                  </div>
                </div>

                {/* Progress bars */}
                <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-neutral-200">
                  <div
                    className="bg-blue-500 transition-all duration-500"
                    style={{ width: `${Math.max(org.file_pct, org.file_bytes > 0 ? 3 : 0)}%` }}
                    title={`File Storage: ${formatBytes(org.file_bytes)} (${org.file_pct}%)`}
                  />
                  <div
                    className="bg-indigo-500 transition-all duration-500"
                    style={{ width: `${Math.max(org.db_pct, org.db_bytes_estimated > 0 ? 3 : 0)}%` }}
                    title={`Database Storage: ${formatBytes(org.db_bytes_estimated)} (${org.db_pct}%)`}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Filter and Sorting Bar */}
      <div className="flex flex-col justify-between gap-3 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center">
        {/* Search */}
        <div className="relative w-full max-w-sm">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search organisation by name or category..."
            className="w-full rounded-lg border border-neutral-200 px-3 py-2 pl-9 text-xs focus:border-neutral-900 focus:outline-none"
          />
          <span className="absolute left-3 top-2.5 text-neutral-400">🔍</span>
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-2 text-xs text-neutral-400 hover:text-neutral-600"
            >
              ✕
            </button>
          )}
        </div>

        {/* Sort Select */}
        <div className="flex items-center gap-2 text-xs text-neutral-600">
          <span>Sort by:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 font-medium text-neutral-800 focus:border-neutral-900 focus:outline-none"
          >
            <option value="total_storage">Total Storage (Highest)</option>
            <option value="file_storage">File Storage (Highest)</option>
            <option value="db_storage">Database Storage (Highest)</option>
            <option value="issues">Total Complaints (Highest)</option>
            <option value="completion">Completion Rate (%)</option>
            <option value="name">Name (A-Z)</option>
          </select>
        </div>
      </div>

      {/* Detailed Organization-Wise Analytics Table */}
      <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white shadow-sm">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-neutral-200 bg-neutral-50/80 font-semibold text-neutral-600 uppercase tracking-wider text-[11px]">
            <tr>
              <th className="px-4 py-3.5">Organisation</th>
              <th className="px-4 py-3.5">File Storage</th>
              <th className="px-4 py-3.5">Database Storage</th>
              <th className="px-4 py-3.5">Total Storage</th>
              <th className="px-4 py-3.5">Complaints Status</th>
              <th className="px-4 py-3.5">Resolution Speed</th>
              <th className="px-4 py-3.5">Users / Workers</th>
              <th className="px-4 py-3.5 text-right">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {sortedAndFiltered.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-sm text-neutral-400">
                  No organisations match your search.
                </td>
              </tr>
            ) : (
              sortedAndFiltered.map((org) => {
                return (
                  <tr key={org.id} className="transition-colors hover:bg-neutral-50/60">
                    {/* Organisation Name & Logo */}
                    <td className="px-4 py-3.5 font-medium">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md border border-neutral-200 bg-neutral-50">
                          {org.logo_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={org.logo_url} alt="" className="h-full w-full object-contain" />
                          ) : (
                            <span className="text-[10px] text-neutral-400 font-bold">
                              {org.name.slice(0, 2).toUpperCase()}
                            </span>
                          )}
                        </div>
                        <div>
                          <div className="font-semibold text-neutral-900">{org.name}</div>
                          <div className="flex items-center gap-1.5 text-[11px] text-neutral-500">
                            <span className="capitalize">{org.category}</span>
                            <span>•</span>
                            <span
                              className={
                                org.status === "active"
                                  ? "text-emerald-600 font-medium"
                                  : "text-red-500 font-medium"
                              }
                            >
                              {org.status}
                            </span>
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* File Storage */}
                    <td className="px-4 py-3.5">
                      <div className="font-medium text-neutral-900">{formatBytes(org.file_bytes)}</div>
                      <div className="text-[11px] text-neutral-500">{org.file_count} files</div>
                    </td>

                    {/* Database Storage */}
                    <td className="px-4 py-3.5">
                      <div className="font-medium text-neutral-900">
                        {formatBytes(org.db_bytes_estimated)}
                      </div>
                      <div className="text-[11px] text-neutral-500">{org.db_records} records</div>
                    </td>

                    {/* Total Storage Combined */}
                    <td className="px-4 py-3.5 font-semibold text-neutral-900">
                      {formatBytes(org.total_storage_bytes)}
                    </td>

                    {/* Complaints Status */}
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-neutral-900">{org.total_issues}</span>
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                          {org.completion_rate}% done
                        </span>
                      </div>
                      <div className="mt-0.5 text-[11px] text-neutral-500">
                        {org.completed_issues} resolved · {org.processing_issues + org.assigned_issues} active
                      </div>
                    </td>

                    {/* Resolution Speed */}
                    <td className="px-4 py-3.5 text-neutral-700">
                      {formatDuration(org.avg_resolution_seconds)}
                    </td>

                    {/* Users & Workers */}
                    <td className="px-4 py-3.5 text-neutral-700">
                      <div>👥 {org.users_count} users</div>
                      <div className="text-[11px] text-neutral-500">
                        🛠️ {org.workers_count} workers · 🏢 {org.dept_admins_count} dept admins
                      </div>
                    </td>

                    {/* Action Button */}
                    <td className="px-4 py-3.5 text-right">
                      <button
                        onClick={() => setSelectedOrg(org)}
                        className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-[11px] font-medium text-neutral-700 shadow-sm hover:bg-neutral-50"
                      >
                        Deep Dive
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Deep Dive Organization Modal */}
      {selectedOrg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-neutral-200 bg-white p-6 shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-neutral-200 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-lg border border-neutral-200 bg-neutral-50">
                  {selectedOrg.logo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={selectedOrg.logo_url} alt="" className="h-full w-full object-contain" />
                  ) : (
                    <span className="text-sm font-bold text-neutral-400">
                      {selectedOrg.name.slice(0, 2).toUpperCase()}
                    </span>
                  )}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-neutral-900">{selectedOrg.name}</h3>
                  <div className="flex items-center gap-2 text-xs text-neutral-500">
                    <span className="capitalize">{selectedOrg.category}</span>
                    <span>•</span>
                    <span
                      className={
                        selectedOrg.status === "active" ? "text-emerald-600 font-semibold" : "text-red-500"
                      }
                    >
                      {selectedOrg.status}
                    </span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setSelectedOrg(null)}
                className="rounded-md p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
              >
                ✕
              </button>
            </div>

            <div className="mt-5 flex flex-col gap-6 text-sm">
              {/* Detailed Storage Footprint */}
              <div>
                <h4 className="font-semibold text-neutral-900">Storage & Database Footprint</h4>
                <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3">
                    <div className="text-xs text-neutral-500">File Storage</div>
                    <div className="mt-1 text-lg font-bold text-blue-600">
                      {formatBytes(selectedOrg.file_bytes)}
                    </div>
                    <div className="mt-0.5 text-xs text-neutral-500">
                      {selectedOrg.file_count} files ({selectedOrg.file_pct}% of platform)
                    </div>
                  </div>

                  <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3">
                    <div className="text-xs text-neutral-500">Database Storage</div>
                    <div className="mt-1 text-lg font-bold text-indigo-600">
                      {formatBytes(selectedOrg.db_bytes_estimated)}
                    </div>
                    <div className="mt-0.5 text-xs text-neutral-500">
                      {selectedOrg.db_records} records ({selectedOrg.db_pct}% of platform)
                    </div>
                  </div>

                  <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3">
                    <div className="text-xs text-neutral-500">Combined Total</div>
                    <div className="mt-1 text-lg font-bold text-neutral-900">
                      {formatBytes(selectedOrg.total_storage_bytes)}
                    </div>
                    <div className="mt-0.5 text-xs text-neutral-500">All data combined</div>
                  </div>
                </div>
              </div>

              {/* === Itemized Data Breakdown by Table === */}
              {selectedOrg.table_breakdown && selectedOrg.table_breakdown.length > 0 && (() => {
                const dbRows = selectedOrg.table_breakdown.filter((t) => !t.isFile);
                const fileRows = selectedOrg.table_breakdown.filter((t) => t.isFile);
                const totalDbRecords = Math.max(1, dbRows.reduce((s, t) => s + t.records, 0));
                const maxDbRecords = Math.max(1, ...dbRows.map((t) => t.records));
                // Distribute estimated DB bytes proportionally by record count
                const dbBytesTotal = selectedOrg.db_bytes_estimated;

                return (
                  <div>
                    <h4 className="font-semibold text-neutral-900">Storage Breakdown by Data Type</h4>
                    <p className="mt-0.5 text-[11px] text-neutral-400">
                      Shows record count and estimated storage size for each data type.
                      DB sizes are estimated proportionally from the organisation's total database allocation.
                    </p>
                    <div className="mt-3 flex flex-col gap-1.5">

                      {/* === DATABASE RECORDS section === */}
                      <div className="mb-1 flex items-center justify-between">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">🗄️ Database Records</span>
                        <span className="text-[11px] font-semibold text-indigo-600">{formatBytes(dbBytesTotal)} total</span>
                      </div>

                      {dbRows.map((item) => {
                        const pct = Math.round((item.records / maxDbRecords) * 100);
                        const estimatedBytes = totalDbRecords > 0
                          ? Math.round(dbBytesTotal * (item.records / totalDbRecords))
                          : 0;
                        return (
                          <div
                            key={item.table}
                            className="flex items-center gap-3 rounded-lg border border-neutral-100 bg-neutral-50/60 px-3 py-2"
                          >
                            <span className="w-5 shrink-0 text-center text-base leading-none">{item.icon}</span>
                            <div className="w-24 shrink-0 text-xs font-medium text-neutral-700">{item.table}</div>
                            <div className="flex flex-1 items-center gap-2">
                              <div className="flex-1 overflow-hidden rounded-full bg-neutral-200 h-2">
                                <div
                                  className="h-2 rounded-full bg-indigo-400 transition-all duration-500"
                                  style={{ width: `${Math.max(pct, item.records > 0 ? 4 : 0)}%` }}
                                />
                              </div>
                              <span className="w-12 text-right text-[11px] font-semibold text-neutral-700">
                                {item.records.toLocaleString()} rows
                              </span>
                              <span className={`w-16 text-right text-[11px] font-bold ${estimatedBytes > 0 ? "text-indigo-600" : "text-neutral-300"}`}>
                                {estimatedBytes > 0 ? formatBytes(estimatedBytes) : "—"}
                              </span>
                            </div>
                          </div>
                        );
                      })}

                      {/* DB Summary */}
                      <div className="mt-0.5 flex items-center justify-between rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-2">
                        <span className="text-xs font-semibold text-indigo-700">Database Total</span>
                        <div className="flex items-center gap-3 text-xs">
                          <span className="text-neutral-500">{selectedOrg.db_records.toLocaleString()} rows</span>
                          <span className="font-bold text-indigo-800">{formatBytes(dbBytesTotal)}</span>
                        </div>
                      </div>

                      {/* === FILE STORAGE section === */}
                      {fileRows.length > 0 && (
                        <>
                          <div className="mb-1 mt-4 flex items-center justify-between">
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">📁 File Storage</span>
                            <span className="text-[11px] font-semibold text-blue-600">{formatBytes(selectedOrg.file_bytes)} total</span>
                          </div>
                          {fileRows.map((item) => (
                            <div
                              key={item.table}
                              className="flex items-center gap-3 rounded-lg border border-neutral-100 bg-blue-50/40 px-3 py-2"
                            >
                              <span className="w-5 shrink-0 text-center text-base leading-none">{item.icon}</span>
                              <div className="w-24 shrink-0 text-xs font-medium text-neutral-700">{item.table}</div>
                              <div className="flex flex-1 items-center gap-2">
                                <div className="flex-1 overflow-hidden rounded-full bg-neutral-200 h-2">
                                  <div
                                    className="h-2 rounded-full bg-blue-400 transition-all duration-500"
                                    style={{ width: item.records > 0 ? "100%" : "0%" }}
                                  />
                                </div>
                                <span className="w-12 text-right text-[11px] font-semibold text-neutral-700">
                                  {item.records.toLocaleString()} files
                                </span>
                                <span className={`w-16 text-right text-[11px] font-bold ${selectedOrg.file_bytes > 0 ? "text-blue-600" : "text-neutral-300"}`}>
                                  {selectedOrg.file_bytes > 0 ? formatBytes(selectedOrg.file_bytes) : "—"}
                                </span>
                              </div>
                            </div>
                          ))}
                          {/* File summary */}
                          <div className="mt-0.5 flex items-center justify-between rounded-lg border border-blue-100 bg-blue-50 px-3 py-2">
                            <span className="text-xs font-semibold text-blue-700">File Storage Total</span>
                            <div className="flex items-center gap-3 text-xs">
                              <span className="text-neutral-500">{selectedOrg.file_count} files</span>
                              <span className="font-bold text-blue-800">{formatBytes(selectedOrg.file_bytes)}</span>
                            </div>
                          </div>
                        </>
                      )}

                      {/* === COMBINED GRAND TOTAL === */}
                      <div className="mt-2 flex items-center justify-between rounded-xl border border-neutral-300 bg-neutral-900 px-4 py-2.5">
                        <span className="text-xs font-semibold text-neutral-300">Combined Total Storage</span>
                        <span className="text-base font-bold text-white">{formatBytes(selectedOrg.total_storage_bytes)}</span>
                      </div>

                    </div>
                  </div>
                );
              })()}

              {/* Complaints & Performance */}
              <div>
                <h4 className="font-semibold text-neutral-900">Complaints & Operations</h4>
                <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="rounded-lg border border-neutral-200 p-3 text-center">
                    <div className="text-lg font-bold text-neutral-900">{selectedOrg.total_issues}</div>
                    <div className="text-xs text-neutral-500">Total Issues</div>
                  </div>
                  <div className="rounded-lg border border-neutral-200 p-3 text-center">
                    <div className="text-lg font-bold text-emerald-600">
                      {selectedOrg.completed_issues}
                    </div>
                    <div className="text-xs text-neutral-500">Completed</div>
                  </div>
                  <div className="rounded-lg border border-neutral-200 p-3 text-center">
                    <div className="text-lg font-bold text-amber-600">
                      {selectedOrg.processing_issues + selectedOrg.assigned_issues}
                    </div>
                    <div className="text-xs text-neutral-500">In Progress</div>
                  </div>
                  <div className="rounded-lg border border-neutral-200 p-3 text-center">
                    <div className="text-lg font-bold text-blue-600">
                      {formatDuration(selectedOrg.avg_resolution_seconds)}
                    </div>
                    <div className="text-xs text-neutral-500">Avg Resolution</div>
                  </div>
                </div>
              </div>

              {/* People & Structure */}
              <div>
                <h4 className="font-semibold text-neutral-900">Members & Structure</h4>
                <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="rounded-lg border border-neutral-100 bg-neutral-50 p-3">
                    <div className="text-xs text-neutral-500">Registered Users</div>
                    <div className="mt-1 text-base font-bold text-neutral-900">
                      {selectedOrg.users_count}
                    </div>
                  </div>
                  <div className="rounded-lg border border-neutral-100 bg-neutral-50 p-3">
                    <div className="text-xs text-neutral-500">Assigned Workers</div>
                    <div className="mt-1 text-base font-bold text-neutral-900">
                      {selectedOrg.workers_count}
                    </div>
                  </div>
                  <div className="rounded-lg border border-neutral-100 bg-neutral-50 p-3">
                    <div className="text-xs text-neutral-500">Dept Admins</div>
                    <div className="mt-1 text-base font-bold text-neutral-900">
                      {selectedOrg.dept_admins_count}
                    </div>
                  </div>
                  <div className="rounded-lg border border-neutral-100 bg-neutral-50 p-3">
                    <div className="text-xs text-neutral-500">Active Locations</div>
                    <div className="mt-1 text-base font-bold text-neutral-900">
                      {selectedOrg.locations_count}
                    </div>
                  </div>
                </div>
              </div>

              {/* Top Categories */}
              {selectedOrg.by_category.some((c) => c.count > 0) && (
                <div>
                  <h4 className="font-semibold text-neutral-900">Top Categories Reported</h4>
                  <div className="mt-2 flex flex-col gap-1.5">
                    {selectedOrg.by_category
                      .filter((c) => c.count > 0)
                      .slice(0, 5)
                      .map((cat) => (
                        <div key={cat.name} className="flex items-center justify-between text-xs">
                          <span className="text-neutral-700">{cat.name}</span>
                          <span className="font-semibold text-neutral-900">{cat.count} issues</span>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Worker Activity */}
              {selectedOrg.by_worker.length > 0 && (
                <div>
                  <h4 className="font-semibold text-neutral-900">Worker Resolution Stats</h4>
                  <div className="mt-2 divide-y divide-neutral-100 rounded-lg border border-neutral-200">
                    {selectedOrg.by_worker.map((w) => (
                      <div key={w.display_name} className="flex items-center justify-between p-2.5 text-xs">
                        <span className="font-medium text-neutral-800">{w.display_name}</span>
                        <div className="flex items-center gap-3 text-neutral-500">
                          <span>
                            Resolved: <strong className="text-neutral-900">{w.count}</strong>
                          </span>
                          <span>Speed: {formatDuration(w.avg_resolution_seconds ?? null)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end border-t border-neutral-200 pt-4">
              <button
                onClick={() => setSelectedOrg(null)}
                className="rounded-lg bg-neutral-900 px-4 py-2 text-xs font-medium text-white hover:bg-neutral-800"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
