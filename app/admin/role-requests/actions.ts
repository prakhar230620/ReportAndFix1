"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function approveWorker(requestId: string, departmentId: string | null) {
  const supabase = await createClient();
  const { data: req } = await supabase
    .from("role_requests")
    .select("user_id")
    .eq("id", requestId)
    .single();

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
