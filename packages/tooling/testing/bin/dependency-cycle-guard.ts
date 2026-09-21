/**
 * Dependency-cycle guard (audit finding A-02 / completion criterion §11).
 *
 * §11 requires "没有生产依赖环" — the production dependency graph of the
 * workspace must be acyclic. That used to be a one-off manual walk over the
 * package.json files; this guard makes it mechanical so a regression fails the
 * gate instead of quietly re-tangling the kernel / framework / plugin layers.
 *
 * It reads every workspace `package.json` under `packages/` and `apps/` (build
 * output under `dist/` is skipped), keeps only edges whose target is another
 * workspace package, and reports any cycle in the `dependencies` graph.
 *
 * devDependency cycles are reported as advisory, not enforced: §11 scopes the
 * invariant to production, and a test-only package re-exporting a real
 * implementation (e.g. `@natalia/testing` -> a plugin) can legitimately close a
 * loop through a dev edge while the production graph stays acyclic. New
 * production cycles always fail; the advisory line keeps the dev picture
 * visible without pretending it is the enforced invariant.
 */
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();

/** Every `package.json` under a root, recursively, skipping build output. */
async function workspacePackageJsonFiles(rootDir: string): Promise<string[]> {
  const found: string[] = [];
  let entries;
  try {
    entries = await readdir(rootDir, { withFileTypes: true });
  } catch {
    return found;
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name === "node_modules" || entry.name === "dist") continue;
    const full = join(rootDir, entry.name);
    if (await Bun.file(join(full, "package.json")).exists())
      found.push(join(full, "package.json"));
    found.push(...(await workspacePackageJsonFiles(full)));
  }
  return found;
}

type PackageJson = {
  name?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

const files = [
  ...(await workspacePackageJsonFiles(join(root, "packages"))),
  ...(await workspacePackageJsonFiles(join(root, "apps"))),
];

const packages: PackageJson[] = [];
const workspaceNames = new Set<string>();
for (const file of files) {
  const pkg = JSON.parse(await readFile(file, "utf8")) as PackageJson;
  if (!pkg.name) continue;
  packages.push(pkg);
  workspaceNames.add(pkg.name);
}

function buildGraph(useDev: boolean): Map<string, Set<string>> {
  const graph = new Map<string, Set<string>>();
  for (const name of workspaceNames) graph.set(name, new Set());
  for (const pkg of packages) {
    const edges = graph.get(pkg.name!)!;
    for (const dep of Object.keys(pkg.dependencies ?? {}))
      if (workspaceNames.has(dep)) edges.add(dep);
    if (useDev)
      for (const dep of Object.keys(pkg.devDependencies ?? {}))
        if (workspaceNames.has(dep) && !(pkg.dependencies ?? {})[dep])
          edges.add(dep);
  }
  return graph;
}

/** Every distinct cycle, each rendered once as `a -> b -> a`. */
function findCycles(graph: Map<string, Set<string>>): string[][] {
  const cycles: string[][] = [];
  const seen = new Set<string>();
  const stack: string[] = [];
  const onStack = new Set<string>();
  const visited = new Set<string>();
  const short = (name: string) => name.replace("@natalia/", "@");
  const visit = (node: string): void => {
    if (onStack.has(node)) {
      const cycle = stack.slice(stack.indexOf(node)).concat(node);
      const key = [...cycle].sort().join("|");
      if (!seen.has(key)) {
        seen.add(key);
        cycles.push(cycle.map(short));
      }
      return;
    }
    if (visited.has(node)) return;
    visited.add(node);
    stack.push(node);
    onStack.add(node);
    for (const next of graph.get(node) ?? []) visit(next);
    stack.pop();
    onStack.delete(node);
  };
  for (const node of graph.keys()) visit(node);
  return cycles;
}

const productionCycles = findCycles(buildGraph(false));
const devCycles = findCycles(buildGraph(true));

console.log(
  `dependency cycle guard: ${workspaceNames.size} workspace packages`,
);

if (devCycles.length) {
  console.log(
    `advisory (not enforced; §11 is production-only): ${devCycles.length} cycle(s) including devDependencies`,
  );
  for (const cycle of devCycles) console.log(`  dev  ${cycle.join(" -> ")}`);
}

if (productionCycles.length) {
  console.error(
    `production dependency cycles: ${productionCycles.length} (§11 requires an acyclic production graph)`,
  );
  for (const cycle of productionCycles)
    console.error(`  PROD ${cycle.join(" -> ")}`);
  process.exit(1);
}

console.log("production dependency graph is acyclic");
