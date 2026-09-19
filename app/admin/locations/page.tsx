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

  const [{ data: buildings }, { data: floors }, { data: locations }, { data: nodeTypes }, { data: nodes }] =
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
        .select("id, name, location_code, location_type, active, qr_token, building_id, floor_id, node_id")
        .eq("college_id", collegeId)
        .order("name"),
      supabase.from("node_types").select("id, name, typical_children").eq("college_id", collegeId!).order("name"),
      supabase
        .from("campus_nodes")
        .select("id, parent_id, node_type_id, name, sort_order")
        .eq("college_id", collegeId!)
        .order("sort_order")
        .order("name"),
    ]);

  return (
    <LocationsManager
      buildings={buildings ?? []}
      floors={floors ?? []}
      locations={locations ?? []}
      nodeTypes={nodeTypes ?? []}
      nodes={nodes ?? []}
    />
  );
}
