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
exports.WORKER_ROUTED_MEMBERS = exports.WORKER_ROUTE_MEMBERS = void 0;
exports.createWorkerRuntimeClient = createWorkerRuntimeClient;
exports.attachRuntimeClientWorker = attachRuntimeClientWorker;
exports.handleWorkerRequest = handleWorkerRequest;
var contracts_1 = require("@natalia/contracts");
/**
 * The worker channel's route table, mirroring `handleWorkerRequest` below.
 * Same discipline as the RPC route table: reachability for the worker channel
 * is computed from this, and the channel's gaps (checkpoint, secure-input
 * control, MCP, work graph...) show up in the report instead of being silent.
 * A test asserts this table matches the handler dispatch.
 */
exports.WORKER_ROUTE_MEMBERS = {
    submit: "submit",
    submitAndWait: "submitAndWait",
    "input.remove": "removeInput",
    "input.replace": "replaceInput",
    "input.promote": "promoteInput",
    cancel: "cancel",
    pause: "pause",
    resume: "resume",
    "runtime.status": "runtimeStatus",
    "runtime.availability": null,
    "command.catalog": "commandCatalog",
    "command.execute": "commandExecute",
    snapshot: "snapshot",
    diagnostic: "diagnostic",
    approval: "respondApproval",
    question: "respondQuestion",
    "interactive.pending": "pendingInteractive",
    "interactive.respond": "respondInteractive",
    "config.reload": "reloadConfig",
    "config.update": "updateConfig",
    "config.get": "configGet",
    dispose: "dispose",
    history: "history",
    diagnostics: "diagnostics",
    messages: "messages",
    agents: "agents",
    "model.catalog": "modelCatalog",
    "model.selection": "modelSelection",
    "model.select": "selectModel",
    "model.setDefault": "setDefaultModel",
    "model.reasoning": "reasoningEffort",
    "model.reasoning.set": "setReasoningEffort",
    "permission.list": "permissionList",
    "permission.save": "permissionSave",
    "permission.delete": "permissionDelete",
    skills: "skills",
    "workspace.files": "workspaceFiles",
    "workspace.search": "workspaceSearch",
    "workspace.list": "workspaceList",
    "workspace.read": "workspaceRead",
    "resource.read": "resourceRead",
    "workspace.glob": "workspaceGlob",
    "workspace.write": "workspaceWrite",
    "workspace.create": "workspaceCreate",
    "workspace.rename": "workspaceRename",
    "workspace.delete": "workspaceDelete",
    "workspace.writeConflicts": "workspaceWriteConflicts",
    "mcp.catalog": "mcpCatalog",
    "mcp.prompt": "getMcpPrompt",
    "mcp.resource": "readMcpResource",
    "native-terminal.list": "nativeTerminalList",
    "native-terminal.read": "nativeTerminalRead",
    "native-terminal.open-hub": "nativeTerminalOpenHub",
    "native-terminal.release-human-control": "nativeTerminalReleaseHumanControl",
    "native-terminal.revoke-approval-scope": "nativeTerminalRevokeApprovalScope",
    "native-terminal.stop": "nativeTerminalStop",
    "native-terminal.begin-secure-input": "nativeTerminalBeginSecureInput",
    "native-terminal.end-secure-input": "nativeTerminalEndSecureInput",
    "checkpoint.list": "checkpointList",
    "checkpoint.preview": "checkpointPreview",
    "checkpoint.rollback": "checkpointRollback",
    "checkpoint.rename": "checkpointRename",
    "checkpoint.listByKind": "checkpointListByKind",
    "audit.rounds": "auditRounds",
    "workspace.round.diff": "roundDiff",
    "workspace.diff": "workspaceDiff",
    "workspace.git.diff": "workspaceGitDiff",
    "team.pr.list": "teamPRList",
    "git.refs": "gitRefs",
    "session.list": "sessionList",
    "session.touch": "sessionTouch",
    "session.rename": "sessionRename",
    "session.pin": "sessionPin",
    "session.duplicate": "sessionDuplicate",
    "session.delete": "sessionDelete",
    "session.attach": "sessionAttach",
    "session.fork": "sessionFork",
    "session.rollback.messages": "sessionRollbackMessages",
    "sandbox.list": "sandboxList",
    "sandbox.diff": "sandboxDiff",
    "sandbox.resources": "sandboxResources",
    "sandbox.resource-output": "sandboxResourceOutput",
    "sandbox.resource-stop": "sandboxResourceStop",
    "sandbox.merge": "sandboxMerge",
    "sandbox.delete": "sandboxDelete",
    "agent.select": "selectAgent",
    "session.snapshot": "sessionSnapshot",
    "session.subagents": "subagents",
    "subagent.history": "subagentHistory",
    "subagent.history.page": "subagentHistoryPage",
    "attachment.upload": "uploadAttachment",
    "attachment.dataUrl": "attachmentDataUrl",
    "planDoc.list": "planDocList",
    "planDoc.read": "planDocRead",
    "planDoc.write": "planDocWrite",
    "planDoc.mark": "planDocMark",
    "planDoc.delete": "planDocDelete",
    "planDoc.status": "planDocStatus",
    "planDoc.updateStatus": "planDocUpdateStatus",
    "planDoc.active": "planDocActive",
    "planDoc.activate": "planDocActivate",
    "planDoc.deactivate": "planDocDeactivate",
    "mailbox.list": "mailboxList",
    "mailbox.send": "mailboxSend",
    "mailbox.acknowledge": "mailboxAcknowledge",
    "drift.list": "driftFindings",
    completions: "completions",
    "completion.human_validation": "recordHumanValidation",
    "plan.task.states": "planTaskStates",
    "workgraph.integrity": "workGraphIntegrity",
    "workgraph.unattributed": "unattributedChanges",
    "constitution.list": "constitutionRules",
    "decision.list": "decisionRecords",
    "evidence.list": "evidenceRecords",
    "projections.list": "projectionContributions",
    "constitution.override.request": "requestOverride",
    "constitution.override.approve": "approveOverride",
    "constitution.docRules": "constitutionDocRules",
    "constitution.docRule.promote": "promoteConstitutionDocRule",
    "constitution.docRule.update": "updateConstitutionDocRule",
    "navi.chat.submit": "naviChat",
    "navi.chat.abort": "naviChat",
    "navi.chat.messages": "naviChat",
    "navi.chat.messages.page": "naviChat",
    "navi.chat.rollback": "naviChat",
    "navi.chat.model.profile": "naviChat",
    "navi.chat.model.profile.set": "naviChat",
    "nia.chat.submit": "niaChat",
    "nia.chat.abort": "niaChat",
    "nia.chat.messages": "niaChat",
    "nia.chat.messages.page": "niaChat",
    "nia.chat.rollback": "niaChat",
    "nia.chat.model.profile": "niaChat",
    "nia.chat.model.profile.set": "niaChat",
};
/** The member names this channel routes, for reachability reporting. */
exports.WORKER_ROUTED_MEMBERS = new Set(Object.values(exports.WORKER_ROUTE_MEMBERS).filter(function (member) { return typeof member === "string"; }));
function createWorkerRuntimeClient(port) {
    var _a;
    var pending = new Map();
    var sequence = 0;
    var sink;
    var bufferedEvents = [];
    var onMessage = function (event) {
        var message = event.data;
        if (message.type === "runtime.event") {
            if (sink)
                sink(message.event);
            else
                bufferedEvents.push(message.event);
            return;
        }
        if (message.type !== "runtime.response")
            return;
        var request = pending.get(message.id);
        if (!request)
            return;
        pending.delete(message.id);
        if (message.error)
            request.reject(new Error(message.error));
        else
            request.resolve(message.value);
    };
    port.addEventListener("message", onMessage);
    // The worker can exit underneath the TUI (provider connection loss, crash,
    // dispose). Surface that through the event stream instead of leaving a
    // silently dead backend whose every next request fails.
    port.addEventListener("close", function () {
        if (!sink)
            return;
        sink({
            type: "diagnostic",
            level: "error",
            message: "runtime worker exited; the session backend is unavailable",
            at: new Date().toISOString(),
        });
    });
    (_a = port.start) === null || _a === void 0 ? void 0 : _a.call(port);
    /**
     * Notifications have no caller waiting on them, so a rejected worker request
     * would become an unhandled rejection and take down the host process. The
     * runtime already reports its own problems through the event stream, so a
     * failed notification is reported the same way instead of crashing.
     */
    var notify = function (method, value) {
        void request(method, value).catch(function (error) {
            sink === null || sink === void 0 ? void 0 : sink({
                type: "diagnostic",
                level: "warning",
                message: "runtime ".concat(method, " failed: ").concat(error instanceof Error ? error.message : String(error)),
                at: new Date().toISOString(),
            });
        });
    };
    var request = function (method, value) {
        var id = "wrk_".concat((++sequence).toString(36));
        return new Promise(function (resolve, reject) {
            pending.set(id, { resolve: resolve, reject: reject });
            try {
                port.postMessage({
                    type: "runtime.request",
                    id: id,
                    method: method,
                    value: value,
                });
            }
            catch (error) {
                // The worker can exit underneath the TUI (provider connection loss,
                // crash, dispose). Reject immediately and do not strand the pending
                // entry; callers that await receive the error, callers that fire and
                // forget must catch it themselves.
                pending.delete(id);
                reject(error);
            }
        });
    };
    var chatStreamSurface = function (stream) { return ({
        submit: function (input) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, request("".concat(stream, ".chat.submit"), input)];
                        case 1: return [2 /*return*/, (_a.sent())];
                    }
                });
            });
        },
        abort: function (sessionID) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, request("".concat(stream, ".chat.abort"), { sessionID: sessionID })];
                        case 1: return [2 /*return*/, (_a.sent())];
                    }
                });
            });
        },
        messages: function (sessionID) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, request("".concat(stream, ".chat.messages"), {
                                sessionID: sessionID,
                            })];
                        case 1: return [2 /*return*/, (_a.sent())];
                    }
                });
            });
        },
        messagesPage: function (input) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, request("".concat(stream, ".chat.messages.page"), input)];
                        case 1: return [2 /*return*/, (_a.sent())];
                    }
                });
            });
        },
        rollback: function (input, sessionID) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, request("".concat(stream, ".chat.rollback"), {
                                input: input,
                                sessionID: sessionID,
                            })];
                        case 1: return [2 /*return*/, (_a.sent())];
                    }
                });
            });
        },
        modelProfile: function (sessionID) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, request("".concat(stream, ".chat.model.profile"), {
                                sessionID: sessionID,
                            })];
                        case 1: return [2 /*return*/, (_a.sent())];
                    }
                });
            });
        },
        setModelProfile: function (profile, sessionID) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, request("".concat(stream, ".chat.model.profile.set"), {
                                profile: profile,
                                sessionID: sessionID,
                            })];
                        case 1: return [2 /*return*/, (_a.sent())];
                    }
                });
            });
        },
    }); };
    return {
        start: function (onEvent) {
            sink = onEvent;
            for (var _i = 0, _a = bufferedEvents.splice(0); _i < _a.length; _i++) {
                var event_1 = _a[_i];
                onEvent(event_1);
            }
        },
        /** What this channel can reach: the worker route table intersected with the runtime. */
        availability: function () {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, request("runtime.availability")];
                        case 1: return [2 /*return*/, (_a.sent())];
                    }
                });
            });
        },
        submit: function (text) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, request("submit", { text: text })];
                        case 1: return [2 /*return*/, (_a.sent())];
                    }
                });
            });
        },
        submitAndWait: function (input) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, request("submitAndWait", typeof input === "string" ? { text: input } : input)];
                        case 1: return [2 /*return*/, (_a.sent())];
                    }
                });
            });
        },
        submitInput: function (input) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, request("submit", input)];
                        case 1: return [2 /*return*/, (_a.sent())];
                    }
                });
            });
        },
        removeInput: function (input) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, request("input.remove", input)];
                        case 1: return [2 /*return*/, (_a.sent())];
                    }
                });
            });
        },
        replaceInput: function (input) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, request("input.replace", input)];
                        case 1: return [2 /*return*/, (_a.sent())];
                    }
                });
            });
        },
        promoteInput: function (input) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, request("input.promote", input)];
                        case 1: return [2 /*return*/, (_a.sent())];
                    }
                });
            });
        },
        pendingInteractive: function (input) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, request("interactive.pending", input)];
                        case 1: return [2 /*return*/, (_a.sent())];
                    }
                });
            });
        },
        respondInteractive: function (response) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, request("interactive.respond", response)];
                        case 1: return [2 /*return*/, (_a.sent())];
                    }
                });
            });
        },
        reloadConfig: function () {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, request("config.reload")];
                        case 1: return [2 /*return*/, (_a.sent())];
                    }
                });
            });
        },
        runtimeStatus: function (sessionID) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, request("runtime.status", sessionID ? { sessionID: sessionID } : undefined)];
                        case 1: return [2 /*return*/, (_a.sent())];
                    }
                });
            });
        },
        history: function (options) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, request("history", options)];
                        case 1: return [2 /*return*/, (_a.sent())];
                    }
                });
            });
        },
        messages: function (options) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, request("messages", options)];
                        case 1: return [2 /*return*/, (_a.sent())];
                    }
                });
            });
        },
        agents: function (input) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, request("agents", input)];
                        case 1: return [2 /*return*/, (_a.sent())];
                    }
                });
            });
        },
        modelCatalog: function (input) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, request("model.catalog", input)];
                        case 1: return [2 /*return*/, (_a.sent())];
                    }
                });
            });
        },
        modelSelection: function () {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, request("model.selection")];
                        case 1: return [2 /*return*/, (_a.sent())];
                    }
                });
            });
        },
        selectModel: function (modelID, variant) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, request("model.select", { modelID: modelID, variant: variant })];
                        case 1:
                            _a.sent();
                            return [2 /*return*/];
                    }
                });
            });
        },
        setDefaultModel: function (modelID) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, request("model.setDefault", {
                                modelID: modelID,
                            })];
                        case 1: return [2 /*return*/, (_a.sent())];
                    }
                });
            });
        },
        reasoningEffort: function () {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, request("model.reasoning")];
                        case 1: return [2 /*return*/, (_a.sent())];
                    }
                });
            });
        },
        setReasoningEffort: function (effort) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, request("model.reasoning.set", { effort: effort })];
                        case 1:
                            _a.sent();
                            return [2 /*return*/];
                    }
                });
            });
        },
        permissionList: function () {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, request("permission.list")];
                        case 1: return [2 /*return*/, (_a.sent())];
                    }
                });
            });
        },
        permissionSave: function (input) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, request("permission.save", input)];
                        case 1: return [2 /*return*/, (_a.sent())];
                    }
                });
            });
        },
        permissionDelete: function (name) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, request("permission.delete", name)];
                        case 1: return [2 /*return*/, (_a.sent())];
                    }
                });
            });
        },
        skills: function (input) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, request("skills", input)];
                        case 1: return [2 /*return*/, (_a.sent())];
                    }
                });
            });
        },
        workspaceFiles: function (input) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, request("workspace.files", input)];
                        case 1: return [2 /*return*/, (_a.sent())];
                    }
                });
            });
        },
        workspaceSearch: function (input) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, request("workspace.search", input)];
                        case 1: return [2 /*return*/, (_a.sent())];
                    }
                });
            });
        },
        workspaceList: function (input) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, request("workspace.list", input)];
                        case 1: return [2 /*return*/, (_a.sent())];
                    }
                });
            });
        },
        workspaceRead: function (input) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, request("workspace.read", input)];
                        case 1: return [2 /*return*/, (_a.sent())];
                    }
                });
            });
        },
        resourceRead: function (input) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, request("resource.read", input)];
                        case 1: return [2 /*return*/, (_a.sent())];
                    }
                });
            });
        },
        workspaceGlob: function (input) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, request("workspace.glob", input)];
                        case 1: return [2 /*return*/, (_a.sent())];
                    }
                });
            });
        },
        workspaceWrite: function (input) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, request("workspace.write", input)];
                        case 1: return [2 /*return*/, (_a.sent())];
                    }
                });
            });
        },
        workspaceCreate: function (input) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, request("workspace.create", input)];
                        case 1: return [2 /*return*/, (_a.sent())];
                    }
                });
            });
        },
        workspaceRename: function (input) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, request("workspace.rename", input)];
                        case 1: return [2 /*return*/, (_a.sent())];
                    }
                });
            });
        },
        workspaceDelete: function (input) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, request("workspace.delete", input)];
                        case 1: return [2 /*return*/, (_a.sent())];
                    }
                });
            });
        },
        workspaceWriteConflicts: function (input) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, request("workspace.writeConflicts", input)];
                        case 1: return [2 /*return*/, (_a.sent())];
                    }
                });
            });
        },
        mcpCatalog: function (input) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, request("mcp.catalog", input)];
                        case 1: return [2 /*return*/, (_a.sent())];
                    }
                });
            });
        },
        getMcpPrompt: function (server, name, arguments_, workspaceID) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, request("mcp.prompt", {
                                server: server,
                                name: name,
                                arguments_: arguments_,
                                workspaceID: workspaceID,
                            })];
                        case 1: return [2 /*return*/, (_a.sent())];
                    }
                });
            });
        },
        readMcpResource: function (server, uri, workspaceID) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, request("mcp.resource", {
                                server: server,
                                uri: uri,
                                workspaceID: workspaceID,
                            })];
                        case 1: return [2 /*return*/, (_a.sent())];
                    }
                });
            });
        },
        commandCatalog: function (input) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, request("command.catalog", input)];
                        case 1: return [2 /*return*/, (_a.sent())];
                    }
                });
            });
        },
        commandExecute: function (input) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, request("command.execute", input)];
                        case 1:
                            _a.sent();
                            return [2 /*return*/];
                    }
                });
            });
        },
        updateConfig: function (input) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, request("config.update", input)];
                        case 1: return [2 /*return*/, (_a.sent())];
                    }
                });
            });
        },
        configGet: function () {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, request("config.get")];
                        case 1: return [2 /*return*/, (_a.sent())];
                    }
                });
            });
        },
        nativeTerminalList: function (sessionID) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, request("native-terminal.list", sessionID ? { sessionID: sessionID } : undefined)];
                        case 1: return [2 /*return*/, (_a.sent())];
                    }
                });
            });
        },
        nativeTerminalRead: function (id, sessionID) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, request("native-terminal.read", {
                                id: id,
                                sessionID: sessionID,
                            })];
                        case 1: return [2 /*return*/, (_a.sent())];
                    }
                });
            });
        },
        nativeTerminalOpenHub: function () {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, request("native-terminal.open-hub")];
                        case 1: return [2 /*return*/, (_a.sent())];
                    }
                });
            });
        },
        nativeTerminalReleaseHumanControl: function (id, sessionID) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, request("native-terminal.release-human-control", {
                                id: id,
                                sessionID: sessionID,
                            })];
                        case 1: return [2 /*return*/, (_a.sent())];
                    }
                });
            });
        },
        nativeTerminalRevokeApprovalScope: function (id, sessionID) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, request("native-terminal.revoke-approval-scope", {
                                id: id,
                                sessionID: sessionID,
                            })];
                        case 1: return [2 /*return*/, (_a.sent())];
                    }
                });
            });
        },
        nativeTerminalStop: function (id, sessionID) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, request("native-terminal.stop", {
                                id: id,
                                sessionID: sessionID,
                            })];
                        case 1: return [2 /*return*/, (_a.sent())];
                    }
                });
            });
        },
        nativeTerminalBeginSecureInput: function (id, sessionID) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, request("native-terminal.begin-secure-input", {
                                id: id,
                                sessionID: sessionID,
                            })];
                        case 1: return [2 /*return*/, (_a.sent())];
                    }
                });
            });
        },
        nativeTerminalEndSecureInput: function (id) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, request("native-terminal.end-secure-input", id)];
                        case 1: return [2 /*return*/, (_a.sent())];
                    }
                });
            });
        },
        checkpointList: function (sessionID) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, request("checkpoint.list", sessionID ? { sessionID: sessionID } : undefined)];
                        case 1: return [2 /*return*/, (_a.sent())];
                    }
                });
            });
        },
        checkpointListByKind: function (kind, sessionID) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, request("checkpoint.listByKind", {
                                kind: kind,
                                sessionID: sessionID,
                            })];
                        case 1: return [2 /*return*/, (_a.sent())];
                    }
                });
            });
        },
        auditRounds: function (planID, workspaceID) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, request("audit.rounds", __assign(__assign({}, (planID ? { planID: planID } : {})), (workspaceID ? { workspaceID: workspaceID } : {})))];
                        case 1: return [2 /*return*/, (_a.sent())];
                    }
                });
            });
        },
        roundDiff: function (input) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, request("workspace.round.diff", input)];
                        case 1: return [2 /*return*/, (_a.sent())];
                    }
                });
            });
        },
        workspaceDiff: function (input) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, request("workspace.diff", input)];
                        case 1: return [2 /*return*/, (_a.sent())];
                    }
                });
            });
        },
        workspaceGitDiff: function (input) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, request("workspace.git.diff", input)];
                        case 1: return [2 /*return*/, (_a.sent())];
                    }
                });
            });
        },
        gitRefs: function (input) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, request("git.refs", input)];
                        case 1: return [2 /*return*/, (_a.sent())];
                    }
                });
            });
        },
        teamPRList: function (sessionID) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, request("team.pr.list", sessionID ? { sessionID: sessionID } : undefined)];
                        case 1: return [2 /*return*/, (_a.sent())];
                    }
                });
            });
        },
        checkpointPreview: function (id, sessionID, options) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, request("checkpoint.preview", {
                                id: id,
                                sessionID: sessionID,
                                options: options,
                            })];
                        case 1: return [2 /*return*/, (_a.sent())];
                    }
                });
            });
        },
        checkpointRollback: function (input) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, request("checkpoint.rollback", input)];
                        case 1: return [2 /*return*/, (_a.sent())];
                    }
                });
            });
        },
        checkpointRename: function (input) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, request("checkpoint.rename", input)];
                        case 1: return [2 /*return*/, (_a.sent())];
                    }
                });
            });
        },
        sessionList: function () {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, request("session.list")];
                        case 1: return [2 /*return*/, (_a.sent())];
                    }
                });
            });
        },
        sessionTouch: function (id) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, request("session.touch", id)];
                        case 1:
                            _a.sent();
                            return [2 /*return*/];
                    }
                });
            });
        },
        sessionRename: function (id, title) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, request("session.rename", { id: id, title: title })];
                        case 1: return [2 /*return*/, (_a.sent())];
                    }
                });
            });
        },
        sessionPin: function (id, pinned) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, request("session.pin", { id: id, pinned: pinned })];
                        case 1: return [2 /*return*/, (_a.sent())];
                    }
                });
            });
        },
        sessionDuplicate: function (id, title) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, request("session.duplicate", { id: id, title: title })];
                        case 1: return [2 /*return*/, (_a.sent())];
                    }
                });
            });
        },
        sessionDelete: function (id) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, request("session.delete", id)];
                        case 1: return [2 /*return*/, (_a.sent())];
                    }
                });
            });
        },
        sessionAttach: function (id) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, request("session.attach", id)];
                        case 1: return [2 /*return*/, (_a.sent())];
                    }
                });
            });
        },
        sessionFork: function (id, turnID, title) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, request("session.fork", { id: id, turnID: turnID, title: title })];
                        case 1: return [2 /*return*/, (_a.sent())];
                    }
                });
            });
        },
        sessionRollbackMessages: function (id, turnID) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, request("session.rollback.messages", {
                                id: id,
                                turnID: turnID,
                            })];
                        case 1: return [2 /*return*/, (_a.sent())];
                    }
                });
            });
        },
        sandboxList: function (sessionID) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, request("sandbox.list", sessionID ? { sessionID: sessionID } : undefined)];
                        case 1: return [2 /*return*/, (_a.sent())];
                    }
                });
            });
        },
        sandboxDiff: function (id, sessionID, options) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, request("sandbox.diff", {
                                id: id,
                                sessionID: sessionID,
                                options: options,
                            })];
                        case 1: return [2 /*return*/, (_a.sent())];
                    }
                });
            });
        },
        sandboxResources: function (id, sessionID) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, request("sandbox.resources", { id: id, sessionID: sessionID })];
                        case 1: return [2 /*return*/, (_a.sent())];
                    }
                });
            });
        },
        sandboxResourceOutput: function (input) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, request("sandbox.resource-output", input)];
                        case 1: return [2 /*return*/, (_a.sent())];
                    }
                });
            });
        },
        sandboxResourceStop: function (input) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, request("sandbox.resource-stop", input)];
                        case 1: return [2 /*return*/, (_a.sent())];
                    }
                });
            });
        },
        sandboxMerge: function (id, sessionID) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, request("sandbox.merge", { id: id, sessionID: sessionID })];
                        case 1: return [2 /*return*/, (_a.sent())];
                    }
                });
            });
        },
        sandboxDelete: function (id, sessionID) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, request("sandbox.delete", { id: id, sessionID: sessionID })];
                        case 1: return [2 /*return*/, (_a.sent())];
                    }
                });
            });
        },
        selectAgent: function (name) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, request("agent.select", name)];
                        case 1: return [2 /*return*/, (_a.sent())];
                    }
                });
            });
        },
        sessionSnapshot: function (sessionID) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, request("session.snapshot", sessionID ? { sessionID: sessionID } : undefined)];
                        case 1: return [2 /*return*/, (_a.sent())];
                    }
                });
            });
        },
        planDocList: function (sessionID) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, request("planDoc.list", sessionID ? { sessionID: sessionID } : undefined)];
                        case 1: return [2 /*return*/, (_a.sent())];
                    }
                });
            });
        },
        planDocRead: function (input) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, request("planDoc.read", input)];
                        case 1: return [2 /*return*/, (_a.sent())];
                    }
                });
            });
        },
        planDocWrite: function (input) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, request("planDoc.write", input)];
                        case 1: return [2 /*return*/, (_a.sent())];
                    }
                });
            });
        },
        planDocMark: function (input) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, request("planDoc.mark", input)];
                        case 1: return [2 /*return*/, (_a.sent())];
                    }
                });
            });
        },
        planDocDelete: function (planID, sessionID) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, request("planDoc.delete", {
                                planID: planID,
                                sessionID: sessionID,
                            })];
                        case 1: return [2 /*return*/, (_a.sent())];
                    }
                });
            });
        },
        planDocStatus: function (planID, sessionID) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, request("planDoc.status", {
                                planID: planID,
                                sessionID: sessionID,
                            })];
                        case 1: return [2 /*return*/, (_a.sent())];
                    }
                });
            });
        },
        planDocUpdateStatus: function (input) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, request("planDoc.updateStatus", input)];
                        case 1: return [2 /*return*/, (_a.sent())];
                    }
                });
            });
        },
        planDocActive: function (sessionID) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, request("planDoc.active", sessionID ? { sessionID: sessionID } : undefined)];
                        case 1: return [2 /*return*/, (_a.sent())];
                    }
                });
            });
        },
        planDocActivate: function (planID, sessionID) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, request("planDoc.activate", {
                                planID: planID,
                                sessionID: sessionID,
                            })];
                        case 1: return [2 /*return*/, (_a.sent())];
                    }
                });
            });
        },
        planDocDeactivate: function (sessionID) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, request("planDoc.deactivate", sessionID ? { sessionID: sessionID } : undefined)];
                        case 1: return [2 /*return*/, (_a.sent())];
                    }
                });
            });
        },
        mailboxList: function (sessionID) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, request("mailbox.list", sessionID ? { sessionID: sessionID } : undefined)];
                        case 1: return [2 /*return*/, (_a.sent())];
                    }
                });
            });
        },
        mailboxSend: function (input) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, request("mailbox.send", input)];
                        case 1: return [2 /*return*/, (_a.sent())];
                    }
                });
            });
        },
        mailboxAcknowledge: function (messageID, sessionID) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, request("mailbox.acknowledge", {
                                messageID: messageID,
                                sessionID: sessionID,
                            })];
                        case 1: return [2 /*return*/, (_a.sent())];
                    }
                });
            });
        },
        driftFindings: function (sessionID) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, request("drift.list", sessionID ? { sessionID: sessionID } : undefined)];
                        case 1: return [2 /*return*/, (_a.sent())];
                    }
                });
            });
        },
        completions: function (sessionID) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, request("completions", sessionID ? { sessionID: sessionID } : undefined)];
                        case 1: return [2 /*return*/, (_a.sent())];
                    }
                });
            });
        },
        constitutionRules: function (sessionID) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, request("constitution.list", sessionID ? { sessionID: sessionID } : undefined)];
                        case 1: return [2 /*return*/, (_a.sent())];
                    }
                });
            });
        },
        decisionRecords: function (sessionID) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, request("decision.list", sessionID ? { sessionID: sessionID } : undefined)];
                        case 1: return [2 /*return*/, (_a.sent())];
                    }
                });
            });
        },
        evidenceRecords: function (sessionID) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, request("evidence.list", sessionID ? { sessionID: sessionID } : undefined)];
                        case 1: return [2 /*return*/, (_a.sent())];
                    }
                });
            });
        },
        projectionContributions: function (input) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, request("projections.list", input)];
                        case 1: return [2 /*return*/, (_a.sent())];
                    }
                });
            });
        },
        requestOverride: function (input, sessionID) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, request("constitution.override.request", __assign(__assign({}, input), { sessionID: sessionID }))];
                        case 1: return [2 /*return*/, (_a.sent())];
                    }
                });
            });
        },
        approveOverride: function (input) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, request("constitution.override.approve", input)];
                        case 1: return [2 /*return*/, (_a.sent())];
                    }
                });
            });
        },
        subagents: function (sessionID) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, request("session.subagents", sessionID ? { sessionID: sessionID } : undefined)];
                        case 1: return [2 /*return*/, (_a.sent())];
                    }
                });
            });
        },
        subagentHistory: function (sessionID) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, request("subagent.history", sessionID)];
                        case 1: return [2 /*return*/, (_a.sent())];
                    }
                });
            });
        },
        subagentHistoryPage: function (input) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, request("subagent.history.page", input)];
                        case 1: return [2 /*return*/, (_a.sent())];
                    }
                });
            });
        },
        uploadAttachment: function (input) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, request("attachment.upload", input)];
                        case 1: return [2 /*return*/, (_a.sent())];
                    }
                });
            });
        },
        attachmentDataUrl: function (input) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, request("attachment.dataUrl", input)];
                        case 1: return [2 /*return*/, (_a.sent())];
                    }
                });
            });
        },
        naviChat: chatStreamSurface("navi"),
        niaChat: chatStreamSurface("nia"),
        dispose: function () {
            return __awaiter(this, void 0, void 0, function () {
                var _a;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0: return [4 /*yield*/, request("dispose")];
                        case 1:
                            _b.sent();
                            port.removeEventListener("message", onMessage);
                            (_a = port.close) === null || _a === void 0 ? void 0 : _a.call(port);
                            return [2 /*return*/];
                    }
                });
            });
        },
        cancel: function (reason, sessionID) {
            notify("cancel", { reason: reason, sessionID: sessionID });
        },
        // A round trip rather than a notification: these answer whether the runtime
        // actually paused, and a channel that cannot see the answer would have to
        // make one up.
        pause: function (reason, sessionID) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, request("pause", { reason: reason, sessionID: sessionID })];
                        case 1: return [2 /*return*/, (_a.sent())];
                    }
                });
            });
        },
        resume: function (sessionID) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, request("resume", sessionID ? { sessionID: sessionID } : undefined)];
                        case 1: return [2 /*return*/, (_a.sent())];
                    }
                });
            });
        },
        snapshot: function () {
            var id = "snap_worker_".concat(Date.now().toString(36));
            notify("snapshot");
            return { type: "snapshot.created", id: id, files: [] };
        },
        diagnostics: function (limit, sessionID) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, request("diagnostics", { limit: limit, sessionID: sessionID })];
                        case 1: return [2 /*return*/, (_a.sent())];
                    }
                });
            });
        },
        diagnostic: function (message, level) {
            notify("diagnostic", { message: message, level: level });
        },
        lastSubmission: function () {
            return undefined;
        },
        respondApproval: function (response) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, request("approval", response)];
                        case 1: return [2 /*return*/, (_a.sent())];
                    }
                });
            });
        },
        respondQuestion: function (response) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, request("question", response)];
                        case 1: return [2 /*return*/, (_a.sent())];
                    }
                });
            });
        },
    };
}
function attachRuntimeClientWorker(port, client, options) {
    var _a;
    var activeClient = client;
    var forwardEvent = function (event) {
        port.postMessage({ type: "runtime.event", event: event });
    };
    activeClient.start(forwardEvent);
    port.addEventListener("message", function (event) {
        var request = event.data;
        if (request.type !== "runtime.request")
            return;
        void handlePortRequest(request);
    });
    (_a = port.start) === null || _a === void 0 ? void 0 : _a.call(port);
    function handlePortRequest(request) {
        return __awaiter(this, void 0, void 0, function () {
            var value, rebuild, precheck, _a, blocked, error_1;
            var _b, _c, _d, _e, _f, _g, _h, _j;
            return __generator(this, function (_k) {
                switch (_k.label) {
                    case 0:
                        _k.trys.push([0, 18, , 19]);
                        value = void 0;
                        if (!(request.method === "config.reload")) return [3 /*break*/, 8];
                        rebuild = options === null || options === void 0 ? void 0 : options.reload;
                        if (!rebuild) return [3 /*break*/, 2];
                        return [4 /*yield*/, ((_b = activeClient.canReloadConfig) === null || _b === void 0 ? void 0 : _b.call(activeClient))];
                    case 1:
                        _a = _k.sent();
                        return [3 /*break*/, 3];
                    case 2:
                        _a = undefined;
                        _k.label = 3;
                    case 3:
                        precheck = _a;
                        blocked = !rebuild
                            ? "this runtime host cannot rebuild the runtime"
                            : precheck && !precheck.allowed
                                ? ((_c = precheck.reason) !== null && _c !== void 0 ? _c : "runtime config cannot be applied now")
                                : undefined;
                        if (!(blocked || !rebuild)) return [3 /*break*/, 4];
                        value = { applied: false, reason: blocked };
                        return [3 /*break*/, 7];
                    case 4: return [4 /*yield*/, ((_d = activeClient.dispose) === null || _d === void 0 ? void 0 : _d.call(activeClient))];
                    case 5:
                        _k.sent();
                        activeClient = rebuild();
                        activeClient.start(forwardEvent, { replay: "none" });
                        return [4 /*yield*/, ((_e = activeClient.runtimeStatus) === null || _e === void 0 ? void 0 : _e.call(activeClient))];
                    case 6:
                        _k.sent();
                        value = { applied: true };
                        _k.label = 7;
                    case 7: return [3 /*break*/, 17];
                    case 8:
                        if (!(request.method === "config.update")) return [3 /*break*/, 10];
                        return [4 /*yield*/, ((_f = activeClient.updateConfig) === null || _f === void 0 ? void 0 : _f.call(activeClient, request.value))];
                    case 9:
                        // The write-apply path, unlike the rebuild path above: the patch lands
                        // on disk and the runtime applies it in place.
                        value = _k.sent();
                        return [3 /*break*/, 17];
                    case 10:
                        if (!(request.method === "config.get")) return [3 /*break*/, 12];
                        return [4 /*yield*/, ((_g = activeClient.configGet) === null || _g === void 0 ? void 0 : _g.call(activeClient))];
                    case 11:
                        value = _k.sent();
                        return [3 /*break*/, 17];
                    case 12:
                        if (!(request.method === "dispose")) return [3 /*break*/, 15];
                        return [4 /*yield*/, ((_h = activeClient.dispose) === null || _h === void 0 ? void 0 : _h.call(activeClient))];
                    case 13:
                        value = _k.sent();
                        return [4 /*yield*/, ((_j = options === null || options === void 0 ? void 0 : options.disposeHost) === null || _j === void 0 ? void 0 : _j.call(options))];
                    case 14:
                        _k.sent();
                        return [3 /*break*/, 17];
                    case 15: return [4 /*yield*/, handleWorkerRequest(activeClient, request)];
                    case 16:
                        value = _k.sent();
                        _k.label = 17;
                    case 17:
                        port.postMessage({
                            type: "runtime.response",
                            id: request.id,
                            value: value,
                        });
                        return [3 /*break*/, 19];
                    case 18:
                        error_1 = _k.sent();
                        port.postMessage({
                            type: "runtime.response",
                            id: request.id,
                            error: error_1 instanceof Error ? error_1.message : String(error_1),
                        });
                        return [3 /*break*/, 19];
                    case 19: return [2 /*return*/];
                }
            });
        });
    }
}
function handleWorkerRequest(client, request) {
    return __awaiter(this, void 0, void 0, function () {
        var input, _a, input, value, input, input, value, value, value, value, value, value, value, value, value, value, value, value, value, input, input, input, input, input, input, value, value, value, value, value, value, value, surface, surface, surface, surface, surface, value, surface, surface, value;
        var _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0, _1, _2, _3, _4, _5, _6, _7, _8, _9, _10, _11, _12, _13, _14, _15, _16, _17, _18, _19, _20, _21, _22, _23, _24, _25, _26, _27, _28, _29, _30, _31, _32, _33, _34, _35, _36, _37, _38, _39, _40, _41, _42, _43, _44, _45, _46, _47, _48, _49, _50, _51, _52, _53, _54, _55, _56, _57, _58, _59, _60, _61, _62, _63, _64, _65, _66, _67, _68, _69, _70, _71, _72, _73, _74, _75, _76, _77, _78, _79, _80, _81, _82, _83, _84, _85, _86, _87, _88, _89, _90, _91, _92, _93, _94, _95, _96, _97, _98, _99, _100, _101, _102, _103, _104, _105, _106, _107;
        return __generator(this, function (_108) {
            switch (_108.label) {
                case 0:
                    if (!(request.method === "submit")) return [3 /*break*/, 5];
                    input = request.value && typeof request.value === "object"
                        ? request.value
                        : { text: String((_b = request.value) !== null && _b !== void 0 ? _b : "") };
                    if (!client.submitInput) return [3 /*break*/, 2];
                    return [4 /*yield*/, client.submitInput(input)];
                case 1:
                    _a = _108.sent();
                    return [3 /*break*/, 4];
                case 2: return [4 /*yield*/, client.submit(input.text)];
                case 3:
                    _a = _108.sent();
                    _108.label = 4;
                case 4: return [2 /*return*/, _a];
                case 5:
                    if (!(request.method === "submitAndWait")) return [3 /*break*/, 8];
                    input = request.value && typeof request.value === "object"
                        ? request.value
                        : { text: String((_c = request.value) !== null && _c !== void 0 ? _c : "") };
                    if (!client.submitAndWait) return [3 /*break*/, 7];
                    return [4 /*yield*/, client.submitAndWait(request.value && typeof request.value === "object"
                            ? request.value
                            : input.text)];
                case 6: return [2 /*return*/, _108.sent()];
                case 7: throw new Error("RuntimeClient does not support submitAndWait");
                case 8:
                    if (!(request.method === "input.remove")) return [3 /*break*/, 10];
                    if (!client.removeInput)
                        throw new Error("RuntimeClient does not support input.remove");
                    return [4 /*yield*/, client.removeInput(request.value)];
                case 9: return [2 /*return*/, _108.sent()];
                case 10:
                    if (!(request.method === "input.replace")) return [3 /*break*/, 12];
                    if (!client.replaceInput)
                        throw new Error("RuntimeClient does not support input.replace");
                    return [4 /*yield*/, client.replaceInput(request.value)];
                case 11: return [2 /*return*/, _108.sent()];
                case 12:
                    if (!(request.method === "input.promote")) return [3 /*break*/, 14];
                    if (!client.promoteInput)
                        throw new Error("RuntimeClient does not support input.promote");
                    return [4 /*yield*/, client.promoteInput(request.value)];
                case 13: return [2 /*return*/, _108.sent()];
                case 14:
                    if (!(request.method === "interactive.pending")) return [3 /*break*/, 16];
                    if (!client.pendingInteractive)
                        throw new Error("RuntimeClient does not support interactive.pending");
                    return [4 /*yield*/, client.pendingInteractive(request.value)];
                case 15: return [2 /*return*/, _108.sent()];
                case 16:
                    if (!(request.method === "interactive.respond")) return [3 /*break*/, 18];
                    if (!client.respondInteractive)
                        throw new Error("RuntimeClient does not support interactive.respond");
                    return [4 /*yield*/, client.respondInteractive(request.value)];
                case 17: return [2 /*return*/, _108.sent()];
                case 18:
                    if (!(request.method === "runtime.status")) return [3 /*break*/, 20];
                    return [4 /*yield*/, ((_d = client.runtimeStatus) === null || _d === void 0 ? void 0 : _d.call(client, (_e = request.value) === null || _e === void 0 ? void 0 : _e.sessionID))];
                case 19: return [2 /*return*/, _108.sent()];
                case 20:
                    if (!(request.method === "history")) return [3 /*break*/, 22];
                    return [4 /*yield*/, ((_f = client.history) === null || _f === void 0 ? void 0 : _f.call(client, request.value))];
                case 21: return [2 /*return*/, _108.sent()];
                case 22:
                    if (!(request.method === "messages")) return [3 /*break*/, 24];
                    return [4 /*yield*/, ((_g = client.messages) === null || _g === void 0 ? void 0 : _g.call(client, request.value))];
                case 23: return [2 /*return*/, _108.sent()];
                case 24:
                    if (!(request.method === "agents")) return [3 /*break*/, 26];
                    return [4 /*yield*/, ((_h = client.agents) === null || _h === void 0 ? void 0 : _h.call(client, request.value))];
                case 25: return [2 /*return*/, _108.sent()];
                case 26:
                    if (!(request.method === "model.catalog")) return [3 /*break*/, 28];
                    return [4 /*yield*/, ((_j = client.modelCatalog) === null || _j === void 0 ? void 0 : _j.call(client, request.value))];
                case 27: return [2 /*return*/, _108.sent()];
                case 28:
                    if (!(request.method === "model.selection")) return [3 /*break*/, 30];
                    return [4 /*yield*/, ((_k = client.modelSelection) === null || _k === void 0 ? void 0 : _k.call(client))];
                case 29: return [2 /*return*/, _108.sent()];
                case 30:
                    if (!(request.method === "model.setDefault")) return [3 /*break*/, 32];
                    value = request.value;
                    return [4 /*yield*/, ((_l = client.setDefaultModel) === null || _l === void 0 ? void 0 : _l.call(client, value.modelID))];
                case 31: return [2 /*return*/, _108.sent()];
                case 32:
                    if (!(request.method === "model.select")) return [3 /*break*/, 34];
                    input = request.value;
                    return [4 /*yield*/, ((_m = client.selectModel) === null || _m === void 0 ? void 0 : _m.call(client, input.modelID, input.variant))];
                case 33: return [2 /*return*/, _108.sent()];
                case 34:
                    if (!(request.method === "model.reasoning")) return [3 /*break*/, 36];
                    return [4 /*yield*/, ((_o = client.reasoningEffort) === null || _o === void 0 ? void 0 : _o.call(client))];
                case 35: return [2 /*return*/, _108.sent()];
                case 36:
                    if (!(request.method === "model.reasoning.set")) return [3 /*break*/, 38];
                    input = request.value;
                    return [4 /*yield*/, ((_p = client.setReasoningEffort) === null || _p === void 0 ? void 0 : _p.call(client, input.effort))];
                case 37: return [2 /*return*/, _108.sent()];
                case 38:
                    if (!(request.method === "permission.list")) return [3 /*break*/, 40];
                    return [4 /*yield*/, ((_q = client.permissionList) === null || _q === void 0 ? void 0 : _q.call(client))];
                case 39: return [2 /*return*/, _108.sent()];
                case 40:
                    if (!(request.method === "permission.save")) return [3 /*break*/, 42];
                    return [4 /*yield*/, ((_r = client.permissionSave) === null || _r === void 0 ? void 0 : _r.call(client, request.value))];
                case 41: return [2 /*return*/, _108.sent()];
                case 42:
                    if (!(request.method === "permission.delete")) return [3 /*break*/, 44];
                    return [4 /*yield*/, ((_s = client.permissionDelete) === null || _s === void 0 ? void 0 : _s.call(client, request.value))];
                case 43: return [2 /*return*/, _108.sent()];
                case 44:
                    if (!(request.method === "skills")) return [3 /*break*/, 46];
                    return [4 /*yield*/, ((_t = client.skills) === null || _t === void 0 ? void 0 : _t.call(client, request.value))];
                case 45: return [2 /*return*/, _108.sent()];
                case 46:
                    if (!(request.method === "workspace.files")) return [3 /*break*/, 48];
                    return [4 /*yield*/, ((_u = client.workspaceFiles) === null || _u === void 0 ? void 0 : _u.call(client, request.value))];
                case 47: return [2 /*return*/, _108.sent()];
                case 48:
                    if (!(request.method === "workspace.search")) return [3 /*break*/, 50];
                    return [4 /*yield*/, ((_v = client.workspaceSearch) === null || _v === void 0 ? void 0 : _v.call(client, request.value))];
                case 49: return [2 /*return*/, _108.sent()];
                case 50:
                    if (!(request.method === "workspace.list")) return [3 /*break*/, 52];
                    return [4 /*yield*/, ((_w = client.workspaceList) === null || _w === void 0 ? void 0 : _w.call(client, request.value))];
                case 51: return [2 /*return*/, _108.sent()];
                case 52:
                    if (!(request.method === "workspace.read")) return [3 /*break*/, 54];
                    return [4 /*yield*/, ((_x = client.workspaceRead) === null || _x === void 0 ? void 0 : _x.call(client, request.value))];
                case 53: return [2 /*return*/, _108.sent()];
                case 54:
                    if (!(request.method === "resource.read")) return [3 /*break*/, 56];
                    return [4 /*yield*/, ((_y = client.resourceRead) === null || _y === void 0 ? void 0 : _y.call(client, request.value))];
                case 55: return [2 /*return*/, _108.sent()];
                case 56:
                    if (!(request.method === "workspace.glob")) return [3 /*break*/, 58];
                    return [4 /*yield*/, ((_z = client.workspaceGlob) === null || _z === void 0 ? void 0 : _z.call(client, request.value))];
                case 57: return [2 /*return*/, _108.sent()];
                case 58:
                    if (!(request.method === "workspace.write")) return [3 /*break*/, 60];
                    return [4 /*yield*/, ((_0 = client.workspaceWrite) === null || _0 === void 0 ? void 0 : _0.call(client, request.value))];
                case 59: return [2 /*return*/, _108.sent()];
                case 60:
                    if (!(request.method === "workspace.create")) return [3 /*break*/, 62];
                    return [4 /*yield*/, ((_1 = client.workspaceCreate) === null || _1 === void 0 ? void 0 : _1.call(client, request.value))];
                case 61: return [2 /*return*/, _108.sent()];
                case 62:
                    if (!(request.method === "workspace.rename")) return [3 /*break*/, 64];
                    return [4 /*yield*/, ((_2 = client.workspaceRename) === null || _2 === void 0 ? void 0 : _2.call(client, request.value))];
                case 63: return [2 /*return*/, _108.sent()];
                case 64:
                    if (!(request.method === "workspace.delete")) return [3 /*break*/, 66];
                    return [4 /*yield*/, ((_3 = client.workspaceDelete) === null || _3 === void 0 ? void 0 : _3.call(client, request.value))];
                case 65: return [2 /*return*/, _108.sent()];
                case 66:
                    if (!(request.method === "workspace.writeConflicts")) return [3 /*break*/, 68];
                    return [4 /*yield*/, ((_4 = client.workspaceWriteConflicts) === null || _4 === void 0 ? void 0 : _4.call(client, request.value))];
                case 67: return [2 /*return*/, _108.sent()];
                case 68:
                    if (!(request.method === "mcp.catalog")) return [3 /*break*/, 70];
                    return [4 /*yield*/, ((_5 = client.mcpCatalog) === null || _5 === void 0 ? void 0 : _5.call(client, request.value))];
                case 69: return [2 /*return*/, _108.sent()];
                case 70:
                    if (!(request.method === "mcp.prompt")) return [3 /*break*/, 72];
                    return [4 /*yield*/, ((_6 = client.getMcpPrompt) === null || _6 === void 0 ? void 0 : _6.call(client, request.value.server, request.value.name, request.value.arguments_, request.value.workspaceID))];
                case 71: return [2 /*return*/, _108.sent()];
                case 72:
                    if (!(request.method === "mcp.resource")) return [3 /*break*/, 74];
                    return [4 /*yield*/, ((_7 = client.readMcpResource) === null || _7 === void 0 ? void 0 : _7.call(client, request.value.server, request.value.uri, request.value.workspaceID))];
                case 73: return [2 /*return*/, _108.sent()];
                case 74:
                    if (!(request.method === "native-terminal.list")) return [3 /*break*/, 76];
                    return [4 /*yield*/, ((_8 = client.nativeTerminalList) === null || _8 === void 0 ? void 0 : _8.call(client, (_9 = request.value) === null || _9 === void 0 ? void 0 : _9.sessionID))];
                case 75: return [2 /*return*/, _108.sent()];
                case 76:
                    if (!(request.method === "native-terminal.read")) return [3 /*break*/, 78];
                    value = request.value;
                    return [4 /*yield*/, ((_10 = client.nativeTerminalRead) === null || _10 === void 0 ? void 0 : _10.call(client, value.id, value.sessionID))];
                case 77: return [2 /*return*/, _108.sent()];
                case 78:
                    if (!(request.method === "native-terminal.open-hub")) return [3 /*break*/, 80];
                    return [4 /*yield*/, ((_11 = client.nativeTerminalOpenHub) === null || _11 === void 0 ? void 0 : _11.call(client))];
                case 79: return [2 /*return*/, _108.sent()];
                case 80:
                    if (!(request.method === "native-terminal.release-human-control")) return [3 /*break*/, 82];
                    value = request.value;
                    return [4 /*yield*/, ((_12 = client.nativeTerminalReleaseHumanControl) === null || _12 === void 0 ? void 0 : _12.call(client, value.id, value.sessionID))];
                case 81: return [2 /*return*/, _108.sent()];
                case 82:
                    if (!(request.method === "diagnostics")) return [3 /*break*/, 84];
                    value = request.value;
                    return [4 /*yield*/, ((_13 = client.diagnostics) === null || _13 === void 0 ? void 0 : _13.call(client, typeof value === "number" ? value : value === null || value === void 0 ? void 0 : value.limit, typeof value === "number" ? undefined : value === null || value === void 0 ? void 0 : value.sessionID))];
                case 83: return [2 /*return*/, _108.sent()];
                case 84:
                    if (!(request.method === "native-terminal.revoke-approval-scope")) return [3 /*break*/, 86];
                    value = request.value;
                    return [4 /*yield*/, ((_14 = client.nativeTerminalRevokeApprovalScope) === null || _14 === void 0 ? void 0 : _14.call(client, value.id, value.sessionID))];
                case 85: return [2 /*return*/, _108.sent()];
                case 86:
                    if (!(request.method === "native-terminal.stop")) return [3 /*break*/, 88];
                    value = request.value;
                    return [4 /*yield*/, ((_15 = client.nativeTerminalStop) === null || _15 === void 0 ? void 0 : _15.call(client, value.id, value.sessionID))];
                case 87: return [2 /*return*/, _108.sent()];
                case 88:
                    if (!(request.method === "native-terminal.begin-secure-input")) return [3 /*break*/, 90];
                    value = request.value;
                    return [4 /*yield*/, ((_16 = client.nativeTerminalBeginSecureInput) === null || _16 === void 0 ? void 0 : _16.call(client, value.id, value.sessionID))];
                case 89: return [2 /*return*/, _108.sent()];
                case 90:
                    if (!(request.method === "native-terminal.end-secure-input")) return [3 /*break*/, 92];
                    value = request.value;
                    return [4 /*yield*/, ((_17 = client.nativeTerminalEndSecureInput) === null || _17 === void 0 ? void 0 : _17.call(client, value.id, value.sessionID))];
                case 91: return [2 /*return*/, _108.sent()];
                case 92:
                    if (!(request.method === "checkpoint.list")) return [3 /*break*/, 94];
                    return [4 /*yield*/, ((_18 = client.checkpointList) === null || _18 === void 0 ? void 0 : _18.call(client, (_19 = request.value) === null || _19 === void 0 ? void 0 : _19.sessionID))];
                case 93: return [2 /*return*/, _108.sent()];
                case 94:
                    if (!(request.method === "checkpoint.listByKind")) return [3 /*break*/, 96];
                    value = request.value;
                    return [4 /*yield*/, ((_20 = client.checkpointListByKind) === null || _20 === void 0 ? void 0 : _20.call(client, value.kind, value.sessionID))];
                case 95: return [2 /*return*/, _108.sent()];
                case 96:
                    if (!(request.method === "audit.rounds")) return [3 /*break*/, 98];
                    value = request.value;
                    return [4 /*yield*/, ((_21 = client.auditRounds) === null || _21 === void 0 ? void 0 : _21.call(client, value === null || value === void 0 ? void 0 : value.planID, value === null || value === void 0 ? void 0 : value.workspaceID))];
                case 97: return [2 /*return*/, _108.sent()];
                case 98:
                    if (!(request.method === "workspace.round.diff")) return [3 /*break*/, 100];
                    return [4 /*yield*/, ((_22 = client.roundDiff) === null || _22 === void 0 ? void 0 : _22.call(client, request.value))];
                case 99: return [2 /*return*/, _108.sent()];
                case 100:
                    if (!(request.method === "workspace.diff")) return [3 /*break*/, 102];
                    return [4 /*yield*/, ((_23 = client.workspaceDiff) === null || _23 === void 0 ? void 0 : _23.call(client, request.value))];
                case 101: return [2 /*return*/, _108.sent()];
                case 102:
                    if (!(request.method === "workspace.git.diff")) return [3 /*break*/, 104];
                    return [4 /*yield*/, ((_24 = client.workspaceGitDiff) === null || _24 === void 0 ? void 0 : _24.call(client, request.value))];
                case 103: return [2 /*return*/, _108.sent()];
                case 104:
                    if (!(request.method === "git.refs")) return [3 /*break*/, 106];
                    return [4 /*yield*/, ((_25 = client.gitRefs) === null || _25 === void 0 ? void 0 : _25.call(client, request.value))];
                case 105: return [2 /*return*/, _108.sent()];
                case 106:
                    if (!(request.method === "team.pr.list")) return [3 /*break*/, 108];
                    return [4 /*yield*/, ((_26 = client.teamPRList) === null || _26 === void 0 ? void 0 : _26.call(client, (_27 = request.value) === null || _27 === void 0 ? void 0 : _27.sessionID))];
                case 107: return [2 /*return*/, _108.sent()];
                case 108:
                    if (!(request.method === "checkpoint.preview")) return [3 /*break*/, 110];
                    value = request.value;
                    return [4 /*yield*/, ((_28 = client.checkpointPreview) === null || _28 === void 0 ? void 0 : _28.call(client, value.id, value.sessionID, value.options))];
                case 109: return [2 /*return*/, _108.sent()];
                case 110:
                    if (!(request.method === "checkpoint.rollback")) return [3 /*break*/, 112];
                    return [4 /*yield*/, ((_29 = client.checkpointRollback) === null || _29 === void 0 ? void 0 : _29.call(client, request.value))];
                case 111: return [2 /*return*/, _108.sent()];
                case 112:
                    if (!(request.method === "checkpoint.rename")) return [3 /*break*/, 114];
                    return [4 /*yield*/, ((_30 = client.checkpointRename) === null || _30 === void 0 ? void 0 : _30.call(client, request.value))];
                case 113: return [2 /*return*/, _108.sent()];
                case 114:
                    if (request.method === "cancel") {
                        value = request.value;
                        return [2 /*return*/, client.cancel(typeof value === "string"
                                ? value
                                : typeof (value === null || value === void 0 ? void 0 : value.reason) === "string"
                                    ? value.reason
                                    : undefined, typeof value === "string" ? undefined : value === null || value === void 0 ? void 0 : value.sessionID)];
                    }
                    if (request.method === "pause") {
                        value = request.value;
                        return [2 /*return*/, (_31 = client.pause) === null || _31 === void 0 ? void 0 : _31.call(client, typeof value === "string" ? value : value === null || value === void 0 ? void 0 : value.reason, typeof value === "string" ? undefined : value === null || value === void 0 ? void 0 : value.sessionID)];
                    }
                    if (request.method === "resume") {
                        value = request.value;
                        return [2 /*return*/, (_32 = client.resume) === null || _32 === void 0 ? void 0 : _32.call(client, value === null || value === void 0 ? void 0 : value.sessionID)];
                    }
                    if (request.method === "snapshot")
                        return [2 /*return*/, client.snapshot()];
                    if (request.method === "diagnostic") {
                        input = request.value;
                        return [2 /*return*/, client.diagnostic(typeof input.message === "string" ? input.message : "runtime diagnostic", input.level === "info" || input.level === "error"
                                ? input.level
                                : "warning")];
                    }
                    if (!(request.method === "dispose")) return [3 /*break*/, 116];
                    return [4 /*yield*/, ((_33 = client.dispose) === null || _33 === void 0 ? void 0 : _33.call(client))];
                case 115: return [2 /*return*/, _108.sent()];
                case 116:
                    if (!(request.method === "session.list")) return [3 /*break*/, 118];
                    return [4 /*yield*/, ((_34 = client.sessionList) === null || _34 === void 0 ? void 0 : _34.call(client))];
                case 117: return [2 /*return*/, _108.sent()];
                case 118:
                    if (!(request.method === "session.touch")) return [3 /*break*/, 120];
                    return [4 /*yield*/, ((_35 = client.sessionTouch) === null || _35 === void 0 ? void 0 : _35.call(client, request.value))];
                case 119: return [2 /*return*/, _108.sent()];
                case 120:
                    if (!(request.method === "session.rename")) return [3 /*break*/, 122];
                    input = request.value;
                    return [4 /*yield*/, ((_36 = client.sessionRename) === null || _36 === void 0 ? void 0 : _36.call(client, input.id, input.title))];
                case 121: return [2 /*return*/, _108.sent()];
                case 122:
                    if (!(request.method === "session.pin")) return [3 /*break*/, 124];
                    input = request.value;
                    return [4 /*yield*/, ((_37 = client.sessionPin) === null || _37 === void 0 ? void 0 : _37.call(client, input.id, input.pinned))];
                case 123: return [2 /*return*/, _108.sent()];
                case 124:
                    if (!(request.method === "session.duplicate")) return [3 /*break*/, 126];
                    input = request.value;
                    return [4 /*yield*/, ((_38 = client.sessionDuplicate) === null || _38 === void 0 ? void 0 : _38.call(client, input.id, input.title))];
                case 125: return [2 /*return*/, _108.sent()];
                case 126:
                    if (!(request.method === "session.delete")) return [3 /*break*/, 128];
                    return [4 /*yield*/, ((_39 = client.sessionDelete) === null || _39 === void 0 ? void 0 : _39.call(client, request.value))];
                case 127: return [2 /*return*/, _108.sent()];
                case 128:
                    if (!(request.method === "session.attach")) return [3 /*break*/, 130];
                    return [4 /*yield*/, ((_40 = client.sessionAttach) === null || _40 === void 0 ? void 0 : _40.call(client, request.value))];
                case 129: return [2 /*return*/, _108.sent()];
                case 130:
                    if (!(request.method === "session.fork")) return [3 /*break*/, 132];
                    input = request.value;
                    return [4 /*yield*/, ((_41 = client.sessionFork) === null || _41 === void 0 ? void 0 : _41.call(client, input.id, input.turnID, input.title))];
                case 131: return [2 /*return*/, _108.sent()];
                case 132:
                    if (!(request.method === "session.rollback.messages")) return [3 /*break*/, 134];
                    input = request.value;
                    return [4 /*yield*/, ((_42 = client.sessionRollbackMessages) === null || _42 === void 0 ? void 0 : _42.call(client, input.id, input.turnID))];
                case 133: return [2 /*return*/, _108.sent()];
                case 134:
                    if (!(request.method === "sandbox.list")) return [3 /*break*/, 136];
                    return [4 /*yield*/, ((_43 = client.sandboxList) === null || _43 === void 0 ? void 0 : _43.call(client))];
                case 135: return [2 /*return*/, _108.sent()];
                case 136:
                    if (!(request.method === "sandbox.diff")) return [3 /*break*/, 138];
                    value = request.value;
                    return [4 /*yield*/, ((_44 = client.sandboxDiff) === null || _44 === void 0 ? void 0 : _44.call(client, value.id, value.sessionID, value.options))];
                case 137: return [2 /*return*/, _108.sent()];
                case 138:
                    if (!(request.method === "sandbox.resources")) return [3 /*break*/, 140];
                    return [4 /*yield*/, ((_45 = client.sandboxResources) === null || _45 === void 0 ? void 0 : _45.call(client, request.value))];
                case 139: return [2 /*return*/, _108.sent()];
                case 140:
                    if (!(request.method === "sandbox.resource-output")) return [3 /*break*/, 142];
                    return [4 /*yield*/, ((_46 = client.sandboxResourceOutput) === null || _46 === void 0 ? void 0 : _46.call(client, request.value))];
                case 141: return [2 /*return*/, _108.sent()];
                case 142:
                    if (!(request.method === "sandbox.resource-stop")) return [3 /*break*/, 144];
                    return [4 /*yield*/, ((_47 = client.sandboxResourceStop) === null || _47 === void 0 ? void 0 : _47.call(client, request.value))];
                case 143: return [2 /*return*/, _108.sent()];
                case 144:
                    if (!(request.method === "sandbox.merge")) return [3 /*break*/, 146];
                    value = request.value;
                    return [4 /*yield*/, ((_48 = client.sandboxMerge) === null || _48 === void 0 ? void 0 : _48.call(client, value.id, value.sessionID))];
                case 145: return [2 /*return*/, _108.sent()];
                case 146:
                    if (!(request.method === "sandbox.delete")) return [3 /*break*/, 148];
                    value = request.value;
                    return [4 /*yield*/, ((_49 = client.sandboxDelete) === null || _49 === void 0 ? void 0 : _49.call(client, value.id, value.sessionID))];
                case 147: return [2 /*return*/, _108.sent()];
                case 148:
                    if (!(request.method === "agent.select")) return [3 /*break*/, 150];
                    return [4 /*yield*/, ((_50 = client.selectAgent) === null || _50 === void 0 ? void 0 : _50.call(client, request.value))];
                case 149: return [2 /*return*/, _108.sent()];
                case 150:
                    if (!(request.method === "session.snapshot")) return [3 /*break*/, 152];
                    return [4 /*yield*/, ((_51 = client.sessionSnapshot) === null || _51 === void 0 ? void 0 : _51.call(client, (_52 = request.value) === null || _52 === void 0 ? void 0 : _52.sessionID))];
                case 151: return [2 /*return*/, _108.sent()];
                case 152:
                    if (!(request.method === "planDoc.list")) return [3 /*break*/, 154];
                    return [4 /*yield*/, ((_53 = client.planDocList) === null || _53 === void 0 ? void 0 : _53.call(client, (_54 = request.value) === null || _54 === void 0 ? void 0 : _54.sessionID))];
                case 153: return [2 /*return*/, _108.sent()];
                case 154:
                    if (!(request.method === "planDoc.read")) return [3 /*break*/, 156];
                    return [4 /*yield*/, ((_55 = client.planDocRead) === null || _55 === void 0 ? void 0 : _55.call(client, request.value))];
                case 155: return [2 /*return*/, _108.sent()];
                case 156:
                    if (!(request.method === "planDoc.write")) return [3 /*break*/, 158];
                    return [4 /*yield*/, ((_56 = client.planDocWrite) === null || _56 === void 0 ? void 0 : _56.call(client, request.value))];
                case 157: return [2 /*return*/, _108.sent()];
                case 158:
                    if (!(request.method === "planDoc.mark")) return [3 /*break*/, 160];
                    return [4 /*yield*/, ((_57 = client.planDocMark) === null || _57 === void 0 ? void 0 : _57.call(client, request.value))];
                case 159: return [2 /*return*/, _108.sent()];
                case 160:
                    if (!(request.method === "planDoc.delete")) return [3 /*break*/, 162];
                    value = request.value;
                    return [4 /*yield*/, ((_58 = client.planDocDelete) === null || _58 === void 0 ? void 0 : _58.call(client, value.planID, value.sessionID))];
                case 161: return [2 /*return*/, _108.sent()];
                case 162:
                    if (!(request.method === "planDoc.status")) return [3 /*break*/, 164];
                    value = request.value;
                    return [4 /*yield*/, ((_59 = client.planDocStatus) === null || _59 === void 0 ? void 0 : _59.call(client, value.planID, value.sessionID))];
                case 163: return [2 /*return*/, _108.sent()];
                case 164:
                    if (!(request.method === "planDoc.updateStatus")) return [3 /*break*/, 166];
                    return [4 /*yield*/, ((_60 = client.planDocUpdateStatus) === null || _60 === void 0 ? void 0 : _60.call(client, request.value))];
                case 165: return [2 /*return*/, _108.sent()];
                case 166:
                    if (!(request.method === "planDoc.active")) return [3 /*break*/, 168];
                    return [4 /*yield*/, ((_61 = client.planDocActive) === null || _61 === void 0 ? void 0 : _61.call(client, (_62 = request.value) === null || _62 === void 0 ? void 0 : _62.sessionID))];
                case 167: return [2 /*return*/, _108.sent()];
                case 168:
                    if (!(request.method === "planDoc.activate")) return [3 /*break*/, 170];
                    value = request.value;
                    return [4 /*yield*/, ((_63 = client.planDocActivate) === null || _63 === void 0 ? void 0 : _63.call(client, value.planID, value.sessionID))];
                case 169: return [2 /*return*/, _108.sent()];
                case 170:
                    if (!(request.method === "planDoc.deactivate")) return [3 /*break*/, 172];
                    return [4 /*yield*/, ((_64 = client.planDocDeactivate) === null || _64 === void 0 ? void 0 : _64.call(client, (_65 = request.value) === null || _65 === void 0 ? void 0 : _65.sessionID))];
                case 171: return [2 /*return*/, _108.sent()];
                case 172:
                    if (!(request.method === "mailbox.list")) return [3 /*break*/, 174];
                    return [4 /*yield*/, ((_66 = client.mailboxList) === null || _66 === void 0 ? void 0 : _66.call(client, (_67 = request.value) === null || _67 === void 0 ? void 0 : _67.sessionID))];
                case 173: return [2 /*return*/, _108.sent()];
                case 174:
                    if (!(request.method === "mailbox.send")) return [3 /*break*/, 176];
                    return [4 /*yield*/, ((_68 = client.mailboxSend) === null || _68 === void 0 ? void 0 : _68.call(client, request.value))];
                case 175: return [2 /*return*/, _108.sent()];
                case 176:
                    if (!(request.method === "mailbox.acknowledge")) return [3 /*break*/, 178];
                    value = request.value;
                    return [4 /*yield*/, ((_69 = client.mailboxAcknowledge) === null || _69 === void 0 ? void 0 : _69.call(client, value.messageID, value.sessionID))];
                case 177: return [2 /*return*/, _108.sent()];
                case 178:
                    if (!(request.method === "drift.list")) return [3 /*break*/, 180];
                    return [4 /*yield*/, ((_70 = client.driftFindings) === null || _70 === void 0 ? void 0 : _70.call(client, request.value))];
                case 179: return [2 /*return*/, _108.sent()];
                case 180:
                    if (!(request.method === "completions")) return [3 /*break*/, 182];
                    return [4 /*yield*/, ((_71 = client.completions) === null || _71 === void 0 ? void 0 : _71.call(client, request.value))];
                case 181: return [2 /*return*/, _108.sent()];
                case 182:
                    if (!(request.method === "completion.human_validation")) return [3 /*break*/, 184];
                    return [4 /*yield*/, ((_72 = client.recordHumanValidation) === null || _72 === void 0 ? void 0 : _72.call(client, request.value))];
                case 183: return [2 /*return*/, _108.sent()];
                case 184:
                    if (!(request.method === "plan.task.states")) return [3 /*break*/, 186];
                    return [4 /*yield*/, ((_73 = client.planTaskStates) === null || _73 === void 0 ? void 0 : _73.call(client, request.value))];
                case 185: return [2 /*return*/, _108.sent()];
                case 186:
                    if (!(request.method === "workgraph.integrity")) return [3 /*break*/, 188];
                    return [4 /*yield*/, ((_74 = client.workGraphIntegrity) === null || _74 === void 0 ? void 0 : _74.call(client, (_75 = request.value) === null || _75 === void 0 ? void 0 : _75.sessionID))];
                case 187: return [2 /*return*/, _108.sent()];
                case 188:
                    if (!(request.method === "workgraph.unattributed")) return [3 /*break*/, 190];
                    return [4 /*yield*/, ((_76 = client.unattributedChanges) === null || _76 === void 0 ? void 0 : _76.call(client, (_77 = request.value) === null || _77 === void 0 ? void 0 : _77.sessionID))];
                case 189: return [2 /*return*/, _108.sent()];
                case 190:
                    if (!(request.method === "constitution.list")) return [3 /*break*/, 192];
                    return [4 /*yield*/, ((_78 = client.constitutionRules) === null || _78 === void 0 ? void 0 : _78.call(client, (_79 = request.value) === null || _79 === void 0 ? void 0 : _79.sessionID))];
                case 191: return [2 /*return*/, _108.sent()];
                case 192:
                    if (!(request.method === "decision.list")) return [3 /*break*/, 194];
                    return [4 /*yield*/, ((_80 = client.decisionRecords) === null || _80 === void 0 ? void 0 : _80.call(client, (_81 = request.value) === null || _81 === void 0 ? void 0 : _81.sessionID))];
                case 193: return [2 /*return*/, _108.sent()];
                case 194:
                    if (!(request.method === "evidence.list")) return [3 /*break*/, 196];
                    return [4 /*yield*/, ((_82 = client.evidenceRecords) === null || _82 === void 0 ? void 0 : _82.call(client, request.value))];
                case 195: return [2 /*return*/, _108.sent()];
                case 196:
                    if (!(request.method === "projections.list")) return [3 /*break*/, 198];
                    return [4 /*yield*/, ((_83 = client.projectionContributions) === null || _83 === void 0 ? void 0 : _83.call(client, request.value))];
                case 197: return [2 /*return*/, _108.sent()];
                case 198:
                    if (!(request.method === "constitution.override.request")) return [3 /*break*/, 200];
                    return [4 /*yield*/, ((_84 = client.requestOverride) === null || _84 === void 0 ? void 0 : _84.call(client, request.value))];
                case 199: return [2 /*return*/, _108.sent()];
                case 200:
                    if (!(request.method === "constitution.override.approve")) return [3 /*break*/, 202];
                    return [4 /*yield*/, ((_85 = client.approveOverride) === null || _85 === void 0 ? void 0 : _85.call(client, request.value))];
                case 201: return [2 /*return*/, _108.sent()];
                case 202:
                    if (!(request.method === "constitution.docRules")) return [3 /*break*/, 204];
                    return [4 /*yield*/, ((_86 = client.constitutionDocRules) === null || _86 === void 0 ? void 0 : _86.call(client, (_87 = request.value) === null || _87 === void 0 ? void 0 : _87.sessionID))];
                case 203: return [2 /*return*/, _108.sent()];
                case 204:
                    if (!(request.method === "constitution.docRule.promote")) return [3 /*break*/, 206];
                    return [4 /*yield*/, ((_88 = client.promoteConstitutionDocRule) === null || _88 === void 0 ? void 0 : _88.call(client, request.value))];
                case 205: return [2 /*return*/, _108.sent()];
                case 206:
                    if (!(request.method === "constitution.docRule.update")) return [3 /*break*/, 208];
                    return [4 /*yield*/, ((_89 = client.updateConstitutionDocRule) === null || _89 === void 0 ? void 0 : _89.call(client, request.value))];
                case 207: return [2 /*return*/, _108.sent()];
                case 208:
                    if (!(request.method === "navi.chat.submit" ||
                        request.method === "nia.chat.submit")) return [3 /*break*/, 210];
                    surface = request.method === "navi.chat.submit" ? client.naviChat : client.niaChat;
                    return [4 /*yield*/, ((_90 = surface === null || surface === void 0 ? void 0 : surface.submit) === null || _90 === void 0 ? void 0 : _90.call(surface, request.value))];
                case 209: return [2 /*return*/, _108.sent()];
                case 210:
                    if (!(request.method === "navi.chat.abort" ||
                        request.method === "nia.chat.abort")) return [3 /*break*/, 212];
                    surface = request.method === "navi.chat.abort" ? client.naviChat : client.niaChat;
                    return [4 /*yield*/, ((_91 = surface === null || surface === void 0 ? void 0 : surface.abort) === null || _91 === void 0 ? void 0 : _91.call(surface, (_92 = request.value) === null || _92 === void 0 ? void 0 : _92.sessionID))];
                case 211: return [2 /*return*/, _108.sent()];
                case 212:
                    if (!(request.method === "navi.chat.messages" ||
                        request.method === "nia.chat.messages")) return [3 /*break*/, 214];
                    surface = request.method === "navi.chat.messages"
                        ? client.naviChat
                        : client.niaChat;
                    return [4 /*yield*/, ((_93 = surface === null || surface === void 0 ? void 0 : surface.messages) === null || _93 === void 0 ? void 0 : _93.call(surface, (_94 = request.value) === null || _94 === void 0 ? void 0 : _94.sessionID))];
                case 213: return [2 /*return*/, _108.sent()];
                case 214:
                    if (!(request.method === "navi.chat.messages.page" ||
                        request.method === "nia.chat.messages.page")) return [3 /*break*/, 216];
                    surface = request.method === "navi.chat.messages.page"
                        ? client.naviChat
                        : client.niaChat;
                    return [4 /*yield*/, ((_95 = surface === null || surface === void 0 ? void 0 : surface.messagesPage) === null || _95 === void 0 ? void 0 : _95.call(surface, request.value))];
                case 215: return [2 /*return*/, _108.sent()];
                case 216:
                    if (!(request.method === "navi.chat.rollback" ||
                        request.method === "nia.chat.rollback")) return [3 /*break*/, 218];
                    surface = request.method === "navi.chat.rollback"
                        ? client.naviChat
                        : client.niaChat;
                    value = request.value;
                    return [4 /*yield*/, ((_96 = surface === null || surface === void 0 ? void 0 : surface.rollback) === null || _96 === void 0 ? void 0 : _96.call(surface, value.input, value.sessionID))];
                case 217: return [2 /*return*/, _108.sent()];
                case 218:
                    if (!(request.method === "navi.chat.model.profile" ||
                        request.method === "nia.chat.model.profile")) return [3 /*break*/, 220];
                    surface = request.method === "navi.chat.model.profile"
                        ? client.naviChat
                        : client.niaChat;
                    return [4 /*yield*/, ((_97 = surface === null || surface === void 0 ? void 0 : surface.modelProfile) === null || _97 === void 0 ? void 0 : _97.call(surface, (_98 = request.value) === null || _98 === void 0 ? void 0 : _98.sessionID))];
                case 219: return [2 /*return*/, _108.sent()];
                case 220:
                    if (!(request.method === "navi.chat.model.profile.set" ||
                        request.method === "nia.chat.model.profile.set")) return [3 /*break*/, 222];
                    surface = request.method === "navi.chat.model.profile.set"
                        ? client.naviChat
                        : client.niaChat;
                    value = request.value;
                    return [4 /*yield*/, ((_99 = surface === null || surface === void 0 ? void 0 : surface.setModelProfile) === null || _99 === void 0 ? void 0 : _99.call(surface, value.profile, value.sessionID))];
                case 221: return [2 /*return*/, _108.sent()];
                case 222:
                    if (request.method === "approval")
                        return [2 /*return*/, client.respondApproval(request.value)];
                    if (request.method === "question")
                        return [2 /*return*/, client.respondQuestion(request.value)];
                    if (request.method === "runtime.availability")
                        return [2 /*return*/, (0, contracts_1.describeRuntimeCapabilities)(client, {
                                name: "worker",
                                routedMembers: exports.WORKER_ROUTED_MEMBERS,
                            })];
                    if (!(request.method === "command.catalog")) return [3 /*break*/, 224];
                    return [4 /*yield*/, ((_100 = client.commandCatalog) === null || _100 === void 0 ? void 0 : _100.call(client, request.value))];
                case 223: return [2 /*return*/, _108.sent()];
                case 224:
                    if (!(request.method === "command.execute")) return [3 /*break*/, 226];
                    return [4 /*yield*/, ((_101 = client.commandExecute) === null || _101 === void 0 ? void 0 : _101.call(client, request.value))];
                case 225: return [2 /*return*/, _108.sent()];
                case 226:
                    if (!(request.method === "session.subagents")) return [3 /*break*/, 228];
                    return [4 /*yield*/, ((_102 = client.subagents) === null || _102 === void 0 ? void 0 : _102.call(client, (_103 = request.value) === null || _103 === void 0 ? void 0 : _103.sessionID))];
                case 227: return [2 /*return*/, _108.sent()];
                case 228:
                    if (!(request.method === "subagent.history")) return [3 /*break*/, 230];
                    return [4 /*yield*/, ((_104 = client.subagentHistory) === null || _104 === void 0 ? void 0 : _104.call(client, request.value))];
                case 229: return [2 /*return*/, _108.sent()];
                case 230:
                    if (!(request.method === "subagent.history.page")) return [3 /*break*/, 232];
                    return [4 /*yield*/, ((_105 = client.subagentHistoryPage) === null || _105 === void 0 ? void 0 : _105.call(client, request.value))];
                case 231: return [2 /*return*/, _108.sent()];
                case 232:
                    if (!(request.method === "attachment.upload")) return [3 /*break*/, 234];
                    return [4 /*yield*/, ((_106 = client.uploadAttachment) === null || _106 === void 0 ? void 0 : _106.call(client, request.value))];
                case 233: return [2 /*return*/, _108.sent()];
                case 234:
                    if (!(request.method === "attachment.dataUrl")) return [3 /*break*/, 236];
                    return [4 /*yield*/, ((_107 = client.attachmentDataUrl) === null || _107 === void 0 ? void 0 : _107.call(client, request.value))];
                case 235: return [2 /*return*/, _108.sent()];
                case 236: throw new Error("worker channel does not route ".concat(request.method));
            }
        });
    });
}
