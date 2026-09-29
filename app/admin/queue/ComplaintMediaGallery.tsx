"use client";

import { useState } from "react";
import { ZoomIn, X, ExternalLink, Image as ImageIcon } from "lucide-react";

export type MediaItem = {
  url: string | null;
  media_type: string;
  created_at: string;
  storage_path: string;
};

export default function ComplaintMediaGallery({
  media,
}: {
  media: MediaItem[];
}) {
  const [activeImage, setActiveImage] = useState<MediaItem | null>(null);

  const validMedia = media.filter((m) => !!m.url);

  if (validMedia.length === 0) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-dashed border-neutral-300 bg-neutral-50 p-4 text-sm text-neutral-500">
        <ImageIcon className="h-5 w-5 text-neutral-400 shrink-0" />
        <span>No photos or media attachments were uploaded with this complaint.</span>
      </div>
    );
  }

  const beforePhotos = validMedia.filter((m) => m.media_type === "before");
  const afterPhotos = validMedia.filter((m) => m.media_type === "after");
  const otherPhotos = validMedia.filter(
    (m) => m.media_type !== "before" && m.media_type !== "after"
  );

  return (
    <div className="flex flex-col gap-4">
      {/* Before / Initial Report Photos */}
      {beforePhotos.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-neutral-800 flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-blue-500" />
              Report Attachments (Before / Issue Photo)
            </h3>
            <span className="text-xs text-neutral-500">
              {beforePhotos.length} photo{beforePhotos.length > 1 ? "s" : ""}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {beforePhotos.map((item, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setActiveImage(item)}
                className="group relative aspect-video sm:aspect-square overflow-hidden rounded-lg border border-neutral-200 bg-neutral-100 shadow-sm transition hover:border-neutral-400 hover:shadow-md focus:outline-none"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  loading="lazy"
                  decoding="async"
                  src={item.url!}
                  alt={`Report photo ${idx + 1}`}
                  className="h-full w-full object-cover transition duration-200 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-black/30 opacity-0 transition-opacity group-hover:opacity-100 flex items-center justify-center text-white">
                  <ZoomIn className="h-6 w-6" />
                </div>
                <div className="absolute bottom-1 right-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">
                  Photo #{idx + 1}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* After / Resolution Photos */}
      {afterPhotos.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-neutral-800 flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-emerald-500" />
              Resolution Photos (After / Completed by Worker)
            </h3>
            <span className="text-xs text-neutral-500">
              {afterPhotos.length} photo{afterPhotos.length > 1 ? "s" : ""}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {afterPhotos.map((item, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setActiveImage(item)}
                className="group relative aspect-video sm:aspect-square overflow-hidden rounded-lg border border-emerald-300 bg-emerald-50/50 shadow-sm transition hover:border-emerald-500 hover:shadow-md focus:outline-none"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  loading="lazy"
                  decoding="async"
                  src={item.url!}
                  alt={`Resolution photo ${idx + 1}`}
                  className="h-full w-full object-cover transition duration-200 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-black/30 opacity-0 transition-opacity group-hover:opacity-100 flex items-center justify-center text-white">
                  <ZoomIn className="h-6 w-6" />
                </div>
                <div className="absolute bottom-1 right-1 rounded bg-emerald-700/80 px-1.5 py-0.5 text-[10px] text-white">
                  Resolution #{idx + 1}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Other / Unclassified Photos */}
      {otherPhotos.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {otherPhotos.map((item, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setActiveImage(item)}
              className="group relative aspect-video sm:aspect-square overflow-hidden rounded-lg border border-neutral-200 bg-neutral-100 shadow-sm transition hover:border-neutral-400 focus:outline-none"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                loading="lazy"
                decoding="async"
                src={item.url!}
                alt="Attachment"
                className="h-full w-full object-cover transition duration-200 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-black/30 opacity-0 transition-opacity group-hover:opacity-100 flex items-center justify-center text-white">
                <ZoomIn className="h-6 w-6" />
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Lightbox / Modal View */}
      {activeImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          onClick={() => setActiveImage(null)}
        >
          <div
            className="relative max-h-[90vh] max-w-4xl overflow-hidden rounded-xl bg-neutral-900 shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header bar */}
            <div className="flex items-center justify-between border-b border-neutral-800 px-4 py-2.5 text-white">
              <div className="flex items-center gap-2 text-xs">
                <span
                  className={`rounded-full px-2 py-0.5 font-medium ${
                    activeImage.media_type === "after"
                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                      : "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                  }`}
                >
                  {activeImage.media_type === "after" ? "Resolution (After)" : "Report Photo (Before)"}
                </span>
                <span className="text-neutral-400">
                  {new Date(activeImage.created_at).toLocaleString()}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={activeImage.url!}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-md p-1.5 text-neutral-400 hover:bg-neutral-800 hover:text-white"
                  title="Open full size in new tab"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
                <button
                  type="button"
                  onClick={() => setActiveImage(null)}
                  className="rounded-md p-1.5 text-neutral-400 hover:bg-neutral-800 hover:text-white"
                  title="Close (Esc)"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Image display */}
            <div className="flex items-center justify-center overflow-auto p-2 bg-black/40">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={activeImage.url!}
                alt="Enlarged complaint attachment"
                className="max-h-[75vh] w-auto max-w-full rounded-md object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
