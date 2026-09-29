"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function ResetPasswordPage() {
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    let isMounted = true;

    async function initRecovery() {
      // 1. Check URL parameters for explicit errors (e.g. from auth callback or Supabase verify)
      const params = new URLSearchParams(window.location.search);
      const urlError = params.get("error_description") || params.get("error");
      if (urlError) {
        if (isMounted) {
          setError(urlError);
          setLoading(false);
        }
        return;
      }

      // 2. If code param is directly on this page (fallback if not routed through /auth/callback)
      const code = params.get("code");
      if (code) {
        const { error: exchangeErr } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeErr) {
          console.error("Exchange code error on reset-password:", exchangeErr);
          if (isMounted) {
            setError(exchangeErr.message || "Failed to verify reset code.");
            setLoading(false);
          }
          return;
        } else {
          if (isMounted) {
            setReady(true);
            setLoading(false);
          }
          return;
        }
      }

      // 3. If token_hash param is directly on this page
      const token_hash = params.get("token_hash");
      const type = params.get("type");
      if (token_hash && type === "recovery") {
        const { error: otpErr } = await supabase.auth.verifyOtp({
          token_hash,
          type: "recovery",
        });
        if (otpErr) {
          console.error("verifyOtp error on reset-password:", otpErr);
          if (isMounted) {
            setError(otpErr.message || "Invalid or expired reset token.");
            setLoading(false);
          }
          return;
        } else {
          if (isMounted) {
            setReady(true);
            setLoading(false);
          }
          return;
        }
      }

      // 4. Check if session already exists (e.g. set by /auth/callback server-side)
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData?.session) {
        if (isMounted) {
          setReady(true);
          setLoading(false);
        }
        return;
      }

      // 5. Fallback timer if waiting for onAuthStateChange
      setTimeout(() => {
        if (isMounted && loading) {
          setLoading(false);
        }
      }, 1500);
    }

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && session)) {
        if (isMounted) {
          setReady(true);
          setLoading(false);
        }
      }
    });

    initRecovery();

    return () => {
      isMounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  // Safely abort password reset: sign out completely and send to /login
  // Prevents bypassing password reset to land in admin panel
  async function handleCancelAndBack() {
    setBusy(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
    } catch (e) {
      console.error("Sign out error:", e);
    }
    document.cookie =
      "reset_password_in_progress=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    window.location.href = "/login";
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }

    setBusy(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setBusy(false);

    if (updateError) {
      setError(updateError.message);
    } else {
      // Clear reset flag & sign out so they must log in cleanly with new password
      document.cookie =
        "reset_password_in_progress=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
      await supabase.auth.signOut();
      setDone(true);
    }
  }

  if (done) {
    return (
      <main className="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center gap-3 px-6 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-green-600">
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-xl font-semibold text-neutral-900">Password updated!</h1>
        <p className="text-sm text-neutral-600">
          Your password has been changed successfully. You can now log in with your new credentials.
        </p>
        <button
          onClick={() => {
            window.location.href = "/login";
          }}
          className="mt-3 w-full rounded-md bg-neutral-900 px-4 py-2.5 text-center text-sm font-medium text-white hover:bg-neutral-800 transition-colors"
        >
          Go to log in
        </button>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center gap-3 px-6 text-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-900" />
        <p className="text-sm text-neutral-500">Verifying reset link…</p>
      </main>
    );
  }

  if (!ready) {
    return (
      <main className="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center gap-4 px-6 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-600">
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h1 className="text-xl font-semibold text-neutral-900">Link expired or invalid</h1>
        {error ? (
          <p className="rounded-md bg-red-50 p-2 text-xs text-red-700 border border-red-200">{error}</p>
        ) : (
          <p className="text-sm text-neutral-600">
            This password reset link is invalid or has expired. Please request a new one.
          </p>
        )}
        <div className="flex flex-col gap-2 w-full mt-2">
          <Link
            href="/forgot-password"
            className="w-full rounded-md bg-neutral-900 py-2.5 text-center text-sm font-medium text-white hover:bg-neutral-800"
          >
            Request new reset link
          </Link>
          <button
            onClick={handleCancelAndBack}
            className="w-full rounded-md border border-neutral-300 py-2 text-center text-sm font-medium text-neutral-700 hover:bg-neutral-50"
          >
            Back to log in
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <button
        type="button"
        onClick={handleCancelAndBack}
        disabled={busy}
        className="mb-4 flex w-fit items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-900 transition-colors"
      >
        <ArrowLeft size={16} /> Back to log in
      </button>

      <h1 className="mb-1 text-2xl font-semibold text-neutral-900">Set a new password</h1>
      <p className="mb-6 text-sm text-neutral-500">
        Choose a strong password with at least 6 characters.
      </p>

      {error && (
        <p className="mb-4 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
          New password
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              required
              placeholder="••••••••"
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-neutral-900 focus:border-neutral-900 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-neutral-500 hover:text-neutral-800"
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
          Confirm password
          <input
            type={showPassword ? "text" : "password"}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            minLength={6}
            required
            placeholder="••••••••"
            className="rounded-md border border-neutral-300 px-3 py-2 text-neutral-900 focus:border-neutral-900 focus:outline-none"
          />
        </label>

        <button
          type="submit"
          disabled={busy}
          className="mt-2 rounded-md bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50 transition-colors"
        >
          {busy ? "Saving new password…" : "Update password"}
        </button>
      </form>
    </main>
  );
}
