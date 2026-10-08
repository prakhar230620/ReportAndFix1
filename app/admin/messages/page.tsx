import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import StaffMessenger from "@/app/components/StaffMessenger";
import Link from "next/link";
import { Lock, Sparkles } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminMessagesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, college_id")
    .eq("id", user.id)
    .single();

  if (!profile || (profile.role !== "college_admin" && profile.role !== "super_admin")) {
    redirect("/");
  }

  // Server-side check for messaging plan feature: prevents 1-2 second client flash
  let messagingEnabled = false;
  if (profile.role === "super_admin") {
    messagingEnabled = true;
  } else if (profile.college_id) {
    const adminClient = createAdminClient();
    const { data: sub } = await adminClient
      .from("org_subscriptions")
      .select("status, plans(messaging_enabled)")
      .eq("college_id", profile.college_id)
      .maybeSingle();

    messagingEnabled = (sub?.plans as any)?.messaging_enabled === true;
  }

  if (!messagingEnabled) {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-xl font-bold text-neutral-900">Staff In-App Messages</h1>
          <p className="text-sm text-neutral-500">
            Coordinate maintenance directly with Department Admins and Field Workers.
          </p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-8 text-center shadow-xs">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-600 mb-4">
            <Lock className="h-6 w-6" />
          </div>
          <h3 className="text-lg font-bold text-neutral-900">
            Staff In-App Messaging Locked
          </h3>
          <p className="mt-2 text-sm text-neutral-600 max-w-md mx-auto">
            Internal operations messaging with auto-purging 24h retention, complaint tagging, and worker notifications is available on <strong>Professional</strong> and <strong>Enterprise</strong> plans.
          </p>
          <div className="mt-5">
            <Link
              href="/admin/billing"
              className="inline-flex items-center gap-1.5 rounded-xl bg-amber-600 px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-amber-700 transition"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Upgrade Plan in Billing →</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-neutral-900">Staff In-App Messages</h1>
        <p className="text-sm text-neutral-500">
          Coordinate maintenance directly with Department Admins and Field Workers.
        </p>
      </div>

      <StaffMessenger
        collegeId={profile.college_id ?? ""}
        userRole={profile.role}
        userId={user.id}
      />
    </div>
  );
}
