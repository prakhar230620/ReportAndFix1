import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import DepartmentsClient from "./DepartmentsClient";

export default async function DepartmentsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, college_id")
    .eq("id", user!.id)
    .single();
  if (profile?.role === "super_admin") redirect("/super-admin");

  const collegeId = profile?.college_id;

  const [{ data: departments }, { data: workers }] = await Promise.all([
    supabase
      .from("departments")
      .select("id, name, suspended, created_at")
      .eq("college_id", collegeId!)
      .order("name"),
    supabase
      .from("profiles")
      .select("id, display_name, department_id")
      .eq("college_id", collegeId!)
      .eq("role", "worker")
      .order("display_name"),
  ]);

  return <DepartmentsClient departments={departments ?? []} workers={workers ?? []} />;
}
