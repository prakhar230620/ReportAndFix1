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
  Building2,
  Receipt,
  Search,
} from "lucide-react";
import { formatPrice } from "@/lib/plans";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function SuperAdminTransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const { status: statusFilter, q: searchQuery } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const adminClient = createAdminClient();

  const { data: profile } = await adminClient
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "super_admin") {
    redirect("/");
  }

  // Fetch all transactions with college details
  let query = adminClient
    .from("payment_transactions")
    .select(
      "id, amount_paise, currency, status, payment_method, invoice_number, description, razorpay_order_id, razorpay_payment_id, created_at, metadata, colleges(id, name)"
    )
    .order("created_at", { ascending: false });

  if (statusFilter && statusFilter !== "all") {
    query = query.eq("status", statusFilter);
  }

  const { data: rawTransactions } = await query;
  let transactions = rawTransactions ?? [];

  if (searchQuery && searchQuery.trim()) {
    const qLower = searchQuery.toLowerCase().trim();
    transactions = transactions.filter((t) => {
      const collegeName = (t.colleges as any)?.name?.toLowerCase() ?? "";
      const invoice = t.invoice_number?.toLowerCase() ?? "";
      const rzpOrder = t.razorpay_order_id?.toLowerCase() ?? "";
      const rzpPayment = t.razorpay_payment_id?.toLowerCase() ?? "";
      return (
        collegeName.includes(qLower) ||
        invoice.includes(qLower) ||
        rzpOrder.includes(qLower) ||
        rzpPayment.includes(qLower)
      );
    });
  }

  // Aggregate metrics
  const allTxns = rawTransactions ?? [];
  const totalRevenuePaise = allTxns
    .filter((t) => t.status === "paid")
    .reduce((sum, t) => sum + (t.amount_paise ?? 0), 0);
  const paidCount = allTxns.filter((t) => t.status === "paid").length;
  const failedCount = allTxns.filter((t) => t.status === "failed").length;
  const pendingCount = allTxns.filter((t) => t.status === "created").length;

  // Unique colleges paying
  const uniqueColleges = new Set(
    allTxns.filter((t) => t.status === "paid").map((t) => (t.colleges as any)?.id)
  ).size;

  const statusBadge = (status: string) => {
    switch (status) {
      case "paid":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="h-3.5 w-3.5" /> Paid
          </span>
        );
      case "created":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 border border-amber-200">
            <Clock className="h-3.5 w-3.5" /> Pending Checkout
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
    <div className="flex flex-col gap-6 max-w-6xl">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link
            href="/super-admin"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-500 hover:text-neutral-800 mb-2 transition"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Super Admin
          </Link>
          <h1 className="text-2xl font-bold text-neutral-900">Platform Transactions & Invoices</h1>
          <p className="text-sm text-neutral-500 mt-0.5">
            Monitor real-time payments, subscriptions, and revenue across all organisations.
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Total Revenue</p>
          <p className="text-2xl font-bold text-neutral-900 mt-1">
            {formatPrice(totalRevenuePaise)}
          </p>
          <p className="text-xs text-emerald-600 mt-1 font-medium">{paidCount} successful payments</p>
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Active Paying Orgs</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">{uniqueColleges}</p>
          <p className="text-xs text-neutral-400 mt-1">Subscribed institutions</p>
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Completed Transactions</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{paidCount}</p>
          <p className="text-xs text-neutral-400 mt-1">100% verified via Razorpay</p>
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Pending / Abandoned</p>
          <p className="text-2xl font-bold text-amber-600 mt-1">{pendingCount}</p>
          <p className="text-xs text-neutral-400 mt-1">{failedCount} failed attempts</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
        {/* Status Filter Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">
          {[
            { id: "all", label: "All" },
            { id: "paid", label: "Paid" },
            { id: "created", label: "Pending" },
            { id: "failed", label: "Failed" },
          ].map((tab) => {
            const active = (!statusFilter && tab.id === "all") || statusFilter === tab.id;
            return (
              <Link
                key={tab.id}
                href={`/super-admin/transactions?status=${tab.id}${searchQuery ? `&q=${encodeURIComponent(searchQuery)}` : ""}`}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  active
                    ? "bg-neutral-900 text-white"
                    : "text-neutral-600 hover:bg-neutral-100"
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>

        {/* Search Input */}
        <form className="relative w-full sm:w-72 flex items-center">
          <input type="hidden" name="status" value={statusFilter || "all"} />
          <Search className="absolute left-3 h-4 w-4 text-neutral-400 pointer-events-none" />
          <input
            name="q"
            defaultValue={searchQuery || ""}
            placeholder="Search org, invoice, payment ID..."
            className="w-full rounded-lg border border-neutral-300 py-1.5 pl-9 pr-3 text-xs text-neutral-800 placeholder-neutral-400 focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
          />
        </form>
      </div>

      {/* Transactions List */}
      <div className="rounded-xl border border-neutral-200 bg-white shadow-sm overflow-hidden">
        {transactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <CreditCard className="h-10 w-10 text-neutral-300 mb-3" />
            <h3 className="text-sm font-semibold text-neutral-800">No transactions found</h3>
            <p className="text-xs text-neutral-500 mt-1 max-w-sm">
              {searchQuery
                ? `No transactions matched your search query "${searchQuery}".`
                : "No payment transactions have been recorded yet."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-neutral-200 bg-neutral-50 text-neutral-500 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="px-4 py-3">Organisation</th>
                  <th className="px-4 py-3">Invoice #</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Razorpay IDs</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 text-neutral-700">
                {transactions.map((t) => {
                  const collegeName = (t.colleges as any)?.name ?? "Unknown Organisation";
                  const dateStr = new Date(t.created_at).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  });
                  return (
                    <tr key={t.id} className="hover:bg-neutral-50/80 transition-colors">
                      <td className="px-4 py-3.5 font-medium text-neutral-900">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-3.5 w-3.5 text-neutral-400 shrink-0" />
                          <span className="truncate max-w-[180px]">{collegeName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 font-mono text-neutral-600">
                        {t.invoice_number || "—"}
                      </td>
                      <td className="px-4 py-3.5 font-semibold text-neutral-900">
                        ₹{((t.amount_paise ?? 0) / 100).toLocaleString("en-IN")}
                      </td>
                      <td className="px-4 py-3.5">{statusBadge(t.status)}</td>
                      <td className="px-4 py-3.5 font-mono text-[11px] text-neutral-500">
                        {t.razorpay_payment_id ? (
                          <div className="text-emerald-700">{t.razorpay_payment_id}</div>
                        ) : t.razorpay_order_id ? (
                          <div className="text-neutral-400">{t.razorpay_order_id}</div>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-neutral-500 whitespace-nowrap">
                        {dateStr}
                      </td>
                      <td className="px-4 py-3.5 text-right whitespace-nowrap">
                        {t.status === "paid" && (
                          <a
                            href={`/api/payments/invoice/${t.id}`}
                            className="inline-flex items-center gap-1 rounded-md border border-neutral-300 px-2.5 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-100 transition shadow-xs"
                          >
                            <Download className="h-3 w-3 text-neutral-500" />
                            Invoice
                          </a>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
