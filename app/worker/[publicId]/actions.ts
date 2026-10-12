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
    .select("status, public_id")
    .eq("id", complaintId)
    .single();
  if (fetchError || !complaint) return { error: "Task not found" };

  if (complaint.status === "waiting_for_verification" || complaint.status === "completed" || complaint.status === "closed") {
    return { error: "This task has already been submitted for verification.", status: complaint.status };
  }

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

  revalidatePath(`/worker/${complaint.public_id}`);
  revalidatePath(`/worker`);
  revalidatePath("/admin/queue");
  revalidatePath(`/admin/queue/${complaint.public_id}`);
  revalidatePath("/dept-admin/queue");
  revalidatePath(`/dept-admin/queue/${complaint.public_id}`);
  revalidatePath(`/issues/${complaint.public_id}`);
  revalidatePath("/feed");
  revalidatePath("/admin");
  revalidatePath("/dept-admin");
  return { ok: true, status: "processing" };
}

export async function addProgressUpdate(complaintId: string, note: string) {
  if (!note.trim()) return { error: "Note can't be empty." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: complaint } = await supabase
    .from("complaints")
    .select("public_id")
    .eq("id", complaintId)
    .single();

  const { error } = await supabase.from("complaint_progress_updates").insert({
    complaint_id: complaintId,
    worker_id: user.id,
    note: note.trim(),
  });

  if (error) return { error: error.message };

  if (complaint?.public_id) {
    revalidatePath(`/worker/${complaint.public_id}`);
    revalidatePath(`/admin/queue/${complaint.public_id}`);
    revalidatePath(`/dept-admin/queue/${complaint.public_id}`);
    revalidatePath(`/issues/${complaint.public_id}`);
  }
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
    .select("status, public_id")
    .eq("id", complaintId)
    .single();
  if (fetchError || !complaint) return { error: "Task not found" };

  if (complaint.status === "waiting_for_verification" || complaint.status === "completed" || complaint.status === "closed") {
    return { ok: true, status: complaint.status };
  }

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

  revalidatePath(`/worker/${complaint.public_id}`);
  revalidatePath(`/worker`);
  revalidatePath("/admin/queue");
  revalidatePath(`/admin/queue/${complaint.public_id}`);
  revalidatePath("/dept-admin/queue");
  revalidatePath(`/dept-admin/queue/${complaint.public_id}`);
  revalidatePath(`/issues/${complaint.public_id}`);
  revalidatePath("/feed");
  revalidatePath("/admin");
  revalidatePath("/dept-admin");
  return { ok: true, status: "waiting_for_verification" };
}
