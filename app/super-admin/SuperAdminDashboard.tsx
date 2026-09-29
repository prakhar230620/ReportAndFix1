"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import CollegeRow, { Organization } from "./CollegeRow";
import AddCollegeForm from "./AddCollegeForm";
import BrandLogo from "@/app/components/BrandLogo";
import { CreditCard, ExternalLink } from "lucide-react";

export default function SuperAdminDashboard({
  organizations,
  totalUsers,
  totalWorkers,
  totalIssues,
}: {
  organizations: Organization[];
  totalUsers: number;
  totalWorkers: number;
  totalIssues: number;
}) {
  const [activeTab, setActiveTab] = useState<"all" | "active" | "suspended" | "trash">("all");
  const [search, setSearch] = useState("");

  const pendingDeletionCount = useMemo(
    () => organizations.filter((o) => o.subscription_status?.startsWith("pending_deletion")).length,
    [organizations]
  );

  const activeCount = useMemo(
    () =>
      organizations.filter(
        (o) =>
          o.subscription_status === "active" && !o.subscription_status?.startsWith("pending_deletion")
      ).length,
    [organizations]
  );

  const suspendedCount = useMemo(
    () => organizations.filter((o) => o.subscription_status === "suspended").length,
    [organizations]
  );

  const filtered = useMemo(() => {
    return organizations.filter((org) => {
      const isTrash = org.subscription_status?.startsWith("pending_deletion");
      const isSuspended = org.subscription_status === "suspended";
      const isActive = !isTrash && !isSuspended;

      if (activeTab === "active" && !isActive) return false;
      if (activeTab === "suspended" && !isSuspended) return false;
      if (activeTab === "trash" && !isTrash) return false;
      if (activeTab === "all" && isTrash) return false; // Keep trash in separate tab by default unless tab selected

      if (search.trim()) {
        const q = search.toLowerCase();
        const matchName = org.name.toLowerCase().includes(q);
        const matchCat = org.category?.toLowerCase().includes(q);
        const matchAddr = org.address?.toLowerCase().includes(q);
        return matchName || matchCat || matchAddr;
      }
      return true;
    });
  }, [organizations, activeTab, search]);

  return (
    <div className="flex flex-col gap-6">
      {/* Platform Header & Stats */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-neutral-200 pb-5">
        <div className="flex items-center gap-3.5">
          <BrandLogo size="lg" />
          <div>
            <h1 className="text-xl font-bold tracking-tight text-neutral-900">Platform Command Center</h1>
            <p className="text-xs text-neutral-500">
              Manage all organizations, monitor multi-tenant activity, and configure plans
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/super-admin/plans"
            className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:from-blue-700 hover:to-indigo-700 transition"
          >
            <CreditCard className="h-3.5 w-3.5" />
            <span>Plans & Pricing Studio</span>
          </Link>
          <Link
            href="/landing"
            target="_blank"
            className="inline-flex items-center gap-1.5 rounded-xl border border-neutral-300 bg-white px-3.5 py-2.5 text-xs font-semibold text-neutral-700 shadow-xs hover:bg-neutral-50 transition"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            <span>Landing Page</span>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-center sm:grid-cols-4">
        <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
          <div className="text-2xl font-bold text-neutral-900">{organizations.length - pendingDeletionCount}</div>
          <div className="mt-1 text-xs font-medium text-neutral-500">Active Organisations</div>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
          <div className="text-2xl font-bold text-neutral-900">{totalUsers}</div>
          <div className="mt-1 text-xs font-medium text-neutral-500">Total Users</div>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
          <div className="text-2xl font-bold text-neutral-900">{totalWorkers}</div>
          <div className="mt-1 text-xs font-medium text-neutral-500">Total Workers</div>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
          <div className="text-2xl font-bold text-neutral-900">{totalIssues}</div>
          <div className="mt-1 text-xs font-medium text-neutral-500">Total Issues</div>
        </div>
      </div>

      {/* Management Toolbar */}
      <div className="flex flex-col gap-4 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          {/* Tabs */}
          <div className="flex flex-wrap gap-1 rounded-lg bg-neutral-100 p-1 text-xs font-medium">
            <button
              onClick={() => setActiveTab("all")}
              className={`rounded-md px-3 py-1.5 transition-colors ${
                activeTab === "all" ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-600 hover:text-neutral-900"
              }`}
            >
              All ({organizations.length - pendingDeletionCount})
            </button>
            <button
              onClick={() => setActiveTab("active")}
              className={`rounded-md px-3 py-1.5 transition-colors ${
                activeTab === "active" ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-600 hover:text-neutral-900"
              }`}
            >
              Active ({activeCount})
            </button>
            <button
              onClick={() => setActiveTab("suspended")}
              className={`rounded-md px-3 py-1.5 transition-colors ${
                activeTab === "suspended" ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-600 hover:text-neutral-900"
              }`}
            >
              Suspended ({suspendedCount})
            </button>
            <button
              onClick={() => setActiveTab("trash")}
              className={`relative rounded-md px-3 py-1.5 transition-colors ${
                activeTab === "trash"
                  ? "bg-white text-amber-700 shadow-sm"
                  : "text-neutral-600 hover:text-neutral-900"
              }`}
            >
              🗑️ Trash / Grace Period ({pendingDeletionCount})
            </button>
          </div>

          {/* Add Org button */}
          <AddCollegeForm />
        </div>

        {/* Search */}
        <div className="relative">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search organizations by name, category, or location..."
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
      </div>

      {/* Trash Tab Information Notice */}
      {activeTab === "trash" && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
          <h4 className="font-semibold text-amber-950">🛡️ 30-Day Soft Delete Recovery Window</h4>
          <p className="mt-1 leading-relaxed">
            Organisations listed below are scheduled for permanent deletion. You can restore them to
            Active anytime before the 30-day grace period expires. Once 30 days elapse, their entire
            database footprint (complaints, categories, media, locations) is automatically and permanently purged.
          </p>
        </div>
      )}

      {/* List of Organisations */}
      <div className="flex flex-col gap-3">
        {filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-neutral-300 bg-white p-8 text-center text-sm text-neutral-500">
            {search
              ? `No organisations match "${search}".`
              : activeTab === "trash"
              ? "No organisations are currently in the 30-day trash/grace period."
              : "No organisations found."}
          </div>
        ) : (
          filtered.map((c) => <CollegeRow key={c.id} college={c} />)
        )}
      </div>
    </div>
  );
}
