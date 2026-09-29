"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

export async function assignComplaint(
  complaintId: string,
  workerId: string | null,
  departmentId: string | null
) {
  if (!workerId && !departmentId) {
    return { error: "Please select a department or a worker." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const adminClient = createAdminClient();
  const { data: profile } = await adminClient
    .from("profiles")
    .select("college_id, role, department_id")
    .eq("id", user.id)
    .single();

  if (
    !profile ||
    (profile.role !== "college_admin" &&
      profile.role !== "super_admin" &&
      profile.role !== "dept_admin")
  ) {
    return { error: "Unauthorized" };
  }

  const newStatus = workerId ? "processing" : "assigned";

  const { error } = await adminClient
    .from("complaints")
    .update({
      assigned_worker_id: workerId || null,
      assigned_department_id: departmentId || null,
      assigned_by: user.id,
      assigned_at: new Date().toISOString(),
      status: newStatus,
    })
    .eq("id", complaintId);

  if (error) return { error: error.message };

  await adminClient.from("complaint_status_history").insert({
    complaint_id: complaintId,
    previous_status: "submitted",
    new_status: newStatus,
    actor_id: user.id,
    note: workerId
      ? "Assigned to worker & department — work in progress"
      : "Assigned to department for Departmental Admin delegation",
  });

  await adminClient.from("audit_log").insert({
    college_id: profile?.college_id,
    actor_id: user.id,
    action: "assigned",
    entity_type: "complaint",
    entity_id: complaintId,
    metadata: { worker_id: workerId || null, department_id: departmentId || null },
  });

  revalidatePath("/admin/queue");
  revalidatePath(`/admin/queue/${complaintId}`);
  revalidatePath("/dept-admin/queue");
  revalidatePath(`/dept-admin/queue/${complaintId}`);
  return { ok: true };
}

export async function unassignComplaint(complaintId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const adminClient = createAdminClient();
  const { data: complaint } = await adminClient
    .from("complaints")
    .select("college_id, status")
    .eq("id", complaintId)
    .single();

  const { error } = await adminClient
    .from("complaints")
    .update({
      assigned_worker_id: null,
      assigned_department_id: null,
      assigned_by: null,
      assigned_at: null,
      status: "submitted",
    })
    .eq("id", complaintId);

  if (error) return { error: error.message };

  await adminClient.from("complaint_status_history").insert({
    complaint_id: complaintId,
    previous_status: complaint?.status ?? "assigned",
    new_status: "submitted",
    actor_id: user.id,
    note: "Unassigned by admin",
  });

  await adminClient.from("audit_log").insert({
    college_id: complaint?.college_id,
    actor_id: user.id,
    action: "unassigned",
    entity_type: "complaint",
    entity_id: complaintId,
    metadata: {},
  });

  revalidatePath("/admin/queue");
  revalidatePath(`/admin/queue/${complaintId}`);
  revalidatePath("/dept-admin/queue");
  revalidatePath(`/dept-admin/queue/${complaintId}`);
  return { ok: true };
}

// Departmental Admin Verification (Tier 1 Verification)
export async function deptAdminVerifyComplaint(complaintId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const adminClient = createAdminClient();
  const { data: complaint, error: fetchError } = await adminClient
    .from("complaints")
    .select("college_id, status, assigned_department_id")
    .eq("id", complaintId)
    .single();

  if (fetchError || !complaint) return { error: "Complaint not found" };

  // Record departmental verification in status history & audit log
  await adminClient.from("complaint_status_history").insert({
    complaint_id: complaintId,
    previous_status: complaint.status,
    new_status: "waiting_for_verification",
    actor_id: user.id,
    note: "Verified by Departmental Admin (Stage 1 approved) · Forwarded to Organisation Admin for final double-check",
  });

  await adminClient.from("audit_log").insert({
    college_id: complaint.college_id,
    actor_id: user.id,
    action: "dept_verified",
    entity_type: "complaint",
    entity_id: complaintId,
    metadata: { department_id: complaint.assigned_department_id },
  });

  revalidatePath("/admin/queue");
  revalidatePath(`/admin/queue/${complaintId}`);
  revalidatePath("/dept-admin/queue");
  revalidatePath(`/dept-admin/queue/${complaintId}`);
  return { ok: true };
}

// Departmental Admin Reopen (Sends back to Worker)
export async function deptAdminReopenComplaint(complaintId: string, comment: string) {
  if (!comment.trim()) return { error: "A comment is required to explain what needs fixing." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const adminClient = createAdminClient();
  const { data: complaint, error: fetchError } = await adminClient
    .from("complaints")
    .select("college_id, status")
    .eq("id", complaintId)
    .single();

  if (fetchError || !complaint) return { error: "Complaint not found" };

  const { error } = await adminClient
    .from("complaints")
    .update({ status: "reopened" })
    .eq("id", complaintId);

  if (error) return { error: error.message };

  await adminClient.from("complaint_status_history").insert({
    complaint_id: complaintId,
    previous_status: complaint.status,
    new_status: "reopened",
    actor_id: user.id,
    note: `Departmental Admin reopened: ${comment.trim()}`,
  });

  await adminClient.from("audit_log").insert({
    college_id: complaint.college_id,
    actor_id: user.id,
    action: "dept_reopened",
    entity_type: "complaint",
    entity_id: complaintId,
    metadata: { comment: comment.trim() },
  });

  revalidatePath("/admin/queue");
  revalidatePath(`/admin/queue/${complaintId}`);
  revalidatePath("/dept-admin/queue");
  revalidatePath(`/dept-admin/queue/${complaintId}`);
  return { ok: true };
}

// Organisation Admin Final Approval (Tier 2 Final Sign-Off)
export async function approveComplaint(complaintId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: complaint, error: fetchError } = await supabase
    .from("complaints")
    .select("college_id, status, created_at")
    .eq("id", complaintId)
    .single();
  if (fetchError || !complaint) return { error: "Complaint not found" };

  const now = new Date();
  const created = new Date(complaint.created_at);
  const resolutionSeconds = Math.max(0, Math.floor((now.getTime() - created.getTime()) / 1000));

  const { error } = await supabase
    .from("complaints")
    .update({
      status: "completed",
      verified_by: user.id,
      completed_at: now.toISOString(),
      resolution_seconds: resolutionSeconds,
    })
    .eq("id", complaintId);

  if (error) return { error: error.message };

  await supabase.from("complaint_status_history").insert({
    complaint_id: complaintId,
    previous_status: complaint.status,
    new_status: "completed",
    actor_id: user.id,
    note: "Final sign-off by Organisation Admin · Issue officially resolved and closed.",
  });

  await supabase.from("audit_log").insert({
    college_id: complaint.college_id,
    actor_id: user.id,
    action: "org_admin_approved",
    entity_type: "complaint",
    entity_id: complaintId,
    metadata: { resolution_seconds: resolutionSeconds },
  });

  revalidatePath("/admin/queue");
  revalidatePath(`/admin/queue/${complaintId}`);
  revalidatePath("/dept-admin/queue");
  return { ok: true };
}

// Organisation Admin Reopening
export async function reopenComplaint(complaintId: string, comment: string) {
  if (!comment.trim()) return { error: "A comment is required to reopen." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: complaint, error: fetchError } = await supabase
    .from("complaints")
    .select("college_id, status")
    .eq("id", complaintId)
    .single();
  if (fetchError || !complaint) return { error: "Complaint not found" };

  const { error } = await supabase
    .from("complaints")
    .update({ status: "reopened" })
    .eq("id", complaintId);

  if (error) return { error: error.message };

  await supabase.from("complaint_status_history").insert({
    complaint_id: complaintId,
    previous_status: complaint.status,
    new_status: "reopened",
    actor_id: user.id,
    note: `Organisation Admin reopened: ${comment.trim()}`,
  });

  await supabase.from("audit_log").insert({
    college_id: complaint.college_id,
    actor_id: user.id,
    action: "org_admin_reopened",
    entity_type: "complaint",
    entity_id: complaintId,
    metadata: { comment: comment.trim() },
  });

  revalidatePath("/admin/queue");
  revalidatePath(`/admin/queue/${complaintId}`);
  revalidatePath("/dept-admin/queue");
  return { ok: true };
}
