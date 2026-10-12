import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

type CookieToSet = { name: string; value: string; options?: CookieOptions };

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const pathname = request.nextUrl.pathname;

  // Intercept any auth code or recovery callbacks landing on '/' (e.g. from password recovery email)
  const code = request.nextUrl.searchParams.get("code");
  const token_hash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type");

  if (
    pathname === "/" &&
    (code || (token_hash && (type === "recovery" || type === "email")) || type === "recovery")
  ) {
    const callbackUrl = request.nextUrl.clone();
    callbackUrl.pathname = "/auth/callback";
    callbackUrl.searchParams.set("next", "/reset-password");
    return NextResponse.redirect(callbackUrl);
  }

  // Security guard: If user is in the middle of password reset,
  // do not let them access the admin panel, worker tasks, or any other app routes
  // until they complete the reset or explicitly return to login.
  const isResetInProgress =
    request.cookies.get("reset_password_in_progress")?.value === "1";

  if (
    isResetInProgress &&
    !pathname.startsWith("/reset-password") &&
    !pathname.startsWith("/auth") &&
    !pathname.startsWith("/api")
  ) {
    if (pathname === "/login") {
      response = NextResponse.next({ request });
      response.cookies.delete("reset_password_in_progress");
      return response;
    }
    // Force them back to reset-password page
    const url = request.nextUrl.clone();
    url.pathname = "/reset-password";
    return NextResponse.redirect(url);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const exempt =
    pathname.startsWith("/onboarding") ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/signup") ||
    pathname.startsWith("/forgot-password") ||
    pathname.startsWith("/reset-password") ||
    pathname.startsWith("/api");

  if (user && !exempt) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("college_id, role")
      .eq("id", user.id)
      .single();

    // Google OAuth (and any account without a completed profile) must pick
    // a college + role before doing anything else. super_admin has no
    // college_id by design, so it's excluded.
    if (profile && !profile.college_id && profile.role !== "super_admin") {
      const url = request.nextUrl.clone();
      url.pathname = "/onboarding";
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
  }

  // Prevent browser caching across multiple role logins on the same browser
  response.headers.set(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0"
  );
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
