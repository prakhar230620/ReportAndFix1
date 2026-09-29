import React from "react";

export default function Spinner({
  size = 36,
  label,
  fullscreen = false,
}: {
  size?: number;
  label?: string;
  fullscreen?: boolean;
}) {
  const spinner = (
    <div className="flex flex-col items-center justify-center gap-4 select-none">
      <div
        className="relative flex items-center justify-center"
        style={{ width: size * 1.6, height: size * 1.6 }}
      >
        {/* Luminous aura bloom */}
        <div
          className="absolute inset-0 rounded-full bg-gradient-to-tr from-blue-500/20 via-indigo-500/20 to-cyan-400/20 blur-lg animate-pulse"
          style={{ animationDuration: "2.5s" }}
        />

        {/* Outer Orbit Ring with smooth gradient sweep */}
        <svg
          className="absolute inset-0 h-full w-full animate-spin"
          viewBox="0 0 50 50"
          style={{ animationDuration: "1.1s" }}
        >
          <defs>
            <linearGradient id="spinner-grad-outer" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#2563eb" stopOpacity="1" />
              <stop offset="50%" stopColor="#6366f1" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#06b6d4" stopOpacity="0" />
            </linearGradient>
          </defs>
          <circle
            cx="25"
            cy="25"
            r="20"
            fill="none"
            stroke="url(#spinner-grad-outer)"
            strokeWidth="3.2"
            strokeLinecap="round"
            strokeDasharray="95 35"
          />
        </svg>

        {/* Inner Counter-Rotating Precision Orbit */}
        <svg
          className="absolute inset-1.5 h-[calc(100%-12px)] w-[calc(100%-12px)] animate-spin"
          viewBox="0 0 50 50"
          style={{ animationDuration: "1.8s", animationDirection: "reverse" }}
        >
          <defs>
            <linearGradient id="spinner-grad-inner" x1="100%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#06b6d4" stopOpacity="1" />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.1" />
            </linearGradient>
          </defs>
          <circle
            cx="25"
            cy="25"
            r="19"
            fill="none"
            stroke="url(#spinner-grad-inner)"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeDasharray="60 60"
          />
        </svg>

        {/* Center Pulsing Energy Diamond / Core */}
        <div className="relative flex items-center justify-center">
          <div className="h-2 w-2 rotate-45 rounded-xs bg-gradient-to-tr from-blue-600 to-cyan-400 shadow-[0_0_10px_rgba(59,130,246,0.9)] animate-ping" />
          <div className="absolute h-1.5 w-1.5 rotate-45 rounded-xs bg-white shadow-xs" />
        </div>
      </div>

      {label && (
        <div className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-neutral-600">
          <span>{label}</span>
          <span className="flex gap-0.5">
            <span className="h-1 w-1 rounded-full bg-blue-600 animate-bounce" style={{ animationDelay: "0ms" }} />
            <span className="h-1 w-1 rounded-full bg-blue-600 animate-bounce" style={{ animationDelay: "150ms" }} />
            <span className="h-1 w-1 rounded-full bg-blue-600 animate-bounce" style={{ animationDelay: "300ms" }} />
          </span>
        </div>
      )}
    </div>
  );

  if (!fullscreen) return spinner;

  return (
    <div className="flex min-h-[55vh] w-full items-center justify-center p-6 bg-transparent">
      {spinner}
    </div>
  );
}

/** Crisp inline spinner for buttons & tight UI badges. */
export function ButtonSpinner({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-block h-4 w-4 animate-spin rounded-full border-[2.2px] border-white/20 border-t-white shadow-xs ${className}`}
      style={{ animationDuration: "0.65s" }}
    />
  );
}
