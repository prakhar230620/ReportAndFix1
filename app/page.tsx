import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { logout } from "@/app/auth/actions";
import { roleLabel } from "@/lib/roleLabel";
import Link from "next/link";
import BrandLogo from "@/app/components/BrandLogo";
import Hero3DCanvas from "@/app/components/Hero3DCanvas";
import PricingSection from "@/app/components/PricingSection";
import DocumentationSection from "@/app/components/DocumentationSection";
import ContactForm from "@/app/components/ContactForm";
import TodaysBroadcasts from "@/app/components/TodaysBroadcasts";
import ReApplyWorkerBanner from "@/app/components/ReApplyWorkerBanner";
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

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export default async function HomePage({
  searchParams,
}: {
  searchParams?: Promise<{
    code?: string;
    token_hash?: string;
    type?: string;
    error?: string;
    error_description?: string;
  }>;
}) {
  const params = searchParams ? await searchParams : undefined;
  if (params?.code) {
    redirect(`/auth/callback?code=${encodeURIComponent(params.code)}&next=/reset-password`);
  }
  if (params?.token_hash && params?.type) {
    redirect(
      `/auth/callback?token_hash=${encodeURIComponent(params.token_hash)}&type=${encodeURIComponent(
        params.type
      )}&next=/reset-password`
    );
  }
  if (params?.error || params?.error_description) {
    redirect(
      `/reset-password?error=${encodeURIComponent(
        params.error_description || params.error || "Authentication error"
      )}`
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // ─────────────────────────────────────────────────────────────
  // 1. PUBLIC LANDING PAGE (When visitor is not logged in)
  // ─────────────────────────────────────────────────────────────
  if (!user) {
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

            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                href="/signup"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-2xl bg-neutral-950 px-7 py-3.5 text-sm font-bold text-white shadow-lg hover:bg-neutral-800 transition"
              >
                <span>Register Your Organisation</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="#pricing"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-2xl border border-neutral-300 bg-white/90 px-6 py-3.5 text-sm font-semibold text-neutral-800 hover:bg-neutral-50 shadow-xs backdrop-blur-xs transition"
              >
                <span>View Plans & Pricing</span>
              </Link>
            </div>

            {/* Quick Metrics */}
            <div className="mt-14 grid grid-cols-2 sm:grid-cols-4 gap-4 border-t border-neutral-200/80 pt-8 text-left">
              <div>
                <div className="text-2xl font-black text-neutral-900">&lt; 100 KB</div>
                <div className="text-xs text-neutral-500 mt-0.5">Lossless Client Compression</div>
              </div>
              <div>
                <div className="text-2xl font-black text-neutral-900">2-Tier</div>
                <div className="text-xs text-neutral-500 mt-0.5">Dept + Org Admin Verification</div>
              </div>
              <div>
                <div className="text-2xl font-black text-neutral-900">100%</div>
                <div className="text-xs text-neutral-500 mt-0.5">Multi-Admin Deletion Consensus</div>
              </div>
              <div>
                <div className="text-2xl font-black text-neutral-900">24h / 72h</div>
                <div className="text-xs text-neutral-500 mt-0.5">Auto-Pruned Staff Messaging</div>
              </div>
            </div>
          </div>
        </section>

        {/* Feature Highlights Grid */}
        <section id="features" className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-neutral-100">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-600">Enterprise Capabilities</span>
            <h2 className="text-3xl font-extrabold text-neutral-950 mt-1">
              Purpose-built for Institutional Trust
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="rounded-2xl border border-neutral-200 bg-neutral-50/50 p-6 shadow-xs">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-100 text-blue-700 mb-4">
                <QrCode className="h-5 w-5" />
              </div>
              <h3 className="text-base font-bold text-neutral-900">Zero-App QR Reporting</h3>
              <p className="mt-2 text-xs text-neutral-600 leading-relaxed">
                Unique encrypted QR tokens for every room, machine, and facility. Anyone with a smartphone camera can report issues instantly without installing any app.
              </p>
            </div>

            <div className="rounded-2xl border border-neutral-200 bg-neutral-50/50 p-6 shadow-xs">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700 mb-4">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <h3 className="text-base font-bold text-neutral-900">Two-Tier Quality Audit</h3>
              <p className="mt-2 text-xs text-neutral-600 leading-relaxed">
                Technicians upload photographic proof before and after repair. Department admins verify technical work first, followed by organization admin sign-off.
              </p>
            </div>

            <div className="rounded-2xl border border-neutral-200 bg-neutral-50/50 p-6 shadow-xs">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-100 text-red-700 mb-4">
                <Trash2 className="h-5 w-5" />
              </div>
              <h3 className="text-base font-bold text-neutral-900">Safe Data Retention & Purge</h3>
              <p className="mt-2 text-xs text-neutral-600 leading-relaxed">
                Mandatory ZIP + multi-column PDF export before permanent deletion. All appointed organisation admins must approve to guarantee strict audit compliance.
              </p>
            </div>
          </div>
        </section>

        {/* Workflow & Interactive Role Docs */}
        <DocumentationSection />

        {/* Live Plans & Pricing Section */}
        <PricingSection loggedIn={false} />

        {/* Contact Form Section */}
        <section id="contact" className="py-20 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto border-t border-neutral-200">
          <div className="text-center mb-10">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-600">Get In Touch</span>
            <h2 className="text-3xl font-extrabold text-neutral-950 mt-1">
              Contact Platform Administrators
            </h2>
            <p className="text-xs text-neutral-500 mt-2">
              Have questions about custom university onboarding, Razorpay invoices, or enterprise SLAs?
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
              <Link href="/terms#data-deletion" className="hover:text-white transition">Data Deletion Policy</Link>
              <Link href="#contact" className="hover:text-white transition">Contact Us</Link>
            </div>
          </div>
        </footer>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // 2. AUTHENTICATED USER HOME SCREEN (Role-based Portal)
  // ─────────────────────────────────────────────────────────────
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, role, college_id, department_id, colleges(name, logo_url, is_frozen), departments(name)")
    .eq("id", user.id)
    .single();

  console.info("[RF_DIAG_HOME]", {
    user: user.id.slice(0, 8),
    role: profile?.role ?? "profile_missing",
  });

  const isAdmin = profile?.role === "college_admin" || profile?.role === "super_admin";
  const isDeptAdmin = profile?.role === "dept_admin";
  const isWorker = profile?.role === "worker";
  const isSuperAdmin = profile?.role === "super_admin";

  let pendingCount = 0;
  if (profile?.role === "college_admin" && profile.college_id) {
    const { count } = await supabase
      .from("role_requests")
      .select("id", { count: "exact", head: true })
      .eq("college_id", profile.college_id)
      .eq("status", "pending");
    pendingCount = count ?? 0;
  } else if (isSuperAdmin) {
    const { count } = await supabase
      .from("role_requests")
      .select("id", { count: "exact", head: true })
      .eq("requested_role", "college_admin")
      .eq("status", "pending");
    pendingCount = count ?? 0;
  }

  let queuePendingCount = 0;
  if (isAdmin && profile?.college_id) {
    const { count } = await supabase
      .from("complaints")
      .select("id", { count: "exact", head: true })
      .eq("college_id", profile.college_id)
      .neq("status", "completed")
      .is("deleted_at", null);
    queuePendingCount = count ?? 0;
  }

  let deptPendingCount = 0;
  if (isDeptAdmin && profile?.department_id) {
    const { count } = await supabase
      .from("complaints")
      .select("id", { count: "exact", head: true })
      .eq("assigned_department_id", profile.department_id)
      .neq("status", "completed")
      .is("deleted_at", null);
    deptPendingCount = count ?? 0;
  }

  let taskCount = 0;
  if (isWorker) {
    const { count } = await supabase
      .from("complaints")
      .select("id", { count: "exact", head: true })
      .eq("assigned_worker_id", user.id)
      .in("status", ["assigned", "processing"])
      .is("deleted_at", null);
    taskCount = count ?? 0;
  }

  // Check if this is a plain 'user' who previously had a worker request rejected
  let hasRejectedWorkerRequest = false;
  if (profile?.role === "user" && profile?.college_id) {
    const { data: rejectedReq } = await supabase
      .from("role_requests")
      .select("id")
      .eq("user_id", user.id)
      .eq("requested_role", "worker")
      .eq("status", "rejected")
      .limit(1)
      .maybeSingle();
    hasRejectedWorkerRequest = !!rejectedReq;
  }

  const links: { href: string; label: string; sub: string; badge?: number; icon?: React.ReactNode }[] = [];

  if (isAdmin)
    links.push({
      href: isSuperAdmin ? "/super-admin" : "/admin",
      label: "Admin Dashboard",
      sub: isSuperAdmin ? "Platform management & analytics" : "Overview, KPIs & quick actions",
    });

  if (profile?.role === "college_admin") {
    links.push({ href: "/admin/queue", label: "Complaint Queue", sub: "Assign depts & verify", badge: queuePendingCount });
    links.push({ href: "/admin/broadcasts", label: "Broadcast Announcements", sub: "Publish campus notices up to 72 hours" });
    links.push({ href: "/admin/billing", label: "Plans & Billing", sub: "Subscription, quotas & invoices" });
    links.push({ href: "/admin/data-deletion", label: "Data Deletion", sub: "Purge completed complaints" });
    links.push({ href: "/admin/locations", label: "Locations & QR", sub: "Campus rooms and QR codes" });
    links.push({ href: "/admin/departments", label: "Departments", sub: "Teams and staff rosters" });
    links.push({ href: "/admin/support", label: "Help & Support", sub: "Troubleshooting & contact super admin" });
  }

  if (isDeptAdmin) {
    links.push({
      href: "/dept-admin",
      label: "Department Dashboard",
      sub: `${(profile?.departments as any)?.name ?? "Department"} stats`,
    });
    links.push({
      href: "/dept-admin/queue",
      label: "Department Queue",
      sub: "Assign workers & verify completions",
      badge: deptPendingCount,
    });
    links.push({
      href: "/dept-admin/workers",
      label: "Department Workers",
      sub: "Active team roster & workload",
    });
  }

  if (isWorker) {
    links.push({ href: "/worker", label: "My Tasks", sub: "Assigned maintenance tasks", badge: taskCount });
  }

  if (profile?.role === "college_admin" && pendingCount > 0)
    links.push({ href: "/admin/role-requests", label: "Role Requests", sub: "Staff awaiting your approval", badge: pendingCount });

  if (isSuperAdmin) {
    links.push({ href: "/super-admin/plans", label: "Plans Management", sub: "Create & configure pricing tiers" });
    links.push({ href: "/super-admin/analytics", label: "Platform Analytics", sub: "All organisations & storage" });
    links.push({ href: "/super-admin/export", label: "Platform Export", sub: "Cross-organisation exports" });
  }

  if (!isSuperAdmin) {
    links.push({ href: "/locations", label: "Report an Issue", sub: "Scan QR or pick room" });
    links.push({ href: "/feed", label: "Campus Feed", sub: "Public issues in your organisation" });
  }

  links.push({ href: "/docs", label: "Documentation & FAQ", sub: "Platform guides & help" });
  links.push({ href: "/terms", label: "Terms of Service & Policies", sub: "Platform rules, SLAs & data deletion" });
  links.push({ href: "/profile", label: "My Profile", sub: "Account settings & credentials" });

  const orgLogo = (profile?.colleges as any)?.logo_url;

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-6 px-4 sm:px-6 py-10">

      {/* Organisation / Brand Header */}
      <div className="flex items-center justify-between border-b border-neutral-200 pb-5">
        <div className="flex items-center gap-3">
          {isSuperAdmin ? (
            <BrandLogo size="md" />
          ) : orgLogo ? (
            <img
              src={orgLogo}
              alt=""
              className="h-14 w-14 rounded-2xl border border-neutral-200/90 object-contain p-1.5 bg-white shadow-sm"
            />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-neutral-200 bg-neutral-100 text-neutral-600 shadow-sm">
              <Building2 className="h-7 w-7" />
            </div>
          )}

          <div>
            <h1 className="text-xl font-bold text-neutral-900">
              Welcome, {profile?.display_name || user.email}
            </h1>
            <p className="text-xs text-neutral-500">
              {isSuperAdmin
                ? "Platform Super Administrator"
                : `${roleLabel(profile?.role)} · ${(profile?.colleges as any)?.name ?? "Organisation"}`}
            </p>
          </div>
        </div>
      </div>

      {/* Today's Broadcasts Section for All Roles in this Organisation */}
      {profile?.college_id && (
        <TodaysBroadcasts
          collegeId={profile.college_id}
          userRole={profile.role}
          collegeName={(profile.colleges as any)?.name}
        />
      )}

      {/* Re-apply banner for rejected worker applicants */}
      {hasRejectedWorkerRequest && <ReApplyWorkerBanner />}

      {/* Navigation Directory */}
      <div className="flex flex-col gap-2.5">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="flex items-center justify-between rounded-xl border border-neutral-200 bg-white p-4 shadow-xs transition-all hover:border-neutral-300 hover:bg-neutral-50/80 hover:shadow-sm"
          >
            <div>
              <div className="flex items-center gap-2 font-semibold text-sm text-neutral-900">
                {l.label}
                {!!l.badge && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 text-[11px] font-bold text-white shadow-xs">
                    {l.badge}
                  </span>
                )}
              </div>
              <div className="text-xs text-neutral-500 mt-0.5">{l.sub}</div>
            </div>
            <span className="text-neutral-400 font-medium">→</span>
          </Link>
        ))}
      </div>

      {/* Logout */}
      <form action={logout} className="mt-2">
        <button className="w-full rounded-xl border border-neutral-300 bg-white py-2.5 text-xs font-semibold text-neutral-600 hover:bg-neutral-50 transition">
          Log Out
        </button>
      </form>
    </main>
  );
}
