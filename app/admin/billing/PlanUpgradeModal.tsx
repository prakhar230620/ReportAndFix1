"use client";

import { useState } from "react";
import { CheckCircle2, X, Zap, MessageSquare, Download, HardDrive, Users } from "lucide-react";
import { formatPrice, planColor, planFeatureLabel, isUnlimited, type Plan } from "@/lib/plans";
import { ButtonSpinner } from "@/app/components/Spinner";


declare global {
  interface Window {
    Razorpay: any;
  }
}

export default function PlanUpgradeModal({
  currentPlanSlug,
  plans,
  collegeId,
  billingCycle: initialCycle,
}: {
  currentPlanSlug?: string;
  plans: Plan[];
  collegeId: string;
  billingCycle: "monthly" | "yearly";
}) {
  const [open, setOpen] = useState(false);
  const [billing, setBilling] = useState<"monthly" | "yearly">(initialCycle);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubscribe(plan: Plan) {
    setLoading(true);
    setError(null);
    try {
      const amount = billing === "monthly" ? plan.price_monthly_paise : plan.price_yearly_paise;
      const res = await fetch("/api/payments/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId: plan.id,
          collegeId,
          billingCycle: billing,
          amount,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create order");

      // Load Razorpay script
      if (!window.Razorpay) {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement("script");
          script.src = "https://checkout.razorpay.com/v1/checkout.js";
          script.onload = () => resolve();
          script.onerror = () => reject(new Error("Failed to load Razorpay"));
          document.head.appendChild(script);
        });
      }

      const rzp = new window.Razorpay({
        key: data.key,
        order_id: data.orderId,
        amount: amount,
        currency: "INR",
        name: "ReportAndFix",
        description: `${plan.name} Plan — ${billing}`,
        image: "/logo.png",
        prefill: { email: data.email },
        theme: { color: "#1c1917" },
        handler: async (response: any) => {
          const verifyRes = await fetch("/api/payments/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              orderId: response.razorpay_order_id,
              paymentId: response.razorpay_payment_id,
              signature: response.razorpay_signature,
              transactionId: data.transactionId,
              planId: plan.id,
              billingCycle: billing,
              collegeId,
            }),
          });
          const verifyData = await verifyRes.json();
          if (verifyData.ok) {
            window.location.reload();
          } else {
            setError(verifyData.error ?? "Payment verification failed. Contact support.");
          }
        },
        modal: { ondismiss: () => setLoading(false) },
      });
      rzp.open();
    } catch (e: any) {
      setError(e.message);
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-neutral-800 transition"
      >
        <Zap className="h-4 w-4" />
        {currentPlanSlug ? "Change Plan" : "Subscribe Now"}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="relative w-full max-w-5xl rounded-2xl bg-white shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-neutral-200 bg-white px-6 py-4">
              <div>
                <h2 className="text-lg font-bold text-neutral-900">Choose Your Plan</h2>
                <p className="text-xs text-neutral-500">Select a plan that fits your organisation</p>
              </div>
              <div className="flex items-center gap-3">
                {/* Billing toggle */}
                <div className="flex rounded-lg border border-neutral-200 overflow-hidden text-xs font-semibold">
                  <button
                    onClick={() => setBilling("monthly")}
                    className={`px-3 py-1.5 transition ${billing === "monthly" ? "bg-neutral-900 text-white" : "text-neutral-600 hover:bg-neutral-50"}`}
                  >
                    Monthly
                  </button>
                  <button
                    onClick={() => setBilling("yearly")}
                    className={`px-3 py-1.5 transition ${billing === "yearly" ? "bg-neutral-900 text-white" : "text-neutral-600 hover:bg-neutral-50"}`}
                  >
                    Yearly
                    <span className="ml-1 rounded-full bg-emerald-100 px-1.5 text-emerald-700 text-[10px]">Save ~15%</span>
                  </button>
                </div>
                <button onClick={() => setOpen(false)} className="rounded-lg p-1.5 hover:bg-neutral-100">
                  <X className="h-5 w-5 text-neutral-600" />
                </button>
              </div>
            </div>

            {error && (
              <div className="mx-6 mt-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-6">
              {plans.map((plan) => {
                const color = planColor(plan.slug);
                const price = billing === "monthly" ? plan.price_monthly_paise : plan.price_yearly_paise;
                const isCurrent = plan.slug === currentPlanSlug;
                return (
                  <div
                    key={plan.id}
                    className={`relative flex flex-col rounded-2xl border-2 p-5 transition ${
                      isCurrent ? `${color.border} ${color.bg}` : "border-neutral-200 bg-white hover:border-neutral-300"
                    }`}
                  >
                    {isCurrent && (
                      <span className={`absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-0.5 text-xs font-bold ${color.bg} ${color.text} border ${color.border}`}>
                        Current Plan
                      </span>
                    )}
                    <h3 className="font-bold text-neutral-900 text-base">{plan.name}</h3>
                    <p className="text-xs text-neutral-500 mt-0.5 mb-3">{plan.description}</p>

                    <div className="mb-4">
                      <span className="text-2xl font-bold text-neutral-900">{formatPrice(price)}</span>
                      <span className="text-xs text-neutral-500">/{billing === "monthly" ? "mo" : "yr"}</span>
                    </div>

                    <ul className="flex flex-col gap-1.5 text-xs text-neutral-600 flex-1 mb-4">
                      {plan.features.map((f) => (
                        <li key={f} className="flex items-start gap-1.5">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                          {f}
                        </li>
                      ))}
                      <li className="flex items-start gap-1.5">
                        <HardDrive className="h-3.5 w-3.5 text-blue-500 shrink-0 mt-0.5" />
                        {planFeatureLabel(plan.max_storage_gb, "GB storage")}
                      </li>
                      <li className="flex items-start gap-1.5">
                        <Users className="h-3.5 w-3.5 text-violet-500 shrink-0 mt-0.5" />
                        {isUnlimited(plan.max_workers) ? "Unlimited workers" : `Up to ${plan.max_workers} workers`}
                      </li>
                      <li className="flex items-start gap-1.5">
                        <MessageSquare className="h-3.5 w-3.5 text-violet-500 shrink-0 mt-0.5" />
                        {plan.messaging_enabled ? `Messaging (${plan.message_retention_hours}h)` : "No messaging"}
                      </li>
                      <li className="flex items-start gap-1.5">
                        <Download className="h-3.5 w-3.5 text-neutral-500 shrink-0 mt-0.5" />
                        {plan.data_download_free ? "Free data export" : "Paid export"}
                      </li>
                    </ul>

                    <button
                      onClick={() => handleSubscribe(plan)}
                      disabled={isCurrent || loading}
                      className={`w-full rounded-xl py-2 text-sm font-semibold transition ${
                        isCurrent
                          ? "bg-neutral-100 text-neutral-400 cursor-not-allowed"
                          : "bg-neutral-900 text-white hover:bg-neutral-800"
                      }`}
                    >
                      {loading ? <ButtonSpinner /> : isCurrent ? "Current Plan" : "Subscribe"}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
