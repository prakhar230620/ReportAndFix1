"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

export async function savePlan(plan: {
  id?: string; name: string; slug: string; description: string | null;
  price_monthly_paise: number; price_yearly_paise: number;
  max_storage_gb: number; max_complaints_per_month: number;
  max_workers: number; max_departments: number; max_admins: number;
  data_download_free: boolean; messaging_enabled: boolean;
  broadcasting_enabled?: boolean;
  message_retention_hours: number; features: string[];
  is_active: boolean; sort_order: number;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const adminClient = createAdminClient();
  const { data: profile } = await adminClient.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "super_admin") return { error: "Unauthorized" };

  if (plan.id) {
    const { error } = await adminClient.from("plans").update({
      name: plan.name, slug: plan.slug, description: plan.description,
      price_monthly_paise: plan.price_monthly_paise, price_yearly_paise: plan.price_yearly_paise,
      max_storage_gb: plan.max_storage_gb, max_complaints_per_month: plan.max_complaints_per_month,
      max_workers: plan.max_workers, max_departments: plan.max_departments, max_admins: plan.max_admins,
      data_download_free: plan.data_download_free, messaging_enabled: plan.messaging_enabled,
      broadcasting_enabled: plan.broadcasting_enabled ?? false,
      message_retention_hours: plan.message_retention_hours,
      features: plan.features, is_active: plan.is_active, sort_order: plan.sort_order,
    }).eq("id", plan.id);
    if (error) return { error: error.message };
  } else {
    const { error } = await adminClient.from("plans").insert({
      name: plan.name, slug: plan.slug, description: plan.description,
      price_monthly_paise: plan.price_monthly_paise, price_yearly_paise: plan.price_yearly_paise,
      max_storage_gb: plan.max_storage_gb, max_complaints_per_month: plan.max_complaints_per_month,
      max_workers: plan.max_workers, max_departments: plan.max_departments, max_admins: plan.max_admins,
      data_download_free: plan.data_download_free, messaging_enabled: plan.messaging_enabled,
      broadcasting_enabled: plan.broadcasting_enabled ?? false,
      message_retention_hours: plan.message_retention_hours,
      features: plan.features, is_active: plan.is_active, sort_order: plan.sort_order,
    });
    if (error) return { error: error.message };
  }

  revalidatePath("/super-admin/plans");
  return { ok: true };
}

export async function deletePlan(planId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const adminClient = createAdminClient();
  const { data: profile } = await adminClient.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "super_admin") return { error: "Unauthorized" };

  // Soft-delete: mark inactive rather than hard delete
  const { error } = await adminClient.from("plans").update({ is_active: false }).eq("id", planId);
  if (error) return { error: error.message };

  revalidatePath("/super-admin/plans");
  return { ok: true };
}

export async function manuallyAssignPlan(collegeId: string, planId: string, notes?: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const adminClient = createAdminClient();
  const { data: profile } = await adminClient.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "super_admin") return { error: "Unauthorized" };

  const now = new Date();
  const periodEnd = new Date(now);
  periodEnd.setMonth(periodEnd.getMonth() + 1);

  await adminClient.from("org_subscriptions").upsert({
    college_id: collegeId, plan_id: planId, status: "manually_assigned",
    billing_cycle: "monthly", current_period_start: now.toISOString(),
    current_period_end: periodEnd.toISOString(), auto_renew: false,
    assigned_by: user.id, notes: notes ?? "Manually assigned by super admin",
    updated_at: now.toISOString(),
  }, { onConflict: "college_id" });

  // Unfreeze org
  await adminClient.from("colleges")
    .update({ is_frozen: false, frozen_reason: null, frozen_at: null })
    .eq("id", collegeId);

  revalidatePath("/super-admin");
  return { ok: true };
}
