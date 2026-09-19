"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function approveAdmin(requestId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("approve_admin_request" as never, {
    p_request_id: requestId,
  } as never);
  if (error) return { error: error.message };
  revalidatePath("/super-admin/admin-requests");
  return { ok: true };
}

export async function rejectAdminRequest(requestId: string, reason: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("reject_role_request" as never, {
    p_request_id: requestId,
    p_reason: reason || "Not specified",
  } as never);
  if (error) return { error: error.message };
  revalidatePath("/super-admin/admin-requests");
  return { ok: true };
}

export async function toggleAdminSignup(collegeId: string, allow: boolean) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("colleges")
    .update({ allow_admin_signup: allow })
    .eq("id", collegeId);
  if (error) return { error: error.message };
  revalidatePath("/super-admin/admin-requests");
  return { ok: true };
}
