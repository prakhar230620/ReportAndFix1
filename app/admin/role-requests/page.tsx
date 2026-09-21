import { createClient } from "@/lib/supabase/server";
import RoleRequestsClient from "./RoleRequestsClient";
import Link from "next/link";

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
        <Link
          href="/super-admin/admin-requests"
          className="font-medium text-blue-600 hover:text-blue-700"
        >
          Super Admin → Admin Requests
        </Link>{" "}
        page.
      </div>
    );
  }

  const collegeId = profile.college_id;

  const [
    { data: college },
    { data: workerRequests, error: workerErr },
    { data: adminRequests, error: adminErr },
    { data: myApprovals },
    { count: adminCount },
    { data: departments },
  ] = await Promise.all([
    supabase.from("colleges").select("id, name, allow_worker_signup").eq("id", collegeId!).single(),
    supabase
      .from("role_requests")
      .select("id, created_at, user_id")
      .eq("college_id", collegeId!)
      .eq("requested_role", "worker")
      .eq("status", "pending")
      .order("created_at"),
    supabase
      .from("role_requests")
      .select("id, created_at, user_id")
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
    supabase
      .from("departments")
      .select("id, name")
      .eq("college_id", collegeId!)
      .eq("suspended", false)
      .order("name"),
  ]);

  if (workerErr || adminErr) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Couldn&apos;t load role requests: {(workerErr ?? adminErr)?.message}
      </div>
    );
  }

  // role_requests.user_id has no FK to profiles (only to auth.users), so it
  // can't be embedded in the select above -- fetch display names separately.
  const involvedUserIds = [
    ...(workerRequests ?? []).map((r) => r.user_id),
    ...(adminRequests ?? []).map((r) => r.user_id),
  ];
  const { data: involvedProfiles } = involvedUserIds.length
    ? await supabase.from("profiles").select("id, display_name").in("id", involvedUserIds)
    : { data: [] as { id: string; display_name: string | null }[] };
  const nameById = new Map((involvedProfiles ?? []).map((p) => [p.id, p.display_name]));

  const workerRequestsWithNames = (workerRequests ?? []).map((r) => ({
    ...r,
    profiles: { display_name: nameById.get(r.user_id) ?? null },
  }));
  const adminRequestsWithNames = (adminRequests ?? []).map((r) => ({
    ...r,
    profiles: { display_name: nameById.get(r.user_id) ?? null },
  }));

  // Endorsement counts per admin request (small N, fine to query per row).
  const adminRequestIds = adminRequestsWithNames.map((r) => r.id);
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
      workerRequests={workerRequestsWithNames as any}
      adminRequests={adminRequestsWithNames as any}
      approvalCounts={approvalCounts}
      adminCountNeeded={adminCount ?? 0}
      myApprovedIds={[...myApprovedIds]}
      departments={departments ?? []}
    />
  );
}
