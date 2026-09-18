import { createClient } from "@/lib/supabase/server";
import { signup } from "@/app/auth/actions";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { error, next } = await searchParams;
  const supabase = await createClient();

  const { data: colleges } = await supabase
    .from("colleges")
    .select("id, name")
    .order("name");

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <h1 className="mb-6 text-2xl font-semibold">Create your account</h1>

      {error && (
        <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <form action={signup} className="flex flex-col gap-4">
        <input type="hidden" name="next" value={next ?? "/"} />
        <label className="flex flex-col gap-1 text-sm">
          Name
          <input
            name="display_name"
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

        <label className="flex flex-col gap-1 text-sm">
          Email
          <input
            type="email"
            name="email"
            required
            className="rounded-md border border-neutral-300 px-3 py-2"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Password
          <input
            type="password"
            name="password"
            required
            minLength={6}
            className="rounded-md border border-neutral-300 px-3 py-2"
          />
        </label>

        <button
          type="submit"
          className="mt-2 rounded-md bg-neutral-900 px-4 py-2 text-white"
        >
          Sign up
        </button>
      </form>

      <p className="mt-4 text-sm text-neutral-600">
        Already have an account?{" "}
        <a href={`/login?next=${encodeURIComponent(next ?? "/")}`} className="underline">
          Log in
        </a>
      </p>
    </main>
  );
}
