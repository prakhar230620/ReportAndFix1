"use client";

import { useState } from "react";
import {
  checkDuplicates,
  createComplaint,
  joinComplaint,
  type DuplicateCandidate,
} from "./actions";

type Category = { id: string; name: string };

const MAX_FILES = 5;
const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const DESCRIPTION_LIMIT = 500;

type Step =
  | { name: "form" }
  | { name: "duplicates"; candidates: DuplicateCandidate[] }
  | { name: "uploading"; progress: string }
  | { name: "joined"; voteCount: number | null }
  | { name: "created"; publicId: string };

export default function ReportForm({
  token,
  locationName,
  locationSummary,
  categories,
}: {
  token: string;
  locationName: string;
  locationSummary: string;
  categories: Category[];
}) {
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<Step>({ name: "form" });

  function handleFiles(selected: FileList | null) {
    if (!selected) return;
    const arr = Array.from(selected);
    if (arr.length > MAX_FILES) {
      setFileError(`Max ${MAX_FILES} photos.`);
      return;
    }
    for (const f of arr) {
      if (!ALLOWED_TYPES.includes(f.type)) {
        setFileError(`${f.name}: only JPEG, PNG, or WebP allowed.`);
        return;
      }
      if (f.size > MAX_BYTES) {
        setFileError(`${f.name}: exceeds 8MB.`);
        return;
      }
    }
    setFileError(null);
    setFiles(arr);
  }

  async function handleCheckDuplicates() {
    setFormError(null);
    if (!title.trim()) {
      setFormError("Please add a short title.");
      return;
    }
    if (!categoryId) {
      setFormError("Please choose a category.");
      return;
    }
    setBusy(true);
    try {
      const result = await checkDuplicates(token, categoryId, title, description);
      if ("error" in result && result.error) {
        setFormError(result.error);
        return;
      }
      const candidates = "candidates" in result ? result.candidates ?? [] : [];
      if (candidates.length === 0) {
        await submitNewComplaint();
      } else {
        setStep({ name: "duplicates", candidates });
      }
    } finally {
      setBusy(false);
    }
  }

  async function submitNewComplaint() {
    setBusy(true);
    setFormError(null);
    try {
      const result = await createComplaint({
        token,
        categoryId,
        title,
        description,
      });
      if (result.error || !result.complaint) {
        setFormError(result.error ?? "Something went wrong.");
        return;
      }

      const complaintId = result.complaint.id;

      if (files.length > 0) {
        setStep({ name: "uploading", progress: `0/${files.length}` });
        for (let i = 0; i < files.length; i++) {
          const fd = new FormData();
          fd.append("file", files[i]);
          fd.append("complaint_id", complaintId);
          fd.append("media_type", "before");
          const res = await fetch("/api/complaints/media", { method: "POST", body: fd });
          if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            setFormError(
              `Complaint created (${result.complaint.public_id}), but photo ${i + 1} failed: ${
                body.error ?? res.statusText
              }`
            );
          }
          setStep({ name: "uploading", progress: `${i + 1}/${files.length}` });
        }
      }

      setStep({ name: "created", publicId: result.complaint.public_id });
    } finally {
      setBusy(false);
    }
  }

  async function handleJoin(complaintId: string) {
    setBusy(true);
    setFormError(null);
    try {
      const result = await joinComplaint(complaintId);
      if (result.error) {
        setFormError(result.error);
        return;
      }
      setStep({ name: "joined", voteCount: result.voteCount ?? null });
    } finally {
      setBusy(false);
    }
  }

  if (step.name === "created") {
    return (
      <Center>
        <h1 className="text-xl font-semibold">Reported ✓</h1>
        <p className="text-neutral-600">
          Your complaint ID is <span className="font-mono">{step.publicId}</span>.
        </p>
        <p className="text-sm text-neutral-500">
          <a href={`/issues/${step.publicId}`} className="font-medium text-blue-600 hover:text-blue-700">View it on the public feed</a>
        </p>
      </Center>
    );
  }

  if (step.name === "joined") {
    return (
      <Center>
        <h1 className="text-xl font-semibold">You&apos;ve joined this report ✓</h1>
        <p className="text-neutral-600">
          {step.voteCount !== null
            ? `${step.voteCount} people have now reported this issue.`
            : "Your vote was recorded."}
        </p>
      </Center>
    );
  }

  if (step.name === "uploading") {
    return (
      <Center>
        <h1 className="text-xl font-semibold">Uploading photos…</h1>
        <p className="text-neutral-600">{step.progress}</p>
      </Center>
    );
  }

  if (step.name === "duplicates") {
    return (
      <main className="mx-auto flex min-h-screen max-w-sm flex-col gap-4 px-6 py-10">
        <h1 className="text-xl font-semibold">Similar reports found</h1>
        <p className="text-sm text-neutral-600">
          Is your issue one of these already-reported ones? Join it instead of
          creating a duplicate, or tell us it&apos;s different.
        </p>

        {formError && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</p>
        )}

        <div className="flex flex-col gap-3">
          {step.candidates.map((c) => (
            <div key={c.id} className="rounded-md border border-neutral-300 p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-medium">{c.title}</span>
                <span className="text-xs text-neutral-500">
                  {Math.round(c.similarity * 100)}% match
                </span>
              </div>
              {c.description && (
                <p className="mt-1 text-neutral-600">{c.description}</p>
              )}
              <div className="mt-2 flex items-center justify-between text-xs text-neutral-500">
                <span>
                  {c.public_id} · {c.vote_count} joined · {c.status}
                </span>
                <button
                  disabled={busy}
                  onClick={() => handleJoin(c.id)}
                  className="rounded-md bg-neutral-900 px-3 py-1 text-white disabled:opacity-40"
                >
                  Join this
                </button>
              </div>
            </div>
          ))}
        </div>

        <button
          disabled={busy}
          onClick={submitNewComplaint}
          className="rounded-md border border-neutral-300 px-4 py-2 text-sm disabled:opacity-40"
        >
          This is different — report separately
        </button>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col gap-4 px-6 py-10">
      <div>
        <h1 className="text-xl font-semibold">{locationName}</h1>
        {locationSummary && <p className="text-sm text-neutral-500">{locationSummary}</p>}
      </div>

      {formError && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</p>
      )}

      <label className="flex flex-col gap-1 text-sm">
        Category
        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="rounded-md border border-neutral-300 px-3 py-2"
        >
          {categories.length === 0 && <option value="">No categories set up</option>}
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Title
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={120}
          placeholder="e.g. Broken tap in washroom"
          className="rounded-md border border-neutral-300 px-3 py-2"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Description
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value.slice(0, DESCRIPTION_LIMIT))}
          rows={4}
          placeholder="What's wrong, and any details that help fix it faster."
          className="rounded-md border border-neutral-300 px-3 py-2"
        />
        <span className="text-right text-xs text-neutral-400">
          {description.length}/{DESCRIPTION_LIMIT}
        </span>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Photos (optional, up to {MAX_FILES})
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          capture="environment"
          onChange={(e) => handleFiles(e.target.files)}
          className="text-sm"
        />
      </label>
      {fileError && <p className="text-sm text-red-600">{fileError}</p>}
      {files.length > 0 && (
        <p className="text-xs text-neutral-500">{files.length} photo(s) selected.</p>
      )}

      <p className="text-xs text-neutral-500">
        Your identity is never shown to anyone, including admins and staff —
        every report here is anonymous by default.
      </p>

      <button
        disabled={busy || categories.length === 0}
        onClick={handleCheckDuplicates}
        className="mt-2 rounded-md bg-neutral-900 px-4 py-2 text-white disabled:opacity-40"
      >
        {busy ? "Checking…" : "Continue"}
      </button>
    </main>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center gap-2 px-6 text-center">
      {children}
    </main>
  );
}
