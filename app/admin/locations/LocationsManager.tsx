"use client";

import { useMemo, useState, useTransition } from "react";
import {
  createBuilding,
  updateBuilding,
  deleteBuilding,
  createFloor,
  updateFloor,
  deleteFloor,
  createLocation,
  setLocationActive,
  deleteLocation,
  regenerateQrToken,
  reassignQr,
} from "./actions";

type Building = { id: string; name: string };
type Floor = { id: string; label: string; building_id: string };
type Location = {
  id: string;
  name: string;
  location_code: string | null;
  location_type: string;
  active: boolean;
  qr_token: string;
  building_id: string | null;
  floor_id: string | null;
};

const LOCATION_TYPES = [
  "room", "lab", "library", "washroom", "office", "corridor",
  "parking", "canteen", "hostel", "playground", "staircase", "other",
];

export default function LocationsManager({
  buildings,
  floors,
  locations,
}: {
  buildings: Building[];
  floors: Floor[];
  locations: Location[];
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [newLocBuilding, setNewLocBuilding] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [, startTransition] = useTransition();

  const floorsForBuilding = useMemo(
    () => floors.filter((f) => f.building_id === newLocBuilding),
    [floors, newLocBuilding]
  );

  function buildingName(id: string | null) {
    return buildings.find((b) => b.id === id)?.name ?? "—";
  }
  function floorLabel(id: string | null) {
    return floors.find((f) => f.id === id)?.label ?? "—";
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

  async function handleRenameBuilding(id: string, currentName: string) {
    const name = prompt("Rename building to:", currentName);
    if (!name || !name.trim()) return;
    startTransition(async () => {
      try {
        await updateBuilding(id, name.trim());
      } catch (e) {
        alert(e instanceof Error ? e.message : "Failed to rename");
      }
    });
  }

  async function handleDeleteBuilding(id: string, name: string) {
    if (!confirm(`Delete building "${name}"? Its floors/locations must be removed first.`))
      return;
    startTransition(async () => {
      try {
        await deleteBuilding(id);
      } catch (e) {
        alert(
          e instanceof Error
            ? `Couldn't delete: ${e.message}`
            : "Couldn't delete this building."
        );
      }
    });
  }

  async function handleRenameFloor(id: string, currentLabel: string) {
    const label = prompt("Rename floor to:", currentLabel);
    if (!label || !label.trim()) return;
    startTransition(async () => {
      try {
        await updateFloor(id, label.trim());
      } catch (e) {
        alert(e instanceof Error ? e.message : "Failed to rename");
      }
    });
  }

  async function handleDeleteFloor(id: string, label: string) {
    if (!confirm(`Delete floor "${label}"? Its locations must be removed first.`)) return;
    startTransition(async () => {
      try {
        await deleteFloor(id);
      } catch (e) {
        alert(
          e instanceof Error ? `Couldn't delete: ${e.message}` : "Couldn't delete this floor."
        );
      }
    });
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
        <h2 className="mb-3 text-lg font-semibold">Buildings</h2>
        <ul className="mb-3 flex flex-col gap-2 text-sm">
          {buildings.map((b) => (
            <li
              key={b.id}
              className="flex items-center justify-between rounded-md bg-neutral-100 px-3 py-2"
            >
              <span>{b.name}</span>
              <span className="flex gap-3 text-xs">
                <button className="underline" onClick={() => handleRenameBuilding(b.id, b.name)}>
                  Rename
                </button>
                <button
                  className="text-red-600 underline"
                  onClick={() => handleDeleteBuilding(b.id, b.name)}
                >
                  Delete
                </button>
              </span>
            </li>
          ))}
          {buildings.length === 0 && (
            <li className="text-neutral-500">No buildings yet.</li>
          )}
        </ul>
        <form action={createBuilding} className="flex gap-2">
          <input
            name="name"
            placeholder="New building name"
            required
            className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm"
          />
          <button className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm text-white">
            Add building
          </button>
        </form>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Floors</h2>
        <ul className="mb-3 flex flex-col gap-2 text-sm">
          {floors.map((f) => (
            <li
              key={f.id}
              className="flex items-center justify-between rounded-md bg-neutral-100 px-3 py-2"
            >
              <span>
                {f.label}{" "}
                <span className="text-neutral-500">({buildingName(f.building_id)})</span>
              </span>
              <span className="flex gap-3 text-xs">
                <button className="underline" onClick={() => handleRenameFloor(f.id, f.label)}>
                  Rename
                </button>
                <button
                  className="text-red-600 underline"
                  onClick={() => handleDeleteFloor(f.id, f.label)}
                >
                  Delete
                </button>
              </span>
            </li>
          ))}
          {floors.length === 0 && <li className="text-neutral-500">No floors yet.</li>}
        </ul>
        <form action={createFloor} className="flex flex-wrap gap-2">
          <select
            name="building_id"
            required
            className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm"
          >
            <option value="">Building…</option>
            {buildings.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
          <input
            name="label"
            placeholder="e.g. Ground Floor"
            required
            className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm"
          />
          <button className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm text-white">
            Add floor
          </button>
        </form>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Add QR Location</h2>
        <form action={createLocation} className="flex flex-wrap gap-2">
          <select
            name="building_id"
            required
            value={newLocBuilding}
            onChange={(e) => setNewLocBuilding(e.target.value)}
            className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm"
          >
            <option value="">Building…</option>
            {buildings.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
          <select
            name="floor_id"
            className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm"
          >
            <option value="">Floor…</option>
            {floorsForBuilding.map((f) => (
              <option key={f.id} value={f.id}>{f.label}</option>
            ))}
          </select>
          <select
            name="location_type"
            className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm"
          >
            {LOCATION_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <input
            name="name"
            placeholder="Location name"
            required
            className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm"
          />
          <input
            name="location_code"
            placeholder="Code (optional)"
            className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm"
          />
          <button className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm text-white">
            Add location
          </button>
        </form>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Locations & QR codes</h2>
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
                <th className="p-2">Building / Floor</th>
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
                  <td className="p-2 text-neutral-600">
                    {buildingName(loc.building_id)} / {floorLabel(loc.floor_id)}
                  </td>
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
