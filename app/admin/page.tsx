import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  ClipboardList,
  UserCheck,
  MapPin,
  BarChart2,
  Download,
  AlertTriangle,
  Users,
  CreditCard,
  ArrowRight,
  CheckCircle2,
  Clock,
  Trash2,
} from "lucide-react";
import JoinCodeCard from "./JoinCodeCard";


export default async function AdminDashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, college_id, display_name, colleges(name, logo_url)")
    .eq("id", user!.id)
    .single();
  if (profile?.role === "super_admin") redirect("/super-admin");

  const collegeId = profile?.college_id;
  const collegeName = (profile?.colleges as any)?.name ?? "Organisation";

  const adminClient = createAdminClient();

  const [
    { count: pendingComplaints },
    { count: roleRequests },
    { count: totalLocations },
    { count: totalWorkers },
    { count: completedComplaints },
    { count: totalDepts },
  ] = await Promise.all([
    adminClient.from("complaints").select("id", { count: "exact", head: true }).eq("college_id", collegeId!).neq("status", "completed").is("deleted_at", null),
    adminClient.from("role_requests").select("id", { count: "exact", head: true }).eq("college_id", collegeId!).eq("status", "pending"),
    adminClient.from("locations").select("id", { count: "exact", head: true }).eq("college_id", collegeId!).eq("archived", false),
    adminClient.from("profiles").select("id", { count: "exact", head: true }).eq("college_id", collegeId!).eq("role", "worker"),
    adminClient.from("complaints").select("id", { count: "exact", head: true }).eq("college_id", collegeId!).eq("status", "completed").is("deleted_at", null),
    adminClient.from("departments").select("id", { count: "exact", head: true }).eq("college_id", collegeId!),
  ]);

  // Check if subscription is active
  const { data: subscription } = await adminClient
    .from("org_subscriptions")
    .select("status, current_period_end, plans(name)")
    .eq("college_id", collegeId!)
    .maybeSingle();

  const daysLeft = subscription?.current_period_end
    ? Math.ceil((new Date(subscription.current_period_end).getTime() - Date.now()) / 86400000)
    : null;

  return (
    <div className="flex flex-col gap-8">
      {/* Header Banner */}
      <div className="flex flex-col gap-3 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-neutral-500">{collegeName}</p>
          <h1 className="mt-1 text-2xl font-bold text-neutral-900">
            Welcome back, {profile?.display_name || "Admin"} 👋
          </h1>
          <p className="text-sm text-neutral-500 mt-0.5">
            Organisation Admin Dashboard · Manage complaints, workers & departments
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin/queue"
            className="inline-flex items-center gap-2 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-neutral-800"
          >
            <ClipboardList className="h-4 w-4" />
            Manage Queue
          </Link>
          <Link
            href="/admin/billing"
            className="inline-flex items-center gap-2 rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 shadow-sm hover:bg-neutral-50"
          >
            <CreditCard className="h-4 w-4" />
            Plans & Billing
          </Link>
        </div>
      </div>

      {/* Subscription Alert */}
      {subscription && daysLeft !== null && daysLeft <= 15 && daysLeft > 0 && (
        <div className="flex items-center justify-between gap-4 rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-amber-900 shadow-sm">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
            <div>
              <p className="font-semibold text-sm">
                Your plan expires in {daysLeft} day{daysLeft !== 1 ? "s" : ""}
              </p>
              <p className="text-xs text-amber-700">
                Renew now to avoid service interruption. Current plan: {(subscription?.plans as any)?.name}
              </p>
            </div>
          </div>
          <Link
            href="/admin/billing"
            className="shrink-0 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700"
          >
            Renew Now →
          </Link>
        </div>
      )}

      {/* Role Requests Alert */}
      {(roleRequests ?? 0) > 0 && (
        <div className="flex items-center justify-between gap-4 rounded-xl border border-rose-200 bg-rose-50/70 p-4 text-rose-900 shadow-sm">
          <div className="flex items-center gap-3">
            <UserCheck className="h-5 w-5 text-rose-600 shrink-0" />
            <div>
              <p className="font-semibold text-sm">
                {roleRequests} pending role request{(roleRequests ?? 0) > 1 ? "s" : ""}
              </p>
              <p className="text-xs text-rose-700">
                Workers and admin applications waiting for your approval.
              </p>
            </div>
          </div>
          <Link
            href="/admin/role-requests"
            className="shrink-0 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700"
          >
            Review Now →
          </Link>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <KpiCard
          label="Pending"
          value={pendingComplaints ?? 0}
          icon={<Clock className="h-4 w-4 text-amber-500" />}
          valueClass="text-amber-600"
          sub="Open complaints"
        />
        <KpiCard
          label="Completed"
          value={completedComplaints ?? 0}
          icon={<CheckCircle2 className="h-4 w-4 text-emerald-500" />}
          valueClass="text-emerald-600"
          sub="Resolved issues"
        />
        <KpiCard
          label="Role Requests"
          value={roleRequests ?? 0}
          icon={<UserCheck className="h-4 w-4 text-rose-500" />}
          valueClass="text-rose-600"
          sub="Pending approval"
        />
        <KpiCard
          label="Locations"
          value={totalLocations ?? 0}
          icon={<MapPin className="h-4 w-4 text-blue-500" />}
          valueClass="text-blue-600"
          sub="Active locations"
        />
        <KpiCard
          label="Workers"
          value={totalWorkers ?? 0}
          icon={<Users className="h-4 w-4 text-violet-500" />}
          valueClass="text-violet-600"
          sub="Registered workers"
        />
        <KpiCard
          label="Departments"
          value={totalDepts ?? 0}
          icon={<BarChart2 className="h-4 w-4 text-indigo-500" />}
          valueClass="text-indigo-600"
          sub="Active depts"
        />
      </div>

      {/* Quick Navigation Grid */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <NavCard
          href="/admin/queue"
          label="Complaint Queue"
          sub="Assign departments & verify completions"
          badge={pendingComplaints ?? 0}
          badgeColor="amber"
          icon={<ClipboardList className="h-5 w-5 text-amber-600" />}
          iconBg="bg-amber-50 border-amber-200"
        />
        <NavCard
          href="/admin/role-requests"
          label="Role Requests"
          sub="Worker & admin role approvals"
          badge={roleRequests ?? 0}
          badgeColor="rose"
          icon={<UserCheck className="h-5 w-5 text-rose-600" />}
          iconBg="bg-rose-50 border-rose-200"
        />
        <NavCard
          href="/admin/departments"
          label="Departments"
          sub="Manage teams & assign workers"
          badge={totalDepts ?? 0}
          badgeColor="indigo"
          icon={<Users className="h-5 w-5 text-indigo-600" />}
          iconBg="bg-indigo-50 border-indigo-200"
        />
        <NavCard
          href="/admin/locations"
          label="Locations & QR"
          sub="Organisation structure & QR codes"
          badge={totalLocations ?? 0}
          badgeColor="blue"
          icon={<MapPin className="h-5 w-5 text-blue-600" />}
          iconBg="bg-blue-50 border-blue-200"
        />
        <NavCard
          href="/admin/analytics"
          label="Analytics"
          sub="Trends, performance & insights"
          icon={<BarChart2 className="h-5 w-5 text-violet-600" />}
          iconBg="bg-violet-50 border-violet-200"
        />
        <NavCard
          href="/admin/billing"
          label="Plans & Billing"
          sub="Subscription, payments & invoices"
          icon={<CreditCard className="h-5 w-5 text-emerald-600" />}
          iconBg="bg-emerald-50 border-emerald-200"
        />
        <NavCard
          href="/admin/export"
          label="Export Data"
          sub="CSV export & data download"
          icon={<Download className="h-5 w-5 text-neutral-600" />}
          iconBg="bg-neutral-50 border-neutral-200"
        />
        <NavCard
          href="/admin/data-deletion"
          label="Data Deletion"
          sub="Complaints archive & permanent purge"
          icon={<Trash2 className="h-5 w-5 text-red-600" />}
          iconBg="bg-red-50 border-red-200"
        />
      </div>

      {collegeId && <JoinCodeCard collegeId={collegeId} />}
    </div>
  );
}


function KpiCard({
  label,
  value,
  icon,
  valueClass,
  sub,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  valueClass: string;
  sub: string;
}) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between text-neutral-500 mb-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">{label}</span>
        {icon}
      </div>
      <p className={`text-3xl font-bold ${valueClass}`}>{value}</p>
      <span className="text-[11px] text-neutral-500">{sub}</span>
    </div>
  );
}

function NavCard({
  href,
  label,
  sub,
  badge,
  badgeColor,
  icon,
  iconBg,
}: {
  href: string;
  label: string;
  sub: string;
  badge?: number;
  badgeColor?: "amber" | "rose" | "blue" | "indigo" | "green";
  icon: React.ReactNode;
  iconBg: string;
}) {
  const badgeClasses: Record<string, string> = {
    amber: "bg-amber-100 text-amber-800",
    rose: "bg-rose-100 text-rose-800",
    blue: "bg-blue-100 text-blue-800",
    indigo: "bg-indigo-100 text-indigo-800",
    green: "bg-emerald-100 text-emerald-800",
  };

  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm hover:border-neutral-300 hover:bg-neutral-50 transition-colors"
    >
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border ${iconBg}`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="font-semibold text-sm text-neutral-900">{label}</span>
          {badge !== undefined && badge > 0 && badgeColor && (
            <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${badgeClasses[badgeColor] ?? ""}`}>
              {badge}
            </span>
          )}
        </div>
        <p className="text-xs text-neutral-500 truncate">{sub}</p>
      </div>
      <ArrowRight className="h-4 w-4 shrink-0 text-neutral-400" />
    </Link>
  );
}
