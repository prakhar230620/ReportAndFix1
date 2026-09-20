"use client";

import { useState, useTransition } from "react";
import { Download, Printer, QrCode, CheckSquare, Square } from "lucide-react";
import Link from "next/link";
import { assignQrBulk } from "../actions";

type Eligible = { id: string; name: string; path: string };
type WithQr = { id: string; name: string; path: string; qr_token: string; location_code: string | null };

export default function QrSheetClient({
  eligible,
  withQr,
}: {
  eligible: Eligible[];
  withQr: WithQr[];
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();
  const [sheetSelected, setSheetSelected] = useState<Set<string>>(new Set(withQr.map((l) => l.id)));

  const allSelected = eligible.length > 0 && selected.size === eligible.length;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }
  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(eligible.map((e) => e.id)));
  }

  function generate() {
    if (selected.size === 0) return;
    startTransition(async () => {
      const res = await assignQrBulk(Array.from(selected));
      if (res.failed > 0) {
        alert(`${res.succeeded} generated, ${res.failed} failed.`);
      }
      window.location.reload();
    });
  }

  function toggleSheet(id: string) {
    setSheetSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function downloadPdf() {
    const ids = Array.from(sheetSelected);
    if (ids.length === 0) return;
    const res = await fetch("/api/qr-pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ location_ids: ids }),
    });
    if (!res.ok) {
      alert("Failed to generate PDF: " + (await res.text()));
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `qr-codes-${Date.now()}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="print:hidden">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-neutral-900">Bulk QR Generation</h1>
            <p className="text-sm text-neutral-500">
              Generate QR codes for many locations at once, then download or print the sheet.
            </p>
          </div>
          <Link href="/admin/locations" className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm">
            Back to Locations
          </Link>
        </div>

        {eligible.length > 0 && (
          <section className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Locations without a QR ({eligible.length})</h2>
              <button
                onClick={toggleAll}
                className="flex items-center gap-1.5 text-xs font-medium text-blue-600"
              >
                {allSelected ? <CheckSquare size={14} /> : <Square size={14} />}
                {allSelected ? "Unselect all" : "Select all"}
              </button>
            </div>
            <div className="max-h-72 overflow-y-auto rounded-md border border-neutral-100">
              {eligible.map((loc) => (
                <label
                  key={loc.id}
                  className="flex cursor-pointer items-center gap-2 border-b border-neutral-50 px-3 py-2 text-sm last:border-0 hover:bg-neutral-50"
                >
                  <input
                    type="checkbox"
                    checked={selected.has(loc.id)}
                    onChange={() => toggle(loc.id)}
                  />
                  <div>
                    <div className="font-medium text-neutral-800">{loc.name}</div>
                    <div className="text-xs text-neutral-500">{loc.path}</div>
                  </div>
                </label>
              ))}
            </div>
            <button
              disabled={pending || selected.size === 0}
              onClick={generate}
              className="mt-3 flex items-center gap-1.5 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
            >
              <QrCode size={15} />
              {pending ? "Generating…" : `Generate QR for ${selected.size} selected`}
            </button>
          </section>
        )}

        {withQr.length > 0 && (
          <section className="mt-6 flex items-center justify-between rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
            <div>
              <h2 className="text-sm font-semibold">QR sheet ({sheetSelected.size} of {withQr.length} selected)</h2>
              <p className="text-xs text-neutral-500">Uncheck any you don&apos;t want on the sheet below.</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={downloadPdf}
                disabled={sheetSelected.size === 0}
                className="flex items-center gap-1.5 rounded-md bg-neutral-900 px-3 py-1.5 text-sm text-white disabled:opacity-40"
              >
                <Download size={14} /> Download PDF
              </button>
              <button
                onClick={() => window.print()}
                disabled={sheetSelected.size === 0}
                className="flex items-center gap-1.5 rounded-md border border-neutral-300 px-3 py-1.5 text-sm disabled:opacity-40"
              >
                <Printer size={14} /> Print
              </button>
            </div>
          </section>
        )}
      </div>

      {withQr.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 print:grid-cols-4">
          {withQr
            .filter((l) => sheetSelected.has(l.id))
            .map((loc) => (
              <div
                key={loc.id}
                className="flex flex-col items-center rounded-lg border border-neutral-200 bg-white p-3 text-center shadow-sm print:break-inside-avoid print:shadow-none"
              >
                <label className="mb-1 flex w-full items-center justify-start gap-1.5 text-xs text-neutral-400 print:hidden">
                  <input
                    type="checkbox"
                    checked={sheetSelected.has(loc.id)}
                    onChange={() => toggleSheet(loc.id)}
                  />
                  include
                </label>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/qr-image?token=${loc.qr_token}`}
                  alt={loc.name}
                  className="h-28 w-28"
                />
                <div className="mt-2 text-xs font-medium text-neutral-900">{loc.name}</div>
                <div className="mt-0.5 break-words text-[10px] leading-snug text-neutral-500">
                  {loc.path}
                </div>
              </div>
            ))}
        </div>
      )}

      {eligible.length === 0 && withQr.length === 0 && (
        <p className="text-sm text-neutral-500">No locations yet — add some first.</p>
      )}
    </div>
  );
}
