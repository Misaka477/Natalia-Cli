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
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSessionAttach = createSessionAttach;
/**
 * Session attachment — runtime/session-attach.ts.
 *
 * `attachSession` switches which session the UI is attached to: it flushes and
 * ensures the target session's execution state, then rewires the activity
 * closures to that exec while a background turn of the previous session keeps
 * running. Reads and writes host state through `RuntimeContext` ports.
 */
var runtime_1 = require("@natalia/runtime");
var session_1 = require("@anthelia/session");
var contracts_1 = require("@natalia/contracts");
var runtime_services_1 = require("@natalia/runtime-services");
var session_store_1 = require("@anthelia/session-store");
var runtime_status_1 = require("@natalia/runtime-status");
var collab_1 = require("@natalia/collab");
var runtime_services_2 = require("@natalia/runtime-services");
function createSessionAttach(ctx) {
    return {
        attachSession: attachSession,
    };
    function seedStreamContextSnapshots(exec) {
        return __awaiter(this, void 0, void 0, function () {
            var meter, snapshotEventType, latestSnapshot, publishSnapshot, publishExistingSnapshot, seedStream, byAgent, _i, _a, event_1, messages, _b, byAgent_1, _c, agentID, messages, existing, scope, projection;
            var _this = this;
            var _d, _e, _f, _g, _h, _j;
            return __generator(this, function (_k) {
                switch (_k.label) {
                    case 0:
                        meter = exec.tokenMeter;
                        snapshotEventType = function (stream) {
                            return stream === "navi"
                                ? "navi.context.snapshot"
                                : stream === "nia"
                                    ? "nia.context.snapshot"
                                    : "context.snapshot";
                        };
                        latestSnapshot = function (stream, agentID) {
                            for (var index = exec.session.events.length - 1; index >= 0; index -= 1) {
                                var event_2 = exec.session.events[index];
                                if (!event_2)
                                    continue;
                                var streamMatches = stream === undefined
                                    ? event_2.type === "context.snapshot" &&
                                        event_2.channel === undefined
                                    : event_2.type === snapshotEventType(stream) ||
                                        // Legacy journals wrote one shared event with a channel tag.
                                        (event_2.type === "context.snapshot" &&
                                            event_2.channel === stream);
                                if (streamMatches &&
                                    "usedTokens" in event_2 &&
                                    "source" in event_2 &&
                                    event_2.agentID === agentID)
                                    return event_2;
                            }
                            return undefined;
                        };
                        publishSnapshot = function (stream, data) {
                            var at = new Date().toISOString();
                            ctx.ports.publishForSession(exec, __assign(__assign({ type: snapshotEventType(stream) }, data), { at: at }));
                        };
                        publishExistingSnapshot = function (stream, snapshot) {
                            return publishSnapshot(stream, __assign(__assign(__assign(__assign(__assign(__assign(__assign(__assign(__assign({}, (snapshot.agentID ? { agentID: snapshot.agentID } : {})), { usedTokens: snapshot.usedTokens }), (snapshot.pressureTokens === undefined
                                ? {}
                                : { pressureTokens: snapshot.pressureTokens })), (snapshot.projectedTokens === undefined
                                ? {}
                                : { projectedTokens: snapshot.projectedTokens })), (snapshot.contextWindow === undefined
                                ? {}
                                : { contextWindow: snapshot.contextWindow })), (snapshot.systemTokens === undefined
                                ? {}
                                : { systemTokens: snapshot.systemTokens })), (snapshot.toolsTokens === undefined
                                ? {}
                                : { toolsTokens: snapshot.toolsTokens })), (snapshot.messageTokens === undefined
                                ? {}
                                : { messageTokens: snapshot.messageTokens })), { source: snapshot.source }));
                        };
                        seedStream = function (stream) { return __awaiter(_this, void 0, void 0, function () {
                            var existing, messages, streamMeter, profile, config, contextWindow, budget, _a, projection;
                            var _b, _c, _d, _e, _f;
                            return __generator(this, function (_g) {
                                switch (_g.label) {
                                    case 0:
                                        existing = latestSnapshot(stream);
                                        // Attach no longer replays the full durable log, so an existing durable
                                        // snapshot must be re-published to the live sink or the UI would never
                                        // see it after a restart. Republish it verbatim instead of inventing a
                                        // fresh estimate; if it lacks a context window the meter cannot render,
                                        // so fall through and compute a usable one below.
                                        if (existing && ((_b = existing.contextWindow) !== null && _b !== void 0 ? _b : 0) > 0) {
                                            publishExistingSnapshot(stream, existing);
                                            return [2 /*return*/];
                                        }
                                        messages = stream === "navi"
                                            ? (0, collab_1.naviChatProviderMessagesFromHistory)(exec)
                                            : (0, collab_1.niaChatProviderMessagesFromHistory)(exec);
                                        if (!messages.length)
                                            return [2 /*return*/];
                                        streamMeter = stream === "navi" ? exec.naviTokenMeter : exec.niaTokenMeter;
                                        profile = stream === "navi"
                                            ? (_c = exec.naviChatModelProfile) === null || _c === void 0 ? void 0 : _c.normal
                                            : (_d = exec.niaChatModelProfile) === null || _d === void 0 ? void 0 : _d.normal;
                                        config = ctx.ports.getTsRuntimeConfig();
                                        contextWindow = exec.runtimeContextConfig.max;
                                        if (!(config && exec.provider)) return [3 /*break*/, 4];
                                        _g.label = 1;
                                    case 1:
                                        _g.trys.push([1, 3, , 4]);
                                        return [4 /*yield*/, ctx.ports.resolveContextStatusConfig(config, exec.provider, ctx.ports.getContextWindowResolver(), ctx.ports.modelRefKeyForSelection(undefined, profile))];
                                    case 2:
                                        budget = _g.sent();
                                        contextWindow = budget.max;
                                        return [3 /*break*/, 4];
                                    case 3:
                                        _a = _g.sent();
                                        contextWindow = exec.runtimeContextConfig.max;
                                        return [3 /*break*/, 4];
                                    case 4:
                                        streamMeter.measureRequest("stream", {
                                            tools: undefined,
                                            messages: messages,
                                            contextWindow: contextWindow,
                                        });
                                        projection = streamMeter.project("stream");
                                        publishSnapshot(stream, __assign(__assign(__assign({ usedTokens: (_f = (_e = projection.projectedTokens) !== null && _e !== void 0 ? _e : projection.pressureTokens) !== null && _f !== void 0 ? _f : streamMeter.estimateMessages(messages) }, (projection.pressureTokens === undefined
                                            ? {}
                                            : { pressureTokens: projection.pressureTokens })), (projection.projectedTokens === undefined
                                            ? {}
                                            : { projectedTokens: projection.projectedTokens })), { contextWindow: contextWindow, source: projection.source }));
                                        return [2 /*return*/];
                                }
                            });
                        }); };
                        return [4 /*yield*/, seedStream("navi")];
                    case 1:
                        _k.sent();
                        return [4 /*yield*/, seedStream("nia")];
                    case 2:
                        _k.sent();
                        byAgent = new Map();
                        for (_i = 0, _a = exec.session.events; _i < _a.length; _i++) {
                            event_1 = _a[_i];
                            if (!event_1.agentID)
                                continue;
                            messages = (_d = byAgent.get(event_1.agentID)) !== null && _d !== void 0 ? _d : [];
                            byAgent.set(event_1.agentID, messages);
                            if ((event_1.type === "content.done" || event_1.type === "thinking.done") &&
                                event_1.text) {
                                messages.push({ role: "assistant", content: event_1.text });
                            }
                            else if (event_1.type === "tool.update") {
                                messages.push({
                                    role: "assistant",
                                    content: [
                                        event_1.name,
                                        event_1.summary,
                                        (_e = event_1.argumentsDelta) !== null && _e !== void 0 ? _e : "",
                                        (_f = event_1.result) !== null && _f !== void 0 ? _f : "",
                                    ]
                                        .filter(Boolean)
                                        .join("\n"),
                                });
                            }
                        }
                        for (_b = 0, byAgent_1 = byAgent; _b < byAgent_1.length; _b++) {
                            _c = byAgent_1[_b], agentID = _c[0], messages = _c[1];
                            existing = latestSnapshot(undefined, agentID);
                            if (existing && ((_g = existing.contextWindow) !== null && _g !== void 0 ? _g : 0) > 0) {
                                publishExistingSnapshot(undefined, existing);
                                continue;
                            }
                            if (!messages.length)
                                continue;
                            scope = "subagent:".concat(agentID);
                            meter.observeSurface(scope, messages);
                            meter.measureRequest(scope, {
                                messages: messages,
                                contextWindow: exec.runtimeContextConfig.max,
                            });
                            projection = meter.project(scope);
                            publishSnapshot(undefined, __assign(__assign(__assign({ agentID: agentID, usedTokens: (_j = (_h = projection.projectedTokens) !== null && _h !== void 0 ? _h : projection.pressureTokens) !== null && _j !== void 0 ? _j : meter.estimateMessages(messages) }, (projection.pressureTokens === undefined
                                ? {}
                                : { pressureTokens: projection.pressureTokens })), (projection.projectedTokens === undefined
                                ? {}
                                : { projectedTokens: projection.projectedTokens })), { contextWindow: exec.runtimeContextConfig.max, source: projection.source }));
                        }
                        return [2 /*return*/];
                }
            });
        });
    }
    function attachSession(id) {
        return __awaiter(this, void 0, void 0, function () {
            var start, mark, _a, getReady, getSessionID, setSessionID, setSession, setRuntimeContext, setActiveExec, setAttachmentReferences, setToolCalls, getSessionPersistence, ensureExecution, setLastSubmitted, setActiveAbort, setActiveTurnID, setPaused, setPauseWaiters, setActiveSkill, setSelectedAgent, setSelectedModel, setPendingAgent, setLastProviderUsage, clearRuntimeDiagnostics, getRuntimeDiagnosticsBySession, setPermissionMode, setSelectedPermissionProfile, setProvider, getProvider, applyAgentPolicy, applyAgentProvider, initializeCheckpointController, publishForSession, syncGoalStatus, sessionStore, terminal, status, sessionID, nextID, activeExec, exec_1, exec, projection, diagnostics, _i, _b, event_3, _c, _d;
            var _e, _f, _g, _h, _j;
            return __generator(this, function (_k) {
                switch (_k.label) {
                    case 0:
                        start = performance.now();
                        mark = function (name) {
                            return (0, runtime_services_2.perfLog)("[perf] attachSession.".concat(name, " target=").concat(id, " +").concat((performance.now() - start).toFixed(1), "ms"));
                        };
                        (0, runtime_services_2.perfLog)("[perf] attachSession start target=".concat(id));
                        _a = ctx.ports, getReady = _a.getReady, getSessionID = _a.getSessionID, setSessionID = _a.setSessionID, setSession = _a.setSession, setRuntimeContext = _a.setRuntimeContext, setActiveExec = _a.setActiveExec, setAttachmentReferences = _a.setAttachmentReferences, setToolCalls = _a.setToolCalls, getSessionPersistence = _a.getSessionPersistence, ensureExecution = _a.ensureExecution, setLastSubmitted = _a.setLastSubmitted, setActiveAbort = _a.setActiveAbort, setActiveTurnID = _a.setActiveTurnID, setPaused = _a.setPaused, setPauseWaiters = _a.setPauseWaiters, setActiveSkill = _a.setActiveSkill, setSelectedAgent = _a.setSelectedAgent, setSelectedModel = _a.setSelectedModel, setPendingAgent = _a.setPendingAgent, setLastProviderUsage = _a.setLastProviderUsage, clearRuntimeDiagnostics = _a.clearRuntimeDiagnostics, getRuntimeDiagnosticsBySession = _a.getRuntimeDiagnosticsBySession, setPermissionMode = _a.setPermissionMode, setSelectedPermissionProfile = _a.setSelectedPermissionProfile, setProvider = _a.setProvider, getProvider = _a.getProvider, applyAgentPolicy = _a.applyAgentPolicy, applyAgentProvider = _a.applyAgentProvider, initializeCheckpointController = _a.initializeCheckpointController, publishForSession = _a.publishForSession, syncGoalStatus = _a.syncGoalStatus;
                        return [4 /*yield*/, getReady()];
                    case 1:
                        _k.sent();
                        mark("ready");
                        sessionStore = ctx.state.serviceDirectory.getOptional(session_store_1.sessionStoreController);
                        if (!sessionStore)
                            throw new Error("session store unavailable (natalia-session-store)");
                        terminal = ctx.state.serviceDirectory.getOptional(runtime_services_1.terminalController);
                        status = ctx.state.serviceDirectory.get(runtime_status_1.statusSnapshotController);
                        sessionID = getSessionID();
                        nextID = id;
                        if (!(nextID === sessionID)) return [3 /*break*/, 6];
                        activeExec = ctx.ports.getActiveExec();
                        if (!((activeExec === null || activeExec === void 0 ? void 0 : activeExec.session.id) === nextID)) return [3 /*break*/, 2];
                        void seedStreamContextSnapshots(activeExec).catch(function () { return undefined; });
                        return [3 /*break*/, 4];
                    case 2: return [4 /*yield*/, ensureExecution(nextID)];
                    case 3:
                        exec_1 = _k.sent();
                        if ((_e = exec_1.session.metadata) === null || _e === void 0 ? void 0 : _e.archived)
                            throw new contracts_1.RuntimeRefusal("cannot attach an archived session");
                        void seedStreamContextSnapshots(exec_1).catch(function () { return undefined; });
                        _k.label = 4;
                    case 4: 
                    // A same-session startup attach skips `ensureExecution`, so the durable
                    // goal is never replayed here; re-seed the live projection explicitly or
                    // the status bar stays empty until the next goal mutation.
                    return [4 /*yield*/, (syncGoalStatus === null || syncGoalStatus === void 0 ? void 0 : syncGoalStatus(nextID).catch(function () { return undefined; }))];
                    case 5:
                        // A same-session startup attach skips `ensureExecution`, so the durable
                        // goal is never replayed here; re-seed the live projection explicitly or
                        // the status bar stays empty until the next goal mutation.
                        _k.sent();
                        (0, runtime_services_2.perfLog)("[perf] attachSession same target=".concat(id, " +").concat((performance.now() - start).toFixed(1), "ms"));
                        return [2 /*return*/, { sessionID: nextID }];
                    case 6: 
                    // A replacement runtime can open the old session as soon as attach returns.
                    return [4 /*yield*/, getSessionPersistence()];
                    case 7:
                        // A replacement runtime can open the old session as soon as attach returns.
                        _k.sent();
                        return [4 /*yield*/, sessionStore.flush(sessionID)];
                    case 8:
                        _k.sent();
                        mark("flush");
                        return [4 /*yield*/, ensureExecution(nextID)];
                    case 9:
                        exec = _k.sent();
                        mark("ensureExecution");
                        if ((_f = exec.session.metadata) === null || _f === void 0 ? void 0 : _f.archived)
                            throw new contracts_1.RuntimeRefusal("cannot attach an archived session");
                        setSessionID(nextID);
                        setSession(exec.session);
                        setRuntimeContext(exec.context);
                        setActiveExec(exec);
                        setAttachmentReferences(exec.attachmentReferences);
                        setToolCalls(exec.toolCalls);
                        terminal === null || terminal === void 0 ? void 0 : terminal.setActiveSession(nextID);
                        setLastSubmitted(exec.lastSubmitted);
                        setActiveAbort(exec.activeAbort);
                        setActiveTurnID(exec.activeTurnID);
                        setPaused(exec.paused);
                        setPauseWaiters(exec.pauseWaiters);
                        setActiveSkill(undefined);
                        setSelectedAgent(undefined);
                        setSelectedModel(undefined);
                        setPendingAgent(undefined);
                        setLastProviderUsage(undefined);
                        clearRuntimeDiagnostics();
                        applyAgentPolicy();
                        applyAgentProvider(exec);
                        projection = (0, session_1.restoreProjection)(exec.session.id, exec.session, sessionStore);
                        diagnostics = (_g = getRuntimeDiagnosticsBySession().get(exec.session.id)) !== null && _g !== void 0 ? _g : [];
                        for (_i = 0, _b = projection.replayableEvents; _i < _b.length; _i++) {
                            event_3 = _b[_i];
                            if (event_3.type === "diagnostic")
                                diagnostics.push(__assign(__assign({}, event_3), { at: (_h = event_3.at) !== null && _h !== void 0 ? _h : exec.session.createdAt }));
                        }
                        getRuntimeDiagnosticsBySession().set(exec.session.id, diagnostics);
                        mark("projection");
                        // The exec already restored its own ledger, agent and model selection
                        // (`ensureExecution`); here the activity closures take the same values so
                        // UI reads and the next attach start from them.
                        setSelectedAgent(exec.selectedAgent);
                        setSelectedModel(exec.selectedModel);
                        setActiveSkill(exec.activeSkill);
                        setPermissionMode(exec.permissionMode);
                        setSelectedPermissionProfile(exec.permissionProfile);
                        setProvider((_j = exec.provider) !== null && _j !== void 0 ? _j : getProvider());
                        if (exec.selectedAgent) {
                            applyAgentPolicy();
                            applyAgentProvider(exec);
                        }
                        else if (exec.selectedModel) {
                            applyAgentProvider(exec);
                        }
                        mark("apply");
                        // Re-seed the goal status for the session we just switched to; its exec may
                        // already have existed (ensureExecution returns the cache) or its journal
                        // tail may not carry the durable goal.
                        return [4 /*yield*/, (syncGoalStatus === null || syncGoalStatus === void 0 ? void 0 : syncGoalStatus(nextID).catch(function () { return undefined; }))];
                    case 10:
                        // Re-seed the goal status for the session we just switched to; its exec may
                        // already have existed (ensureExecution returns the cache) or its journal
                        // tail may not carry the durable goal.
                        _k.sent();
                        // Checkpoint store initialization scans the workspace and may write a
                        // baseline; it must not block the first visible attach. Let it run in the
                        // background; checkpoint operations lazy-init again when actually needed.
                        void initializeCheckpointController(exec).catch(function (error) {
                            publishForSession(exec, {
                                type: "diagnostic",
                                level: "warning",
                                message: "checkpoint controller init deferred/failed: ".concat(error instanceof Error ? error.message : String(error)),
                            });
                        });
                        mark("checkpoint");
                        publishForSession(exec, {
                            type: "session.ready",
                            sessionID: exec.session.id,
                        });
                        mark("ready");
                        publishForSession(exec, (0, runtime_1.contextStatusEvent)(exec.context.status(exec.runtimeContextConfig)));
                        void seedStreamContextSnapshots(exec).catch(function () { return undefined; });
                        mark("context");
                        _c = publishForSession;
                        _d = [exec];
                        return [4 /*yield*/, status.snapshotFor({
                                provider: exec.provider,
                                context: exec.context,
                                permissionMode: exec.permissionMode,
                            })];
                    case 11:
                        _c.apply(void 0, _d.concat([_k.sent()]));
                        mark("status");
                        (0, runtime_services_2.perfLog)("[perf] attachSession done target=".concat(id, " events=").concat(exec.session.events.length, " +").concat((performance.now() - start).toFixed(1), "ms"));
                        return [2 /*return*/, { sessionID: exec.session.id }];
                }
            });
        });
    }
}
