import { createClient } from "@/lib/supabase/server";
import QrSheetClient from "./QrSheetClient";

export default async function QrSheetPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("college_id")
    .eq("id", user!.id)
    .single();

  const collegeId = profile?.college_id;

  const { data: locations } = await supabase
    .from("locations")
    .select("id, parent_id, name, location_code, qr_token, archived")
    .eq("college_id", collegeId!)
    .order("name");

  const all = locations ?? [];
  const byId = new Map(all.map((l) => [l.id, l]));
  function pathOf(id: string): string {
    const parts: string[] = [];
    let cur = byId.get(id);
    while (cur) {
      parts.unshift(cur.name);
      cur = cur.parent_id ? byId.get(cur.parent_id) : undefined;
    }
    return parts.join(" / ");
  }

  const childCount = new Map<string, number>();
  for (const l of all) {
    if (l.parent_id) childCount.set(l.parent_id, (childCount.get(l.parent_id) ?? 0) + 1);
  }

  const eligible = all
    .filter((l) => !l.archived && !l.qr_token && (childCount.get(l.id) ?? 0) === 0)
    .map((l) => ({ id: l.id, name: l.name, path: pathOf(l.id) }));

  const withQr = all
    .filter((l) => !l.archived && l.qr_token)
    .map((l) => ({
      id: l.id,
      name: l.name,
      path: pathOf(l.id),
      qr_token: l.qr_token as string,
      location_code: l.location_code,
    }));

  return <QrSheetClient eligible={eligible} withQr={withQr} />;
}
