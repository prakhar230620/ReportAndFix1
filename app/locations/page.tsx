import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import QRScanButton from "./QRScanButton";

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
    .select("id, name, location_code, qr_token, buildings(name), floors(label)")
    .eq("college_id", profile?.college_id)
    .eq("active", true)
    .order("name");

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col gap-4 px-6 py-10">
      <h1 className="text-xl font-semibold">Report an issue</h1>
      <p className="text-sm text-neutral-600">
        Scan the QR code at the location, or pick it from the list below.
      </p>

      <QRScanButton />

      <div className="my-1 flex items-center gap-3 text-xs text-neutral-400">
        <div className="h-px flex-1 bg-neutral-200" />
        OR PICK MANUALLY
        <div className="h-px flex-1 bg-neutral-200" />
      </div>

      <div className="flex flex-col gap-2">
        {(locations ?? []).map((loc) => {
          const buildingName = (loc as any).buildings?.name;
          const floorLabel = (loc as any).floors?.label;
          return (
            <a
              key={loc.id}
              href={`/report/${loc.qr_token}`}
              className="rounded-md border border-neutral-300 px-3 py-2 text-sm hover:bg-neutral-50"
            >
              <div className="font-medium">{loc.name}</div>
              <div className="text-neutral-500">
                {[buildingName, floorLabel].filter(Boolean).join(" · ")}
                {loc.location_code ? ` · ${loc.location_code}` : ""}
              </div>
            </a>
          );
        })}
        {(locations ?? []).length === 0 && (
          <p className="text-neutral-500">
            No locations have been set up for your college yet.
          </p>
        )}
      </div>
    </main>
  );
}
