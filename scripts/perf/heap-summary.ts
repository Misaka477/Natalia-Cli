import { readFile } from "node:fs/promises";

const path = process.argv[2];
if (!path) throw new Error("expected heapsnapshot path");
const snapshot = JSON.parse(await readFile(path, "utf8")) as {
  snapshot: {
    meta: { node_fields: string[]; node_types: Array<string[] | string> };
  };
  nodes: number[];
  strings: string[];
};
const fields = snapshot.snapshot.meta.node_fields;
const nameOffset = fields.indexOf("name");
const selfSizeOffset = fields.indexOf("self_size");
const fieldCount = fields.length;
const totals = new Map<string, { count: number; selfSize: number }>();
for (let offset = 0; offset < snapshot.nodes.length; offset += fieldCount) {
  const name =
    snapshot.strings[snapshot.nodes[offset + nameOffset] ?? 0] ?? "(unknown)";
  const selfSize = snapshot.nodes[offset + selfSizeOffset] ?? 0;
  const current = totals.get(name) ?? { count: 0, selfSize: 0 };
  current.count++;
  current.selfSize += selfSize;
  totals.set(name, current);
}
console.log(
  JSON.stringify(
    [...totals.entries()]
      .map(([name, value]) => ({ name, ...value }))
      .sort((left, right) => right.selfSize - left.selfSize)
      .slice(0, 30),
  ),
);
