import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import DepartmentsClient from "./DepartmentsClient";

export default async function DepartmentsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, college_id")
    .eq("id", user.id)
    .single();
  if (profile?.role === "super_admin") redirect("/super-admin");

  const collegeId = profile?.college_id;
  if (!collegeId) redirect("/onboarding");

  const adminClient = createAdminClient();

  const [
    { data: departments },
    { data: workers },
    { data: deptAdmins },
    { data: workerRoleRequests },
    { data: pendingAdminRequests },
    { count: totalOrgAdmins },
    { data: formerWorkerLogs },
    { data: suspendLogs },
  ] = await Promise.all([
    adminClient
      .from("departments")
      .select("id, name, suspended, created_at")
      .eq("college_id", collegeId)
      .order("name"),
    adminClient
      .from("profiles")
      .select("id, display_name, department_id, created_at")
      .eq("college_id", collegeId)
      .eq("role", "worker")
      .order("display_name"),
    adminClient
      .from("profiles")
      .select("id, display_name, department_id, created_at")
      .eq("college_id", collegeId)
      .eq("role", "dept_admin")
      .order("display_name"),
    // Only users who specifically requested 'worker' role during signup
    adminClient
      .from("role_requests")
      .select("id, user_id, status, created_at")
      .eq("college_id", collegeId)
      .eq("requested_role", "worker")
      .order("created_at", { ascending: false }),
    adminClient
      .from("role_requests")
      .select("id, user_id, status")
      .eq("college_id", collegeId)
      .eq("requested_role", "college_admin")
      .eq("status", "pending"),
    adminClient
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("college_id", collegeId)
      .eq("role", "college_admin"),
    // Only former workers who were demoted to 'user' by an admin
    adminClient
      .from("audit_log")
      .select("entity_id, metadata, created_at")
      .eq("college_id", collegeId)
      .eq("action", "worker_demoted_to_user")
      .order("created_at", { ascending: false }),
    // Suspension logs
    adminClient
      .from("audit_log")
      .select("entity_id, action, created_at")
      .eq("college_id", collegeId)
      .in("action", ["worker_suspended", "worker_unsuspended"])
      .order("created_at", { ascending: true }),
  ]);

  const suspendedSet = new Set<string>();
  for (const log of suspendLogs ?? []) {
    if (log.action === "worker_suspended") {
      suspendedSet.add(log.entity_id);
    } else if (log.action === "worker_unsuspended") {
      suspendedSet.delete(log.entity_id);
    }
  }

  const workersWithSuspension = (workers ?? []).map((w) => ({
    ...w,
    suspended: suspendedSet.has(w.id),
  }));

  const pendingAdminUserIds = new Set((pendingAdminRequests ?? []).map((r) => r.user_id));

  // Build eligible candidates: ONLY applicants who requested worker, or users who were demoted from worker
  const demotedIds = new Set<string>((formerWorkerLogs ?? []).map((l) => l.entity_id));
  const applicantIds = new Set<string>((workerRoleRequests ?? []).map((r) => r.user_id));
  const allCandidateIds = [...new Set([...demotedIds, ...applicantIds])];

  // Fetch candidate profiles: only those who currently have role = 'user'
  // (Normal general members are completely excluded and stay anonymous)
  const { data: candidateProfiles } = allCandidateIds.length > 0
    ? await adminClient
        .from("profiles")
        .select("id, display_name, role")
        .in("id", allCandidateIds)
        .eq("role", "user")
        .order("display_name")
    : { data: [] };

  const eligibleUsers = (candidateProfiles ?? []).map((p) => {
    const isDemoted = demotedIds.has(p.id);
    const sourceLabel = isDemoted ? "Former Worker" : "Worker Applicant";
    return {
      id: p.id,
      display_name: p.display_name,
      role: p.role,
      sourceLabel,
      isDemoted,
    };
  });

  const formerWorkers = eligibleUsers.filter((u) => u.isDemoted);

  return (
    <DepartmentsClient
      departments={departments ?? []}
      workers={workersWithSuspension}
      deptAdmins={deptAdmins ?? []}
      pendingAdminUserIds={[...pendingAdminUserIds]}
      totalOrgAdmins={totalOrgAdmins ?? 1}
      formerWorkers={formerWorkers}
      availableUsers={eligibleUsers}
    />
  );
}
