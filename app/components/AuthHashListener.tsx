"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Detects password recovery tokens or error fragments in URL hash or search params
 * and automatically forwards the user to /reset-password if they land on the home page
 * or any other page unexpectedly.
 */
export default function AuthHashListener() {
  const router = useRouter();

  useEffect(() => {
    if (typeof window === "undefined") return;

    const pathname = window.location.pathname;
    const hash = window.location.hash;
    const search = window.location.search;

    // Only intercept if we are NOT already on the reset-password or auth/callback page
    if (pathname !== "/reset-password" && !pathname.startsWith("/auth/callback")) {
      // 1. Check URL hash for recovery tokens or recovery errors
      // Supabase email templates commonly redirect to /#access_token=...&type=recovery
      if (hash) {
        const hashParams = new URLSearchParams(hash.replace(/^#/, ""));
        const hashType = hashParams.get("type");
        const hasAccessToken = hashParams.has("access_token");
        const hasRecoveryError =
          hashParams.has("error") || hashParams.has("error_description");

        if (
          hashType === "recovery" ||
          (hasAccessToken && (hashType === "recovery" || !hashType)) ||
          hasRecoveryError
        ) {
          window.location.replace(`/reset-password${hash}`);
          return;
        }
      }

      // 2. Check search params for code, recovery type or error
      if (search) {
        const searchParams = new URLSearchParams(search);
        if (
          searchParams.has("code") ||
          searchParams.get("type") === "recovery" ||
          searchParams.get("next")?.startsWith("/reset-password") ||
          searchParams.has("error")
        ) {
          const code = searchParams.get("code");
          if (code) {
            window.location.replace(`/auth/callback?code=${encodeURIComponent(code)}&next=/reset-password`);
            return;
          }
          window.location.replace(`/reset-password${search}`);
          return;
        }
      }
    }

    // 3. Listen to Supabase auth events (e.g. if Supabase client consumes hash and emits PASSWORD_RECOVERY)
    const supabase = createClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        if (window.location.pathname !== "/reset-password") {
          router.push("/reset-password");
        }
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [router]);

  return null;
}
