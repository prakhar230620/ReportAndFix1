import { createClient } from "@/lib/supabase/server";
import CollegeRow from "./CollegeRow";
import AddCollegeForm from "./AddCollegeForm";

export default async function SuperAdminPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_platform_overview" as never, {} as never);

  if (error || !data) {
    return <p className="text-sm text-red-600">Failed to load: {error?.message}</p>;
  }

  const overview = data as {
    colleges: {
      id: string;
      name: string;
      subscription_status: string;
      user_count: number;
      worker_count: number;
      issue_count: number;
    }[];
    total_users: number;
    total_workers: number;
    total_issues: number;
  };

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Platform overview</h1>

      <div className="grid grid-cols-3 gap-3 text-center text-sm">
        <div className="rounded-md border border-neutral-200 p-3">
          <div className="text-2xl font-semibold">{overview.total_users}</div>
          <div className="text-neutral-500">Users</div>
        </div>
        <div className="rounded-md border border-neutral-200 p-3">
          <div className="text-2xl font-semibold">{overview.total_workers}</div>
          <div className="text-neutral-500">Workers</div>
        </div>
        <div className="rounded-md border border-neutral-200 p-3">
          <div className="text-2xl font-semibold">{overview.total_issues}</div>
          <div className="text-neutral-500">Issues</div>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <AddCollegeForm />
        {overview.colleges.map((c) => (
          <CollegeRow key={c.id} college={c} />
        ))}
      </div>
    </div>
  );
}
