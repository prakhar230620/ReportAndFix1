// lib/razorpay.ts
// Razorpay integration helper for ReportAndFix platform

import crypto from "crypto";
import Razorpay from "razorpay";

export const RAZORPAY_KEY_ID =
  process.env.RAZORPAY_KEY_ID || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "";
export const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || "";
export const RAZORPAY_PUBLIC_KEY = RAZORPAY_KEY_ID;

/** Get Razorpay SDK instance */
export function getRazorpayInstance() {
  const key_id = process.env.RAZORPAY_KEY_ID || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
  const key_secret = process.env.RAZORPAY_KEY_SECRET;
  if (!key_id || !key_secret) {
    throw new Error("Razorpay credentials (RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET) not configured.");
  }
  return new Razorpay({
    key_id,
    key_secret,
  });
}

/** Create a Razorpay order */
export async function createRazorpayOrder(params: {
  amount: number; // in paise
  currency?: string;
  receipt?: string;
  notes?: Record<string, string>;
}) {
  if (!params.amount || params.amount < 100) {
    throw new Error("Minimum order amount is 100 paise (₹1).");
  }

  const rzp = getRazorpayInstance();
  const order = await rzp.orders.create({
    amount: Math.round(params.amount),
    currency: params.currency ?? "INR",
    receipt: params.receipt ?? `rcpt_${Date.now()}`,
    notes: params.notes ?? {},
  });

  return order;
}

/** Verify Razorpay payment signature: HMAC-SHA256(order_id + "|" + payment_id, KEY_SECRET) */
export function verifyPaymentSignature(params: {
  orderId: string;
  paymentId: string;
  signature: string;
}): boolean {
  if (!params.orderId || !params.paymentId || !params.signature) return false;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keySecret) return false;

  const expectedSignature = crypto
    .createHmac("sha256", keySecret)
    .update(`${params.orderId}|${params.paymentId}`)
    .digest("hex");

  if (params.signature.length !== expectedSignature.length) return false;

  try {
    return crypto.timingSafeEqual(
      Buffer.from(params.signature, "utf-8"),
      Buffer.from(expectedSignature, "utf-8")
    );
  } catch {
    return false;
  }
}

/** Verify Razorpay webhook signature */
export function verifyWebhookSignature(body: string, signature: string): boolean {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!webhookSecret) return false;

  const expected = crypto
    .createHmac("sha256", webhookSecret)
    .update(body)
    .digest("hex");

  if (signature.length !== expected.length) return false;

  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature, "utf-8"),
      Buffer.from(expected, "utf-8")
    );
  } catch {
    return false;
  }
}

/** Fetch a payment by ID */
export async function fetchPayment(paymentId: string) {
  const rzp = getRazorpayInstance();
  return rzp.payments.fetch(paymentId);
}

/** Issue a refund */
export async function createRefund(paymentId: string, amountPaise: number, notes?: Record<string, string>) {
  const rzp = getRazorpayInstance();
  return rzp.payments.refund(paymentId, {
    amount: amountPaise,
    notes: notes ?? {},
  });
}

/** Generate sequential invoice number e.g. RAF-2026-000123 */
export function generateInvoiceNumber(seq: number): string {
  const year = new Date().getFullYear();
  return `RAF-${year}-${String(seq).padStart(6, "0")}`;
}
