import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getMediaUrl } from "@/lib/media";
import ComplaintMediaGallery from "@/app/admin/queue/ComplaintMediaGallery";
import { StatusBadge, PriorityBadge, MarkAsRead } from "@/app/components/StatusBadge";

export const dynamic = "force-dynamic";
export const revalidate = 0;
import DeptAssignForm from "../DeptAssignForm";
import DeptVerifyActions from "../DeptVerifyActions";
import {
  MapPin,
  Tag,
  Clock,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  UserCheck,
  Building2,
  ShieldAlert,
} from "lucide-react";

export default async function DeptAdminComplaintDetailPage({
  params,
}: {
  params: Promise<{ publicId: string }>;
}) {
  const { publicId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, college_id, department_id, departments(name)")
    .eq("id", user.id)
    .single();

  if (
    !profile ||
    (profile.role !== "dept_admin" &&
      profile.role !== "college_admin" &&
      profile.role !== "super_admin")
  ) {
    redirect("/");
  }

  const deptId = profile.department_id;
  const collegeId = profile.college_id;
  const deptName = (profile.departments as any)?.name ?? "Department";

  const adminClient = createAdminClient();

  let complaintQuery = adminClient
    .from("complaints")
    .select(
      "id, public_id, title, description, status, priority, is_anonymous, created_at, completed_at, resolution_seconds, assigned_worker_id, assigned_department_id, location_id, categories(name), locations(name)"
    )
    .eq("public_id", publicId);

  // If dept_admin, restrict to their department (or allow org admins to supervise)
  if (profile.role === "dept_admin" && deptId) {
    complaintQuery = complaintQuery.eq("assigned_department_id", deptId);
  } else if (collegeId) {
    complaintQuery = complaintQuery.eq("college_id", collegeId);
  }

  const { data: complaint } = await complaintQuery.maybeSingle();

  if (!complaint) {
    return (
      <div className="rounded-xl border border-neutral-200 bg-white p-8 text-center text-neutral-500 shadow-sm">
        <AlertTriangle className="mx-auto mb-2 h-8 w-8 text-amber-500" />
        <h2 className="text-base font-semibold text-neutral-800">Complaint Not Found</h2>
        <p className="mt-1 text-sm">
          This issue may not be assigned to your department or the reference ID is invalid.
        </p>
        <Link
          href="/dept-admin/queue"
          className="mt-4 inline-block text-sm font-medium text-blue-600 hover:text-blue-700"
        >
          ← Back to Department Queue
        </Link>
      </div>
    );
  }

  const [
    { data: statusHistory },
    { data: progressUpdates },
    { data: auditEntries },
    { data: media },
    { data: workers },
    { data: locationPath },
  ] = await Promise.all([
    adminClient
      .from("complaint_status_history")
      .select("previous_status, new_status, note, created_at")
      .eq("complaint_id", complaint.id)
      .order("created_at", { ascending: true }),
    adminClient
      .from("complaint_progress_updates")
      .select("note, created_at, worker_id")
      .eq("complaint_id", complaint.id)
      .order("created_at", { ascending: true }),
    adminClient
      .from("audit_log")
      .select("action, metadata, created_at, actor_id")
      .eq("entity_id", complaint.id)
      .order("created_at", { ascending: true }),
    adminClient
      .from("complaint_media")
      .select("storage_path, media_type, created_at")
      .eq("complaint_id", complaint.id)
      .order("created_at", { ascending: true }),
    adminClient
      .from("profiles")
      .select("id, display_name")
      .eq("college_id", collegeId!)
      .eq("department_id", complaint.assigned_department_id ?? deptId!)
      .eq("role", "worker"),
    adminClient.rpc("location_full_path" as never, {
      p_location_id: complaint.location_id,
    } as never),
  ]);

  const mediaWithUrls = (media ?? []).map((m) => ({
    ...m,
    url: getMediaUrl(m.storage_path),
  }));

  type TimelineEntry = { time: string; label: string; note?: string | null };
  const timeline: TimelineEntry[] = [
    { time: complaint.created_at, label: "Reported" },
    ...(statusHistory ?? []).map((h) => ({
      time: h.created_at,
      label: `${h.previous_status} → ${h.new_status}`,
      note: h.note,
    })),
    ...(progressUpdates ?? []).map((p) => ({
      time: p.created_at,
      label: "Worker progress update",
      note: p.note,
    })),
    ...(auditEntries ?? []).map((a) => ({
      time: a.created_at,
      label: `Audit: ${a.action}`,
      note: JSON.stringify(a.metadata),
    })),
  ].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

  const categoryName = (complaint as any).categories?.name || "General";
  const locationFullString =
    (locationPath as unknown as string) ?? (complaint as any).locations?.name ?? "Unknown Location";
  const workerObj = (workers ?? []).find((w) => w.id === complaint.assigned_worker_id);

  const hasDeptVerified = (auditEntries ?? []).some((a) => a.action === "dept_verified");

  // Status badge styling
  const statusStyles: Record<string, { bg: string; text: string; label: string }> = {
    submitted: { bg: "bg-blue-50 border-blue-200", text: "text-blue-700", label: "Submitted" },
    assigned: { bg: "bg-purple-50 border-purple-200", text: "text-purple-700", label: "Assigned" },
    processing: { bg: "bg-amber-50 border-amber-200", text: "text-amber-700", label: "In Progress" },
    waiting_for_verification: {
      bg: "bg-indigo-50 border-indigo-200",
      text: "text-indigo-700",
      label: "Waiting for Verification",
    },
    completed: { bg: "bg-emerald-50 border-emerald-200", text: "text-emerald-700", label: "Completed" },
    reopened: { bg: "bg-rose-50 border-rose-200", text: "text-rose-700", label: "Reopened" },
  };

  const statusInfo = statusStyles[complaint.status] || {
    bg: "bg-neutral-100 border-neutral-200",
    text: "text-neutral-700",
    label: complaint.status,
  };

  return (
    <div className="flex flex-col gap-6 max-w-4xl pb-16">
      <MarkAsRead complaintId={complaint.id} />
      {/* Top Header Card */}
      <div className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-100 pb-3">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-semibold text-neutral-900 bg-neutral-100 px-2.5 py-1 rounded-md border border-neutral-200">
              {complaint.public_id}
            </span>
            <StatusBadge status={complaint.status} />
            <PriorityBadge priority={complaint.priority} />
          </div>

          <div className="flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1 text-neutral-500">
              <Clock className="h-3.5 w-3.5" />
              {new Date(complaint.created_at).toLocaleString()}
            </span>
            <Link
              href={`/issues/${complaint.public_id}`}
              target="_blank"
              className="inline-flex items-center gap-1 font-medium text-blue-600 hover:text-blue-700"
            >
              Public View <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>

        {/* Title and Description */}
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">{complaint.title}</h1>
          <p className="mt-2 text-sm text-neutral-700 leading-relaxed whitespace-pre-wrap">
            {complaint.description || (
              <span className="italic text-neutral-400">No additional description provided.</span>
            )}
          </p>
        </div>

        {/* Location & Metadata Bar */}
        <div className="flex flex-wrap items-center gap-3 pt-2 text-xs text-neutral-600 border-t border-neutral-100">
          <div className="flex items-center gap-1.5 font-medium text-neutral-800 bg-neutral-50 px-2.5 py-1.5 rounded-md border border-neutral-200">
            <MapPin className="h-4 w-4 text-rose-500 shrink-0" />
            <span>{locationFullString}</span>
          </div>

          <div className="flex items-center gap-1.5 bg-neutral-50 px-2.5 py-1.5 rounded-md border border-neutral-200">
            <Tag className="h-3.5 w-3.5 text-neutral-500 shrink-0" />
            <span className="font-medium text-neutral-700">{categoryName}</span>
          </div>

          <div className="flex items-center gap-1.5 bg-neutral-50 px-2.5 py-1.5 rounded-md border border-neutral-200">
            <Building2 className="h-3.5 w-3.5 text-neutral-500 shrink-0" />
            <span className="text-neutral-700">{deptName}</span>
          </div>

          {workerObj?.display_name && (
            <div className="flex items-center gap-1.5 bg-neutral-50 px-2.5 py-1.5 rounded-md border border-neutral-200">
              <UserCheck className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
              <span className="text-neutral-700">
                Assigned: <strong className="font-medium">{workerObj.display_name}</strong>
              </span>
            </div>
          )}

          <div className="flex items-center gap-1.5 ml-auto">
            {complaint.is_anonymous ? (
              <span className="inline-flex items-center gap-1 rounded-md bg-neutral-100 px-2 py-1 text-xs text-neutral-600 border border-neutral-200">
                <ShieldAlert className="h-3.5 w-3.5 text-neutral-500" />
                Anonymous reporter
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-1 text-xs text-blue-700 border border-blue-200">
                Verified student/staff
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Complaint Media & Photos */}
      <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between border-b border-neutral-100 pb-2">
          <h2 className="text-base font-semibold text-neutral-900">
            Complaint Photos & Attachments
          </h2>
          <span className="text-xs text-neutral-500">
            {mediaWithUrls.length} file{mediaWithUrls.length !== 1 ? "s" : ""}
          </span>
        </div>
        <ComplaintMediaGallery media={mediaWithUrls} />
      </div>

      {/* Worker Assignment Section */}
      {["submitted", "assigned", "processing", "reopened"].includes(complaint.status) && (
        <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
          <DeptAssignForm
            complaintId={complaint.id}
            departmentId={complaint.assigned_department_id ?? deptId!}
            workers={workers ?? []}
            currentWorkerId={complaint.assigned_worker_id}
            currentWorkerName={workerObj?.display_name}
          />
        </div>
      )}

      {/* Tier-1 Verification Section */}
      {complaint.status === "waiting_for_verification" && (
        <DeptVerifyActions
          complaintId={complaint.id}
          isAlreadyDeptVerified={hasDeptVerified}
        />
      )}

      {/* Completed Banner */}
      {complaint.status === "completed" && (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 shadow-sm">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
          <div>
            <p className="font-semibold">Issue resolved and closed</p>
            <p className="text-xs text-emerald-700">
              Approved by both Departmental Admin & Organisation Admin.
              {complaint.completed_at && ` · ${new Date(complaint.completed_at).toLocaleString()}`}
            </p>
          </div>
        </div>
      )}

      {/* Full Audit Timeline */}
      <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-base font-semibold text-neutral-900">
          Full Audit & Event Timeline
        </h2>
        <div className="relative pl-6 border-l-2 border-neutral-200 space-y-4">
          {timeline.map((t, i) => (
            <div key={i} className="relative">
              <div className="absolute -left-[31px] top-1 h-3.5 w-3.5 rounded-full border-2 border-white bg-neutral-400" />
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="text-xs font-semibold text-neutral-800">{t.label}</span>
                <span className="text-[11px] text-neutral-400">
                  {new Date(t.time).toLocaleString()}
                </span>
              </div>
              {t.note && (
                <div className="mt-1 text-xs text-neutral-600 bg-neutral-50 rounded-md p-2 border border-neutral-100">
                  {t.note}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
