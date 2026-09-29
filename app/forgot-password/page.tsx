"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import BackButton from "@/app/components/BackButton";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sent" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [isRateLimit, setIsRateLimit] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setIsRateLimit(false);

    try {
      const supabase = createClient();
      const redirectUrl = `${window.location.origin}/auth/callback?next=/reset-password`;

      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: redirectUrl,
      });

      if (resetError) {
        const msg = resetError.message || "Failed to send reset email";
        setError(msg);
        setStatus("error");
        if (
          msg.toLowerCase().includes("rate limit") ||
          resetError.status === 429
        ) {
          setIsRateLimit(true);
        }
      } else {
        setStatus("sent");
      }
    } catch (err: any) {
      setError(err?.message || "An unexpected error occurred");
      setStatus("error");
    } finally {
      setBusy(false);
    }
  }

  if (status === "sent") {
    return (
      <main className="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center gap-3 px-6 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-blue-600">
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <h1 className="text-xl font-semibold text-neutral-900">Check your email</h1>
        <p className="text-sm text-neutral-600">
          We sent a password reset link to <span className="font-medium text-neutral-900">{email}</span>. Click the link in your email to choose a new password.
        </p>
        <p className="mt-2 text-xs text-neutral-500">
          Didn&apos;t receive it? Check your spam folder or wait a moment before trying again.
        </p>
        <div className="mt-4 flex flex-col gap-2 w-full">
          <button
            onClick={() => {
              setStatus("idle");
              setError(null);
            }}
            className="w-full rounded-md border border-neutral-300 py-2 text-sm text-neutral-700 hover:bg-neutral-50"
          >
            Try another email
          </button>
          <Link
            href="/login"
            className="w-full rounded-md bg-neutral-900 py-2 text-sm text-center text-white hover:bg-neutral-800"
          >
            Back to log in
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <BackButton className="mb-4" />
      <h1 className="mb-1 text-2xl font-semibold text-neutral-900">Reset your password</h1>
      <p className="mb-6 text-sm text-neutral-500">
        Enter your email address and we&apos;ll send you a link to reset your password.
      </p>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700 border border-red-200">
          <p className="font-medium">{error}</p>
          {isRateLimit && (
            <p className="mt-1 text-xs text-red-600">
              Supabase default SMTP restricts email frequency (usually 3-4 emails/hour). Please wait a few minutes before requesting another link.
            </p>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
          Email address
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="you@example.com"
            className="rounded-md border border-neutral-300 px-3 py-2 text-neutral-900 focus:border-neutral-900 focus:outline-none"
          />
        </label>
        <button
          type="submit"
          disabled={busy}
          className="mt-2 rounded-md bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50 transition-colors"
        >
          {busy ? "Sending link…" : "Send reset link"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-neutral-600">
        Remember your password?{" "}
        <Link href="/login" className="font-medium text-blue-600 hover:text-blue-700">
          Back to log in
        </Link>
      </p>
    </main>
  );
}
