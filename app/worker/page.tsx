import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export default async function WorkerTasksPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: tasks } = await supabase
    .from("complaints")
    .select("id, public_id, title, status, priority, categories(name), locations(name)")
    .eq("assigned_worker_id", user!.id)
    .order("created_at", { ascending: false });

  return (
    <div className="flex flex-col gap-3">
      {(tasks ?? []).map((t) => (
        <Link
          key={t.id}
          href={`/worker/${t.public_id}`}
          className="rounded-md border border-neutral-200 p-3 text-sm hover:bg-neutral-50"
        >
          <div className="flex items-center justify-between">
            <span className="font-medium">{t.title}</span>
            <span className="text-xs text-neutral-500">{t.public_id}</span>
          </div>
          <div className="mt-1 text-neutral-500">
            {(t as any).categories?.name} · {(t as any).locations?.name}
          </div>
          <div className="mt-1 flex gap-2 text-xs text-neutral-500">
            <span className="rounded-full bg-neutral-200 px-2 py-0.5">{t.status}</span>
            <span className="rounded-full bg-neutral-200 px-2 py-0.5">{t.priority}</span>
          </div>
        </Link>
      ))}
      {(tasks ?? []).length === 0 && (
        <p className="text-sm text-neutral-500">No tasks assigned to you yet.</p>
      )}
    </div>
  );
}
