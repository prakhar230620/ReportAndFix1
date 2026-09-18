import { createClient } from "@/lib/supabase/server";
import TaskActions from "./TaskActions";

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

  const { data: task } = await supabase
    .from("complaints")
    .select(
      "id, public_id, title, description, status, priority, categories(name), locations(name, buildings(name), floors(label))"
    )
    .eq("public_id", publicId)
    .eq("assigned_worker_id", user!.id)
    .maybeSingle();

  if (!task) {
    return <p className="text-sm text-neutral-500">Task not found or not assigned to you.</p>;
  }

  const { data: updates } = await supabase
    .from("complaint_progress_updates")
    .select("note, created_at")
    .eq("complaint_id", task.id)
    .order("created_at", { ascending: true });

  const category = (task as any).categories?.name;
  const location = (task as any).locations;
  const locationSummary = [location?.name, location?.buildings?.name, location?.floors?.label]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="flex flex-col gap-4">
      <div className="text-xs text-neutral-500">{task.public_id}</div>
      <h1 className="text-xl font-semibold">{task.title}</h1>
      <p className="text-sm text-neutral-500">
        {category} · {locationSummary}
      </p>
      {task.description && <p className="text-sm">{task.description}</p>}
      <div className="flex gap-2 text-xs text-neutral-500">
        <span className="rounded-full bg-neutral-200 px-2 py-0.5">{task.status}</span>
        <span className="rounded-full bg-neutral-200 px-2 py-0.5">{task.priority}</span>
      </div>

      <TaskActions complaintId={task.id} status={task.status} />

      {(updates ?? []).length > 0 && (
        <div>
          <h2 className="mb-2 text-sm font-semibold">Progress log</h2>
          <ul className="flex flex-col gap-2 text-xs text-neutral-600">
            {(updates ?? []).map((u, i) => (
              <li key={i}>
                {new Date(u.created_at).toLocaleString()} — {u.note}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
