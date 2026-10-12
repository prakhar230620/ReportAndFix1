"use client";

import Link from "next/link";

export default function BrandLogo({
  size = "md",
  withText = true,
  showWordmark,
  href = "/",
  className = "",
  variant = "emblem",
}: {
  size?: "sm" | "md" | "lg" | "xl";
  withText?: boolean;
  /** Alias for withText — pass showWordmark={false} to show icon-only */
  showWordmark?: boolean;
  href?: string | null;
  className?: string;
  variant?: "emblem" | "full";
}) {
  // showWordmark prop overrides withText if provided
  const showText = showWordmark !== undefined ? showWordmark : withText;

  const dimensions = {
    sm: { icon: 34, text: "text-sm", sub: "text-[8px]", imgSize: 34, fullH: 36 },
    md: { icon: 44, text: "text-base", sub: "text-[9px]", imgSize: 44, fullH: 52 },
    lg: { icon: 56, text: "text-lg", sub: "text-[10px]", imgSize: 56, fullH: 72 },
    xl: { icon: 68, text: "text-xl", sub: "text-xs", imgSize: 68, fullH: 96 },
  }[size];

  if (variant === "full") {
    const fullLogo = (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src="/logo.svg"
        alt="ReportAndFix"
        style={{ height: dimensions.fullH }}
        className={`w-auto object-contain ${className}`}
      />
    );
    return href ? <Link href={href} className="focus:outline-none">{fullLogo}</Link> : fullLogo;
  }

  const logoContent = (
    <div className={`inline-flex items-center gap-2.5 text-neutral-900 ${className}`}>
      {/* App Emblem — user's vector logo */}
      <div
        className="relative flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white border border-neutral-200/90 shadow-2xs"
        style={{ width: dimensions.icon, height: dimensions.icon }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/icons/emblem.svg"
          alt="ReportAndFix Logo"
          width={dimensions.imgSize}
          height={dimensions.imgSize}
          className="h-full w-full object-contain p-1.5"
        />
      </div>

      {showText && (
        <div className="flex flex-col leading-none">
          <span className={`font-black tracking-tight text-current ${dimensions.text}`}>
            ReportAndFix
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
