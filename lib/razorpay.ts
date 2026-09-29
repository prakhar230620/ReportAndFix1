// lib/razorpay.ts
// Razorpay integration helper for ReportAndFix platform

import crypto from "crypto";

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID!;
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET!;
const RAZORPAY_BASE = "https://api.razorpay.com/v1";

function authHeader() {
  return "Basic " + Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString("base64");
}

async function razorpayRequest(path: string, method: string, body?: object) {
  const res = await fetch(`${RAZORPAY_BASE}${path}`, {
    method,
    headers: {
      Authorization: authHeader(),
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.description ?? "Razorpay API error");
  return data;
}

/** Create a Razorpay order */
export async function createRazorpayOrder(params: {
  amount: number;          // in paise
  currency?: string;
  receipt: string;
  notes?: Record<string, string>;
}) {
  return razorpayRequest("/orders", "POST", {
    amount: params.amount,
    currency: params.currency ?? "INR",
    receipt: params.receipt,
    notes: params.notes ?? {},
  });
}

/** Verify Razorpay payment signature */
export function verifyPaymentSignature(params: {
  orderId: string;
  paymentId: string;
  signature: string;
}): boolean {
  const body = `${params.orderId}|${params.paymentId}`;
  const expectedSignature = crypto
    .createHmac("sha256", RAZORPAY_KEY_SECRET)
    .update(body)
    .digest("hex");
  return crypto.timingSafeEqual(
    Buffer.from(params.signature, "hex"),
    Buffer.from(expectedSignature, "hex")
  );
}

/** Verify Razorpay webhook signature */
export function verifyWebhookSignature(body: string, signature: string): boolean {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET!;
  const expected = crypto
    .createHmac("sha256", webhookSecret)
    .update(body)
    .digest("hex");
  return crypto.timingSafeEqual(
    Buffer.from(signature, "hex"),
    Buffer.from(expected, "hex")
  );
}

/** Fetch a payment by ID */
export async function fetchPayment(paymentId: string) {
  return razorpayRequest(`/payments/${paymentId}`, "GET");
}

/** Issue a refund */
export async function createRefund(paymentId: string, amountPaise: number, notes?: Record<string, string>) {
  return razorpayRequest(`/payments/${paymentId}/refund`, "POST", {
    amount: amountPaise,
    notes: notes ?? {},
  });
}

/** Generate sequential invoice number  e.g. RAF-2026-000123 */
export function generateInvoiceNumber(seq: number): string {
  const year = new Date().getFullYear();
  return `RAF-${year}-${String(seq).padStart(6, "0")}`;
}

/** Expose public key for client-side Razorpay checkout */
export const RAZORPAY_PUBLIC_KEY = RAZORPAY_KEY_ID;
