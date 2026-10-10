import { createClient } from "@/lib/supabase/server";
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

  const { active, expired, tableExists } = await getAdminBroadcasts(collegeId);

  return (
    <BroadcastsManagerClient
      collegeName={collegeName}
      initialActive={active}
      initialExpired={expired}
      tableExists={tableExists}
    />
  );
}
