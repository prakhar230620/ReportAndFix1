"use client";

import Link from "next/link";

export default function BrandLogo({

  size = "md",
  withText = true,
  showWordmark,
  href = "/",
  className = "",
}: {
  size?: "sm" | "md" | "lg" | "xl";
  withText?: boolean;
  /** Alias for withText — pass showWordmark={false} to show icon-only */
  showWordmark?: boolean;
  href?: string | null;
  className?: string;
}) {
  // showWordmark prop overrides withText if provided
  const showText = showWordmark !== undefined ? showWordmark : withText;
  const dimensions = {
    sm: { icon: 28, text: "text-base", sub: "text-[9px]" },
    md: { icon: 36, text: "text-lg", sub: "text-[10px]" },
    lg: { icon: 44, text: "text-xl", sub: "text-xs" },
    xl: { icon: 56, text: "text-2xl", sub: "text-sm" },
  }[size];

  const logoContent = (
    <div className={`inline-flex items-center gap-2.5 ${className}`}>
      {/* Precision Vector Emblem */}
      <div
        className="relative flex shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-700 via-indigo-600 to-cyan-400 p-[1.5px] shadow-sm shadow-blue-500/20"
        style={{ width: dimensions.icon, height: dimensions.icon }}
      >
        <div className="flex h-full w-full items-center justify-center rounded-[10px] bg-neutral-950">
          <svg
            viewBox="0 0 32 32"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="h-3/4 w-3/4"
          >
            <defs>
              <linearGradient id="raf-glow" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#38BDF8" />
                <stop offset="50%" stopColor="#6366F1" />
                <stop offset="100%" stopColor="#2563EB" />
              </linearGradient>
            </defs>
            {/* Hexagonal Shield Outline */}
            <path
              d="M16 3L27 9.5V22.5L16 29L5 22.5V9.5L16 3Z"
              stroke="url(#raf-glow)"
              strokeWidth="2.4"
              strokeLinejoin="round"
            />
            {/* Embedded Fix Checkmark & Optical Node */}
            <path
              d="M10.5 16.5L14.5 20.5L21.5 12"
              stroke="#FFFFFF"
              strokeWidth="2.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Central Precision Flare */}
            <circle cx="21.5" cy="12" r="1.5" fill="#38BDF8" />
          </svg>
        </div>
      </div>

      {showText && (
        <div className="flex flex-col leading-none">
          <span className={`font-black tracking-tight text-neutral-900 ${dimensions.text}`}>
            Report<span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">AndFix</span>
          </span>
          <span className={`font-semibold uppercase tracking-wider text-neutral-400 mt-0.5 ${dimensions.sub}`}>
            Operations Platform
          </span>
        </div>
      )}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="focus:outline-none">
        {logoContent}
      </Link>
    );
  }

  return logoContent;
}
