"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

export type DuplicateCandidate = {
  id: string;
  public_id: string;
  title: string;
  description: string | null;
  status: string;
  created_at: string;
  similarity: number;
  vote_count: number;
};

export async function checkDuplicates(
  token: string,
  categoryId: string,
  title: string,
  description: string
) {
  const supabase = await createClient();

  const { data: location, error: locError } = await supabase
    .from("locations")
    .select("id, active")
    .eq("qr_token", token)
    .maybeSingle();

  if (locError || !location || !location.active) {
    return { error: "This location is not available for reporting." };
  }

  const queryText = `${title} ${description}`.trim();

  const { data, error } = await supabase.rpc(
    "find_similar_open_complaints" as never,
    {
      p_location_id: location.id,
      p_category_id: categoryId,
      p_query: queryText,
    } as never
  );

  if (error) return { error: error.message };
  return { candidates: (data ?? []) as DuplicateCandidate[] };
}

async function recalculateComplaintPriority(complaintId: string, voteCount: number) {
  try {
    const adminClient = createAdminClient();
    const { data: comp } = await adminClient
      .from("complaints")
      .select("id, college_id, priority, public_id")
      .eq("id", complaintId)
      .single();

    if (!comp || !comp.college_id) return;

    // Get total members in this organisation to dynamically scale thresholds
    const { count: totalMembers } = await adminClient
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("college_id", comp.college_id);

    const orgSize = Math.max(totalMembers ?? 1, 10);
    const joinRatio = (voteCount / orgSize) * 100;

    let targetPriority: "low" | "medium" | "high" | "urgent" = "low";
    if (joinRatio >= 20 || voteCount >= 20) {
      targetPriority = "urgent";
    } else if (joinRatio >= 10 || voteCount >= 10) {
      targetPriority = "high";
    } else if (joinRatio >= 5 || voteCount >= 5) {
      targetPriority = "medium";
    }

    if (comp.priority !== targetPriority) {
      await adminClient
        .from("complaints")
        .update({ priority: targetPriority })
        .eq("id", complaintId);

      revalidatePath("/feed");
      revalidatePath(`/issues/${comp.public_id}`);
      revalidatePath("/admin/queue");
      revalidatePath(`/admin/queue/${comp.public_id}`);
      revalidatePath("/dept-admin/queue");
      revalidatePath(`/dept-admin/queue/${comp.public_id}`);
    }
  } catch (err) {
    console.warn("Priority recalculation warning:", err);
  }
}

export async function leaveComplaint(complaintId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("complaint_votes")
    .delete()
    .eq("complaint_id", complaintId)
    .eq("user_id", user.id);

  if (error) return { error: error.message };

  const { count } = await supabase
    .from("complaint_votes")
    .select("id", { count: "exact", head: true })
    .eq("complaint_id", complaintId);

  const finalCount = count ?? 0;
  await recalculateComplaintPriority(complaintId, finalCount);

  return { voteCount: finalCount };
}

export async function joinComplaint(complaintId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("complaint_votes")
    .insert({ complaint_id: complaintId, user_id: user.id });

  if (error) {
    if (error.code === "23505") {
      return { error: "You've already joined this complaint." };
    }
    return { error: error.message };
  }

  const { count } = await supabase
    .from("complaint_votes")
    .select("id", { count: "exact", head: true })
    .eq("complaint_id", complaintId);

  const finalCount = count ?? 1;
  await recalculateComplaintPriority(complaintId, finalCount);

  return { voteCount: finalCount };
}

export async function createComplaint(params: {
  token: string;
  categoryId: string;
  title: string;
  description: string;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: location, error: locError } = await supabase
    .from("locations")
    .select("id, college_id, active")
    .eq("qr_token", params.token)
    .maybeSingle();

  if (locError || !location || !location.active) {
    return { error: "This location is not available for reporting." };
  }

  // Check if organisation is frozen or expired
  const { data: college } = await supabase
    .from("colleges")
    .select("is_frozen, subscription_status")
    .eq("id", location.college_id)
    .single();

  if (
    college?.is_frozen ||
    ["expired", "frozen", "suspended", "cancelled"].includes(college?.subscription_status ?? "")
  ) {
    return { error: "Reporting is currently paused for this organisation due to inactive subscription. Please connect to your Organisational Admin." };
  }

  if (!params.title.trim()) return { error: "Title is required." };
  if (!params.categoryId) return { error: "Category is required." };

  // ── Plan Monthly Complaint Quota Enforcement ──
  const adminClient = createAdminClient();
  const { data: sub } = await adminClient
    .from("org_subscriptions")
    .select("status, plans(max_complaints_per_month)")
    .eq("college_id", location.college_id)
    .in("status", ["active", "trial", "grace", "manually_assigned"])
    .maybeSingle();

  const maxMonthly =
    sub && (sub.plans as any)?.max_complaints_per_month !== undefined
      ? (sub.plans as any).max_complaints_per_month
      : 100; // Default starter plan quota

  if (maxMonthly !== -1) {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const { count: monthlyCount } = await adminClient
      .from("complaints")
      .select("id", { count: "exact", head: true })
      .eq("college_id", location.college_id)
      .gte("created_at", startOfMonth.toISOString());

    if ((monthlyCount ?? 0) >= maxMonthly) {
      return {
        error: `Monthly complaint limit (${maxMonthly}) reached for this organisation. Please contact your administrator to upgrade your plan.`,
      };
    }
  }

  const { data: complaint, error } = await supabase
    .from("complaints")
    .insert({
      college_id: location.college_id,
      location_id: location.id,
      category_id: params.categoryId,
      title: params.title.trim(),
      description: params.description.trim() || null,
      is_anonymous: true,
      reporter_id: null,
    })
    .select("id, public_id, college_id")
    .single();

  if (error) return { error: error.message };
  return { complaint };
}
