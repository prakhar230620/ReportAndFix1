import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { cached } from "@/lib/cache";

import AnalyticsCharts from "./AnalyticsCharts";

export const maxDuration = 30;

export default async function AnalyticsPage() {
  const supabase = await createClient();

  const { data: gProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", (await supabase.auth.getUser()).data.user!.id)
    .single();
  if (gProfile?.role === "super_admin") redirect("/super-admin");

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("college_id")
    .eq("id", user!.id)
    .single();

  let data: any = null;
  let error: { message: string } | null = null;
  try {
    data = await cached(`analytics:college:${profile?.college_id}`, 60, async () => {
      const res = await supabase.rpc("get_college_analytics" as never, {
        p_college_id: profile?.college_id,
      } as never);
      if (res.error) throw res.error;
      return res.data;
    });
  } catch (e) {
    error = e as { message: string };
  }

  if (error || !data) {
    return <p className="text-sm text-red-600">Failed to load analytics: {error?.message}</p>;
  }

  return <AnalyticsCharts data={data as any} />;
}
