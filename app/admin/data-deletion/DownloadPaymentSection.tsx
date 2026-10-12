"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Download, CreditCard, CheckCircle2, AlertTriangle, ShieldCheck } from "lucide-react";
import { ButtonSpinner } from "@/app/components/Spinner";
import { verifyDownloadPayment } from "./actions";
import ExecuteDeletionButton from "./ExecuteDeletionButton";

declare global {
  interface Window {
    Razorpay: any;
  }
}

interface DownloadPaymentSectionProps {
  requestId: string;
  collegeId: string;
  complaintCount: number;
  downloadFree: boolean;
  downloadChargePaise: number;
  isPaid: boolean;
  paymentId?: string | null;
  userEmail?: string;
}

export default function DownloadPaymentSection({
  requestId,
  collegeId,
  complaintCount,
  downloadFree,
  downloadChargePaise,
  isPaid: initialIsPaid,
  paymentId: initialPaymentId,
  userEmail,
}: DownloadPaymentSectionProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPaid, setIsPaid] = useState(initialIsPaid);
  const [paymentId, setPaymentId] = useState<string | null>(initialPaymentId ?? null);

  const needsPayment = !downloadFree && !isPaid;

  async function loadRazorpayScript(): Promise<boolean> {
    if (typeof window !== "undefined" && window.Razorpay) {
      return true;
    }
    return new Promise((resolve) => {
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.async = true;
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  }

  async function handlePayFee() {
    setLoading(true);
    setError(null);

    try {
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        throw new Error("Failed to load payment gateway. Please check your internet connection and try again.");
      }

      // Create Razorpay order for data deletion fee
      const res = await fetch("/api/data-deletion/create-payment-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create payment order.");
      }

      const rzp = new window.Razorpay({
        key: data.key,
        order_id: data.orderId,
        amount: data.amount,
        currency: "INR",
        name: "ReportAndFix",
        description: `Data Deletion Archive Fee (${complaintCount} complaints)`,
        image: "/logo.png",
        prefill: { email: userEmail || data.email },
        theme: { color: "#1c1917" },
        handler: async (response: any) => {
          setLoading(true);
          try {
            const vRes = await verifyDownloadPayment({
              requestId,
              orderId: response.razorpay_order_id,
              paymentId: response.razorpay_payment_id,
              signature: response.razorpay_signature,
              transactionId: data.transactionId,
            });

            if (vRes.ok) {
              setIsPaid(true);
              setPaymentId(response.razorpay_payment_id);
              router.refresh();
            } else {
              setError(vRes.error || "Payment verification failed. Please contact support.");
            }
          } catch (err: any) {
            setError(err.message || "Payment verification failed.");
          } finally {
            setLoading(false);
          }
        },
        modal: {
          ondismiss: () => {
            setLoading(false);
          },
        },
      });

      rzp.on("payment.failed", (response: any) => {
        setLoading(false);
        setError(response.error?.description || "Payment failed. Please try again.");
      });

      rzp.open();
    } catch (err: any) {
      setLoading(false);
      setError(err.message || "An unexpected error occurred during payment initialization.");
    }
  }

  return (
    <div className="mt-4 flex flex-col gap-4">
      {/* Error Notice */}
      {error && (
        <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs text-red-700">
          <AlertTriangle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold text-red-900">Payment Error</p>
            <p className="mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Case 1: Payment Required Before Download */}
      {needsPayment ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-start gap-3">
            <CreditCard className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
            <div className="flex-1">
              <h3 className="font-semibold text-amber-900 text-sm">Download Fee Payment Required</h3>
              <p className="text-xs text-amber-800 mt-1">
                Your current plan requires a one-time archive generation & download fee of{" "}
                <strong>₹{downloadChargePaise / 100}</strong> before you can download the complaint backup.
              </p>
              <div className="mt-3 flex items-center gap-3">
                <button
                  type="button"
                  onClick={handlePayFee}
                  disabled={loading}
                  className="inline-flex items-center gap-2 rounded-lg bg-amber-700 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-800 disabled:opacity-60 shadow-xs transition"
                >
                  {loading ? <ButtonSpinner /> : <CreditCard className="h-4 w-4" />}
                  {loading ? "Processing..." : `Pay ₹${downloadChargePaise / 100} to Unlock Download`}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Case 2: Download Unlocked */
        <div className="space-y-4">
          {/* Payment Success Badge if paid via Razorpay */}
          {isPaid && !downloadFree && (
            <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3.5 py-2 text-xs font-medium text-green-800">
              <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
              <span>
                Download fee paid (₹{downloadChargePaise / 100})
                {paymentId ? ` · Ref: ${paymentId}` : ""}
              </span>
            </div>
          )}

          {downloadFree && (
            <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3.5 py-2 text-xs font-medium text-blue-800">
              <ShieldCheck className="h-4 w-4 text-blue-600 shrink-0" />
              <span>Data archive download is complimentary on your subscription plan.</span>
            </div>
          )}

          {/* Download Button */}
          <div className="flex items-center gap-3">
            <a
              href={`/api/data-deletion/download?requestId=${requestId}`}
              className="inline-flex items-center gap-2 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800 shadow-xs transition w-fit"
            >
              <Download className="h-4 w-4" />
              Download Data Archive (ZIP + PDF)
            </a>
          </div>

          {/* Permanent Deletion Button */}
          <ExecuteDeletionButton
            requestId={requestId}
            complaintCount={complaintCount}
          />
        </div>
      )}
    </div>
  );
}
