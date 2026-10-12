import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { AlertTriangle, Download, CheckCircle2, Clock, Trash2 } from "lucide-react";
import DataDeletionForm from "@/app/admin/data-deletion/DataDeletionForm";
import DownloadPaymentSection from "@/app/admin/data-deletion/DownloadPaymentSection";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function DataDeletionPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const adminClient = createAdminClient();
  const { data: profile } = await adminClient
    .from("profiles")
    .select("role, college_id, display_name, colleges(name)")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "college_admin") redirect("/");

  const collegeId = profile.college_id!;

  const [
    { data: completedComplaints },
    { data: orgAdmins },
    { data: activeDeletionRequest },
    { data: subscription },
  ] = await Promise.all([
    // Only completed, non-deleted complaints
    adminClient
      .from("complaints")
      .select("id, public_id, title, created_at, completed_at, categories(name)")
      .eq("college_id", collegeId)
      .eq("status", "completed")
      .is("deleted_at", null)
      .order("completed_at", { ascending: false }),

    // All org admins (for multi-admin approval count)
    adminClient
      .from("profiles")
      .select("id, display_name")
      .eq("college_id", collegeId)
      .eq("role", "college_admin"),

    // Any pending deletion request
    adminClient
      .from("data_deletion_requests")
      .select("*")
      .eq("college_id", collegeId)
      .not("status", "in", '("completed","cancelled")')
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),

    adminClient
      .from("org_subscriptions")
      .select("*, plans(data_download_free, slug)")
      .eq("college_id", collegeId)
      .maybeSingle(),
  ]);

  const downloadFree = (subscription?.plans as any)?.data_download_free === true;
  const downloadChargePaise = downloadFree ? 0 : ((subscription?.plans as any)?.slug === "standard" ? 29900 : 49900);

  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      <div>
        <h1 className="text-xl font-bold text-neutral-900">Data Deletion</h1>
        <p className="text-sm text-neutral-500">
          Permanently delete completed complaints. This action is irreversible.
        </p>
      </div>

      {/* Important warnings */}
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold text-amber-900 text-sm">Before you proceed — read carefully</p>
            <ul className="mt-2 space-y-1 text-sm text-amber-800 list-disc list-inside">
              <li>Only <strong>completed complaints</strong> can be deleted</li>
              <li>Data download is <strong>mandatory before deletion</strong></li>
              {(orgAdmins?.length ?? 0) > 1 && (
                <li>All <strong>{orgAdmins?.length} organisation admins</strong> must approve this request</li>
              )}
              <li>Deleted files are removed <strong>instantly and permanently</strong> — no recovery</li>
              {!downloadFree && (
                <li>Download charge: <strong>₹{downloadChargePaise / 100}</strong> (waived on Professional/Enterprise plans)</li>
              )}
              <li>You will receive a <strong>PDF list</strong> of all deleted complaint IDs</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Active deletion request status */}
      {activeDeletionRequest && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-5">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="h-5 w-5 text-blue-600" />
            <h2 className="font-semibold text-blue-900">Deletion Request In Progress</h2>
          </div>
          <div className="text-sm text-blue-800 space-y-1">
            <p>Status: <strong className="capitalize">{activeDeletionRequest.status.replace(/_/g, " ")}</strong></p>
            <p>Selected complaints: <strong>{activeDeletionRequest.complaint_count}</strong></p>
            <p>Approvals: <strong>{Object.keys(activeDeletionRequest.approvals_received).length}</strong> of <strong>{activeDeletionRequest.approvals_required}</strong></p>
          </div>
          {activeDeletionRequest.status === "pending_approvals" &&
           !activeDeletionRequest.approvals_received[user.id] && (
            <form action="/admin/data-deletion/approve" method="POST" className="mt-3">
              <input type="hidden" name="requestId" value={activeDeletionRequest.id} />
              <button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
                Approve This Request
              </button>
            </form>
          )}

          {(activeDeletionRequest.status === "download_ready" || activeDeletionRequest.status === "pending_download") && (
            <DownloadPaymentSection
              requestId={activeDeletionRequest.id}
              collegeId={collegeId}
              complaintCount={activeDeletionRequest.complaint_count}
              downloadFree={downloadFree}
              downloadChargePaise={downloadChargePaise}
              isPaid={activeDeletionRequest.charge_paid === true || !!activeDeletionRequest.charge_payment_id}
              paymentId={activeDeletionRequest.charge_payment_id}
              userEmail={user.email}
            />
          )}
        </div>

      )}

      {/* Complaint selection form — only if no active request */}
      {!activeDeletionRequest && (
        <DataDeletionForm
          complaints={(completedComplaints as any) ?? []}
          collegeId={collegeId}

          userId={user.id}
          orgAdminCount={orgAdmins?.length ?? 1}
          downloadChargePaise={downloadChargePaise}
          downloadFree={downloadFree}
        />
      )}
    </div>
  );
}
