import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyPaymentSignature } from "@/lib/razorpay";
import { sendMail, paymentSuccessEmail } from "@/lib/mailer";
import { formatPrice } from "@/lib/plans";

export async function POST(req: NextRequest) {
  try {
    const { orderId, paymentId, signature, transactionId, planId, billingCycle, collegeId } = await req.json();

    if (!orderId || !paymentId || !signature || !transactionId) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    // Verify Razorpay signature
    const isValid = verifyPaymentSignature({ orderId, paymentId, signature });
    if (!isValid) {
      await createAdminClient()
        .from("payment_transactions")
        .update({ status: "failed", metadata: { error: "Invalid signature" } })
        .eq("id", transactionId);
      return NextResponse.json({ error: "Payment verification failed" }, { status: 400 });
    }

    const adminClient = createAdminClient();

    // Update transaction to paid
    const { data: txn } = await adminClient
      .from("payment_transactions")
      .update({
        status: "paid",
        razorpay_payment_id: paymentId,
        razorpay_signature: signature,
      })
      .eq("id", transactionId)
      .select("invoice_number, amount_paise")
      .single();

    // Determine subscription period
    const now = new Date();
    const periodEnd = new Date(now);
    if (billingCycle === "yearly") {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    } else {
      periodEnd.setMonth(periodEnd.getMonth() + 1);
    }

    // Upsert subscription defensively (works with or without unique constraint)
    const { data: existingSub } = await adminClient
      .from("org_subscriptions")
      .select("id")
      .eq("college_id", collegeId)
      .maybeSingle();

    if (existingSub) {
      await adminClient
        .from("org_subscriptions")
        .update({
          plan_id: planId,
          status: "active",
          billing_cycle: billingCycle,
          current_period_start: now.toISOString(),
          current_period_end: periodEnd.toISOString(),
          auto_renew: true,
          updated_at: now.toISOString(),
        })
        .eq("id", existingSub.id);
    } else {
      await adminClient
        .from("org_subscriptions")
        .insert({
          college_id: collegeId,
          plan_id: planId,
          status: "active",
          billing_cycle: billingCycle,
          current_period_start: now.toISOString(),
          current_period_end: periodEnd.toISOString(),
          auto_renew: true,
          updated_at: now.toISOString(),
        });
    }

    // Unfreeze org if it was frozen
    await adminClient
      .from("colleges")
      .update({ is_frozen: false, frozen_reason: null, frozen_at: null })
      .eq("id", collegeId);

    // Get plan & admin details for email
    const [{ data: plan }, { data: adminProfile }] = await Promise.all([
      adminClient.from("plans").select("name").eq("id", planId).single(),
      adminClient.from("profiles").select("id, display_name").eq("college_id", collegeId).eq("role", "college_admin").limit(1).single(),
    ]);

    // Get email from auth (profiles table doesn't store email)
    let adminEmail: string | undefined;
    if (adminProfile?.id) {
      const { data: authUser } = await adminClient.auth.admin.getUserById(adminProfile.id);
      adminEmail = authUser?.user?.email;
    }

    if (adminEmail && plan) {
      await sendMail({
        to: adminEmail,
        subject: `Payment successful — ${plan.name} plan activated`,
        html: paymentSuccessEmail({
          orgName: collegeId,
          adminName: adminProfile?.display_name ?? "Admin",
          planName: plan.name,
          amount: formatPrice(txn?.amount_paise ?? 0),
          invoiceNumber: txn?.invoice_number ?? "—",
          periodEnd: periodEnd.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }),
        }),
      });
    }

    // Create in-app notification
    if (adminProfile) {
      await adminClient.from("plan_notifications").insert({
        college_id: collegeId,
        type: "payment_success",
        title: "Payment successful",
        body: `Your ${plan?.name} plan is now active until ${periodEnd.toLocaleDateString()}.`,
        metadata: { transaction_id: transactionId, invoice: txn?.invoice_number },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[verify-payment]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
