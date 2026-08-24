import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  findBuiltinCatalogOwnershipViolation,
  findClientClosureViolation,
  findClientProductDependencyViolation,
  findClientServiceContractViolation,
  findClientPluginSurfaceViolation,
  findClientToolDependencyViolation,
  findForbiddenRepositoryPathViolation,
  findMigratedPluginViolations,
} from "../src/migrated-plugin-rules";

const root = process.cwd();
const dependencyGuarded = [
  "packages/runtime",
  "packages/session",
  "packages/tools",
  "packages/config",
  "packages/attachment-plugin",
  "packages/compaction-plugin",
  "packages/context-ledger-plugin",
  "packages/sandbox",
  "packages/mcp-plugin",
  "packages/skills-plugin",
  "packages/subagent",
  "packages/workflow",
  "packages/plugin",
  "packages/retry-plugin",
  "packages/runtime-ui-plugin",
  "packages/turn-orchestration-plugin",
  "packages/provider-model-plugin",
  "packages/task-workflow-plugin",
  "packages/workflow-scheduler-plugin",
  "packages/work-ledger-plugin",
  "packages/checkpoint-plugin",
  "packages/collaboration-plugin",
  "packages/governance-ledger-plugin",
  "packages/session-store-plugin",
  "packages/workspace-plugin",
  "packages/tool-pdf",
];
const capabilityRoots = ["packages/capability"];
/**
 * Capability factory modules that live inside the client package. They are not
 * yet decoupled capability packages — they still use kernel types such as
 * `RuntimeTool` — so the enforceable rule is narrower: a factory must never
 * import the composition root back, or the extraction is circular and buys
 * nothing, and it must stay free of presentation code.
 */
const capabilityFactoryRoots = ["packages/client/src/capabilities"];
const forbiddenCapabilityFactoryImports = [
  /from\s+["']\.\.\/runtime\/main["']/u,
  /from\s+["']@natalia\/client["']/u,
  /from\s+["'](?:\.\.\/)+apps\//u,
  /from\s+["']@opentui\//u,
  /from\s+["']solid-js/u,
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
  "native-terminal",
  "platform",
  "plugin",
  "runtime",
  "sandbox",
  "session",
  "skills-plugin",
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

/**
 * Architecture convergence plan §3.5 gates.
 *
 * File size: line count is reported as a maintenance signal, not enforced as an
 * architectural boundary. Cohesion and dependency direction determine whether
 * a module should be split; crossing an arbitrary line count does not.
 *
 * Runtime module coupling: `packages/client/src/runtime/` modules may only talk
 * to each other through `RuntimeContext` (`context`) and the type ports that
 * describe it (`options`, `ports*`, `status-config`, `session-execution-state`,
 * `initialize-types`). A relative import that resolves to another runtime
 * module's implementation — including one in the same root directory — is a
 * direct cross-module reference and fails. Feature subdirectories may split
 * across files for size: the guard allows imports within one feature directory
 * and blocks cross-feature coupling. The composition root (`main.ts`,
 * `composition/`) and the RPC surface assembler (`client-surface.ts`)
 * are the only modules allowed to import feature implementations.
 */
const maxSourceLines = 400;
const runtimeModuleRoots = ["packages/client/src/runtime"];
const runtimeCompositionRoot = "packages/client/src/runtime/main.ts";
const runtimeCompositionDirectory = "packages/client/src/runtime/composition/";
/**
 * Type-only ports that every runtime module may import. They carry the
 * `RuntimeContext` shape and its cross-module surface definitions, never
 * feature implementations.
 */
const runtimePortTargets = new Set([
  "packages/client/src/runtime/context.ts",
  "packages/client/src/runtime/options.ts",
  "packages/client/src/runtime/ports.ts",
  "packages/client/src/runtime/ports-extra.ts",
  "packages/client/src/runtime/ports-initialize.ts",
  "packages/client/src/runtime/ports-client-surface.ts",
  "packages/client/src/runtime/status-config.ts",
  "packages/client/src/runtime/session-execution-state.ts",
  "packages/client/src/runtime/initialize-types.ts",
]);

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
for (const dir of capabilityFactoryRoots)
  await scan(join(root, dir), sourceExtensions, (full, text) => {
    for (const pattern of forbiddenCapabilityFactoryImports) {
      if (pattern.test(text))
        failures.push(
          `${full}: capability factory must not depend on the composition root or presentation ${pattern}`,
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
    const relative = full.slice(root.length + 1).replaceAll("\\", "/");
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
    const relative = full.slice(root.length + 1).replaceAll("\\", "/");
    const forbiddenPathViolation =
      findForbiddenRepositoryPathViolation(relative);
    if (forbiddenPathViolation)
      failures.push(`${full}: ${forbiddenPathViolation}`);
    const catalogOwnershipViolation = findBuiltinCatalogOwnershipViolation(
      relative,
      text,
    );
    if (catalogOwnershipViolation)
      failures.push(`${full}: ${catalogOwnershipViolation}`);
    const serviceContractViolation = findClientServiceContractViolation(
      relative,
      text,
    );
    if (serviceContractViolation)
      failures.push(`${full}: ${serviceContractViolation}`);
    const clientPluginSurfaceViolation = findClientPluginSurfaceViolation(
      relative,
      text,
    );
    if (clientPluginSurfaceViolation)
      failures.push(`${full}: ${clientPluginSurfaceViolation}`);
    const clientToolViolation = findClientToolDependencyViolation(
      relative,
      text,
    );
    if (clientToolViolation) failures.push(`${full}: ${clientToolViolation}`);
    const clientProductViolation = findClientProductDependencyViolation(
      relative,
      text,
    );
    if (clientProductViolation)
      failures.push(`${full}: ${clientProductViolation}`);
    const clientClosureViolation = findClientClosureViolation(relative, text);
    if (clientClosureViolation)
      failures.push(`${full}: ${clientClosureViolation}`);
    for (const violation of findMigratedPluginViolations(relative, text))
      failures.push(
        `${full}: migrated plugin "${violation.pluginID}" must be mounted through the plugin catalog: ${violation.description}`,
      );
    for (const pattern of forbiddenTraceNames) {
      if (pattern.test(text))
        failures.push(`${full}: upstream trace name found`);
    }
    for (const pattern of forbiddenAccountFlowNames) {
      if (pattern.test(text))
        failures.push(`${full}: forbidden hosted identity flow ${pattern}`);
    }
  });

/**
 * Report large shipped source files for review. This is deliberately advisory:
 * splitting remains a design decision based on cohesion and ownership.
 */
const largeSourceFiles: string[] = [];
for (const dir of productionRoots)
  await scan(join(root, dir), /\.ts$/u, (full, text) => {
    const relative = full.slice(root.length + 1).replaceAll("\\", "/");
    if (!relative.includes("/src/") || relative.includes("/test/")) return;
    const lines = text.split("\n").length;
    if (lines > maxSourceLines) largeSourceFiles.push(`${relative} (${lines})`);
  });

/**
 * Runtime module coupling: modules under `packages/client/src/runtime/` talk to
 * each other only through `RuntimeContext`. Type ports (`context`, `options`,
 * `ports*`, `status-config`, `session-execution-state`, `initialize-types`)
 * may be imported by any module; the composition root (`main.ts`), its internal
 * composition modules, and the RPC surface assembler (`client-surface.ts`)
 * may import feature factories. Distinct root runtime modules must not import
 * each other's implementations directly; feature subdirectories may split
 * across files within one directory (internal composition) but must not reach
 * into another feature.
 */
const runtimeRoot = join(root, "packages", "client", "src", "runtime");
const runtimeRootDir = runtimeRoot;
const runtimeImport = /from\s+["'](\.[^"']*)["']/gu;
for (const dir of runtimeModuleRoots)
  await scan(join(root, dir), /\.ts$/u, (full, text) => {
    const relative = full.slice(root.length + 1).replaceAll("\\", "/");
    const importerDir = full.slice(0, full.lastIndexOf("/"));
    const imports = [...text.matchAll(runtimeImport)].map((match) => match[1]);
    for (const specifier of imports) {
      const resolved = resolveRuntimeSpecifier(full, specifier);
      if (
        resolved !== null &&
        resolved.startsWith(runtimeRoot) &&
        !isRuntimePortTarget(resolved) &&
        relative !== runtimeCompositionRoot &&
        relative !== "packages/client/src/runtime/client-surface.ts" &&
        !relative.startsWith(runtimeCompositionDirectory) &&
        // A feature split across files for size is internal composition: the
        // guard allows imports within one feature directory and blocks
        // cross-feature coupling. The runtime root itself is not a feature
        // directory: root modules are distinct modules and must not reach into
        // each other directly.
        !(
          isRuntimeFeatureDirectory(importerDir) &&
          sameDirectory(full, specifier)
        ) &&
        !relative.includes("/test/")
      )
        failures.push(
          `${relative}: runtime module imports another runtime module directly (${specifier}); communicate through RuntimeContext`,
        );
    }
  });

/**
 * True when the importer lives in a feature subdirectory (`runtime/<feature>/`)
 * rather than the runtime root. Feature-internal file splits are allowed; the
 * root level is one module per file.
 */
function isRuntimeFeatureDirectory(importerDir: string): boolean {
  return importerDir.startsWith(runtimeRoot) && importerDir !== runtimeRootDir;
}

function sameDirectory(importerFile: string, specifier: string): boolean {
  const base = importerFile.slice(0, importerFile.lastIndexOf("/"));
  const resolved = join(base, specifier);
  return resolved.slice(0, resolved.lastIndexOf("/")) === base;
}

/**
 * A relative import resolves to a runtime type port when the resolved path
 * names one of the port files, with or without an extension.
 */
function isRuntimePortTarget(resolved: string): boolean {
  const relative = resolved.slice(runtimeRoot.length + 1).replaceAll("\\", "/");
  const withoutExtension = relative.endsWith(".ts")
    ? relative.slice(0, -3)
    : relative;
  return runtimePortTargets.has(
    `packages/client/src/runtime/${withoutExtension}.ts`,
  );
}

function resolveRuntimeSpecifier(
  importerFile: string,
  specifier: string,
): string | null {
  if (!specifier.startsWith(".")) return null;
  const base = importerFile.slice(0, importerFile.lastIndexOf("/"));
  const resolved = join(base, specifier);
  if (resolved.startsWith(runtimeRoot)) return resolved;
  return null;
}

/**
 * Runtime dependency direction must stay acyclic (plan §3.5). A value import
 * from one runtime module into another creates a real initialization-order
 * dependency; type-only imports are erased at compile time and cannot form a
 * runtime cycle. The graph therefore uses only non-type relative imports that
 * resolve inside the runtime directory.
 */
const runtimeValueImport =
  /(?:^|[;"'\n])\s*(?:import|export)\s+(?!type\b)[^;]*?from\s+["'](\.[^"']*)["']/gu;
const runtimeModuleFiles: string[] = [];
for (const dir of runtimeModuleRoots)
  await scan(join(root, dir), /\.ts$/u, (full) => {
    const relative = full.slice(root.length + 1).replaceAll("\\", "/");
    if (!relative.includes("/test/")) runtimeModuleFiles.push(full);
  });
const runtimeModuleFileSet = new Set(runtimeModuleFiles);
const runtimeEdges = new Map<string, string[]>();
for (const full of runtimeModuleFiles) {
  const text = await readFile(full, "utf8");
  const targets: string[] = [];
  for (const match of text.matchAll(runtimeValueImport)) {
    const specifier = match[1];
    const resolved = resolveRuntimeFile(full, specifier);
    if (resolved !== null && runtimeModuleFileSet.has(resolved))
      targets.push(resolved);
  }
  if (targets.length) runtimeEdges.set(full, targets);
}
const cycleFailures = findRuntimeCycles(runtimeEdges);
for (const failure of cycleFailures) failures.push(failure);

/**
 * Resolves a relative specifier to a concrete file inside the runtime
 * directory, honoring the extension-less module specifiers used across the
 * codebase (including directory imports that resolve to an index module).
 */
function resolveRuntimeFile(
  importerFile: string,
  specifier: string,
): string | null {
  const base = importerFile.slice(0, importerFile.lastIndexOf("/"));
  const joined = join(base, specifier);
  if (!joined.startsWith(runtimeRoot)) return null;
  for (const candidate of [
    joined,
    `${joined}.ts`,
    join(joined, "index.ts"),
    `${joined}.tsx`,
    join(joined, "index.tsx"),
  ]) {
    if (runtimeModuleFileSet.has(candidate)) return candidate;
  }
  return null;
}

/**
 * Reports every distinct cycle found in a directed graph of file paths. Each
 * returned line names the cycle so a regression is actionable.
 */
function findRuntimeCycles(edges: Map<string, string[]>): string[] {
  const reported = new Set<string>();
  const state = new Map<string, 0 | 1 | 2>();
  const stack: string[] = [];
  const result: string[] = [];
  const visit = (node: string): void => {
    state.set(node, 1);
    stack.push(node);
    for (const next of edges.get(node) ?? []) {
      const nextState = state.get(next) ?? 0;
      if (nextState === 1) {
        const cycleStart = stack.indexOf(next);
        const cycle = [...stack.slice(cycleStart), next];
        const label = cycle
          .map((file) => file.slice(root.length + 1))
          .join(" -> ");
        if (!reported.has(label)) {
          reported.add(label);
          result.push(`runtime dependency cycle: ${label}`);
        }
        continue;
      }
      if (nextState === 0) visit(next);
    }
    stack.pop();
    state.set(node, 2);
  };
  for (const node of edges.keys())
    if ((state.get(node) ?? 0) === 0) visit(node);
  return result;
}

/**
 * Every package that has tests must have them in the gate.
 * A test directory missing from the root `test` script is worse than having no
 * tests: the tests exist, they are maintained, they look like coverage in review,
 * and nothing runs them. This has happened three times — twice with new packages,
 * once with `packages/contracts`, whose tests had never run — so the rule is
 * enforced here instead of being written down again.
 *
 * The check is on the workspace's own script text rather than on a list kept here,
 * because a list kept here is the same kind of thing that went stale.
 */
const testScript = JSON.parse(
  await readFile(join(root, "package.json"), "utf8"),
) as { scripts?: Record<string, string> };
const gatedTests = testScript.scripts?.test ?? "";
for (const entry of await readdir(join(root, "packages"), {
  withFileTypes: true,
})) {
  if (!entry.isDirectory()) continue;
  const testDir = join(root, "packages", entry.name, "test");
  let hasTests = false;
  try {
    hasTests = (await readdir(testDir)).some((file) =>
      /\.test\.tsx?$/u.test(file),
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  if (!hasTests) continue;
  if (!gatedTests.includes(`packages/${entry.name}/test`))
    failures.push(
      `packages/${entry.name}/test has tests that the root "test" script never runs`,
    );
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
if (largeSourceFiles.length)
  console.warn(
    `source files over ${maxSourceLines} lines (advisory):\n${largeSourceFiles.join("\n")}`,
  );
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
