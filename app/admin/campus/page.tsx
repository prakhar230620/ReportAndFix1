import { createClient } from "@/lib/supabase/server";
import CampusTreeView from "./CampusTreeView";

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
      .select("id, node_id, qr_token, active")
      .eq("college_id", collegeId!)
      .not("node_id", "is", null),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">Campus map</h1>
        <p className="text-sm text-neutral-600">
          A read-only view of your institution&apos;s structure. To add or
          change anything, go to{" "}
          <a href="/admin/locations" className="underline">
            Locations &amp; QR
          </a>
          .
        </p>
      </div>
      <CampusTreeView
        nodeTypes={nodeTypes ?? []}
        nodes={nodes ?? []}
        locations={locations ?? []}
      />
    </div>
  );
}

