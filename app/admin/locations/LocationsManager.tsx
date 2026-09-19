"use client";

import { useState, useTransition } from "react";
import {
  setLocationActive,
  deleteLocation,
  regenerateQrToken,
  reassignQr,
} from "./actions";
import CampusTree from "../campus/CampusTree";

type Building = { id: string; name: string };
type Floor = { id: string; label: string; building_id: string };
type NodeType = { id: string; name: string };
type Node = { id: string; parent_id: string | null; node_type_id: string; name: string; sort_order: number };
type Location = {
  id: string;
  name: string;
  location_code: string | null;
  location_type: string;
  active: boolean;
  qr_token: string;
  building_id: string | null;
  floor_id: string | null;
  node_id: string | null;
};

export default function LocationsManager({
  buildings,
  floors,
  locations,
  nodeTypes,
  nodes,
}: {
  buildings: Building[];
  floors: Floor[];
  locations: Location[];
  nodeTypes: NodeType[];
  nodes: Node[];
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [downloading, setDownloading] = useState(false);
  const [, startTransition] = useTransition();

  function buildingName(id: string | null) {
    return buildings.find((b) => b.id === id)?.name ?? null;
  }
  function floorLabel(id: string | null) {
    return floors.find((f) => f.id === id)?.label ?? null;
  }
  function nodePath(nodeId: string | null): string | null {
    if (!nodeId) return null;
    const parts: string[] = [];
    let current = nodes.find((n) => n.id === nodeId);
    while (current) {
      parts.unshift(current.name);
      current = current.parent_id ? nodes.find((n) => n.id === current!.parent_id) : undefined;
    }
    return parts.length > 0 ? parts.join(" / ") : null;
  }
  function locationPath(loc: Location) {
    const np = nodePath(loc.node_id);
    if (np) return np;
    const bf = [buildingName(loc.building_id), floorLabel(loc.floor_id)].filter(Boolean).join(" / ");
    return bf || "—";
  }

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function downloadQrPdf() {
    if (selected.size === 0) return;
    setDownloading(true);
    try {
      const res = await fetch("/api/qr-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ location_ids: Array.from(selected) }),
      });
      if (!res.ok) {
        alert("Failed to generate PDF: " + (await res.text()));
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `reportandfix-qr-codes-${Date.now()}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  }

  async function handleDelete(locationId: string, name: string) {
    if (!confirm(`Delete "${name}"? This can't be undone.`)) return;
    startTransition(async () => {
      try {
        await deleteLocation(locationId);
      } catch (e) {
        alert(
          e instanceof Error
            ? `Couldn't delete: ${e.message}`
            : "Couldn't delete this location."
        );
      }
    });
  }

  async function handleReassign(qrToken: string) {
    const targetId = prompt(
      "Move this QR to which location? Paste the target location's ID (visible in the table row)."
    );
    if (!targetId) return;
    startTransition(async () => {
      try {
        await reassignQr(qrToken, targetId.trim());
      } catch (e) {
        alert(e instanceof Error ? e.message : "Failed to reassign");
      }
    });
  }

  return (
    <div className="flex flex-col gap-10">
      <section>
        <h2 className="mb-1 text-lg font-semibold">Campus structure &amp; QR</h2>
        <p className="mb-3 text-sm text-neutral-600">
          Build your institution&apos;s layout to any depth, then mark a room /
          area as reportable to generate its QR code.
        </p>
        <CampusTree nodeTypes={nodeTypes} nodes={nodes} locations={locations} />
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">All locations &amp; QR codes</h2>
          <button
            onClick={downloadQrPdf}
            disabled={selected.size === 0 || downloading}
            className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm text-white disabled:opacity-40"
          >
            {downloading ? "Generating…" : `Download QR PDF (${selected.size})`}
          </button>
        </div>

        <div className="overflow-x-auto rounded-md border border-neutral-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-neutral-100">
              <tr>
                <th className="p-2"></th>
                <th className="p-2">Name</th>
                <th className="p-2">Location</th>
                <th className="p-2">Type</th>
                <th className="p-2">Status</th>
                <th className="p-2">ID</th>
                <th className="p-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {locations.map((loc) => (
                <tr key={loc.id} className="border-t border-neutral-200">
                  <td className="p-2">
                    <input
                      type="checkbox"
                      checked={selected.has(loc.id)}
                      onChange={() => toggleSelected(loc.id)}
                    />
                  </td>
                  <td className="p-2">
                    {loc.name}
                    {loc.location_code && (
                      <span className="ml-1 text-neutral-500">({loc.location_code})</span>
                    )}
                  </td>
                  <td className="p-2 text-neutral-600">{locationPath(loc)}</td>
                  <td className="p-2 text-neutral-600">{loc.location_type}</td>
                  <td className="p-2">
                    <span
                      className={
                        loc.active
                          ? "rounded-full bg-green-100 px-2 py-0.5 text-green-700"
                          : "rounded-full bg-red-100 px-2 py-0.5 text-red-700"
                      }
                    >
                      {loc.active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="p-2 font-mono text-xs text-neutral-400">{loc.id}</td>
                  <td className="p-2">
                    <div className="flex flex-wrap gap-2">
                      <button
                        className="text-xs underline"
                        onClick={() =>
                          startTransition(() => setLocationActive(loc.id, !loc.active))
                        }
                      >
                        {loc.active ? "Deactivate" : "Activate"}
                      </button>
                      <button
                        className="text-xs underline"
                        onClick={() => startTransition(() => regenerateQrToken(loc.id))}
                      >
                        Regenerate QR
                      </button>
                      <button
                        className="text-xs underline"
                        onClick={() => handleReassign(loc.qr_token)}
                      >
                        Reassign
                      </button>
                      <button
                        className="text-xs text-red-600 underline"
                        onClick={() => handleDelete(loc.id, loc.name)}
                      >
                        Delete
                      </button>
                      <button
                        className="text-xs underline"
                        onClick={() => {
                          navigator.clipboard.writeText(
                            `${window.location.origin}/report/${loc.qr_token}`
                          );
                        }}
                      >
                        Copy link
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {locations.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-4 text-center text-neutral-500">
                    No locations yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
