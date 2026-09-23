"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createCompositionContext = createCompositionContext;
var node_crypto_1 = require("node:crypto");
var node_path_1 = require("node:path");
var capability_1 = require("@natalia/capability");
var runtime_services_1 = require("@natalia/runtime-services");
var runtime_1 = require("@natalia/runtime");
var tools_1 = require("@anthelia/tools");
var substrate_1 = require("@anthelia/substrate");
var service_bindings_1 = require("./service-bindings");
var provider_selection_1 = require("../provider-selection");
function createCompositionContext(options) {
    var _a, _b, _c, _d, _e;
    var permissionMode = (_a = options.permissionMode) !== null && _a !== void 0 ? _a : "ask";
    var executionBySession = new Map();
    var turnSession = new Map();
    var runtimeDiagnostics = [];
    var runtimeDiagnosticsBySession = new Map();
    var capabilityRegistry = (_b = options.capabilityRegistry) !== null && _b !== void 0 ? _b : new capability_1.CapabilityRegistry();
    var state = {
        runtimeDisposed: false,
        workspaceRoot: (0, node_path_1.resolve)((_c = options.workspaceRoot) !== null && _c !== void 0 ? _c : process.cwd()),
        pluginStoreRoot: options.pluginStoreRoot
            ? (0, node_path_1.resolve)(options.pluginStoreRoot)
            : undefined,
        provider: options.provider,
        chatDefaultProvider: options.provider,
        providerSource: options.provider ? "explicit" : "unconfigured",
        capabilityRegistry: capabilityRegistry,
        serviceDirectory: new runtime_services_1.ServiceDirectory((0, service_bindings_1.createCapabilityServiceBindings)(capabilityRegistry)),
        capabilityHost: options.capabilityHost,
        workspaceCapabilityView: (_d = options.capabilityHost) === null || _d === void 0 ? void 0 : _d.view,
        tools: (_e = options.tools) !== null && _e !== void 0 ? _e : (0, tools_1.createToolRegistry)([]),
        permissionMode: permissionMode,
        defaultPermissionMode: permissionMode,
        toolCalls: new Map(),
        replayMode: "all",
        turnSession: turnSession,
        liveMainOutputByTurn: new Map(),
        turnAgent: new Map(),
        executionBySession: executionBySession,
        paused: false,
        pauseWaiters: [],
        attachmentReferences: new Map(),
        runtimeDiagnosticsBySession: runtimeDiagnosticsBySession,
        runtimeDiagnostics: runtimeDiagnostics,
        sessionPersistence: Promise.resolve(),
        sessionPersistenceBySession: new Map(),
        nativeRuntimeID: (0, node_crypto_1.randomUUID)(),
        contextWindowResolver: new runtime_1.ContextWindowResolver({
            cacheFile: options.contextWindowCachePath,
        }),
        runtimeContextConfig: (0, provider_selection_1.defaultContextStatusConfig)(),
        providerConcurrencyLimiter: new runtime_1.ProviderConcurrencyLimiter({}),
        terminalStatusByID: new Map(),
        performanceTrace: new substrate_1.RuntimePerformanceTrace(),
        sandboxResourcesByID: new Map(),
        activeToolByTurn: new Map(),
        sessionSnapshotSequence: 0,
        decisionSequence: 0,
        evidenceSequence: 0,
        mailboxSequence: 0,
        chatSequence: 0,
        collabSequence: 0,
        internalWakeTasks: new Set(),
        planSequence: 0,
        completionSequence: 0,
        titleGenerationTasks: new Map(),
    };
    return {
        state: state,
        ports: {},
    };
}
