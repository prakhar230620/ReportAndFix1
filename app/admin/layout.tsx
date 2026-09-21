import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import NavBar from "@/app/components/NavBar";

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
    .select("role, college_id")
    .eq("id", user.id)
    .single();

  if (!profile || (profile.role !== "college_admin" && profile.role !== "super_admin")) {
    redirect("/");
  }

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
      .neq("status", "completed");
    queuePendingCount = count ?? 0;
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      <NavBar
        brand="ReportAndFix Admin"
        notify={{
          role: profile.role === "super_admin" ? "super_admin" : "college_admin",
          collegeId: profile.college_id,
        }}
        items={[
          { href: "/", label: "Home" },
          { href: "/admin/queue", label: "Queue", badge: queuePendingCount },
          { href: "/admin/role-requests", label: "Role Requests", badge: roleRequestCount },
          { href: "/admin/departments", label: "Departments" },
          { href: "/admin/locations", label: "Locations" },
          { href: "/admin/analytics", label: "Analytics" },
          { href: "/admin/export", label: "Export" },
        ]}
      />
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
