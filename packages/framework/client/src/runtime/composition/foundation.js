"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.wireFoundation = wireFoundation;
var node_path_1 = require("node:path");
var platform_1 = require("@natalia/platform");
var tools_1 = require("@anthelia/tools");
var runtime_services_1 = require("@natalia/runtime-services");
var work_ledger_1 = require("@natalia/work-ledger");
var runtime_status_1 = require("@natalia/runtime-status");
var substrate_1 = require("@anthelia/substrate");
function userSkillRoot() {
    var root = (0, node_path_1.join)((0, platform_1.globalConfigHome)(), "natalia-cli", "skills");
    return (0, node_path_1.isAbsolute)(root) ? root : undefined;
}
function redactToolOutput(output, redact) {
    if (!redact)
        return output;
    return output.replace(/\b(?:api[_-]?key|token|secret|password)\s*[:=]\s*[^\s]+/giu, function (match) {
        return "".concat(match.slice(0, match.indexOf("=") >= 0 ? match.indexOf("=") + 1 : match.indexOf(":") + 1), "[REDACTED]");
    });
}
function wireFoundation(ctx) {
    var _this = this;
    var state = ctx.state, ports = ctx.ports;
    var pluginsController = (0, substrate_1.createPluginsController)({
        pluginStoreRoot: state.pluginStoreRoot,
        workspaceRoot: state.workspaceRoot,
        tools: state.tools,
        capabilityRegistry: state.capabilityRegistry,
        publish: function (event) { return ports.publish(event); },
    });
    state.terminalCommandBuffer = new tools_1.TerminalCommandBuffer({
        foregroundProgram: function (paneID) { return __awaiter(_this, void 0, void 0, function () {
            var terminal, ttyName, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        terminal = ctx.state.serviceDirectory.getOptional(runtime_services_1.terminalController);
                        return [4 /*yield*/, (terminal === null || terminal === void 0 ? void 0 : terminal.ttyName(paneID))];
                    case 1:
                        ttyName = _a.sent();
                        if (!ttyName)
                            return [2 /*return*/, {
                                    supported: false,
                                    reason: "pane ".concat(paneID, " has no terminal device"),
                                }];
                        return [2 /*return*/, (0, platform_1.foregroundProcessForTTY)(ttyName)];
                    case 2:
                        error_1 = _a.sent();
                        return [2 /*return*/, {
                                supported: false,
                                reason: error_1 instanceof Error ? error_1.message : String(error_1),
                            }];
                    case 3: return [2 /*return*/];
                }
            });
        }); },
    });
    state.waiterDeps = {
        publish: function (event) { return ports.publish(event); },
        sessionID: function () { return state.sessionID; },
        permissionMode: function (turnID) {
            var _a, _b;
            return (_b = (_a = (turnID ? ports.executionForTurn(turnID) : state.activeExec)) === null || _a === void 0 ? void 0 : _a.permissionMode) !== null && _b !== void 0 ? _b : state.permissionMode;
        },
        abortSignal: function (turnID) {
            var _a, _b, _c;
            return (_c = (_b = state.executionBySession.get((_a = state.turnSession.get(turnID)) !== null && _a !== void 0 ? _a : state.sessionID)) === null || _b === void 0 ? void 0 : _b.activeAbort) === null || _c === void 0 ? void 0 : _c.signal;
        },
        activeTurnID: function () { var _a; return (_a = state.activeExec) === null || _a === void 0 ? void 0 : _a.activeTurnID; },
        isPending: function (sessionID, id, kind) {
            return ports.isPendingInteractiveRequest(sessionID, id, kind);
        },
        sessionIDForTurn: function (turnID) { var _a; return (_a = state.turnSession.get(turnID)) !== null && _a !== void 0 ? _a : state.sessionID; },
        agentIDForTurn: function (turnID) { return state.turnAgent.get(turnID); },
        capabilityOwnerForTool: function (toolName) {
            return state.capabilityRegistry.ownerOf("tools", toolName);
        },
        workLedger: function () {
            return ctx.state.serviceDirectory.get(work_ledger_1.workLedgerController);
        },
        publishForSession: function (sessionID, event) {
            return ports.publishForSession(state.executionBySession.get(sessionID), event);
        },
    };
    ports.isDisposed = function () { return state.runtimeDisposed; };
    ports.setDisposed = function (disposed) {
        state.runtimeDisposed = disposed;
    };
    ports.resolveService = function (serviceID) {
        return state.capabilityRegistry.service(serviceID);
    };
    ports.getSession = function () { return state.session; };
    ports.getReplayMode = function () { return state.replayMode; };
    ports.setReplayMode = function (mode) {
        state.replayMode = mode;
    };
    ports.getSessionPersistence = function () { return state.sessionPersistence; };
    ports.getSessionPersistenceForSession = function (sessionID) { var _a; return (_a = state.sessionPersistenceBySession.get(sessionID)) !== null && _a !== void 0 ? _a : Promise.resolve(); };
    ports.setSessionPersistenceForSession = function (sessionID, next) {
        state.sessionPersistenceBySession.set(sessionID, next);
    };
    ports.getProviderConcurrencyLimiter = function () { return state.providerConcurrencyLimiter; };
    ports.getExecutionBySession = function () { return state.executionBySession; };
    ports.getTurnSession = function () { return state.turnSession; };
    ports.getActiveSkill = function () { return state.activeSkill; };
    ports.getTurnAgent = function () { return state.turnAgent; };
    ports.getAttachmentReferences = function () { return state.attachmentReferences; };
    ports.getToolCalls = function () { return state.toolCalls; };
    ports.getRetryPolicy = function () { return state.retryPolicy; };
    ports.executionForTurn = function (turnID) {
        var _a;
        return state.executionBySession.get((_a = state.turnSession.get(turnID)) !== null && _a !== void 0 ? _a : state.sessionID);
    };
    ports.getSessionID = function () { return state.sessionID; };
    ports.getProvider = function () { return state.provider; };
    ports.getChatDefaultProvider = function () { return state.chatDefaultProvider; };
    ports.getActiveExec = function () { return state.activeExec; };
    ports.getActiveTurnID = function () { return state.activeTurnID; };
    ports.getPauseWaiters = function () { return state.pauseWaiters; };
    ports.getWorkspaceCapabilityView = function () { return state.workspaceCapabilityView; };
    ports.getTools = function () { return state.tools; };
    ports.scheduleRuntimeStatusSnapshot = function () {
        var _a;
        return (_a = ctx.state.serviceDirectory
            .getOptional(runtime_status_1.statusSnapshotController)) === null || _a === void 0 ? void 0 : _a.schedule();
    };
    ports.runtimeStatusSnapshot = function () {
        var status = ctx.state.serviceDirectory.get(runtime_status_1.statusSnapshotController);
        return status.snapshot();
    };
    // Both surfaces tolerate an absent plugin: resolution states the tolerance
    // instead of every call site re-checking.
    ports.skillService = function () {
        return ctx.state.serviceDirectory.getOptional(runtime_services_1.skillService);
    };
    ports.skillsList = function () { var _a, _b; return (_b = (_a = ports.skillService()) === null || _a === void 0 ? void 0 : _a.list()) !== null && _b !== void 0 ? _b : []; };
    ports.teamBehavior = function () {
        return ctx.state.serviceDirectory.getOptional(runtime_services_1.teamBehavior);
    };
    ports.getProviderSource = function () { return state.providerSource; };
    ports.getWorkspaceRoot = function () { return state.workspaceRoot; };
    ports.getAgentRegistry = function () { return state.agentRegistry; };
    ports.setPaused = function (value) {
        state.paused = value;
    };
    ports.getPaused = function () { return state.paused; };
    ports.getCapabilityRegistry = function () { return state.capabilityRegistry; };
    ports.getTsRuntimeConfig = function () { return state.tsRuntimeConfig; };
    ports.getSelectedAgent = function () { return state.selectedAgent; };
    ports.getSelectedModel = function () { return state.selectedModel; };
    ports.getMaxSteps = function () { return state.maxSteps; };
    ports.getReady = function () { return state.ready; };
    ports.getContextWindowResolver = function () { return state.contextWindowResolver; };
    ports.setProvider = function (value) {
        state.provider = value;
    };
    ports.setSelectedModel = function (value) {
        state.selectedModel = value;
    };
    ports.setRuntimeContextConfig = function (value) {
        state.runtimeContextConfig = value;
    };
    ports.getRuntimeContextConfig = function () { return state.runtimeContextConfig; };
    ports.nextMailboxSequence = function () { return state.mailboxSequence++; };
    ports.nextDecisionSequence = function () { return state.decisionSequence++; };
    ports.nextEvidenceSequence = function () { return state.evidenceSequence++; };
    ports.nextCompletionSequence = function () { return state.completionSequence++; };
    ports.nextChatSequence = function () { return state.chatSequence++; };
    ports.getInternalWakeTasks = function () { return state.internalWakeTasks; };
    ports.setSessionPersistence = function (next) {
        state.sessionPersistence = next;
    };
    ports.redactToolOutput = redactToolOutput;
    ports.getSink = function () { return state.sink; };
    ports.setSink = function (next) {
        state.sink = next;
    };
    ports.getPerformanceTrace = function () { return state.performanceTrace; };
    ports.getNativeRuntimeID = function () { return state.nativeRuntimeID; };
    ports.getUserRuntimeHome = function () { return (0, platform_1.userRuntimeHome)(); };
    ports.getUserSkillRoot = function () { return userSkillRoot(); };
    ports.setProviderSource = function (source) {
        state.providerSource = source;
    };
    ports.getPluginsController = function () { return pluginsController; };
}
