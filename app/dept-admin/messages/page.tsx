import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import StaffMessenger from "@/app/components/StaffMessenger";

export default async function DeptAdminMessagesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, college_id, department_id, departments(name)")
    .eq("id", user.id)
    .single();

  if (
    !profile ||
    (profile.role !== "dept_admin" &&
      profile.role !== "college_admin" &&
      profile.role !== "super_admin")
  ) {
    redirect("/");
  }

  const deptName = (profile.departments as any)?.name ?? "Department";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-neutral-900">{deptName} Staff Messages</h1>
        <p className="text-sm text-neutral-500">
          Coordinate maintenance directly with Organisation Admin and your field workers.
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
