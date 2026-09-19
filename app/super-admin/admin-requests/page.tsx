import { createClient } from "@/lib/supabase/server";
import AdminRequestsClient from "./AdminRequestsClient";

export default async function AdminRequestsPage() {
  const supabase = await createClient();

  const [{ data: requests }, { data: colleges }] = await Promise.all([
    supabase
      .from("role_requests")
      .select(
        "id, created_at, college_id, colleges(name), profiles!role_requests_user_id_fkey(display_name)"
      )
      .eq("requested_role", "college_admin")
      .eq("status", "pending")
      .order("created_at"),
    supabase.from("colleges").select("id, name, allow_admin_signup").order("name"),
  ]);

  const requestIds = (requests ?? []).map((r) => r.id);
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
  const collegeIds = [...new Set((requests ?? []).map((r) => r.college_id))];
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
      requests={(requests ?? []) as any}
      approvalCounts={approvalCounts}
      adminCounts={adminCounts}
      colleges={(colleges ?? []) as any}
    />
  );
}
