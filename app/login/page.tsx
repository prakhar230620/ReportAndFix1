import { login } from "@/app/auth/actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { error, next } = await searchParams;

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <h1 className="mb-6 text-2xl font-semibold">Log in</h1>

      {error && (
        <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <form action={login} className="flex flex-col gap-4">
        <input type="hidden" name="next" value={next ?? "/"} />
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
            className="rounded-md border border-neutral-300 px-3 py-2"
          />
        </label>

        <button
          type="submit"
          className="mt-2 rounded-md bg-neutral-900 px-4 py-2 text-white"
        >
          Log in
        </button>
      </form>

      <p className="mt-4 text-sm text-neutral-600">
        <a href="/forgot-password" className="underline">Forgot password?</a>
      </p>

      <p className="mt-2 text-sm text-neutral-600">
        Don&apos;t have an account?{" "}
        <a href={`/signup?next=${encodeURIComponent(next ?? "/")}`} className="underline">
          Sign up
        </a>
      </p>
    </main>
  );
}
