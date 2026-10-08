import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import NavBar from "@/app/components/NavBar";

export default async function WorkerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, college_id, colleges(name, logo_url, is_frozen, contact_email, subscription_status)")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "worker") {
    redirect("/");
  }

  const collegeData = profile.colleges as any;
  const isFrozen =
    collegeData?.is_frozen === true ||
    ["expired", "frozen", "suspended", "cancelled"].includes(collegeData?.subscription_status ?? "");
  if (isFrozen) {
    // Fetch admins of this org for contact reference
    const { data: admins } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("college_id", profile.college_id!)
      .eq("role", "college_admin")
      .limit(3);

    const contactEmail = collegeData?.contact_email;

    return (
      <div className="min-h-screen bg-neutral-50">
        <NavBar
          brand="My Tasks"
          logoUrl={collegeData?.logo_url}
          items={[{ href: "/", label: "Home" }]}
        />
        <main className="mx-auto max-w-xl px-4 py-16 text-center">
          <div className="rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm">
            <div className="mb-4 text-4xl">⚠️</div>
            <h1 className="text-xl font-bold text-neutral-900">Service Temporarily Unavailable</h1>
            <p className="mt-2 text-sm text-neutral-600">
              There was some technical issue. Please connect to your Organisational Admin or Departmental Admin.
            </p>
            {((admins && admins.length > 0) || contactEmail) && (
              <div className="mt-6 rounded-xl bg-neutral-50 p-4 border border-neutral-100 text-left">
                <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-2">
                  Contact Administrators
                </p>
                <div className="space-y-2">
                  {admins?.map((adm, idx) => (
                    <div key={idx} className="flex justify-between items-center text-xs">
                      <span className="font-medium text-neutral-800">{adm.display_name || "Admin"}</span>
                    </div>
                  ))}
                  {contactEmail && (
                    <div className="flex justify-between items-center text-xs pt-1 border-t border-neutral-200">
                      <span className="text-neutral-500">Official Contact:</span>
                      <a href={`mailto:${contactEmail}`} className="text-blue-600 hover:underline">
                        {contactEmail}
                      </a>
                    </div>
                  )}
                </div>
              </div>
            )}
            <div className="mt-6">
              <a
                href="/"
                className="inline-flex items-center justify-center rounded-xl bg-neutral-900 px-5 py-2 text-sm font-semibold text-white hover:bg-neutral-800 transition"
              >
                Back to Home
              </a>
            </div>
          </div>
        </main>
      </div>
    );
  }


  return (
    <div className="min-h-screen bg-neutral-50">
      <NavBar
        brand="My Tasks"
        logoUrl={(profile.colleges as any)?.logo_url}
        notify={{ role: "worker", userId: user.id, collegeId: profile.college_id }}
        items={[
          { href: "/worker", label: "Tasks" },
          { href: "/worker/messages", label: "Messages" },
          { href: "/", label: "Home" },
        ]}
      />
      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
