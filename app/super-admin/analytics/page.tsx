import { createClient } from "@/lib/supabase/server";
import AnalyticsDashboardClient, {
  OrgAnalytics,
  GlobalStorageStats,
  OrgTableBreakdown,
} from "./AnalyticsDashboardClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export default async function SuperAdminAnalyticsPage() {
  const supabase = await createClient();

  const [{ data: colleges, error: collegesError }, { data: storageRaw, error: storageError }] =
    await Promise.all([
      supabase.from("colleges").select("id, name, subscription_status, category, logo_url").order("name"),
      supabase.rpc("get_storage_usage" as never),
    ]);

  if (collegesError) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Couldn&apos;t load organisations: {collegesError.message}
      </div>
    );
  }

  const activeColleges = (colleges ?? []).filter(
    (c) => !c.subscription_status?.startsWith("pending_deletion")
  );

  const storage = (storageRaw ?? {
    db_size_bytes: 0,
    storage_used_bytes: 0,
    storage_object_count: 0,
    by_college: [],
  }) as {
    db_size_bytes: number;
    storage_used_bytes: number;
    storage_object_count: number;
    by_college: { college_id: string; college_name: string; bytes: number; object_count: number }[];
  };

  const storageByCollegeMap = new Map(
    (storage.by_college ?? []).map((s) => [s.college_id, { bytes: s.bytes, object_count: s.object_count }])
  );

  // Fetch detailed live metrics for each organisation in parallel
  const orgDetails = await Promise.all(
    activeColleges.map(async (c) => {
      const [
        { data: collegeAnalytics },
        { data: complaintsList },
        { data: profilesList },
        { count: locationsCount },
        { count: categoriesCount },
      ] = await Promise.all([
        supabase.rpc("get_college_analytics" as never, { p_college_id: c.id } as never),
        supabase.from("complaints").select("id, status, resolution_seconds").eq("college_id", c.id),
        supabase.from("profiles").select("id, role").eq("college_id", c.id),
        supabase.from("locations").select("id", { count: "exact", head: true }).eq("college_id", c.id),
        supabase.from("categories").select("id", { count: "exact", head: true }).eq("college_id", c.id),
      ]);

      const analytics = (collegeAnalytics ?? {}) as {
        total?: number;
        completed?: number;
        avg_resolution_seconds?: number | null;
        by_category?: { name: string; count: number }[];
        by_worker?: { display_name: string; count: number; avg_resolution_seconds?: number }[];
        by_location?: { name: string; count: number }[];
        trend?: { day: string; count: number }[];
      };

      const storageItem = storageByCollegeMap.get(c.id) ?? { bytes: 0, object_count: 0 };
      const complaints = complaintsList ?? [];
      const profiles = profilesList ?? [];

      const submitted = complaints.filter((x) => x.status === "submitted").length;
      const assigned = complaints.filter((x) => x.status === "assigned").length;
      const processing = complaints.filter((x) => x.status === "processing").length;
      const completed = complaints.filter((x) => x.status === "completed").length;
      const reopened = complaints.filter((x) => x.status === "reopened").length;

      const usersCount = profiles.filter((x) => x.role === "user").length;
      const workersCount = profiles.filter((x) => x.role === "worker").length;
      const deptAdminsCount = profiles.filter((x) => x.role === "dept_admin").length;
      const adminsCount = profiles.filter((x) => x.role === "college_admin").length;

      // Estimate DB rows for this tenant (per table)
      const complaintsCount = complaints.length;
      const profilesCount = profiles.length;
      const locCount = locationsCount ?? 0;
      const catCount = categoriesCount ?? 0;
      const mediaCount = storageItem.object_count; // files as "media" records

      const dbRecords = complaintsCount + profilesCount + locCount + catCount;

      const table_breakdown: OrgTableBreakdown[] = [
        { table: "Complaints",  icon: "📋", records: complaintsCount },
        { table: "Members",     icon: "👥", records: usersCount },
        { table: "Workers",     icon: "🛠️", records: workersCount },
        { table: "Dept Admins", icon: "🏢", records: deptAdminsCount },
        { table: "Org Admins",  icon: "🔑", records: adminsCount },
        { table: "Locations",   icon: "📍", records: locCount },
        { table: "Categories",  icon: "🏷️", records: catCount },
        { table: "Media Files", icon: "🖼️", records: mediaCount, isFile: true },
      ];

      return {
        id: c.id,
        name: c.name,
        category: c.category ?? "college",
        status: c.subscription_status ?? "active",
        logo_url: c.logo_url,
        file_bytes: storageItem.bytes,
        file_count: storageItem.object_count,
        db_records: dbRecords,
        table_breakdown,
        total_issues: complaints.length,
        submitted_issues: submitted,
        assigned_issues: assigned,
        processing_issues: processing,
        completed_issues: completed,
        reopened_issues: reopened,
        completion_rate: complaints.length > 0 ? Math.round((completed / complaints.length) * 100) : 0,
        avg_resolution_seconds: analytics.avg_resolution_seconds ?? null,
        users_count: usersCount,
        workers_count: workersCount,
        dept_admins_count: deptAdminsCount,
        admins_count: adminsCount,
        locations_count: locationsCount ?? 0,
        categories_count: categoriesCount ?? 0,
        by_category: analytics.by_category ?? [],
        by_worker: analytics.by_worker ?? [],
        by_location: analytics.by_location ?? [],
        trend: analytics.trend ?? [],
      };
    })
  );

  // Compute platform-wide totals for percentages and DB byte distribution
  const totalPlatformDbRecords = orgDetails.reduce((acc, o) => acc + o.db_records, 0);
  const totalFileBytes = Math.max(1, storage.storage_used_bytes);

  const organizations: OrgAnalytics[] = orgDetails.map((org) => {
    const file_pct = Math.round((org.file_bytes / totalFileBytes) * 100);
    const db_pct = totalPlatformDbRecords > 0 ? Math.round((org.db_records / totalPlatformDbRecords) * 100) : 0;
    const db_bytes_estimated = totalPlatformDbRecords > 0
      ? Math.round(storage.db_size_bytes * (org.db_records / totalPlatformDbRecords))
      : 0;

    return {
      ...org,
      file_pct,
      db_pct,
      db_bytes_estimated,
      total_storage_bytes: org.file_bytes + db_bytes_estimated,
    };
  });

  const storageStats: GlobalStorageStats = {
    db_size_bytes: storage.db_size_bytes,
    storage_used_bytes: storage.storage_used_bytes,
    storage_object_count: storage.storage_object_count,
  };

  return <AnalyticsDashboardClient organizations={organizations} storageStats={storageStats} />;
}
