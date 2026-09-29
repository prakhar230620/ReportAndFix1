import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyWebhookSignature } from "@/lib/razorpay";
import { sendMail, planExpiredEmail } from "@/lib/mailer";

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const signature = req.headers.get("x-razorpay-signature") ?? "";

    if (!verifyWebhookSignature(body, signature)) {
      return NextResponse.json({ error: "Invalid webhook signature" }, { status: 400 });
    }

    const event = JSON.parse(body);
    const adminClient = createAdminClient();

    if (event.event === "payment.failed") {
      const payment = event.payload?.payment?.entity;
      const orderId = payment?.order_id;
      if (!orderId) return NextResponse.json({ ok: true });

      const { data: txn } = await adminClient
        .from("payment_transactions")
        .update({ status: "failed", razorpay_payment_id: payment.id })
        .eq("razorpay_order_id", orderId)
        .select("college_id, invoice_number")
        .maybeSingle();

      if (txn?.college_id) {
        await adminClient.from("plan_notifications").insert({
          college_id: txn.college_id,
          type: "payment_failed",
          title: "Payment failed",
          body: `Your payment (${txn.invoice_number}) failed. Please try again or contact support.`,
          metadata: { order_id: orderId },
        });
      }
    }

    if (event.event === "refund.processed") {
      const refund = event.payload?.refund?.entity;
      if (!refund?.payment_id) return NextResponse.json({ ok: true });

      await adminClient
        .from("payment_transactions")
        .update({
          refund_id: refund.id,
          refund_amount_paise: refund.amount,
          refund_status: "processed",
          status: refund.amount === refund.payment_amount ? "refunded" : "partially_refunded",
        })
        .eq("razorpay_payment_id", refund.payment_id);
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[webhook]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
