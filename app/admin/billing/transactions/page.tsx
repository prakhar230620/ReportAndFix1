import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  CreditCard,
  Download,
  ArrowLeft,
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle,
  FileText,
  Search,
} from "lucide-react";
import { formatPrice } from "@/lib/plans";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function BillingTransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status: statusFilter } = await searchParams;
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

  let query = adminClient
    .from("payment_transactions")
    .select(
      "id, amount_paise, currency, status, payment_method, invoice_number, description, razorpay_order_id, razorpay_payment_id, created_at, metadata"
    )
    .eq("college_id", collegeId)
    .order("created_at", { ascending: false });

  if (statusFilter && statusFilter !== "all") {
    query = query.eq("status", statusFilter);
  }

  const { data: transactions } = await query;

  // Compute summary metrics
  const allTxns = transactions ?? [];
  const totalPaidPaise = allTxns
    .filter((t) => t.status === "paid")
    .reduce((sum, t) => sum + (t.amount_paise ?? 0), 0);
  const paidCount = allTxns.filter((t) => t.status === "paid").length;
  const createdCount = allTxns.filter((t) => t.status === "created").length;

  const statusBadge = (status: string) => {
    switch (status) {
      case "paid":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="h-3.5 w-3.5" /> Paid & Verified
          </span>
        );
      case "created":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 border border-amber-200">
            <Clock className="h-3.5 w-3.5" /> Checkout Pending / Abandoned
          </span>
        );
      case "failed":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 border border-rose-200">
            <XCircle className="h-3.5 w-3.5" /> Failed
          </span>
        );
      case "refunded":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 border border-blue-200">
            <AlertCircle className="h-3.5 w-3.5" /> Refunded
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-700">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="flex flex-col gap-6 max-w-5xl">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link
            href="/admin/billing"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-500 hover:text-neutral-800 mb-2 transition"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Plans & Billing
          </Link>
          <h1 className="text-2xl font-bold text-neutral-900">Payment & Transaction History</h1>
          <p className="text-sm text-neutral-500 mt-0.5">
            View all Razorpay billing transactions, checkout sessions, and tax invoices for your organisation.
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Total Paid to Date</p>
          <p className="text-2xl font-bold text-neutral-900 mt-1">
            {formatPrice(totalPaidPaise)}
          </p>
          <p className="text-xs text-neutral-400 mt-1">{paidCount} successful payments</p>
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Verified Invoices</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{paidCount}</p>
          <p className="text-xs text-neutral-400 mt-1">Downloadable PDF manifests</p>
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Pending / Incomplete Orders</p>
          <p className="text-2xl font-bold text-amber-600 mt-1">{createdCount}</p>
          <p className="text-xs text-neutral-400 mt-1">Initiated checkout attempts</p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-neutral-200 pb-3 text-xs font-medium">
        <Link
          href="/admin/billing/transactions"
          className={`rounded-lg px-3 py-1.5 transition ${
            !statusFilter || statusFilter === "all"
              ? "bg-neutral-900 text-white font-semibold"
              : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
          }`}
        >
          All ({allTxns.length})
        </Link>
        <Link
          href="/admin/billing/transactions?status=paid"
          className={`rounded-lg px-3 py-1.5 transition ${
            statusFilter === "paid"
              ? "bg-emerald-700 text-white font-semibold"
              : "bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
          }`}
        >
          Paid ({allTxns.filter((t) => t.status === "paid").length})
        </Link>
        <Link
          href="/admin/billing/transactions?status=created"
          className={`rounded-lg px-3 py-1.5 transition ${
            statusFilter === "created"
              ? "bg-amber-700 text-white font-semibold"
              : "bg-amber-50 text-amber-800 hover:bg-amber-100"
          }`}
        >
          Pending / Unpaid ({allTxns.filter((t) => t.status === "created").length})
        </Link>
        <Link
          href="/admin/billing/transactions?status=failed"
          className={`rounded-lg px-3 py-1.5 transition ${
            statusFilter === "failed"
              ? "bg-rose-700 text-white font-semibold"
              : "bg-rose-50 text-rose-800 hover:bg-rose-100"
          }`}
        >
          Failed ({allTxns.filter((t) => t.status === "failed").length})
        </Link>
      </div>

      {/* Transactions Table / List */}
      <div className="rounded-xl border border-neutral-200 bg-white shadow-sm overflow-hidden">
        {allTxns.length === 0 ? (
          <div className="p-12 text-center text-neutral-500">
            <FileText className="mx-auto h-8 w-8 text-neutral-300 mb-2" />
            <p className="font-semibold text-neutral-700">No transactions found</p>
            <p className="text-xs text-neutral-400 mt-1">
              There are no records matching your current filter.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-neutral-50 border-b border-neutral-200 text-xs font-semibold text-neutral-600 uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3.5">Invoice / Description</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5">Amount</th>
                  <th className="px-5 py-3.5">Payment IDs</th>
                  <th className="px-5 py-3.5">Date</th>
                  <th className="px-5 py-3.5 text-right">Receipt / Invoice</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {allTxns.map((t) => (
                  <tr key={t.id} className="hover:bg-neutral-50/70 transition">
                    <td className="px-5 py-4">
                      <div className="font-medium text-neutral-900">
                        {t.description || "Plan Subscription"}
                      </div>
                      <div className="text-xs font-mono text-neutral-500 mt-0.5">
                        {t.invoice_number ?? "No invoice generated"}
                      </div>
                    </td>

                    <td className="px-5 py-4">{statusBadge(t.status)}</td>

                    <td className="px-5 py-4">
                      <span className="font-semibold text-neutral-900">
                        {formatPrice(t.amount_paise ?? 0)}
                      </span>
                    </td>

                    <td className="px-5 py-4">
                      <div className="text-xs font-mono text-neutral-600 space-y-0.5">
                        {t.razorpay_payment_id ? (
                          <div className="text-emerald-700">
                            Pay: {t.razorpay_payment_id}
                          </div>
                        ) : null}
                        {t.razorpay_order_id ? (
                          <div className="text-neutral-400">
                            Order: {t.razorpay_order_id}
                          </div>
                        ) : (
                          <span className="text-neutral-400 italic">None</span>
                        )}
                      </div>
                    </td>

                    <td className="px-5 py-4 text-xs text-neutral-500 whitespace-nowrap">
                      {new Date(t.created_at).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>

                    <td className="px-5 py-4 text-right">
                      {t.status === "paid" ? (
                        <a
                          href={`/api/payments/invoice/${t.id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 transition"
                        >
                          <Download className="h-3.5 w-3.5" />
                          Download Invoice
                        </a>
                      ) : (
                        <span className="text-xs text-neutral-400 italic">
                          Not available
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Legal & Terms Note */}
      <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-xs text-neutral-600 flex items-center justify-between">
        <span>
          Have questions regarding billing or GST compliance? Review our{" "}
          <Link href="/terms" className="text-blue-600 hover:underline font-medium">
            Terms of Service & Platform Policies
          </Link>
          .
        </span>
        <Link
          href="/#contact"
          className="text-xs font-medium text-neutral-700 hover:text-neutral-900 underline"
        >
          Contact Support
        </Link>
      </div>
    </div>
  );
}
