import { createClient } from "@/lib/supabase/server";
import ExportClient from "./ExportClient";

export default async function SuperAdminExportPage() {
  const supabase = await createClient();
  const { data: colleges } = await supabase.from("colleges").select("id, name").order("name");
  return <ExportClient colleges={colleges ?? []} />;
}
