"use client";

import { useMemo, useState, useTransition } from "react";
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  DoorOpen,
  QrCode,
  Pencil,
  Trash2,
  FolderPlus,
  Check,
  X,
} from "lucide-react";
import {
  createNodeType,
  createNode,
  renameNode,
  deleteNode,
  createLeafLocation,
} from "./actions";

type NodeType = { id: string; name: string; typical_children: string[] };
type Node = { id: string; parent_id: string | null; node_type_id: string; name: string; sort_order: number };
type Location = {
  id: string;
  node_id: string | null;
  name: string;
  location_code: string | null;
  qr_token: string;
  active: boolean;
};

export default function CampusTree({
  nodeTypes,
  nodes,
  locations,
}: {
  nodeTypes: NodeType[];
  nodes: Node[];
  locations: Location[];
}) {
  const [pending, startTransition] = useTransition();

  function run(fn: () => Promise<{ error?: string }>) {
    startTransition(async () => {
      const res = await fn();
      if (res.error) alert(res.error);
    });
  }

  const childrenOf = (parentId: string | null) => nodes.filter((n) => n.parent_id === parentId);
  const locationOf = (nodeId: string) => locations.find((l) => l.node_id === nodeId);

  const roots = childrenOf(null);

  return (
    <div className="rounded-lg border border-neutral-200 bg-white">
      <div className="border-b border-neutral-100 px-3 py-2">
        <TopLevelAdd nodeTypes={nodeTypes} pending={pending} run={run} />
      </div>
      <div className="p-2">
        {roots.length === 0 && (
          <p className="p-4 text-sm text-neutral-400">
            Nothing here yet — add a Campus, Building or Ground to get started.
          </p>
        )}
        {roots.map((node) => (
          <TreeRow
            key={node.id}
            node={node}
            depth={0}
            nodeTypes={nodeTypes}
            childrenOf={childrenOf}
            locationOf={locationOf}
            pending={pending}
            run={run}
          />
        ))}
      </div>
    </div>
  );
}

function TopLevelAdd({
  nodeTypes,
  pending,
  run,
}: {
  nodeTypes: NodeType[];
  pending: boolean;
  run: (fn: () => Promise<{ error?: string }>) => void;
}) {
  const [open, setOpen] = useState(false);
  return open ? (
    <AddNodeInline
      nodeTypes={nodeTypes}
      suggested={nodeTypes.filter((t) => ["Campus", "Building", "Ground", "Office"].includes(t.name))}
      pending={pending}
      onSubmit={(typeId, name) => {
        run(() => createNode(null, typeId, name));
        setOpen(false);
      }}
      onCancel={() => setOpen(false)}
    />
  ) : (
    <button
      disabled={pending || nodeTypes.length === 0}
      onClick={() => setOpen(true)}
      className="flex items-center gap-1.5 text-xs font-medium text-neutral-600 hover:text-neutral-900 disabled:opacity-40"
    >
      <FolderPlus size={14} /> New top-level (Campus, Ground, Office…)
    </button>
  );
}

function TreeRow({
  node,
  depth,
  nodeTypes,
  childrenOf,
  locationOf,
  pending,
  run,
}: {
  node: Node;
  depth: number;
  nodeTypes: NodeType[];
  childrenOf: (parentId: string | null) => Node[];
  locationOf: (nodeId: string) => Location | undefined;
  pending: boolean;
  run: (fn: () => Promise<{ error?: string }>) => void;
}) {
  const [expanded, setExpanded] = useState(depth < 2);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(node.name);
  const [addingChild, setAddingChild] = useState(false);
  const [addingLocation, setAddingLocation] = useState(false);
  const [locName, setLocName] = useState("");
  const [locCode, setLocCode] = useState("");

  const children = childrenOf(node.id);
  const loc = locationOf(node.id);
  const typeName = nodeTypes.find((t) => t.id === node.node_type_id)?.name ?? "";
  const typeDef = nodeTypes.find((t) => t.id === node.node_type_id);
  const isLeafy = children.length === 0;

  const suggested = useMemo(() => {
    if (!typeDef) return [];
    return nodeTypes.filter((t) => typeDef.typical_children.includes(t.name));
  }, [typeDef, nodeTypes]);

  return (
    <div>
      <div
        className="group flex items-center gap-1.5 rounded-md py-1.5 pr-2 hover:bg-neutral-50"
        style={{ paddingLeft: 8 + depth * 20 }}
      >
        <button
          onClick={() => setExpanded((e) => !e)}
          className="flex h-5 w-5 shrink-0 items-center justify-center text-neutral-400"
        >
          {children.length > 0 ? (
            expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />
          ) : (
            <span className="inline-block h-3.5 w-3.5" />
          )}
        </button>

        {isLeafy && loc ? (
          <DoorOpen size={16} className="shrink-0 text-blue-500" />
        ) : expanded ? (
          <FolderOpen size={16} className="shrink-0 text-amber-500" />
        ) : (
          <Folder size={16} className="shrink-0 text-amber-500" />
        )}

        {editing ? (
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                run(() => renameNode(node.id, name));
                setEditing(false);
              }
            }}
            className="rounded border border-neutral-300 px-1.5 py-0.5 text-sm"
          />
        ) : (
          <span className="text-sm text-neutral-800">{node.name}</span>
        )}

        <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] text-neutral-500">
          {typeName}
        </span>

        {loc && (
          <a
            href={`/report/${loc.qr_token}`}
            target="_blank"
            className="flex items-center gap-1 rounded bg-blue-50 px-1.5 py-0.5 text-[10px] text-blue-700"
          >
            <QrCode size={11} /> QR
          </a>
        )}

        <span className="ml-auto flex items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100">
          {editing ? (
            <button
              onClick={() => {
                run(() => renameNode(node.id, name));
                setEditing(false);
              }}
              className="text-green-600"
              title="Save"
            >
              <Check size={14} />
            </button>
          ) : (
            <button onClick={() => setEditing(true)} className="text-neutral-400 hover:text-neutral-700" title="Rename">
              <Pencil size={13} />
            </button>
          )}
          {isLeafy && !loc && (
            <button
              onClick={() => setAddingLocation((v) => !v)}
              className="text-neutral-400 hover:text-blue-600"
              title="Make reportable (generate QR)"
            >
              <QrCode size={14} />
            </button>
          )}
          <button
            onClick={() => setAddingChild((v) => !v)}
            className="text-neutral-400 hover:text-amber-600"
            title="Add inside"
          >
            <FolderPlus size={14} />
          </button>
          <button
            disabled={pending}
            onClick={() => {
              if (confirm(`Delete "${node.name}"? This also removes everything inside it.`)) {
                run(() => deleteNode(node.id));
              }
            }}
            className="text-neutral-400 hover:text-red-600"
            title="Delete"
          >
            <Trash2 size={13} />
          </button>
        </span>
      </div>

      {addingChild && (
        <div style={{ paddingLeft: 8 + (depth + 1) * 20 }} className="py-1">
          <AddNodeInline
            nodeTypes={nodeTypes}
            suggested={suggested}
            pending={pending}
            onSubmit={(typeId, name) => {
              run(() => createNode(node.id, typeId, name));
              setAddingChild(false);
              setExpanded(true);
            }}
            onCancel={() => setAddingChild(false)}
          />
        </div>
      )}

      {addingLocation && (
        <div style={{ paddingLeft: 8 + (depth + 1) * 20 }} className="flex flex-wrap items-center gap-2 py-1">
          <input
            value={locName}
            onChange={(e) => setLocName(e.target.value)}
            placeholder="Reportable name (e.g. Bench 3, Room 101)"
            className="rounded border border-neutral-300 px-2 py-1 text-xs"
          />
          <input
            value={locCode}
            onChange={(e) => setLocCode(e.target.value)}
            placeholder="Code (optional)"
            className="w-24 rounded border border-neutral-300 px-2 py-1 text-xs"
          />
          <button
            disabled={pending || !locName.trim()}
            onClick={() => {
              run(() => createLeafLocation(node.id, locName, locCode));
              setAddingLocation(false);
              setLocName("");
              setLocCode("");
            }}
            className="rounded bg-neutral-900 px-2.5 py-1 text-xs text-white disabled:opacity-40"
          >
            Generate QR
          </button>
          <button onClick={() => setAddingLocation(false)} className="text-xs text-neutral-500">
            Cancel
          </button>
        </div>
      )}

      {expanded &&
        children.map((child) => (
          <TreeRow
            key={child.id}
            node={child}
            depth={depth + 1}
            nodeTypes={nodeTypes}
            childrenOf={childrenOf}
            locationOf={locationOf}
            pending={pending}
            run={run}
          />
        ))}
    </div>
  );
}

function AddNodeInline({
  nodeTypes,
  suggested,
  pending,
  onSubmit,
  onCancel,
}: {
  nodeTypes: NodeType[];
  suggested: NodeType[];
  pending: boolean;
  onSubmit: (typeId: string, name: string) => void;
  onCancel: () => void;
}) {
  const [showAll, setShowAll] = useState(suggested.length === 0);
  const [typeId, setTypeId] = useState(suggested[0]?.id ?? nodeTypes[0]?.id ?? "");
  const [name, setName] = useState("");
  const [newTypeMode, setNewTypeMode] = useState(false);
  const [newTypeName, setNewTypeName] = useState("");
  const [creatingType, startCreatingType] = useTransition();

  const list = showAll ? nodeTypes : suggested;

  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-md bg-neutral-50 p-1.5">
      {!newTypeMode ? (
        <>
          <select
            value={typeId}
            onChange={(e) => setTypeId(e.target.value)}
            className="rounded border border-neutral-300 px-1.5 py-1 text-xs"
          >
            {list.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          {suggested.length > 0 && (
            <button
              onClick={() => setShowAll((v) => !v)}
              className="text-[10px] text-neutral-500 underline"
            >
              {showAll ? "suggested only" : "show all types"}
            </button>
          )}
          <button
            onClick={() => setNewTypeMode(true)}
            className="text-[10px] text-neutral-500 underline"
          >
            + new type
          </button>
        </>
      ) : (
        <>
          <input
            autoFocus
            value={newTypeName}
            onChange={(e) => setNewTypeName(e.target.value)}
            placeholder="New type name"
            className="rounded border border-neutral-300 px-1.5 py-1 text-xs"
          />
          <button
            disabled={creatingType || !newTypeName.trim()}
            onClick={() => {
              const n = newTypeName;
              startCreatingType(async () => {
                await createNodeType(n);
                setNewTypeMode(false);
                setNewTypeName("");
              });
            }}
            className="rounded bg-neutral-900 px-2 py-1 text-[10px] text-white"
          >
            Add
          </button>
          <button onClick={() => setNewTypeMode(false)} className="text-[10px] text-neutral-500">
            <X size={12} />
          </button>
        </>
      )}

      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Name"
        className="rounded border border-neutral-300 px-2 py-1 text-xs"
      />
      <button
        disabled={pending || !name.trim() || !typeId}
        onClick={() => onSubmit(typeId, name)}
        className="rounded bg-neutral-900 px-2.5 py-1 text-xs text-white disabled:opacity-40"
      >
        Add
      </button>
      <button onClick={onCancel} className="text-xs text-neutral-500">
        Cancel
      </button>
    </div>
  );
}
