import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createRazorpayOrder, generateInvoiceNumber, RAZORPAY_PUBLIC_KEY } from "@/lib/razorpay";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    // 1. Auth — verify session
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // 2. Parse body (collegeId from client is used only for super_admin acting on a specific org)
    const { planId, billingCycle, collegeId: clientCollegeId } = await req.json();
    if (!planId || !billingCycle) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const adminClient = createAdminClient();

    // 3. Load profile — the server is the source of truth for role & college
    const { data: profile } = await adminClient
      .from("profiles")
      .select("role, college_id")
      .eq("id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // 4. Determine the target collegeId:
    //    - college_admin → always their own college (ignore client value)
    //    - super_admin   → use the client-supplied collegeId (they can act on any org)
    let resolvedCollegeId: string | null;

    if (profile.role === "college_admin") {
      resolvedCollegeId = profile.college_id;
    } else if (profile.role === "super_admin") {
      resolvedCollegeId = clientCollegeId ?? null;
    } else {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    if (!resolvedCollegeId) {
      return NextResponse.json({ error: "No organisation found for this account" }, { status: 400 });
    }

    // 5. Fetch the plan server-side — never trust client-submitted price
    const { data: plan, error: planErr } = await adminClient
      .from("plans")
      .select("id, name, price_monthly_paise, price_yearly_paise, is_active")
      .eq("id", planId)
      .single();

    if (planErr || !plan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }
    if (!plan.is_active) {
      return NextResponse.json({ error: "This plan is currently unavailable" }, { status: 400 });
    }

    const amount =
      billingCycle === "yearly" ? plan.price_yearly_paise : plan.price_monthly_paise;

    // Check if test mode
    const isTestMode = (process.env.RAZORPAY_KEY_ID || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "").startsWith("rzp_test_");

    // In Razorpay Test Mode / Sandbox, single orders above ₹50,000 (and specifically UPI above ₹15,000) are blocked by Razorpay
    // with "Amount exceeds maximum amount allowed."
    // In test mode, cap the gateway order amount to ₹499 (49900 paise) so developers and college admins can test the full checkout flow
    // with test UPI, test cards, or netbanking without hitting Razorpay's sandbox transaction ceiling.
    // In production, live orders use the exact full amount.
    const razorpayOrderAmount = isTestMode && amount > 5000000 ? 49900 : amount;

    // 6. Invoice number
    const { count: txnCount } = await adminClient
      .from("payment_transactions")
      .select("id", { count: "exact", head: true });

    const invoiceNumber = generateInvoiceNumber((txnCount ?? 0) + 1);

    // 7. Create Razorpay order
    const order = await createRazorpayOrder({
      amount: razorpayOrderAmount,
      receipt: invoiceNumber,
      notes: {
        college_id: resolvedCollegeId,
        plan_id: planId,
        billing_cycle: billingCycle,
        invoice: invoiceNumber,
        actual_plan_amount: String(amount),
      },
    });

    // 8. Persist pending transaction with the true plan amount (e.g. ₹99,990)
    const { data: txn } = await adminClient
      .from("payment_transactions")
      .insert({
        college_id: resolvedCollegeId,
        amount_paise: amount,
        status: "created",
        razorpay_order_id: order.id,
        invoice_number: invoiceNumber,
        description: `Plan subscription — ${billingCycle}`,
        metadata: {
          plan_id: planId,
          billing_cycle: billingCycle,
          test_simulated: isTestMode && amount > 5000000,
        },
      })
      .select("id")
      .single();

    return NextResponse.json({
      orderId: order.id,
      amount: order.amount,
      actualAmount: amount,
      isTestSimulated: isTestMode && amount > 5000000,
      key: RAZORPAY_PUBLIC_KEY,
      transactionId: txn?.id,
      email: user.email,
    });
  } catch (err: any) {
    console.error("[create-order]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

