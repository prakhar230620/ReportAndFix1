"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

const VALID_SIGNUP_ROLES = new Set(["user", "worker", "college_admin"]);

export async function signup(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const displayName = String(formData.get("display_name") ?? "");
  const collegeId = String(formData.get("college_id") ?? "");
  const requestedRole = String(formData.get("requested_role") ?? "user");
  const next = String(formData.get("next") ?? "") || "/";

  const acceptTerms = formData.get("accept_terms");
  if (!acceptTerms) {
    redirect(`/signup?error=You+must+accept+the+Terms+of+Service+to+create+an+account.&next=${encodeURIComponent(next)}`);
  }

  if (!email || !password || !collegeId) {
    redirect(`/signup?error=Missing+required+fields&next=${encodeURIComponent(next)}`);
  }
  if (!VALID_SIGNUP_ROLES.has(requestedRole)) {
    redirect(`/signup?error=Invalid+role&next=${encodeURIComponent(next)}`);
  }


  const supabase = await createClient();

  // Check if college is frozen
  const { data: college } = await supabase
    .from("colleges")
    .select("is_frozen")
    .eq("id", collegeId)
    .single();

  if (college?.is_frozen) {
    redirect(`/signup?error=This+organisation+is+temporarily+unavailable.+Contact+your+administrator.&next=${encodeURIComponent(next)}`);
  }

  // Validate join code if organisation has an active code
  const joinCode = String(formData.get("join_code") ?? "").trim().toUpperCase();
  const { data: activeJoinCode } = await supabase
    .from("org_join_codes")
    .select("code")
    .eq("college_id", collegeId)
    .eq("is_active", true)
    .maybeSingle();

  if (activeJoinCode) {
    if (!joinCode || joinCode !== activeJoinCode.code) {
      redirect(`/signup?error=Invalid+or+missing+organisation+join+code.+Please+ask+your+admin.&next=${encodeURIComponent(next)}`);
    }
  }


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
  let next = String(formData.get("next") ?? "") || "/";

  const supabase = await createClient();

  const { data: authData, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !authData?.user) {
    redirect(`/login?error=${encodeURIComponent(error?.message ?? "Login failed")}&next=${encodeURIComponent(next)}`);
  }

  // Fetch the role of the user logging in to prevent redirecting to another role's dashboard
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", authData.user.id)
    .single();

  const role = profile?.role;

  // Prevent routing to another role's panel left behind in the query string from previous session
  if (next.startsWith("/super-admin") && role !== "super_admin") {
    next = "/";
  } else if (next.startsWith("/admin") && role !== "college_admin" && role !== "super_admin") {
    next = "/";
  } else if (next.startsWith("/dept-admin") && role !== "dept_admin" && role !== "college_admin" && role !== "super_admin") {
    next = "/";
  } else if (next.startsWith("/worker") && role !== "worker" && role !== "college_admin" && role !== "super_admin") {
    next = "/";
  }

  revalidatePath("/", "layout");
  redirect(next);
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
