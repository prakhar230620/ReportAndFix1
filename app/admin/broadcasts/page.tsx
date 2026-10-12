import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { getAdminBroadcasts } from "@/lib/broadcasts";
import BroadcastsManagerClient from "./BroadcastsManagerClient";

export const dynamic = "force-dynamic";

export default async function BroadcastsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, college_id, colleges(name)")
    .eq("id", user.id)
    .single();

  if (!profile || (profile.role !== "college_admin" && profile.role !== "super_admin")) {
    redirect("/");
  }

  const collegeId = profile.college_id;
  if (!collegeId) redirect("/onboarding");

  const collegeName = (profile.colleges as any)?.name ?? "Organisation";

  const adminClient = createAdminClient();
  const [{ active, expired, tableExists }, { data: sub }] = await Promise.all([
    getAdminBroadcasts(collegeId),
    adminClient
      .from("org_subscriptions")
      .select("status, plans(broadcasting_enabled, name, slug)")
      .eq("college_id", collegeId)
      .in("status", ["active", "trial", "manually_assigned"])
      .maybeSingle(),
  ]);

  const plan = sub?.plans as any;
  // If plan exists and broadcasting_enabled is explicitly false, it is disabled
  const broadcastingEnabled = plan ? plan.broadcasting_enabled !== false : true;
  const planName = plan?.name ?? "Starter";

  return (
    <BroadcastsManagerClient
      collegeName={collegeName}
      initialActive={active}
      initialExpired={expired}
      tableExists={tableExists}
      broadcastingEnabled={broadcastingEnabled}
      planName={planName}
    />
  );
}
