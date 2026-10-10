"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Radio,
  Send,
  Clock,
  AlertTriangle,
  AlertOctagon,
  Wrench,
  Info,
  Megaphone,
  Trash2,
  Users,
  CheckCircle2,
  Calendar,
  Sparkles,
  ShieldAlert,
} from "lucide-react";
import { Broadcast, BroadcastPriority } from "@/lib/broadcasts";
import { createBroadcast, deleteBroadcast } from "./actions";

interface Props {
  collegeName: string;
  initialActive: Broadcast[];
  initialExpired: Broadcast[];
  tableExists: boolean;
}

const PRESET_HOURS = [2, 6, 12, 24, 48, 72];

const PRIORITY_CONFIG: Record<
  BroadcastPriority,
  { label: string; icon: any; color: string; bg: string; border: string; badgeBg: string }
> = {
  urgent: {
    label: "Urgent Notice",
    icon: AlertOctagon,
    color: "text-red-700",
    bg: "bg-red-50/80",
    border: "border-red-200",
    badgeBg: "bg-red-600 text-white",
  },
  warning: {
    label: "Warning",
    icon: AlertTriangle,
    color: "text-amber-800",
    bg: "bg-amber-50/80",
    border: "border-amber-200",
    badgeBg: "bg-amber-600 text-white",
  },
  maintenance: {
    label: "Maintenance",
    icon: Wrench,
    color: "text-purple-800",
    bg: "bg-purple-50/80",
    border: "border-purple-200",
    badgeBg: "bg-purple-600 text-white",
  },
  announcement: {
    label: "Announcement",
    icon: Megaphone,
    color: "text-blue-800",
    bg: "bg-blue-50/80",
    border: "border-blue-200",
    badgeBg: "bg-blue-600 text-white",
  },
  info: {
    label: "General Info",
    icon: Info,
    color: "text-neutral-800",
    bg: "bg-neutral-50",
    border: "border-neutral-200",
    badgeBg: "bg-neutral-800 text-white",
  },
};

export default function BroadcastsManagerClient({
  collegeName,
  initialActive,
  initialExpired,
  tableExists,
}: Props) {
  const router = useRouter();

  // Form State
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [priority, setPriority] = useState<BroadcastPriority>("announcement");
  const [durationHours, setDurationHours] = useState<number>(24);
  const [targetAudience, setTargetAudience] = useState<"all" | "staff" | "workers">("all");

  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Expiration preview calculation
  const expiresDate = new Date(Date.now() + durationHours * 60 * 60 * 1000);
  const formattedExpiry = expiresDate.toLocaleString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  async function handlePublish(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !message.trim()) {
      setFeedback({ type: "error", text: "Please enter both a title and message." });
      return;
    }

    setSubmitting(true);
    setFeedback(null);

    let targetRoles = ["all"];
    if (targetAudience === "staff") {
      targetRoles = ["dept_admin", "worker", "college_admin"];
    } else if (targetAudience === "workers") {
      targetRoles = ["worker"];
    }

    const res = await createBroadcast({
      title,
      message,
      priority,
      durationHours,
      targetRoles,
    });

    setSubmitting(false);

    if (res.ok) {
      setFeedback({ type: "success", text: "Broadcast published successfully across your organisation!" });
      setTitle("");
      setMessage("");
      router.refresh();
    } else {
      setFeedback({ type: "error", text: res.error || "Failed to publish broadcast." });
    }
  }

  async function handleDelete(broadcastId: string) {
    if (!confirm("Are you sure you want to delete and unpublish this broadcast?")) return;

    setDeletingId(broadcastId);
    const res = await deleteBroadcast(broadcastId);
    setDeletingId(null);

    if (res.ok) {
      setFeedback({ type: "success", text: "Broadcast removed." });
      router.refresh();
    } else {
      setFeedback({ type: "error", text: res.error || "Failed to remove broadcast." });
    }
  }

  function getTimeRemaining(expiresAt: string) {
    const diffMs = new Date(expiresAt).getTime() - Date.now();
    if (diffMs <= 0) return "Expired";
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 0) return `${hours}h ${mins}m left`;
    return `${mins}m left`;
  }

  return (
    <div className="flex flex-col gap-8 pb-12">
      {/* Table Warning Banner if migration has not been applied yet */}
      {!tableExists && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
            <div>
              <h3 className="font-bold text-amber-900 text-sm">Database Setup Required</h3>
              <p className="text-xs text-amber-700 mt-1 leading-relaxed">
                The <code className="bg-amber-100 px-1 py-0.5 rounded font-mono">broadcasts</code> table needs to be created in your Supabase database.
                Run the script in <code className="bg-amber-100 px-1 py-0.5 rounded font-mono">supabase/migrations/20261010_add_broadcasts.sql</code> in the Supabase SQL editor.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Header Banner */}
      <div className="rounded-2xl border border-neutral-200 bg-gradient-to-br from-white via-neutral-50/50 to-blue-50/30 p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 mb-2">
              <Radio className="h-3.5 w-3.5 animate-pulse text-blue-600" />
              Organisation Broadcast Hub
            </div>
            <h1 className="text-2xl font-black text-neutral-900 tracking-tight">
              Broadcasts & Announcements
            </h1>
            <p className="text-xs text-neutral-600 mt-1 max-w-xl leading-relaxed">
              Publish real-time announcements, operational notices, and maintenance alerts across {collegeName}.
              Broadcasts automatically appear in <strong>"Today's Broadcasts"</strong> for your team and expire after the duration you select (up to 72 hours).
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-xl border border-neutral-200 bg-white px-3.5 py-2 text-xs font-bold text-neutral-700 shadow-2xs">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              {initialActive.length} Active {initialActive.length === 1 ? "Broadcast" : "Broadcasts"}
            </span>
          </div>
        </div>
      </div>

      {feedback && (
        <div
          className={`rounded-xl border p-4 text-xs font-medium flex items-center justify-between ${
            feedback.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === "success" ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
            {feedback.text}
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="text-xs font-bold opacity-60 hover:opacity-100"
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Grid: Broadcast Composer & Active Broadcasts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Composer Form */}
        <div className="lg:col-span-7">
          <form
            onSubmit={handlePublish}
            className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm flex flex-col gap-5"
          >
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <h2 className="text-base font-bold text-neutral-900 flex items-center gap-2">
                <Send className="h-4 w-4 text-blue-600" />
                Compose New Broadcast
              </h2>
              <span className="text-[11px] font-medium text-neutral-500">Max 72 hours</span>
            </div>

            {/* Title */}
            <div>
              <label className="block text-xs font-bold text-neutral-700 mb-1.5">
                Broadcast Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                maxLength={150}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Campus Power Outage Scheduled · Lab 3 Closed"
                className="w-full rounded-xl border border-neutral-300 px-3.5 py-2.5 text-sm font-medium text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none transition shadow-2xs"
              />
            </div>

            {/* Priority Selection */}
            <div>
              <label className="block text-xs font-bold text-neutral-700 mb-1.5">
                Priority & Tone
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {(Object.keys(PRIORITY_CONFIG) as BroadcastPriority[]).map((p) => {
                  const cfg = PRIORITY_CONFIG[p];
                  const Icon = cfg.icon;
                  const isSelected = priority === p;
                  return (
                    <button
                      type="button"
                      key={p}
                      onClick={() => setPriority(p)}
                      className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition text-left ${
                        isSelected
                          ? "border-neutral-900 bg-neutral-900 text-white shadow-xs"
                          : "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50"
                      }`}
                    >
                      <Icon className={`h-3.5 w-3.5 ${isSelected ? "text-white" : cfg.color}`} />
                      <span>{cfg.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Duration Selector (Max 72 Hours) */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-neutral-700 flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-neutral-500" />
                  Broadcast Duration: <span className="text-blue-600">{durationHours} hours</span>
                </label>
                <span className="text-[11px] text-neutral-500">
                  Expires {formattedExpiry}
                </span>
              </div>

              {/* Preset Chips */}
              <div className="flex flex-wrap gap-1.5 mb-2.5">
                {PRESET_HOURS.map((h) => (
                  <button
                    type="button"
                    key={h}
                    onClick={() => setDurationHours(h)}
                    className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                      durationHours === h
                        ? "bg-blue-600 text-white shadow-2xs"
                        : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                    }`}
                  >
                    {h}h {h === 24 ? "(1 day)" : h === 48 ? "(2 days)" : h === 72 ? "(3 days - Max)" : ""}
                  </button>
                ))}
              </div>

              {/* Slider for precision */}
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={1}
                  max={72}
                  step={1}
                  value={durationHours}
                  onChange={(e) => setDurationHours(Number(e.target.value))}
                  className="w-full h-1.5 bg-neutral-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
                <span className="text-xs font-mono font-bold text-neutral-600 w-10 text-right">
                  {durationHours}h
                </span>
              </div>
            </div>

            {/* Target Audience */}
            <div>
              <label className="block text-xs font-bold text-neutral-700 mb-1.5 flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-neutral-500" />
                Target Audience
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: "all", label: "All Members", sub: "Admins, staff & users" },
                  { id: "staff", label: "Staff Only", sub: "Depts & workers" },
                  { id: "workers", label: "Workers Only", sub: "Maintenance team" },
                ].map((aud) => (
                  <button
                    type="button"
                    key={aud.id}
                    onClick={() => setTargetAudience(aud.id as any)}
                    className={`flex flex-col text-left rounded-xl border p-2.5 transition ${
                      targetAudience === aud.id
                        ? "border-neutral-900 bg-neutral-900 text-white shadow-xs"
                        : "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50"
                    }`}
                  >
                    <span className="text-xs font-bold">{aud.label}</span>
                    <span className={`text-[10px] mt-0.5 ${targetAudience === aud.id ? "text-neutral-300" : "text-neutral-400"}`}>
                      {aud.sub}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Message Body */}
            <div>
              <label className="block text-xs font-bold text-neutral-700 mb-1.5">
                Message Content <span className="text-red-500">*</span>
              </label>
              <textarea
                required
                rows={4}
                maxLength={2500}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Provide detailed instructions, emergency guidelines, or updates for your institution..."
                className="w-full rounded-xl border border-neutral-300 p-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none transition shadow-2xs resize-y"
              />
              <div className="flex justify-between items-center text-[11px] text-neutral-400 mt-1">
                <span>Markdown & line breaks supported</span>
                <span>{message.length} / 2500</span>
              </div>
            </div>

            {/* Submit Action */}
            <div className="flex items-center justify-end gap-3 pt-2 border-t border-neutral-100">
              <button
                type="submit"
                disabled={submitting || !title.trim() || !message.trim()}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-2.5 text-xs font-bold text-white shadow-md shadow-blue-500/20 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 transition"
              >
                {submitting ? (
                  <>
                    <span className="h-3 w-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Publishing...</span>
                  </>
                ) : (
                  <>
                    <Radio className="h-3.5 w-3.5" />
                    <span>Broadcast Now</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Right Column: Live Preview & Active Broadcasts */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          {/* Live Composer Preview */}
          <div className="rounded-2xl border border-neutral-200 bg-neutral-50/60 p-5 shadow-2xs">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-neutral-500 flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                Live Preview (What Users See)
              </span>
              <span className="text-[10px] bg-white border border-neutral-200 text-neutral-600 px-2 py-0.5 rounded-full font-medium">
                Today's Broadcast
              </span>
            </div>

            <div className={`rounded-xl border p-4 shadow-sm transition-all ${PRIORITY_CONFIG[priority].border} ${PRIORITY_CONFIG[priority].bg}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${PRIORITY_CONFIG[priority].badgeBg}`}>
                    {PRIORITY_CONFIG[priority].label}
                  </span>
                  <span className="text-[11px] font-semibold text-neutral-500 flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {durationHours}h active
                  </span>
                </div>
                <span className="text-[10px] text-neutral-400 font-medium">Just now</span>
              </div>

              <h4 className="text-sm font-bold text-neutral-900 mt-2">
                {title.trim() || "Your Announcement Title Here"}
              </h4>

              <p className="text-xs text-neutral-700 mt-1 whitespace-pre-wrap leading-relaxed">
                {message.trim() || "The description and information message will appear here in the live broadcast banner across all roles."}
              </p>

              <div className="mt-3 pt-2.5 border-t border-black/5 flex items-center justify-between text-[10px] text-neutral-500 font-medium">
                <span>By {collegeName} Administration</span>
                <span className="text-neutral-400">Target: {targetAudience.toUpperCase()}</span>
              </div>
            </div>
          </div>

          {/* Active Broadcasts List */}
          <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-bold text-neutral-900 mb-3 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Radio className="h-4 w-4 text-emerald-600" />
                Currently Active Broadcasts ({initialActive.length})
              </span>
            </h3>

            {initialActive.length === 0 ? (
              <div className="rounded-xl border border-dashed border-neutral-200 p-6 text-center text-xs text-neutral-500">
                No active broadcasts right now. Fill the form to broadcast a message.
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {initialActive.map((b) => {
                  const cfg = PRIORITY_CONFIG[b.priority] || PRIORITY_CONFIG.info;
                  const isDeleting = deletingId === b.id;
                  return (
                    <div
                      key={b.id}
                      className={`rounded-xl border p-3.5 transition-all relative ${cfg.border} ${cfg.bg}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${cfg.badgeBg}`}>
                            {cfg.label}
                          </span>
                          <span className="text-[11px] font-semibold text-neutral-600 flex items-center gap-1">
                            <Clock className="h-3 w-3 text-neutral-400" />
                            {getTimeRemaining(b.expires_at)}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleDelete(b.id)}
                          disabled={isDeleting}
                          title="Delete Broadcast"
                          className="rounded-lg p-1 text-neutral-400 hover:text-red-600 hover:bg-red-50 transition"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      <h4 className="text-xs font-bold text-neutral-900 mt-1.5">
                        {b.title}
                      </h4>
                      <p className="text-xs text-neutral-700 mt-1 whitespace-pre-wrap leading-relaxed line-clamp-3">
                        {b.message}
                      </p>

                      <div className="mt-2.5 pt-2 border-t border-black/5 flex items-center justify-between text-[10px] text-neutral-500">
                        <span>
                          Created {new Date(b.created_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                        <span className="font-mono text-neutral-400">
                          {b.target_roles?.join(", ") || "all"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Expired / History Broadcasts (Collapsible) */}
          {initialExpired.length > 0 && (
            <details className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm group">
              <summary className="cursor-pointer text-xs font-bold text-neutral-600 flex items-center justify-between">
                <span>Past / Expired Broadcasts ({initialExpired.length})</span>
                <span className="text-neutral-400 group-open:rotate-180 transition-transform">▼</span>
              </summary>
              <div className="flex flex-col gap-2.5 mt-3 pt-3 border-t border-neutral-100">
                {initialExpired.slice(0, 10).map((b) => (
                  <div key={b.id} className="rounded-lg border border-neutral-100 bg-neutral-50/50 p-2.5 text-xs">
                    <div className="flex items-center justify-between text-[11px] text-neutral-500 mb-1">
                      <span className="font-bold text-neutral-800">{b.title}</span>
                      <span>Expired</span>
                    </div>
                    <p className="text-[11px] text-neutral-600 line-clamp-1">{b.message}</p>
                    <div className="text-[10px] text-neutral-400 mt-1">
                      {new Date(b.created_at).toLocaleDateString("en-IN")}
                    </div>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      </div>
    </div>
  );
}
