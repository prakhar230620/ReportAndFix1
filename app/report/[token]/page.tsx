import { createClient } from "@/lib/supabase/server";
import ReportForm from "./ReportForm";
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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: fullPath } = await supabase.rpc("location_full_path" as never, {
    p_location_id: location.id,
  } as never);
  const locationSummary = (fullPath as unknown as string) ?? location.name;

  if (!user) {
    const next = `/report/${token}`;
    return (
      <main className="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center gap-4 px-6 text-center">
        <BackButton className="self-start" />
        <h1 className="text-xl font-semibold">{location.name}</h1>
        {locationSummary && <p className="text-neutral-600">{locationSummary}</p>}
        <p className="text-neutral-600">Log in to report an issue at this location.</p>
        <div className="flex gap-3">
          <a
            href={`/login?next=${encodeURIComponent(next)}`}
            className="rounded-md bg-neutral-900 px-4 py-2 text-white"
          >
            Log in
          </a>
          <a
            href={`/signup?next=${encodeURIComponent(next)}`}
            className="rounded-md border border-neutral-300 px-4 py-2"
          >
            Sign up
          </a>
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
