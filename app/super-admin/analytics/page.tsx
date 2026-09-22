import { createClient } from "@/lib/supabase/server";

export default async function SuperAdminAnalyticsPage() {
  const supabase = await createClient();

  const { data: colleges, error: collegesError } = await supabase
    .from("colleges")
    .select("id, name, subscription_status")
    .order("name");

  if (collegesError) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Couldn&apos;t load organisations: {collegesError.message}
      </div>
    );
  }

  const perCollege = await Promise.all(
    (colleges ?? []).map(async (c) => {
      const { data } = await supabase.rpc("get_college_analytics" as never, {
        p_college_id: c.id,
      } as never);
      const stats = data as any;
      return {
        id: c.id,
        name: c.name,
        status: c.subscription_status,
        total: stats?.total ?? 0,
        completed: stats?.completed ?? 0,
        avgResolutionHours: stats?.avg_resolution_seconds
          ? (stats.avg_resolution_seconds / 3600).toFixed(1)
          : null,
      };
    })
  );

  const { data: storageRaw } = await supabase.rpc("get_storage_usage" as never);
  const storage = storageRaw as {
    db_size_bytes: number;
    storage_used_bytes: number;
    storage_object_count: number;
    by_college: { college_id: string; college_name: string; bytes: number; object_count: number }[];
  } | null;

  function mb(bytes: number) {
    return (bytes / (1024 * 1024)).toFixed(1);
  }

  const platformTotal = perCollege.reduce((s, c) => s + c.total, 0);
  const platformCompleted = perCollege.reduce((s, c) => s + c.completed, 0);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Platform Analytics</h1>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card label="Organisations" value={String(colleges?.length ?? 0)} />
        <Card label="Total complaints" value={String(platformTotal)} />
        <Card label="Completed" value={String(platformCompleted)} />
        <Card
          label="Storage used"
          value={storage ? `${mb(storage.storage_used_bytes)} MB` : "—"}
        />
      </div>

      {storage && (
        <div className="rounded-lg border border-neutral-200 bg-white p-4 text-sm shadow-sm">
          <h2 className="mb-2 font-semibold">Supabase storage</h2>
          <p className="text-neutral-600">
            Database: {mb(storage.db_size_bytes)} MB · File storage:{" "}
            {mb(storage.storage_used_bytes)} MB ({storage.storage_object_count} files)
          </p>
          <p className="mt-1 text-xs text-neutral-400">
            Supabase&apos;s Free plan currently includes 500 MB database and 1 GB file storage —
            check your Supabase dashboard for your project&apos;s exact current plan and limits,
            since these can change.
          </p>

          {storage.by_college.some((c) => c.bytes > 0) && (
            <div className="mt-4 border-t border-neutral-100 pt-3">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                By organisation
              </h3>
              <div className="flex flex-col gap-1.5">
                {storage.by_college
                  .filter((c) => c.bytes > 0)
                  .map((c) => {
                    const pct = storage.storage_used_bytes
                      ? Math.round((c.bytes / storage.storage_used_bytes) * 100)
                      : 0;
                    return (
                      <div key={c.college_id} className="flex items-center gap-3">
                        <span className="w-32 shrink-0 truncate text-neutral-700">{c.college_name}</span>
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-neutral-100">
                          <div
                            className="h-full rounded-full bg-blue-500"
                            style={{ width: `${Math.max(pct, 2)}%` }}
                          />
                        </div>
                        <span className="w-24 shrink-0 text-right text-xs text-neutral-500">
                          {mb(c.bytes)} MB ({c.object_count})
                        </span>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-neutral-100">
            <tr>
              <th className="p-2">Organisation</th>
              <th className="p-2">Status</th>
              <th className="p-2">Total</th>
              <th className="p-2">Completed</th>
              <th className="p-2">Avg resolution</th>
            </tr>
          </thead>
          <tbody>
            {perCollege.map((c) => (
              <tr key={c.id} className="border-t border-neutral-100">
                <td className="p-2 font-medium">{c.name}</td>
                <td className="p-2">
                  <span
                    className={
                      c.status === "active"
                        ? "rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700"
                        : "rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700"
                    }
                  >
                    {c.status}
                  </span>
                </td>
                <td className="p-2">{c.total}</td>
                <td className="p-2">{c.completed}</td>
                <td className="p-2">
                  {c.avgResolutionHours ? `${c.avgResolutionHours} hrs` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-3 shadow-sm">
      <div className="text-2xl font-semibold text-blue-600">{value}</div>
      <div className="text-xs text-neutral-500">{label}</div>
    </div>
  );
}
