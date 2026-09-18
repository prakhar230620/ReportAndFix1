"use server";

import { createClient } from "@/lib/supabase/server";

export type DuplicateCandidate = {
  id: string;
  public_id: string;
  title: string;
  description: string | null;
  status: string;
  created_at: string;
  similarity: number;
  vote_count: number;
};

export async function checkDuplicates(
  token: string,
  categoryId: string,
  title: string,
  description: string
) {
  const supabase = await createClient();

  const { data: location, error: locError } = await supabase
    .from("locations")
    .select("id, active")
    .eq("qr_token", token)
    .maybeSingle();

  if (locError || !location || !location.active) {
    return { error: "This location is not available for reporting." };
  }

  const queryText = `${title} ${description}`.trim();

  const { data, error } = await supabase.rpc(
    "find_similar_open_complaints" as never,
    {
      p_location_id: location.id,
      p_category_id: categoryId,
      p_query: queryText,
    } as never
  );

  if (error) return { error: error.message };
  return { candidates: (data ?? []) as DuplicateCandidate[] };
}

export async function leaveComplaint(complaintId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("complaint_votes")
    .delete()
    .eq("complaint_id", complaintId)
    .eq("user_id", user.id);

  if (error) return { error: error.message };

  const { count } = await supabase
    .from("complaint_votes")
    .select("id", { count: "exact", head: true })
    .eq("complaint_id", complaintId);

  return { voteCount: count ?? null };
}

export async function joinComplaint(complaintId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("complaint_votes")
    .insert({ complaint_id: complaintId, user_id: user.id });

  if (error) {
    if (error.code === "23505") {
      return { error: "You've already joined this complaint." };
    }
    return { error: error.message };
  }

  const { count } = await supabase
    .from("complaint_votes")
    .select("id", { count: "exact", head: true })
    .eq("complaint_id", complaintId);

  return { voteCount: count ?? null };
}

export async function createComplaint(params: {
  token: string;
  categoryId: string;
  title: string;
  description: string;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: location, error: locError } = await supabase
    .from("locations")
    .select("id, college_id, active")
    .eq("qr_token", params.token)
    .maybeSingle();

  if (locError || !location || !location.active) {
    return { error: "This location is not available for reporting." };
  }

  if (!params.title.trim()) return { error: "Title is required." };
  if (!params.categoryId) return { error: "Category is required." };

  const { data: complaint, error } = await supabase
    .from("complaints")
    .insert({
      college_id: location.college_id,
      location_id: location.id,
      category_id: params.categoryId,
      title: params.title.trim(),
      description: params.description.trim() || null,
      is_anonymous: true,
      reporter_id: null,
    })
    .select("id, public_id, college_id")
    .single();

  if (error) return { error: error.message };
  return { complaint };
}
