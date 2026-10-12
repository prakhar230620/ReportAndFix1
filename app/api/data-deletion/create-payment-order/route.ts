import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createRazorpayOrder, generateInvoiceNumber, RAZORPAY_PUBLIC_KEY } from "@/lib/razorpay";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { requestId } = await req.json();
    if (!requestId) return NextResponse.json({ error: "Missing requestId" }, { status: 400 });

    const adminClient = createAdminClient();

    // Load profile
    const { data: profile } = await adminClient
      .from("profiles")
      .select("role, college_id")
      .eq("id", user.id)
      .single();

    if (!profile || profile.role !== "college_admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Load the deletion request
    const { data: request } = await adminClient
      .from("data_deletion_requests")
      .select("id, college_id, status, complaint_count, charge_paid, charge_payment_id")
      .eq("id", requestId)
      .eq("college_id", profile.college_id!)
      .single();

    if (!request) return NextResponse.json({ error: "Request not found" }, { status: 404 });
    if (request.status !== "pending_download" && request.status !== "download_ready") {
      return NextResponse.json({ error: "Request is not in downloadable state" }, { status: 400 });
    }
    if (request.charge_paid || request.charge_payment_id) {
      return NextResponse.json({ error: "Payment already completed for this download" }, { status: 400 });
    }

    // Determine charge based on plan
    const { data: subscription } = await adminClient
      .from("org_subscriptions")
      .select("*, plans(data_download_free, slug)")
      .eq("college_id", profile.college_id!)
      .maybeSingle();

    const downloadFree = (subscription?.plans as any)?.data_download_free === true;
    if (downloadFree) {
      return NextResponse.json({ error: "Download is free for your plan — no payment needed." }, { status: 400 });
    }

    const slug = (subscription?.plans as any)?.slug;
    const amountPaise = slug === "standard" ? 29900 : 49900;

    const isTestMode = (process.env.RAZORPAY_KEY_ID || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "").startsWith("rzp_test_");

    // Generate invoice
    const { count: txnCount } = await adminClient
      .from("payment_transactions")
      .select("id", { count: "exact", head: true });
    const invoiceNumber = generateInvoiceNumber((txnCount ?? 0) + 1);

    const razorpayAmount = isTestMode && amountPaise > 5000000 ? 49900 : amountPaise;

    // Create Razorpay order
    const order = await createRazorpayOrder({
      amount: razorpayAmount,
      receipt: invoiceNumber,
      notes: {
        college_id: profile.college_id!,
        deletion_request_id: requestId,
        invoice: invoiceNumber,
        type: "data_download_fee",
      },
    });

    // Record the pending transaction
    const { data: txn } = await adminClient
      .from("payment_transactions")
      .insert({
        college_id: profile.college_id!,
        amount_paise: amountPaise,
        status: "created",
        razorpay_order_id: order.id,
        invoice_number: invoiceNumber,
        description: `Data deletion download fee — ${request.complaint_count} complaint(s)`,
        metadata: {
          type: "data_download_fee",
          deletion_request_id: requestId,
        },
      })
      .select("id")
      .single();

    return NextResponse.json({
      orderId: order.id,
      amount: order.amount,
      actualAmount: amountPaise,
      key: RAZORPAY_PUBLIC_KEY,
      transactionId: txn?.id,
      email: user.email,
    });
  } catch (err: any) {
    console.error("[data-deletion/create-payment-order]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
