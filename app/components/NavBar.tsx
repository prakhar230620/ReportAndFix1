"use client";

import { usePathname } from "next/navigation";
import BackButton from "./BackButton";

export default function NavBar({
  brand,
  items,
}: {
  brand: string;
  items: { href: string; label: string }[];
}) {
  const pathname = usePathname();

  return (
    <header className="border-b border-neutral-200 bg-white px-4 py-3 sm:px-6">
      <nav className="mx-auto flex max-w-5xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <BackButton fallbackHref="/" />
          <span className="font-semibold text-neutral-900">{brand}</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {items.map((item) => {
            const active =
              item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <a
                key={item.href}
                href={item.href}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  active
                    ? "bg-neutral-900 text-white"
                    : "text-neutral-600 hover:bg-neutral-100"
                }`}
              >
                {item.label}
              </a>
            );
          })}
        </div>
      </nav>
    </header>
  );
}
