import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import NavBar from "@/app/components/NavBar";

export default async function DeptAdminLayout({
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
    .select("role, college_id, department_id, colleges(name, logo_url, is_frozen), departments(name)")
    .eq("id", user.id)
    .single();

  if (
    !profile ||
    (profile.role !== "dept_admin" &&
      profile.role !== "college_admin" &&
      profile.role !== "super_admin")
  ) {
    redirect("/");
  }

  const isFrozen = (profile.colleges as any)?.is_frozen === true;
  if (isFrozen && profile.role !== "super_admin") {
    return (
      <div className="min-h-screen bg-neutral-50">
        <NavBar
          brand="ReportAndFix"
          logoUrl={(profile.colleges as any)?.logo_url}
          items={[{ href: "/", label: "Home" }]}
        />
        <main className="mx-auto max-w-2xl px-4 py-16 sm:px-6 text-center">
          <div className="rounded-2xl border border-red-200 bg-red-50 p-10 shadow-sm">
            <div className="mb-4 text-5xl">🔒</div>
            <h1 className="text-2xl font-bold text-red-900">Your Plan Has Expired</h1>
            <p className="mt-2 text-sm text-red-700 max-w-md mx-auto">
              Your organisation's plan has expired and operations are paused.
              Please connect to your Organisation Admin to renew the subscription.
            </p>
            <div className="mt-6 flex justify-center">
              <a
                href="/"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-6 py-2.5 text-sm font-semibold text-white shadow hover:bg-red-700 transition"
              >
                Back to Home
              </a>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // If a departmental admin has no department configured, prompt them
  const deptName = (profile.departments as any)?.name ?? "Department";
  const collegeLogo = (profile.colleges as any)?.logo_url ?? null;


  let queuePendingCount = 0;
  if (profile.department_id) {
    const { count } = await supabase
      .from("complaints")
      .select("id", { count: "exact", head: true })
      .eq("assigned_department_id", profile.department_id)
      .neq("status", "completed");
    queuePendingCount = count ?? 0;
  } else if (profile.college_id) {
    // If org admin is previewing dept admin panel
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
        brand={`${deptName} Admin`}
        logoUrl={collegeLogo}
        notify={{
          role: "dept_admin",
          collegeId: profile.college_id,
          departmentId: profile.department_id,
          userId: user.id,
        }}
        items={[
          { href: "/", label: "Home" },
          { href: "/dept-admin", label: "Dashboard" },
          { href: "/dept-admin/queue", label: "Queue", badge: queuePendingCount },
          { href: "/dept-admin/messages", label: "Messages" },
          { href: "/dept-admin/workers", label: "Workers" },
          { href: "/dept-admin/analytics", label: "Analytics" },
        ]}
      />
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
