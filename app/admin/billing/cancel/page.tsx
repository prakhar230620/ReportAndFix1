import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  ShieldAlert,
  AlertOctagon,
  ArrowLeft,
  Calendar,
  FileText,
  HelpCircle,
  CheckCircle2,
  XCircle,
} from "lucide-react";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CancelPolicyPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const adminClient = createAdminClient();

  const { data: profile } = await adminClient
    .from("profiles")
    .select("role, college_id")
    .eq("id", user.id)
    .single();

  if (!profile || (profile.role !== "college_admin" && profile.role !== "super_admin")) {
    redirect("/");
  }

  const collegeId = profile.college_id!;

  const { data: subscription } = await adminClient
    .from("org_subscriptions")
    .select("*, plans(*)")
    .eq("college_id", collegeId)
    .maybeSingle();

  const planName = (subscription?.plans as any)?.name ?? "Active Plan";
  const periodEnd = subscription?.current_period_end
    ? new Date(subscription.current_period_end).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  return (
    <div className="mx-auto max-w-3xl py-8 px-4 sm:px-6">
      {/* Back to Billing */}
      <div className="mb-6">
        <Link
          href="/admin/billing"
          className="inline-flex items-center gap-2 text-sm font-medium text-neutral-600 hover:text-neutral-900 transition"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Billing Dashboard
        </Link>
      </div>

      <div className="rounded-2xl border border-neutral-200 bg-white p-6 sm:p-10 shadow-sm">
        {/* Header Badge */}
        <div className="inline-flex items-center gap-2 rounded-full bg-rose-50 border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-700 uppercase tracking-wider mb-4">
          <ShieldAlert className="h-3.5 w-3.5" />
          Subscription & Refund Governance
        </div>

        <h1 className="text-2xl sm:text-3xl font-black text-neutral-900 tracking-tight">
          Plan Cancellation & Refund Policy
        </h1>
        <p className="mt-2 text-sm text-neutral-600">
          Important terms regarding subscription terms, cancellations, and refund eligibility on ReportAndFix.
        </p>

        {/* Current Plan Summary Card */}
        {subscription && (
          <div className="mt-6 rounded-xl border border-blue-100 bg-blue-50/70 p-4 text-sm text-blue-900 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <div className="text-xs uppercase font-bold tracking-wider text-blue-600">
                Your Current Organisation Plan
              </div>
              <div className="text-base font-bold text-neutral-900 mt-0.5">
                {planName} ({subscription.billing_cycle})
              </div>
            </div>
            {periodEnd && (
              <div className="flex items-center gap-2 text-xs font-semibold text-neutral-700 bg-white px-3 py-2 rounded-lg border border-blue-200 shadow-2xs">
                <Calendar className="h-4 w-4 text-blue-600 shrink-0" />
                Active through {periodEnd}
              </div>
            )}
          </div>
        )}

        {/* Core Policy Points */}
        <div className="mt-8 space-y-5">
          <div className="flex items-start gap-4 rounded-xl border border-neutral-100 bg-neutral-50 p-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-rose-100 text-rose-700">
              <XCircle className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-neutral-900">
                No Mid-Term Cancellation Facility
              </h3>
              <p className="mt-1 text-xs text-neutral-600 leading-relaxed">
                ReportAndFix does not provide facilities for mid-cycle plan cancellations. Once an organisation subscribes to a tier, the plan remains fixed for its entire duration.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4 rounded-xl border border-neutral-100 bg-neutral-50 p-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-neutral-900">
                Mandatory Plan Utilization
              </h3>
              <p className="mt-1 text-xs text-neutral-600 leading-relaxed">
                Subscribers must continue to run and utilize their active plan. All features, quotas (monthly complaints, field technicians, department allocations, and broadcast tools) remain fully operational and accessible until {periodEnd ? periodEnd : "the end of your billing cycle"}.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4 rounded-xl border border-neutral-100 bg-neutral-50 p-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
              <AlertOctagon className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-neutral-900">
                Strict Non-Refundable Terms
              </h3>
              <p className="mt-1 text-xs text-neutral-600 leading-relaxed">
                If an organisation chooses not to use the platform, stops operations, or desires early termination, <strong>no refunds or prorated credits are provided</strong> under any circumstances.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4 rounded-xl border border-emerald-100 bg-emerald-50/50 p-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-neutral-900">
                Refunds Exclusively for Technical Payment Failures
              </h3>
              <p className="mt-1 text-xs text-neutral-600 leading-relaxed">
                Refunds are granted <em>only</em> if funds were deducted from your bank/card/UPI account during a payment gateway failure (where the subscription failed to activate) or in the case of duplicate transaction charges for the identical billing cycle. Such refunds are returned to the source payment method within 5–7 banking days.
              </p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-8 flex flex-col sm:flex-row items-center gap-3 border-t border-neutral-200 pt-6">
          <Link
            href="/admin/billing"
            className="w-full sm:w-auto inline-flex items-center justify-center rounded-xl bg-neutral-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-neutral-800 transition"
          >
            Return to Billing Dashboard
          </Link>

          <Link
            href="/terms#cancellation-refund"
            target="_blank"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-xl border border-neutral-300 bg-white px-5 py-2.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition"
          >
            <FileText className="h-4 w-4 text-neutral-500" />
            View Full Terms & Policies
          </Link>
        </div>
      </div>
    </div>
  );
}
