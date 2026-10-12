"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { deleteFromB2 } from "@/lib/b2";
import { invalidateMediaCache } from "@/lib/media";
import { invalidateCache } from "@/lib/cache";


export async function createDeletionRequest({
  collegeId,
  userId,
  complaintIds,
}: {
  collegeId: string;
  userId: string;
  complaintIds: string[];
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.id !== userId) return { error: "Unauthorized" };

  const adminClient = createAdminClient();

  // Verify user is college_admin for this org
  const { data: profile } = await adminClient
    .from("profiles")
    .select("role, college_id")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "college_admin" || profile.college_id !== collegeId) {
    return { error: "Unauthorized" };
  }

  // Count total org admins — determines approvals_required
  const { count: adminCount } = await adminClient
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("college_id", collegeId)
    .eq("role", "college_admin");

  // Verify all complaints are completed & belong to this org
  const { data: validComplaints } = await adminClient
    .from("complaints")
    .select("id")
    .eq("college_id", collegeId)
    .eq("status", "completed")
    .is("deleted_at", null)
    .in("id", complaintIds);

  const validIds = validComplaints?.map((c) => c.id) ?? [];
  if (validIds.length === 0) return { error: "No valid complaints selected." };

  // Insert deletion request with requesting admin's approval already counted
  const initialApprovals: Record<string, string> = {};
  initialApprovals[user.id] = new Date().toISOString();

  const { data: request, error } = await adminClient
    .from("data_deletion_requests")
    .insert({
      college_id: collegeId,
      requested_by: user.id,
      approvals_required: adminCount ?? 1,
      approvals_received: initialApprovals,
      complaint_ids: validIds,
      complaint_count: validIds.length,
      status: (adminCount ?? 1) <= 1 ? "pending_download" : "pending_approvals",
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  // Notify other admins
  if ((adminCount ?? 1) > 1) {
    const { data: otherAdmins } = await adminClient
      .from("profiles")
      .select("id")
      .eq("college_id", collegeId)
      .eq("role", "college_admin")
      .neq("id", user.id);

    for (const admin of otherAdmins ?? []) {
      await adminClient.from("plan_notifications").insert({
        college_id: collegeId,
        profile_id: admin.id,
        type: "soft_delete_warning",
        title: "Data deletion approval required",
        body: `An admin has initiated a deletion of ${validIds.length} completed complaints. Your approval is required.`,
        metadata: { deletion_request_id: request?.id },
      });
    }
  }

  revalidatePath("/admin/data-deletion");
  return { ok: true };
}

export async function approveDeletionRequest(requestId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const adminClient = createAdminClient();
  const { data: profile } = await adminClient
    .from("profiles")
    .select("role, college_id")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "college_admin") return { error: "Unauthorized" };

  const { data: request } = await adminClient
    .from("data_deletion_requests")
    .select("*")
    .eq("id", requestId)
    .eq("college_id", profile.college_id!)
    .single();

  if (!request) return { error: "Request not found" };
  if (request.status !== "pending_approvals") return { error: "Request is not awaiting approvals" };

  const approvals: Record<string, string> = { ...request.approvals_received };
  approvals[user.id] = new Date().toISOString();

  const allApproved = Object.keys(approvals).length >= request.approvals_required;

  await adminClient
    .from("data_deletion_requests")
    .update({
      approvals_received: approvals,
      status: allApproved ? "pending_download" : "pending_approvals",
    })
    .eq("id", requestId);

  revalidatePath("/admin/data-deletion");
  return { ok: true };
}

export async function executePermanentDeletion(requestId: string) {

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const adminClient = createAdminClient();
  const { data: profile } = await adminClient
    .from("profiles")
    .select("role, college_id")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "college_admin") return { error: "Unauthorized" };

  const { data: request } = await adminClient
    .from("data_deletion_requests")
    .select("*")
    .eq("id", requestId)
    .eq("college_id", profile.college_id!)
    .single();

  if (!request) return { error: "Request not found" };
  if (request.status !== "download_ready" && request.status !== "pending_download") {
    return { error: "Data must be downloaded before permanent deletion." };
  }

  // 1. Fetch media from complaint_media table to delete from B2
  const { data: mediaFiles } = await adminClient
    .from("complaint_media")
    .select("storage_path")
    .in("complaint_id", request.complaint_ids);

  for (const m of mediaFiles ?? []) {
    const key = m.storage_path;
    if (!key) continue;
    try {
      await deleteFromB2(key);
      await invalidateMediaCache(key);
    } catch (e) {
      console.warn(`[permanent-deletion] failed to delete ${key}:`, e);
    }
  }

  // Delete rows from complaint_media table
  await adminClient
    .from("complaint_media")
    .delete()
    .in("complaint_id", request.complaint_ids);

  const now = new Date().toISOString();

  // 2. Soft delete complaints in database
  await adminClient
    .from("complaints")
    .update({
      deleted_at: now,
      deleted_by: user.id,
      deletion_request_id: requestId,
    })
    .in("id", request.complaint_ids);

  // 3. Mark deletion request as completed
  await adminClient
    .from("data_deletion_requests")
    .update({
      status: "completed",
      deleted_at: now,
    })
    .eq("id", requestId);

  // 4. Invalidate Redis feed caches
  if (profile.college_id) {
    await invalidateCache(
      `feed:open:${profile.college_id}`,
      `feed:completed:${profile.college_id}`
    );
  }

  // 5. Revalidate Next.js paths
  revalidatePath("/admin/data-deletion", "page");
  revalidatePath("/admin/queue", "page");
  revalidatePath("/dept-admin/queue", "page");
  revalidatePath("/feed", "page");
  revalidatePath("/admin", "page");
  revalidatePath("/", "page");

  return { ok: true };
}

/**
 * Called after successful Razorpay payment for the data download fee.
 * Verifies the payment signature server-side and unlocks the download button.
 */
export async function verifyDownloadPayment({
  requestId,
  orderId,
  paymentId,
  signature,
  transactionId,
}: {
  requestId: string;
  orderId: string;
  paymentId: string;
  signature: string;
  transactionId?: string;
}): Promise<{ ok?: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const adminClient = createAdminClient();

  // Verify HMAC signature server-side
  const crypto = await import("crypto");
  const expectedSig = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");

  if (expectedSig !== signature) {
    return { error: "Payment signature verification failed." };
  }

  const { data: profile } = await adminClient
    .from("profiles")
    .select("role, college_id")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "college_admin") return { error: "Unauthorized" };

  // Mark transaction as paid
  if (transactionId) {
    await adminClient
      .from("payment_transactions")
      .update({ status: "paid", razorpay_payment_id: paymentId })
      .eq("id", transactionId);
  }

  // Stamp the deletion request with the payment id to unlock download
  await adminClient
    .from("data_deletion_requests")
    .update({
      charge_paid: true,
      charge_payment_id: paymentId,
      status: "download_ready",
    })
    .eq("id", requestId)
    .eq("college_id", profile.college_id!);

  revalidatePath("/admin/data-deletion", "page");
  revalidatePath("/admin/data-deletion", "layout");
  return { ok: true };
}
