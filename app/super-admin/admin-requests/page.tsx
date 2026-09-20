import { createClient } from "@/lib/supabase/server";
import AdminRequestsClient from "./AdminRequestsClient";

export default async function AdminRequestsPage() {
  const supabase = await createClient();

  const [{ data: requests, error: reqErr }, { data: colleges }] = await Promise.all([
    supabase
      .from("role_requests")
      .select("id, created_at, college_id, user_id, colleges(name)")
      .eq("requested_role", "college_admin")
      .eq("status", "pending")
      .order("created_at"),
    supabase.from("colleges").select("id, name, allow_admin_signup").order("name"),
  ]);

  if (reqErr) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Couldn&apos;t load admin requests: {reqErr.message}
      </div>
    );
  }

  // role_requests.user_id has no FK to profiles (only to auth.users), so it
  // can't be embedded above -- fetch display names separately.
  const userIds = (requests ?? []).map((r) => r.user_id);
  const { data: involvedProfiles } = userIds.length
    ? await supabase.from("profiles").select("id, display_name").in("id", userIds)
    : { data: [] as { id: string; display_name: string | null }[] };
  const nameById = new Map((involvedProfiles ?? []).map((p) => [p.id, p.display_name]));
  const requestsWithNames = (requests ?? []).map((r) => ({
    ...r,
    profiles: { display_name: nameById.get(r.user_id) ?? null },
  }));

  const requestIds = requestsWithNames.map((r) => r.id);
  let approvalCounts: Record<string, number> = {};
  if (requestIds.length > 0) {
    const { data: approvals } = await supabase
      .from("role_request_admin_approvals")
      .select("request_id")
      .in("request_id", requestIds);
    approvalCounts = (approvals ?? []).reduce((acc: Record<string, number>, a) => {
      acc[a.request_id] = (acc[a.request_id] ?? 0) + 1;
      return acc;
    }, {});
  }

  // Number of existing admins per college, for the "N of M endorsed" label.
  const collegeIds = [...new Set(requestsWithNames.map((r) => r.college_id))];
  const adminCounts: Record<string, number> = {};
  for (const cid of collegeIds) {
    const { count } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("college_id", cid)
      .eq("role", "college_admin");
    adminCounts[cid] = count ?? 0;
  }

  return (
    <AdminRequestsClient
      requests={requestsWithNames as any}
      approvalCounts={approvalCounts}
      adminCounts={adminCounts}
      colleges={(colleges ?? []) as any}
    />
  );
}
