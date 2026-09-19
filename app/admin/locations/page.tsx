import { createClient } from "@/lib/supabase/server";
import LocationExplorer from "./LocationExplorer";

export default async function LocationsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("college_id")
    .eq("id", user!.id)
    .single();

  const collegeId = profile?.college_id;

  const { data: locations } = await supabase
    .from("locations")
    .select(
      "id, parent_id, name, description, location_code, qr_token, active, archived, archived_at, created_at, updated_at"
    )
    .eq("college_id", collegeId!)
    .order("name");

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
