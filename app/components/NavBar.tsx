"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import BackButton from "./BackButton";
import NotificationBell from "./NotificationBell";
import BrandLogo from "./BrandLogo";
import { Building2 } from "lucide-react";

export default function NavBar({
  brand,
  items,
  notify,
  logoUrl,
  showBrandLogo = false,
}: {
  brand: string;
  items: { href: string; label: string; badge?: number }[];
  notify?: {
    role: "college_admin" | "dept_admin" | "super_admin" | "worker";
    collegeId?: string | null;
    departmentId?: string | null;
    userId?: string;
  };
  logoUrl?: string | null;
  showBrandLogo?: boolean;
}) {
  const pathname = usePathname();
  const isSuperAdmin = notify?.role === "super_admin" || brand.toLowerCase().includes("super admin");

  return (
    <header className="border-b border-neutral-200 bg-white px-4 py-3 sm:px-6">
      <nav className="mx-auto flex max-w-5xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <BackButton fallbackHref="/" />

          {/* Logo Rendering Rules:
              1. Super Admin -> Platform BrandLogo
              2. Org Screens with logoUrl -> Org's own logo
              3. Org Screens without logoUrl -> Neutral Building2 icon (NEVER platform logo)
          */}
          {isSuperAdmin || showBrandLogo ? (
            <BrandLogo size="sm" showWordmark={false} />
          ) : logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="" className="h-7 w-7 rounded-lg border border-neutral-200 object-contain p-0.5" />
          ) : (
            <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-neutral-200 bg-neutral-100 text-neutral-500">
              <Building2 className="h-4 w-4" />
            </div>
          )}

          <span className="font-semibold text-neutral-900">{brand}</span>
          {notify && (
            <NotificationBell
              role={notify.role}
              collegeId={notify.collegeId}
              departmentId={notify.departmentId}
              userId={notify.userId}
            />
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {items.map((item) => {
            const active =
              item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch
                className={`relative rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  active
                    ? "bg-neutral-900 text-white"
                    : "text-neutral-600 hover:bg-neutral-100"
                }`}
              >
                {item.label}
                {!!item.badge && (
                  <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </nav>
    </header>
  );
}
