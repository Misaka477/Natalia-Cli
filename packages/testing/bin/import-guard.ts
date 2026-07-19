import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();
const dependencyGuarded = [
  "packages/runtime",
  "packages/session",
  "packages/tools",
  "packages/config",
];
const productionRoots = ["apps", "packages", "cmd", "internal", "scripts"];
const sourceExtensions = /\.(ts|tsx|js|jsx|go|json|toml|ya?ml)$/u;
const skippedDirs = new Set([
  ".git",
  ".turbo",
  "coverage",
  "dist",
  "node_modules",
]);

const forbiddenDependencies = [
  /from\s+["'](?:\.\.\/)*apps\/tui/u,
  /from\s+["']@opentui\//u,
  /from\s+["']solid-js/u,
  /from\s+["'](?:react|preact|vue|svelte)["']/u,
  /document\.|window\.|HTMLElement/u,
];
const forbiddenTraceNames = [new RegExp("open" + "code", "iu")];
const forbiddenAccountFlowNames = [
  new RegExp(
    `\\b(?:${"log" + "in"}|${"log" + "out"}|${"sign" + "In"}|${"sign" + "Out"}|${"sign" + "Up"}|${"oa" + "uth"}|${"oi" + "dc"})\\b`,
    "iu",
  ),
  new RegExp(`\\b${"sign"}[-_\\s]?(?:in|out|up)\\b`, "iu"),
  new RegExp(
    `\\b(?:user|cloud|organization|workspace)\\s+${"acc" + "ount"}\\b`,
    "iu",
  ),
];

const failures: string[] = [];
for (const dir of dependencyGuarded)
  await scan(join(root, dir), sourceExtensions, (full, text) => {
    for (const pattern of forbiddenDependencies) {
      if (pattern.test(text))
        failures.push(`${full}: forbidden dependency ${pattern}`);
    }
  });
for (const dir of productionRoots)
  await scan(join(root, dir), sourceExtensions, (full, text) => {
    for (const pattern of forbiddenTraceNames) {
      if (pattern.test(text))
        failures.push(`${full}: upstream trace name found`);
    }
    for (const pattern of forbiddenAccountFlowNames) {
      if (pattern.test(text))
        failures.push(`${full}: forbidden hosted identity flow ${pattern}`);
    }
  });

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("import guard passed");

async function scan(
  path: string,
  include: RegExp,
  check: (full: string, text: string) => void,
): Promise<void> {
  let entries;
  try {
    entries = await readdir(path, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
    throw error;
  }
  for (const entry of entries) {
    const full = join(path, entry.name);
    if (entry.isDirectory()) {
      if (skippedDirs.has(entry.name)) continue;
      await scan(full, include, check);
      continue;
    }
    if (!include.test(entry.name)) continue;
    const text = await readFile(full, "utf8");
    check(full, text);
  }
}
