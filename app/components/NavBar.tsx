"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import BackButton from "./BackButton";
import NotificationBell from "./NotificationBell";

export default function NavBar({
  brand,
  items,
  notify,
  logoUrl,
}: {
  brand: string;
  items: { href: string; label: string; badge?: number }[];
  notify?: { role: "college_admin" | "super_admin" | "worker"; collegeId?: string | null; userId?: string };
  logoUrl?: string | null;
}) {
  const pathname = usePathname();

  return (
    <header className="border-b border-neutral-200 bg-white px-4 py-3 sm:px-6">
      <nav className="mx-auto flex max-w-5xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <BackButton fallbackHref="/" />
          {logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="" className="h-6 w-6 rounded object-contain" />
          )}
          <span className="font-semibold text-neutral-900">{brand}</span>
          {notify && (
            <NotificationBell role={notify.role} collegeId={notify.collegeId} userId={notify.userId} />
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
