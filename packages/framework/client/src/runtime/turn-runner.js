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
exports.createTurnRunner = createTurnRunner;
/**
 * Turn runner input — runtime/turn-runner.ts.
 *
 * `providerRunnerInput` builds the TurnRunner input object for a session: the
 * provider/session/context/tools bindings, the model capability gates, the
 * collaboration surfaces (mailbox, Navi suggestions/answers/chats), the active
 * plan projection, and the runtime seams (approval, policy, persistence,
 * checkpoint, tool execution). Reads host state through `RuntimeContext` at
 * call time.
 */
var runtime_1 = require("@natalia/runtime");
var session_1 = require("@anthelia/session");
var runtime_status_1 = require("@natalia/runtime-status");
var attachments_1 = require("@anthelia/attachments");
var retry_1 = require("@anthelia/retry");
var compaction_1 = require("@anthelia/compaction");
var runtime_services_1 = require("@natalia/runtime-services");
var collab_1 = require("@natalia/collab");
var project_docs_1 = require("./project-docs");
function collabMessagesForExec(exec) {
    // The hot state holds the complete collab slice even when session.events is a
    // fast-attach tail; prefer it over the (possibly tail-based) snapshot.
    if (exec.factStateComplete === true && exec.factState)
        return (0, session_1.sessionFactCollabMessages)(exec.factState);
    var snapshot = exec.collabSnapshot;
    if (snapshot && snapshot.eventCount === exec.session.events.length)
        return snapshot.collabMessages;
    return (0, session_1.projectedCollabMessages)(exec.session.events);
}
function createTurnRunner(ctx, options) {
    return {
        providerRunnerInput: providerRunnerInput,
    };
    function providerRunnerInput(sessionID) {
        var _this = this;
        var _a = ctx.ports, getAgentRegistry = _a.getAgentRegistry, getActiveExec = _a.getActiveExec, getWorkspaceRoot = _a.getWorkspaceRoot, getTsRuntimeConfig = _a.getTsRuntimeConfig, publishForSession = _a.publishForSession, modelCapabilitiesForExecution = _a.modelCapabilitiesForExecution, refreshExecutionContextConfig = _a.refreshExecutionContextConfig, skillsList = _a.skillsList, skillService = _a.skillService, applyAgentPolicy = _a.applyAgentPolicy, applyAgentProvider = _a.applyAgentProvider, persistInboxPromotion = _a.persistInboxPromotion, initializeCheckpointController = _a.initializeCheckpointController, isToolAllowed = _a.isToolAllowed, setInFlightOperationFor = _a.setInFlightOperationFor, executeToolCalls = _a.executeToolCalls, reloadConfigFromDisk = _a.reloadConfigFromDisk, effectiveMaxSteps = _a.effectiveMaxSteps, waitIfPaused = _a.waitIfPaused, setActiveAbort = _a.setActiveAbort, setActiveTurnID = _a.setActiveTurnID, setSelectedAgent = _a.setSelectedAgent, setPendingAgent = _a.setPendingAgent;
        var _b = ctx.state, executionBySession = _b.executionBySession, tools = _b.tools;
        var exec = executionBySession.get(sessionID);
        if (!exec)
            throw new Error("no execution state for session ".concat(sessionID));
        var compaction = ctx.state.serviceDirectory.get(compaction_1.compactionService);
        var attachmentService = ctx.state.serviceDirectory.get(attachments_1.attachmentService);
        var statusController = ctx.state.serviceDirectory.get(runtime_status_1.statusSnapshotController);
        if (!statusController)
            throw new Error("status snapshot controller unavailable (natalia-runtime-ui)");
        var retry = ctx.state.serviceDirectory.get(retry_1.retryService);
        var activeExec = getActiveExec();
        return {
            provider: function () {
                if (exec.provider)
                    return exec.provider;
                var config = ctx.ports.getTsRuntimeConfig();
                var fallback = (config === null || config === void 0 ? void 0 : config.defaultModel)
                    ? (0, runtime_1.providerForModel)(config, config.defaultModel)
                    : undefined;
                if (fallback)
                    exec.provider = fallback;
                return exec.provider;
            },
            session: function () { return exec.session; },
            context: function () { return exec.context; },
            tokenMeter: function () { return exec.tokenMeter; },
            tools: function () { return tools; },
            attachmentReferences: function () { return exec.attachmentReferences; },
            attachments: attachmentService,
            compaction: compaction,
            mcp: function () { return ctx.state.serviceDirectory.getOptional(runtime_services_1.mcpService); },
            agentRegistry: function () { return getAgentRegistry(); },
            activeAbort: function () { return exec.activeAbort; },
            setActiveAbort: function (controller) {
                exec.activeAbort = controller;
                if (exec === activeExec)
                    setActiveAbort(controller);
            },
            activeTurnID: function () { return exec.activeTurnID; },
            setActiveTurnID: function (id) {
                exec.activeTurnID = id;
                if (exec === activeExec)
                    setActiveTurnID(id);
            },
            selectedAgent: function () { return exec.selectedAgent; },
            setSelectedAgent: function (agent) {
                exec.selectedAgent = agent;
                if (exec === activeExec)
                    setSelectedAgent(agent);
            },
            // The session's date, snapshotted when its execution state was built and
            // rolled forward only by appending a notice — never by rewriting history.
            sessionStartedAt: function () { return exec.sessionStartedAt; },
            sessionCurrentDate: function () { return exec.currentDate; },
            recordSessionDate: function (date) {
                exec.currentDate = date;
            },
            pendingAgent: function () { return exec.pendingAgent; },
            setPendingAgent: function (agent) {
                exec.pendingAgent = agent;
                if (exec === activeExec)
                    setPendingAgent(agent);
            },
            selectedModel: function () { return exec.selectedModel; },
            modelCapabilities: function () { return modelCapabilitiesForExecution(exec); },
            setActiveModelCapabilities: function (capabilities) {
                exec.activeModelCapabilities = capabilities;
            },
            refreshContextConfig: function () { return refreshExecutionContextConfig(exec); },
            permissionMode: function () { return exec.permissionMode; },
            workspaceRoot: function () { return getWorkspaceRoot(); },
            tsRuntimeConfig: function () { return getTsRuntimeConfig(); },
            runtimeContextConfig: function () { return exec.runtimeContextConfig; },
            activeSkill: function () { return exec.activeSkill; },
            skillsList: skillsList,
            skillService: skillService,
            naviSuggestions: function () {
                return collabMessagesForExec(exec)
                    .filter(function (message) {
                    return message.kind === "suggestion" && message.status === "pending";
                })
                    .map(function (message) {
                    var _a;
                    return ({
                        id: message.id,
                        suggestion: message.text,
                        priority: (_a = message.priority) !== null && _a !== void 0 ? _a : "normal",
                    });
                });
            },
            naviAnswers: function () {
                return collabMessagesForExec(exec)
                    .filter(function (message) { return message.kind === "answer"; })
                    .map(function (message) {
                    var _a;
                    return ({
                        questionID: (_a = message.questionID) !== null && _a !== void 0 ? _a : "",
                        answer: message.text,
                    });
                });
            },
            naviChats: function () {
                return collabMessagesForExec(exec).flatMap(function (message) {
                    var _a, _b, _c;
                    return message.kind === "chat" &&
                        (message.from === "main_agent" || message.to === "main_agent") &&
                        (message.from === "live_chat" || message.to === "live_chat")
                        ? [
                            {
                                id: message.id,
                                threadID: (_a = message.threadID) !== null && _a !== void 0 ? _a : "",
                                from: message.from,
                                to: message.to,
                                text: message.text,
                                round: (_b = message.round) !== null && _b !== void 0 ? _b : 1,
                                expectsReply: (_c = message.expectsReply) !== null && _c !== void 0 ? _c : false,
                                status: message.status,
                            },
                        ]
                        : [];
                });
            },
            naviIntro: function () {
                return collabMessagesForExec(exec).some(function (message) {
                    return (message.from === "main_agent" || message.to === "main_agent") &&
                        (message.from === "live_chat" || message.to === "live_chat");
                });
            },
            niaChats: function () {
                return collabMessagesForExec(exec).flatMap(function (message) {
                    var _a, _b, _c;
                    return message.kind === "chat" &&
                        (message.from === "nia" || message.to === "nia")
                        ? [
                            {
                                id: message.id,
                                threadID: (_a = message.threadID) !== null && _a !== void 0 ? _a : "",
                                from: message.from,
                                to: message.to,
                                text: message.text,
                                round: (_b = message.round) !== null && _b !== void 0 ? _b : 1,
                                expectsReply: (_c = message.expectsReply) !== null && _c !== void 0 ? _c : false,
                                status: message.status,
                            },
                        ]
                        : [];
                });
            },
            niaIntro: function () {
                return collabMessagesForExec(exec).some(function (message) { return message.from === "nia" || message.to === "nia"; });
            },
            activePlan: function () {
                var plan = (0, collab_1.activePlanForExec)(ctx, exec);
                if (!plan)
                    return undefined;
                return {
                    planID: plan.planID,
                    version: 1,
                    title: plan.title,
                    objective: plan.documentPath,
                    steps: [],
                    constraints: [],
                    verification: [],
                    riskNotes: [],
                };
            },
            // ADR D2 / EI §8.5: the project documents (AGENTS.md and
            // .natalia/constitution.md) load per turn and carry a content hash; a
            // document edit changes the hash, the rendered block changes, and the
            // runtime re-appends on change instead of mutating earlier messages.
            projectDocuments: function () {
                var snapshot = (0, project_docs_1.loadProjectDocumentsSync)(getWorkspaceRoot());
                return (snapshot === null || snapshot === void 0 ? void 0 : snapshot.documents.length) ? snapshot : undefined;
            },
            retry: retry,
            lastProviderUsage: function () { return exec.lastProviderUsage; },
            setLastProviderUsage: function (usage) {
                exec.lastProviderUsage = usage;
            },
            publish: function (event) { return publishForSession(exec, event); },
            applyAgentPolicy: function () {
                if (exec === activeExec)
                    applyAgentPolicy();
            },
            applyAgentProvider: function () { return applyAgentProvider(exec); },
            persistInboxPromotion: function () { return persistInboxPromotion(exec.session.id); },
            createTurnCheckpoint: function (input) { return __awaiter(_this, void 0, void 0, function () {
                var controller;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, initializeCheckpointController(exec)];
                        case 1:
                            controller = _a.sent();
                            if (!(controller === null || controller === void 0 ? void 0 : controller.isEnabled())) return [3 /*break*/, 3];
                            return [4 /*yield*/, controller.createCheckpoint(input)];
                        case 2:
                            _a.sent();
                            _a.label = 3;
                        case 3: return [2 /*return*/];
                    }
                });
            }); },
            isToolAllowed: function (toolName) { return isToolAllowed(toolName, exec); },
            setInFlightOperation: function (operation) {
                return setInFlightOperationFor(exec, operation);
            },
            executeToolCalls: executeToolCalls,
            takeLiveUserMessages: function () { return ctx.ports.takeLiveUserMessages(exec); },
            takeStepInputs: function (step) {
                var _a, _b;
                var claimed = (0, session_1.claimNextSteps)(exec.session, (_a = exec.activeTurnID) !== null && _a !== void 0 ? _a : "", step);
                if (!claimed.length)
                    return [];
                for (var _i = 0, claimed_1 = claimed; _i < claimed_1.length; _i++) {
                    var item = claimed_1[_i];
                    publishForSession(exec, __assign({ type: "turn.input", turnID: (_b = exec.activeTurnID) !== null && _b !== void 0 ? _b : item.id, inputID: item.id, text: item.text, delivery: "next-step" }, (item.internal ? { internal: true } : {})));
                }
                void persistInboxPromotion(exec.session.id);
                return claimed.map(function (item) { return ({ id: item.id, text: item.text }); });
            },
            hasPendingStepInputs: function () {
                var _a, _b;
                return (_b = (_a = exec.session.inbox) === null || _a === void 0 ? void 0 : _a.some(function (item) { return !item.promotedAt && item.delivery === "next-step"; })) !== null && _b !== void 0 ? _b : false;
            },
            isTurnAnnounced: function (id) { return exec.announcedTurnIDs.has(id); },
            markTurnAnnounced: function (id) {
                exec.announcedTurnIDs.add(id);
            },
            reloadConfig: function () { return __awaiter(_this, void 0, void 0, function () {
                var result;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, reloadConfigFromDisk()];
                        case 1:
                            result = _a.sent();
                            if (result.providerReconfigured)
                                applyAgentProvider(exec);
                            return [2 /*return*/, result];
                    }
                });
            }); },
            runtimeStatusSnapshot: function () {
                return statusController.snapshotFor({
                    provider: exec.provider,
                    context: exec.context,
                    permissionMode: exec.permissionMode,
                });
            },
            effectiveMaxSteps: function () { return effectiveMaxSteps(exec); },
            waitIfPaused: function () { return waitIfPaused(exec); },
            waitingHuman: function () { return exec.endTurnWaitingHuman; },
        };
    }
}
