import { NextRequest, NextResponse } from "next/server";
import { createRazorpayOrder, RAZORPAY_KEY_ID } from "@/lib/razorpay";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { amount, currency = "INR", receipt = `rcpt_${Date.now()}` } = body;

    // Validation
    if (!amount || typeof amount !== "number") {
      return NextResponse.json(
        { error: "Amount in paise is required and must be a number." },
        { status: 400 }
      );
    }

    if (amount < 100) {
      return NextResponse.json(
        { error: "Minimum order amount is 100 paise (₹1.00)." },
        { status: 400 }
      );
    }

    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      return NextResponse.json(
        { error: "Razorpay credentials not configured on server." },
        { status: 401 }
      );
    }

    const order = await createRazorpayOrder({
      amount,
      currency,
      receipt,
    });

    return NextResponse.json({
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
      key_id: RAZORPAY_KEY_ID,
    });
  } catch (err: any) {
    console.error("[POST /api/create-order]", err);
    return NextResponse.json(
      { error: err?.message ?? "Failed to create Razorpay order" },
      { status: 500 }
    );
  }
}
