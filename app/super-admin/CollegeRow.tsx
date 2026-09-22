"use client";

import { useRef, useState, useTransition } from "react";
import { setCollegeStatus } from "./actions";

type College = {
  id: string;
  name: string;
  subscription_status: string;
  logo_url: string | null;
  user_count: number;
  worker_count: number;
  issue_count: number;
};

export default function CollegeRow({ college }: { college: College }) {
  const [pending, startTransition] = useTransition();
  const [logoUrl, setLogoUrl] = useState(college.logo_url);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function toggle() {
    const next = college.subscription_status === "suspended" ? "active" : "suspended";
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

  const suspended = college.subscription_status === "suspended";

  return (
    <div className="flex items-center justify-between rounded-lg border border-neutral-200 bg-white p-3 text-sm shadow-sm">
      <div className="flex items-center gap-3">
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md border border-dashed border-neutral-300 bg-neutral-50 text-[10px] text-neutral-400 hover:border-neutral-400"
          title="Click to change logo"
        >
          {uploading ? (
            "…"
          ) : logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="" className="h-full w-full object-contain" />
          ) : (
            "Logo"
          )}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          className="hidden"
          onChange={(e) => handleLogoChange(e.target.files?.[0] ?? null)}
        />
        <div>
          <div className="font-medium text-neutral-900">{college.name}</div>
          <div className="text-neutral-500">
            {college.user_count} users · {college.worker_count} workers · {college.issue_count} issues
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span
          className={
            suspended
              ? "rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700"
              : "rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700"
          }
        >
          {college.subscription_status}
        </span>
        <button
          onClick={toggle}
          disabled={pending}
          className="rounded-md border border-neutral-300 px-3 py-1.5 text-xs font-medium hover:bg-neutral-50 disabled:opacity-40"
        >
          {suspended ? "Activate" : "Suspend"}
        </button>
      </div>
    </div>
  );
}
