"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

export async function approveWorker(requestId: string, departmentId: string | null) {
  const supabase = await createClient();
  const { data: req } = await supabase
    .from("role_requests")
    .select("user_id, college_id")
    .eq("id", requestId)
    .single();

  if (req?.college_id) {
    const adminClient = createAdminClient();
    const { data: sub } = await adminClient
      .from("org_subscriptions")
      .select("status, plans(max_workers)")
      .eq("college_id", req.college_id)
      .maybeSingle();

    const maxWorkers = (sub?.plans as any)?.max_workers ?? 10;
    if (maxWorkers !== -1) {
      const { count: currentWorkerCount } = await adminClient
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("college_id", req.college_id)
        .eq("role", "worker");

      if ((currentWorkerCount ?? 0) >= maxWorkers) {
        return {
          error: `Worker roster quota reached (${currentWorkerCount}/${maxWorkers}). Upgrade your plan in Plans & Billing to add more workers.`,
        };
      }
    }
  }

  const { error } = await supabase.rpc("approve_worker_request" as never, {
    p_request_id: requestId,
  } as never);
  if (error) return { error: error.message };

  if (departmentId && req?.user_id) {
    await supabase
      .from("profiles")
      .update({ department_id: departmentId })
      .eq("id", req.user_id);
  }

  revalidatePath("/admin/role-requests");
  return { ok: true };
}

export async function approveAsOrgAdmin(requestId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: req, error: reqErr } = await supabase
    .from("role_requests")
    .select("id, user_id, college_id")
    .eq("id", requestId)
    .single();

  if (reqErr || !req) return { error: "Request not found" };

  // Update profile to college_admin
  const { error: profileErr } = await supabase
    .from("profiles")
    .update({ role: "college_admin" })
    .eq("id", req.user_id);

  if (profileErr) return { error: profileErr.message };

  // Mark request as approved
  const { error: updateErr } = await supabase
    .from("role_requests")
    .update({ status: "approved" })
    .eq("id", requestId);

  if (updateErr) return { error: updateErr.message };

  await supabase.from("audit_log").insert({
    college_id: req.college_id,
    actor_id: user.id,
    action: "approved_as_college_admin",
    entity_type: "user",
    entity_id: req.user_id,
    metadata: { request_id: requestId },
  });

  revalidatePath("/admin/role-requests");
  return { ok: true };
}

export async function approveAsDeptAdmin(requestId: string, departmentId: string) {
  if (!departmentId) return { error: "Please select a department for the Departmental Admin." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: req, error: reqErr } = await supabase
    .from("role_requests")
    .select("id, user_id, college_id")
    .eq("id", requestId)
    .single();

  if (reqErr || !req) return { error: "Request not found" };

  // Update profile to dept_admin and set department_id
  const { error: profileErr } = await supabase
    .from("profiles")
    .update({
      role: "dept_admin",
      department_id: departmentId,
    })
    .eq("id", req.user_id);

  if (profileErr) return { error: profileErr.message };

  // Mark request as approved
  const { error: updateErr } = await supabase
    .from("role_requests")
    .update({ status: "approved" })
    .eq("id", requestId);

  if (updateErr) return { error: updateErr.message };

  await supabase.from("audit_log").insert({
    college_id: req.college_id,
    actor_id: user.id,
    action: "approved_as_dept_admin",
    entity_type: "user",
    entity_id: req.user_id,
    metadata: { request_id: requestId, department_id: departmentId },
  });

  revalidatePath("/admin/role-requests");
  return { ok: true };
}

export async function rejectRequest(requestId: string, reason: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("reject_role_request" as never, {
    p_request_id: requestId,
    p_reason: reason || "Not specified",
  } as never);
  if (error) return { error: error.message };
  revalidatePath("/admin/role-requests");
  return { ok: true };
}

export async function endorseAdminRequest(requestId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_endorse_request" as never, {
    p_request_id: requestId,
  } as never);
  if (error) return { error: error.message };
  revalidatePath("/admin/role-requests");
  return { ok: true };
}

export async function toggleWorkerSignup(collegeId: string, allow: boolean) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("colleges")
    .update({ allow_worker_signup: allow })
    .eq("id", collegeId);
  if (error) return { error: error.message };
  revalidatePath("/admin/role-requests");
  return { ok: true };
}
