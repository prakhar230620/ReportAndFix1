"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function startProcessing(complaintId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: complaint, error: fetchError } = await supabase
    .from("complaints")
    .select("status")
    .eq("id", complaintId)
    .single();
  if (fetchError || !complaint) return { error: "Task not found" };

  const { error } = await supabase
    .from("complaints")
    .update({ status: "processing" })
    .eq("id", complaintId);

  if (error) return { error: error.message };

  await supabase.from("complaint_status_history").insert({
    complaint_id: complaintId,
    previous_status: complaint.status,
    new_status: "processing",
    actor_id: user.id,
  });

  revalidatePath(`/worker/${complaintId}`);
  return { ok: true };
}

export async function addProgressUpdate(complaintId: string, note: string) {
  if (!note.trim()) return { error: "Note can't be empty." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase.from("complaint_progress_updates").insert({
    complaint_id: complaintId,
    worker_id: user.id,
    note: note.trim(),
  });

  if (error) return { error: error.message };
  return { ok: true };
}

export async function finishTask(complaintId: string, finalNote: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: complaint, error: fetchError } = await supabase
    .from("complaints")
    .select("status")
    .eq("id", complaintId)
    .single();
  if (fetchError || !complaint) return { error: "Task not found" };

  if (finalNote.trim()) {
    await supabase.from("complaint_progress_updates").insert({
      complaint_id: complaintId,
      worker_id: user.id,
      note: finalNote.trim(),
    });
  }

  const { error } = await supabase
    .from("complaints")
    .update({ status: "waiting_for_verification" })
    .eq("id", complaintId);

  if (error) return { error: error.message };

  await supabase.from("complaint_status_history").insert({
    complaint_id: complaintId,
    previous_status: complaint.status,
    new_status: "waiting_for_verification",
    actor_id: user.id,
  });

  revalidatePath(`/worker/${complaintId}`);
  return { ok: true };
}
