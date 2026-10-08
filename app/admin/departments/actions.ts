"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

async function myCollegeId(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("college_id")
    .eq("id", user!.id)
    .single();
  return profile?.college_id ?? null;
}

export async function createDepartment(name: string) {
  const supabase = await createClient();
  const collegeId = await myCollegeId(supabase);
  if (!collegeId || !name.trim()) return { error: "Name required" };

  // Check plan quota
  const adminClient = createAdminClient();
  const { data: sub } = await adminClient
    .from("org_subscriptions")
    .select("status, plans(max_departments)")
    .eq("college_id", collegeId)
    .maybeSingle();

  const maxDepts = (sub?.plans as any)?.max_departments ?? 5;
  if (maxDepts !== -1) {
    const { count: currentDeptCount } = await adminClient
      .from("departments")
      .select("id", { count: "exact", head: true })
      .eq("college_id", collegeId);

    if ((currentDeptCount ?? 0) >= maxDepts) {
      return {
        error: `Department quota reached (${currentDeptCount}/${maxDepts}). Please upgrade your plan in Plans & Billing to create more departments.`,
      };
    }
  }

  const { error } = await supabase.from("departments").insert({ college_id: collegeId, name: name.trim() });
  if (error) return { error: error.message };
  revalidatePath("/admin/departments");
  return { ok: true };
}

export async function renameDepartment(id: string, name: string) {
  const supabase = await createClient();
  if (!name.trim()) return { error: "Name required" };
  const { error } = await supabase.from("departments").update({ name: name.trim() }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/departments");
  return { ok: true };
}

export async function setDepartmentSuspended(id: string, suspended: boolean) {
  const supabase = await createClient();
  const { error } = await supabase.from("departments").update({ suspended }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/departments");
  return { ok: true };
}

export async function deleteDepartment(id: string) {
  const supabase = await createClient();
  const { count } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("department_id", id);
  if ((count ?? 0) > 0) {
    return { error: "Move or remove its workers before deleting this department." };
  }
  const { error } = await supabase.from("departments").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/departments");
  return { ok: true };
}

export async function setWorkerDepartment(workerId: string, departmentId: string | null) {
  const supabase = await createClient();
  const caller = await getCallerProfile(supabase);
  if (!caller || (caller.role !== "college_admin" && caller.role !== "super_admin")) {
    return { error: "Not authorised" };
  }
  const adminClient = createAdminClient();

  // Update profiles.department_id (primary dept for display/routing)
  const { error } = await adminClient
    .from("profiles")
    .update({ department_id: departmentId })
    .eq("id", workerId);
  if (error) return { error: error.message };

  // Also maintain department_ids array in user_metadata for multi-dept support
  if (departmentId) {
    const { data: { user: workerUser } } = await adminClient.auth.admin.getUserById(workerId);
    const existingIds: string[] = workerUser?.user_metadata?.department_ids ?? [];
    if (!existingIds.includes(departmentId)) {
      const newIds = [...existingIds, departmentId];
      await adminClient.auth.admin.updateUserById(workerId, {
        user_metadata: { ...workerUser?.user_metadata, department_ids: newIds },
      });
    }
  }

  revalidatePath("/admin/departments");
  revalidatePath("/dept-admin/workers");
  revalidatePath("/admin/role-requests");
  return { ok: true };
}

/** Assign an eligible user (applicant or former worker) as a worker to a department. */
export async function assignUserAsWorker(userId: string, departmentId: string) {
  const supabase = await createClient();
  const caller = await getCallerProfile(supabase);
  if (!caller || (caller.role !== "college_admin" && caller.role !== "super_admin")) {
    return { error: "Not authorised" };
  }
  const adminClient = createAdminClient();
  const { error } = await adminClient
    .from("profiles")
    .update({ role: "worker", department_id: departmentId })
    .eq("id", userId)
    .eq("college_id", caller.college_id);
  if (error) return { error: error.message };

  // If there was a pending role request for worker, resolve it as approved
  await adminClient
    .from("role_requests")
    .update({
      status: "approved",
      resolved_at: new Date().toISOString(),
      resolved_by: caller.userId,
    })
    .eq("user_id", userId)
    .eq("requested_role", "worker")
    .eq("status", "pending");

  await adminClient.from("audit_log").insert({
    college_id: caller.college_id,
    actor_id: caller.userId,
    action: "user_assigned_as_worker",
    entity_type: "user",
    entity_id: userId,
    metadata: { department_id: departmentId },
  });

  revalidatePath("/admin/departments");
  revalidatePath("/dept-admin/workers");
  revalidatePath("/admin/role-requests");
  return { ok: true };
}

// Convert a Departmental Admin into a Worker (requires Organisation Admin approval only)
export async function setDeptAdminToWorker(deptAdminId: string, departmentId: string | null) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: adminProfile } = await supabase
    .from("profiles")
    .select("college_id, role")
    .eq("id", user.id)
    .single();

  if (!adminProfile || (adminProfile.role !== "college_admin" && adminProfile.role !== "super_admin")) {
    return { error: "Only Organisation Admins can modify department roles." };
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      role: "worker",
      department_id: departmentId || null,
    })
    .eq("id", deptAdminId)
    .eq("college_id", adminProfile.college_id);

  if (error) return { error: error.message };

  await supabase.from("audit_log").insert({
    college_id: adminProfile.college_id,
    actor_id: user.id,
    action: "changed_dept_admin_to_worker",
    entity_type: "user",
    entity_id: deptAdminId,
    metadata: { department_id: departmentId },
  });

  revalidatePath("/admin/departments");
  revalidatePath("/admin/role-requests");
  revalidatePath("/dept-admin");
  return { ok: true };
}

// Promote a Worker to Departmental Admin (requires Organisation Admin approval only, no Super Admin needed)
export async function promoteWorkerToDeptAdmin(workerId: string, departmentId: string) {
  if (!departmentId) return { error: "Please select a department for the new Departmental Admin." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: adminProfile } = await supabase
    .from("profiles")
    .select("college_id, role")
    .eq("id", user.id)
    .single();

  if (!adminProfile || (adminProfile.role !== "college_admin" && adminProfile.role !== "super_admin")) {
    return { error: "Only Organisation Admins can promote to Departmental Admin." };
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      role: "dept_admin",
      department_id: departmentId,
    })
    .eq("id", workerId)
    .eq("college_id", adminProfile.college_id);

  if (error) return { error: error.message };

  await supabase.from("audit_log").insert({
    college_id: adminProfile.college_id,
    actor_id: user.id,
    action: "promoted_worker_to_dept_admin",
    entity_type: "user",
    entity_id: workerId,
    metadata: { department_id: departmentId },
  });

  revalidatePath("/admin/departments");
  revalidatePath("/admin/role-requests");
  revalidatePath("/dept-admin");
  return { ok: true };
}

// Reassign Departmental Admin to a different department
export async function reassignDeptAdminDepartment(deptAdminId: string, departmentId: string) {
  if (!departmentId) return { error: "Department is required." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: adminProfile } = await supabase
    .from("profiles")
    .select("college_id, role")
    .eq("id", user.id)
    .single();

  if (!adminProfile || (adminProfile.role !== "college_admin" && adminProfile.role !== "super_admin")) {
    return { error: "Only Organisation Admins can reassign departments." };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ department_id: departmentId })
    .eq("id", deptAdminId)
    .eq("college_id", adminProfile.college_id);

  if (error) return { error: error.message };

  await supabase.from("audit_log").insert({
    college_id: adminProfile.college_id,
    actor_id: user.id,
    action: "reassigned_dept_admin_department",
    entity_type: "user",
    entity_id: deptAdminId,
    metadata: { new_department_id: departmentId },
  });

  revalidatePath("/admin/departments");
  revalidatePath("/dept-admin");
  return { ok: true };
}

// Demote Departmental Admin to regular user (remove role)
export async function demoteDeptAdminToUser(deptAdminId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: adminProfile } = await supabase
    .from("profiles")
    .select("college_id, role")
    .eq("id", user.id)
    .single();

  if (!adminProfile || (adminProfile.role !== "college_admin" && adminProfile.role !== "super_admin")) {
    return { error: "Only Organisation Admins can remove roles." };
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      role: "user",
      department_id: null,
    })
    .eq("id", deptAdminId)
    .eq("college_id", adminProfile.college_id);

  if (error) return { error: error.message };

  await supabase.from("audit_log").insert({
    college_id: adminProfile.college_id,
    actor_id: user.id,
    action: "demoted_dept_admin_to_user",
    entity_type: "user",
    entity_id: deptAdminId,
    metadata: {},
  });

  revalidatePath("/admin/departments");
  revalidatePath("/dept-admin");
  return { ok: true };
}

// Propose a user (e.g. Departmental Admin or Worker) for Organisation Admin
// Requires endorsement by all Organisation Admins before going to Super Admin for final sign-off
export async function proposeForOrgAdmin(targetUserId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: adminProfile } = await supabase
    .from("profiles")
    .select("college_id, role")
    .eq("id", user.id)
    .single();

  if (!adminProfile || (adminProfile.role !== "college_admin" && adminProfile.role !== "super_admin")) {
    return { error: "Only Organisation Admins can propose an Organisation Admin." };
  }

  // Check if there is already a pending request for this user
  const { data: existing } = await supabase
    .from("role_requests")
    .select("id")
    .eq("user_id", targetUserId)
    .eq("college_id", adminProfile.college_id)
    .eq("requested_role", "college_admin")
    .eq("status", "pending")
    .maybeSingle();

  let requestId = existing?.id;

  if (!requestId) {
    // Create new role request
    const { data: newReq, error: insertErr } = await supabase
      .from("role_requests")
      .insert({
        user_id: targetUserId,
        college_id: adminProfile.college_id,
        requested_role: "college_admin",
        status: "pending",
      })
      .select("id")
      .single();

    if (insertErr || !newReq) {
      return { error: insertErr?.message || "Failed to create promotion request." };
    }
    requestId = newReq.id;
  }

  // Automatically record current admin's endorsement
  const { error: rpcErr } = await supabase.rpc("admin_endorse_request" as never, {
    p_request_id: requestId,
  } as never);

  if (rpcErr) {
    // Fallback direct insert if RPC fails
    await supabase.from("role_request_admin_approvals").insert({
      request_id: requestId,
      approver_id: user.id,
    });
  }

  await supabase.from("audit_log").insert({
    college_id: adminProfile.college_id,
    actor_id: user.id,
    action: "proposed_for_college_admin",
    entity_type: "user",
    entity_id: targetUserId,
    metadata: { request_id: requestId },
  });

  revalidatePath("/admin/departments");
  revalidatePath("/admin/role-requests");
  revalidatePath("/super-admin/admin-requests");
  return { ok: true };
}

// ─── Worker Management (accessible by both org admin & dept admin) ─────────────

async function getCallerProfile(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, college_id, role, department_id")
    .eq("id", user.id)
    .single();
  return profile ? { ...profile, userId: user.id } : null;
}

/** Suspend a worker. Dept admin can only suspend workers in their own dept. */
export async function suspendWorker(workerId: string) {
  const supabase = await createClient();
  const caller = await getCallerProfile(supabase);
  if (!caller) return { error: "Not authenticated" };
  if (caller.role !== "college_admin" && caller.role !== "dept_admin" && caller.role !== "super_admin")
    return { error: "Not authorised" };

  const adminClient = createAdminClient();
  if (caller.role === "dept_admin") {
    const { data: target } = await adminClient.from("profiles").select("department_id").eq("id", workerId).single();
    if (target?.department_id !== caller.department_id)
      return { error: "You can only manage workers in your department." };
  }

  await adminClient.from("audit_log").insert({
    college_id: caller.college_id,
    actor_id: caller.userId,
    action: "worker_suspended",
    entity_type: "user",
    entity_id: workerId,
    metadata: {},
  });
  revalidatePath("/admin/departments");
  revalidatePath("/dept-admin/workers");
  return { ok: true };
}

/** Unsuspend a worker. */
export async function unsuspendWorker(workerId: string) {
  const supabase = await createClient();
  const caller = await getCallerProfile(supabase);
  if (!caller) return { error: "Not authenticated" };
  if (caller.role !== "college_admin" && caller.role !== "dept_admin" && caller.role !== "super_admin")
    return { error: "Not authorised" };

  const adminClient = createAdminClient();
  if (caller.role === "dept_admin") {
    const { data: target } = await adminClient.from("profiles").select("department_id").eq("id", workerId).single();
    if (target?.department_id !== caller.department_id)
      return { error: "You can only manage workers in your department." };
  }

  await adminClient.from("audit_log").insert({
    college_id: caller.college_id,
    actor_id: caller.userId,
    action: "worker_unsuspended",
    entity_type: "user",
    entity_id: workerId,
    metadata: {},
  });
  revalidatePath("/admin/departments");
  revalidatePath("/dept-admin/workers");
  return { ok: true };
}

/**
 * Demote a worker to regular 'user'. Audit record preserved for future reinstatement.
 * Dept admin: only their dept. Org admin: any worker in college.
 */
export async function demoteWorkerToUser(workerId: string) {
  const supabase = await createClient();
  const caller = await getCallerProfile(supabase);
  if (!caller) return { error: "Not authenticated" };
  if (caller.role !== "college_admin" && caller.role !== "dept_admin" && caller.role !== "super_admin")
    return { error: "Not authorised" };

  const adminClient = createAdminClient();
  const { data: target } = await adminClient.from("profiles").select("role, department_id, college_id").eq("id", workerId).single();
  if (!target) return { error: "User not found" };
  if (target.college_id !== caller.college_id) return { error: "User not in your organisation" };
  if (caller.role === "dept_admin" && target.department_id !== caller.department_id)
    return { error: "You can only manage workers in your department." };

  const { error } = await adminClient.from("profiles").update({ role: "user", department_id: null }).eq("id", workerId);
  if (error) return { error: error.message };

  // Preserve record so user can be reinstated later
  await adminClient.from("audit_log").insert({
    college_id: caller.college_id,
    actor_id: caller.userId,
    action: "worker_demoted_to_user",
    entity_type: "user",
    entity_id: workerId,
    metadata: { previous_role: target.role, previous_department_id: target.department_id },
  });

  revalidatePath("/admin/departments");
  revalidatePath("/dept-admin/workers");
  return { ok: true };
}

/**
 * Reinstate a former worker (role=user) back to worker. Only org admin.
 */
export async function reinstateAsWorker(userId: string, departmentId: string | null) {
  const supabase = await createClient();
  const caller = await getCallerProfile(supabase);
  if (!caller) return { error: "Not authenticated" };
  if (caller.role !== "college_admin" && caller.role !== "super_admin")
    return { error: "Only Organisation Admins can reinstate former workers." };

  const adminClient = createAdminClient();
  const { data: target } = await adminClient.from("profiles").select("role, college_id").eq("id", userId).single();
  if (!target) return { error: "User not found" };
  if (target.college_id !== caller.college_id) return { error: "User not in your organisation" };
  if (target.role !== "user") return { error: "User is not a regular user." };

  const { error } = await adminClient.from("profiles").update({ role: "worker", department_id: departmentId ?? null }).eq("id", userId);
  if (error) return { error: error.message };

  await adminClient.from("audit_log").insert({
    college_id: caller.college_id,
    actor_id: caller.userId,
    action: "user_reinstated_as_worker",
    entity_type: "user",
    entity_id: userId,
    metadata: { department_id: departmentId },
  });

  revalidatePath("/admin/departments");
  revalidatePath("/dept-admin/workers");
  return { ok: true };
}
