import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();
const guarded = [
  "packages/runtime",
  "packages/session",
  "packages/tools",
  "packages/config",
];
const forbidden = [
  /from\s+["'](?:\.\.\/)*apps\/tui/u,
  /from\s+["']@opentui\//u,
  /from\s+["']solid-js/u,
  /from\s+["'](?:react|preact|vue|svelte)["']/u,
  /document\.|window\.|HTMLElement/u,
];

const failures: string[] = [];
for (const dir of guarded) await scan(join(root, dir));

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("import guard passed");

async function scan(path: string): Promise<void> {
  const entries = await readdir(path, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(path, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "dist") continue;
      await scan(full);
      continue;
    }
    if (!/\.(ts|tsx)$/u.test(entry.name)) continue;
    const text = await readFile(full, "utf8");
    for (const pattern of forbidden) {
      if (pattern.test(text))
        failures.push(`${full}: forbidden dependency ${pattern}`);
    }
  }
}
