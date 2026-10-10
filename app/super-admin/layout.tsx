import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import NavBar from "@/app/components/NavBar";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

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

  const adminClient = createAdminClient();

  const [{ count: pendingCount }, { count: inquiryCount }] = await Promise.all([
    supabase
      .from("role_requests")
      .select("id", { count: "exact", head: true })
      .eq("requested_role", "college_admin")
      .eq("status", "pending"),
    adminClient
      .from("contact_submissions")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
  ]);

  return (
    <div className="min-h-screen bg-neutral-50">
      <NavBar
        brand="Super Admin"
        showBrandLogo={true}
        notify={{ role: "super_admin" }}
        items={[
          { href: "/", label: "Home" },
          { href: "/super-admin", label: "Overview" },
          { href: "/super-admin/plans", label: "Plans Studio" },
          { href: "/super-admin/transactions", label: "Transactions" },
          { href: "/super-admin/admin-requests", label: "Admin Requests", badge: pendingCount ?? 0 },
          { href: "/super-admin/inquiries", label: "Inquiries", badge: inquiryCount ?? 0 },
          { href: "/super-admin/analytics", label: "Analytics" },
          { href: "/super-admin/export", label: "Export" },
          { href: "/docs", label: "Docs" },
          { href: "/landing", label: "Landing" },
        ]}
      />
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}

