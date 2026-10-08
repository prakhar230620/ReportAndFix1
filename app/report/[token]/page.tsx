import { createClient } from "@/lib/supabase/server";
import ReportForm from "./ReportForm";
import Link from "next/link";
import BackButton from "@/app/components/BackButton";

export default async function ReportQrPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = await createClient();

  const { data: location } = await supabase
    .from("locations")
    .select("id, name, location_code, active, college_id")
    .eq("qr_token", token)
    .maybeSingle();

  if (!location) {
    return (
      <main className="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center gap-2 px-6 text-center">
        <BackButton className="self-start" />
        <h1 className="text-xl font-semibold">QR code not recognized</h1>
        <p className="text-neutral-600">
          This QR code doesn&apos;t match any location in our system.
        </p>
      </main>
    );
  }

  if (!location.active) {
    return (
      <main className="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center gap-2 px-6 text-center">
        <BackButton className="self-start" />
        <h1 className="text-xl font-semibold">This QR is no longer active</h1>
        <p className="text-neutral-600">
          Please contact your organisation admin if you believe this is a mistake.
        </p>
      </main>
    );
  }

  // Check if organisation is frozen
  const { data: college } = await supabase
    .from("colleges")
    .select("id, name, is_frozen, contact_email")
    .eq("id", location.college_id)
    .single();

  if (college?.is_frozen) {
    const { data: admins } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("college_id", location.college_id)
      .eq("role", "college_admin")
      .limit(3);

    return (
      <main className="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center gap-4 px-6 text-center">
        <BackButton className="self-start" />
        <div className="text-4xl">⚠️</div>
        <h1 className="text-xl font-bold text-neutral-900">Service Temporarily Unavailable</h1>
        <p className="text-sm text-neutral-600">
          There was some technical issue. Please connect to your Organisational Admin or Departmental Admin.
        </p>
        {((admins && admins.length > 0) || college?.contact_email) && (
          <div className="w-full mt-4 rounded-xl bg-neutral-50 p-4 border border-neutral-100 text-left">
            <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-2">
              Contact Administration
            </p>
            <div className="space-y-2">
              {admins?.map((adm, idx) => (
                <div key={idx} className="flex justify-between items-center text-xs">
                  <span className="font-medium text-neutral-800">{adm.display_name || "Admin"}</span>
                </div>
              ))}
              {college?.contact_email && (
                <div className="flex justify-between items-center text-xs pt-1 border-t border-neutral-200">
                  <span className="text-neutral-500">Official Contact:</span>
                  <a href={`mailto:${college.contact_email}`} className="text-blue-600 hover:underline">
                    {college.contact_email}
                  </a>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    );
  }


  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: fullPath } = await supabase.rpc("location_full_path" as never, {
    p_location_id: location.id,
  } as never);
  const locationSummary = (fullPath as unknown as string) ?? location.name;

  if (!user) {
    const next = `/report/${token}`;
    const { data: joinRow } = await supabase
      .from("org_join_codes")
      .select("code")
      .eq("college_id", location.college_id)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const signupQuery = new URLSearchParams({
      next,
      org: location.college_id,
      ...(joinRow?.code ? { join_code: joinRow.code, code: joinRow.code } : {}),
    }).toString();

    return (
      <main className="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center gap-4 px-6 text-center">
        <BackButton className="self-start" />
        <h1 className="text-xl font-semibold">{location.name}</h1>
        {locationSummary && <p className="text-neutral-600">{locationSummary}</p>}
        <p className="text-neutral-600">Log in to report an issue at this location.</p>
        <div className="flex gap-3">
          <Link
            href={`/login?next=${encodeURIComponent(next)}`}
            className="rounded-md bg-neutral-900 px-4 py-2 text-white"
          >
            Log in
          </Link>
          <Link
            href={`/signup?${signupQuery}`}
            className="rounded-md border border-neutral-300 px-4 py-2"
          >
            Sign up
          </Link>
        </div>
      </main>
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("college_id")
    .eq("id", user.id)
    .single();

  if (profile?.college_id !== location.college_id) {
    return (
      <main className="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center gap-2 px-6 text-center">
        <BackButton className="self-start" />
        <h1 className="text-xl font-semibold">Wrong organisation account</h1>
        <p className="text-neutral-600">
          Your account belongs to a different organisation than this location. Log in with
          the account you used to sign up for this organisation.
        </p>
      </main>
    );
  }

  const { data: categories } = await supabase
    .from("categories")
    .select("id, name")
    .eq("college_id", location.college_id)
    .order("name");

  return (
    <ReportForm
      token={token}
      locationName={location.name}
      locationSummary={locationSummary}
      categories={categories ?? []}
    />
  );
}
