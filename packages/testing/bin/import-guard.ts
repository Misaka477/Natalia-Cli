import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();
const dependencyGuarded = [
  "packages/runtime",
  "packages/session",
  "packages/tools",
  "packages/config",
  "packages/terminal",
  "packages/sandbox",
  "packages/terminal",
  "packages/mcp",
  "packages/skills",
  "packages/subagent",
  "packages/workflow",
  "packages/plugin",
];
const capabilityRoots = [
  "packages/capabilities",
  "packages/client/src/capabilities",
];
const productionRoots = ["apps", "packages", "cmd", "internal", "scripts"];
/**
 * Packages an externally built UI is allowed to depend on (mainline plan §2.1).
 * They must stay leaf-ward: importing a kernel package here would drag the whole
 * runtime into every consumer and silently make the consumer contract untestable.
 */
const consumerContractRoots = [
  "packages/contracts/src",
  "packages/sdk/src",
  "packages/view-store/src",
  "packages/ui-model/src",
  "packages/capability/src",
];
const kernelPackages = [
  "agent",
  "client",
  "config",
  "mcp",
  "native-terminal",
  "platform",
  "plugin",
  "runtime",
  "sandbox",
  "session",
  "skills",
  "subagent",
  "terminal",
  "testing",
  "tools",
  "transport",
  "workflow",
];
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
  /\bHTMLElement\b/u,
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

const forbiddenConsumerContractImports = kernelPackages.map(
  (name) => new RegExp(`from\\s+["']@natalia/${name}["']`, "u"),
);
/**
 * Subpath entry points a package deliberately declares in its `exports`. They
 * are not deep imports into private internals: the split is the contract. Keep
 * this list in step with the `exports` maps, so an undeclared subpath still
 * fails the deep-import rule below.
 */
const declaredSubpathExports = ["@natalia/transport/host"];
/**
 * Host-side transport (`createRuntimeHttpServer`, `createRuntimeWsServer`, the
 * daemon store/token/spawn) opens sockets, mints bearer tokens and spawns
 * processes. Only whoever runs the runtime may import it. A UI that merely
 * speaks the protocol must not gain the ability to host one.
 */
const transportHostImport = /from\s+["']@natalia\/transport\/host["']/u;
const transportHostAllowedRoots = ["apps/cli", "packages/transport"];
/**
 * Tests legitimately stand up a real server to verify the protocol against it,
 * so the host rule applies to shipped source rather than to test files.
 */
const testPath = /(?:^|\/)test\//u;
/**
 * Deep imports into another package bypass its public index and therefore its
 * contract. `@natalia/<pkg>/...` and `../../packages/<pkg>/...` are both
 * banned for shipped code; `scripts/` is dev tooling and stays out of scope.
 */
const deepImportRoots = ["apps", "packages"];
const forbiddenDeepImports = [
  /from\s+["']@natalia\/[a-z-]+\//u,
  /from\s+["'](?:\.\.\/){2,}packages\//u,
];

const failures: string[] = [];
for (const dir of dependencyGuarded)
  await scan(join(root, dir), sourceExtensions, (full, text) => {
    for (const pattern of forbiddenDependencies) {
      if (pattern.test(text))
        failures.push(`${full}: forbidden dependency ${pattern}`);
    }
  });
for (const dir of capabilityRoots)
  await scan(join(root, dir), sourceExtensions, (full, text) => {
    for (const pattern of [
      /from\s+["']@natalia\/(?:client|runtime|session|tools)["']/u,
      /from\s+["'](?:\.\.\/)+apps\//u,
      /from\s+["']@opentui\//u,
      /from\s+["']solid-js/u,
    ]) {
      if (pattern.test(text))
        failures.push(
          `${full}: capability bypasses kernel or presentation boundary ${pattern}`,
        );
    }
  });
for (const dir of consumerContractRoots)
  await scan(join(root, dir), sourceExtensions, (full, text) => {
    for (const pattern of forbiddenConsumerContractImports) {
      if (pattern.test(text))
        failures.push(
          `${full}: consumer contract package depends on kernel ${pattern}`,
        );
    }
  });
for (const dir of deepImportRoots)
  await scan(join(root, dir), sourceExtensions, (full, text) => {
    const relative = full.slice(root.length + 1);
    if (
      transportHostImport.test(text) &&
      !testPath.test(relative) &&
      !transportHostAllowedRoots.some((allowed) => relative.startsWith(allowed))
    )
      failures.push(
        `${full}: only the runtime host may import @natalia/transport/host`,
      );
    const withoutDeclaredSubpaths = declaredSubpathExports.reduce(
      (acc, subpath) => acc.split(subpath).join("@natalia/declared-subpath"),
      text,
    );
    for (const pattern of forbiddenDeepImports) {
      if (pattern.test(withoutDeclaredSubpaths))
        failures.push(`${full}: deep import bypasses package index ${pattern}`);
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
