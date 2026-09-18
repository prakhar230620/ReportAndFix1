"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function assignComplaint(
  complaintId: string,
  workerId: string,
  departmentId: string | null
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("college_id")
    .eq("id", user.id)
    .single();

  const { error } = await supabase
    .from("complaints")
    .update({
      assigned_worker_id: workerId,
      assigned_department_id: departmentId,
      assigned_by: user.id,
      assigned_at: new Date().toISOString(),
      status: "assigned",
    })
    .eq("id", complaintId);

  if (error) return { error: error.message };

  await supabase.from("complaint_status_history").insert({
    complaint_id: complaintId,
    previous_status: "submitted",
    new_status: "assigned",
    actor_id: user.id,
    note: null,
  });

  await supabase.from("audit_log").insert({
    college_id: profile?.college_id,
    actor_id: user.id,
    action: "assigned",
    entity_type: "complaint",
    entity_id: complaintId,
    metadata: { worker_id: workerId, department_id: departmentId },
  });

  revalidatePath("/admin/queue");
  return { ok: true };
}

export async function approveComplaint(complaintId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: complaint, error: fetchError } = await supabase
    .from("complaints")
    .select("college_id, status, assigned_worker_id")
    .eq("id", complaintId)
    .single();
  if (fetchError || !complaint) return { error: "Complaint not found" };

  const { error } = await supabase
    .from("complaints")
    .update({ status: "completed", verified_by: user.id })
    .eq("id", complaintId);

  if (error) return { error: error.message };

  await supabase.from("complaint_status_history").insert({
    complaint_id: complaintId,
    previous_status: complaint.status,
    new_status: "completed",
    actor_id: user.id,
    note: null,
  });

  await supabase.from("audit_log").insert({
    college_id: complaint.college_id,
    actor_id: user.id,
    action: "approved",
    entity_type: "complaint",
    entity_id: complaintId,
    metadata: {},
  });

  revalidatePath("/admin/queue");
  return { ok: true };
}

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
    note: comment.trim(),
  });

  await supabase.from("audit_log").insert({
    college_id: complaint.college_id,
    actor_id: user.id,
    action: "reopened",
    entity_type: "complaint",
    entity_id: complaintId,
    metadata: { comment: comment.trim() },
  });

  revalidatePath("/admin/queue");
  return { ok: true };
}
