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
