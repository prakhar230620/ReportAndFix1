import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import StaffMessenger from "@/app/components/StaffMessenger";

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
      />
    </div>
  );
}
