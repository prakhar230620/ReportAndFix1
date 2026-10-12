"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ArrowLeft, CheckCircle2, KeyRound, Lock, Eye, EyeOff, ShieldCheck } from "lucide-react";
import Link from "next/link";

export default function ResetPasswordPage() {
  // All hooks MUST be declared at the top level unconditionally
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // OTP inputs for when user has not yet established a session
  const [otpEmail, setOtpEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");

  useEffect(() => {
    const supabase = createClient();
    let isMounted = true;

    async function initRecovery() {
      // 1. Check URL search parameters or hash fragment for explicit errors
      const params = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const urlError =
        params.get("error_description") ||
        params.get("error") ||
        hashParams.get("error_description") ||
        hashParams.get("error");

      if (urlError) {
        if (isMounted) {
          setError(urlError);
          setLoading(false);
        }
        return;
      }

      // 2. If code param is directly on this page
      const code = params.get("code");
      if (code) {
        const { error: exchangeErr } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeErr) {
          console.error("Exchange code error on reset-password:", exchangeErr);
          if (isMounted) {
            setError(exchangeErr.message || "Failed to verify reset link.");
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
      if (token_hash && (type === "recovery" || type === "email")) {
        const { error: otpErr } = await supabase.auth.verifyOtp({
          token_hash,
          type: type as any,
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
        if (isMounted) {
          setLoading(false);
        }
      }, 1000);
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

  // Step 1: Verify OTP only
  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const cleanEmail = otpEmail.trim();
    const cleanOtp = otpCode.trim().replace(/\D/g, "");

    if (!cleanEmail) {
      setError("Please enter your email address.");
      return;
    }
    if (cleanOtp.length < 6) {
      setError("Please enter the complete 6-digit OTP code.");
      return;
    }

    setBusy(true);
    const supabase = createClient();
    try {
      // Try recovery type first, then fallback to email type
      let { error: otpErr } = await supabase.auth.verifyOtp({
        email: cleanEmail,
        token: cleanOtp,
        type: "recovery",
      });

      if (otpErr) {
        const { error: fallbackErr } = await supabase.auth.verifyOtp({
          email: cleanEmail,
          token: cleanOtp,
          type: "email",
        });
        if (!fallbackErr) {
          otpErr = null;
        }
      }

      if (otpErr) {
        setError(otpErr.message || "Invalid or expired OTP code.");
        setBusy(false);
        return;
      }

      // OTP verified successfully! Now allow user to set their new password.
      setReady(true);
    } catch (err: any) {
      setError(err?.message || "An unexpected error occurred verifying OTP.");
    } finally {
      setBusy(false);
    }
  }

  // Step 2: Set New Password (only runs after OTP / session is verified)
  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setBusy(true);
    const supabase = createClient();
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError(updateError.message);
        setBusy(false);
        return;
      }

      // Clear reset flag & sign out so they must log in cleanly with new password
      document.cookie =
        "reset_password_in_progress=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
      await supabase.auth.signOut();
      setDone(true);
    } catch (err: any) {
      setError(err?.message || "Failed to update password.");
    } finally {
      setBusy(false);
    }
  }

  // STATE 1: Password changed successfully
  if (done) {
    return (
      <main className="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center gap-4 px-6 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
          <CheckCircle2 size={32} />
        </div>
        <h1 className="text-2xl font-bold text-neutral-900">Password Updated!</h1>
        <p className="text-sm text-neutral-600">
          Your password has been changed successfully. You can now log in with your new credentials.
        </p>
        <button
          onClick={() => {
            window.location.href = "/login?notice=" + encodeURIComponent("Password reset successfully! Please log in.");
          }}
          className="mt-3 w-full rounded-lg bg-neutral-900 py-2.5 text-center text-sm font-semibold text-white hover:bg-neutral-800 transition"
        >
          Go to Log In
        </button>
      </main>
    );
  }

  // STATE 2: Loading initial session check
  if (loading) {
    return (
      <main className="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center gap-3 px-6 text-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-900" />
        <p className="text-sm text-neutral-500">Checking verification status…</p>
      </main>
    );
  }

  // STATE 3: OTP NOT YET VERIFIED -> First verify OTP!
  if (!ready) {
    return (
      <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6 py-10">
        <button
          type="button"
          onClick={handleCancelAndBack}
          disabled={busy}
          className="mb-4 flex w-fit items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-900 transition-colors"
        >
          <ArrowLeft size={16} /> Back to log in
        </button>

        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
            <KeyRound size={18} />
          </div>
          <h1 className="text-xl font-bold text-neutral-900">Step 1: Verify OTP</h1>
        </div>
        <p className="mt-1 text-xs text-neutral-500">
          Enter your email and the 6-digit OTP code received in your email. Once verified, you will set your new password.
        </p>

        {error && (
          <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleVerifyOtp} className="mt-5 flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-xs font-semibold text-neutral-700">
            Email address
            <input
              type="email"
              value={otpEmail}
              onChange={(e) => setOtpEmail(e.target.value)}
              required
              placeholder="you@example.com"
              className="rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-900 focus:border-blue-600 focus:outline-none"
            />
          </label>

          <label className="flex flex-col gap-1 text-xs font-semibold text-neutral-700">
            6-Digit OTP Code
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              required
              placeholder="123456"
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-center font-mono text-xl font-bold tracking-[0.4em] text-neutral-900 focus:border-blue-600 focus:outline-none"
            />
          </label>

          <button
            type="submit"
            disabled={busy || otpCode.length < 6 || !otpEmail.trim()}
            className="mt-1 flex w-full items-center justify-center gap-2 rounded-lg bg-neutral-900 py-2.5 text-sm font-semibold text-white hover:bg-neutral-800 disabled:opacity-50 transition"
          >
            {busy ? "Verifying OTP…" : "Verify OTP"}
          </button>
        </form>

        <div className="mt-5 border-t border-neutral-200 pt-3 text-center text-xs text-neutral-500">
          Need a code?{" "}
          <Link href="/forgot-password" className="font-semibold text-blue-600 hover:text-blue-700">
            Request new OTP code
          </Link>
        </div>
      </main>
    );
  }

  // STATE 4: OTP VERIFIED -> Now allow setting new password!
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6 py-10">
      <div className="mb-4 flex items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
        <ShieldCheck size={16} className="text-emerald-600 shrink-0" />
        <span><strong>OTP Verified!</strong> You can now choose a new password.</span>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-100 text-neutral-800">
          <Lock size={18} />
        </div>
        <h1 className="text-2xl font-bold text-neutral-900">Step 2: Set New Password</h1>
      </div>
      <p className="mt-1 text-xs text-neutral-500">
        Choose a strong password with at least 6 characters.
      </p>

      {error && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handlePasswordSubmit} className="mt-5 flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-xs font-semibold text-neutral-700">
          New password
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              required
              placeholder="At least 6 characters"
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-900 focus:border-blue-600 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700"
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </label>

        <label className="flex flex-col gap-1 text-xs font-semibold text-neutral-700">
          Confirm password
          <input
            type={showPassword ? "text" : "password"}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            minLength={6}
            required
            placeholder="Repeat new password"
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-900 focus:border-blue-600 focus:outline-none"
          />
        </label>

        <button
          type="submit"
          disabled={busy || password.length < 6 || password !== confirm}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-neutral-900 py-2.5 text-sm font-semibold text-white hover:bg-neutral-800 disabled:opacity-50 transition"
        >
          {busy ? "Saving new password…" : "Save New Password"}
        </button>
      </form>
    </main>
  );
}
