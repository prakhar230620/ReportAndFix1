"use client";

import { useState, useEffect } from "react";
import { KeyRound, RefreshCw, Copy, Check, QrCode } from "lucide-react";
import { ButtonSpinner } from "@/app/components/Spinner";

export default function JoinCodeCard({ collegeId }: { collegeId: string }) {
  const [code, setCode] = useState<string | null>(null);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/join-code/generate")
      .then((r) => r.json())
      .then((data) => {
        if (data.code) {
          setCode(data.code);
          setQrUrl(data.qrUrl);
        }
      })
      .catch(() => {});
  }, []);

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/join-code/generate", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate code");
      setCode(data.code);
      setQrUrl(data.qrUrl);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleCopy() {
    if (!code) return;
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 border border-blue-200 text-blue-600">
            <KeyRound className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-neutral-900">Organisation Join Code</h2>
            <p className="text-xs text-neutral-500">
              New members and staff use this code to join your organisation on signup.
            </p>
          </div>
        </div>

        <button
          onClick={handleGenerate}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50 transition"
        >
          {loading ? <ButtonSpinner /> : <RefreshCw className="h-3.5 w-3.5" />}
          {code ? "Generate New Code" : "Generate Code"}
        </button>
      </div>

      {error && <p className="mt-3 text-xs text-red-600">{error}</p>}

      {code ? (
        <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-4 rounded-xl bg-neutral-50 border border-neutral-200 p-4">
          <div className="flex items-center gap-3">
            <span className="font-mono text-2xl font-bold tracking-widest text-neutral-900 bg-white px-3 py-1 rounded-lg border border-neutral-200 shadow-xs">
              {code}
            </span>
            <button
              onClick={handleCopy}
              className="inline-flex items-center gap-1 rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-neutral-800 transition"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied!" : "Copy Code"}
            </button>
          </div>

          {qrUrl && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowQr(!showQr)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
              >
                <QrCode className="h-3.5 w-3.5" />
                {showQr ? "Hide Join QR" : "Show Join QR"}
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="mt-4 rounded-xl bg-neutral-50 border border-dashed border-neutral-300 p-4 text-center">
          <p className="text-xs text-neutral-500">
            No active join code yet. Click "Generate Code" above to create one.
          </p>
        </div>
      )}

      {showQr && qrUrl && (
        <div className="mt-4 flex flex-col items-center justify-center p-4 border border-neutral-200 rounded-xl bg-white text-center">
          <p className="text-xs font-medium text-neutral-700 mb-2">Scan to auto-fill Join Code on signup</p>
          <img
            src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(qrUrl)}`}
            alt="Organisation Join QR"
            className="h-44 w-44 rounded-lg border border-neutral-200 p-1 bg-white"
          />
          <p className="text-xs text-neutral-400 mt-2 font-mono break-all max-w-sm">{qrUrl}</p>
        </div>
      )}
    </div>
  );
}
