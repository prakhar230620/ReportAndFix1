import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import NavBar from "@/app/components/NavBar";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, college_id, colleges(logo_url, is_frozen, subscription_status)")
    .eq("id", user.id)
    .single();

  if (!profile || (profile.role !== "college_admin" && profile.role !== "super_admin")) {
    redirect("/");
  }

  // Check if org is frozen or subscription inactive — show block page instead of content
  const collegeData = profile.colleges as any;
  const isFrozen =
    collegeData?.is_frozen === true ||
    ["expired", "frozen", "suspended", "cancelled"].includes(collegeData?.subscription_status ?? "");

  let roleRequestCount = 0;
  if (profile.role === "college_admin" && profile.college_id) {
    const { count } = await supabase
      .from("role_requests")
      .select("id", { count: "exact", head: true })
      .eq("college_id", profile.college_id)
      .eq("status", "pending");
    roleRequestCount = count ?? 0;
  }

  let queuePendingCount = 0;
  if (profile.college_id) {
    const { count } = await supabase
      .from("complaints")
      .select("id", { count: "exact", head: true })
      .eq("college_id", profile.college_id)
      .neq("status", "completed")
      .is("deleted_at", null);
    queuePendingCount = count ?? 0;
  }

  if (isFrozen && profile.role !== "super_admin") {
    // Allow billing page even when frozen so admin can pay
    return (
      <div className="min-h-screen bg-neutral-50">
        <NavBar
          brand="ReportAndFix Admin"
          logoUrl={profile.role === "super_admin" ? null : (profile.colleges as any)?.logo_url}
          notify={{ role: "college_admin", collegeId: profile.college_id }}
          items={[
            { href: "/admin/billing", label: "Plans & Billing" },
            { href: "/admin/support", label: "Support" },
          ]}
        />
        <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6 text-center">
          <div className="rounded-2xl border border-red-200 bg-red-50 p-10 shadow-sm">
            <div className="mb-4 text-5xl">🔒</div>
            <h1 className="text-2xl font-bold text-red-900">Your Plan Has Expired</h1>
            <p className="mt-2 text-sm text-red-700 max-w-md mx-auto">
              Your organisation's subscription has expired. All operations are currently paused.
              Please renew your plan to restore access for your team.
            </p>
            <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
              <a
                href="/admin/billing"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-6 py-3 text-sm font-semibold text-white shadow hover:bg-red-700 transition"
              >
                Renew Plan →
              </a>
              <a
                href="/admin/support"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-neutral-300 bg-white px-6 py-3 text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition"
              >
                Contact Support
              </a>
            </div>
          </div>
          <div className="mt-4">{children}</div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      <NavBar
        brand="ReportAndFix Admin"
        logoUrl={profile.role === "super_admin" ? null : (profile.colleges as any)?.logo_url}
        notify={{
          role: profile.role === "super_admin" ? "super_admin" : "college_admin",
          collegeId: profile.college_id,
        }}
        items={[
          { href: "/", label: "Home" },
          { href: "/admin", label: "Dashboard" },
          { href: "/admin/queue", label: "Queue", badge: queuePendingCount },
          { href: "/admin/broadcasts", label: "Broadcasts" },
          { href: "/admin/messages", label: "Messages" },
          { href: "/admin/role-requests", label: "Role Requests", badge: roleRequestCount },
          { href: "/admin/departments", label: "Departments" },
          { href: "/admin/locations", label: "Locations" },
          { href: "/admin/analytics", label: "Analytics" },
          { href: "/admin/billing", label: "Billing" },
          { href: "/admin/billing/transactions", label: "Transactions" },
          { href: "/admin/data-deletion", label: "Data Deletion" },
          { href: "/admin/export", label: "Export" },
        ]}

      />
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
