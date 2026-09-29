import { createClient } from "@/lib/supabase/server";
import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/";
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  // Check if Supabase returned an error query parameter (e.g. expired link)
  if (error || errorDescription) {
    const errorMsg = errorDescription || error || "Authentication link is invalid or expired";
    if (next.startsWith("/reset-password")) {
      return NextResponse.redirect(
        `${origin}/reset-password?error=${encodeURIComponent(errorMsg)}`
      );
    }
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(errorMsg)}`
    );
  }

  const supabase = await createClient();

  // Helper to create success redirect with recovery protection cookie if resetting password
  function createSuccessRedirect(targetPath: string) {
    const response = NextResponse.redirect(`${origin}${targetPath}`);
    if (targetPath.startsWith("/reset-password")) {
      response.cookies.set("reset_password_in_progress", "1", {
        path: "/",
        httpOnly: false, // Accessible by client so it can be cleared on reset/cancel
        sameSite: "lax",
        maxAge: 60 * 15, // 15 minutes window
      });
    }
    return response;
  }

  // 1. If PKCE auth code is present
  if (code) {
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    if (!exchangeError) {
      return createSuccessRedirect(next);
    }
    console.error("Auth exchangeCode error:", exchangeError);
    if (next.startsWith("/reset-password")) {
      return NextResponse.redirect(
        `${origin}/reset-password?error=${encodeURIComponent(exchangeError.message)}`
      );
    }
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(exchangeError.message)}`
    );
  }

  // 2. If token_hash + type (Email OTP / verifyOtp)
  if (token_hash && type) {
    const { error: verifyError } = await supabase.auth.verifyOtp({
      token_hash,
      type,
    });
    if (!verifyError) {
      return createSuccessRedirect(next);
    }
    console.error("Auth verifyOtp error:", verifyError);
    if (next.startsWith("/reset-password")) {
      return NextResponse.redirect(
        `${origin}/reset-password?error=${encodeURIComponent(verifyError.message)}`
      );
    }
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(verifyError.message)}`
    );
  }

  // 3. Fallback if neither code nor token_hash is present
  if (next.startsWith("/reset-password")) {
    return NextResponse.redirect(
      `${origin}/reset-password?error=${encodeURIComponent("No verification code found in link.")}`
    );
  }

  return NextResponse.redirect(
    `${origin}/login?error=${encodeURIComponent("Authentication link is invalid or expired.")}`
  );
}
