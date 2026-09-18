import { createClient } from "@/lib/supabase/server";
import AnalyticsCharts from "./AnalyticsCharts";

export const maxDuration = 30;

export default async function AnalyticsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("college_id")
    .eq("id", user!.id)
    .single();

  const { data, error } = await supabase.rpc("get_college_analytics" as never, {
    p_college_id: profile?.college_id,
  } as never);

  if (error || !data) {
    return <p className="text-sm text-red-600">Failed to load analytics: {error?.message}</p>;
  }

  return <AnalyticsCharts data={data as any} />;
}
