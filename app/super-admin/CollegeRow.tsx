"use client";

import { useRef, useState, useTransition } from "react";
import {
  setCollegeStatus,
  updateCollege,
  softDeleteCollege,
  restoreCollege,
  permanentlyDeleteCollege,
} from "./actions";

export type Organization = {
  id: string;
  name: string;
  category?: string | null;
  subscription_status: string;
  logo_url: string | null;
  address?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  allow_worker_signup?: boolean;
  allow_admin_signup?: boolean;
  user_count: number;
  worker_count: number;
  issue_count: number;
  created_at?: string;
};

const CATEGORIES = [
  { value: "college", label: "College" },
  { value: "university", label: "University" },
  { value: "school", label: "School" },
  { value: "office", label: "Corporate / Office" },
  { value: "company", label: "Company" },
  { value: "hospital", label: "Hospital / Healthcare" },
  { value: "community", label: "Residential / Society" },
  { value: "other", label: "Other" },
];

export default function CollegeRow({ college }: { college: Organization }) {
  const [pending, startTransition] = useTransition();
  const [logoUrl, setLogoUrl] = useState(college.logo_url);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Modals state
  const [editOpen, setEditOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [permanentDeleteOpen, setPermanentDeleteOpen] = useState(false);

  // Edit form state
  const [editName, setEditName] = useState(college.name);
  const [editCategory, setEditCategory] = useState(college.category ?? "college");
  const [editAddress, setEditAddress] = useState(college.address ?? "");
  const [editEmail, setEditEmail] = useState(college.contact_email ?? "");
  const [editPhone, setEditPhone] = useState(college.contact_phone ?? "");
  const [editAllowWorker, setEditAllowWorker] = useState(college.allow_worker_signup ?? true);
  const [editAllowAdmin, setEditAllowAdmin] = useState(college.allow_admin_signup ?? true);

  const isPendingDeletion = college.subscription_status?.startsWith("pending_deletion");
  let daysLeft = 30;
  let scheduledDeletionDate = "";

  if (isPendingDeletion) {
    const rawTimestamp = college.subscription_status.replace("pending_deletion:", "");
    const deletionTime = new Date(rawTimestamp).getTime();
    if (!isNaN(deletionTime)) {
      const msPassed = Date.now() - deletionTime;
      const daysPassed = Math.floor(msPassed / (1000 * 60 * 60 * 24));
      daysLeft = Math.max(0, 30 - daysPassed);
      scheduledDeletionDate = new Date(deletionTime + 30 * 24 * 60 * 60 * 1000).toLocaleDateString(
        undefined,
        { month: "short", day: "numeric", year: "numeric" }
      );
    }
  }

  const isSuspended = college.subscription_status === "suspended";

  function toggleSuspend() {
    const next = isSuspended ? "active" : "suspended";
    startTransition(async () => {
      const result = await setCollegeStatus(college.id, next);
      if (result.error) alert(result.error);
    });
  }

  async function handleLogoChange(file: File | null) {
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("college_id", college.id);
    const res = await fetch("/api/college-logo", { method: "POST", body: fd });
    const body = await res.json();
    setUploading(false);
    if (!res.ok) {
      alert(body.error ?? "Upload failed");
      return;
    }
    setLogoUrl(body.url);
  }

  function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const fd = new FormData();
      fd.set("name", editName);
      fd.set("category", editCategory);
      fd.set("address", editAddress);
      fd.set("contact_email", editEmail);
      fd.set("contact_phone", editPhone);
      fd.set("allow_worker_signup", String(editAllowWorker));
      fd.set("allow_admin_signup", String(editAllowAdmin));

      const res = await updateCollege(college.id, fd);
      if (res.error) {
        alert(res.error);
      } else {
        setEditOpen(false);
      }
    });
  }

  function handleSoftDelete() {
    startTransition(async () => {
      const res = await softDeleteCollege(college.id);
      if (res.error) alert(res.error);
      setDeleteConfirmOpen(false);
    });
  }

  function handleRestore() {
    startTransition(async () => {
      const res = await restoreCollege(college.id);
      if (res.error) alert(res.error);
    });
  }

  function handlePermanentDelete() {
    startTransition(async () => {
      const res = await permanentlyDeleteCollege(college.id);
      if (res.error) alert(res.error);
      setPermanentDeleteOpen(false);
    });
  }

  return (
    <div
      className={`rounded-lg border bg-white p-4 shadow-sm transition-all ${
        isPendingDeletion
          ? "border-amber-300 bg-amber-50/40"
          : isSuspended
          ? "border-red-200 bg-neutral-50"
          : "border-neutral-200"
      }`}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Left Info */}
        <div className="flex items-start gap-3">
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="group relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-dashed border-neutral-300 bg-neutral-50 text-[10px] text-neutral-400 hover:border-neutral-500"
            title="Click to change logo"
          >
            {uploading ? (
              <span className="animate-spin text-xs">⏳</span>
            ) : logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="" className="h-full w-full object-contain" />
            ) : (
              <span className="text-center font-medium leading-tight text-neutral-400">
                Upload
                <br />
                Logo
              </span>
            )}
            <div className="absolute inset-0 hidden items-center justify-center bg-black/40 text-[9px] font-semibold text-white group-hover:flex">
              Change
            </div>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            className="hidden"
            onChange={(e) => handleLogoChange(e.target.files?.[0] ?? null)}
          />

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-neutral-900">{college.name}</span>
              <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-neutral-600">
                {college.category ?? "General"}
              </span>

              {/* Status Badge */}
              {isPendingDeletion ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
                  ⚠️ Deleting in {daysLeft} {daysLeft === 1 ? "day" : "days"}
                </span>
              ) : isSuspended ? (
                <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700">
                  Suspended
                </span>
              ) : (
                <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                  Active
                </span>
              )}
            </div>

            <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-neutral-500">
              <span>👥 {college.user_count} users</span>
              <span>🛠️ {college.worker_count} workers</span>
              <span>📋 {college.issue_count} issues</span>
              {college.address && <span className="hidden sm:inline">📍 {college.address}</span>}
            </div>
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {isPendingDeletion ? (
            <>
              <button
                onClick={handleRestore}
                disabled={pending}
                className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-emerald-700 disabled:opacity-40"
              >
                ↺ Restore Organisation
              </button>
              <button
                onClick={() => setPermanentDeleteOpen(true)}
                disabled={pending}
                className="rounded-md border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-40"
              >
                Delete Permanently
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setEditOpen(true)}
                disabled={pending}
                className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-40"
              >
                Edit
              </button>

              <button
                onClick={toggleSuspend}
                disabled={pending}
                className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-40 ${
                  isSuspended
                    ? "border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                    : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50"
                }`}
              >
                {isSuspended ? "Activate" : "Suspend"}
              </button>

              <button
                onClick={() => setDeleteConfirmOpen(true)}
                disabled={pending}
                className="rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-red-600 hover:border-red-300 hover:bg-red-50 disabled:opacity-40"
                title="Delete with 30-day grace period"
              >
                Delete
              </button>
            </>
          )}
        </div>
      </div>

      {/* Pending Deletion Alert Info */}
      {isPendingDeletion && (
        <div className="mt-3 flex flex-col gap-1 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 sm:flex-row sm:items-center sm:justify-between">
          <p>
            ⏳ Marked for deletion on <strong>{scheduledDeletionDate}</strong>. All issues, categories,
            locations, and data will be automatically purged after 30 days unless restored.
          </p>
          <span className="font-semibold">{daysLeft} days remaining</span>
        </div>
      )}

      {/* Edit Modal */}
      {editOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-xl border border-neutral-200 bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between border-b pb-3">
              <h3 className="text-lg font-semibold text-neutral-900">Edit Organisation</h3>
              <button
                onClick={() => setEditOpen(false)}
                className="text-neutral-400 hover:text-neutral-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="flex flex-col gap-4 text-sm">
              <div>
                <label className="mb-1 block font-medium text-neutral-700">Organisation Name *</label>
                <input
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full rounded-md border border-neutral-300 px-3 py-2 text-neutral-900 focus:border-neutral-900 focus:outline-none"
                  placeholder="e.g. Acme University"
                />
              </div>

              <div>
                <label className="mb-1 block font-medium text-neutral-700">Category</label>
                <select
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value)}
                  className="w-full rounded-md border border-neutral-300 px-3 py-2 text-neutral-900 focus:border-neutral-900 focus:outline-none"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat.value} value={cat.value}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block font-medium text-neutral-700">Address / Location</label>
                <input
                  value={editAddress}
                  onChange={(e) => setEditAddress(e.target.value)}
                  className="w-full rounded-md border border-neutral-300 px-3 py-2 text-neutral-900 focus:border-neutral-900 focus:outline-none"
                  placeholder="e.g. 123 Tech Park, Indore"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block font-medium text-neutral-700">Contact Email</label>
                  <input
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    className="w-full rounded-md border border-neutral-300 px-3 py-2 text-neutral-900 focus:border-neutral-900 focus:outline-none"
                    placeholder="contact@org.com"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-medium text-neutral-700">Contact Phone</label>
                  <input
                    type="tel"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    className="w-full rounded-md border border-neutral-300 px-3 py-2 text-neutral-900 focus:border-neutral-900 focus:outline-none"
                    placeholder="+91 9876543210"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2 rounded-md bg-neutral-50 p-3">
                <span className="font-medium text-neutral-800">Sign-up Permissions</span>
                <label className="flex items-center gap-2 text-xs text-neutral-700">
                  <input
                    type="checkbox"
                    checked={editAllowWorker}
                    onChange={(e) => setEditAllowWorker(e.target.checked)}
                    className="rounded border-neutral-300"
                  />
                  Allow worker / maintenance staff registration
                </label>
                <label className="flex items-center gap-2 text-xs text-neutral-700">
                  <input
                    type="checkbox"
                    checked={editAllowAdmin}
                    onChange={(e) => setEditAllowAdmin(e.target.checked)}
                    className="rounded border-neutral-300"
                  />
                  Allow organisation admin registration (requires approval)
                </label>
              </div>

              <div className="mt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditOpen(false)}
                  className="rounded-md border border-neutral-300 px-4 py-2 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded-md bg-neutral-900 px-4 py-2 text-xs font-medium text-white hover:bg-neutral-800 disabled:opacity-40"
                >
                  {pending ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 30-Day Soft Delete Confirmation Modal */}
      {deleteConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-neutral-200 bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-neutral-900">Delete Organisation?</h3>
            <p className="mt-2 text-sm text-neutral-600">
              Are you sure you want to delete <strong>{college.name}</strong>?
            </p>
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              <p className="font-semibold">🛡️ 30-Day Recovery Grace Period</p>
              <p className="mt-1">
                The organisation will NOT be deleted immediately. It will be moved to{" "}
                <strong>Pending Deletion</strong>. You can restore it at any time within 30 days. After
                30 days, all its data will be permanently wiped from the database.
              </p>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmOpen(false)}
                className="rounded-md border border-neutral-300 px-4 py-2 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSoftDelete}
                disabled={pending}
                className="rounded-md bg-red-600 px-4 py-2 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-40"
              >
                {pending ? "Deleting..." : "Move to Trash (30-day grace)"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Permanent Immediate Delete Modal */}
      {permanentDeleteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-red-200 bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-red-600">Permanent Database Deletion</h3>
            <p className="mt-2 text-sm text-neutral-700">
              This action is <strong>irreversible</strong>. You are about to immediately and
              permanently erase <strong>{college.name}</strong> from the database.
            </p>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-neutral-600">
              <li>All complaints, media, and audit trails will be deleted.</li>
              <li>All categories, departments, and locations will be deleted.</li>
              <li>Users will be unlinked from this organisation.</li>
            </ul>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPermanentDeleteOpen(false)}
                className="rounded-md border border-neutral-300 px-4 py-2 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
              >
                Keep in Grace Period
              </button>
              <button
                type="button"
                onClick={handlePermanentDelete}
                disabled={pending}
                className="rounded-md bg-red-700 px-4 py-2 text-xs font-medium text-white hover:bg-red-800 disabled:opacity-40"
              >
                {pending ? "Permanently Deleting..." : "Permanently Delete Now"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
