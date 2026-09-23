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
Object.defineProperty(exports, "__esModule", { value: true });
exports.wireFrameworkServices = wireFrameworkServices;
/**
 * Framework subsystem composition — runtime/initialize/framework-services.ts.
 *
 * Sandbox, checkpoint, runtime config, retry, context ledger, attachments,
 * workspace, tool policy, compaction, session store, provider/model execution,
 * turn orchestration, runtime status, work ledger and governance ledger are
 * framework-internal subsystems, not plugins. This module is the one direct
 * composition seam: it constructs their controllers/services from the framework
 * packages and registers the same service contracts the plugin wrappers used to
 * provide, so every runtime consumer keeps resolving the kernel services
 * unchanged. The host owns close and reload (config refresh) through the
 * returned handle.
 */
var attachments_1 = require("@anthelia/attachments");
var checkpoint_1 = require("@anthelia/checkpoint");
var compaction_1 = require("@anthelia/compaction");
var context_ledger_1 = require("@natalia/context-ledger");
var runtime_config_1 = require("@natalia/runtime-config");
var runtime_1 = require("@natalia/runtime");
var retry_1 = require("@anthelia/retry");
var compaction_2 = require("@anthelia/compaction");
var checkpoint_2 = require("@anthelia/checkpoint");
var context_ledger_2 = require("@natalia/context-ledger");
var sandbox_1 = require("@anthelia/sandbox");
var subagents_1 = require("@anthelia/subagents");
var tool_policy_1 = require("@natalia/tool-policy");
var collaboration_1 = require("@natalia/collaboration");
var rina_1 = require("@natalia/rina");
var node_path_1 = require("node:path");
var operation_log_1 = require("@natalia/operation-log");
var runtime_diagnostics_1 = require("@natalia/runtime-diagnostics");
var runtime_services_1 = require("@natalia/runtime-services");
var session_1 = require("@anthelia/session");
var governance_ledger_1 = require("@natalia/governance-ledger");
var work_ledger_1 = require("@natalia/work-ledger");
var platform_1 = require("@natalia/platform");
var session_history_tool_1 = require("../session-history-tool");
var plan_doc_tools_1 = require("../plan-doc-tools");
var collab_1 = require("@natalia/collab");
var work_graph_tools_1 = require("../work-graph-tools");
var generation_tools_1 = require("../generation-tools");
var attachments_2 = require("@anthelia/attachments");
var record_tools_1 = require("../record-tools");
var workspace_1 = require("@anthelia/workspace");
var runtime_services_2 = require("@natalia/runtime-services");
var framework_governance_ledger_1 = require("./framework-governance-ledger");
var framework_provider_model_1 = require("./framework-provider-model");
var framework_runtime_status_1 = require("./framework-runtime-status");
var framework_session_store_1 = require("./framework-session-store");
var framework_turn_orchestration_1 = require("./framework-turn-orchestration");
var framework_work_ledger_1 = require("./framework-work-ledger");
function wireFrameworkServices(ctx, options) {
    return __awaiter(this, void 0, void 0, function () {
        function refreshRuntimeConfig() {
            var config = ctx.ports.getTsRuntimeConfig();
            runtimeConfigDispose === null || runtimeConfigDispose === void 0 ? void 0 : runtimeConfigDispose();
            runtimeConfigDispose = config
                ? runtimeConfigOwner.contribute("services", runtime_config_1.RUNTIME_CONFIG_SERVICE, config)
                : undefined;
        }
        function refreshPluginInputs() {
            var _a;
            for (var _i = 0, _b = pluginInputDisposers.splice(0).reverse(); _i < _b.length; _i++) {
                var disposeInput = _b[_i];
                disposeInput();
            }
            var config = ctx.ports.getTsRuntimeConfig();
            if (!config)
                return;
            // Host inputs bind through the service directory: one owner per binding
            // with the same dispose-then-provide reload semantics the owner channel
            // had, and the wire name is the token's id on both sides of the boundary.
            var provide = function (token, value) {
                if (value !== undefined)
                    pluginInputDisposers.push(ctx.state.serviceDirectory.provide(token, value));
            };
            provide(runtime_services_2.localToolsInput, ctx.state.initialize.localToolsPluginInput(config));
            provide(runtime_services_2.mcpInput, ctx.state.initialize.mcpPluginInput(config));
            provide(runtime_services_2.skillsInput, ctx.state.initialize.skillsPluginInput(config));
            var terminal = __assign({ workspaceRoot: workspaceRoot, publish: function (event) {
                    return ctx.ports.publishForSession(event.sessionID
                        ? ctx.ports
                            .getExecutionBySession()
                            .get(event.sessionID)
                        : undefined, event);
                }, onPerformance: function (name, durationMs) {
                    return ctx.ports.getPerformanceTrace().mark(name, durationMs);
                }, runtimeID: ctx.ports.getNativeRuntimeID, userRuntimeHome: ctx.ports.getUserRuntimeHome, windowMode: function () { var _a, _b; return (_b = (_a = ctx.ports.getTsRuntimeConfig()) === null || _a === void 0 ? void 0 : _a.runtime.terminal.windowMode) !== null && _b !== void 0 ? _b : "auto"; }, backend: options.nativeTerminal
                    ? "wezterm"
                    : ((_a = ctx.ports.getTsRuntimeConfig()) === null || _a === void 0 ? void 0 : _a.runtime.terminal.backend) === "wezterm"
                        ? "wezterm"
                        : "pty" }, (options.nativeTerminal ? { external: options.nativeTerminal } : {}));
            provide(runtime_services_2.terminalInput, terminal);
        }
        var registry, workspaceRoot, moved, error_1, closeHandles, dispose, sandboxOwner, sandbox, _i, _a, tool, subagentsOwner, subagents, agentTypeViews, _b, _c, tool, collaborationOwner, collaborationEventsFor, collaborationService, _d, _e, tool, sessionHistoryTool, _f, _g, tool, checkpointOwner, factory, _h, _j, name_1, runtimeConfigDispose, runtimeConfigOwner, pluginInputDisposers, retry, contextLedgerOwner, contextLedgerFactory, attachmentOwner, attachments, workspaceOwner, mutations, files, error_2, cacheFabric, _k, L1_CACHE_KINDS_1, kind, telemetry, publishFinding, diagnostics, toolPolicyOwner, compactionOwner, compaction, sessionStore, providerModel, turnOrchestration, runtimeStatus;
        var _this = this;
        var _l, _m, _o, _p;
        return __generator(this, function (_q) {
            switch (_q.label) {
                case 0:
                    registry = ctx.state.capabilityRegistry;
                    workspaceRoot = ctx.ports.getWorkspaceRoot();
                    if (!(options.checkpointDir === undefined && options.sessionDir === undefined)) return [3 /*break*/, 4];
                    _q.label = 1;
                case 1:
                    _q.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, (0, platform_1.migrateLegacyWorkspaceStore)(workspaceRoot)];
                case 2:
                    moved = _q.sent();
                    if (moved > 0)
                        ctx.ports.publish({
                            type: "diagnostic",
                            level: "info",
                            message: "checkpoint store migrated to the external store (".concat(moved, " moved)"),
                        });
                    return [3 /*break*/, 4];
                case 3:
                    error_1 = _q.sent();
                    // An unwritable home must not stop the boot and must not pretend:
                    // the store resolves workspace-local (every path resolver degrades the
                    // same way) and this line is the visible record that the rescue ring
                    // is tied to this workspace for now.
                    ctx.ports.publish({
                        type: "diagnostic",
                        level: "warning",
                        message: "external store unavailable (".concat(error_1 instanceof Error ? error_1.message : String(error_1), "); checkpoint store runs workspace-local \u2014 the rescue ring is tied to this workspace"),
                    });
                    return [3 /*break*/, 4];
                case 4:
                    closeHandles = [];
                    dispose = function () {
                        for (var _i = 0, _a = closeHandles.reverse(); _i < _a.length; _i++) {
                            var handle = _a[_i];
                            handle();
                        }
                    };
                    sandboxOwner = registry.registerOwner({
                        id: "natalia-sandbox",
                        name: "Sandbox",
                        version: "1.0.0",
                        scope: "workspace",
                        grants: ["services", "tools"],
                    });
                    sandbox = (0, sandbox_1.createSandboxController)({
                        workspaceRoot: workspaceRoot,
                        backend: function () { var _a; return (_a = ctx.ports.getTsRuntimeConfig()) === null || _a === void 0 ? void 0 : _a.sandbox.backend; },
                    });
                    // The service binds through the directory; the owner stays for the tools
                    // contribution below.
                    ctx.state.serviceDirectory.provide(runtime_services_2.sandboxService, sandbox);
                    for (_i = 0, _a = (0, sandbox_1.sandboxTools)(); _i < _a.length; _i++) {
                        tool = _a[_i];
                        sandboxOwner.contribute("tools", tool.name, tool);
                        if (ctx.state.tools.get(tool.name))
                            throw new Error("framework tool already registered: ".concat(tool.name));
                        ctx.state.tools.set(tool.name, tool);
                    }
                    subagentsOwner = registry.registerOwner({
                        id: "natalia-subagents",
                        name: "Subagents",
                        version: "1.0.0",
                        scope: "workspace",
                        grants: ["services", "tools"],
                    });
                    subagents = (0, subagents_1.createSubagentsController)({
                        workDir: workspaceRoot,
                        sessionID: ctx.ports.getSessionID,
                        // Bounds a run that is stuck rather than merely slow: without it such a run
                        // continues until the session ends, paying for every step it takes.
                        wallClockBudgetMs: (_l = ctx.ports.getTsRuntimeConfig()) === null || _l === void 0 ? void 0 : _l.runtime.subagentWallClockMs,
                    });
                    ctx.state.serviceDirectory.provide(runtime_services_2.subagentsService, subagents);
                    agentTypeViews = ((_o = (_m = ctx.ports.getAgentRegistry()) === null || _m === void 0 ? void 0 : _m.list()) !== null && _o !== void 0 ? _o : []).map(function (agent) { return ({
                        name: agent.name,
                        description: agent.description,
                        mode: agent.mode,
                        allowedTools: agent.allowedTools,
                        excludedTools: agent.excludedTools,
                    }); });
                    for (_b = 0, _c = (0, subagents_1.agentTools)(agentTypeViews); _b < _c.length; _b++) {
                        tool = _c[_b];
                        subagentsOwner.contribute("tools", tool.name, tool);
                        if (ctx.state.tools.get(tool.name))
                            throw new Error("framework tool already registered: ".concat(tool.name));
                        ctx.state.tools.set(tool.name, tool);
                    }
                    collaborationOwner = registry.registerOwner({
                        id: "natalia-collaboration",
                        name: "Collaboration",
                        version: "1.0.0",
                        scope: "workspace",
                        grants: ["services", "tools"],
                    });
                    // The waiter binds through the service directory: the token's id is the
                    // wire name this contribution always used, and the channel gives it the same
                    // per-owner disposal and update semantics the registry provides directly.
                    ctx.state.serviceDirectory.provide(collaboration_1.collaborationWaiter, (0, collaboration_1.createInteractiveWaiter)(ctx.state.waiterDeps));
                    collaborationEventsFor = function (sessionID) {
                        var exec = ctx.ports.getExecutionBySession().get(sessionID);
                        if (!exec)
                            return undefined;
                        return exec.factStateComplete === true && exec.factState
                            ? exec.factState.collaborationEvents
                            : exec.session.events;
                    };
                    collaborationService = (0, collaboration_1.createCollaborationService)({
                        events: collaborationEventsFor,
                        publish: function (sessionID, event) {
                            var exec = ctx.ports.getExecutionBySession().get(sessionID);
                            if (exec)
                                ctx.ports.publishForSession(exec, event);
                        },
                        nextSequence: ctx.ports.nextCollabSequence,
                        maxAutoRounds: function () { var _a, _b; return (_b = (_a = ctx.ports.getTsRuntimeConfig()) === null || _a === void 0 ? void 0 : _a.runtime.collaboration.maxAutoRounds) !== null && _b !== void 0 ? _b : 3; },
                    });
                    collaborationOwner.contribute("services", collaboration_1.COLLABORATION_SERVICE, collaborationService);
                    for (_d = 0, _e = (0, collaboration_1.collaborationTools)({
                        events: collaborationEventsFor,
                        publish: function (sessionID, event) {
                            var exec = ctx.ports.getExecutionBySession().get(sessionID);
                            if (exec)
                                ctx.ports.publishForSession(exec, event);
                        },
                        redact: function (text) { return ctx.ports.redactToolOutput(text, true); },
                        nextMailboxSequence: ctx.ports.nextMailboxSequence,
                        requestWake: function (sessionID, request) {
                            var _a, _b, _c;
                            var exec = ctx.ports.getExecutionBySession().get(sessionID);
                            if (!exec)
                                return;
                            var recipient = (_a = request === null || request === void 0 ? void 0 : request.recipient) !== null && _a !== void 0 ? _a : "live_chat";
                            if (recipient === "live_chat") {
                                ctx.ports.requestNaviWake(exec);
                            }
                            else if (recipient === "nia") {
                                ctx.ports.requestNiaWake(exec);
                            }
                            else {
                                ctx.ports.wakeMainForCollaboration(exec, (_b = request === null || request === void 0 ? void 0 : request.messageID) !== null && _b !== void 0 ? _b : "collab-wake", (_c = request === null || request === void 0 ? void 0 : request.kind) !== null && _c !== void 0 ? _c : "chat message", (request === null || request === void 0 ? void 0 : request.source) === "nia" ? "Nia" : "Navi");
                            }
                        },
                        maxAutoRounds: function () { var _a, _b; return (_b = (_a = ctx.ports.getTsRuntimeConfig()) === null || _a === void 0 ? void 0 : _a.runtime.collaboration.maxAutoRounds) !== null && _b !== void 0 ? _b : 3; },
                        service: collaborationService,
                    }); _d < _e.length; _d++) {
                        tool = _e[_d];
                        collaborationOwner.contribute("tools", tool.name, tool);
                        if (ctx.state.tools.get(tool.name))
                            throw new Error("framework tool already registered: ".concat(tool.name));
                        ctx.state.tools.set(tool.name, tool);
                    }
                    sessionHistoryTool = (0, session_history_tool_1.createSessionHistoryTool)(ctx);
                    if (ctx.state.tools.get(sessionHistoryTool.name))
                        throw new Error("framework tool already registered: ".concat(sessionHistoryTool.name));
                    ctx.state.tools.set(sessionHistoryTool.name, sessionHistoryTool);
                    // ADR D4/B3: the main agent reads the plan document itself — the plan正文
                    // is never injected into any prompt. Register the plan read tools so the
                    // main agent has the same plan-document access Navi and Nia have, plus the
                    // WorkContract proposal/read tools (EI §8.4).
                    for (_f = 0, _g = [
                        (0, plan_doc_tools_1.createPlanDocListTool)(ctx),
                        (0, plan_doc_tools_1.createPlanDocReadTool)(ctx),
                        (0, plan_doc_tools_1.createPlanDocTickTool)(ctx),
                        (0, plan_doc_tools_1.createPlanPauseTool)(ctx),
                        (0, collab_1.createPlanProposeTool)(ctx),
                        (0, collab_1.createWorkContractReadTool)(ctx),
                        (0, collab_1.createDetourDeclareTool)(ctx),
                        (0, work_graph_tools_1.createWorkGraphQueryTool)(ctx),
                        // EI §8.4: model-facing journal record tools.
                        (0, record_tools_1.createRecordValidationTool)(ctx),
                        (0, record_tools_1.createRecordCompletionTool)(ctx),
                        (0, record_tools_1.createRecordDecisionTool)(ctx),
                        (0, collab_1.createConstitutionProposeTool)(ctx),
                        (0, record_tools_1.createDriftAcknowledgeTool)(ctx),
                        // NGM §4.4: the L2 generation tools (propose -> apply through the
                        // four-face gate -> rollback, always allowed).
                        (0, generation_tools_1.createProposeGenerationTool)(ctx),
                        (0, generation_tools_1.createApplyGenerationTool)(ctx),
                        (0, generation_tools_1.createRollbackGenerationTool)(ctx),
                    ]; _f < _g.length; _f++) {
                        tool = _g[_f];
                        if (ctx.state.tools.get(tool.name))
                            throw new Error("framework tool already registered: ".concat(tool.name));
                        ctx.state.tools.set(tool.name, tool);
                    }
                    checkpointOwner = registry.registerOwner({
                        id: "natalia-checkpoint",
                        name: "Checkpoint",
                        version: "1.0.0",
                        scope: "workspace",
                        grants: ["services", "commands"],
                    });
                    factory = (0, checkpoint_1.createCheckpointFactory)({
                        workspaceRoot: workspaceRoot,
                        checkpointDir: options.checkpointDir,
                    });
                    ctx.state.serviceDirectory.provide(checkpoint_2.checkpointFactory, factory);
                    for (_h = 0, _j = ["checkpoint", "checkpoints", "rollback"]; _h < _j.length; _h++) {
                        name_1 = _j[_h];
                        checkpointOwner.contribute("commands", name_1, {
                            name: name_1,
                            title: "".concat(name_1[0].toUpperCase()).concat(name_1.slice(1)),
                            run: function (invocation) {
                                return __awaiter(this, void 0, void 0, function () {
                                    var sessionID, exec, controller, sandboxes, result;
                                    var _this = this;
                                    return __generator(this, function (_a) {
                                        switch (_a.label) {
                                            case 0:
                                                if (!(invocation === null || invocation === void 0 ? void 0 : invocation.sessionID))
                                                    throw new Error("checkpoint command requires a session");
                                                sessionID = invocation.sessionID;
                                                return [4 /*yield*/, ctx.ports.ensureExecution(sessionID)];
                                            case 1:
                                                exec = _a.sent();
                                                return [4 /*yield*/, ctx.ports.initializeCheckpointController(exec)];
                                            case 2:
                                                controller = _a.sent();
                                                if (!controller)
                                                    throw new Error("checkpoint controller unavailable (natalia-checkpoint)");
                                                if (!controller.isEnabled())
                                                    throw new Error("checkpoint store is not initialized");
                                                sandboxes = ctx.state.serviceDirectory.getOptional(runtime_services_2.sandboxService);
                                                return [4 /*yield*/, (0, runtime_1.runCheckpointCommand)(controller.get(), exec.context, invocation.raw, controller.rollbackOptions(), function () { return __awaiter(_this, void 0, void 0, function () {
                                                        var _a;
                                                        return __generator(this, function (_b) {
                                                            switch (_b.label) {
                                                                case 0:
                                                                    if (!sandboxes)
                                                                        throw new Error("sandbox controller unavailable");
                                                                    return [4 /*yield*/, sandboxes.referencedObjectIDs()];
                                                                case 1: return [2 /*return*/, (_a = (_b.sent())) !== null && _a !== void 0 ? _a : new Set()];
                                                            }
                                                        });
                                                    }); })];
                                            case 3:
                                                result = _a.sent();
                                                return [2 /*return*/, result.output];
                                        }
                                    });
                                });
                            },
                        });
                    }
                    runtimeConfigOwner = registry.registerOwner({
                        id: "natalia-runtime-config",
                        name: "Runtime Config",
                        version: "1.0.0",
                        scope: "workspace",
                        grants: ["services"],
                    });
                    refreshRuntimeConfig();
                    pluginInputDisposers = [];
                    refreshPluginInputs();
                    retry = (0, retry_1.createRetryService)({
                        policy: function () { return ctx.ports.getRetryPolicy(); },
                    });
                    ctx.state.serviceDirectory.provide(retry_1.retryService, retry);
                    contextLedgerOwner = registry.registerOwner({
                        id: "natalia-context-ledger",
                        name: "Context Ledger",
                        version: "1.0.0",
                        scope: "workspace",
                        grants: ["services"],
                    });
                    contextLedgerFactory = (0, context_ledger_1.createContextLedgerFactory)();
                    ctx.state.serviceDirectory.provide(context_ledger_2.contextLedgerFactory, contextLedgerFactory);
                    attachmentOwner = registry.registerOwner({
                        id: "natalia-attachment",
                        name: "Attachment",
                        version: "1.0.0",
                        scope: "workspace",
                        grants: ["services", "commands"],
                    });
                    attachments = (0, attachments_1.createAttachmentService)(workspaceRoot);
                    // The service binds through the directory; the owner stays for the attach
                    // command below.
                    ctx.state.serviceDirectory.provide(attachments_2.attachmentService, attachments);
                    attachmentOwner.contribute("commands", "attach", {
                        name: "attach",
                        title: "Attach",
                        run: function (invocation) {
                            return __awaiter(this, void 0, void 0, function () {
                                var _a, path, prompt;
                                return __generator(this, function (_b) {
                                    switch (_b.label) {
                                        case 0:
                                            if (!(invocation === null || invocation === void 0 ? void 0 : invocation.sessionID))
                                                throw new Error("attachment command requires a session");
                                            _a = invocation.args, path = _a[0], prompt = _a.slice(1);
                                            if (!path || !prompt.length)
                                                throw new Error("usage: /attach <workspace-relative-image> <prompt>");
                                            return [4 /*yield*/, ctx.ports.submitInput({ text: prompt.join(" "), attachments: [path] }, invocation.sessionID)];
                                        case 1:
                                            _b.sent();
                                            return [2 /*return*/];
                                    }
                                });
                            });
                        },
                    });
                    workspaceOwner = registry.registerOwner({
                        id: "natalia-workspace",
                        name: "Workspace",
                        version: "1.0.0",
                        scope: "workspace",
                        grants: ["services", "commands"],
                    });
                    mutations = (0, workspace_1.createMutationRegistry)();
                    files = (0, workspace_1.createWorkspaceFilesController)({
                        workspaceRoot: workspaceRoot,
                        listPaths: function () { return __awaiter(_this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, (0, platform_1.findWorkspaceFiles)({ workspaceRoot: workspaceRoot, limit: 1000 })];
                                    case 1: return [2 /*return*/, (_a.sent())
                                            .filter(function (entry) { return entry.type === "file"; })
                                            .map(function (entry) { return entry.path; })];
                                }
                            });
                        }); },
                        resolveMutation: function (path) {
                            var mutation = mutations.match({ path: path, operation: "modified" });
                            if (!mutation)
                                return undefined;
                            var identity = {
                                origin: mutation.operationID ? "sandbox_merge" : "tool",
                            };
                            if (mutation.turnID)
                                identity.turnID = mutation.turnID;
                            if (mutation.callID)
                                identity.callID = mutation.callID;
                            if (mutation.operationID)
                                identity.operationID = mutation.operationID;
                            if (mutation.sessionID)
                                identity.sessionID = mutation.sessionID;
                            if (mutation.episodeID)
                                identity.episodeID = mutation.episodeID;
                            return identity;
                        },
                    });
                    _q.label = 5;
                case 5:
                    _q.trys.push([5, 7, , 8]);
                    return [4 /*yield*/, files.init()];
                case 6:
                    _q.sent();
                    return [3 /*break*/, 8];
                case 7:
                    error_2 = _q.sent();
                    files.close();
                    throw error_2;
                case 8:
                    ctx.state.serviceDirectory.provide(workspace_1.workspaceWriteLock, (0, workspace_1.createWorkspaceWriteLock)());
                    ctx.state.serviceDirectory.provide(workspace_1.workspaceMutations, mutations);
                    cacheFabric = (0, rina_1.createCacheFabric)();
                    for (_k = 0, L1_CACHE_KINDS_1 = rina_1.L1_CACHE_KINDS; _k < L1_CACHE_KINDS_1.length; _k++) {
                        kind = L1_CACHE_KINDS_1[_k];
                        cacheFabric.registerKind(kind);
                    }
                    ctx.state.serviceDirectory.provide(rina_1.rinaCache, cacheFabric);
                    telemetry = (0, operation_log_1.createOperationLog)({
                        dir: (_p = options.operationLogsDir) !== null && _p !== void 0 ? _p : (process.env.NATALIA_HOME
                            ? (0, node_path_1.join)(process.env.NATALIA_HOME, "logs")
                            : (0, platform_1.operationLogsDir)()),
                    });
                    ctx.state.serviceDirectory.provide(operation_log_1.operationLog, telemetry);
                    closeHandles.push(function () { return telemetry.close(); });
                    publishFinding = function (event) {
                        var exec = "sessionID" in event && event.sessionID
                            ? ctx.ports.getExecutionBySession().get(event.sessionID)
                            : undefined;
                        if (exec)
                            ctx.ports.publishForSession(exec, event);
                        else
                            ctx.ports.publish(event);
                    };
                    diagnostics = (0, runtime_diagnostics_1.createRuntimeDiagnostics)({
                        sets: [
                            { owner: "session", invariants: session_1.sessionInvariants },
                            { owner: "governance-ledger", invariants: governance_ledger_1.constitutionInvariants },
                            { owner: "work-ledger", invariants: work_ledger_1.workLedgerInvariants },
                        ],
                        log: telemetry,
                        publish: publishFinding,
                    });
                    ctx.state.serviceDirectory.provide(runtime_services_1.runtimeDiagnostics, diagnostics);
                    diagnostics.start(30000, function () { return ({
                        sessions: __spreadArray([], ctx.ports.getExecutionBySession().values(), true).map(function (exec) { return ({
                            sessionID: exec.session.id,
                            events: exec.session.events,
                            factStateComplete: exec.factStateComplete === true,
                        }); }),
                    }); });
                    closeHandles.push(function () { return diagnostics.stop(); });
                    ctx.state.serviceDirectory.provide(workspace_1.workspaceFiles, files);
                    workspaceOwner.contribute("commands", "files", {
                        name: "files",
                        title: "Find workspace files",
                        run: function (invocation) {
                            return __awaiter(this, void 0, void 0, function () {
                                var query, found;
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0:
                                            query = invocation === null || invocation === void 0 ? void 0 : invocation.args.join(" ").trim();
                                            return [4 /*yield*/, (0, platform_1.findWorkspaceFiles)({
                                                    workspaceRoot: workspaceRoot,
                                                    query: query || undefined,
                                                    limit: 50,
                                                })];
                                        case 1:
                                            found = _a.sent();
                                            return [2 /*return*/, found.length
                                                    ? found.map(function (file) { return file.path; }).join("\n")
                                                    : "no workspace files found"];
                                    }
                                });
                            });
                        },
                    });
                    workspaceOwner.contribute("commands", "search", {
                        name: "search",
                        title: "Search workspace files",
                        run: function (invocation) {
                            return __awaiter(this, void 0, void 0, function () {
                                var query, matches;
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0:
                                            query = invocation === null || invocation === void 0 ? void 0 : invocation.args.join(" ").trim();
                                            if (!query)
                                                throw new Error("/search requires a query");
                                            return [4 /*yield*/, (0, platform_1.searchWorkspaceFiles)({
                                                    workspaceRoot: workspaceRoot,
                                                    query: query,
                                                    limit: 50,
                                                })];
                                        case 1:
                                            matches = _a.sent();
                                            return [2 /*return*/, matches.length
                                                    ? matches
                                                        .map(function (match) { return "".concat(match.path, ":").concat(match.line, ":").concat(match.text); })
                                                        .join("\n")
                                                    : "no workspace matches found"];
                                    }
                                });
                            });
                        },
                    });
                    toolPolicyOwner = registry.registerOwner({
                        id: "natalia-tool-pipeline",
                        name: "Tool Pipeline",
                        version: "1.0.0",
                        scope: "workspace",
                        grants: ["services"],
                    });
                    ctx.state.serviceDirectory.provide(tool_policy_1.toolPolicy, (0, tool_policy_1.createToolPolicyService)());
                    compactionOwner = registry.registerOwner({
                        id: "natalia-compaction",
                        name: "Compaction",
                        version: "1.0.0",
                        scope: "workspace",
                        grants: ["services"],
                    });
                    compaction = (0, compaction_1.createCompactionService)({ retry: retry });
                    ctx.state.serviceDirectory.provide(compaction_2.compactionService, compaction);
                    sessionStore = (0, framework_session_store_1.wireSessionStore)(ctx, options, attachments);
                    closeHandles.push(sessionStore.close);
                    (0, framework_work_ledger_1.wireWorkLedger)(ctx);
                    (0, framework_governance_ledger_1.wireGovernanceLedger)(ctx);
                    providerModel = (0, framework_provider_model_1.wireProviderModel)(ctx);
                    closeHandles.push(providerModel.close);
                    turnOrchestration = (0, framework_turn_orchestration_1.wireTurnOrchestration)(ctx);
                    closeHandles.push(turnOrchestration.close);
                    runtimeStatus = (0, framework_runtime_status_1.wireRuntimeStatus)(ctx);
                    closeHandles.push(runtimeStatus.close);
                    return [2 /*return*/, {
                            refreshRuntimeConfig: function () {
                                refreshRuntimeConfig();
                                refreshPluginInputs();
                            },
                            close: function () {
                                dispose();
                                files.close();
                                for (var _i = 0, _a = pluginInputDisposers.splice(0).reverse(); _i < _a.length; _i++) {
                                    var disposeInput = _a[_i];
                                    disposeInput();
                                }
                                runtimeConfigDispose === null || runtimeConfigDispose === void 0 ? void 0 : runtimeConfigDispose();
                                runtimeConfigDispose = undefined;
                            },
                        }];
            }
        });
    });
}
