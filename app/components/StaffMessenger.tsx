"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import {
  MessageSquare,
  Send,
  AlertCircle,
  Clock,
  Tag,
  Trash2,
  Lock,
  Sparkles,
  ExternalLink,
} from "lucide-react";
import { ButtonSpinner } from "./Spinner";

type StaffMessage = {
  id: string;
  college_id: string;
  body: string;
  complaint_id: string | null;
  tagged_user_ids: string[];
  expires_at: string;
  created_at: string;
  sender?: {
    id: string;
    display_name: string;
    role: "college_admin" | "dept_admin" | "worker" | "super_admin";
  };
  complaint?: {
    id: string;
    public_id: string;
    title: string;
    status: string;
  };
};

export default function StaffMessenger({
  collegeId,
  userRole,
  userId,
  initialComplaintId,
  initialComplaintPublicId,
  initialLocked = false,
}: {
  collegeId: string;
  userRole: string;
  userId: string;
  initialComplaintId?: string;
  initialComplaintPublicId?: string;
  initialLocked?: boolean;
}) {
  const [messages, setMessages] = useState<StaffMessage[]>([]);
  const [loading, setLoading] = useState(!initialLocked);
  const [sending, setSending] = useState(false);
  const [inputText, setInputText] = useState(
    initialComplaintPublicId ? `#${initialComplaintPublicId} ` : ""
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [upgradeRequired, setUpgradeRequired] = useState(initialLocked);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchMessages = async () => {
    if (initialLocked) return;
    try {
      const res = await fetch("/api/messages");
      if (!res.ok) {
        const err = await res.json();
        if (res.status === 403 && err.upgradeRequired) {
          setUpgradeRequired(true);
        } else {
          setErrorMsg(err.error || "Failed to load messages");
        }
        setLoading(false);
        return;
      }
      const data = await res.json();
      setMessages(data.messages || []);
      setUpgradeRequired(false);
    } catch {
      setErrorMsg("Network error connecting to message service.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialLocked) return;
    fetchMessages();
    const interval = setInterval(fetchMessages, 10000); // 10s poll for active chat
    return () => clearInterval(interval);
  }, [initialLocked]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || sending) return;

    setSending(true);
    setErrorMsg(null);

    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          body: inputText.trim(),
          complaintId: initialComplaintId,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        setErrorMsg(err.error || "Failed to send message.");
        if (err.upgradeRequired) setUpgradeRequired(true);
        return;
      }

      const { message } = await res.json();
      setMessages((prev) => [...prev, message]);
      setInputText("");
    } catch {
      setErrorMsg("Failed to send message.");
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async (messageId: string) => {
    try {
      const res = await fetch(`/api/messages?id=${messageId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setMessages((prev) => prev.filter((m) => m.id !== messageId));
      }
    } catch {
      // ignore
    }
  };

  // Show loading skeleton first — this prevents the "Locked" box flashing
  // briefly while the API call resolves for users who DO have messaging access.
  if (loading) {
    return (
      <div className="flex flex-col h-[400px] rounded-2xl border border-neutral-200 bg-white p-8 items-center justify-center text-neutral-400 text-xs gap-2 shadow-xs">
        <div className="h-4 w-4 rounded-full border-2 border-neutral-300 border-t-neutral-800 animate-spin" />
        <span>Loading messages...</span>
      </div>
    );
  }

  if (upgradeRequired) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-8 text-center shadow-xs">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-600 mb-4">
          <Lock className="h-6 w-6" />
        </div>
        <h3 className="text-lg font-bold text-neutral-900">
          Staff In-App Messaging Locked
        </h3>
        <p className="mt-2 text-sm text-neutral-600 max-w-md mx-auto">
          Internal operations messaging with auto-purging 24h retention, complaint tagging, and worker notifications is available on <strong>Professional</strong> and <strong>Enterprise</strong> plans.
        </p>
        {userRole === "college_admin" && (
          <div className="mt-5">
            <Link
              href="/admin/billing"
              className="inline-flex items-center gap-1.5 rounded-xl bg-amber-600 px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-amber-700 transition"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Upgrade Plan in Billing →</span>
            </Link>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[600px] rounded-2xl border border-neutral-200 bg-white shadow-sm overflow-hidden">
      {/* Top Banner: Privacy & Auto-Purge Status */}
      <div className="flex items-center justify-between border-b border-neutral-200 bg-neutral-50 px-4 py-3 text-xs">
        <div className="flex items-center gap-2 text-neutral-700 font-semibold">
          <MessageSquare className="h-4 w-4 text-blue-600" />
          <span>Staff Operations Backchannel</span>
        </div>
        <div className="flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
          <Clock className="h-3 w-3 text-emerald-600" />
          <span>24-Hour Auto-Purge Active</span>
        </div>
      </div>

      {/* Message Feed */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-neutral-50/40">
        {loading ? (
          <div className="flex h-full items-center justify-center text-xs text-neutral-400">
            Loading team messages...
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center p-6 text-neutral-400">
            <MessageSquare className="h-8 w-8 text-neutral-300 mb-2" />
            <p className="text-sm font-medium text-neutral-600">No active messages in the last 24 hours</p>
            <p className="text-xs text-neutral-400 max-w-xs mt-1">
              Admins and Workers can coordinate repairs, tag complaints (#CMP-...), and dispatch tasks here.
            </p>
          </div>
        ) : (
          messages.map((m) => {
            const isMe = m.sender?.id === userId;
            const senderRole = m.sender?.role;
            const roleBadgeColor =
              senderRole === "college_admin"
                ? "bg-purple-100 text-purple-800 border-purple-200"
                : senderRole === "dept_admin"
                ? "bg-blue-100 text-blue-800 border-blue-200"
                : senderRole === "worker"
                ? "bg-amber-100 text-amber-800 border-amber-200"
                : "bg-neutral-100 text-neutral-800 border-neutral-200";

            const roleLabel =
              senderRole === "college_admin"
                ? "College Admin"
                : senderRole === "dept_admin"
                ? "Dept Admin"
                : senderRole === "worker"
                ? "Worker"
                : "Staff";

            return (
              <div
                key={m.id}
                className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
              >
                <div className="flex items-center gap-2 mb-1 px-1 text-[11px] text-neutral-400">
                  <span className="font-semibold text-neutral-700">
                    {isMe ? "You" : m.sender?.display_name || "Staff"}
                  </span>
                  <span
                    className={`rounded-sm border px-1.5 py-0.2 text-[9px] font-bold uppercase ${roleBadgeColor}`}
                  >
                    {roleLabel}
                  </span>
                  <span>
                    {new Date(m.created_at).toLocaleTimeString("en-IN", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  {(userRole === "college_admin" || userRole === "super_admin") && (
                    <button
                      onClick={() => handleDelete(m.id)}
                      className="text-neutral-400 hover:text-red-600 transition"
                      title="Delete message"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>

                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-xs shadow-xs leading-relaxed ${
                    isMe
                      ? "bg-blue-600 text-white rounded-br-xs"
                      : "bg-white text-neutral-800 border border-neutral-200 rounded-bl-xs"
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words">{m.body}</p>

                  {/* Linked Complaint Tag Pill */}
                  {m.complaint && (
                    <div
                      className={`mt-2 inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-semibold border ${
                        isMe
                          ? "bg-blue-700/60 border-blue-400/40 text-blue-100"
                          : "bg-neutral-100 border-neutral-200 text-neutral-700"
                      }`}
                    >
                      <Tag className="h-3 w-3" />
                      <span>{m.complaint.public_id}</span>
                      <span className="opacity-75">· {m.complaint.title.slice(0, 24)}</span>
                      <Link
                        href={`/issues/${m.complaint.public_id}`}
                        target="_blank"
                        className="ml-1 hover:underline flex items-center"
                      >
                        <ExternalLink className="h-2.5 w-2.5" />
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Error Alert */}
      {errorMsg && (
        <div className="bg-red-50 px-4 py-2 text-xs text-red-600 border-t border-red-100 flex items-center gap-1.5">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Input Form */}
      <form
        onSubmit={handleSend}
        className="flex items-center gap-2 border-t border-neutral-200 bg-white p-3"
      >
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Message staff (tag #CMP-12345 or coordinate tasks)..."
          className="flex-1 rounded-xl border border-neutral-200 bg-neutral-50 px-3.5 py-2.5 text-xs text-neutral-900 placeholder-neutral-400 focus:border-blue-500 focus:bg-white focus:outline-hidden"
        />

        <button
          type="submit"
          disabled={sending || !inputText.trim()}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-blue-700 disabled:opacity-50 transition"
        >
          {sending ? (
            <ButtonSpinner />
          ) : (
            <>
              <span>Send</span>
              <Send className="h-3 w-3" />
            </>
          )}
        </button>
      </form>
    </div>
  );
}
