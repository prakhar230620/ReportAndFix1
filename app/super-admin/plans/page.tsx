import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { formatPrice, planColor } from "@/lib/plans";
import PlanEditor from "@/app/super-admin/plans/PlanEditor";

import { Plus } from "lucide-react";

export default async function SuperAdminPlansPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "super_admin") redirect("/");

  const adminClient = createAdminClient();
  const { data: plans } = await adminClient
    .from("plans")
    .select("*")
    .order("sort_order");

  // Usage stats per plan
  const { data: subStats } = await adminClient
    .from("org_subscriptions")
    .select("plan_id, status")
    .in("status", ["active", "trial", "manually_assigned"]);

  const planUsage = new Map<string, number>();
  for (const sub of subStats ?? []) {
    planUsage.set(sub.plan_id, (planUsage.get(sub.plan_id) ?? 0) + 1);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-neutral-900">Plan Management</h1>
          <p className="text-sm text-neutral-500">Create, edit, and manage platform subscription plans</p>
        </div>
        <PlanEditor mode="create" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {(plans ?? []).map((plan) => {
          const color = planColor(plan.slug);
          const activeOrgs = planUsage.get(plan.id) ?? 0;
          return (
            <div key={plan.id} className={`rounded-2xl border-2 p-5 ${color.border} ${color.bg}`}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <span className={`text-xs font-semibold uppercase tracking-wider ${color.text}`}>
                    {plan.slug}
                  </span>
                  <h3 className="text-lg font-bold text-neutral-900 mt-0.5">{plan.name}</h3>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${plan.is_active ? "bg-emerald-100 text-emerald-800" : "bg-neutral-100 text-neutral-600"}`}>
                  {plan.is_active ? "Active" : "Inactive"}
                </span>
              </div>

              <p className="text-sm text-neutral-600 mb-3">{plan.description}</p>

              <div className="flex justify-between text-sm mb-1">
                <span className="text-neutral-500">Monthly</span>
                <span className="font-semibold">{formatPrice(plan.price_monthly_paise)}</span>
              </div>
              <div className="flex justify-between text-sm mb-4">
                <span className="text-neutral-500">Yearly</span>
                <span className="font-semibold">{formatPrice(plan.price_yearly_paise)}</span>
              </div>

              <div className="flex justify-between text-xs text-neutral-500 mb-4">
                <span>{activeOrgs} org{activeOrgs !== 1 ? "s" : ""} on this plan</span>
              </div>

              <ul className="text-xs text-neutral-600 space-y-1 mb-4">
                <li>Storage: {plan.max_storage_gb === -1 ? "Unlimited" : `${plan.max_storage_gb} GB`}</li>
                <li>Workers: {plan.max_workers === -1 ? "Unlimited" : plan.max_workers}</li>
                <li>Departments: {plan.max_departments === -1 ? "Unlimited" : plan.max_departments}</li>
                <li>Admins: {plan.max_admins === -1 ? "Unlimited" : plan.max_admins}</li>
                <li>Messaging: {plan.messaging_enabled ? `Yes (${plan.message_retention_hours}h)` : "No"}</li>
                <li>Free export: {plan.data_download_free ? "Yes" : "No"}</li>
              </ul>

              <PlanEditor mode="edit" plan={plan} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
