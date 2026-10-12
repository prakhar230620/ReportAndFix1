"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Reply } from "lucide-react";
import { ButtonSpinner } from "@/app/components/Spinner";
import { markInquiryRead, replyToInquiry } from "./actions";

export function MarkReadButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <button
      onClick={() =>
        startTransition(async () => {
          await markInquiryRead(id);
          router.refresh();
        })
      }
      disabled={pending}
      className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50 transition disabled:opacity-50"
    >
      {pending ? <ButtonSpinner /> : "Mark as read"}
    </button>
  );
}

export function ReplyForm({ id }: { id: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reply, setReply] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit() {
    if (!reply.trim()) return;
    setError(null);
    startTransition(async () => {
      const res = await replyToInquiry(id, reply);
      if ((res as any)?.error) {
        setError((res as any).error);
      } else {
        setReply("");
        setOpen(false);
        router.refresh();
      }
    });
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition"
      >
        <Reply className="h-3.5 w-3.5" /> Add Note
      </button>
    );
  }

  return (
    <div className="flex-1 flex flex-col gap-2 mt-2 w-full">
      <textarea
        value={reply}
        onChange={(e) => setReply(e.target.value)}
        rows={2}
        autoFocus
        placeholder="Internal reply note (not sent by email)…"
        className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-xs focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex items-center gap-2">
        <button
          onClick={handleSubmit}
          disabled={pending || !reply.trim()}
          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 transition disabled:opacity-50"
        >
          {pending ? <ButtonSpinner /> : <Reply className="h-3.5 w-3.5" />}
          Save Note
        </button>
        <button
          onClick={() => { setOpen(false); setReply(""); }}
          className="text-xs text-neutral-500 hover:text-neutral-700"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
