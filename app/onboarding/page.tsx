import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { completeOnboarding } from "./actions";
import CollegeRoleFields from "@/app/components/CollegeRoleFields";
import BackButton from "@/app/components/BackButton";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { error, next } = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("college_id, display_name")
    .eq("id", user.id)
    .single();

  // Already onboarded — nothing to do here.
  if (profile?.college_id) redirect(next ?? "/");

  const { data: colleges } = await supabase
    .from("colleges")
    .select("id, name, allow_worker_signup, allow_admin_signup")
    .order("name");

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <BackButton className="mb-4" />
      <h1 className="mb-2 text-2xl font-semibold">One last step</h1>
      <p className="mb-6 text-sm text-neutral-600">
        Tell us your organisation and how you&apos;ll use ReportAndFix.
      </p>

      {error && (
        <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <form action={completeOnboarding} className="flex flex-col gap-4">
        <input type="hidden" name="next" value={next ?? "/"} />

        <label className="flex flex-col gap-1 text-sm">
          Your name
          <input
            name="display_name"
            defaultValue={profile?.display_name ?? ""}
            required
            className="rounded-md border border-neutral-300 px-3 py-2"
          />
        </label>

        <CollegeRoleFields colleges={colleges ?? []} />

        <button
          type="submit"
          className="mt-2 rounded-md bg-neutral-900 px-4 py-2 text-white"
        >
          Continue
        </button>
      </form>
    </main>
  );
}
