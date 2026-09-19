"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { headers } from "next/headers";

const VALID_SIGNUP_ROLES = new Set(["user", "worker", "college_admin"]);

export async function signup(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const displayName = String(formData.get("display_name") ?? "");
  const collegeId = String(formData.get("college_id") ?? "");
  const requestedRole = String(formData.get("requested_role") ?? "user");
  const next = String(formData.get("next") ?? "") || "/";

  if (!email || !password || !collegeId) {
    redirect(`/signup?error=Missing+required+fields&next=${encodeURIComponent(next)}`);
  }
  if (!VALID_SIGNUP_ROLES.has(requestedRole)) {
    redirect(`/signup?error=Invalid+role&next=${encodeURIComponent(next)}`);
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        display_name: displayName,
        college_id: collegeId,
        // handle_new_user() only turns this into a role_requests row when
        // it's 'worker' or 'college_admin' AND the college currently allows it.
        requested_role: requestedRole === "user" ? null : requestedRole,
      },
    },
  });

  if (error) {
    redirect(`/signup?error=${encodeURIComponent(error.message)}&next=${encodeURIComponent(next)}`);
  }

  if (requestedRole === "user") {
    redirect(next);
  }
  redirect(
    `/login?next=${encodeURIComponent(next)}&notice=${encodeURIComponent(
      "Account created. Confirm your email, then log in — your " +
        (requestedRole === "worker" ? "worker" : "college admin") +
        " access needs approval first."
    )}`
  );
}

export async function signInWithGoogle(formData: FormData) {
  const next = String(formData.get("next") ?? "") || "/";
  const origin = (await headers()).get("origin");

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });

  if (error || !data?.url) {
    redirect(`/login?error=${encodeURIComponent(error?.message ?? "Google sign-in failed")}`);
  }

  redirect(data.url);
}

export async function login(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "") || "/";

  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}&next=${encodeURIComponent(next)}`);
  }

  redirect(next);
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
