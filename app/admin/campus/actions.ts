"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

async function myCollegeId(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("college_id")
    .eq("id", user!.id)
    .single();
  return profile?.college_id ?? null;
}

export async function createNodeType(name: string) {
  const supabase = await createClient();
  const collegeId = await myCollegeId(supabase);
  if (!collegeId || !name.trim()) return { error: "Missing name" };

  const { error } = await supabase
    .from("node_types")
    .insert({ college_id: collegeId, name: name.trim() });
  if (error) return { error: error.message };
  revalidatePath("/admin/campus");
  return { ok: true };
}

export async function createNode(parentId: string | null, nodeTypeId: string, name: string) {
  const supabase = await createClient();
  const collegeId = await myCollegeId(supabase);
  if (!collegeId || !nodeTypeId || !name.trim()) return { error: "Missing fields" };

  const { error } = await supabase.from("campus_nodes").insert({
    college_id: collegeId,
    parent_id: parentId,
    node_type_id: nodeTypeId,
    name: name.trim(),
  });
  if (error) return { error: error.message };
  revalidatePath("/admin/campus");
  return { ok: true };
}

export async function renameNode(nodeId: string, name: string) {
  const supabase = await createClient();
  if (!name.trim()) return { error: "Name required" };
  const { error } = await supabase
    .from("campus_nodes")
    .update({ name: name.trim() })
    .eq("id", nodeId);
  if (error) return { error: error.message };
  revalidatePath("/admin/campus");
  return { ok: true };
}

export async function deleteNode(nodeId: string) {
  const supabase = await createClient();
  // Cascades to child nodes; locations.node_id is set null (FK has no cascade
  // configured, so guard here) -- Postgres will raise if a location still
  // points at a deleted node; caller UI should delete the location first.
  const { error } = await supabase.from("campus_nodes").delete().eq("id", nodeId);
  if (error) return { error: error.message };
  revalidatePath("/admin/campus");
  return { ok: true };
}

export async function createLeafLocation(nodeId: string, name: string, locationCode: string) {
  const supabase = await createClient();
  const collegeId = await myCollegeId(supabase);
  if (!collegeId || !name.trim()) return { error: "Missing fields" };

  const { error } = await supabase.from("locations").insert({
    college_id: collegeId,
    node_id: nodeId,
    name: name.trim(),
    location_code: locationCode.trim() || null,
    location_type: "other",
  });
  if (error) return { error: error.message };
  revalidatePath("/admin/campus");
  return { ok: true };
}
