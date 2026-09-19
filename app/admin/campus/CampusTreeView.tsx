"use client";

type NodeType = { id: string; name: string };
type Node = { id: string; parent_id: string | null; node_type_id: string; name: string };
type Location = { id: string; node_id: string | null; qr_token: string; active: boolean };

export default function CampusTreeView({
  nodeTypes,
  nodes,
  locations,
}: {
  nodeTypes: NodeType[];
  nodes: Node[];
  locations: Location[];
}) {
  const typeName = (id: string) => nodeTypes.find((t) => t.id === id)?.name ?? "";
  const childrenOf = (parentId: string | null) => nodes.filter((n) => n.parent_id === parentId);
  const locationOf = (nodeId: string) => locations.find((l) => l.node_id === nodeId);
  const roots = childrenOf(null);

  if (roots.length === 0) {
    return (
      <p className="rounded-md border border-neutral-200 p-4 text-sm text-neutral-500">
        Nothing built yet — go to Locations &amp; QR to set up your campus structure.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border border-neutral-800 bg-neutral-950 p-4 font-mono text-sm leading-7 text-neutral-200">
      {roots.map((node, i) => (
        <Branch
          key={node.id}
          node={node}
          prefix=""
          isLast={i === roots.length - 1}
          childrenOf={childrenOf}
          typeName={typeName}
          locationOf={locationOf}
        />
      ))}
    </div>
  );
}

function Branch({
  node,
  prefix,
  isLast,
  childrenOf,
  typeName,
  locationOf,
}: {
  node: Node;
  prefix: string;
  isLast: boolean;
  childrenOf: (parentId: string | null) => Node[];
  typeName: (id: string) => string;
  locationOf: (nodeId: string) => Location | undefined;
}) {
  const children = childrenOf(node.id);
  const loc = locationOf(node.id);
  const connector = prefix === "" ? "" : isLast ? "└── " : "├── ";
  const childPrefix = prefix + (prefix === "" ? "" : isLast ? "    " : "│   ");

  return (
    <div>
      <div className="whitespace-pre">
        {prefix}
        {connector}
        {node.name} <span className="text-neutral-500">({typeName(node.node_type_id)})</span>
        {loc && (
          <span className={loc.active ? "ml-2 text-green-400" : "ml-2 text-red-400"}>
            {loc.active ? "● QR active" : "○ QR inactive"}
          </span>
        )}
      </div>
      {children.map((child, i) => (
        <Branch
          key={child.id}
          node={child}
          prefix={childPrefix}
          isLast={i === children.length - 1}
          childrenOf={childrenOf}
          typeName={typeName}
          locationOf={locationOf}
        />
      ))}
    </div>
  );
}
