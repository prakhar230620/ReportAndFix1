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
    sm: { icon: 36, text: "text-sm", sub: "text-[8px]", imgSize: 36 },
    md: { icon: 48, text: "text-base", sub: "text-[9px]", imgSize: 48 },
    lg: { icon: 60, text: "text-lg", sub: "text-[10px]", imgSize: 60 },
    xl: { icon: 72, text: "text-xl", sub: "text-xs", imgSize: 72 },
  }[size];

  const logoContent = (
    <div className={`inline-flex items-center gap-2.5 ${className}`}>
      {/* App Icon — uses user's provided logo */}
      <div
        className="relative flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white border border-neutral-200 shadow-sm"
        style={{ width: dimensions.icon, height: dimensions.icon }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/icons/icon-512x512.png"
          alt="ReportAndFix Logo"
          width={dimensions.imgSize}
          height={dimensions.imgSize}
          className="h-full w-full object-contain p-0.5"
        />
      </div>

      {showText && (
        <div className="flex flex-col leading-none">
          <span className={`font-black tracking-tight text-neutral-900 ${dimensions.text}`}>
            Report<span className="bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent">AndFix</span>
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
