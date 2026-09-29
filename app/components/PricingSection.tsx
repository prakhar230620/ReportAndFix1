"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Zap, Sparkles, Shield, ArrowRight } from "lucide-react";
import { formatPrice } from "@/lib/plans";

const DEFAULT_PLANS = [
  {
    name: "Starter",
    slug: "starter",
    tagline: "Essential infrastructure for small colleges & hostels",
    priceMonthly: 49900,
    priceYearly: 499000,
    storage: "2 GB Backblaze Storage",
    workers: "10 Field Workers",
    complaints: "100 Complaints / Month",
    departments: "3 Departments",
    features: [
      "QR Code Location Check-in",
      "Standard Work Orders Queue",
      "Email Expiry & Status Alerts",
      "Standard Image Compression (<100KB)",
      "Community Support",
    ],
    highlight: false,
    badge: null,
  },
  {
    name: "Standard",
    slug: "standard",
    tagline: "High throughput for colleges & medium corporate campuses",
    priceMonthly: 149900,
    priceYearly: 1499000,
    storage: "10 GB High-Speed Storage",
    workers: "50 Field Workers",
    complaints: "500 Complaints / Month",
    departments: "10 Departments",
    features: [
      "Everything in Starter",
      "Departmental Real-Time Analytics",
      "Staff In-App Direct Messaging (24h)",
      "Priority SLA Escalations",
      "CSV & Metric Data Exports",
      "Phone & Email Technical Support",
    ],
    highlight: false,
    badge: "Fast Growing",
  },
  {
    name: "Professional",
    slug: "professional",
    tagline: "Complete automated suite for multi-campus universities",
    priceMonthly: 349900,
    priceYearly: 3499000,
    storage: "50 GB Secure Storage",
    workers: "200 Field Workers",
    complaints: "2,000 Complaints / Month",
    departments: "30 Departments",
    features: [
      "Everything in Standard",
      "FREE Unlimited Data Downloads & ZIP Archives",
      "Extended Staff Messaging History (72h)",
      "Multi-Admin Deletion Approvals",
      "Custom Location Hierarchy Explorer",
      "Dedicated Account Manager",
    ],
    highlight: true,
    badge: "Most Popular",
  },
  {
    name: "Enterprise",
    slug: "enterprise",
    tagline: "Maximum scale & compliance for municipal & enterprise orgs",
    priceMonthly: 999900,
    priceYearly: 9999000,
    storage: "200 GB High Availability Storage",
    workers: "Unlimited Workers",
    complaints: "Unlimited Complaints",
    departments: "Unlimited Departments",
    features: [
      "Everything in Professional",
      "Custom Domain & Complete White-Label",
      "99.9% Uptime Guarantee SLA",
      "Automated Daily DB Backups",
      "Custom Data Retention Policies",
      "24/7 Dedicated Priority Hotline",
    ],
    highlight: false,
    badge: "Unlimited Scale",
  },
];

export default function PricingSection({
  loggedIn = false,
  userRole = null,
}: {
  loggedIn?: boolean;
  userRole?: string | null;
}) {
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("yearly");

  const ctaLink = loggedIn
    ? userRole === "college_admin"
      ? "/admin/billing"
      : "/admin"
    : "/signup";

  return (
    <section id="pricing" className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      <div className="text-center max-w-3xl mx-auto mb-14">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-100/80 px-3.5 py-1 text-xs font-semibold text-blue-700 uppercase tracking-wider mb-3">
          <Sparkles className="h-3.5 w-3.5" />
          Transparent Infrastructure Pricing
        </span>
        <h2 className="text-3xl sm:text-4xl font-extrabold text-neutral-900 tracking-tight">
          Engineered for Institutions. Built for Predictability.
        </h2>
        <p className="mt-3 text-base text-neutral-600">
          Our pricing balances dedicated Backblaze B2 storage, high-availability Supabase database operations,
          and Vercel edge networks with no hidden per-seat surcharges.
        </p>

        {/* Billing Switcher */}
        <div className="mt-8 inline-flex items-center rounded-xl bg-neutral-100 p-1 border border-neutral-200 shadow-inner">
          <button
            type="button"
            onClick={() => setBillingCycle("monthly")}
            className={`rounded-lg px-4 py-2 text-xs font-semibold transition ${
              billingCycle === "monthly"
                ? "bg-white text-neutral-900 shadow-xs"
                : "text-neutral-600 hover:text-neutral-900"
            }`}
          >
            Monthly Billing
          </button>
          <button
            type="button"
            onClick={() => setBillingCycle("yearly")}
            className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold transition ${
              billingCycle === "yearly"
                ? "bg-white text-neutral-900 shadow-xs"
                : "text-neutral-600 hover:text-neutral-900"
            }`}
          >
            <span>Annual Billing</span>
            <span className="rounded-md bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800">
              2 MONTHS FREE
            </span>
          </button>
        </div>
      </div>

      {/* Grid of Plans */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch">
        {DEFAULT_PLANS.map((plan) => {
          const price = billingCycle === "monthly" ? plan.priceMonthly : plan.priceYearly;
          return (
            <div
              key={plan.slug}
              className={`relative flex flex-col justify-between rounded-2xl p-6 transition-all duration-200 ${
                plan.highlight
                  ? "border-2 border-blue-600 bg-white shadow-xl shadow-blue-500/10 scale-102 lg:-translate-y-2"
                  : "border border-neutral-200 bg-white/80 shadow-sm hover:shadow-md hover:border-neutral-300"
              }`}
            >
              {plan.badge && (
                <div
                  className={`absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-0.5 text-[11px] font-bold tracking-wide uppercase shadow-xs ${
                    plan.highlight
                      ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white"
                      : "bg-neutral-800 text-white"
                  }`}
                >
                  {plan.badge}
                </div>
              )}

              <div>
                <h3 className="text-xl font-bold text-neutral-900">{plan.name}</h3>
                <p className="mt-1 text-xs text-neutral-500 min-h-[32px]">{plan.tagline}</p>

                <div className="mt-5 pb-5 border-b border-neutral-100">
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-black tracking-tight text-neutral-900">
                      {formatPrice(price)}
                    </span>
                    <span className="text-xs font-medium text-neutral-400">
                      /{billingCycle === "monthly" ? "mo" : "yr"}
                    </span>
                  </div>
                  {billingCycle === "yearly" && (
                    <p className="text-[11px] text-emerald-600 font-medium mt-1">
                      Save approx. ₹{((plan.priceMonthly * 12 - plan.priceYearly) / 100).toLocaleString("en-IN")}/year
                    </p>
                  )}
                </div>

                {/* Resource Limits Badges */}
                <div className="py-4 space-y-2 border-b border-neutral-100 text-xs text-neutral-700">
                  <div className="font-semibold text-neutral-900">{plan.workers}</div>
                  <div className="text-neutral-600">{plan.complaints}</div>
                  <div className="text-neutral-600">{plan.departments}</div>
                  <div className="text-neutral-600">{plan.storage}</div>
                </div>

                {/* Feature Checklist */}
                <ul className="mt-4 space-y-2.5 text-xs text-neutral-600">
                  {plan.features.map((feat, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <Check className="h-4 w-4 shrink-0 text-blue-600 mt-0.5" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-8 pt-4">
                <Link
                  href={ctaLink}
                  className={`w-full inline-flex items-center justify-center gap-1.5 rounded-xl py-2.5 px-4 text-xs font-bold transition shadow-xs ${
                    plan.highlight
                      ? "bg-blue-600 text-white hover:bg-blue-700 shadow-blue-500/25"
                      : "bg-neutral-900 text-white hover:bg-neutral-800"
                  }`}
                >
                  <span>{loggedIn ? "Upgrade in Dashboard" : "Choose " + plan.name}</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      {/* Psychology Footnote & Safety */}
      <div className="mt-12 rounded-2xl bg-neutral-50 border border-neutral-200/80 p-6 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-neutral-600">
        <div className="flex items-center gap-3">
          <Shield className="h-5 w-5 text-blue-600 shrink-0" />
          <span>
            <strong>Zero risk 14-day evaluation:</strong> Upgrade or cancel anytime from your Admin Dashboard.
            All plans include automatic image compression, SSL encryption, and multi-factor admin security.
          </span>
        </div>
        <Link
          href="#contact"
          className="shrink-0 font-semibold text-blue-600 hover:text-blue-700 underline"
        >
          Need custom enterprise pricing? Contact Us →
        </Link>
      </div>
    </section>
  );
}
