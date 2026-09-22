"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ButtonSpinner } from "@/app/components/Spinner";
import { startProcessing, addProgressUpdate, finishTask } from "./actions";
import { compressImage } from "@/lib/compressImage";

const MAX_BYTES = 8 * 1024 * 1024;
const MAX_FILES = 5;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export default function TaskActions({
  complaintId,
  status,
}: {
  complaintId: string;
  status: string;
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

  async function handleFiles(selected: FileList | null) {
    if (!selected || selected.length === 0) return;
    const arr = Array.from(selected);
    if (files.length + arr.length > MAX_FILES) {
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
    setCompressing(true);
    try {
      const compressed = await Promise.all(arr.map((f) => compressImage(f)));
      setFiles((prev) => [...prev, ...compressed]);
    } finally {
      setCompressing(false);
    }
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  function handleStart() {
    startTransition(async () => {
      setError(null);
      const result = await startProcessing(complaintId);
      if (result.error) setError(result.error);
      else router.refresh();
    });
  }

  function handleAddNote() {
    if (!note.trim()) return;
    startTransition(async () => {
      setError(null);
      const result = await addProgressUpdate(complaintId, note);
      if (result.error) setError(result.error);
      else {
        setNote("");
        router.refresh();
      }
    });
  }

  async function handleFinish() {
    if (files.length === 0) {
      setError("Add at least one after-photo before finishing.");
      return;
    }
    setError(null);
    startTransition(async () => {
      setUploadProgress(`Uploading 0/${files.length}…`);
      let doneCount = 0;
      const results = await Promise.all(
        files.map(async (file, i) => {
          const fd = new FormData();
          fd.append("file", file);
          fd.append("complaint_id", complaintId);
          fd.append("media_type", "after");
          const res = await fetch("/api/complaints/media", { method: "POST", body: fd });
          doneCount += 1;
          setUploadProgress(`Uploading ${doneCount}/${files.length}…`);
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
        return;
      }
      const result = await finishTask(complaintId, finalNote);
      if (result.error) setError(result.error);
      else router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {error && <p className="text-sm text-red-600">{error}</p>}

      {(status === "assigned" || status === "reopened") && (
        <button
          onClick={handleStart}
          disabled={pending}
          className="flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 disabled:opacity-50"
        >
          {pending && <ButtonSpinner />}
          Start Processing
        </button>
      )}

      {status === "processing" && (
        <>
          <div className="flex flex-col gap-2 rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-neutral-800">Add a progress update</h3>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="What have you done so far?"
              className="rounded-md border border-neutral-300 px-2 py-1.5 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
            <button
              onClick={handleAddNote}
              disabled={pending || !note.trim()}
              className="flex w-fit items-center gap-2 rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-40"
            >
              {pending && <ButtonSpinner className="border-neutral-300 border-t-neutral-600" />}
              Post update
            </button>
          </div>

          <div className="flex flex-col gap-2 rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-neutral-800">Finish task</h3>
            <input
              key={files.length}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              capture="environment"
              disabled={compressing || files.length >= MAX_FILES}
              onChange={(e) => handleFiles(e.target.files)}
              className="text-sm"
            />
            {fileError && <p className="text-xs text-red-600">{fileError}</p>}
            {compressing && (
              <p className="flex items-center gap-1.5 text-xs text-neutral-500">
                <ButtonSpinner className="border-neutral-300 border-t-blue-600" /> Compressing photo…
              </p>
            )}
            {files.length > 0 && (
              <ul className="flex flex-col gap-1">
                {files.map((f, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between rounded-md border border-neutral-200 bg-neutral-50 px-2 py-1 text-xs text-neutral-600"
                  >
                    <span>Photo {i + 1} ({(f.size / 1024).toFixed(0)} KB)</span>
                    <button type="button" onClick={() => removeFile(i)} className="font-medium text-red-600">
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <textarea
              value={finalNote}
              onChange={(e) => setFinalNote(e.target.value)}
              rows={2}
              placeholder="Final work notes (optional)"
              className="rounded-md border border-neutral-300 px-2 py-1.5 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
            {uploadProgress && (
              <p className="flex items-center gap-1.5 text-xs text-neutral-500">
                <ButtonSpinner className="border-neutral-300 border-t-blue-600" /> {uploadProgress}
              </p>
            )}
            <button
              onClick={handleFinish}
              disabled={pending || compressing || files.length === 0}
              className="flex w-fit items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 disabled:opacity-50"
            >
              {pending && <ButtonSpinner />}
              Submit for verification
            </button>
          </div>
        </>
      )}

      {status === "waiting_for_verification" && (
        <p className="text-sm text-neutral-500">Submitted — waiting on admin verification.</p>
      )}
      {status === "completed" && (
        <p className="text-sm text-green-700">This task is completed. Nice work.</p>
      )}
    </div>
  );
}
