import { getActiveBroadcasts, BroadcastPriority } from "@/lib/broadcasts";
import {
  Radio,
  AlertTriangle,
  AlertOctagon,
  Wrench,
  Megaphone,
  Info,
  ShieldCheck,
} from "lucide-react";

interface Props {
  collegeId: string | null | undefined;
  userRole?: string;
  collegeName?: string;
  className?: string;
}

const PRIORITY_STYLES: Record<
  BroadcastPriority,
  { icon: any; label: string; badge: string; bg: string; border: string; text: string; glow: string }
> = {
  urgent: {
    icon: AlertOctagon,
    label: "Urgent Alert",
    badge: "bg-red-600 text-white",
    bg: "bg-gradient-to-r from-red-50 via-rose-50 to-red-50/50",
    border: "border-red-200",
    text: "text-red-950",
    glow: "shadow-red-500/10",
  },
  warning: {
    icon: AlertTriangle,
    label: "Warning Notice",
    badge: "bg-amber-600 text-white",
    bg: "bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50/50",
    border: "border-amber-200",
    text: "text-amber-950",
    glow: "shadow-amber-500/10",
  },
  maintenance: {
    icon: Wrench,
    label: "Maintenance",
    badge: "bg-purple-600 text-white",
    bg: "bg-gradient-to-r from-purple-50 via-indigo-50 to-purple-50/50",
    border: "border-purple-200",
    text: "text-purple-950",
    glow: "shadow-purple-500/10",
  },
  announcement: {
    icon: Megaphone,
    label: "Announcement",
    badge: "bg-blue-600 text-white",
    bg: "bg-gradient-to-r from-blue-50 via-indigo-50/30 to-blue-50/50",
    border: "border-blue-200",
    text: "text-blue-950",
    glow: "shadow-blue-500/10",
  },
  info: {
    icon: Info,
    label: "Notice",
    badge: "bg-neutral-800 text-white",
    bg: "bg-gradient-to-r from-neutral-50 to-neutral-100/50",
    border: "border-neutral-200",
    text: "text-neutral-900",
    glow: "shadow-neutral-500/10",
  },
};



export default async function TodaysBroadcasts({
  collegeId,
  userRole,
  collegeName,
  className = "",
}: Props) {
  if (!collegeId) return null;

  // Strict cross-org filter: only broadcasts belonging to this collegeId
  const broadcasts = await getActiveBroadcasts(collegeId, userRole);

  if (!broadcasts || broadcasts.length === 0) {
    return null;
  }

  return (
    <section aria-label="Today's Broadcasts" className={`flex flex-col gap-3.5 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-600" />
          </div>
          <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-800 flex items-center gap-1.5">
            Today's Broadcasts
          </h2>
        </div>
        <span className="text-[11px] font-semibold text-neutral-500">
          {broadcasts.length} Active {broadcasts.length === 1 ? "Notice" : "Notices"}
        </span>
      </div>

      <div className="flex flex-col gap-3">
        {broadcasts.map((b) => {
          const style = PRIORITY_STYLES[b.priority] || PRIORITY_STYLES.info;
          const Icon = style.icon;
          return (
            <div
              key={b.id}
              className={`rounded-2xl border p-4.5 sm:p-5 shadow-xs transition-all relative overflow-hidden ${style.border} ${style.bg} ${style.glow}`}
            >
              {/* Top metadata row */}
              <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide ${style.badge}`}>
                    <Icon className="h-3 w-3" />
                    {style.label}
                  </span>
                </div>

                <span className="text-[10px] text-neutral-400 font-medium">
                  {new Date(b.created_at).toLocaleTimeString("en-IN", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>

              {/* Broadcast Content */}
              <h3 className={`text-sm sm:text-base font-bold ${style.text}`}>
                {b.title}
              </h3>

              <div className="mt-1.5 text-xs text-neutral-700 whitespace-pre-wrap leading-relaxed">
                {b.message}
              </div>

              {/* Footer */}
              <div className="mt-3.5 pt-2.5 border-t border-black/5 flex items-center justify-between text-[10px] text-neutral-500 font-medium">
                <span className="flex items-center gap-1">
                  <ShieldCheck className="h-3 w-3 text-neutral-400" />
                  Official {collegeName || "Organisation"} Notice
                </span>
                {b.profiles?.display_name && (
                  <span className="text-neutral-400">
                    By {b.profiles.display_name}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
