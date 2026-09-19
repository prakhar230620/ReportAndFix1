"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export default function QRScanButton() {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    let rafId: number;

    async function start() {
      if (!("BarcodeDetector" in window)) {
        setError(
          "QR scanning isn't supported in this browser. Please use the list below instead."
        );
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        // @ts-expect-error BarcodeDetector isn't in the TS lib yet
        const detector = new window.BarcodeDetector({ formats: ["qr_code"] });

        const tick = async () => {
          if (cancelled || !videoRef.current) return;
          try {
            const codes = await detector.detect(videoRef.current);
            if (codes.length > 0) {
              const value: string = codes[0].rawValue;
              // Accept either a full report URL or a bare token.
              const match = value.match(/\/report\/([a-zA-Z0-9-]+)/);
              const token = match ? match[1] : value.trim();
              cancelled = true;
              streamRef.current?.getTracks().forEach((t) => t.stop());
              router.push(`/report/${token}`);
              return;
            }
          } catch {
            // transient detection errors are fine, keep scanning
          }
          rafId = requestAnimationFrame(tick);
        };
        rafId = requestAnimationFrame(tick);
      } catch {
        setError("Camera access denied or unavailable.");
      }
    }

    start();
    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [open, router]);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
        className="flex w-full items-center justify-center gap-2 rounded-md bg-neutral-900 px-4 py-3 text-sm font-medium text-white"
      >
        Scan QR code
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 p-6">
          <div className="w-full max-w-sm overflow-hidden rounded-lg bg-black">
            <video ref={videoRef} className="w-full" muted playsInline />
          </div>
          {error && (
            <p className="mt-4 max-w-sm text-center text-sm text-red-300">{error}</p>
          )}
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="mt-6 rounded-md border border-white/30 px-4 py-2 text-sm text-white"
          >
            Cancel
          </button>
        </div>
      )}
    </>
  );
}
