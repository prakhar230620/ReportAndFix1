"use client";

import { useState, useTransition } from "react";
import {
  createNodeType,
  createNode,
  renameNode,
  deleteNode,
  createLeafLocation,
} from "./actions";

type NodeType = { id: string; name: string };
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
  const [newTypeName, setNewTypeName] = useState("");

  function run(fn: () => Promise<{ error?: string }>) {
    startTransition(async () => {
      const res = await fn();
      if (res.error) alert(res.error);
    });
  }

  const typeName = (id: string) => nodeTypes.find((t) => t.id === id)?.name ?? "";
  const childrenOf = (parentId: string | null) =>
    nodes.filter((n) => n.parent_id === parentId);
  const locationOf = (nodeId: string) => locations.find((l) => l.node_id === nodeId);

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-md border border-neutral-200 p-3">
        <h2 className="mb-2 text-sm font-semibold">Node types</h2>
        <div className="mb-2 flex flex-wrap gap-2">
          {nodeTypes.map((t) => (
            <span
              key={t.id}
              className="rounded-full bg-neutral-100 px-3 py-1 text-xs text-neutral-700"
            >
              {t.name}
            </span>
          ))}
          {nodeTypes.length === 0 && (
            <span className="text-xs text-neutral-500">No types yet — add one below.</span>
          )}
        </div>
        <div className="flex gap-2">
          <input
            value={newTypeName}
            onChange={(e) => setNewTypeName(e.target.value)}
            placeholder="e.g. Library, Lab, Room"
            className="flex-1 rounded-md border border-neutral-300 px-2 py-1 text-sm"
          />
          <button
            disabled={pending || !newTypeName.trim()}
            onClick={() => {
              const name = newTypeName;
              setNewTypeName("");
              run(() => createNodeType(name));
            }}
            className="rounded-md bg-neutral-900 px-3 py-1 text-xs text-white disabled:opacity-40"
          >
            Add type
          </button>
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold">Structure</h2>
        <TreeLevel
          parentId={null}
          nodeTypes={nodeTypes}
          childrenOf={childrenOf}
          typeName={typeName}
          locationOf={locationOf}
          pending={pending}
          run={run}
          depth={0}
        />
      </section>
    </div>
  );
}

function TreeLevel({
  parentId,
  nodeTypes,
  childrenOf,
  typeName,
  locationOf,
  pending,
  run,
  depth,
}: {
  parentId: string | null;
  nodeTypes: NodeType[];
  childrenOf: (parentId: string | null) => Node[];
  typeName: (id: string) => string;
  locationOf: (nodeId: string) => Location | undefined;
  pending: boolean;
  run: (fn: () => Promise<{ error?: string }>) => void;
  depth: number;
}) {
  const items = childrenOf(parentId);
  const [addingTo, setAddingTo] = useState<string | null>(null);

  return (
    <div style={{ marginLeft: depth > 0 ? 16 : 0 }} className="flex flex-col gap-2">
      {items.map((node) => (
        <NodeRow
          key={node.id}
          node={node}
          nodeTypes={nodeTypes}
          childrenOf={childrenOf}
          typeName={typeName}
          locationOf={locationOf}
          pending={pending}
          run={run}
          depth={depth}
        />
      ))}

      {addingTo === parentId ? (
        <AddNodeForm
          nodeTypes={nodeTypes}
          pending={pending}
          onSubmit={(typeId, name) => {
            run(() => createNode(parentId, typeId, name));
            setAddingTo(null);
          }}
          onCancel={() => setAddingTo(null)}
        />
      ) : (
        <button
          disabled={pending || nodeTypes.length === 0}
          onClick={() => setAddingTo(parentId)}
          className="w-fit rounded-md border border-dashed border-neutral-300 px-3 py-1 text-xs text-neutral-600 disabled:opacity-40"
        >
          {parentId === null ? "+ Add top-level node (e.g. Campus)" : "+ Add child"}
        </button>
      )}
    </div>
  );
}

function NodeRow({
  node,
  nodeTypes,
  childrenOf,
  typeName,
  locationOf,
  pending,
  run,
  depth,
}: {
  node: Node;
  nodeTypes: NodeType[];
  childrenOf: (parentId: string | null) => Node[];
  typeName: (id: string) => string;
  locationOf: (nodeId: string) => Location | undefined;
  pending: boolean;
  run: (fn: () => Promise<{ error?: string }>) => void;
  depth: number;
}) {
  const [expanded, setExpanded] = useState(true);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(node.name);
  const [addingLocation, setAddingLocation] = useState(false);
  const [locName, setLocName] = useState("");
  const [locCode, setLocCode] = useState("");

  const hasChildren = childrenOf(node.id).length > 0;
  const loc = locationOf(node.id);

  return (
    <div className="rounded-md border border-neutral-200 p-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {hasChildren && (
            <button onClick={() => setExpanded((e) => !e)} className="text-xs text-neutral-400">
              {expanded ? "▾" : "▸"}
            </button>
          )}
          {editing ? (
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded-md border border-neutral-300 px-2 py-0.5 text-sm"
            />
          ) : (
            <span className="text-sm font-medium">{node.name}</span>
          )}
          <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] text-neutral-500">
            {typeName(node.node_type_id)}
          </span>
          {loc && (
            <a
              href={`/report/${loc.qr_token}`}
              className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] text-blue-700 underline"
              target="_blank"
            >
              QR ready
            </a>
          )}
        </div>
        <div className="flex gap-1">
          {editing ? (
            <button
              disabled={pending}
              onClick={() => {
                run(() => renameNode(node.id, name));
                setEditing(false);
              }}
              className="text-xs text-blue-600"
            >
              Save
            </button>
          ) : (
            <button onClick={() => setEditing(true)} className="text-xs text-neutral-500">
              Rename
            </button>
          )}
          {!loc && !hasChildren && (
            <button
              onClick={() => setAddingLocation((v) => !v)}
              className="text-xs text-neutral-500"
            >
              Make reportable
            </button>
          )}
          <button
            disabled={pending}
            onClick={() => {
              if (confirm(`Delete "${node.name}"? This also removes everything inside it.`)) {
                run(() => deleteNode(node.id));
              }
            }}
            className="text-xs text-red-500"
          >
            Delete
          </button>
        </div>
      </div>

      {addingLocation && (
        <div className="mt-2 flex flex-wrap items-center gap-2 rounded-md bg-neutral-50 p-2">
          <input
            value={locName}
            onChange={(e) => setLocName(e.target.value)}
            placeholder="Location name (e.g. Room 101)"
            className="rounded-md border border-neutral-300 px-2 py-1 text-xs"
          />
          <input
            value={locCode}
            onChange={(e) => setLocCode(e.target.value)}
            placeholder="Code (optional)"
            className="w-28 rounded-md border border-neutral-300 px-2 py-1 text-xs"
          />
          <button
            disabled={pending || !locName.trim()}
            onClick={() => {
              run(() => createLeafLocation(node.id, locName, locCode));
              setAddingLocation(false);
              setLocName("");
              setLocCode("");
            }}
            className="rounded-md bg-neutral-900 px-3 py-1 text-xs text-white disabled:opacity-40"
          >
            Generate QR
          </button>
        </div>
      )}

      {expanded && hasChildren && (
        <div className="mt-2">
          <TreeLevel
            parentId={node.id}
            nodeTypes={nodeTypes}
            childrenOf={childrenOf}
            typeName={typeName}
            locationOf={locationOf}
            pending={pending}
            run={run}
            depth={depth + 1}
          />
        </div>
      )}
      {expanded && !hasChildren && !loc && (
        <div className="mt-2">
          <TreeLevel
            parentId={node.id}
            nodeTypes={nodeTypes}
            childrenOf={childrenOf}
            typeName={typeName}
            locationOf={locationOf}
            pending={pending}
            run={run}
            depth={depth + 1}
          />
        </div>
      )}
    </div>
  );
}

function AddNodeForm({
  nodeTypes,
  pending,
  onSubmit,
  onCancel,
}: {
  nodeTypes: NodeType[];
  pending: boolean;
  onSubmit: (typeId: string, name: string) => void;
  onCancel: () => void;
}) {
  const [typeId, setTypeId] = useState(nodeTypes[0]?.id ?? "");
  const [name, setName] = useState("");

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md bg-neutral-50 p-2">
      <select
        value={typeId}
        onChange={(e) => setTypeId(e.target.value)}
        className="rounded-md border border-neutral-300 px-2 py-1 text-xs"
      >
        {nodeTypes.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Name"
        className="rounded-md border border-neutral-300 px-2 py-1 text-xs"
      />
      <button
        disabled={pending || !name.trim() || !typeId}
        onClick={() => onSubmit(typeId, name)}
        className="rounded-md bg-neutral-900 px-3 py-1 text-xs text-white disabled:opacity-40"
      >
        Add
      </button>
      <button onClick={onCancel} className="text-xs text-neutral-500">
        Cancel
      </button>
    </div>
  );
}
