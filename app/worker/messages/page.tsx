import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import StaffMessenger from "@/app/components/StaffMessenger";
import { Lock } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function WorkerMessagesPage() {
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

  if (!profile || profile.role !== "worker") {
    redirect("/");
  }

  // Server-side check for messaging plan feature
  let messagingEnabled = false;
  if (profile.college_id) {
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
          <h1 className="text-xl font-bold text-neutral-900">Worker Field Chat</h1>
          <p className="text-sm text-neutral-500">
            Coordinate task updates and notify Department Admins in real-time.
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
            Internal operations messaging is locked for your organisation. Contact your Organisation Admin to upgrade the subscription plan.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-neutral-900">Worker Field Chat</h1>
        <p className="text-sm text-neutral-500">
          Coordinate task updates and notify Department Admins in real-time.
        </p>
      </div>

      <StaffMessenger
        collegeId={profile.college_id ?? ""}
        userRole={profile.role}
        userId={user.id}
        initialLocked={!messagingEnabled}
      />
    </div>
  );
}
