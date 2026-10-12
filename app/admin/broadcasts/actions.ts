"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

export type CreateBroadcastParams = {
  title: string;
  message: string;
  priority: "info" | "announcement" | "warning" | "urgent" | "maintenance";
  durationHours: number;
  targetRoles?: string[];
};

export async function createBroadcast(params: CreateBroadcastParams) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { ok: false, error: "Authentication required." };
    }

    const adminClient = createAdminClient();
    const { data: profile } = await adminClient
      .from("profiles")
      .select("role, college_id, display_name")
      .eq("id", user.id)
      .single();

    if (!profile || (profile.role !== "college_admin" && profile.role !== "super_admin")) {
      return { ok: false, error: "Only Organisation Administrators can broadcast messages." };
    }

    const collegeId = profile.college_id;
    if (!collegeId) {
      return { ok: false, error: "No organization associated with this account." };
    }

    // Check plan quota / permission for broadcasting
    const { data: sub } = await adminClient
      .from("org_subscriptions")
      .select("status, plans(broadcasting_enabled, name, slug)")
      .eq("college_id", collegeId)
      .in("status", ["active", "trial", "manually_assigned"])
      .maybeSingle();

    const plan = sub?.plans as any;
    if (plan && plan.broadcasting_enabled === false) {
      return {
        ok: false,
        error: `Broadcasting is not enabled on your current plan (${plan.name ?? "current plan"}). Please upgrade to a higher tier plan (Professional or Enterprise) in Plans & Billing to broadcast announcements.`,
      };
    }

    const title = params.title?.trim();
    if (!title) {
      return { ok: false, error: "Broadcast title is required." };
    }
    if (title.length > 150) {
      return { ok: false, error: "Broadcast title cannot exceed 150 characters." };
    }

    const message = params.message?.trim();
    if (!message) {
      return { ok: false, error: "Broadcast message is required." };
    }
    if (message.length > 2500) {
      return { ok: false, error: "Broadcast message cannot exceed 2500 characters." };
    }

    // Strict validation: maximum 72 hours as specified by user
    const duration = Math.min(72, Math.max(1, Math.round(Number(params.durationHours) || 24)));
    const now = new Date();
    const expiresAt = new Date(now.getTime() + duration * 60 * 60 * 1000).toISOString();

    const priority = ["info", "announcement", "warning", "urgent", "maintenance"].includes(params.priority)
      ? params.priority
      : "info";

    const targetRoles = Array.isArray(params.targetRoles) && params.targetRoles.length > 0
      ? params.targetRoles
      : ["all"];

    const { data: inserted, error: insertError } = await adminClient
      .from("broadcasts")
      .insert({
        college_id: collegeId,
        creator_id: user.id,
        title,
        message,
        priority,
        duration_hours: duration,
        target_roles: targetRoles,
        expires_at: expiresAt,
        is_active: true,
      })
      .select("id")
      .single();

    if (insertError) {
      console.error("[createBroadcast] Insert error:", insertError);
      return { ok: false, error: insertError.message };
    }

    // Revalidate paths where broadcasts appear
    revalidatePath("/admin/broadcasts");
    revalidatePath("/admin");
    revalidatePath("/dept-admin");
    revalidatePath("/worker");
    revalidatePath("/");

    return { ok: true, broadcastId: inserted.id };
  } catch (err: any) {
    console.error("[createBroadcast] Exception:", err);
    return { ok: false, error: err.message || "Failed to publish broadcast." };
  }
}

export async function deleteBroadcast(broadcastId: string) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { ok: false, error: "Authentication required." };
    }

    const adminClient = createAdminClient();
    const { data: profile } = await adminClient
      .from("profiles")
      .select("role, college_id")
      .eq("id", user.id)
      .single();

    if (!profile || (profile.role !== "college_admin" && profile.role !== "super_admin")) {
      return { ok: false, error: "Unauthorized." };
    }

    // Verify broadcast belongs to this admin's college (prevents cross-org tampering)
    const { data: broadcast } = await adminClient
      .from("broadcasts")
      .select("id, college_id")
      .eq("id", broadcastId)
      .single();

    if (!broadcast) {
      return { ok: false, error: "Broadcast not found." };
    }

    if (profile.role !== "super_admin" && broadcast.college_id !== profile.college_id) {
      return { ok: false, error: "Access denied: cannot modify broadcasts of another organization." };
    }

    const { error: deleteError } = await adminClient
      .from("broadcasts")
      .delete()
      .eq("id", broadcastId);

    if (deleteError) {
      return { ok: false, error: deleteError.message };
    }

    revalidatePath("/admin/broadcasts");
    revalidatePath("/admin");
    revalidatePath("/dept-admin");
    revalidatePath("/worker");
    revalidatePath("/");

    return { ok: true };
  } catch (err: any) {
    console.error("[deleteBroadcast] Exception:", err);
    return { ok: false, error: err.message || "Failed to remove broadcast." };
  }
}
