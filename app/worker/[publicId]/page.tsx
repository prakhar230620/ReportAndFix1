import { createClient } from "@/lib/supabase/server";
import TaskActions from "./TaskActions";
import { StatusBadge, PriorityBadge, MarkAsRead } from "@/app/components/StatusBadge";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function WorkerTaskDetailPage({
  params,
}: {
  params: Promise<{ publicId: string }>;
}) {
  const { publicId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: task }, { data: profile }] = await Promise.all([
    supabase
      .from("complaints")
      .select(
        "id, public_id, title, description, status, priority, location_id, categories(name), locations(name)"
      )
      .eq("public_id", publicId)
      .eq("assigned_worker_id", user!.id)
      .maybeSingle(),
    supabase
      .from("profiles")
      .select("college_id, colleges(camera_mode)")
      .eq("id", user!.id)
      .single(),
  ]);

  if (!task) {
    return <p className="text-sm text-neutral-500">Task not found or not assigned to you.</p>;
  }

  const cameraMode = ((profile?.colleges as any)?.camera_mode ?? "both") as "both" | "camera_only" | "manual_only";

  const { data: updates } = await supabase
    .from("complaint_progress_updates")
    .select("note, created_at")
    .eq("complaint_id", task.id)
    .order("created_at", { ascending: true });

  const category = (task as any).categories?.name;
  const { data: locationPath } = await supabase.rpc("location_full_path" as never, {
    p_location_id: task.location_id,
  } as never);
  const locationSummary = (locationPath as unknown as string) ?? (task as any).locations?.name ?? "";

  return (
    <div className="flex flex-col gap-4">
      <MarkAsRead complaintId={task.id} />
      <div className="text-xs font-mono text-neutral-500">{task.public_id}</div>
      <h1 className="text-xl font-bold text-neutral-900">{task.title}</h1>
      <p className="text-sm text-neutral-500">
        {category} · {locationSummary}
      </p>
      {task.description && <p className="text-sm text-neutral-700 bg-neutral-100 p-3 rounded-lg">{task.description}</p>}
      <div className="flex items-center gap-2 text-xs">
        <StatusBadge status={task.status} />
        <PriorityBadge priority={task.priority} />
      </div>

      <TaskActions complaintId={task.id} status={task.status} cameraMode={cameraMode} />

      {(updates ?? []).length > 0 && (
        <div className="mt-4">
          <h2 className="mb-2 text-sm font-semibold">Progress log</h2>
          <ul className="flex flex-col gap-2 text-xs text-neutral-600">
            {(updates ?? []).map((u, i) => (
              <li key={i} className="border-b border-neutral-100 pb-1">
                {new Date(u.created_at).toLocaleString()} — {u.note}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
