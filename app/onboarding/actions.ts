"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

const VALID_ROLES = new Set(["user", "worker", "college_admin"]);

export async function completeOnboarding(formData: FormData) {
  const displayName = String(formData.get("display_name") ?? "");
  const collegeId = String(formData.get("college_id") ?? "");
  const requestedRole = String(formData.get("requested_role") ?? "user");
  const next = String(formData.get("next") ?? "") || "/";

  if (!collegeId) {
    redirect(`/onboarding?error=Please+select+your+college&next=${encodeURIComponent(next)}`);
  }
  if (!VALID_ROLES.has(requestedRole)) {
    redirect(`/onboarding?error=Invalid+role&next=${encodeURIComponent(next)}`);
  }

  const supabase = await createClient();

  const { error } = await supabase.rpc("complete_onboarding" as never, {
    p_college_id: collegeId,
    p_display_name: displayName,
  } as never);

  if (error) {
    redirect(`/onboarding?error=${encodeURIComponent(error.message)}&next=${encodeURIComponent(next)}`);
  }

  const sep = next.includes("?") ? "&" : "?";

  if (requestedRole !== "user") {
    const { error: roleError } = await supabase.rpc("request_role_upgrade" as never, {
      p_role: requestedRole,
    } as never);
    // Non-fatal: onboarding still completes as a regular user; surface the
    // reason (e.g. college has that role disabled right now) but don't block.
    if (roleError) {
      redirect(`${next}${sep}notice=${encodeURIComponent("Profile created. Role request failed: " + roleError.message)}`);
    }
    redirect(
      `${next}${sep}notice=${encodeURIComponent(
        "Profile created. Your " +
          (requestedRole === "worker" ? "worker" : "college admin") +
          " access is pending approval."
      )}`
    );
  }

  redirect(next);
}
