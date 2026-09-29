"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

const DEFAULT_CATEGORIES = [
  "Electrical",
  "Plumbing",
  "Furniture",
  "HVAC / Air Conditioning",
  "Cleaning & Housekeeping",
  "IT & Network",
  "Internet / WiFi",
  "Security",
  "Fire Safety",
  "Elevator / Lift",
  "Water Supply",
  "Waste Management",
  "Pest Control",
  "Signage",
  "Parking",
  "Landscaping / Grounds",
  "Structural / Civil",
  "Noise Complaint",
  "Vending / Equipment",
  "Others",
];

async function getSuperAdminClient() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Not authenticated");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "super_admin") throw new Error("Unauthorized");
  return supabase;
}

export async function setCollegeStatus(collegeId: string, status: "active" | "suspended") {
  try {
    const supabase = await getSuperAdminClient();
    const { error } = await supabase
      .from("colleges")
      .update({ subscription_status: status })
      .eq("id", collegeId);

    if (error) return { error: error.message };
    revalidatePath("/super-admin");
    return { ok: true };
  } catch (err: any) {
    return { error: err?.message ?? "Failed to update status" };
  }
}

export async function createCollege(formData: FormData) {
  try {
    const supabase = await getSuperAdminClient();
    const name = String(formData.get("name") ?? "").trim();
    const category = String(formData.get("category") ?? "college");
    const address = String(formData.get("address") ?? "").trim() || null;
    const contact_email = String(formData.get("contact_email") ?? "").trim() || null;
    const contact_phone = String(formData.get("contact_phone") ?? "").trim() || null;
    const allow_worker_signup = formData.get("allow_worker_signup") === "true";
    const allow_admin_signup = formData.get("allow_admin_signup") === "true";

    if (!name) return { error: "Organization name is required" };

    const { data: college, error } = await supabase
      .from("colleges")
      .insert({
        name,
        category,
        address,
        contact_email,
        contact_phone,
        allow_worker_signup,
        allow_admin_signup,
        subscription_status: "active",
      })
      .select("id")
      .single();

    if (error) return { error: error.message };

    await supabase
      .from("categories")
      .insert(DEFAULT_CATEGORIES.map((n) => ({ college_id: college.id, name: n })));

    revalidatePath("/super-admin");
    return { ok: true, id: college.id };
  } catch (err: any) {
    return { error: err?.message ?? "Failed to create organization" };
  }
}

export async function updateCollege(collegeId: string, formData: FormData) {
  try {
    const supabase = await getSuperAdminClient();
    const name = String(formData.get("name") ?? "").trim();
    const category = String(formData.get("category") ?? "college");
    const address = String(formData.get("address") ?? "").trim() || null;
    const contact_email = String(formData.get("contact_email") ?? "").trim() || null;
    const contact_phone = String(formData.get("contact_phone") ?? "").trim() || null;
    const allow_worker_signup = formData.get("allow_worker_signup") === "true";
    const allow_admin_signup = formData.get("allow_admin_signup") === "true";

    if (!name) return { error: "Organization name is required" };

    const { error } = await supabase
      .from("colleges")
      .update({
        name,
        category,
        address,
        contact_email,
        contact_phone,
        allow_worker_signup,
        allow_admin_signup,
      })
      .eq("id", collegeId);

    if (error) return { error: error.message };
    revalidatePath("/super-admin");
    return { ok: true };
  } catch (err: any) {
    return { error: err?.message ?? "Failed to update organization" };
  }
}

export async function softDeleteCollege(collegeId: string) {
  try {
    const supabase = await getSuperAdminClient();
    const timestamp = new Date().toISOString();
    const { error } = await supabase
      .from("colleges")
      .update({
        subscription_status: `pending_deletion:${timestamp}`,
      })
      .eq("id", collegeId);

    if (error) return { error: error.message };
    revalidatePath("/super-admin");
    return { ok: true };
  } catch (err: any) {
    return { error: err?.message ?? "Failed to delete organization" };
  }
}

export async function restoreCollege(collegeId: string) {
  try {
    const supabase = await getSuperAdminClient();
    const { error } = await supabase
      .from("colleges")
      .update({
        subscription_status: "active",
      })
      .eq("id", collegeId);

    if (error) return { error: error.message };
    revalidatePath("/super-admin");
    return { ok: true };
  } catch (err: any) {
    return { error: err?.message ?? "Failed to restore organization" };
  }
}

export async function permanentlyDeleteCollege(collegeId: string) {
  try {
    const supabase = await getSuperAdminClient();

    // 1. Fetch complaints for this college
    const { data: complaints } = await supabase
      .from("complaints")
      .select("id")
      .eq("college_id", collegeId);

    if (complaints && complaints.length > 0) {
      const complaintIds = complaints.map((c) => c.id);
      await supabase.from("complaint_votes").delete().in("complaint_id", complaintIds);
      await supabase.from("complaint_media").delete().in("complaint_id", complaintIds);
      await supabase.from("complaint_status_history").delete().in("complaint_id", complaintIds);
      await supabase.from("complaints").delete().eq("college_id", collegeId);
    }

    // 2. Locations, departments, categories, role requests
    await supabase.from("locations").delete().eq("college_id", collegeId);
    await supabase.from("departments").delete().eq("college_id", collegeId);
    await supabase.from("categories").delete().eq("college_id", collegeId);
    await supabase.from("role_requests").delete().eq("college_id", collegeId);

    // 3. Unassign users belonging to this college
    await supabase
      .from("profiles")
      .update({ college_id: null, role: "user" })
      .eq("college_id", collegeId);

    // 4. Delete the college record
    const { error } = await supabase.from("colleges").delete().eq("id", collegeId);

    if (error) return { error: error.message };
    revalidatePath("/super-admin");
    return { ok: true };
  } catch (err: any) {
    return { error: err?.message ?? "Failed to permanently delete organization" };
  }
}

export async function purgeExpiredColleges() {
  try {
    const supabase = await getSuperAdminClient();
    const { data: colleges } = await supabase
      .from("colleges")
      .select("id, subscription_status");

    if (!colleges) return { ok: true };

    const now = Date.now();
    const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

    for (const c of colleges) {
      if (c.subscription_status?.startsWith("pending_deletion:")) {
        const dateStr = c.subscription_status.replace("pending_deletion:", "");
        const deletedTime = new Date(dateStr).getTime();
        if (!isNaN(deletedTime) && now - deletedTime >= THIRTY_DAYS_MS) {
          await permanentlyDeleteCollege(c.id);
        }
      }
    }

    revalidatePath("/super-admin");
    return { ok: true };
  } catch {
    return { ok: false };
  }
}
