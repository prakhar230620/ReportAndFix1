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

export async function createCollege(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const category = String(formData.get("category") ?? "college");

  if (!name) return { error: "Name is required" };

  const supabase = await createClient();
  const { error } = await supabase.from("colleges").insert({ name, category });

  if (error) return { error: error.message };
  revalidatePath("/super-admin");
  return { ok: true };
}
