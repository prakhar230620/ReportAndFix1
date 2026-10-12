import { createClient } from "@/lib/supabase/server";
import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  // For password recovery, ALWAYS redirect to /reset-password regardless of `next` param.
  // Supabase may send the email with site URL as the base (not /auth/callback?next=/reset-password)
  // so we detect the intent from the `type` param or the `next` param.
  const isRecovery =
    type === "recovery" ||
    searchParams.get("next")?.startsWith("/reset-password");

  const next = isRecovery
    ? "/reset-password"
    : (searchParams.get("next") ?? "/");

  // Supabase returned an error (e.g. expired link, invalid token)
  if (error || errorDescription) {
    const errorMsg =
      errorDescription || error || "Authentication link is invalid or expired";
    if (isRecovery) {
      return NextResponse.redirect(
        `${origin}/reset-password?error=${encodeURIComponent(errorMsg)}`
      );
    }
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(errorMsg)}`
    );
  }

  const supabase = await createClient();

  // Helper: redirect with a short-lived reset cookie so /reset-password knows it's in progress
  function createSuccessRedirect(targetPath: string) {
    const response = NextResponse.redirect(`${origin}${targetPath}`);
    if (targetPath.startsWith("/reset-password")) {
      response.cookies.set("reset_password_in_progress", "1", {
        path: "/",
        httpOnly: false,
        sameSite: "lax",
        maxAge: 60 * 15, // 15 minutes
      });
    }
    return response;
  }

  // 1. PKCE auth code flow (used when `redirectTo` includes /auth/callback)
  if (code) {
    const { error: exchangeError } =
      await supabase.auth.exchangeCodeForSession(code);
    if (!exchangeError) {
      return createSuccessRedirect(next);
    }
    console.error("Auth exchangeCode error:", exchangeError);
    if (isRecovery) {
      return NextResponse.redirect(
        `${origin}/reset-password?error=${encodeURIComponent(exchangeError.message)}`
      );
    }
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(exchangeError.message)}`
    );
  }

  // 2. token_hash + type (OTP / email link flow — most common for password recovery)
  if (token_hash && type) {
    const { error: verifyError } = await supabase.auth.verifyOtp({
      token_hash,
      type,
    });
    if (!verifyError) {
      // type=recovery → always land on /reset-password
      const redirectPath = type === "recovery" ? "/reset-password" : next;
      return createSuccessRedirect(redirectPath);
    }
    console.error("Auth verifyOtp error:", verifyError);
    if (isRecovery || type === "recovery") {
      return NextResponse.redirect(
        `${origin}/reset-password?error=${encodeURIComponent(verifyError.message)}`
      );
    }
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(verifyError.message)}`
    );
  }

  // 3. Fallback — no code or token_hash found
  if (isRecovery) {
    return NextResponse.redirect(
      `${origin}/reset-password?error=${encodeURIComponent(
        "No verification code found in link."
      )}`
    );
  }

  return NextResponse.redirect(
    `${origin}/login?error=${encodeURIComponent(
      "Authentication link is invalid or expired."
    )}`
  );
}
