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

export async function createDepartment(name: string) {
  const supabase = await createClient();
  const collegeId = await myCollegeId(supabase);
  if (!collegeId || !name.trim()) return { error: "Name required" };
  const { error } = await supabase.from("departments").insert({ college_id: collegeId, name: name.trim() });
  if (error) return { error: error.message };
  revalidatePath("/admin/departments");
  return { ok: true };
}

export async function renameDepartment(id: string, name: string) {
  const supabase = await createClient();
  if (!name.trim()) return { error: "Name required" };
  const { error } = await supabase.from("departments").update({ name: name.trim() }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/departments");
  return { ok: true };
}

export async function setDepartmentSuspended(id: string, suspended: boolean) {
  const supabase = await createClient();
  const { error } = await supabase.from("departments").update({ suspended }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/departments");
  return { ok: true };
}

export async function deleteDepartment(id: string) {
  const supabase = await createClient();
  const { count } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("department_id", id);
  if ((count ?? 0) > 0) {
    return { error: "Move or remove its workers before deleting this department." };
  }
  const { error } = await supabase.from("departments").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/departments");
  return { ok: true };
}

export async function setWorkerDepartment(workerId: string, departmentId: string | null) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ department_id: departmentId })
    .eq("id", workerId)
    .eq("role", "worker");
  if (error) return { error: error.message };
  revalidatePath("/admin/departments");
  revalidatePath("/admin/role-requests");
  return { ok: true };
}
