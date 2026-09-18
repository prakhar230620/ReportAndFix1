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

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center gap-2 px-6 text-center">
      <h1 className="text-2xl font-semibold">
        Welcome, {profile?.display_name ?? user.email}
      </h1>
      <p className="text-neutral-600">
        Role: {profile?.role} · College: {(profile?.colleges as any)?.name}
      </p>
      {isAdmin && (
        <a href="/admin/locations" className="mt-2 text-sm underline">
          Admin: Locations & QR
        </a>
      )}
      {isSuperAdmin && (
        <a href="/super-admin" className="text-sm underline">
          Super Admin
        </a>
      )}
      {isWorker && (
        <a href="/worker" className="text-sm underline">
          My Tasks
        </a>
      )}
      <a href="/locations" className="text-sm underline">
        Report an issue
      </a>
      <a href="/feed" className="text-sm underline">
        View campus feed
      </a>
      <a href="/profile" className="text-sm underline">
        Profile
      </a>
      <form action={logout} className="mt-4">
        <button className="rounded-md border border-neutral-300 px-4 py-2">
          Log out
        </button>
      </form>
    </main>
  );
}
