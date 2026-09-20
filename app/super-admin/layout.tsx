import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import NavBar from "@/app/components/NavBar";

export default async function SuperAdminLayout({
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
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "super_admin") {
    redirect("/");
  }

  const { count: pendingCount } = await supabase
    .from("role_requests")
    .select("id", { count: "exact", head: true })
    .eq("requested_role", "college_admin")
    .eq("status", "pending");

  return (
    <div className="min-h-screen bg-neutral-50">
      <NavBar
        brand="Super Admin"
        items={[
          { href: "/super-admin", label: "Overview" },
          { href: "/super-admin/admin-requests", label: "Admin Requests", badge: pendingCount ?? 0 },
          { href: "/", label: "Home" },
        ]}
      />
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
