import BrandLogo from "@/app/components/BrandLogo";
import Hero3DCanvas from "@/app/components/Hero3DCanvas";
import PricingSection from "@/app/components/PricingSection";
import DocumentationSection from "@/app/components/DocumentationSection";
import ContactForm from "@/app/components/ContactForm";
import Link from "next/link";
import {
  QrCode,
  ShieldCheck,
  Zap,
  Building2,
  Users,
  HardDrive,
  MessageSquare,
  Trash2,
  CreditCard,
  ArrowRight,
  Sparkles,
} from "lucide-react";

export const metadata = {
  title: "ReportAndFix - Modern Facility & Campus Operations Platform",
  description:
    "Zero-friction QR-based defect resolution, automated dispatching, multi-admin consensus data retention, and enterprise campus operations.",
};

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-neutral-900 overflow-x-hidden">
      {/* Sticky Glass Navbar */}
      <header className="sticky top-0 z-50 border-b border-neutral-200/80 bg-white/80 backdrop-blur-lg">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5 sm:px-6 lg:px-8">
          <BrandLogo size="md" href="/" />

          <nav className="hidden md:flex items-center gap-7 text-xs font-semibold text-neutral-600">
            <Link href="#features" className="hover:text-blue-600 transition">
              Features
            </Link>
            <Link href="#docs" className="hover:text-blue-600 transition">
              How It Works
            </Link>
            <Link href="#pricing" className="hover:text-blue-600 transition">
              Pricing & Plans
            </Link>
            <Link href="#faq" className="hover:text-blue-600 transition">
              FAQ
            </Link>
            <Link href="#contact" className="hover:text-blue-600 transition">
              Contact
            </Link>
            <Link href="/terms" className="hover:text-blue-600 transition">
              Terms
            </Link>
          </nav>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="rounded-xl px-4 py-2 text-xs font-bold text-neutral-700 hover:text-neutral-900 transition"
            >
              Log In
            </Link>
            <Link
              href="/signup"
              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-blue-500/20 hover:from-blue-700 hover:to-indigo-700 transition"
            >
              <span>Get Started</span>
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section with Interactive 3D Canvas */}
      <section className="relative min-h-[85vh] flex items-center justify-center overflow-hidden px-4 sm:px-6 lg:px-8 pt-12 pb-24">
        <Hero3DCanvas />

        <div className="relative z-10 mx-auto max-w-4xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-200/80 bg-blue-50/90 px-4 py-1.5 text-xs font-semibold text-blue-700 shadow-xs mb-6 backdrop-blur-xs">
            <Sparkles className="h-3.5 w-3.5 text-blue-600 animate-spin" style={{ animationDuration: "4s" }} />
            Next-Gen Campus & Physical Facility Operations
          </div>

          <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-neutral-950 leading-[1.12]">
            Instant QR Issue Resolution.{" "}
            <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 bg-clip-text text-transparent">
              Zero Friction for Everyone.
            </span>
          </h1>

          <p className="mt-6 text-base sm:text-lg text-neutral-600 max-w-2xl mx-auto leading-relaxed">
            Place QR codes in rooms, labs, or buildings. Students and staff scan to report defects in 5 seconds.
            Automated smart compression, departmental dispatching, two-tier verification, and complete data retention.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/signup"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-2xl bg-neutral-950 px-7 py-4 text-sm font-bold text-white shadow-xl shadow-neutral-950/20 hover:bg-neutral-800 transition"
            >
              <span>Register Organisation Free</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="#pricing"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-2xl border border-neutral-300 bg-white/80 px-7 py-4 text-sm font-bold text-neutral-800 shadow-sm backdrop-blur-sm hover:bg-neutral-100 transition"
            >
              View 4-Tier Plans
            </Link>
          </div>

          {/* Social Proof Badges */}
          <div className="mt-14 flex flex-wrap items-center justify-center gap-8 text-xs font-semibold text-neutral-500">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-500" />
              <span>5-Second Zero Login Reports</span>
            </div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-500" />
              <span>Two-Tier Admin Verification</span>
            </div>
            <div className="flex items-center gap-2">
              <HardDrive className="h-4 w-4 text-blue-500" />
              <span>Multi-Cloud B2 & Supabase Archiving</span>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="text-xs font-bold uppercase tracking-wider text-blue-600">Enterprise Capabilities</h2>
          <p className="mt-2 text-3xl font-extrabold text-neutral-950">Engineered for Massive Operations</p>
          <p className="mt-3 text-sm text-neutral-600">
            Everything your campus, hospital, or corporate facility needs to maintain flawless operations.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="rounded-3xl border border-neutral-200/80 bg-gradient-to-b from-white to-neutral-50/50 p-8 shadow-sm hover:shadow-md transition">
            <div className="h-12 w-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-6">
              <QrCode className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-bold text-neutral-900">Dynamic QR Codes</h3>
            <p className="mt-2 text-sm text-neutral-600 leading-relaxed">
              Auto-generate high-resolution printable QR codes for any room or wing. Scan to auto-fill location context instantly.
            </p>
          </div>

          <div className="rounded-3xl border border-neutral-200/80 bg-gradient-to-b from-white to-neutral-50/50 p-8 shadow-sm hover:shadow-md transition">
            <div className="h-12 w-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-6">
              <Users className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-bold text-neutral-900">Departmental Rostering</h3>
            <p className="mt-2 text-sm text-neutral-600 leading-relaxed">
              Dispatch tickets to specialized maintenance crews (Electrical, IT, Plumbing) with worker assignment tracking.
            </p>
          </div>

          <div className="rounded-3xl border border-neutral-200/80 bg-gradient-to-b from-white to-neutral-50/50 p-8 shadow-sm hover:shadow-md transition">
            <div className="h-12 w-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-6">
              <MessageSquare className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-bold text-neutral-900">In-App Staff Messaging</h3>
            <p className="mt-2 text-sm text-neutral-600 leading-relaxed">
              Real-time collaboration between Admins and Workers. Tag complaint IDs (#CMP-...), with automated 24h privacy purging.
            </p>
          </div>

          <div className="rounded-3xl border border-neutral-200/80 bg-gradient-to-b from-white to-neutral-50/50 p-8 shadow-sm hover:shadow-md transition">
            <div className="h-12 w-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mb-6">
              <Trash2 className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-bold text-neutral-900">Multi-Admin Consensus Purge</h3>
            <p className="mt-2 text-sm text-neutral-600 leading-relaxed">
              Complaints can only be permanently erased after two separate admins approve and download the complete ZIP + PDF archive.
            </p>
          </div>

          <div className="rounded-3xl border border-neutral-200/80 bg-gradient-to-b from-white to-neutral-50/50 p-8 shadow-sm hover:shadow-md transition">
            <div className="h-12 w-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mb-6">
              <CreditCard className="h-4 w-4" />
            </div>
            <h3 className="text-lg font-bold text-neutral-900">Seamless Razorpay Billing</h3>
            <p className="mt-2 text-sm text-neutral-600 leading-relaxed">
              Instant activation via UPI, Cards, NetBanking. Automatic GST-ready invoices, quota safeguards, and subscription control.
            </p>
          </div>

          <div className="rounded-3xl border border-neutral-200/80 bg-gradient-to-b from-white to-neutral-50/50 p-8 shadow-sm hover:shadow-md transition">
            <div className="h-12 w-12 rounded-2xl bg-cyan-50 text-cyan-600 flex items-center justify-center mb-6">
              <Building2 className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-bold text-neutral-900">Custom Tenant Branding</h3>
            <p className="mt-2 text-sm text-neutral-600 leading-relaxed">
              Each organisation features their own institution crest, custom join codes, and tailored role-permission policies.
            </p>
          </div>
        </div>
      </section>

      {/* Interactive Documentation & Walkthrough Section */}
      <section id="docs" className="py-20 bg-neutral-50/70 border-y border-neutral-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <DocumentationSection />
        </div>
      </section>

      {/* 4-Tier Interactive Pricing Comparison */}
      <section id="pricing" className="py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <PricingSection />
      </section>

      {/* Contact Form Connected to Super Admin SMTP */}
      <section id="contact" className="py-20 px-4 sm:px-6 lg:px-8 max-w-3xl mx-auto">
        <div className="text-center mb-10">
          <h2 className="text-xs font-bold uppercase tracking-wider text-blue-600">Get In Touch</h2>
          <p className="mt-2 text-3xl font-extrabold text-neutral-950">Speak Directly With Platform Super Admin</p>
          <p className="mt-3 text-sm text-neutral-600">
            Have questions about custom enterprise deployments, GST invoices, or high-volume quotas?
          </p>
        </div>

        <div className="rounded-3xl border border-neutral-200 bg-white p-8 shadow-sm">
          <ContactForm />
        </div>
      </section>

      {/* Platform Footer */}
      <footer className="border-t border-neutral-200 bg-neutral-950 text-neutral-400 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex flex-col items-center md:items-start">
            <BrandLogo size="md" className="[&_span]:text-white" />
            <p className="text-xs text-neutral-500 mt-2">
              © {new Date().getFullYear()} ReportAndFix Operations Platform. All rights reserved.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6 text-xs font-semibold">
            <Link href="#features" className="hover:text-white transition">Features</Link>
            <Link href="#pricing" className="hover:text-white transition">Pricing</Link>
            <Link href="/docs" className="hover:text-white transition">Documentation</Link>
            <Link href="/terms" className="hover:text-white transition">Terms of Service</Link>
            <Link href="#contact" className="hover:text-white transition">Contact Us</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
