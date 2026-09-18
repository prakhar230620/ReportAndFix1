import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ProfileForm from "./ProfileForm";

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?next=/profile");

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, role, created_at, colleges(name)")
    .eq("id", user.id)
    .single();

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col gap-6 px-6 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Profile</h1>
        <a href="/" className="text-sm underline">Home</a>
      </div>

      <div className="rounded-md bg-neutral-100 px-3 py-2 text-sm text-neutral-600">
        <div>{user.email}</div>
        <div>
          {profile?.role} · {(profile?.colleges as any)?.name}
        </div>
      </div>

      <ProfileForm initialName={profile?.display_name ?? ""} />
    </main>
  );
}
