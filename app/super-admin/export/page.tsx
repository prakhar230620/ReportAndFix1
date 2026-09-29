import { createClient } from "@/lib/supabase/server";
import ExportPageClient from "./ExportClient";

export default async function SuperAdminExportPage() {
  const supabase = await createClient();
  const { data: colleges } = await supabase
    .from("colleges")
    .select("id, name, subscription_status")
    .order("name");

  const activeColleges = (colleges ?? []).filter(
    (c) => !c.subscription_status?.startsWith("pending_deletion")
  );

  return <ExportPageClient colleges={activeColleges} />;
}
