import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ExportClient from "./ExportClient";

export default async function ExportPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user!.id)
    .single();
  if (profile?.role === "super_admin") redirect("/super-admin");

  return <ExportClient />;
}
