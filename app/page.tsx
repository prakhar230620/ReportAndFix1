import { createClient } from "@/lib/supabase/server";
import { logout } from "@/app/auth/actions";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <main className="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="text-2xl font-semibold">ReportAndFix</h1>
        <p className="text-neutral-600">Scan a campus QR to report an issue.</p>
        <div className="flex gap-3">
          <a href="/login" className="rounded-md bg-neutral-900 px-4 py-2 text-white">
            Log in
          </a>
          <a href="/signup" className="rounded-md border border-neutral-300 px-4 py-2">
            Sign up
          </a>
        </div>
      </main>
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, role, college_id, colleges(name)")
    .eq("id", user.id)
    .single();

  const isAdmin = profile?.role === "college_admin" || profile?.role === "super_admin";
  const isWorker = profile?.role === "worker";
  const isSuperAdmin = profile?.role === "super_admin";

  const links: { href: string; label: string; sub: string }[] = [];
  if (isAdmin) links.push({ href: "/admin/locations", label: "Locations & QR", sub: "Manage campus structure" });
  if (isAdmin) links.push({ href: "/admin/queue", label: "Complaint Queue", sub: "Assign and verify" });
  if (isSuperAdmin) links.push({ href: "/super-admin", label: "Super Admin", sub: "Manage institutions" });
  if (isWorker) links.push({ href: "/worker", label: "My Tasks", sub: "Assigned work" });
  links.push({ href: "/locations", label: "Report an issue", sub: "Scan a QR or pick a location" });
  links.push({ href: "/feed", label: "Campus feed", sub: "Open and completed issues" });
  links.push({ href: "/profile", label: "Profile", sub: "Account settings" });

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-6 px-6 py-10">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">
          Welcome, {profile?.display_name ?? user.email}
        </h1>
        <p className="text-sm text-neutral-500">
          {profile?.role} · {(profile?.colleges as any)?.name}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        {links.map((l) => (
          <a
            key={l.href}
            href={l.href}
            className="flex items-center justify-between rounded-lg border border-neutral-200 bg-white px-4 py-3 shadow-sm transition-colors hover:border-neutral-300 hover:bg-neutral-50"
          >
            <div>
              <div className="font-medium text-neutral-900">{l.label}</div>
              <div className="text-xs text-neutral-500">{l.sub}</div>
            </div>
            <span className="text-neutral-300">→</span>
          </a>
        ))}
      </div>

      <form action={logout}>
        <button className="w-full rounded-md border border-neutral-300 px-4 py-2 text-sm text-neutral-600 hover:bg-neutral-50">
          Log out
        </button>
      </form>
    </main>
  );
}
