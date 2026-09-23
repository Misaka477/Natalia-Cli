"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
var _a, _b, _c, _d, _e, _f, _g;
Object.defineProperty(exports, "__esModule", { value: true });
var promises_1 = require("node:fs/promises");
var node_path_1 = require("node:path");
var migrated_plugin_rules_1 = require("../src/migrated-plugin-rules");
var root = process.cwd();
var dependencyGuarded = [
    "packages/framework/runtime",
    "packages/framework/session",
    "packages/core/tools",
    "packages/hosts/config",
    "packages/framework/attachments",
    "packages/framework/compaction",
    "packages/domains/context-ledger",
    "packages/framework/sandbox",
    "packages/plugins/mcp",
    "packages/plugins/skills",
    "packages/framework/subagents",
    "packages/core/plugin",
    "packages/framework/retry",
    "packages/framework/runtime-status",
    "packages/framework/turn-orchestration",
    "packages/framework/provider-model",
    "packages/domains/work-ledger",
    "packages/framework/checkpoint",
    "packages/framework/collaboration",
    "packages/domains/governance-ledger",
    "packages/framework/session-store",
    "packages/framework/workspace",
];
var capabilityRoots = ["packages/core/capability"];
/**
 * Capability factory modules that live inside the client package. They are not
 * yet decoupled capability packages — they still use kernel types such as
 * `RuntimeTool` — so the enforceable rule is narrower: a factory must never
 * import the composition root back, or the extraction is circular and buys
 * nothing, and it must stay free of presentation code.
 */
var capabilityFactoryRoots = ["packages/framework/client/src/capabilities"];
var forbiddenCapabilityFactoryImports = [
    /from\s+["']\.\.\/runtime\/main["']/u,
    /from\s+["']@natalia\/client["']/u,
    /from\s+["'](?:\.\.\/)+apps\//u,
    /from\s+["']@opentui\//u,
    /from\s+["']solid-js/u,
];
var productionRoots = ["apps", "packages", "cmd", "internal", "scripts"];
/**
 * Packages an externally built UI is allowed to depend on (mainline plan §2.1).
 * They must stay leaf-ward: importing a kernel package here would drag the whole
 * runtime into every consumer and silently make the consumer contract untestable.
 */
var consumerContractRoots = [
    "packages/core/contracts/src",
    "packages/tooling/sdk/src",
    "packages/hosts/view-store/src",
    "packages/hosts/ui-model/src",
    "packages/core/capability/src",
];
var kernelPackages = [
    "agent",
    "attachments",
    "checkpoint",
    "client",
    "compaction",
    "config",
    "context-ledger",
    "governance-ledger",
    "platform",
    "plugin",
    "provider-model",
    "retry",
    "runtime",
    "runtime-config",
    "runtime-status",
    "sandbox",
    "session",
    "session-store",
    "skills-plugin",
    "subagents",
    "testing",
    "tool-policy",
    "tools",
    "transport",
    "turn-orchestration",
    "work-ledger",
    "workspace",
];
var sourceExtensions = /\.(ts|tsx|js|jsx|go|json|toml|ya?ml)$/u;
var skippedDirs = new Set([
    ".git",
    ".turbo",
    "coverage",
    "dist",
    "node_modules",
]);
var forbiddenDependencies = [
    /from\s+["'](?:\.\.\/)*apps\/tui/u,
    /from\s+["']@opentui\//u,
    /from\s+["']solid-js/u,
    /from\s+["'](?:react|preact|vue|svelte)["']/u,
    /\bHTMLElement\b/u,
];
var forbiddenTraceNames = [new RegExp("open" + "code", "iu")];
var forbiddenAccountFlowNames = [
    new RegExp("\\b(?:".concat("log" + "in", "|").concat("log" + "out", "|").concat("sign" + "In", "|").concat("sign" + "Out", "|").concat("sign" + "Up", "|").concat("oa" + "uth", "|").concat("oi" + "dc", ")\\b"), "iu"),
    new RegExp("\\b".concat("sign", "[-_\\s]?(?:in|out|up)\\b"), "iu"),
    new RegExp("\\b(?:user|cloud|organization|workspace)\\s+".concat("acc" + "ount", "\\b"), "iu"),
];
// Both prefixes: mechanism packages move to @anthelia in P3 (decision 24④)
// while the guard keeps banning BOTH spellings — coverage never dips while
// the rename lands, and P4⑤ hardens the list to prefixes that exist.
var forbiddenConsumerContractImports = kernelPackages.flatMap(function (name) { return [
    new RegExp("from\\s+[\"']@natalia/".concat(name, "[\"']"), "u"),
    new RegExp("from\\s+[\"']@anthelia/".concat(name, "[\"']"), "u"),
]; });
/**
 * Subpath entry points a package deliberately declares in its `exports`. They
 * are not deep imports into private internals: the split is the contract. Keep
 * this list in step with the `exports` maps, so an undeclared subpath still
 * fails the deep-import rule below.
 */
var declaredSubpathExports = [
    "@natalia/transport/host",
    "@natalia/diff-wasm/ast",
    "@natalia/client/fixture",
];
/**
 * Host-side transport (`createRuntimeHttpServer`, `createRuntimeWsServer`, the
 * daemon store/token/spawn) opens sockets, mints bearer tokens and spawns
 * processes. Only whoever runs the runtime may import it. A UI that merely
 * speaks the protocol must not gain the ability to host one.
 */
var transportHostImport = /from\s+["']@natalia\/transport\/host["']/u;
var transportHostAllowedRoots = ["apps/cli", "packages/hosts/transport"];
/**
 * Tests legitimately stand up a real server to verify the protocol against it,
 * so the host rule applies to shipped source rather than to test files.
 */
var testPath = /(?:^|\/)test\//u;
/**
 * Deep imports into another package bypass its public index and therefore its
 * contract. `@natalia/<pkg>/...` and `../../packages/<pkg>/...` are both
 * banned for shipped code; `scripts/` is dev tooling and stays out of scope.
 */
var deepImportRoots = ["apps", "packages"];
var forbiddenDeepImports = [
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
 * Runtime module coupling: `packages/framework/client/src/runtime/` modules may only talk
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
var maxSourceLines = 400;
var runtimeModuleRoots = ["packages/framework/client/src/runtime"];
var runtimeCompositionRoot = "packages/framework/client/src/runtime/main.ts";
var runtimeCompositionDirectory = "packages/framework/client/src/runtime/composition/";
/**
 * Type-only ports that every runtime module may import. They carry the
 * `RuntimeContext` shape and its cross-module surface definitions, never
 * feature implementations.
 */
var runtimePortTargets = new Set([
    "packages/framework/client/src/runtime/context.ts",
    "packages/framework/client/src/runtime/options.ts",
    "packages/framework/client/src/runtime/ports.ts",
    "packages/framework/client/src/runtime/ports-extra.ts",
    "packages/framework/client/src/runtime/ports-initialize.ts",
    "packages/framework/client/src/runtime/ports-client-surface.ts",
    "packages/framework/client/src/runtime/status-config.ts",
    "packages/framework/client/src/runtime/session-execution-state.ts",
    "packages/framework/client/src/runtime/initialize-types.ts",
]);
var failures = [];
for (var _i = 0, frameworkSubsystemRoots_1 = migrated_plugin_rules_1.frameworkSubsystemRoots; _i < frameworkSubsystemRoots_1.length; _i++) {
    var dir = frameworkSubsystemRoots_1[_i];
    await scan((0, node_path_1.join)(root, dir), /\.tsx?$/u, function (full, text) {
        var violation = (0, migrated_plugin_rules_1.findFrameworkPluginSurfaceViolation)(full.slice(root.length + 1).replaceAll("\\", "/"), text);
        if (violation)
            failures.push("".concat(full, ": ").concat(violation));
    });
}
for (var _h = 0, frameworkSubsystemFiles_1 = migrated_plugin_rules_1.frameworkSubsystemFiles; _h < frameworkSubsystemFiles_1.length; _h++) {
    var path = frameworkSubsystemFiles_1[_h];
    var full = (0, node_path_1.join)(root, path);
    var text = await (0, promises_1.readFile)(full, "utf8");
    var violation = (0, migrated_plugin_rules_1.findFrameworkPluginSurfaceViolation)(path, text);
    if (violation)
        failures.push("".concat(full, ": ").concat(violation));
}
for (var _j = 0, _k = await workspacePackageManifests("packages"); _j < _k.length; _j++) {
    var manifest = _k[_j];
    if (((_a = manifest.name) === null || _a === void 0 ? void 0 : _a.startsWith("@natalia/plugin-")) &&
        ((_b = manifest.dependencies) === null || _b === void 0 ? void 0 : _b["@natalia/plugin"]) === undefined)
        failures.push("".concat(manifest.path, ": plugin package must depend on @natalia/plugin"));
    // §3.6.8: the testing tooling must never be a production dependency — it
    // belongs in devDependencies (audit A-04/A-05). Mechanized here so a package
    // cannot quietly reintroduce a production edge to tooling/testing.
    if (((_c = manifest.dependencies) === null || _c === void 0 ? void 0 : _c["@natalia/testing"]) !== undefined)
        failures.push("".concat(manifest.path, ": @natalia/testing must be a devDependency, not a production dependency"));
}
for (var _l = 0, dependencyGuarded_1 = dependencyGuarded; _l < dependencyGuarded_1.length; _l++) {
    var dir = dependencyGuarded_1[_l];
    await scan((0, node_path_1.join)(root, dir), sourceExtensions, function (full, text) {
        // Plugin UI subpaths are intentionally presentation code (they export a
        // SolidJS UI plugin through package `./ui`); backend dependency rules do
        // not apply to a dedicated UI entry point.
        if (/\/src\/ui\//u.test(full))
            return;
        for (var _i = 0, forbiddenDependencies_1 = forbiddenDependencies; _i < forbiddenDependencies_1.length; _i++) {
            var pattern = forbiddenDependencies_1[_i];
            if (pattern.test(text))
                failures.push("".concat(full, ": forbidden dependency ").concat(pattern));
        }
    });
}
for (var _m = 0, capabilityRoots_1 = capabilityRoots; _m < capabilityRoots_1.length; _m++) {
    var dir = capabilityRoots_1[_m];
    await scan((0, node_path_1.join)(root, dir), sourceExtensions, function (full, text) {
        for (var _i = 0, _a = [
            /from\s+["']@natalia\/(?:client|runtime|session|tools)["']/u,
            /from\s+["'](?:\.\.\/)+apps\//u,
            /from\s+["']@opentui\//u,
            /from\s+["']solid-js/u,
        ]; _i < _a.length; _i++) {
            var pattern = _a[_i];
            if (pattern.test(text))
                failures.push("".concat(full, ": capability bypasses kernel or presentation boundary ").concat(pattern));
        }
    });
}
for (var _o = 0, capabilityFactoryRoots_1 = capabilityFactoryRoots; _o < capabilityFactoryRoots_1.length; _o++) {
    var dir = capabilityFactoryRoots_1[_o];
    await scan((0, node_path_1.join)(root, dir), sourceExtensions, function (full, text) {
        for (var _i = 0, forbiddenCapabilityFactoryImports_1 = forbiddenCapabilityFactoryImports; _i < forbiddenCapabilityFactoryImports_1.length; _i++) {
            var pattern = forbiddenCapabilityFactoryImports_1[_i];
            if (pattern.test(text))
                failures.push("".concat(full, ": capability factory must not depend on the composition root or presentation ").concat(pattern));
        }
    });
}
for (var _p = 0, consumerContractRoots_1 = consumerContractRoots; _p < consumerContractRoots_1.length; _p++) {
    var dir = consumerContractRoots_1[_p];
    await scan((0, node_path_1.join)(root, dir), sourceExtensions, function (full, text) {
        for (var _i = 0, forbiddenConsumerContractImports_1 = forbiddenConsumerContractImports; _i < forbiddenConsumerContractImports_1.length; _i++) {
            var pattern = forbiddenConsumerContractImports_1[_i];
            if (pattern.test(text))
                failures.push("".concat(full, ": consumer contract package depends on kernel ").concat(pattern));
        }
    });
}
for (var _q = 0, deepImportRoots_1 = deepImportRoots; _q < deepImportRoots_1.length; _q++) {
    var dir = deepImportRoots_1[_q];
    await scan((0, node_path_1.join)(root, dir), sourceExtensions, function (full, text) {
        var relative = full.slice(root.length + 1).replaceAll("\\", "/");
        if (transportHostImport.test(text) &&
            !testPath.test(relative) &&
            !transportHostAllowedRoots.some(function (allowed) { return relative.startsWith(allowed); }))
            failures.push("".concat(full, ": only the runtime host may import @natalia/transport/host"));
        var withoutDeclaredSubpaths = declaredSubpathExports.reduce(function (acc, subpath) { return acc.split(subpath).join("@natalia/declared-subpath"); }, text);
        for (var _i = 0, forbiddenDeepImports_1 = forbiddenDeepImports; _i < forbiddenDeepImports_1.length; _i++) {
            var pattern = forbiddenDeepImports_1[_i];
            if (pattern.test(withoutDeclaredSubpaths))
                failures.push("".concat(full, ": deep import bypasses package index ").concat(pattern));
        }
    });
}
for (var _r = 0, productionRoots_1 = productionRoots; _r < productionRoots_1.length; _r++) {
    var dir = productionRoots_1[_r];
    await scan((0, node_path_1.join)(root, dir), sourceExtensions, function (full, text) {
        var relative = full.slice(root.length + 1).replaceAll("\\", "/");
        var forbiddenPathViolation = (0, migrated_plugin_rules_1.findForbiddenRepositoryPathViolation)(relative);
        if (forbiddenPathViolation)
            failures.push("".concat(full, ": ").concat(forbiddenPathViolation));
        var catalogOwnershipViolation = (0, migrated_plugin_rules_1.findRuntimePluginCatalogViolation)(relative, text);
        if (catalogOwnershipViolation)
            failures.push("".concat(full, ": ").concat(catalogOwnershipViolation));
        var serviceContractViolation = (0, migrated_plugin_rules_1.findClientServiceContractViolation)(relative, text);
        if (serviceContractViolation)
            failures.push("".concat(full, ": ").concat(serviceContractViolation));
        var clientPluginSurfaceViolation = (0, migrated_plugin_rules_1.findClientPluginSurfaceViolation)(relative, text);
        if (clientPluginSurfaceViolation)
            failures.push("".concat(full, ": ").concat(clientPluginSurfaceViolation));
        var clientToolViolation = (0, migrated_plugin_rules_1.findClientToolDependencyViolation)(relative, text);
        if (clientToolViolation)
            failures.push("".concat(full, ": ").concat(clientToolViolation));
        var clientProductViolation = (0, migrated_plugin_rules_1.findClientProductDependencyViolation)(relative, text);
        if (clientProductViolation)
            failures.push("".concat(full, ": ").concat(clientProductViolation));
        var clientClosureViolation = (0, migrated_plugin_rules_1.findClientClosureViolation)(relative, text);
        if (clientClosureViolation)
            failures.push("".concat(full, ": ").concat(clientClosureViolation));
        var teamPluginViolation = (0, migrated_plugin_rules_1.findTeamPluginDependencyViolation)(relative, text);
        if (teamPluginViolation)
            failures.push("".concat(full, ": ").concat(teamPluginViolation));
        for (var _i = 0, _a = (0, migrated_plugin_rules_1.findMigratedPluginViolations)(relative, text); _i < _a.length; _i++) {
            var violation = _a[_i];
            failures.push("".concat(full, ": migrated plugin \"").concat(violation.pluginID, "\" must be mounted through the plugin catalog: ").concat(violation.description));
        }
        for (var _b = 0, forbiddenTraceNames_1 = forbiddenTraceNames; _b < forbiddenTraceNames_1.length; _b++) {
            var pattern = forbiddenTraceNames_1[_b];
            if (pattern.test(text))
                failures.push("".concat(full, ": upstream trace name found"));
        }
        for (var _c = 0, forbiddenAccountFlowNames_1 = forbiddenAccountFlowNames; _c < forbiddenAccountFlowNames_1.length; _c++) {
            var pattern = forbiddenAccountFlowNames_1[_c];
            if (pattern.test(text))
                failures.push("".concat(full, ": forbidden hosted identity flow ").concat(pattern));
        }
    });
}
/**
 * Report large shipped source files for review. This is deliberately advisory:
 * splitting remains a design decision based on cohesion and ownership.
 */
var largeSourceFiles = [];
for (var _s = 0, productionRoots_2 = productionRoots; _s < productionRoots_2.length; _s++) {
    var dir = productionRoots_2[_s];
    await scan((0, node_path_1.join)(root, dir), /\.ts$/u, function (full, text) {
        var relative = full.slice(root.length + 1).replaceAll("\\", "/");
        if (!relative.includes("/src/") || relative.includes("/test/"))
            return;
        var lines = text.split("\n").length;
        if (lines > maxSourceLines)
            largeSourceFiles.push("".concat(relative, " (").concat(lines, ")"));
    });
}
/**
 * Runtime module coupling: modules under `packages/framework/client/src/runtime/` talk to
 * each other only through `RuntimeContext`. Type ports (`context`, `options`,
 * `ports*`, `status-config`, `session-execution-state`, `initialize-types`)
 * may be imported by any module; the composition root (`main.ts`), its internal
 * composition modules, and the RPC surface assembler (`client-surface.ts`)
 * may import feature factories. Distinct root runtime modules must not import
 * each other's implementations directly; feature subdirectories may split
 * across files within one directory (internal composition) but must not reach
 * into another feature.
 */
var runtimeRoot = (0, node_path_1.join)(root, "packages", "client", "src", "runtime");
var runtimeRootDir = runtimeRoot;
var runtimeImport = /from\s+["'](\.[^"']*)["']/gu;
for (var _t = 0, runtimeModuleRoots_1 = runtimeModuleRoots; _t < runtimeModuleRoots_1.length; _t++) {
    var dir = runtimeModuleRoots_1[_t];
    await scan((0, node_path_1.join)(root, dir), /\.ts$/u, function (full, text) {
        var relative = full.slice(root.length + 1).replaceAll("\\", "/");
        var importerDir = full.slice(0, full.lastIndexOf("/"));
        var imports = __spreadArray([], text.matchAll(runtimeImport), true).map(function (match) { return match[1]; });
        for (var _i = 0, imports_1 = imports; _i < imports_1.length; _i++) {
            var specifier = imports_1[_i];
            var resolved = resolveRuntimeSpecifier(full, specifier);
            if (resolved !== null &&
                resolved.startsWith(runtimeRoot) &&
                !isRuntimePortTarget(resolved) &&
                relative !== runtimeCompositionRoot &&
                relative !==
                    "packages/framework/client/src/runtime/client-surface.ts" &&
                !relative.startsWith(runtimeCompositionDirectory) &&
                // A feature split across files for size is internal composition: the
                // guard allows imports within one feature directory and blocks
                // cross-feature coupling. The runtime root itself is not a feature
                // directory: root modules are distinct modules and must not reach into
                // each other directly.
                !(isRuntimeFeatureDirectory(importerDir) &&
                    sameDirectory(full, specifier)) &&
                !relative.includes("/test/"))
                failures.push("".concat(relative, ": runtime module imports another runtime module directly (").concat(specifier, "); communicate through RuntimeContext"));
        }
    });
}
/**
 * True when the importer lives in a feature subdirectory (`runtime/<feature>/`)
 * rather than the runtime root. Feature-internal file splits are allowed; the
 * root level is one module per file.
 */
function isRuntimeFeatureDirectory(importerDir) {
    return importerDir.startsWith(runtimeRoot) && importerDir !== runtimeRootDir;
}
function sameDirectory(importerFile, specifier) {
    var base = importerFile.slice(0, importerFile.lastIndexOf("/"));
    var resolved = (0, node_path_1.join)(base, specifier);
    return resolved.slice(0, resolved.lastIndexOf("/")) === base;
}
/**
 * A relative import resolves to a runtime type port when the resolved path
 * names one of the port files, with or without an extension.
 */
function isRuntimePortTarget(resolved) {
    var relative = resolved.slice(runtimeRoot.length + 1).replaceAll("\\", "/");
    var withoutExtension = relative.endsWith(".ts")
        ? relative.slice(0, -3)
        : relative;
    return runtimePortTargets.has("packages/framework/client/src/runtime/".concat(withoutExtension, ".ts"));
}
function resolveRuntimeSpecifier(importerFile, specifier) {
    if (!specifier.startsWith("."))
        return null;
    var base = importerFile.slice(0, importerFile.lastIndexOf("/"));
    var resolved = (0, node_path_1.join)(base, specifier);
    if (resolved.startsWith(runtimeRoot))
        return resolved;
    return null;
}
/**
 * Runtime dependency direction must stay acyclic (plan §3.5). A value import
 * from one runtime module into another creates a real initialization-order
 * dependency; type-only imports are erased at compile time and cannot form a
 * runtime cycle. The graph therefore uses only non-type relative imports that
 * resolve inside the runtime directory.
 */
var runtimeValueImport = /(?:^|[;"'\n])\s*(?:import|export)\s+(?!type\b)[^;]*?from\s+["'](\.[^"']*)["']/gu;
var runtimeModuleFiles = [];
for (var _u = 0, runtimeModuleRoots_2 = runtimeModuleRoots; _u < runtimeModuleRoots_2.length; _u++) {
    var dir = runtimeModuleRoots_2[_u];
    await scan((0, node_path_1.join)(root, dir), /\.ts$/u, function (full) {
        var relative = full.slice(root.length + 1).replaceAll("\\", "/");
        if (!relative.includes("/test/"))
            runtimeModuleFiles.push(full);
    });
}
var runtimeModuleFileSet = new Set(runtimeModuleFiles);
var runtimeEdges = new Map();
for (var _v = 0, runtimeModuleFiles_1 = runtimeModuleFiles; _v < runtimeModuleFiles_1.length; _v++) {
    var full = runtimeModuleFiles_1[_v];
    var text = await (0, promises_1.readFile)(full, "utf8");
    var targets = [];
    for (var _w = 0, _x = text.matchAll(runtimeValueImport); _w < _x.length; _w++) {
        var match = _x[_w];
        var specifier = match[1];
        var resolved = resolveRuntimeFile(full, specifier);
        if (resolved !== null && runtimeModuleFileSet.has(resolved))
            targets.push(resolved);
    }
    if (targets.length)
        runtimeEdges.set(full, targets);
}
var cycleFailures = findRuntimeCycles(runtimeEdges);
for (var _y = 0, cycleFailures_1 = cycleFailures; _y < cycleFailures_1.length; _y++) {
    var failure = cycleFailures_1[_y];
    failures.push(failure);
}
/**
 * Resolves a relative specifier to a concrete file inside the runtime
 * directory, honoring the extension-less module specifiers used across the
 * codebase (including directory imports that resolve to an index module).
 */
function resolveRuntimeFile(importerFile, specifier) {
    var base = importerFile.slice(0, importerFile.lastIndexOf("/"));
    var joined = (0, node_path_1.join)(base, specifier);
    if (!joined.startsWith(runtimeRoot))
        return null;
    for (var _i = 0, _a = [
        joined,
        "".concat(joined, ".ts"),
        (0, node_path_1.join)(joined, "index.ts"),
        "".concat(joined, ".tsx"),
        (0, node_path_1.join)(joined, "index.tsx"),
    ]; _i < _a.length; _i++) {
        var candidate = _a[_i];
        if (runtimeModuleFileSet.has(candidate))
            return candidate;
    }
    return null;
}
/**
 * Reports every distinct cycle found in a directed graph of file paths. Each
 * returned line names the cycle so a regression is actionable.
 */
function findRuntimeCycles(edges) {
    var _a;
    var reported = new Set();
    var state = new Map();
    var stack = [];
    var result = [];
    var visit = function (node) {
        var _a, _b;
        state.set(node, 1);
        stack.push(node);
        for (var _i = 0, _c = (_a = edges.get(node)) !== null && _a !== void 0 ? _a : []; _i < _c.length; _i++) {
            var next = _c[_i];
            var nextState = (_b = state.get(next)) !== null && _b !== void 0 ? _b : 0;
            if (nextState === 1) {
                var cycleStart = stack.indexOf(next);
                var cycle = __spreadArray(__spreadArray([], stack.slice(cycleStart), true), [next], false);
                var label = cycle
                    .map(function (file) { return file.slice(root.length + 1); })
                    .join(" -> ");
                if (!reported.has(label)) {
                    reported.add(label);
                    result.push("runtime dependency cycle: ".concat(label));
                }
                continue;
            }
            if (nextState === 0)
                visit(next);
        }
        stack.pop();
        state.set(node, 2);
    };
    for (var _i = 0, _b = edges.keys(); _i < _b.length; _i++) {
        var node = _b[_i];
        if (((_a = state.get(node)) !== null && _a !== void 0 ? _a : 0) === 0)
            visit(node);
    }
    return result;
}
/**
 * Every package that has tests must have them in the gate.
 * A test directory missing from the root `test` script is worse than having no
 * tests: the tests exist, they are maintained, they look like coverage in review,
 * and nothing runs them. This has happened three times — twice with new packages,
 * once with `packages/core/contracts`, whose tests had never run — so the rule is
 * enforced here instead of being written down again.
 *
 * The check is on the workspace's own script text rather than on a list kept here,
 * because a list kept here is the same kind of thing that went stale.
 */
var testScript = JSON.parse(await (0, promises_1.readFile)((0, node_path_1.join)(root, "package.json"), "utf8"));
var gatedTests = (_e = (_d = testScript.scripts) === null || _d === void 0 ? void 0 : _d.test) !== null && _e !== void 0 ? _e : "";
for (var _z = 0, _0 = await workspacePackageEntries("packages"); _z < _0.length; _z++) {
    var entry = _0[_z];
    var relative = entry.replaceAll("\\", "/");
    var testDir = (0, node_path_1.join)(root, relative, "test");
    var hasTests = false;
    try {
        hasTests = (await (0, promises_1.readdir)(testDir)).some(function (file) {
            return /\.test\.tsx?$/u.test(file);
        });
    }
    catch (error) {
        if (error.code !== "ENOENT")
            throw error;
    }
    if (!hasTests)
        continue;
    if (!gatedTests.includes("".concat(relative, "/test")))
        failures.push("".concat(relative, "/test has tests that the root \"test\" script never runs"));
}
// master plan P3: composition is engine substrate — the paths map is the
// declaration, and this keeps the placement machine-checked.
{
    var tsconfigBase = JSON.parse(await (0, promises_1.readFile)((0, node_path_1.join)(root, "tsconfig.base.json"), "utf8"));
    var violation = (0, migrated_plugin_rules_1.findCompositionKernelViolation)((_g = (_f = tsconfigBase.compilerOptions) === null || _f === void 0 ? void 0 : _f.paths) === null || _g === void 0 ? void 0 : _g["@natalia/composition"]);
    if (violation)
        failures.push("tsconfig.base.json: ".concat(violation));
}
// P3 substrate purity: the core context file carries no policy package
// import — the boundary each extraction step widens, machine-checked.
await scan((0, node_path_1.join)(root, "packages/framework/client/src"), /\.tsx?$/u, function (full, text) {
    var relative = full.slice(root.length + 1).replaceAll("\\", "/");
    var violation = (0, migrated_plugin_rules_1.findSubstratePurityViolation)(relative, text);
    if (violation)
        failures.push("".concat(relative, ": ").concat(violation));
});
// decisions §1.2: product policy (domains) never depends on the host layer.
await scan((0, node_path_1.join)(root, "packages/domains"), sourceExtensions, function (full, text) {
    var relative = full.slice(root.length + 1).replaceAll("\\", "/");
    if (!relative.includes("/src/"))
        return;
    for (var _i = 0, _a = text.matchAll(/from\s+["'](@natalia\/[a-z-]+(?:\/[^"']*)?)["']/gu); _i < _a.length; _i++) {
        var match = _a[_i];
        var violation = (0, migrated_plugin_rules_1.findPolicyHostDependencyViolation)(match[1], relative);
        if (violation)
            failures.push("".concat(relative, ": ").concat(violation));
    }
});
if (failures.length) {
    console.error(failures.join("\n"));
    process.exit(1);
}
if (largeSourceFiles.length)
    console.warn("source files over ".concat(maxSourceLines, " lines (advisory):\n").concat(largeSourceFiles.join("\n")));
console.log("import guard passed");
/**
 * Recursively collects every workspace package under a root directory. The
 * package topology is nested (`packages/core/*`, `packages/domains/*`), so a
 * one-level readdir silently skips packages below the top level. Directory
 * entries that are not packages (vendored trees, build output, dependencies)
 * are pruned with the same skip set the source scan uses.
 */
function workspacePackageEntries(rootDir) {
    return __awaiter(this, void 0, void 0, function () {
        var entries, visit;
        var _this = this;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    entries = [];
                    visit = function (directory) { return __awaiter(_this, void 0, void 0, function () {
                        var children, error_1, _i, children_1, entry, full;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    _a.trys.push([0, 2, , 3]);
                                    return [4 /*yield*/, (0, promises_1.readdir)(directory, { withFileTypes: true })];
                                case 1:
                                    children = _a.sent();
                                    return [3 /*break*/, 3];
                                case 2:
                                    error_1 = _a.sent();
                                    if (error_1.code === "ENOENT")
                                        return [2 /*return*/];
                                    throw error_1;
                                case 3:
                                    _i = 0, children_1 = children;
                                    _a.label = 4;
                                case 4:
                                    if (!(_i < children_1.length)) return [3 /*break*/, 8];
                                    entry = children_1[_i];
                                    if (!entry.isDirectory())
                                        return [3 /*break*/, 7];
                                    if (skippedDirs.has(entry.name))
                                        return [3 /*break*/, 7];
                                    full = (0, node_path_1.join)(directory, entry.name);
                                    return [4 /*yield*/, Bun.file((0, node_path_1.join)(full, "package.json")).exists()];
                                case 5:
                                    if (_a.sent()) {
                                        entries.push(full.slice(root.length + 1));
                                        return [3 /*break*/, 7];
                                    }
                                    return [4 /*yield*/, visit(full)];
                                case 6:
                                    _a.sent();
                                    _a.label = 7;
                                case 7:
                                    _i++;
                                    return [3 /*break*/, 4];
                                case 8: return [2 /*return*/];
                            }
                        });
                    }); };
                    return [4 /*yield*/, visit((0, node_path_1.join)(root, rootDir))];
                case 1:
                    _a.sent();
                    return [2 /*return*/, entries];
            }
        });
    });
}
function workspacePackageManifests(rootDir) {
    return __awaiter(this, void 0, void 0, function () {
        var manifests, _i, _a, relative, parsed, _b, _c, error_2;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    manifests = [];
                    _i = 0;
                    return [4 /*yield*/, workspacePackageEntries(rootDir)];
                case 1:
                    _a = _d.sent();
                    _d.label = 2;
                case 2:
                    if (!(_i < _a.length)) return [3 /*break*/, 7];
                    relative = _a[_i];
                    _d.label = 3;
                case 3:
                    _d.trys.push([3, 5, , 6]);
                    _c = (_b = JSON).parse;
                    return [4 /*yield*/, (0, promises_1.readFile)((0, node_path_1.join)(root, relative, "package.json"), "utf8")];
                case 4:
                    parsed = _c.apply(_b, [_d.sent()]);
                    manifests.push(__assign(__assign({}, parsed), { path: (0, node_path_1.join)(root, relative, "package.json") }));
                    return [3 /*break*/, 6];
                case 5:
                    error_2 = _d.sent();
                    if (error_2.code !== "ENOENT")
                        throw error_2;
                    return [3 /*break*/, 6];
                case 6:
                    _i++;
                    return [3 /*break*/, 2];
                case 7: return [2 /*return*/, manifests];
            }
        });
    });
}
function scan(path, include, check) {
    return __awaiter(this, void 0, void 0, function () {
        var entries, error_3, _i, entries_1, entry, full, text;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, (0, promises_1.readdir)(path, { withFileTypes: true })];
                case 1:
                    entries = _a.sent();
                    return [3 /*break*/, 3];
                case 2:
                    error_3 = _a.sent();
                    if (error_3.code === "ENOENT")
                        return [2 /*return*/];
                    throw error_3;
                case 3:
                    _i = 0, entries_1 = entries;
                    _a.label = 4;
                case 4:
                    if (!(_i < entries_1.length)) return [3 /*break*/, 9];
                    entry = entries_1[_i];
                    full = (0, node_path_1.join)(path, entry.name);
                    if (!entry.isDirectory()) return [3 /*break*/, 6];
                    if (skippedDirs.has(entry.name))
                        return [3 /*break*/, 8];
                    return [4 /*yield*/, scan(full, include, check)];
                case 5:
                    _a.sent();
                    return [3 /*break*/, 8];
                case 6:
                    if (!include.test(entry.name))
                        return [3 /*break*/, 8];
                    return [4 /*yield*/, (0, promises_1.readFile)(full, "utf8")];
                case 7:
                    text = _a.sent();
                    check(full, text);
                    _a.label = 8;
                case 8:
                    _i++;
                    return [3 /*break*/, 4];
                case 9: return [2 /*return*/];
            }
        });
    });
}
