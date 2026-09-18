import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

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

  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="border-b border-neutral-200 bg-white px-6 py-4">
        <nav className="mx-auto flex max-w-4xl items-center justify-between">
          <span className="font-semibold">ReportAndFix Admin</span>
          <div className="flex gap-4">
            <a href="/" className="text-sm underline">
              Home
            </a>
            <a href="/admin/queue" className="text-sm underline">
              Queue
            </a>
            <a href="/admin/locations" className="text-sm underline">
              Locations & QR
            </a>
            <a href="/admin/analytics" className="text-sm underline">
              Analytics
            </a>
            <a href="/admin/export" className="text-sm underline">
              Export
            </a>
          </div>
        </nav>
      </header>
      <main className="mx-auto max-w-4xl px-6 py-8">{children}</main>
    </div>
  );
}
