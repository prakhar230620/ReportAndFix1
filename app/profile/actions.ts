"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function updateDisplayName(name: string) {
  if (!name.trim()) return { error: "Name can't be empty." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("profiles")
    .update({ display_name: name.trim() })
    .eq("id", user.id);

  if (error) return { error: error.message };
  revalidatePath("/profile");
  return { ok: true };
}
