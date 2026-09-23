"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { ButtonSpinner } from "@/app/components/Spinner";
import {
  ChevronRight,
  ChevronDown,
  MapPin,
  QrCode,
  Search,
  Plus,
  Pencil,
  ArrowRightLeft,
  Archive,
  ArchiveRestore,
  Trash2,
  Download,
  Printer,
  X,
} from "lucide-react";
import {
  createLocation,
  updateLocation,
  assignQr,
  removeQr,
  regenerateQr,
  moveLocation,
  archiveLocation,
  unarchiveLocation,
  deleteLocation,
} from "./actions";

type Loc = {
  id: string;
  parent_id: string | null;
  name: string;
  description: string | null;
  location_code: string | null;
  qr_token: string | null;
  active: boolean;
  archived: boolean;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

export default function LocationExplorer({
  orgName,
  locations,
  complaintCounts,
}: {
  orgName: string;
  locations: Loc[];
  complaintCounts: Record<string, number>;
}) {
  const [pending, startTransition] = useTransition();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(locations.filter((l) => l.parent_id === null).map((l) => l.id))
  );
  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [addModal, setAddModal] = useState<{ parentId: string | null } | null>(null);
  const [moveModal, setMoveModal] = useState<Loc | null>(null);
  const [editModal, setEditModal] = useState<Loc | null>(null);

  const byId = useMemo(() => new Map(locations.map((l) => [l.id, l])), [locations]);
  const childrenOf = (parentId: string | null) =>
    locations
      .filter((l) => l.parent_id === parentId && (showArchived || !l.archived))
      .sort((a, b) => a.name.localeCompare(b.name));

  const ancestorsOf = (id: string): string[] => {
    const chain: string[] = [];
    let cur = byId.get(id);
    while (cur?.parent_id) {
      chain.push(cur.parent_id);
      cur = byId.get(cur.parent_id);
    }
    return chain;
  };

  const searchMatches = useMemo(() => {
    if (!search.trim()) return null;
    const q = search.toLowerCase();
    return new Set(locations.filter((l) => l.name.toLowerCase().includes(q)).map((l) => l.id));
  }, [search, locations]);

  const forceExpanded = useMemo(() => {
    if (!searchMatches) return null;
    const set = new Set<string>();
    for (const id of searchMatches) ancestorsOf(id).forEach((a) => set.add(a));
    return set;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchMatches]);

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function run(fn: () => Promise<{ error?: string }>, onOk?: () => void) {
    startTransition(async () => {
      const res = await fn();
      if (res.error) alert(res.error);
      else onOk?.();
    });
  }

  const selected = selectedId ? byId.get(selectedId) ?? null : null;
  const childCount = selected ? locations.filter((l) => l.parent_id === selected.id).length : 0;
  const activeChildCount = selected
    ? locations.filter((l) => l.parent_id === selected.id && !l.archived).length
    : 0;
  const complaintCount = selected ? complaintCounts[selected.id] ?? 0 : 0;

  function breadcrumb(id: string): Loc[] {
    const chain: Loc[] = [];
    let cur = byId.get(id);
    while (cur) {
      chain.unshift(cur);
      cur = cur.parent_id ? byId.get(cur.parent_id) : undefined;
    }
    return chain;
  }
  function pathOf(id: string): string {
    return breadcrumb(id)
      .map((l) => l.name)
      .join(" / ");
  }

  const total = locations.filter((l) => !l.archived).length;
  const withQr = locations.filter((l) => !l.archived && l.qr_token).length;
  const withoutQr = total - withQr;
  const archivedCount = locations.filter((l) => l.archived).length;

  // Eligible "move to" targets: not self, not a descendant of self, not QR-assigned.
  function isDescendant(candidateId: string, ofId: string): boolean {
    let cur = byId.get(candidateId);
    while (cur?.parent_id) {
      if (cur.parent_id === ofId) return true;
      cur = byId.get(cur.parent_id);
    }
    return false;
  }
  function moveTargets(loc: Loc) {
    return locations.filter(
      (l) => !l.archived && l.id !== loc.id && !l.qr_token && !isDescendant(l.id, loc.id)
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">Locations</h1>
          <p className="text-sm text-neutral-500">
            Manage your organisation's structure, assign QR codes, and organise easily.
          </p>
        </div>
        <Link
          href="/admin/locations/qr-sheet"
          className="flex shrink-0 items-center gap-1.5 rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
        >
          <QrCode size={15} /> Bulk QR
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryCard label="Total Locations" value={total} />
        <SummaryCard label="QR Assigned" value={withQr} tone="green" />
        <SummaryCard label="Without QR" value={withoutQr} tone="gray" />
        <SummaryCard label="Archived" value={archivedCount} tone="amber" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[340px_1fr]">
        {/* Tree */}
        <div className="rounded-xl border border-neutral-200 bg-white shadow-sm">
          <div className="border-b border-neutral-100 p-3">
            <div className="relative">
              <Search size={15} className="absolute left-2.5 top-2.5 text-neutral-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search locations…"
                className="w-full rounded-md border border-neutral-300 py-1.5 pl-8 pr-2 text-sm"
              />
            </div>
            <button
              onClick={() => setAddModal({ parentId: null })}
              className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              <Plus size={15} /> Add Location
            </button>
            <label className="mt-2 flex items-center gap-1.5 text-xs text-neutral-500">
              <input
                type="checkbox"
                checked={showArchived}
                onChange={(e) => setShowArchived(e.target.checked)}
              />
              Show archived
            </label>
          </div>
          <div className="max-h-[560px] overflow-y-auto p-2">
            <div className="mb-1 flex items-center gap-1.5 px-1 py-1 text-sm font-semibold text-neutral-700">
              <MapPin size={14} /> {orgName}
            </div>
            {childrenOf(null).length === 0 && (
              <p className="px-2 py-3 text-xs text-neutral-400">
                No locations yet — add your first one above.
              </p>
            )}
            {childrenOf(null).map((loc) => (
              <TreeRow
                key={loc.id}
                loc={loc}
                depth={1}
                childrenOf={childrenOf}
                expanded={forceExpanded ? forceExpanded.has(loc.id) || expanded.has(loc.id) : expanded.has(loc.id)}
                allExpanded={forceExpanded}
                expandedSet={expanded}
                toggle={toggle}
                selectedId={selectedId}
                setSelectedId={setSelectedId}
                highlight={searchMatches}
              />
            ))}
          </div>
        </div>

        {/* Details */}
        <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
          {!selected ? (
            <div className="flex h-full min-h-[300px] flex-col items-center justify-center text-center text-neutral-400">
              <MapPin size={32} className="mb-2" />
              <p className="text-sm">Select a location to view its details,</p>
              <p className="text-sm">or add a new one to get started.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-5">
              <div>
                <div className="mb-1 flex flex-wrap items-center gap-1 text-xs text-neutral-400">
                  {breadcrumb(selected.id).map((b, i, arr) => (
                    <span key={b.id} className="flex items-center gap-1">
                      {b.name}
                      {i < arr.length - 1 && <ChevronRight size={11} />}
                    </span>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold text-neutral-900">{selected.name}</h2>
                  {selected.archived ? (
                    <Badge tone="amber">Archived</Badge>
                  ) : selected.qr_token ? (
                    <Badge tone="green">QR Assigned</Badge>
                  ) : (
                    <Badge tone="gray">No QR</Badge>
                  )}
                </div>
                {selected.description && (
                  <p className="mt-1 text-sm text-neutral-600">{selected.description}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                <Field label="Sub-locations" value={String(activeChildCount)} />
                <Field label="Complaints" value={String(complaintCount)} />
                <Field
                  label="Created"
                  value={new Date(selected.created_at).toLocaleDateString()}
                />
              </div>

              {selected.qr_token && !selected.archived && (
                <QrPanel
                  loc={selected}
                  pending={pending}
                  onRemove={() => run(() => removeQr(selected.id))}
                  onRegenerate={() => run(() => regenerateQr(selected.id))}
                />
              )}

              <div className="flex flex-wrap gap-2 border-t border-neutral-100 pt-4">
                <ActionButton onClick={() => setEditModal(selected)} icon={<Pencil size={14} />}>
                  Edit
                </ActionButton>

                {!selected.archived && !selected.qr_token && (
                  <ActionButton
                    onClick={() => setAddModal({ parentId: selected.id })}
                    icon={<Plus size={14} />}
                    primary
                  >
                    Add Location
                  </ActionButton>
                )}

                {!selected.archived && !selected.qr_token && activeChildCount === 0 && (
                  <ActionButton
                    onClick={() => run(() => assignQr(selected.id))}
                    icon={<QrCode size={14} />}
                    loading={pending}
                  >
                    Assign QR
                  </ActionButton>
                )}

                {!selected.archived && (
                  <ActionButton
                    onClick={() => setMoveModal(selected)}
                    icon={<ArrowRightLeft size={14} />}
                  >
                    Move
                  </ActionButton>
                )}

                {!selected.archived ? (
                  <ActionButton
                    onClick={() => run(() => archiveLocation(selected.id))}
                    icon={<Archive size={14} />}
                    loading={pending}
                  >
                    Archive
                  </ActionButton>
                ) : (
                  <ActionButton
                    onClick={() => run(() => unarchiveLocation(selected.id))}
                    icon={<ArchiveRestore size={14} />}
                    loading={pending}
                  >
                    Unarchive
                  </ActionButton>
                )}

                <ActionButton
                  onClick={() => {
                    if (
                      confirm(
                        `Delete "${selected.name}"? This can't be undone. It will be blocked if it has sub-locations or complaint history.`
                      )
                    ) {
                      run(() => deleteLocation(selected.id), () => setSelectedId(null));
                    }
                  }}
                  icon={<Trash2 size={14} />}
                  danger
                  loading={pending}
                >
                  Delete
                </ActionButton>
              </div>

              {!selected.archived && selected.qr_token && (
                <p className="rounded-md bg-blue-50 px-3 py-2 text-xs text-blue-700">
                  This location has a QR assigned, so it&apos;s a final reportable location. Remove
                  the QR to add sub-locations.
                </p>
              )}
              {!selected.archived && !selected.qr_token && activeChildCount > 0 && (
                <p className="rounded-md bg-neutral-50 px-3 py-2 text-xs text-neutral-500">
                  This location has sub-locations, so it can&apos;t take a QR directly. Assign QR
                  codes to its sub-locations instead.
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {addModal && (
        <AddLocationModal
          parentName={addModal.parentId ? byId.get(addModal.parentId)?.name ?? null : orgName}
          pending={pending}
          onCancel={() => setAddModal(null)}
          onSubmit={(name, description) => {
            run(
              () => createLocation(addModal.parentId, name, description),
              () => {
                if (addModal.parentId) {
                  setExpanded((prev) => new Set(prev).add(addModal.parentId!));
                }
                setAddModal(null);
              }
            );
          }}
        />
      )}

      {editModal && (
        <EditLocationModal
          loc={editModal}
          pending={pending}
          onCancel={() => setEditModal(null)}
          onSubmit={(name, description) => {
            run(() => updateLocation(editModal.id, name, description), () => setEditModal(null));
          }}
        />
      )}

      {moveModal && (
        <MoveLocationModal
          loc={moveModal}
          currentPath={pathOf(moveModal.id)}
          targets={moveTargets(moveModal).map((t) => ({ id: t.id, path: pathOf(t.id) })).sort((a, b) => a.path.localeCompare(b.path))}
          orgName={orgName}
          pending={pending}
          onCancel={() => setMoveModal(null)}
          onSubmit={(newParentId) => {
            run(() => moveLocation(moveModal.id, newParentId), () => setMoveModal(null));
          }}
        />
      )}
    </div>
  );
}

function TreeRow({
  loc,
  depth,
  childrenOf,
  expanded,
  expandedSet,
  toggle,
  selectedId,
  setSelectedId,
  highlight,
}: {
  loc: Loc;
  depth: number;
  childrenOf: (parentId: string | null) => Loc[];
  expanded: boolean;
  allExpanded: Set<string> | null;
  expandedSet: Set<string>;
  toggle: (id: string) => void;
  selectedId: string | null;
  setSelectedId: (id: string) => void;
  highlight: Set<string> | null;
}) {
  const children = childrenOf(loc.id);
  const isSelected = selectedId === loc.id;
  const isMatch = highlight ? highlight.has(loc.id) : false;

  return (
    <div>
      <button
        onClick={() => setSelectedId(loc.id)}
        style={{ paddingLeft: 4 + depth * 16 }}
        className={`flex w-full items-center gap-1.5 rounded-md py-1.5 pr-2 text-left text-sm ${
          isSelected ? "bg-blue-50 text-blue-800" : "hover:bg-neutral-50 text-neutral-700"
        } ${highlight && !isMatch ? "opacity-40" : ""} ${loc.archived ? "italic text-neutral-400" : ""}`}
      >
        <span
          onClick={(e) => {
            e.stopPropagation();
            if (children.length > 0) toggle(loc.id);
          }}
          className="flex h-4 w-4 shrink-0 items-center justify-center text-neutral-400"
        >
          {children.length > 0 ? (
            expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />
          ) : null}
        </span>
        <span className="truncate">{loc.name}</span>
        {loc.qr_token && !loc.archived && (
          <span className="ml-auto h-2 w-2 shrink-0 rounded-full bg-green-500" title="QR assigned" />
        )}
      </button>
      {expanded &&
        children.map((c) => (
          <TreeRow
            key={c.id}
            loc={c}
            depth={depth + 1}
            childrenOf={childrenOf}
            expanded={expandedSet.has(c.id) || (highlight != null && highlight.has(c.id))}
            allExpanded={null}
            expandedSet={expandedSet}
            toggle={toggle}
            selectedId={selectedId}
            setSelectedId={setSelectedId}
            highlight={highlight}
          />
        ))}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  tone = "blue",
}: {
  label: string;
  value: number;
  tone?: "blue" | "green" | "gray" | "amber";
}) {
  const toneMap = {
    blue: "text-blue-600",
    green: "text-green-600",
    gray: "text-neutral-500",
    amber: "text-amber-600",
  };
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-3 shadow-sm">
      <div className={`text-2xl font-semibold ${toneMap[tone]}`}>{value}</div>
      <div className="text-xs text-neutral-500">{label}</div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-neutral-400">{label}</div>
      <div className="font-medium text-neutral-800">{value}</div>
    </div>
  );
}

function Badge({ children, tone }: { children: React.ReactNode; tone: "green" | "gray" | "amber" }) {
  const map = {
    green: "bg-green-100 text-green-700",
    gray: "bg-neutral-100 text-neutral-600",
    amber: "bg-amber-100 text-amber-700",
  };
  return <span className={`rounded-full px-2 py-0.5 text-xs ${map[tone]}`}>{children}</span>;
}

function ActionButton({
  children,
  icon,
  onClick,
  primary,
  danger,
  loading,
}: {
  children: React.ReactNode;
  icon: React.ReactNode;
  onClick: () => void;
  primary?: boolean;
  danger?: boolean;
  loading?: boolean;
}) {
  const cls = primary
    ? "bg-blue-600 text-white hover:bg-blue-700"
    : danger
    ? "border border-red-200 text-red-600 hover:bg-red-50"
    : "border border-neutral-200 text-neutral-700 hover:bg-neutral-50";
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium disabled:opacity-60 ${cls}`}
    >
      {loading ? <ButtonSpinner className={primary ? "" : "border-neutral-300 border-t-neutral-600"} /> : icon}
      {children}
    </button>
  );
}

function QrPanel({
  loc,
  pending,
  onRemove,
  onRegenerate,
}: {
  loc: Loc;
  pending: boolean;
  onRemove: () => void;
  onRegenerate: () => void;
}) {
  const [origin, setOrigin] = useState("");
  useState(() => {
    if (typeof window !== "undefined") setOrigin(window.location.origin);
  });
  const scanUrl = `${origin}/report/${loc.qr_token}`;
  const imgSrc = `/api/qr-image?token=${loc.qr_token}`;

  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-neutral-200 bg-neutral-50 p-4 sm:flex-row sm:items-start">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={imgSrc} alt="QR code" className="h-36 w-36 rounded-md bg-white p-2" />
      <div className="flex-1 text-sm">
        <div className="font-mono text-xs text-neutral-500">{loc.location_code}</div>
        <a href={scanUrl} target="_blank" className="text-blue-600 hover:underline">
          {scanUrl}
        </a>
        <div className="mt-3 flex flex-wrap gap-2">
          <a
            href={imgSrc}
            download={`${loc.location_code ?? "qr"}.png`}
            className="flex items-center gap-1 rounded-md border border-neutral-300 bg-white px-2.5 py-1 text-xs"
          >
            <Download size={12} /> Download
          </a>
          <button
            onClick={() => window.open(imgSrc, "_blank")?.print()}
            className="flex items-center gap-1 rounded-md border border-neutral-300 bg-white px-2.5 py-1 text-xs"
          >
            <Printer size={12} /> Print
          </button>
          <button
            disabled={pending}
            onClick={onRegenerate}
            className="rounded-md border border-neutral-300 bg-white px-2.5 py-1 text-xs disabled:opacity-40"
          >
            Regenerate
          </button>
          <button
            disabled={pending}
            onClick={onRemove}
            className="rounded-md border border-red-200 bg-white px-2.5 py-1 text-xs text-red-600 disabled:opacity-40"
          >
            Remove QR
          </button>
        </div>
      </div>
    </div>
  );
}

function ModalShell({
  title,
  onCancel,
  children,
}: {
  title: string;
  onCancel: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold">{title}</h3>
          <button onClick={onCancel} className="text-neutral-400 hover:text-neutral-700">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function AddLocationModal({
  parentName,
  pending,
  onCancel,
  onSubmit,
}: {
  parentName: string | null;
  pending: boolean;
  onCancel: () => void;
  onSubmit: (name: string, description: string) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  return (
    <ModalShell title="Add New Location" onCancel={onCancel}>
      <p className="mb-3 text-xs text-neutral-500">
        Inside: <span className="font-medium text-neutral-700">{parentName}</span>
      </p>
      <label className="mb-3 flex flex-col gap-1 text-sm">
        Location Name *
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded-md border border-neutral-300 px-2.5 py-1.5"
        />
      </label>
      <label className="mb-4 flex flex-col gap-1 text-sm">
        Description (optional)
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="rounded-md border border-neutral-300 px-2.5 py-1.5"
        />
      </label>
      <div className="flex justify-end gap-2">
        <button onClick={onCancel} className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm">
          Cancel
        </button>
        <button
          disabled={pending || !name.trim()}
          onClick={() => onSubmit(name, description)}
          className="rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white disabled:opacity-40"
        >
          Add Location
        </button>
      </div>
    </ModalShell>
  );
}

function EditLocationModal({
  loc,
  pending,
  onCancel,
  onSubmit,
}: {
  loc: Loc;
  pending: boolean;
  onCancel: () => void;
  onSubmit: (name: string, description: string) => void;
}) {
  const [name, setName] = useState(loc.name);
  const [description, setDescription] = useState(loc.description ?? "");
  return (
    <ModalShell title="Edit Location" onCancel={onCancel}>
      <label className="mb-3 flex flex-col gap-1 text-sm">
        Location Name *
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded-md border border-neutral-300 px-2.5 py-1.5"
        />
      </label>
      <label className="mb-4 flex flex-col gap-1 text-sm">
        Description (optional)
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="rounded-md border border-neutral-300 px-2.5 py-1.5"
        />
      </label>
      <div className="flex justify-end gap-2">
        <button onClick={onCancel} className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm">
          Cancel
        </button>
        <button
          disabled={pending || !name.trim()}
          onClick={() => onSubmit(name, description)}
          className="rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white disabled:opacity-40"
        >
          Save
        </button>
      </div>
    </ModalShell>
  );
}

function MoveLocationModal({
  loc,
  currentPath,
  targets,
  orgName,
  pending,
  onCancel,
  onSubmit,
}: {
  loc: Loc;
  currentPath: string;
  targets: { id: string; path: string }[];
  orgName: string;
  pending: boolean;
  onCancel: () => void;
  onSubmit: (newParentId: string | null) => void;
}) {
  const [target, setTarget] = useState<string>("__root__");
  return (
    <ModalShell title={`Move "${loc.name}"`} onCancel={onCancel}>
      <p className="mb-3 text-xs text-neutral-500">
        Currently at: <span className="font-medium text-neutral-700">{currentPath}</span>
      </p>
      <label className="mb-4 flex flex-col gap-1 text-sm">
        New parent location
        <select
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          className="rounded-md border border-neutral-300 px-2.5 py-1.5"
        >
          <option value="__root__">{orgName} (top level)</option>
          {targets.map((t) => (
            <option key={t.id} value={t.id}>
              {t.path}
            </option>
          ))}
        </select>
      </label>
      <div className="flex justify-end gap-2">
        <button onClick={onCancel} className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm">
          Cancel
        </button>
        <button
          disabled={pending}
          onClick={() => onSubmit(target === "__root__" ? null : target)}
          className="rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white disabled:opacity-40"
        >
          Move
        </button>
      </div>
    </ModalShell>
  );
}
