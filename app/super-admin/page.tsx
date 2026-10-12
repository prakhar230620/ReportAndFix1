import { createClient } from "@/lib/supabase/server";
import { purgeExpiredColleges } from "./actions";
import SuperAdminDashboard from "./SuperAdminDashboard";
import { Organization } from "./CollegeRow";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function SuperAdminPage() {
  const supabase = await createClient();

  // Run auto-purge for any soft-deleted colleges past the 30-day window
  await purgeExpiredColleges();

  const [{ data: overviewData, error: overviewErr }, { data: collegesList, error: collegesErr }] =
    await Promise.all([
      supabase.rpc("get_platform_overview" as never, {} as never),
      supabase.from("colleges").select("*").order("created_at", { ascending: false }),
    ]);

  if (overviewErr || !overviewData) {
    return <p className="text-sm text-red-600">Failed to load platform overview: {overviewErr?.message}</p>;
  }

  const overview = overviewData as {
    colleges: {
      id: string;
      name: string;
      subscription_status: string;
      logo_url: string | null;
      user_count: number;
      worker_count: number;
      issue_count: number;
    }[];
    total_users: number;
    total_workers: number;
    total_issues: number;
  };

  // Map counts from get_platform_overview by id
  const countsMap = new Map(
    (overview.colleges ?? []).map((c) => [
      c.id,
      { user_count: c.user_count, worker_count: c.worker_count, issue_count: c.issue_count },
    ])
  );

  // Combine full metadata from colleges table with live counts
  const organizations: Organization[] = (collegesList ?? []).map((col) => {
    const counts = countsMap.get(col.id) ?? { user_count: 0, worker_count: 0, issue_count: 0 };

    let effectiveStatus = col.subscription_status ?? "active";
    if (effectiveStatus.startsWith("pending_deletion")) {
      // keep pending_deletion with timestamp
    } else if (col.is_frozen || effectiveStatus === "frozen") {
      effectiveStatus = "suspended";
    }

    return {
      id: col.id,
      name: col.name,
      category: col.category,
      subscription_status: effectiveStatus,
      is_frozen: col.is_frozen ?? false,
      subscription_plan: col.subscription_plan ?? null,
      camera_mode: col.camera_mode ?? "both",
      logo_url: col.logo_url,
      address: col.address,
      contact_email: col.contact_email,
      contact_phone: col.contact_phone,
      allow_worker_signup: col.allow_worker_signup,
      allow_admin_signup: col.allow_admin_signup,
      user_count: counts.user_count,
      worker_count: counts.worker_count,
      issue_count: counts.issue_count,
      created_at: col.created_at,
    };
  });

  return (
    <SuperAdminDashboard
      organizations={organizations}
      totalUsers={overview.total_users ?? 0}
      totalWorkers={overview.total_workers ?? 0}
      totalIssues={overview.total_issues ?? 0}
    />
  );
}
