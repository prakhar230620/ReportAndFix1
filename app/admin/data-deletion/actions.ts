"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { deleteFromB2 } from "@/lib/b2";
import { invalidateMediaCache } from "@/lib/media";


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

  // 1. Fetch complaints media to delete from B2
  const { data: complaints } = await adminClient
    .from("complaints")
    .select("id, image_urls")
    .in("id", request.complaint_ids);

  for (const c of complaints ?? []) {
    for (const rawUrl of c.image_urls ?? []) {
      if (!rawUrl) continue;
      let key = rawUrl;
      if (rawUrl.includes("?path=")) {
        key = decodeURIComponent(rawUrl.split("?path=")[1]);
      } else if (rawUrl.startsWith("http://") || rawUrl.startsWith("https://")) {
        try {
          const parsed = new URL(rawUrl);
          key = parsed.pathname.replace(/^\//, "");
        } catch {}
      }
      try {
        await deleteFromB2(key);
        await invalidateMediaCache(key);
      } catch (e) {
        console.warn(`[permanent-deletion] failed to delete ${key}:`, e);
      }
    }
  }

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

  revalidatePath("/admin/data-deletion");
  return { ok: true };
}

