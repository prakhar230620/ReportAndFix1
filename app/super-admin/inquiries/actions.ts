"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

export async function markInquiryRead(id: string) {
  const admin = createAdminClient();
  await admin
    .from("contact_submissions")
    .update({ status: "read" })
    .eq("id", id)
    .eq("status", "pending");
  revalidatePath("/super-admin/inquiries");
}

export async function replyToInquiry(id: string, reply: string) {
  if (!reply?.trim()) return { error: "Reply cannot be empty." };
  const admin = createAdminClient();
  const { error } = await admin
    .from("contact_submissions")
    .update({
      status: "replied",
      reply: reply.trim(),
      replied_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/super-admin/inquiries");
  return { ok: true };
}
