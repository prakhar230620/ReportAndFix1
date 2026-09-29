import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import ContactForm from "@/app/components/ContactForm";
import { HelpCircle, BookOpen, KeyRound, CreditCard, Shield, Wrench, ArrowRight } from "lucide-react";

export default async function AdminSupportPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, college_id, display_name, colleges(name)")
    .eq("id", user.id)
    .single();

  if (!profile || (profile.role !== "college_admin" && profile.role !== "super_admin")) {
    redirect("/");
  }

  const collegeName = (profile.colleges as any)?.name ?? "Organisation";

  return (
    <div className="flex flex-col gap-8 max-w-4xl">
      <div>
        <span className="text-xs font-semibold uppercase tracking-wider text-blue-600 mb-1 block">
          {collegeName} · Operations Support
        </span>
        <h1 className="text-2xl font-bold text-neutral-900">Help & Support Center</h1>
        <p className="text-sm text-neutral-500 mt-0.5">
          Get direct technical assistance from platform administrators or view rapid resolution guides.
        </p>
      </div>

      {/* Quick Troubleshooting Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-xs">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600 mb-3">
            <CreditCard className="h-5 w-5" />
          </div>
          <h3 className="font-bold text-sm text-neutral-900">Billing & Plan Renewals</h3>
          <p className="mt-1 text-xs text-neutral-500 leading-relaxed">
            Need to unfreeze your organisation or upgrade quotas? Access checkout immediately.
          </p>
          <Link
            href="/admin/billing"
            className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700"
          >
            Manage Plans →
          </Link>
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-xs">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 mb-3">
            <KeyRound className="h-5 w-5" />
          </div>
          <h3 className="font-bold text-sm text-neutral-900">Join Codes & Access</h3>
          <p className="mt-1 text-xs text-neutral-500 leading-relaxed">
            Generate or rotate your 6-character organisation code to regulate user signup.
          </p>
          <Link
            href="/admin"
            className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700"
          >
            View Join Code →
          </Link>
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-xs">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 mb-3">
            <BookOpen className="h-5 w-5" />
          </div>
          <h3 className="font-bold text-sm text-neutral-900">Platform Documentation</h3>
          <p className="mt-1 text-xs text-neutral-500 leading-relaxed">
            Complete walkthroughs on location hierarchies, QR generation, and worker tasks.
          </p>
          <Link
            href="/#docs"
            className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 hover:text-emerald-700"
          >
            Read Guides →
          </Link>
        </div>
      </div>

      {/* Direct Contact Form to Super Admin */}
      <div className="rounded-2xl border border-neutral-200 bg-white p-6 sm:p-8 shadow-sm">
        <h2 className="text-lg font-bold text-neutral-900 mb-1">
          Direct Ticket to Platform Super Admin
        </h2>
        <p className="text-xs text-neutral-500 mb-6">
          Submit inquiries regarding invoice adjustments, custom integrations, or urgent technical assistance.
        </p>

        <ContactForm />
      </div>
    </div>
  );
}
