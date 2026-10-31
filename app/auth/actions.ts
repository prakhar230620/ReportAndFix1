"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
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

  // Check if this is the first signup for this organisation
  const { count: memberCount } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("college_id", collegeId);

  const isFirstSignup = (memberCount ?? 0) === 0;

  if (!isFirstSignup) {
    // Organisation already has members — validate join code if organisation has an active code
    const { data: activeJoinCode } = await supabase
      .from("org_join_codes")
      .select("code")
      .eq("college_id", collegeId)
      .eq("is_active", true)
      .maybeSingle();

    if (activeJoinCode) {
      const joinCode = String(formData.get("join_code") ?? "").trim().toUpperCase();
      if (!joinCode) {
        redirect(
          `/signup?error=${encodeURIComponent(
            "Organisation join code is required to join this organisation."
          )}&next=${encodeURIComponent(next)}&org=${encodeURIComponent(collegeId)}`
        );
      }
      if (joinCode !== activeJoinCode.code.toUpperCase()) {
        redirect(
          `/signup?error=${encodeURIComponent(
            "Invalid organisation join code. Ask your organisation administrator for the code."
          )}&next=${encodeURIComponent(next)}&org=${encodeURIComponent(collegeId)}`
        );
      }
    }
  }



  const { data: signUpData, error } = await supabase.auth.signUp({
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

  // If Supabase requires email verification, there is no active session yet
  if (!signUpData?.session) {
    if (requestedRole === "user") {
      redirect(
        `/login?next=${encodeURIComponent(next)}&notice=${encodeURIComponent(
          "Account created! Please check your email to verify your account, then log in."
        )}`
      );
    } else {
      redirect(
        `/login?next=${encodeURIComponent(next)}&notice=${encodeURIComponent(
          "Account created! Please check your email to verify your account. Note that your " +
            (requestedRole === "worker" ? "worker" : "college admin") +
            " role requires administrator approval before taking effect."
        )}`
      );
    }
  }

  if (requestedRole === "user") {
    redirect(next);
  }
  redirect(
    `/login?next=${encodeURIComponent(next)}&notice=${encodeURIComponent(
      "Account created! Your " +
        (requestedRole === "worker" ? "worker" : "college admin") +
        " role access is pending administrator approval."
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

  // Auth actions must not silently continue if the refreshed session cookie cannot be written.
  const supabase = await createClient({ strictCookieWrites: true });

  const authResult = await supabase.auth
    .signInWithPassword({ email, password })
    .catch(() => null);

  if (!authResult) {
    redirect(
      `/login?error=${encodeURIComponent("Unable to save your login session. Please try again.")}&next=${encodeURIComponent(next)}`
    );
  }

  const { data: authData, error } = authResult;

  if (error || !authData?.user) {
    redirect(`/login?error=${encodeURIComponent(error?.message ?? "Login failed")}&next=${encodeURIComponent(next)}`);
  }

  // Confirm the server-side session now belongs to the account that just signed in.
  // This prevents continuing with a stale account session after switching roles.
  const {
    data: { user: verifiedUser },
    error: verificationError,
  } = await supabase.auth.getUser();

  if (verificationError || !verifiedUser || verifiedUser.id !== authData.user.id) {
    await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
    redirect(
      `/login?error=${encodeURIComponent("The new login session could not be verified. Please sign in again.")}&next=${encodeURIComponent(next)}`
    );
  }

  // Fetch the role of the verified account, never a previously authenticated account.
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", verifiedUser.id)
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
  const supabase = await createClient({ strictCookieWrites: true });

  // Sign out only this browser/device; a failed network-side global sign-out
  // must not leave this browser authenticated as the previous account.
  await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);

  // Explicitly expire the Supabase SSR auth cookie and any numbered chunks.
  // This is a final safeguard against stale auth cookies surviving account switches.
  const cookieStore = await cookies();
  const projectRef = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname.split(".")[0];
  const authCookiePrefix = `sb-${projectRef}-auth-token`;

  for (const cookie of cookieStore.getAll()) {
    if (
      cookie.name === authCookiePrefix ||
      cookie.name.startsWith(`${authCookiePrefix}.`)
    ) {
      cookieStore.delete(cookie.name);
    }
  }

  const authCookieStillPresent = cookieStore.getAll().some(
    ({ name }) =>
      name === authCookiePrefix || name.startsWith(`${authCookiePrefix}.`)
  );

  if (authCookieStillPresent) {
    redirect(
      `/login?error=${encodeURIComponent("Could not clear the previous login session. Please retry logging out.")}`
    );
  }

  revalidatePath("/", "layout");
  redirect("/login");
}

/**
 * Allows a user whose worker role_request was previously rejected to submit
 * a fresh pending request. The user keeps their current 'user' role until approved.
 */
export async function reApplyForWorker(): Promise<{ ok?: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, college_id")
    .eq("id", user.id)
    .single();

  if (!profile?.college_id) return { error: "No organisation found on your profile." };
  if (profile.role !== "user") return { error: "Only regular users can re-apply for a worker role." };

  // Check there is an existing rejected worker request for this user
  const { data: existing } = await supabase
    .from("role_requests")
    .select("id, status")
    .eq("user_id", user.id)
    .eq("requested_role", "worker")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!existing) return { error: "No previous worker application found." };
  if (existing.status === "pending") return { error: "You already have a pending worker request." };
  if (existing.status === "approved") return { error: "Your request was already approved." };
  // Only allow if status is 'rejected'
  if (existing.status !== "rejected") return { error: "No rejected request to re-apply from." };

  // Insert a new pending request
  const { error: insertErr } = await supabase.from("role_requests").insert({
    user_id: user.id,
    college_id: profile.college_id,
    requested_role: "worker",
    status: "pending",
  });

  if (insertErr) return { error: insertErr.message };

  revalidatePath("/");
  return { ok: true };
}
