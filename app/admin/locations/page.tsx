import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

import LocationExplorer from "./LocationExplorer";

export default async function LocationsPage() {
  const supabase = await createClient();

  const { data: gProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", (await supabase.auth.getUser()).data.user!.id)
    .single();
  if (gProfile?.role === "super_admin") redirect("/super-admin");

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("college_id")
    .eq("id", user!.id)
    .single();

  const collegeId = profile?.college_id;

  const { data: locations, error: locationsError } = await supabase
    .from("locations")
    .select(
      "id, parent_id, name, description, location_code, qr_token, active, archived, archived_at, created_at, updated_at"
    )
    .eq("college_id", collegeId!)
    .order("name");

  if (locationsError) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Couldn&apos;t load locations: {locationsError.message}
      </div>
    );
  }

  const { data: complaintCounts } = await supabase
    .from("complaints")
    .select("location_id")
    .eq("college_id", collegeId!);

  const counts: Record<string, number> = {};
  for (const c of complaintCounts ?? []) {
    if (c.location_id) counts[c.location_id] = (counts[c.location_id] ?? 0) + 1;
  }

  const { data: college } = await supabase
    .from("colleges")
    .select("name")
    .eq("id", collegeId!)
    .single();

  return (
    <LocationExplorer
      orgName={college?.name ?? "Organisation"}
      locations={locations ?? []}
      complaintCounts={counts}
    />
  );
}
