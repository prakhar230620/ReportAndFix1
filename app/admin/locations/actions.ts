"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function createBuilding(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("college_id")
    .eq("id", user!.id)
    .single();

  const name = String(formData.get("name") ?? "").trim();
  if (!name || !profile?.college_id) return;

  const { error } = await supabase
    .from("buildings")
    .insert({ college_id: profile.college_id, name });

  if (error) throw new Error(error.message);
  revalidatePath("/admin/locations");
}

export async function createFloor(formData: FormData) {
  const supabase = await createClient();
  const buildingId = String(formData.get("building_id") ?? "");
  const label = String(formData.get("label") ?? "").trim();
  if (!buildingId || !label) return;

  const { error } = await supabase
    .from("floors")
    .insert({ building_id: buildingId, label });

  if (error) throw new Error(error.message);
  revalidatePath("/admin/locations");
}

export async function createLocation(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("college_id")
    .eq("id", user!.id)
    .single();

  const buildingId = String(formData.get("building_id") ?? "") || null;
  const floorId = String(formData.get("floor_id") ?? "") || null;
  const name = String(formData.get("name") ?? "").trim();
  const locationCode = String(formData.get("location_code") ?? "").trim() || null;
  const locationType = String(formData.get("location_type") ?? "other");

  if (!name || !profile?.college_id) return;

  const { error } = await supabase.from("locations").insert({
    college_id: profile.college_id,
    building_id: buildingId,
    floor_id: floorId,
    name,
    location_code: locationCode,
    location_type: locationType,
  });

  if (error) throw new Error(error.message);
  revalidatePath("/admin/locations");
}

export async function updateBuilding(buildingId: string, name: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("buildings").update({ name }).eq("id", buildingId);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/locations");
}

export async function deleteBuilding(buildingId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("buildings").delete().eq("id", buildingId);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/locations");
}

export async function updateFloor(floorId: string, label: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("floors").update({ label }).eq("id", floorId);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/locations");
}

export async function deleteFloor(floorId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("floors").delete().eq("id", floorId);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/locations");
}

export async function deleteLocation(locationId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("locations").delete().eq("id", locationId);

  if (error) throw new Error(error.message);
  revalidatePath("/admin/locations");
}

export async function setLocationActive(locationId: string, active: boolean) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("locations")
    .update({ active })
    .eq("id", locationId);

  if (error) throw new Error(error.message);
  revalidatePath("/admin/locations");
}

export async function regenerateQrToken(locationId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("regenerate_location_qr_token" as never, {
    p_location_id: locationId,
  } as never);

  if (error) throw new Error(error.message);
  revalidatePath("/admin/locations");
}

export async function reassignQr(qrToken: string, newLocationId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("reassign_location_qr" as never, {
    p_qr_token: qrToken,
    p_new_location_id: newLocationId,
  } as never);

  if (error) throw new Error(error.message);
  revalidatePath("/admin/locations");
}
