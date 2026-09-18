import { createClient } from "@/lib/supabase/server";
import LocationsManager from "./LocationsManager";

export default async function LocationsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("college_id, role")
    .eq("id", user!.id)
    .single();

  const collegeId = profile?.college_id;

  const [{ data: buildings }, { data: floors }, { data: locations }] =
    await Promise.all([
      supabase.from("buildings").select("id, name").eq("college_id", collegeId).order("name"),
      supabase
        .from("floors")
        .select("id, label, building_id")
        .in("building_id", (
          await supabase.from("buildings").select("id").eq("college_id", collegeId)
        ).data?.map((b) => b.id) ?? []),
      supabase
        .from("locations")
        .select("id, name, location_code, location_type, active, qr_token, building_id, floor_id")
        .eq("college_id", collegeId)
        .order("name"),
    ]);

  return (
    <LocationsManager
      buildings={buildings ?? []}
      floors={floors ?? []}
      locations={locations ?? []}
    />
  );
}
