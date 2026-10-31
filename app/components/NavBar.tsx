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
            <BrandLogo size="sm" showWordmark={false} href="/" />
          ) : logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <a href="/" title="Home" className="relative flex h-10 w-10 items-center justify-center shrink-0">
              <img
                src={logoUrl}
                alt="Organisation Logo"
                className="h-10 w-10 rounded-xl border border-neutral-200/90 bg-white object-contain p-1 shadow-2xs hover:opacity-85 transition"
                onError={(e) => {
                  // Hide broken image and show fallback building icon
                  const target = e.currentTarget;
                  target.style.display = 'none';
                  const fallback = target.nextElementSibling as HTMLElement | null;
                  if (fallback) fallback.style.display = 'flex';
                }}
              />
              <span
                style={{ display: 'none' }}
                className="absolute inset-0 flex h-10 w-10 items-center justify-center rounded-xl border border-neutral-200 bg-neutral-100 text-neutral-500"
              >
                <Building2 className="h-5 w-5" />
              </span>
            </a>
          ) : (
            <a href="/" title="Home" className="flex h-10 w-10 items-center justify-center rounded-xl border border-neutral-200 bg-neutral-100 text-neutral-500 hover:bg-neutral-200 transition shrink-0">
              <Building2 className="h-5 w-5" />
            </a>
          )}

          <span className="text-xs sm:text-sm font-medium text-neutral-700 tracking-tight">{brand}</span>
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
            const isRootRoute = ["/", "/admin", "/dept-admin", "/worker", "/super-admin"].includes(item.href);
            const active = isRootRoute
              ? pathname === item.href
              : pathname.startsWith(item.href);
            const linkClassName = `relative rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              active
                ? "bg-neutral-900 text-white"
                : "text-neutral-600 hover:bg-neutral-100"
            }`;
            const content = (
              <>
                {item.label}
                {!!item.badge && (
                  <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                    {item.badge}
                  </span>
                )}
              </>
            );

            return item.href === "/" ? (
              <a key={item.href} href="/" className={linkClassName}>
                {content}
              </a>
            ) : (
              <Link
                key={item.href}
                href={item.href}
                prefetch={false}
                className={linkClassName}
              >
                {content}
              </Link>
            )
          })}
        </div>
      </nav>
    </header>
  );
}
