"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import BackButton from "@/app/components/BackButton";
import Link from "next/link";
import {
  Mail,
  KeyRound,
  Lock,
  CheckCircle2,
  Eye,
  EyeOff,
  RefreshCw,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";

export default function ForgotPasswordPage() {
  const router = useRouter();

  // Sequential Flow:
  // 1. "email": Request OTP
  // 2. "otp": Enter & Verify OTP
  // 3. "password": Set New Password
  // 4. "success": Done!
  const [step, setStep] = useState<"email" | "otp" | "password" | "success">("email");

  // Inputs
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Status & Feedback
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Timer countdown for resending OTP
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const interval = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [resendCooldown]);

  // Step 1: Send OTP to email
  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setError("Please enter your email address.");
      return;
    }

    setBusy(true);
    try {
      const supabase = createClient();
      const redirectUrl = `${window.location.origin}/auth/callback?next=/reset-password`;
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo: redirectUrl,
      });

      if (resetError) {
        setError(resetError.message || "Failed to send OTP code.");
        if (resetError.message?.toLowerCase().includes("rate limit") || resetError.status === 429) {
          setError("Rate limit reached. Please wait a few minutes before requesting another OTP.");
        }
        return;
      }

      setStep("otp");
      setResendCooldown(60);
    } catch (err: any) {
      setError(err?.message || "An unexpected error occurred while sending OTP.");
    } finally {
      setBusy(false);
    }
  }

  // Resend OTP
  async function handleResendOtp() {
    if (resendCooldown > 0 || busy) return;
    setError(null);
    setBusy(true);

    try {
      const supabase = createClient();
      const redirectUrl = `${window.location.origin}/auth/callback?next=/reset-password`;
      const { error: resendError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: redirectUrl,
      });
      if (resendError) {
        setError(resendError.message || "Failed to resend OTP.");
        return;
      }
      setResendCooldown(60);
    } catch (err: any) {
      setError(err?.message || "Failed to resend OTP.");
    } finally {
      setBusy(false);
    }
  }

  // Step 2: VERIFY OTP ONLY (Before allowing password reset)
  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const cleanOtp = otp.trim().replace(/\D/g, "");
    if (cleanOtp.length < 6) {
      setError("Please enter the complete 6-digit OTP code sent to your email.");
      return;
    }

    setBusy(true);

    try {
      const supabase = createClient();

      // Verify OTP (try recovery first, then fallback to email)
      let { error: verifyError } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: cleanOtp,
        type: "recovery",
      });

      if (verifyError) {
        const { error: emailOtpError } = await supabase.auth.verifyOtp({
          email: email.trim(),
          token: cleanOtp,
          type: "email",
        });
        if (!emailOtpError) {
          verifyError = null;
        }
      }

      if (verifyError) {
        console.error("verifyOtp error:", verifyError);
        setError(
          verifyError.message ||
            "Invalid or expired OTP code. Please check your email or request a new one."
        );
        return;
      }

      // OTP VERIFIED! Now move to password reset step
      setStep("password");
    } catch (err: any) {
      console.error("OTP verification error:", err);
      setError(err?.message || "An unexpected error occurred during OTP verification.");
    } finally {
      setBusy(false);
    }
  }

  // Step 3: SAVE NEW PASSWORD (Runs only after OTP has been verified)
  async function handleSaveNewPassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError("New password must be at least 6 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match. Please re-enter.");
      return;
    }

    setBusy(true);

    try {
      const supabase = createClient();

      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
      });

      if (updateError) {
        console.error("updateUser error:", updateError);
        setError(updateError.message || "Failed to update password.");
        return;
      }

      // Clear session so user logs in cleanly with new credentials
      await supabase.auth.signOut();
      setStep("success");
    } catch (err: any) {
      console.error("Save password error:", err);
      setError(err?.message || "Failed to save new password.");
    } finally {
      setBusy(false);
    }
  }

  // STEP 4: SUCCESS
  if (step === "success") {
    return (
      <main className="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center gap-4 px-6 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 shadow-xs">
          <CheckCircle2 className="h-8 w-8" />
        </div>
        <h1 className="text-2xl font-bold text-neutral-900">Password Reset Complete!</h1>
        <p className="text-sm text-neutral-600">
          Your password has been successfully updated. You can now log in using your new credentials.
        </p>

        <div className="mt-4 w-full">
          <button
            onClick={() =>
              router.push(
                "/login?notice=" +
                  encodeURIComponent("Password reset successfully! Please log in with your new password.")
              )
            }
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-neutral-900 py-2.5 text-sm font-semibold text-white hover:bg-neutral-800 transition"
          >
            <span>Proceed to Log In</span>
            <ArrowRight size={16} />
          </button>
        </div>
      </main>
    );
  }

  // STEP 3: SET NEW PASSWORD (OTP already verified)
  if (step === "password") {
    return (
      <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6 py-10">
        <div className="mb-4 flex items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
          <ShieldCheck size={16} className="text-emerald-600 shrink-0" />
          <span><strong>OTP Verified!</strong> Setting password for {email}</span>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-100 text-neutral-800">
            <Lock size={18} />
          </div>
          <h1 className="text-2xl font-bold text-neutral-900">Set New Password</h1>
        </div>
        <p className="mt-1 text-xs text-neutral-500">
          Choose a new password with at least 6 characters.
        </p>

        {error && (
          <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSaveNewPassword} className="mt-5 flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-xs font-semibold text-neutral-700">
            New Password
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={6}
                required
                autoFocus
                placeholder="At least 6 characters"
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-900 focus:border-blue-600 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </label>

          <label className="flex flex-col gap-1 text-xs font-semibold text-neutral-700">
            Confirm New Password
            <input
              type={showPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              minLength={6}
              required
              placeholder="Repeat your new password"
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-900 focus:border-blue-600 focus:outline-none"
            />
          </label>

          <button
            type="submit"
            disabled={busy || password.length < 6 || password !== confirmPassword}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-neutral-900 py-2.5 text-sm font-semibold text-white hover:bg-neutral-800 disabled:opacity-50 transition"
          >
            {busy ? "Saving New Password…" : "Save New Password"}
          </button>
        </form>
      </main>
    );
  }

  // STEP 2: ENTER & VERIFY OTP ONLY
  if (step === "otp") {
    return (
      <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6 py-10">
        <button
          type="button"
          onClick={() => {
            setStep("email");
            setError(null);
          }}
          className="mb-4 flex w-fit items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-900 transition"
        >
          ← Change Email
        </button>

        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
            <KeyRound size={18} />
          </div>
          <h1 className="text-xl font-bold text-neutral-900">Step 1: Verify OTP</h1>
        </div>
        <p className="mt-1 text-xs text-neutral-600">
          We sent a 6-digit verification code to <strong className="text-neutral-900">{email}</strong>.
          Enter the code below to verify your identity.
        </p>

        {error && (
          <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleVerifyOtp} className="mt-5 flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-xs font-semibold text-neutral-700">
            6-Digit OTP Code
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
              required
              autoFocus
              placeholder="123456"
              className="w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-center font-mono text-xl font-bold tracking-[0.4em] text-neutral-900 placeholder:text-neutral-300 focus:border-blue-600 focus:outline-none"
            />
            <span className="text-[11px] font-normal text-neutral-400">
              Check your inbox or spam folder for the 6-digit code.
            </span>
          </label>

          <button
            type="submit"
            disabled={busy || otp.length < 6}
            className="mt-1 flex w-full items-center justify-center gap-2 rounded-lg bg-neutral-900 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-neutral-800 disabled:opacity-50 transition"
          >
            {busy ? "Verifying OTP…" : "Verify OTP"}
          </button>
        </form>

        {/* Resend OTP */}
        <div className="mt-5 flex items-center justify-between border-t border-neutral-200 pt-3 text-xs text-neutral-500">
          <span>Didn&apos;t receive code?</span>
          {resendCooldown > 0 ? (
            <span className="font-medium text-neutral-400">
              Resend in {resendCooldown}s
            </span>
          ) : (
            <button
              type="button"
              onClick={handleResendOtp}
              disabled={busy}
              className="flex items-center gap-1 font-semibold text-blue-600 hover:text-blue-700 transition"
            >
              <RefreshCw size={12} />
              <span>Resend OTP</span>
            </button>
          )}
        </div>
      </main>
    );
  }

  // STEP 1: ENTER EMAIL
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6 py-10">
      <BackButton className="mb-4" />

      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
          <Mail size={18} />
        </div>
        <h1 className="text-2xl font-bold text-neutral-900">Reset Password</h1>
      </div>
      <p className="mt-1 text-xs text-neutral-500">
        Enter your registered email address and we&apos;ll send you a 6-digit OTP code to verify and reset your password.
      </p>

      {error && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSendOtp} className="mt-5 flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-xs font-semibold text-neutral-700">
          Email address
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
            placeholder="you@example.com"
            className="rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-900 focus:border-blue-600 focus:outline-none"
          />
        </label>

        <button
          type="submit"
          disabled={busy}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-neutral-900 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-neutral-800 disabled:opacity-50 transition"
        >
          {busy ? "Sending OTP…" : "Send 6-Digit OTP"}
          <ArrowRight size={14} />
        </button>
      </form>

      <p className="mt-6 text-center text-xs text-neutral-500">
        Remember your password?{" "}
        <Link href="/login" className="font-semibold text-blue-600 hover:text-blue-700 transition">
          Log in
        </Link>
      </p>
    </main>
  );
}
