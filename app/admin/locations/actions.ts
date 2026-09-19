"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

function code(name: string) {
  return (
    name
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 12) +
    "-" +
    Math.random().toString(36).slice(2, 5).toUpperCase()
  );
}

async function me(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, college_id, role")
    .eq("id", user!.id)
    .single();
  return profile;
}

export async function createLocation(parentId: string | null, name: string, description: string) {
  const supabase = await createClient();
  const profile = await me(supabase);
  if (!profile?.college_id) return { error: "No college context" };
  if (!name.trim()) return { error: "Name is required" };

  const { error } = await supabase.from("locations").insert({
    college_id: profile.college_id,
    parent_id: parentId,
    name: name.trim(),
    description: description.trim() || null,
    created_by: profile.id,
  });

  if (error) return { error: error.message };
  revalidatePath("/admin/locations");
  return { ok: true };
}

export async function updateLocation(id: string, name: string, description: string) {
  const supabase = await createClient();
  if (!name.trim()) return { error: "Name is required" };
  const { error } = await supabase
    .from("locations")
    .update({ name: name.trim(), description: description.trim() || null })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/locations");
  return { ok: true };
}

export async function assignQr(id: string) {
  const supabase = await createClient();
  const { data: loc } = await supabase.from("locations").select("name").eq("id", id).single();
  const { error } = await supabase
    .from("locations")
    .update({ qr_token: crypto.randomUUID(), location_code: code(loc?.name ?? "LOC") })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/locations");
  return { ok: true };
}

export async function removeQr(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("locations")
    .update({ qr_token: null, location_code: null })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/locations");
  return { ok: true };
}

export async function regenerateQr(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("locations")
    .update({ qr_token: crypto.randomUUID() })
    .eq("id", id)
    .not("qr_token", "is", null);
  if (error) return { error: error.message };
  revalidatePath("/admin/locations");
  return { ok: true };
}

export async function setReportingEnabled(id: string, active: boolean) {
  const supabase = await createClient();
  const { error } = await supabase.from("locations").update({ active }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/locations");
  return { ok: true };
}

export async function moveLocation(id: string, newParentId: string | null) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("locations")
    .update({ parent_id: newParentId })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/locations");
  return { ok: true };
}

export async function archiveLocation(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("locations")
    .update({ archived: true, archived_at: new Date().toISOString(), active: false })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/locations");
  return { ok: true };
}

export async function unarchiveLocation(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("locations")
    .update({ archived: false, archived_at: null })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/locations");
  return { ok: true };
}

export async function deleteLocation(id: string) {
  const supabase = await createClient();

  const [{ count: childCount }, { count: complaintCount }] = await Promise.all([
    supabase.from("locations").select("id", { count: "exact", head: true }).eq("parent_id", id),
    supabase.from("complaints").select("id", { count: "exact", head: true }).eq("location_id", id),
  ]);

  if ((childCount ?? 0) > 0) {
    return { error: "This location still has sub-locations. Move or remove them first." };
  }
  if ((complaintCount ?? 0) > 0) {
    return {
      error:
        "This location has complaint history — archive it instead of deleting, to keep records intact.",
    };
  }

  const { error } = await supabase.from("locations").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/locations");
  return { ok: true };
}
