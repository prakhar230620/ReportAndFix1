import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import BackButton from "@/app/components/BackButton";
import LocationPickerClient, { type LocationItem } from "./LocationPickerClient";

export default async function LocationsPickerPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?next=/locations");

  const { data: profile } = await supabase
    .from("profiles")
    .select("college_id")
    .eq("id", user.id)
    .single();

  const { data: locations } = await supabase
    .from("locations")
    .select("id, name, location_code, qr_token")
    .eq("college_id", profile?.college_id)
    .eq("active", true)
    .eq("archived", false)
    .not("qr_token", "is", null)
    .order("name");

  const withPaths: LocationItem[] = await Promise.all(
    (locations ?? []).map(async (loc) => {
      const { data: path } = await supabase.rpc("location_full_path" as never, {
        p_location_id: loc.id,
      } as never);
      return {
        ...loc,
        path: (path as unknown as string) ?? loc.name,
      };
    })
  );

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-4 px-4 py-8 sm:px-6">
      <BackButton />
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Report an issue</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Scan the QR code at the location, or search and pick it from the list below.
        </p>
      </div>

      <LocationPickerClient locations={withPaths} />
    </main>
  );
}
