"use client";

import { useState } from "react";

declare global {
  interface Window {
    Razorpay: any;
  }
}

export type RazorpayPaymentSuccessData = {
  order_id: string;
  payment_id: string;
  signature: string;
};

interface RazorpayCheckoutButtonProps {
  amount: number; // in paise (e.g. 49900 = ₹499.00)
  currency?: string;
  name?: string;
  description?: string;
  buttonText?: string;
  className?: string;
  prefillEmail?: string;
  prefillContact?: string;
  onSuccess?: (data: RazorpayPaymentSuccessData) => void;
  onFailure?: (error: string) => void;
}

export default function RazorpayCheckoutButton({
  amount,
  currency = "INR",
  name = "ReportAndFix",
  description = "Standard Plan Subscription",
  buttonText,
  className,
  prefillEmail,
  prefillContact,
  onSuccess,
  onFailure,
}: RazorpayCheckoutButtonProps) {
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

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

  async function handleCheckout() {
    try {
      setLoading(true);
      setErrorMessage(null);
      setSuccessMessage(null);

      // 1. Ensure Razorpay script is loaded
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        throw new Error("Failed to load Razorpay checkout SDK. Please check your network connection.");
      }

      // 2. Call backend endpoint to create order
      const orderRes = await fetch("/api/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          currency,
          receipt: `rcpt_${Date.now()}`,
        }),
      });

      const orderData = await orderRes.json();
      if (!orderRes.ok || !orderData.order_id) {
        throw new Error(orderData.error ?? "Failed to create Razorpay order.");
      }

      const keyId =
        orderData.key_id ||
        process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ||
        "rzp_test_Tm65zzEiuQQbEC";

      // 3. Configure Razorpay modal options
      const options = {
        key: keyId,
        amount: orderData.amount,
        currency: orderData.currency,
        name: name,
        description: description,
        image: "/logo.png",
        order_id: orderData.order_id,
        prefill: {
          email: prefillEmail || "",
          contact: prefillContact || "",
        },
        theme: {
          color: "#0f172a",
        },
        handler: async function (response: {
          razorpay_payment_id: string;
          razorpay_order_id: string;
          razorpay_signature: string;
        }) {
          try {
            // 4. Verify signature on backend
            const verifyRes = await fetch("/api/verify-payment", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                order_id: response.razorpay_order_id,
                payment_id: response.razorpay_payment_id,
                signature: response.razorpay_signature,
              }),
            });

            const verifyData = await verifyRes.json();
            if (!verifyRes.ok || !verifyData.success) {
              throw new Error(verifyData.error ?? "Payment verification failed. Invalid signature.");
            }

            setSuccessMessage("Payment verified successfully!");
            if (onSuccess) {
              onSuccess({
                order_id: response.razorpay_order_id,
                payment_id: response.razorpay_payment_id,
                signature: response.razorpay_signature,
              });
            }
          } catch (verifyErr: any) {
            const msg = verifyErr?.message ?? "Payment verification failed.";
            setErrorMessage(msg);
            if (onFailure) onFailure(msg);
          } finally {
            setLoading(false);
          }
        },
        modal: {
          ondismiss: function () {
            setLoading(false);
            setErrorMessage("Payment was cancelled by the user.");
            if (onFailure) onFailure("Payment cancelled by user.");
          },
        },
      };

      const razorpayInstance = new window.Razorpay(options);

      razorpayInstance.on("payment.failed", function (response: any) {
        setLoading(false);
        const failReason =
          response.error?.description ||
          response.error?.reason ||
          "Payment failed. Please try another payment method.";
        setErrorMessage(failReason);
        if (onFailure) onFailure(failReason);
      });

      razorpayInstance.open();
    } catch (err: any) {
      setLoading(false);
      const msg = err?.message ?? "Error initiating Razorpay checkout.";
      setErrorMessage(msg);
      if (onFailure) onFailure(msg);
    }
  }

  const formattedAmount = (amount / 100).toLocaleString("en-IN", {
    style: "currency",
    currency: currency,
  });

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={handleCheckout}
        disabled={loading}
        className={
          className ||
          "inline-flex items-center justify-center gap-2 rounded-lg bg-neutral-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-neutral-800 disabled:opacity-50 transition-all cursor-pointer"
        }
      >
        {loading ? (
          <>
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            <span>Processing...</span>
          </>
        ) : (
          <span>{buttonText || `Pay ${formattedAmount}`}</span>
        )}
      </button>

      {errorMessage && (
        <p className="text-xs text-red-600 font-medium">⚠️ {errorMessage}</p>
      )}

      {successMessage && (
        <p className="text-xs text-emerald-600 font-medium">✓ {successMessage}</p>
      )}
    </div>
  );
}
