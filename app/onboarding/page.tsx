import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { completeOnboarding } from "./actions";

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
    .select("id, name")
    .order("name");

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <h1 className="mb-2 text-2xl font-semibold">One last step</h1>
      <p className="mb-6 text-sm text-neutral-600">
        Tell us your college and how you&apos;ll use ReportAndFix.
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

        <label className="flex flex-col gap-1 text-sm">
          College
          <select
            name="college_id"
            required
            className="rounded-md border border-neutral-300 px-3 py-2"
          >
            <option value="">Select your college</option>
            {(colleges ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>

        <fieldset className="flex flex-col gap-2 text-sm">
          <legend className="mb-1 font-medium">I am a...</legend>
          <label className="flex items-center gap-2 rounded-md border border-neutral-300 px-3 py-2">
            <input type="radio" name="requested_role" value="user" defaultChecked />
            Student / general user
          </label>
          <label className="flex items-center gap-2 rounded-md border border-neutral-300 px-3 py-2">
            <input type="radio" name="requested_role" value="worker" />
            Worker (maintenance / support staff)
          </label>
          <label className="flex items-center gap-2 rounded-md border border-neutral-300 px-3 py-2">
            <input type="radio" name="requested_role" value="college_admin" />
            College Admin
          </label>
          <p className="text-xs text-neutral-500">
            Worker and College Admin access requires approval after you continue.
          </p>
        </fieldset>

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
