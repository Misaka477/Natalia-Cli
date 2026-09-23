"use strict";
var __makeTemplateObject = (this && this.__makeTemplateObject) || function (cooked, raw) {
    if (Object.defineProperty) { Object.defineProperty(cooked, "raw", { value: raw }); } else { cooked.raw = raw; }
    return cooked;
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.SUBSTRATE_PACKAGE_ROOT = exports.HOST_LAYER_PACKAGES = exports.migratedPluginRules = exports.forbiddenFrameworkPluginSurface = exports.frameworkSubsystemFiles = exports.frameworkSubsystemRoots = void 0;
exports.findForbiddenRepositoryPathViolation = findForbiddenRepositoryPathViolation;
exports.findFrameworkPluginSurfaceViolation = findFrameworkPluginSurfaceViolation;
exports.findRuntimePluginCatalogViolation = findRuntimePluginCatalogViolation;
exports.findClientServiceContractViolation = findClientServiceContractViolation;
exports.findClientPluginSurfaceViolation = findClientPluginSurfaceViolation;
exports.findClientToolDependencyViolation = findClientToolDependencyViolation;
exports.findClientProductDependencyViolation = findClientProductDependencyViolation;
exports.findClientClosureViolation = findClientClosureViolation;
exports.findTeamPluginDependencyViolation = findTeamPluginDependencyViolation;
exports.findMigratedPluginViolations = findMigratedPluginViolations;
exports.findPolicyHostDependencyViolation = findPolicyHostDependencyViolation;
exports.findCompositionKernelViolation = findCompositionKernelViolation;
exports.findSubstratePurityViolation = findSubstratePurityViolation;
var migrated_plugin_rules_1_1 = require("./migrated-plugin-rules-1");
var migrated_plugin_rules_2_1 = require("./migrated-plugin-rules-2");
var migrated_plugin_rules_3_1 = require("./migrated-plugin-rules-3");
var migrated_plugin_rules_4_1 = require("./migrated-plugin-rules-4");
var forbiddenRepositoryPaths = new Map([
    [
        "packages/agent-plugin/package.json",
        "deleted agent re-export facade must not be recreated",
    ],
    [
        "packages/skills/package.json",
        "merged skills implementation package must not be recreated",
    ],
    [
        "packages/skills/src/index.ts",
        "merged skills implementation package must not be recreated",
    ],
    [
        "packages/mcp/package.json",
        "merged MCP implementation package must not be recreated",
    ],
    [
        "packages/mcp/src/index.ts",
        "merged MCP implementation package must not be recreated",
    ],
    [
        "packages/framework/client/src/runtime-assembly.ts",
        "deleted runtime assembly seam must not be recreated",
    ],
    [
        "packages/builtin-plugins/package.json",
        "deleted built-in plugin classification must not be recreated",
    ],
    [
        "packages/builtin-tool-plugins/package.json",
        "deleted built-in tool plugin classification must not be recreated",
    ],
    [
        "packages/sandbox-plugin/package.json",
        "merged sandbox controller package must not be recreated",
    ],
    [
        "packages/tool-agent/package.json",
        "merged subagent tool plugin package must not be recreated",
    ],
    [
        "packages/subagent/package.json",
        "merged subagent registry package must not be recreated",
    ],
    [
        "packages/collaboration-plugin/package.json",
        "merged collaboration framework package must not be recreated",
    ],
    [
        "apps/cli/src/transport-plugin.ts",
        "framework transport plugin wrapper must not be recreated",
    ],
    [
        "packages/checkpoint-plugin/package.json",
        "merged checkpoint package must not be recreated",
    ],
    [
        "packages/attachment-plugin/package.json",
        "merged attachments framework package must not be recreated",
    ],
    [
        "packages/context-ledger-plugin/package.json",
        "merged context ledger framework package must not be recreated",
    ],
    [
        "packages/retry-plugin/package.json",
        "merged retry framework package must not be recreated",
    ],
    [
        "packages/runtime-config-plugin/package.json",
        "merged runtime config framework package must not be recreated",
    ],
    [
        "packages/tool-pipeline-plugin/package.json",
        "merged tool policy framework package must not be recreated",
    ],
    [
        "packages/workspace-plugin/package.json",
        "merged workspace framework package must not be recreated",
    ],
    [
        "packages/compaction-plugin/package.json",
        "merged compaction framework package must not be recreated",
    ],
    [
        "packages/session-store-plugin/package.json",
        "merged session store framework package must not be recreated",
    ],
    [
        "packages/provider-model-plugin/package.json",
        "merged provider/model framework package must not be recreated",
    ],
    [
        "packages/turn-orchestration-plugin/package.json",
        "merged turn orchestration framework package must not be recreated",
    ],
    [
        "packages/runtime-ui-plugin/package.json",
        "merged runtime status framework package must not be recreated",
    ],
    [
        "packages/work-ledger-plugin/package.json",
        "merged work ledger framework package must not be recreated",
    ],
    [
        "packages/governance-ledger-plugin/package.json",
        "merged governance ledger framework package must not be recreated",
    ],
]);
/** Prevent deleted transitional architecture seams from being recreated. */
function findForbiddenRepositoryPathViolation(path) {
    return forbiddenRepositoryPaths.get(path.replaceAll("\\", "/"));
}
/**
 * Runtime semantics that must remain present when every product plugin is
 * removed. These subsystems are barred from the plugin lifecycle surface:
 * no imports of the plugin kernel, no manifest/entry/API types, no plugin ID
 * constants and no `plugins.enabled` gates.
 */
exports.frameworkSubsystemRoots = [
    "packages/framework/agent/src",
    "packages/framework/attachments/src",
    "packages/framework/checkpoint/src",
    "packages/framework/collaboration/src",
    "packages/framework/compaction/src",
    "packages/domains/context-ledger/src",
    "packages/domains/governance-ledger/src",
    "packages/framework/provider-model/src",
    "packages/framework/retry/src",
    "packages/framework/runtime-config/src",
    "packages/framework/runtime-status/src",
    "packages/framework/sandbox/src",
    "packages/tooling/sdk/src",
    "packages/framework/session/src",
    "packages/framework/session-store/src",
    "packages/framework/subagents/src",
    "packages/framework/tool-policy/src",
    "packages/hosts/transport/src",
    "packages/framework/turn-orchestration/src",
    "packages/domains/work-ledger/src",
    "packages/framework/workspace/src",
];
exports.frameworkSubsystemFiles = ["apps/cli/src/transport-host.ts"];
exports.forbiddenFrameworkPluginSurface = [
    /from\s+["']@natalia\/plugin(?:[\/"'])/u,
    /\b(?:PluginManifest|DesiredPluginEntry|PluginAPI)\b/u,
    /\b[A-Z][A-Z0-9_]*_PLUGIN_ID\b/u,
    /plugins\.enabled\s*\[/u,
];
/**
 * A framework subsystem must stay free of the plugin lifecycle surface. The
 * path is repository-relative; the guard passes the scanned root and the host
 * file through this so coverage stays visible to unit tests. Collaboration and
 * work-ledger are framework-owned, so they must remain covered by these checks
 * even though they may not import the team plugin either.
 */
function findFrameworkPluginSurfaceViolation(path, text) {
    var normalized = path.replaceAll("\\", "/");
    var covered = exports.frameworkSubsystemRoots.some(function (root) { return normalized.startsWith(root); }) ||
        exports.frameworkSubsystemFiles.includes(normalized);
    if (!covered)
        return undefined;
    for (var _i = 0, forbiddenFrameworkPluginSurface_1 = exports.forbiddenFrameworkPluginSurface; _i < forbiddenFrameworkPluginSurface_1.length; _i++) {
        var pattern = forbiddenFrameworkPluginSurface_1[_i];
        if (pattern.test(text))
            return "framework subsystem must not expose plugin lifecycle or enable gates ".concat(pattern);
    }
    return undefined;
}
var productPluginImport = /from\s+["']@natalia\/plugin-[a-z-]+["']/u;
var productPluginFactory = /\bcreate[A-Z][A-Za-z0-9]*Plugin\s*\(/u;
var migratedServiceImport = new RegExp(String.raw(templateObject_1 || (templateObject_1 = __makeTemplateObject(["(?:import|export)s*(?:types*)?{[^}]*\b(?:AttachmentService|CheckpointFactory|CompactionService|ContextLedgerFactory|GovernanceLedgerController|InteractiveWaiter|McpService|ProviderModelController|RetryService|SandboxService|SessionStoreController|StatusSnapshotController|SubagentsService|TerminalController|ToolPolicyService|TurnController|WorkLedgerController|WorkspaceFilesController|MutationRegistry|WorkspaceWriteLock)\b[^}]*}s*froms*[\"']@natalia/(?:(?:collaboration|compaction|governance-ledger|mcp|native-terminal|provider-model|runtime-ui|session-store|subagents|terminal|turn-orchestration|work-ledger)-plugin|plugin-native-terminal)[\"']"], ["(?:import|export)\\s*(?:type\\s*)?\\{[^}]*\\b(?:AttachmentService|CheckpointFactory|CompactionService|ContextLedgerFactory|GovernanceLedgerController|InteractiveWaiter|McpService|ProviderModelController|RetryService|SandboxService|SessionStoreController|StatusSnapshotController|SubagentsService|TerminalController|ToolPolicyService|TurnController|WorkLedgerController|WorkspaceFilesController|MutationRegistry|WorkspaceWriteLock)\\b[^}]*\\}\\s*from\\s*[\"']@natalia\\/(?:(?:collaboration|compaction|governance-ledger|mcp|native-terminal|provider-model|runtime-ui|session-store|subagents|terminal|turn-orchestration|work-ledger)-plugin|plugin-native-terminal)[\"']"]))), "u");
/** Keep product factory assembly in runtime's ordinary desired catalog. */
function findRuntimePluginCatalogViolation(path, text) {
    var normalized = path.replaceAll("\\", "/");
    if (normalized.startsWith("packages/tooling/testing/"))
        return undefined;
    if (normalized.startsWith("packages/framework/client/src/runtime/") &&
        (productPluginImport.test(text) || productPluginFactory.test(text)))
        return "runtime product plugin assembly belongs in the ordinary desired catalog";
    if (/\b(?:builtinPluginCatalog|computeBuiltinPluginGates|computeBuiltinFeatureGates|DefaultPluginEntry)\b/u.test(text))
        return "built-in plugin classification must not be recreated";
    return undefined;
}
/** Runtime service definitions are owned by the shared definition package. */
function findClientServiceContractViolation(path, text) {
    if (path.startsWith("packages/framework/client/src/") &&
        migratedServiceImport.test(text))
        return "client must import migrated service types and keys from @natalia/runtime-services";
    return undefined;
}
var migratedClientPluginSurface = new RegExp(String.raw(templateObject_2 || (templateObject_2 = __makeTemplateObject(["(?:import|export)s*(?:types*)?{[^}]*\b(?:parseToolArguments|tryParseToolArguments|createToolPolicyHookLayer|ToolPolicyHookLayer|WorkflowExecutionEventStream|WorkflowExecutionEvent|WorkflowExecutionHandle|WorkflowExecutionStatus|WorkflowExecutionSchedulerService)\b[^}]*}s*froms*[\"']@natalia/(?:plugin-[a-z-]+|[a-z-]+-plugin)[\"']"], ["(?:import|export)\\s*(?:type\\s*)?\\{[^}]*\\b(?:parseToolArguments|tryParseToolArguments|createToolPolicyHookLayer|ToolPolicyHookLayer|WorkflowExecutionEventStream|WorkflowExecutionEvent|WorkflowExecutionHandle|WorkflowExecutionStatus|WorkflowExecutionSchedulerService)\\b[^}]*\\}\\s*from\\s*[\"']@natalia\\/(?:plugin-[a-z-]+|[a-z-]+-plugin)[\"']"]))), "u");
var clientProviderPluginIDImport = new RegExp(String.raw(templateObject_3 || (templateObject_3 = __makeTemplateObject(["(?:import|export)s*(?:types*)?{[^}]*\b[A-Z][A-Z0-9_]*_PLUGIN_ID\b[^}]*}s*froms*[\"']@natalia/(?:plugin-[a-z-]+|[a-z-]+-plugin)[\"']"], ["(?:import|export)\\s*(?:type\\s*)?\\{[^}]*\\b[A-Z][A-Z0-9_]*_PLUGIN_ID\\b[^}]*\\}\\s*from\\s*[\"']@natalia\\/(?:plugin-[a-z-]+|[a-z-]+-plugin)[\"']"]))), "u");
var runtimeCompositionRoot = "packages/framework/client/src/runtime/main.ts";
var runtimeCompositionDirectory = "packages/framework/client/src/runtime/composition/";
function isRuntimeCompositionPath(path) {
    return (path === runtimeCompositionRoot ||
        path.startsWith(runtimeCompositionDirectory));
}
/** Pure contracts and helpers must not be sourced from provider packages. */
function findClientPluginSurfaceViolation(path, text) {
    var normalized = path.replaceAll("\\", "/");
    if (isRuntimeCompositionPath(normalized) &&
        /(?:from\s+|import\s*\()\s*["']@natalia\/[^"']*-plugin["']/u.test(text))
        return "client runtime composition root must not import provider plugin packages";
    if (/packages\/framework\/client\/(?:src|test)\//u.test(normalized) &&
        (migratedClientPluginSurface.test(text) ||
            clientProviderPluginIDImport.test(text)))
        return "client imports a migrated pure surface or plugin ID from a plugin package";
    return undefined;
}
var clientToolImplementationImport = /(?:from\s+|import\s*\(|require\s*\()\s*["']@natalia\/tool-(?!pipeline-plugin["'])(?!policy["'])[a-z-]+["']/u;
var clientToolImplementationDependency = /["']@natalia\/tool-(?!pipeline-plugin["'])(?!policy["'])[a-z-]+["']/u;
var clientToolImplementationReference = /["']\.\.\/tool-(?!pipeline-plugin["'])(?!policy["'])[a-z-]+["']/u;
/** Keep concrete tool implementations outside the client package boundary. */
function findClientToolDependencyViolation(path, text) {
    var normalized = path.replaceAll("\\", "/");
    if (/packages\/framework\/client\/(?:src|test)\//u.test(normalized) &&
        clientToolImplementationImport.test(text))
        return "client project imports a concrete tool package";
    if (normalized === "packages/framework/client/package.json")
        return undefined;
    if (normalized === "packages/framework/client/tsconfig.json")
        return undefined;
    return undefined;
}
/**
 * Keep concrete product packages outside the client boundary once a plugin
 * package owns them. The list grows as each controller is extracted; an entry
 * must not be added until the client no longer imports the package anywhere.
 */
var clientProductPackages = [
    "agent-plugin",
    "mcp",
    "plugin-native-terminal",
    "skills",
    "subagent",
];
/** Keep concrete product packages outside the client package boundary. */
function findClientProductDependencyViolation(path, text) {
    var normalized = path.replaceAll("\\", "/");
    var alternation = clientProductPackages.join("|");
    var importPattern = new RegExp("(?:from\\s+|import\\s*\\(|require\\s*\\()\\s*[\"']@natalia\\/(?:".concat(alternation, ")[\"']"), "u");
    var dependencyPattern = new RegExp("[\"']@natalia\\/(?:".concat(alternation, ")[\"']"), "u");
    var referencePattern = new RegExp("[\"']\\.\\.\\/(?:".concat(alternation, ")[\"']"), "u");
    if (/packages\/framework\/client\/(?:src|test)\//u.test(normalized) &&
        importPattern.test(text))
        return "client project imports a concrete product package";
    if (normalized === "packages/framework/client/package.json" &&
        dependencyPattern.test(text))
        if (/@natalia\/plugin-[a-z-]+["']/u.test(text))
            return undefined;
        else
            return "client manifest depends on a concrete product package";
    if (normalized === "packages/framework/client/tsconfig.json" &&
        referencePattern.test(text))
        if (/\.\.\/plugin-[a-z-]+["']/u.test(text) ||
            /\.\.\/[a-z-]+-plugin["']/u.test(text))
            return undefined;
        else
            return "client TypeScript project references a concrete product package";
    return undefined;
}
/**
 * Runtime configuration may depend on ordinary plugin packages so it can
 * declare the product's initial desired graph. No bundle gets privileged.
 */
var clientClosureAllowlist = [
    "agent",
    "agent-prompts",
    "attachments",
    "capability",
    "checkpoint",
    "collaboration",
    "compaction",
    "composition",
    "config",
    "confinement",
    "operation-log",
    "substrate",
    "rina",
    "runtime-diagnostics",
    "context-ledger",
    "contracts",
    "goal",
    "governance-ledger",
    "platform",
    "plugin",
    "provider-model",
    "retry",
    "runtime",
    "runtime-config",
    "runtime-services",
    "runtime-status",
    "sandbox",
    "session",
    "session-store",
    "subagents",
    "terminal",
    "testing",
    "tool-policy",
    "tools",
    "turn-orchestration",
    "ui-model",
    "work-ledger",
    "workspace",
];
/** Keep the client dependency closure free of non-kernel product packages. */
/**
 * The package's bare name under either prefix — the closure check covers
 * both worlds (P3 moves mechanisms to @anthelia; round 41 silently
 * un-guarded them here by testing only @natalia/, which this restores).
 */
function bareDep(name) {
    if (name.startsWith("@anthelia/"))
        return name.slice(10);
    if (name.startsWith("@natalia/"))
        return name.slice(9);
    return undefined;
}
function findClientClosureViolation(path, text) {
    var _a;
    var normalized = path.replaceAll("\\", "/");
    var allowed = new Set(clientClosureAllowlist);
    if (normalized === "packages/framework/client/package.json") {
        var manifest = JSON.parse(text.trimStart().startsWith("{") ? text : "{\"dependencies\":{".concat(text, "}}"));
        for (var _i = 0, _b = Object.keys((_a = manifest.dependencies) !== null && _a !== void 0 ? _a : {}); _i < _b.length; _i++) {
            var name_1 = _b[_i];
            if (name_1 === "@natalia/builtin-plugins" ||
                name_1 === "@natalia/builtin-tool-plugins")
                return "client manifest recreates deleted plugin classification ".concat(name_1);
            else if (bareDep(name_1) !== undefined &&
                !allowed.has(bareDep(name_1)) &&
                !name_1.startsWith("@natalia/plugin-"))
                return "client manifest depends on non-kernel package ".concat(name_1);
        }
    }
    return undefined;
}
/**
 * Phase 2 boundary (convergence plan §6.2): Chat, Collaboration and Plan stay
 * framework-owned while `@natalia/plugin-team` remains a true plugin, reachable
 * only through the installed desired catalog. Collaboration, work-ledger and
 * the client runtime may not name the concrete team plugin package.
 */
var teamPluginBoundaryRoots = [
    "packages/framework/collaboration/src/",
    "packages/framework/collaboration/test/",
    "packages/domains/work-ledger/src/",
    "packages/domains/work-ledger/test/",
];
var teamPluginPackageImport = /(?:from\s+|import\s*\(|require\s*\()\s*["']@natalia\/plugin-team(?:[\/"'])/u;
var teamPluginImplementationImport = /(?:from\s+|import\s*\(|require\s*\()\s*["'][^"']*team-plugin[^"']*["']/u;
/**
 * Framework domains and the client runtime must not depend on the team plugin.
 * The client package itself may declare the dependency (the catalog uses it);
 * only the plugin catalog directory may import it.
 */
function findTeamPluginDependencyViolation(path, text) {
    var normalized = path.replaceAll("\\", "/");
    var inFrameworkDomain = teamPluginBoundaryRoots.some(function (root) {
        return normalized.startsWith(root);
    });
    var inClientRuntime = normalized.startsWith("packages/framework/client/src/runtime/");
    if (!inFrameworkDomain && !inClientRuntime)
        return undefined;
    if (teamPluginPackageImport.test(text))
        return "framework domain or client runtime imports the team plugin package";
    if (teamPluginImplementationImport.test(text))
        return "framework domain or client runtime imports a concrete team plugin implementation";
    return undefined;
}
exports.migratedPluginRules = __spreadArray(__spreadArray(__spreadArray(__spreadArray([], migrated_plugin_rules_1_1.migratedPluginRules1, true), migrated_plugin_rules_2_1.migratedPluginRules2, true), migrated_plugin_rules_3_1.migratedPluginRules3, true), migrated_plugin_rules_4_1.migratedPluginRules4, true);
function findMigratedPluginViolations(path, text, rules) {
    if (rules === void 0) { rules = exports.migratedPluginRules; }
    var normalized = path.replaceAll("\\", "/");
    var violations = [];
    for (var _i = 0, rules_1 = rules; _i < rules_1.length; _i++) {
        var rule = rules_1[_i];
        var protectsRuntimeComposition = rule.targets.includes(runtimeCompositionRoot);
        if (!rule.targets.includes(normalized) &&
            !(protectsRuntimeComposition && isRuntimeCompositionPath(normalized)))
            continue;
        for (var _a = 0, _b = rule.forbidden; _a < _b.length; _a++) {
            var forbidden = _b[_a];
            if (forbidden.pattern.test(text))
                violations.push({
                    pluginID: rule.id,
                    description: forbidden.description,
                });
        }
    }
    return violations;
}
/**
 * decisions §1.1/§1.2 + master plan P3: product policy never depends on
 * the host layer (hosts are the engine's platform adapters; policy talks
 * to the engine's API and its siblings, never to platform plumbing).
 * Deep imports are already banned globally (the deep-import rule); this
 * is the direction ban, scoped to domains (the policy-fold sublayer) —
 * extend the scan roots as P3 moves policy into their own packages.
 * Keep the list in step with packages/hosts/.
 */
exports.HOST_LAYER_PACKAGES = [
    "@natalia/config",
    "@natalia/confinement",
    "@natalia/installer",
    "@natalia/object-store",
    "@natalia/platform",
    "@natalia/transport",
    "@natalia/ui-host",
    "@natalia/view-store",
];
function findPolicyHostDependencyViolation(specifier, file) {
    if (!file.startsWith("packages/domains/"))
        return undefined;
    if (!file.includes("/src/"))
        return undefined; // tests may reach anywhere
    var hit = exports.HOST_LAYER_PACKAGES.find(function (name) { return specifier === name || specifier.startsWith("".concat(name, "/")); });
    if (hit)
        return "product policy (domains) must not depend on the host layer: imports ".concat(hit);
    return undefined;
}
/**
 * master plan P3 row (composition 归内核) + interface spec's substrate list:
 * the generation-switch/composition machinery is ENGINE substrate, so
 * `@natalia/composition` must resolve into the kernel layer
 * (packages/core/...) — checked against the paths map, which is the one
 * place the placement is declared.
 */
function findCompositionKernelViolation(pathsEntry) {
    if (!pathsEntry)
        return "@natalia/composition is missing from tsconfig.base paths";
    var first = Array.isArray(pathsEntry) ? pathsEntry[0] : pathsEntry;
    if (!(first === null || first === void 0 ? void 0 : first.startsWith("packages/core/")))
        return "composition must live in the kernel layer (packages/core/...), paths says ".concat(first);
    return undefined;
}
/**
 * Substrate purity (master plan P3, decisions §1.1): substrate material
 * knows no product concept. The list grows as `framework/client` is split
 * — context.ts first, then the port files, then the initialize assembly —
 * so each extraction step extends the machine-checked boundary instead of
 * trusting review.
 *
 * The banned set is §1.1's NAMED forbidden CONCEPTS (goal/协作/治理/UI)
 * as packages. The policy COLUMN governs prefix ownership — a package can
 * stay @natalia while the engine legitimately imports its types;
 * `context-ledger` is exactly that case (the runtime's context-window/
 * epoch machinery underpins exec/initialize/ports — its `plan_handoff`
 * kind is policy flavor, not the concept ban). Import bans name concepts,
 * not bands — the extraction's inventory proved the over-reach. `@natalia/
 * collaboration` is deliberately NOT banned: that package hosts
 * InteractiveWaiter (human-in-turn machinery any agent needs); the policy
 * collaboration (Navi/Nia) lives in client's runtime/collaboration and
 * cannot be imported from here anyway (relative paths).
 */
exports.SUBSTRATE_PACKAGE_ROOT = "packages/framework/substrate/src/";
var POLICY_PACKAGES_IN_SUBSTRATE = [
    "goal",
    "governance-ledger",
    "work-ledger",
];
function findSubstratePurityViolation(file, text) {
    // Every file in the extracted package is substrate material (the list
    // grew with the extraction: whole package, not an enumerated subset).
    if (!file.startsWith(exports.SUBSTRATE_PACKAGE_ROOT))
        return undefined;
    for (var _i = 0, POLICY_PACKAGES_IN_SUBSTRATE_1 = POLICY_PACKAGES_IN_SUBSTRATE; _i < POLICY_PACKAGES_IN_SUBSTRATE_1.length; _i++) {
        var name_2 = POLICY_PACKAGES_IN_SUBSTRATE_1[_i];
        if (new RegExp("from [\"']@natalia/".concat(name_2, "[\"']"), "u").test(text))
            return "substrate core (".concat(file, ") imports policy package @natalia/").concat(name_2, " \u2014 policy belongs in product-context");
    }
    return undefined;
}
var templateObject_1, templateObject_2, templateObject_3;
