import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { StatusBadge, PriorityBadge, UnreadDot } from "@/app/components/StatusBadge";
import TodaysBroadcasts from "@/app/components/TodaysBroadcasts";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function WorkerTasksPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: tasks }, { data: profile }] = await Promise.all([
    supabase
      .from("complaints")
      .select("id, public_id, title, status, priority, created_at, categories(name), locations(name)")
      .eq("assigned_worker_id", user!.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("profiles")
      .select("role, college_id, colleges(name)")
      .eq("id", user!.id)
      .single(),
  ]);

  return (
    <div className="flex flex-col gap-5">
      {/* Today's Broadcasts Section for Worker */}
      {profile?.college_id && (
        <TodaysBroadcasts
          collegeId={profile.college_id}
          userRole="worker"
          collegeName={(profile.colleges as any)?.name}
        />
      )}

      <div className="flex flex-col gap-3">
      {(tasks ?? []).map((t) => (
        <Link
          key={t.id}
          href={`/worker/${t.public_id}`}
          className="rounded-xl border border-neutral-200 bg-white p-4 text-sm shadow-sm hover:border-neutral-300 hover:bg-neutral-50 transition-colors"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <UnreadDot complaintId={t.id} createdAt={t.created_at} />
              <span className="font-semibold text-neutral-900">{t.title}</span>
            </div>
            <span className="font-mono text-xs font-medium text-neutral-500 bg-neutral-100 px-2 py-0.5 rounded">
              {t.public_id}
            </span>
          </div>
          <div className="mt-1 text-xs text-neutral-500">
            {(t as any).categories?.name ?? "General"} · {(t as any).locations?.name ?? "Location"}
          </div>
          <div className="mt-2.5 flex flex-wrap items-center gap-2 text-xs">
            <StatusBadge status={t.status} />
            <PriorityBadge priority={t.priority} />
          </div>
        </Link>
      ))}
      {(tasks ?? []).length === 0 && (
        <div className="rounded-xl border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-500">
          No tasks assigned to you yet.
        </div>
      )}
      </div>
    </div>
  );
}
