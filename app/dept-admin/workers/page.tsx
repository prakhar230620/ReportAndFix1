import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import DeptWorkersClient from "./DeptWorkersClient";

export default async function DeptWorkersPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, college_id, department_id, departments(name)")
    .eq("id", user.id)
    .single();

  if (
    !profile ||
    (profile.role !== "dept_admin" &&
      profile.role !== "college_admin" &&
      profile.role !== "super_admin")
  ) {
    redirect("/");
  }

  const isOrgAdmin = profile.role === "college_admin" || profile.role === "super_admin";
  const collegeId = profile.college_id;
  const adminClient = createAdminClient();

  // Load suspension logs to know which workers are currently suspended
  const { data: suspendLogs } = await adminClient
    .from("audit_log")
    .select("entity_id, action, created_at")
    .eq("college_id", collegeId!)
    .in("action", ["worker_suspended", "worker_unsuspended"])
    .order("created_at", { ascending: true });

  const suspendedSet = new Set<string>();
  for (const log of suspendLogs ?? []) {
    if (log.action === "worker_suspended") {
      suspendedSet.add(log.entity_id);
    } else if (log.action === "worker_unsuspended") {
      suspendedSet.delete(log.entity_id);
    }
  }

  if (isOrgAdmin) {
    const [{ data: departments }, { data: allWorkers }, { data: complaints }] = await Promise.all([
      adminClient
        .from("departments")
        .select("id, name, suspended, created_at")
        .eq("college_id", collegeId!)
        .order("name"),
      adminClient
        .from("profiles")
        .select("id, display_name, department_id, created_at")
        .eq("college_id", collegeId!)
        .eq("role", "worker")
        .order("display_name"),
      adminClient
        .from("complaints")
        .select("id, assigned_worker_id, status, resolution_seconds")
        .eq("college_id", collegeId!),
    ]);

    const workersWithSuspension = (allWorkers ?? []).map((w) => ({
      ...w,
      suspended: suspendedSet.has(w.id),
    }));

    return (
      <DeptWorkersClient
        isOrgAdmin={true}
        departments={departments ?? []}
        workers={workersWithSuspension}
        complaints={complaints ?? []}
        myDeptId={null}
        myDeptName={null}
      />
    );
  }

  // Dept admin view: fetch workers for their assigned department using adminClient to bypass RLS
  const deptId = profile.department_id;
  const deptName = (profile.departments as any)?.name ?? "Department";

  if (!deptId) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-center text-amber-800">
        <h2 className="text-lg font-semibold">No Department Assigned</h2>
        <p className="mt-1 text-sm">Please ask your Organisation Admin to assign your department.</p>
      </div>
    );
  }

  const [{ data: workers }, { data: complaints }] = await Promise.all([
    adminClient
      .from("profiles")
      .select("id, display_name, department_id, created_at")
      .eq("department_id", deptId)
      .eq("role", "worker")
      .order("display_name"),
    adminClient
      .from("complaints")
      .select("id, assigned_worker_id, status, resolution_seconds")
      .eq("assigned_department_id", deptId),
  ]);

  const workersWithSuspension = (workers ?? []).map((w) => ({
    ...w,
    suspended: suspendedSet.has(w.id),
  }));

  return (
    <DeptWorkersClient
      isOrgAdmin={false}
      departments={[]}
      workers={workersWithSuspension}
      complaints={complaints ?? []}
      myDeptId={deptId}
      myDeptName={deptName}
    />
  );
}
