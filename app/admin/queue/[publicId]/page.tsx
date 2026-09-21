import { createClient } from "@/lib/supabase/server";
import AssignForm from "../AssignForm";
import VerifyActions from "../VerifyActions";
import Link from "next/link";

export default async function AdminComplaintDetailPage({
  params,
}: {
  params: Promise<{ publicId: string }>;
}) {
  const { publicId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("college_id")
    .eq("id", user!.id)
    .single();
  const collegeId = profile?.college_id;

  const { data: complaint } = await supabase
    .from("complaints")
    .select(
      "id, public_id, title, description, status, priority, is_anonymous, created_at, completed_at, resolution_seconds, assigned_worker_id, assigned_department_id, location_id, categories(name), locations(name)"
    )
    .eq("public_id", publicId)
    .eq("college_id", collegeId)
    .maybeSingle();

  if (!complaint) {
    return <p className="text-sm text-neutral-500">Complaint not found.</p>;
  }

  const [
    { data: statusHistory },
    { data: progressUpdates },
    { data: auditEntries },
    { data: media },
    { data: workers },
    { data: departments },
  ] = await Promise.all([
    supabase
      .from("complaint_status_history")
      .select("previous_status, new_status, note, created_at")
      .eq("complaint_id", complaint.id),
    supabase
      .from("complaint_progress_updates")
      .select("note, created_at, worker_id")
      .eq("complaint_id", complaint.id),
    supabase
      .from("audit_log")
      .select("action, metadata, created_at, actor_id")
      .eq("entity_id", complaint.id),
    supabase
      .from("complaint_media")
      .select("storage_path, media_type, created_at")
      .eq("complaint_id", complaint.id),
    supabase
      .from("profiles")
      .select("id, display_name")
      .eq("college_id", collegeId)
      .eq("role", "worker"),
    supabase.from("departments").select("id, name").eq("college_id", collegeId).eq("suspended", false),
  ]);

  const mediaWithUrls = await Promise.all(
    (media ?? []).map(async (m) => {
      const { data } = await supabase.storage
        .from("complaint-media")
        .createSignedUrl(m.storage_path, 3600);
      return { ...m, url: data?.signedUrl ?? null };
    })
  );

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
      label: "Progress update",
      note: p.note,
    })),
    ...(auditEntries ?? []).map((a) => ({
      time: a.created_at,
      label: `Audit: ${a.action}`,
      note: JSON.stringify(a.metadata),
    })),
  ].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

  const beforeUrl = mediaWithUrls.find((m) => m.media_type === "before")?.url;
  const afterUrl = mediaWithUrls.find((m) => m.media_type === "after")?.url;

  const category = (complaint as any).categories?.name;
  const { data: locationPath } = await supabase.rpc("location_full_path" as never, {
    p_location_id: complaint.location_id,
  } as never);
  const locationSummary = (locationPath as unknown as string) ?? (complaint as any).locations?.name ?? "";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between text-xs text-neutral-500">
        <span>{complaint.public_id}</span>
        <Link href={`/issues/${complaint.public_id}`} className="font-medium text-blue-600 hover:text-blue-700">
          View public page
        </Link>
      </div>

      <h1 className="text-xl font-semibold">{complaint.title}</h1>
      <p className="text-sm text-neutral-500">
        {category} · {locationSummary}
      </p>
      {complaint.description && <p className="text-sm">{complaint.description}</p>}

      <div className="flex items-center gap-2 text-xs text-neutral-500">
        <span className="rounded-full bg-neutral-200 px-2 py-0.5">{complaint.status}</span>
        <span className="rounded-full bg-neutral-200 px-2 py-0.5">{complaint.priority}</span>
        {complaint.is_anonymous && (
          <span className="rounded-full bg-neutral-200 px-2 py-0.5">Anonymous</span>
        )}
      </div>

      {complaint.status === "submitted" && (
        <AssignForm
          complaintId={complaint.id}
          workers={workers ?? []}
          departments={departments ?? []}
        />
      )}

      {complaint.status === "waiting_for_verification" && (
        <>
          <div className="flex gap-2">
            {beforeUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={beforeUrl} alt="Before" className="h-32 w-1/2 rounded-md object-cover" />
            )}
            {afterUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={afterUrl} alt="After" className="h-32 w-1/2 rounded-md object-cover" />
            )}
          </div>
          <VerifyActions complaintId={complaint.id} />
        </>
      )}

      {complaint.status === "completed" && (
        <div className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">
          Completed · resolved in{" "}
          {complaint.resolution_seconds
            ? `${Math.round(complaint.resolution_seconds / 3600)}h`
            : "—"}
        </div>
      )}

      <div>
        <h2 className="mb-2 text-sm font-semibold">Full audit timeline</h2>
        <ul className="flex flex-col gap-2 text-xs text-neutral-600">
          {timeline.map((t, i) => (
            <li key={i}>
              <span className="font-medium">{t.label}</span> ·{" "}
              {new Date(t.time).toLocaleString()}
              {t.note && <div className="text-neutral-500">{t.note}</div>}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
