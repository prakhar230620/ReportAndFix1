import { createClient } from "@/lib/supabase/server";
import RoleRequestsClient from "./RoleRequestsClient";

export default async function RoleRequestsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, college_id")
    .eq("id", user!.id)
    .single();

  if (!profile) return null;

  if (profile.role === "super_admin") {
    return (
      <div className="rounded-md border border-neutral-200 p-4 text-sm text-neutral-600">
        Super Admin approves Admin requests (after all current admins
        endorse) from the{" "}
        <a
          href="/super-admin/admin-requests"
          className="font-medium text-blue-600 hover:text-blue-700"
        >
          Super Admin → Admin Requests
        </a>{" "}
        page.
      </div>
    );
  }

  const collegeId = profile.college_id;

  const [{ data: college }, { data: workerRequests }, { data: adminRequests }, { data: myApprovals }, { count: adminCount }] =
    await Promise.all([
      supabase.from("colleges").select("id, name, allow_worker_signup").eq("id", collegeId!).single(),
      supabase
        .from("role_requests")
        .select("id, created_at, user_id, profiles!role_requests_user_id_fkey(display_name)")
        .eq("college_id", collegeId!)
        .eq("requested_role", "worker")
        .eq("status", "pending")
        .order("created_at"),
      supabase
        .from("role_requests")
        .select("id, created_at, user_id, profiles!role_requests_user_id_fkey(display_name)")
        .eq("college_id", collegeId!)
        .eq("requested_role", "college_admin")
        .eq("status", "pending")
        .order("created_at"),
      supabase.from("role_request_admin_approvals").select("request_id").eq("approver_id", user!.id),
      supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("college_id", collegeId!)
        .eq("role", "college_admin"),
    ]);

  // Endorsement counts per admin request (small N, fine to query per row).
  const adminRequestIds = (adminRequests ?? []).map((r) => r.id);
  let approvalCounts: Record<string, number> = {};
  if (adminRequestIds.length > 0) {
    const { data: approvals } = await supabase
      .from("role_request_admin_approvals")
      .select("request_id")
      .in("request_id", adminRequestIds);
    approvalCounts = (approvals ?? []).reduce((acc: Record<string, number>, a) => {
      acc[a.request_id] = (acc[a.request_id] ?? 0) + 1;
      return acc;
    }, {});
  }

  const myApprovedIds = new Set((myApprovals ?? []).map((a) => a.request_id));

  return (
    <RoleRequestsClient
      college={college as { id: string; name: string; allow_worker_signup: boolean }}
      workerRequests={(workerRequests ?? []) as any}
      adminRequests={(adminRequests ?? []) as any}
      approvalCounts={approvalCounts}
      adminCountNeeded={adminCount ?? 0}
      myApprovedIds={[...myApprovedIds]}
    />
  );
}
