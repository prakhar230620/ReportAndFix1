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

  let pendingCount = 0;
  if (profile.role === "college_admin" && profile.college_id) {
    const { count } = await supabase
      .from("role_requests")
      .select("id", { count: "exact", head: true })
      .eq("college_id", profile.college_id)
      .eq("status", "pending");
    pendingCount = count ?? 0;
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      <NavBar
        brand="ReportAndFix Admin"
        items={[
          { href: "/", label: "Home" },
          { href: "/admin/queue", label: "Queue" },
          { href: "/admin/role-requests", label: "Role Requests", badge: pendingCount },
          { href: "/admin/locations", label: "Locations" },
          { href: "/admin/analytics", label: "Analytics" },
          { href: "/admin/export", label: "Export" },
        ]}
      />
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
