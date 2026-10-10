import { createAdminClient } from "@/lib/supabase/admin";
import { Mail, Clock, CheckCircle2, Circle, Reply } from "lucide-react";
import { MarkReadButton, ReplyForm } from "./InquiryActions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Inquiry = {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: string;
  reply: string | null;
  replied_at: string | null;
  created_at: string;
};

function StatusBadge({ status }: { status: string }) {
  if (status === "replied")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
        <CheckCircle2 className="h-3 w-3" /> Replied
      </span>
    );
  if (status === "read")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-semibold text-neutral-600">
        Read
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">
      <Circle className="h-2 w-2 fill-blue-500 text-blue-500" /> New
    </span>
  );
}

export default async function InquiriesPage() {
  const admin = createAdminClient();
  const { data: inquiries } = await admin
    .from("contact_submissions")
    .select("id, name, email, subject, message, status, reply, replied_at, created_at")
    .order("created_at", { ascending: false });

  const unread = (inquiries ?? []).filter((i) => i.status === "pending").length;

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Inquiries</h1>
          <p className="text-sm text-neutral-500 mt-0.5">
            Landing page contact form submissions
          </p>
        </div>
        {unread > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700">
            <Circle className="h-2 w-2 fill-red-500 text-red-500" />
            {unread} unread
          </span>
        )}
      </div>

      {/* Empty state */}
      {(!inquiries || inquiries.length === 0) && (
        <div className="rounded-xl border border-dashed border-neutral-300 bg-white p-12 text-center text-neutral-400">
          <Mail className="h-8 w-8 mx-auto mb-3 opacity-40" />
          <p className="font-medium">No inquiries yet</p>
          <p className="text-sm mt-1">Contact form submissions will appear here.</p>
        </div>
      )}

      {/* Inquiry cards */}
      <div className="flex flex-col gap-4">
        {(inquiries ?? []).map((inq: Inquiry) => (
          <div
            key={inq.id}
            className={`rounded-xl border bg-white p-5 shadow-sm transition ${
              inq.status === "pending" ? "border-blue-200" : "border-neutral-200"
            }`}
          >
            {/* Card header */}
            <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-neutral-900 text-sm">{inq.name}</p>
                  <StatusBadge status={inq.status} />
                </div>
                <a
                  href={`mailto:${inq.email}`}
                  className="text-xs text-blue-600 hover:underline"
                >
                  {inq.email}
                </a>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-neutral-400">
                <Clock className="h-3.5 w-3.5" />
                {new Date(inq.created_at).toLocaleString("en-IN")}
              </div>
            </div>

            {/* Subject + message */}
            <p className="text-sm font-semibold text-neutral-800 mb-1">{inq.subject}</p>
            <p className="text-sm text-neutral-600 whitespace-pre-wrap leading-relaxed">
              {inq.message}
            </p>

            {/* Existing reply */}
            {inq.reply && (
              <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
                <p className="text-xs font-semibold text-emerald-700 mb-1 flex items-center gap-1">
                  <Reply className="h-3.5 w-3.5" /> Internal note
                  {inq.replied_at
                    ? ` · ${new Date(inq.replied_at).toLocaleString("en-IN")}`
                    : ""}
                </p>
                <p className="whitespace-pre-wrap">{inq.reply}</p>
              </div>
            )}

            {/* Actions */}
            <div className="mt-4 flex flex-wrap items-start gap-3">
              {inq.status === "pending" && <MarkReadButton id={inq.id} />}
              <ReplyForm id={inq.id} />
              <a
                href={`mailto:${inq.email}?subject=Re: ${encodeURIComponent(inq.subject)}`}
                className="inline-flex items-center gap-1.5 rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-neutral-800 transition"
              >
                <Mail className="h-3.5 w-3.5" /> Reply via Email
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
