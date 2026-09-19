"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function setCollegeStatus(collegeId: string, status: "active" | "suspended") {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_college_status" as never, {
    p_college_id: collegeId,
    p_status: status,
  } as never);

  if (error) return { error: error.message };
  revalidatePath("/super-admin");
  return { ok: true };
}

const NODE_TYPE_HIERARCHY: Record<string, string[]> = {
  Campus: ["Building", "Ground", "Playground", "Sports Ground", "Park", "Parking", "Hostel", "Garden"],
  Building: ["Floor", "Basement", "Terrace", "Rooftop", "Lift", "Staircase", "Parking"],
  Floor: ["Room", "Lab", "Library", "Classroom", "Washroom", "Corridor", "Office", "Conference Room", "Meeting Room", "Reception", "Pantry", "Staircase", "Lift", "Store Room", "Server Room", "Medical Room", "Common Room", "Gallery"],
  Ground: ["Playground", "Garden", "Park", "Parking", "Bench", "Sitting Area", "Water Fountain"],
  Playground: ["Bench", "Sitting Area", "Water Fountain"],
  "Sports Ground": ["Bench", "Sitting Area", "Water Fountain", "Store Room"],
  Park: ["Bench", "Sitting Area", "Water Fountain", "Garden"],
  Garden: ["Bench", "Sitting Area", "Water Fountain"],
  Hostel: ["Floor", "Common Room", "Washroom", "Warehouse", "Canteen"],
  Basement: ["Parking", "Store Room"],
  Rooftop: ["Garden", "Sitting Area", "Terrace"],
  Terrace: ["Garden", "Sitting Area"],
};

const DEFAULT_NODE_TYPES = [
  "Campus", "Building", "Ground", "Playground", "Sports Ground", "Park", "Parking",
  "Floor", "Basement", "Terrace", "Rooftop",
  "Classroom", "Lab", "Library", "Auditorium", "Seminar Hall", "Hall", "Gallery",
  "Conference Room", "Meeting Room", "Office", "Reception", "Lobby",
  "Washroom", "Corridor", "Staircase", "Lift", "Pantry",
  "Canteen", "Cafeteria", "Hostel", "Common Room", "Bench", "Sitting Area", "Water Fountain",
  "Medical Room", "Gym", "Garden", "Store Room", "Server Room",
  "Security Room", "Waiting Area", "Workshop", "Warehouse", "Room",
];

export async function createCollege(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const category = String(formData.get("category") ?? "college");

  if (!name) return { error: "Name is required" };

  const supabase = await createClient();
  const { data: college, error } = await supabase
    .from("colleges")
    .insert({ name, category })
    .select("id")
    .single();

  if (error) return { error: error.message };

  await supabase.from("node_types").insert(
    DEFAULT_NODE_TYPES.map((n) => ({
      college_id: college.id,
      name: n,
      typical_children: NODE_TYPE_HIERARCHY[n] ?? [],
    }))
  );

  revalidatePath("/super-admin");
  return { ok: true };
}
