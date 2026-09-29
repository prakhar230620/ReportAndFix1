"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Search, X, MapPin, ChevronRight, AlertCircle } from "lucide-react";
import QRScanButton from "./QRScanButton";

export type LocationItem = {
  id: string;
  name: string;
  location_code: string | null;
  qr_token: string;
  path: string;
};

// Helper to highlight matched keywords
function HighlightMatch({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <span>{text}</span>;

  const terms = query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 0);

  if (terms.length === 0) return <span>{text}</span>;

  // Escape special regex characters
  const escaped = terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  const regex = new RegExp(`(${escaped})`, "gi");
  const parts = text.split(regex);

  return (
    <span>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <mark
            key={i}
            className="rounded bg-amber-100 font-semibold text-amber-950 px-0.5"
          >
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </span>
  );
}

export default function LocationPickerClient({
  locations,
}: {
  locations: LocationItem[];
}) {
  const [query, setQuery] = useState("");

  // Multi-keyword fuzzy relevance filtering
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return locations;

    const terms = q.split(/\s+/).filter(Boolean);

    const scored = locations
      .map((loc) => {
        const nameLower = loc.name.toLowerCase();
        const pathLower = loc.path.toLowerCase();
        const codeLower = (loc.location_code || "").toLowerCase();

        // Every term must be present somewhere in path, name, or code
        const allMatched = terms.every(
          (t) =>
            pathLower.includes(t) || nameLower.includes(t) || codeLower.includes(t)
        );

        if (!allMatched) return null;

        // Compute relevance score
        let score = 0;
        if (nameLower === q) score += 100;
        else if (nameLower.startsWith(q)) score += 50;
        else if (nameLower.includes(q)) score += 30;

        if (codeLower && codeLower.includes(q)) score += 25;
        if (pathLower.includes(q)) score += 20;

        // Extra points for matching multiple parts
        terms.forEach((t) => {
          if (nameLower.includes(t)) score += 10;
          if (pathLower.includes(t)) score += 5;
        });

        return { loc, score };
      })
      .filter((item): item is { loc: LocationItem; score: number } => item !== null)
      .sort((a, b) => b.score - a.score)
      .map((item) => item.loc);

    return scored;
  }, [locations, query]);

  return (
    <div className="flex flex-col gap-5">
      {/* QR Scan Button */}
      <QRScanButton />

      {/* Divider */}
      <div className="flex items-center gap-3 text-xs font-medium text-neutral-400">
        <div className="h-px flex-1 bg-neutral-200" />
        OR SEARCH & PICK MANUALLY
        <div className="h-px flex-1 bg-neutral-200" />
      </div>

      {/* Interactive Search Bar */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by room, block, floor (e.g. Block B, Ground)..."
          className="w-full rounded-xl border border-neutral-300 bg-white py-3 pl-10 pr-10 text-sm text-neutral-900 shadow-sm placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900 transition-all"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 transition"
            title="Clear search"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Results Header / Stats */}
      {query.trim() && (
        <div className="flex items-center justify-between text-xs text-neutral-500 px-1">
          <span>
            Found <strong className="font-semibold text-neutral-800">{filtered.length}</strong> matching location
            {filtered.length !== 1 ? "s" : ""}
          </span>
          <button
            onClick={() => setQuery("")}
            className="text-xs font-medium text-blue-600 hover:text-blue-700"
          >
            Reset filter
          </button>
        </div>
      )}

      {/* Location Cards List */}
      <div className="flex flex-col gap-2.5">
        {filtered.map((loc) => {
          // Format path parts for clean breadcrumb presentation
          const pathSegments = loc.path.split(" / ");

          return (
            <Link
              key={loc.id}
              href={`/report/${loc.qr_token}`}
              className="group flex items-center justify-between rounded-xl border border-neutral-200 bg-white p-3.5 shadow-sm transition hover:border-neutral-400 hover:bg-neutral-50/70 hover:shadow"
            >
              <div className="flex items-start gap-3 min-w-0 pr-2">
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-600 group-hover:bg-neutral-900 group-hover:text-white transition-colors">
                  <MapPin className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-neutral-900 group-hover:text-neutral-900">
                      <HighlightMatch text={loc.name} query={query} />
                    </span>
                    {loc.location_code && (
                      <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[11px] font-mono text-neutral-600 border border-neutral-200">
                        {loc.location_code}
                      </span>
                    )}
                  </div>

                  {/* Full Location Path */}
                  <div className="mt-1 text-xs text-neutral-500 leading-snug line-clamp-2">
                    {pathSegments.map((segment, idx) => (
                      <span key={idx}>
                        {idx > 0 && <span className="mx-1 text-neutral-300 font-normal">›</span>}
                        <HighlightMatch text={segment} query={query} />
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <ChevronRight className="h-4 w-4 shrink-0 text-neutral-400 transition-transform group-hover:translate-x-0.5 group-hover:text-neutral-800" />
            </Link>
          );
        })}

        {/* Empty state when searching */}
        {filtered.length === 0 && query.trim() && (
          <div className="rounded-xl border border-dashed border-neutral-300 bg-neutral-50 p-6 text-center text-sm text-neutral-500">
            <AlertCircle className="mx-auto h-7 w-7 text-neutral-400 mb-2" />
            <p className="font-medium text-neutral-800">
              No locations match &ldquo;{query}&rdquo;
            </p>
            <p className="mt-1 text-xs text-neutral-500">
              Try searching by block name, floor, or room number.
            </p>
            <button
              onClick={() => setQuery("")}
              className="mt-3 text-xs font-semibold text-neutral-900 underline hover:text-neutral-700"
            >
              Clear search query
            </button>
          </div>
        )}

        {/* Empty state when no locations set up at all */}
        {locations.length === 0 && (
          <div className="rounded-xl border border-neutral-200 bg-white p-6 text-center text-sm text-neutral-500">
            <MapPin className="mx-auto h-7 w-7 text-neutral-400 mb-2" />
            <p className="font-medium text-neutral-800">No locations found</p>
            <p className="mt-1 text-xs text-neutral-500">
              No active locations have been set up for your organisation yet. Please contact your college administrator.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
