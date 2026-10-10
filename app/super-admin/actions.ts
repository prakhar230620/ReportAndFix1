"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
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
      .update({
        subscription_status: status,
        is_frozen: status === "suspended",
        frozen_reason: status === "suspended" ? "Suspended by Super Admin" : null,
      })
      .eq("id", collegeId);

    if (error) return { error: error.message };

    const adminClient = createAdminClient();
    await adminClient
      .from("org_subscriptions")
      .update({ status: status === "suspended" ? "frozen" : "active" })
      .eq("college_id", collegeId);

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

    const insertPayload: Record<string, any> = {
      name,
      category,
      address,
      contact_email,
      contact_phone,
      allow_worker_signup,
      allow_admin_signup,
      subscription_status: "trial",
    };

    const { data: college, error } = await supabase
      .from("colleges")
      .insert(insertPayload)
      .select("id")
      .single();

    if (error) {
      console.error("[createCollege] DB error:", error);
      return { error: error.message.includes("schema cache") || error.message.includes("column") ? "Unable to register organization. Please verify the input." : error.message };
    }

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

    const updatePayload: Record<string, any> = {
      name,
      category,
      address,
      contact_email,
      contact_phone,
      allow_worker_signup,
      allow_admin_signup,
    };

    const { error } = await supabase
      .from("colleges")
      .update(updatePayload)
      .eq("id", collegeId);

    if (error) {
      console.error("[updateCollege] DB error:", error);
      return { error: error.message.includes("schema cache") || error.message.includes("column") ? "Unable to update organization settings." : error.message };
    }
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

export async function manageOrgSubscriptionManual(formData: FormData) {
  try {
    const supabase = await getSuperAdminClient();
    const adminClient = createAdminClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const collegeId = String(formData.get("college_id") ?? "");
    const actionType = String(formData.get("action_type") ?? "assign");
    const planId = String(formData.get("plan_id") ?? "");
    const billingCycle = (formData.get("billing_cycle") as "monthly" | "yearly") || "monthly";
    const paymentMethod = String(formData.get("payment_method") ?? "");
    const transactionReference = String(formData.get("transaction_reference") ?? "").trim();
    const payerName = String(formData.get("payer_name") ?? "").trim();
    const payerDesignation = String(formData.get("payer_designation") ?? "").trim();
    const file = formData.get("file");

    if (!collegeId) return { error: "Organization ID is required." };

    if (actionType === "suspend") {
      await adminClient.from("org_subscriptions").update({ status: "frozen" }).eq("college_id", collegeId);
      await adminClient.from("colleges").update({
        is_frozen: true,
        frozen_reason: "Suspended by Super Admin",
        subscription_status: "suspended",
      }).eq("id", collegeId);
      revalidatePath("/super-admin");
      revalidatePath("/super-admin/analytics");
      return { ok: true, status: "suspended" };
    }

    if (actionType === "continue") {
      await adminClient.from("org_subscriptions").update({ status: "active" }).eq("college_id", collegeId);
      await adminClient.from("colleges").update({
        is_frozen: false,
        frozen_reason: null,
        subscription_status: "active",
      }).eq("id", collegeId);
      revalidatePath("/super-admin");
      revalidatePath("/super-admin/analytics");
      return { ok: true, status: "active" };
    }

    if (actionType === "cancel") {
      await adminClient.from("org_subscriptions").update({ status: "cancelled" }).eq("college_id", collegeId);
      await adminClient.from("colleges").update({
        is_frozen: true,
        frozen_reason: "Subscription Cancelled",
        subscription_status: "cancelled",
      }).eq("id", collegeId);
      revalidatePath("/super-admin");
      revalidatePath("/super-admin/analytics");
      return { ok: true, status: "cancelled" };
    }

    // Action is "assign"
    if (!planId) return { error: "Please select a plan to assign." };
    if (!["upi", "netbanking", "card"].includes(paymentMethod)) {
      return {
        error: "Invalid payment mode. Only online payments (UPI, NetBanking, Cards/RuPay) are accepted. Cash payments are strictly prohibited.",
      };
    }
    if (!transactionReference) {
      return { error: "Unique Transaction Reference (UTR / Txn ID) is required." };
    }
    if (!payerName) {
      return { error: "Payer name is required." };
    }

    if (!(file instanceof File) || file.size === 0) {
      return { error: "Payment proof document (Receipt Image or Statement PDF) is required." };
    }

    // Read and verify file
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // AI-Generated Image & Fraud Detection
    if (file.type.startsWith("image/")) {
      const { detectAiGeneratedImage } = await import("@/lib/aiDetection");
      const aiCheck = await detectAiGeneratedImage(buffer, file.name, file.type);
      if (aiCheck.isAiGenerated) {
        return {
          error: `AI Fraud Alert: Image detected as AI-generated/synthetic (${aiCheck.reason}). Please provide an authentic official bank statement or payment receipt.`,
        };
      }
    }

    // Upload proof file
    let proofUrl = "";
    const storagePath = `proofs/${collegeId}/${Date.now()}_${file.name}`;
    try {
      const { uploadToB2 } = await import("@/lib/b2");
      await uploadToB2(storagePath, buffer, file.type);
      proofUrl = `/api/media?path=${encodeURIComponent(storagePath)}`;
    } catch {
      const { data: uploadData } = await adminClient.storage
        .from("complaint-media")
        .upload(storagePath, buffer, { contentType: file.type });
      proofUrl = uploadData ? `/api/media?path=${encodeURIComponent(storagePath)}` : storagePath;
    }

    // Fetch plan details
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(planId);
    const planQuery = isUuid
      ? adminClient.from("plans").select("*").eq("id", planId)
      : adminClient.from("plans").select("*").eq("slug", planId);
    const { data: plan } = await planQuery.single();
    if (!plan) return { error: "Selected plan does not exist." };
    const actualPlanId = plan.id;

    const amountPaise = billingCycle === "yearly" ? plan.price_yearly_paise : plan.price_monthly_paise;
    const daysToAdd = billingCycle === "yearly" ? 365 : 30;
    const periodEnd = new Date(Date.now() + daysToAdd * 24 * 60 * 60 * 1000).toISOString();

    // Upsert subscription
    const { data: existingSub } = await adminClient
      .from("org_subscriptions")
      .select("id")
      .eq("college_id", collegeId)
      .maybeSingle();

    let subId = existingSub?.id;
    if (existingSub) {
      await adminClient
        .from("org_subscriptions")
        .update({
          plan_id: actualPlanId,
          status: "manually_assigned",
          billing_cycle: billingCycle,
          current_period_start: new Date().toISOString(),
          current_period_end: periodEnd,
          assigned_by: user!.id,
          notes: `Assigned manually by Super Admin. Txn Ref: ${transactionReference}`,
        })
        .eq("id", existingSub.id);
    } else {
      const { data: newSub } = await adminClient
        .from("org_subscriptions")
        .insert({
          college_id: collegeId,
          plan_id: actualPlanId,
          status: "manually_assigned",
          billing_cycle: billingCycle,
          current_period_start: new Date().toISOString(),
          current_period_end: periodEnd,
          assigned_by: user!.id,
          notes: `Assigned manually by Super Admin. Txn Ref: ${transactionReference}`,
        })
        .select("id")
        .single();
      subId = newSub?.id;
    }

    // Unfreeze college and update status
    await adminClient
      .from("colleges")
      .update({
        is_frozen: false,
        frozen_reason: null,
        subscription_status: "active",
        subscription_plan: plan.slug,
      })
      .eq("id", collegeId);

    // Record payment transaction
    await adminClient.from("payment_transactions").insert({
      college_id: collegeId,
      subscription_id: subId,
      amount_paise: amountPaise,
      currency: "INR",
      status: "paid",
      payment_method: paymentMethod as any,
      description: `Manual Plan Assignment (${plan.name} ${billingCycle})`,
      invoice_number: `INV-MAN-${Date.now().toString().slice(-6)}`,
      metadata: {
        transaction_reference: transactionReference,
        payer_name: payerName,
        payer_designation: payerDesignation || "Organisation Admin",
        proof_url: proofUrl,
        assigned_by: user!.id,
        ai_verified: true,
      },
    });

    revalidatePath("/super-admin");
    revalidatePath("/super-admin/analytics");
    revalidatePath("/admin/billing");
    return { ok: true };
  } catch (err: any) {
    return { error: err?.message ?? "Failed to assign plan." };
  }
}

