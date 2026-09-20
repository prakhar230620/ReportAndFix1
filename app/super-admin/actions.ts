"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function setCollegeStatus(collegeId: string, status: "active" | "suspended") {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_college_status" as never, {
    p_college_id: collegeId,
    p_status: status,
  } as never);

  if (error) return { error: error.message };
  revalidatePath("/super-admin");
  return { ok: true };
}

const DEFAULT_CATEGORIES = [
  "Electrical", "Plumbing", "Furniture", "HVAC / Air Conditioning",
  "Cleaning & Housekeeping", "IT & Network", "Internet / WiFi", "Security",
  "Fire Safety", "Elevator / Lift", "Water Supply", "Waste Management",
  "Pest Control", "Signage", "Parking", "Landscaping / Grounds",
  "Structural / Civil", "Noise Complaint", "Vending / Equipment", "Others",
];

export async function createCollege(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const category = String(formData.get("category") ?? "college");

  if (!name) return { error: "Name is required" };

  const supabase = await createClient();
  const { data: college, error } = await supabase
    .from("colleges")
    .insert({ name, category })
    .select("id")
    .single();

  if (error) return { error: error.message };

  await supabase
    .from("categories")
    .insert(DEFAULT_CATEGORIES.map((n) => ({ college_id: college.id, name: n })));

  revalidatePath("/super-admin");
  return { ok: true };
}
