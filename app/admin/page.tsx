import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export default async function AdminDashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("college_id, colleges(name)")
    .eq("id", user!.id)
    .single();

  const collegeId = profile?.college_id;

  const [
    { count: pendingComplaints },
    { count: roleRequests },
    { count: totalLocations },
    { count: totalWorkers },
  ] = await Promise.all([
    supabase.from("complaints").select("id", { count: "exact", head: true }).eq("college_id", collegeId!).neq("status", "completed"),
    supabase.from("role_requests").select("id", { count: "exact", head: true }).eq("college_id", collegeId!).eq("status", "pending"),
    supabase.from("locations").select("id", { count: "exact", head: true }).eq("college_id", collegeId!).eq("archived", false),
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("college_id", collegeId!).eq("role", "worker"),
  ]);

  const cards = [
    { href: "/admin/queue", label: "Complaint Queue", sub: "Assign and verify", value: pendingComplaints ?? 0 },
    { href: "/admin/role-requests", label: "Role Requests", sub: "Worker & admin approvals", value: roleRequests ?? 0 },
    { href: "/admin/locations", label: "Locations & QR", sub: "Campus structure", value: totalLocations ?? 0 },
    { href: "/admin/analytics", label: "Analytics", sub: "Trends & performance", value: null },
    { href: "/admin/export", label: "Export", sub: "CSV data export", value: null },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <p className="text-sm text-neutral-500">{(profile?.colleges as any)?.name}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryCard label="Pending complaints" value={pendingComplaints ?? 0} tone="amber" />
        <SummaryCard label="Role requests" value={roleRequests ?? 0} tone="red" />
        <SummaryCard label="Locations" value={totalLocations ?? 0} tone="blue" />
        <SummaryCard label="Workers" value={totalWorkers ?? 0} tone="green" />
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {cards.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className="flex items-center justify-between rounded-lg border border-neutral-200 bg-white px-4 py-3 shadow-sm hover:border-neutral-300 hover:bg-neutral-50"
          >
            <div>
              <div className="font-medium text-neutral-900">{c.label}</div>
              <div className="text-xs text-neutral-500">{c.sub}</div>
            </div>
            {c.value !== null && (
              <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-semibold text-neutral-600">
                {c.value}
              </span>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "blue" | "green" | "amber" | "red";
}) {
  const toneMap = { blue: "text-blue-600", green: "text-green-600", amber: "text-amber-600", red: "text-red-600" };
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-3 shadow-sm">
      <div className={`text-2xl font-semibold ${toneMap[tone]}`}>{value}</div>
      <div className="text-xs text-neutral-500">{label}</div>
    </div>
  );
}
