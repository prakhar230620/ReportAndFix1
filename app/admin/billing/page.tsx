import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  CreditCard,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Download,
  Zap,
  Shield,
  ChevronRight,
  MessageSquare,
  HardDrive,
  Users,
} from "lucide-react";
import { formatPrice, getDaysRemaining, planColor, planFeatureLabel, isUnlimited } from "@/lib/plans";
import PlanUpgradeModal from "@/app/admin/billing/PlanUpgradeModal";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function BillingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const adminClient = createAdminClient();

  const { data: profile } = await adminClient
    .from("profiles")
    .select("role, college_id, display_name, colleges(name, logo_url)")
    .eq("id", user.id)
    .single();

  if (!profile || (profile.role !== "college_admin" && profile.role !== "super_admin")) {
    redirect("/");
  }

  const collegeId = profile.college_id!;

  const [
    { data: subscription },
    { data: allPlans },
    { data: transactions },
    usage,
  ] = await Promise.all([

    adminClient
      .from("org_subscriptions")
      .select("*, plans(*)")
      .eq("college_id", collegeId)
      .maybeSingle(),
    adminClient
      .from("plans")
      .select("*")
      .eq("is_active", true)
      .order("sort_order"),
    adminClient
      .from("payment_transactions")
      .select("id, amount_paise, status, payment_method, invoice_number, description, created_at")
      .eq("college_id", collegeId)
      .neq("status", "created")
      .order("created_at", { ascending: false })
      .limit(10),
    Promise.all([
      adminClient.from("complaints").select("id", { count: "exact", head: true }).eq("college_id", collegeId),
      adminClient.from("profiles").select("id", { count: "exact", head: true }).eq("college_id", collegeId).eq("role", "worker"),
      adminClient.from("departments").select("id", { count: "exact", head: true }).eq("college_id", collegeId),
    ]),
  ]);

  const currentPlan = (subscription?.plans as any) ?? null;
  const daysLeft = subscription?.current_period_end ? getDaysRemaining(subscription.current_period_end) : null;
  const color = currentPlan ? planColor(currentPlan.slug) : planColor("");

  const [{ count: totalComplaints }, { count: totalWorkers }, { count: totalDepts }] = usage;

  const statusColors: Record<string, string> = {
    active: "bg-emerald-100 text-emerald-800",
    trial: "bg-blue-100 text-blue-800",
    grace: "bg-amber-100 text-amber-800",
    expired: "bg-red-100 text-red-800",
    frozen: "bg-red-100 text-red-800",
    cancelled: "bg-neutral-100 text-neutral-700",
    manually_assigned: "bg-violet-100 text-violet-800",
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-neutral-900">Plans & Billing</h1>
        <p className="text-sm text-neutral-500">
          Manage your subscription, payments, and invoices
        </p>
      </div>

      {/* Current Plan Card */}
      <div className={`rounded-2xl border p-6 shadow-sm ${color.border} ${color.bg}`}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-xs font-semibold uppercase tracking-wider ${color.text}`}>Current Plan</span>
              {subscription?.status && (
                <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${statusColors[subscription.status] ?? ""}`}>
                  {subscription.status.replace("_", " ")}
                </span>
              )}
            </div>
            <h2 className="text-2xl font-bold text-neutral-900">
              {currentPlan?.name ?? "No Plan Active"}
            </h2>
            <p className="text-sm text-neutral-600 mt-0.5">
              {currentPlan?.description ?? "Subscribe to a plan to unlock your organisation's operations."}
            </p>
          </div>

          <div className="text-right">
            {currentPlan && subscription?.billing_cycle === "monthly" ? (
              <div>
                <p className="text-2xl font-bold text-neutral-900">
                  {formatPrice(currentPlan.price_monthly_paise)}
                  <span className="text-sm font-normal text-neutral-500">/mo</span>
                </p>
                <p className="text-xs text-neutral-500">
                  Billed monthly · Save {Math.round((1 - currentPlan.price_yearly_paise / (currentPlan.price_monthly_paise * 12)) * 100)}% yearly
                </p>
              </div>
            ) : currentPlan ? (
              <div>
                <p className="text-2xl font-bold text-neutral-900">
                  {formatPrice(currentPlan.price_yearly_paise)}
                  <span className="text-sm font-normal text-neutral-500">/yr</span>
                </p>
              </div>
            ) : null}
          </div>
        </div>

        {/* Expiry & renewal info */}
        {subscription?.current_period_end && (
          <div className={`mt-4 flex items-center gap-2 text-sm ${daysLeft !== null && daysLeft <= 7 ? "text-red-700" : "text-neutral-600"}`}>
            <Clock className="h-4 w-4 shrink-0" />
            {daysLeft !== null && daysLeft > 0
              ? `${daysLeft} days remaining · Renews ${new Date(subscription.current_period_end).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}`
              : "Plan expired"}
          </div>
        )}

        {daysLeft !== null && daysLeft <= 15 && daysLeft > 0 && (
          <div className="mt-3 flex items-center gap-2 rounded-xl bg-amber-100 border border-amber-200 px-4 py-2 text-sm text-amber-800">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            Renew before {new Date(subscription!.current_period_end).toLocaleDateString()} to avoid service interruption.
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <PlanUpgradeModal
            currentPlanSlug={currentPlan?.slug}
            plans={allPlans ?? []}
            collegeId={collegeId}
            billingCycle={subscription?.billing_cycle ?? "monthly"}
          />
          {subscription && (
            <a
              href="/admin/billing/cancel"
              className="rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition"
            >
              Cancel Plan
            </a>
          )}
        </div>
      </div>

      {/* Usage Meters */}
      {currentPlan && (
        <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
          <h3 className="text-base font-semibold text-neutral-900 mb-4">Current Usage</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <UsageMeter
              icon={<HardDrive className="h-4 w-4 text-blue-500" />}
              label="Complaints (this month)"
              used={totalComplaints ?? 0}
              max={currentPlan.max_complaints_per_month}
            />
            <UsageMeter
              icon={<Users className="h-4 w-4 text-violet-500" />}
              label="Workers"
              used={totalWorkers ?? 0}
              max={currentPlan.max_workers}
            />
            <UsageMeter
              icon={<Shield className="h-4 w-4 text-indigo-500" />}
              label="Departments"
              used={totalDepts ?? 0}
              max={currentPlan.max_departments}
            />
          </div>
        </div>
      )}

      {/* Plan Features */}
      {currentPlan && (
        <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
          <h3 className="text-base font-semibold text-neutral-900 mb-3">Plan Features</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {(currentPlan.features as string[]).map((f: string) => (
              <div key={f} className="flex items-center gap-2 text-sm text-neutral-700">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                {f}
              </div>
            ))}
            <div className="flex items-center gap-2 text-sm text-neutral-700">
              <MessageSquare className="h-4 w-4 text-violet-500 shrink-0" />
              {currentPlan.messaging_enabled ? `In-app messaging (${currentPlan.message_retention_hours}h retention)` : "In-app messaging: Not included"}
            </div>
            <div className="flex items-center gap-2 text-sm text-neutral-700">
              <Download className="h-4 w-4 text-neutral-500 shrink-0" />
              {currentPlan.data_download_free ? "Free data export" : "Data export (paid)"}
            </div>
            <div className="flex items-center gap-2 text-sm text-neutral-700">
              <HardDrive className="h-4 w-4 text-blue-500 shrink-0" />
              {planFeatureLabel(currentPlan.max_storage_gb, "GB storage")}
            </div>
            <div className="flex items-center gap-2 text-sm text-neutral-700">
              <Users className="h-4 w-4 text-violet-500 shrink-0" />
              {isUnlimited(currentPlan.max_workers) ? "Unlimited workers" : `Up to ${currentPlan.max_workers} workers`}
            </div>
          </div>
        </div>
      )}

      {/* Payment History */}
      <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-neutral-900">Payment History</h3>
          <Link href="/admin/billing/transactions" className="text-xs font-medium text-blue-600 hover:text-blue-700">
            View all <ChevronRight className="inline h-3.5 w-3.5" />
          </Link>
        </div>

        {(transactions ?? []).length === 0 ? (
          <p className="text-sm text-neutral-500 py-4 text-center">No transactions yet.</p>
        ) : (
          <div className="divide-y divide-neutral-100">
            {(transactions ?? []).map((t) => (
              <div key={t.id} className="flex items-center justify-between py-3 text-sm">
                <div>
                  <p className="font-medium text-neutral-900">{t.description ?? "Plan payment"}</p>
                  <p className="text-xs text-neutral-500">
                    {t.invoice_number ?? "—"} · {new Date(t.created_at).toLocaleDateString("en-IN")}
                    {t.payment_method && ` · ${t.payment_method.toUpperCase()}`}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    t.status === "paid" ? "bg-emerald-100 text-emerald-800" :
                    t.status === "failed" ? "bg-red-100 text-red-800" :
                    t.status === "refunded" ? "bg-blue-100 text-blue-800" :
                    "bg-amber-100 text-amber-800"
                  }`}>
                    {t.status === "created" ? "Pending / Unpaid" : t.status.toUpperCase()}
                  </span>
                  <span className="font-semibold text-neutral-900">
                    ₹{((t.amount_paise ?? 0) / 100).toLocaleString("en-IN")}
                  </span>
                  {t.status === "paid" && (
                    <a
                      href={`/api/payments/invoice/${t.id}`}
                      className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Invoice
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Danger Zone */}
      <div className="rounded-xl border border-red-200 bg-red-50/50 p-5 shadow-sm">
        <h3 className="text-base font-semibold text-red-900 mb-2">Danger Zone</h3>
        <p className="text-sm text-red-700 mb-4">
          Permanently delete completed complaint data. This action requires approval from all org admins and a mandatory data download.
        </p>
        <Link
          href="/admin/data-deletion"
          className="inline-flex items-center gap-2 rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 transition"
        >
          <Download className="h-4 w-4" />
          Manage Data Deletion
        </Link>
      </div>
    </div>
  );
}

function UsageMeter({ icon, label, used, max }: { icon: React.ReactNode; label: string; used: number; max: number }) {
  const pct = max === -1 ? 10 : Math.min(100, Math.round((used / max) * 100));
  const isOver = max !== -1 && used > max;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1.5 text-xs font-medium text-neutral-600">
        {icon}
        {label}
      </div>
      <div className="h-2 rounded-full bg-neutral-100 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${isOver ? "bg-red-500" : pct > 75 ? "bg-amber-500" : "bg-emerald-500"}`}
          style={{ width: `${max === -1 ? 20 : pct}%` }}
        />
      </div>
      <p className="text-xs text-neutral-500">
        {used} / {max === -1 ? "Unlimited" : max}
        {isOver && <span className="text-red-600 font-semibold ml-1">Over limit</span>}
      </p>
    </div>
  );
}
