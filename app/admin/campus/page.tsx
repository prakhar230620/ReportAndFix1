import { createClient } from "@/lib/supabase/server";
import CampusTree from "./CampusTree";

export default async function CampusPage() {
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

  const [{ data: nodeTypes }, { data: nodes }, { data: locations }] = await Promise.all([
    supabase.from("node_types").select("id, name").eq("college_id", collegeId!).order("name"),
    supabase
      .from("campus_nodes")
      .select("id, parent_id, node_type_id, name, sort_order")
      .eq("college_id", collegeId!)
      .order("sort_order")
      .order("name"),
    supabase
      .from("locations")
      .select("id, node_id, name, location_code, qr_token, active")
      .eq("college_id", collegeId!)
      .not("node_id", "is", null),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Campus structure</h1>
        <p className="text-sm text-neutral-600">
          Build your institution&apos;s layout — campuses, buildings, floors, rooms,
          labs, anything — exactly how it really looks.
        </p>
      </div>
      <CampusTree
        nodeTypes={nodeTypes ?? []}
        nodes={nodes ?? []}
        locations={locations ?? []}
      />
    </div>
  );
}
