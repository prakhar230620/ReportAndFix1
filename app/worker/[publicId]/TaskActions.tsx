"use client";

import { useState, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ButtonSpinner } from "@/app/components/Spinner";
import { startProcessing, addProgressUpdate, finishTask } from "./actions";
import { compressImage } from "@/lib/compressImage";

const MAX_BYTES = 8 * 1024 * 1024;
const MAX_FILES = 2;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export default function TaskActions({
  complaintId,
  status,
  cameraMode = "both",
}: {
  complaintId: string;
  status: string;
  cameraMode?: "both" | "camera_only" | "manual_only";
}) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [finalNote, setFinalNote] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const [compressing, setCompressing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  // Use STATE (not ref) for submitting so button re-renders and becomes visually disabled
  const [submitting, setSubmitting] = useState(false);

  const [currentStatus, setCurrentStatus] = useState(status);
  const isCameraDisabled = cameraMode === "manual_only";

  // Idempotency key per submission session prevents StrictMode double-invoke duplicates
  const uploadSessionKey = useRef<string>("");

  async function handleFiles(selected: FileList | null) {
    if (!selected || selected.length === 0) return;
    const arr = Array.from(selected);

    // Deduplicate against already selected files
    const existingSignatures = new Set(files.map((f) => `${f.name}_${f.size}`));
    const newFiles = arr.filter((f) => !existingSignatures.has(`${f.name}_${f.size}`));

    if (newFiles.length === 0) return;

    if (files.length + newFiles.length > MAX_FILES) {
      setFileError(`Max ${MAX_FILES} photos.`);
      return;
    }
    for (const f of newFiles) {
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
    setCompressing(true);
    try {
      const compressed = await Promise.all(newFiles.map((f) => compressImage(f)));
      setFiles((prev) => [...prev, ...compressed]);
    } finally {
      setCompressing(false);
    }
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleStart() {
    setError(null);
    startTransition(async () => {
      const result = await startProcessing(complaintId);
      if (result.error) {
        setError(result.error);
        if ((result as any).status) setCurrentStatus((result as any).status);
      } else {
        setCurrentStatus("processing");
        router.refresh();
      }
    });
  }

  function handleAddNote() {
    if (!note.trim()) return;
    setError(null);
    startTransition(async () => {
      const result = await addProgressUpdate(complaintId, note);
      if (result.error) {
        setError(result.error);
      } else {
        setNote("");
        router.refresh();
      }
    });
  }

  async function handleFinish() {
    if (!isCameraDisabled && files.length === 0) {
      setError("Add at least one after-photo before finishing.");
      return;
    }
    if (isCameraDisabled && !finalNote.trim()) {
      setError("Please describe the resolution details in the final work notes.");
      return;
    }

    if (submitting) return; // prevent double-submit
    setSubmitting(true);
    setError(null);

    // Unique idempotency key for this entire upload session
    uploadSessionKey.current = `${complaintId}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const sessionKey = uploadSessionKey.current;

    try {
      if (files.length > 0) {
        setUploadProgress(`Uploading 0/${files.length}\u2026`);
        let doneCount = 0;
        const results = await Promise.all(
          files.map(async (file, i) => {
            const fd = new FormData();
            fd.append("file", file);
            fd.append("complaint_id", complaintId);
            fd.append("media_type", "after");
            // Per-file idempotency key: same key = same DB row (upsert on conflict)
            fd.append("idempotency_key", `${sessionKey}-${i}`);
            const res = await fetch("/api/complaints/media", { method: "POST", body: fd });
            doneCount += 1;
            setUploadProgress(`Uploading ${doneCount}/${files.length}\u2026`);
            if (!res.ok) {
              const body = await res.json().catch(() => ({}));
              return { index: i, error: body.error ?? res.statusText };
            }
            return null;
          })
        );
        const failed = results.filter(Boolean) as { index: number; error: string }[];
        setUploadProgress(null);
        if (failed.length > 0) {
          setError(`${failed.length} photo(s) failed to upload: ${failed.map((f) => f.error).join("; ")}`);
          setSubmitting(false);
          return;
        }
      }
      const result = await finishTask(complaintId, finalNote);
      if (result.error) {
        setError(result.error);
      } else {
        setCurrentStatus("waiting_for_verification");
        setFiles([]);
        setFinalNote("");
        router.refresh();
      }
    } finally {
      setSubmitting(false);
    }
  }

  const canFinish = isCameraDisabled ? finalNote.trim().length > 0 : files.length > 0;

  return (
    <div className="flex flex-col gap-4">
      {error && <p className="text-xs text-red-600 font-medium">{error}</p>}

      {currentStatus === "assigned" && (
        <button
          onClick={handleStart}
          disabled={pending}
          className="flex w-fit items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 disabled:opacity-50"
        >
          {pending && <ButtonSpinner />}
          Start work
        </button>
      )}

      {currentStatus === "processing" && (
        <>
          <div className="flex flex-col gap-2 rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-neutral-800">Add progress note</h3>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="e.g. Waiting for spare part from stores"
              className="rounded-md border border-neutral-300 px-2 py-1.5 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
            <button
              onClick={handleAddNote}
              disabled={pending || !note.trim()}
              className="flex w-fit items-center gap-2 rounded-md bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition-colors hover:bg-neutral-800 disabled:opacity-50"
            >
              {pending && <ButtonSpinner />}
              Post note
            </button>
          </div>

          <div className="flex flex-col gap-2 rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-neutral-800">Finish task</h3>

            {isCameraDisabled ? (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-800">
                📷 <strong>No Camera Permission:</strong> Mobile photo capture is restricted for this
                organisation. Provide task description notes below to submit.
              </div>
            ) : (
              <>
                <input
                  key={files.length}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  capture="environment"
                  disabled={compressing || files.length >= MAX_FILES || submitting}
                  onChange={(e) => {
                    handleFiles(e.target.files);
                    e.target.value = ""; // Reset input to prevent double-fire
                  }}
                  className="text-sm"
                />
                {fileError && <p className="text-xs text-red-600">{fileError}</p>}
                {compressing && (
                  <p className="flex items-center gap-1.5 text-xs text-neutral-500">
                    <ButtonSpinner className="border-neutral-300 border-t-blue-600" /> Compressing
                    photo…
                  </p>
                )}
                {files.length > 0 && (
                  <ul className="flex flex-col gap-1">
                    {files.map((f, i) => (
                      <li
                        key={i}
                        className="flex items-center justify-between rounded-md border border-neutral-200 bg-neutral-50 px-2 py-1 text-xs text-neutral-600"
                      >
                        <span>
                          Photo {i + 1} ({(f.size / 1024).toFixed(0)} KB)
                        </span>
                        <button
                          type="button"
                          onClick={() => removeFile(i)}
                          disabled={submitting}
                          className="font-medium text-red-600 disabled:opacity-40"
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}

            <textarea
              value={finalNote}
              onChange={(e) => setFinalNote(e.target.value)}
              rows={2}
              placeholder={
                isCameraDisabled
                  ? "Required: Describe what fix was completed"
                  : "Final work notes (optional)"
              }
              className="rounded-md border border-neutral-300 px-2 py-1.5 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
            />

            {uploadProgress && (
              <p className="flex items-center gap-1.5 text-xs text-neutral-500">
                <ButtonSpinner className="border-neutral-300 border-t-blue-600" /> {uploadProgress}
              </p>
            )}

            <button
              onClick={handleFinish}
              disabled={submitting || compressing || !canFinish}
              className="flex w-fit items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting && <ButtonSpinner />}
              Submit for verification
            </button>
          </div>
        </>
      )}

      {currentStatus === "waiting_for_verification" && (
        <div className="rounded-xl border border-blue-200 bg-blue-50/80 p-4 text-sm text-blue-900 font-medium">
          ✓ Task submitted — waiting on admin verification.
        </div>
      )}
      {currentStatus === "completed" && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-4 text-sm text-emerald-900 font-medium">
          ✓ This task is completed. Nice work.
        </div>
      )}
    </div>
  );
}
