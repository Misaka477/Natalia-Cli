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
exports.createTerminalRuntime = createTerminalRuntime;
var session_store_1 = require("@anthelia/session-store");
function createTerminalRuntime(ctx) {
    return {
        setPendingHumanTerminal: setPendingHumanTerminal,
        clearPendingHumanTerminal: clearPendingHumanTerminal,
        maybeContinueAfterHumanInput: maybeContinueAfterHumanInput,
        publishTerminalSession: publishTerminalSession,
        terminalLiveUpdate: terminalLiveUpdate,
        publishTerminalViewer: publishTerminalViewer,
    };
    function setPendingHumanTerminal(forSessionID, input) {
        return __awaiter(this, void 0, void 0, function () {
            var _a, getExecutionBySession, getSessionPersistence, setSessionPersistence, publishForSession, target, targetSession, sessionStoreController, pendingSnapshot, sessionPersistence, next;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = ctx.ports, getExecutionBySession = _a.getExecutionBySession, getSessionPersistence = _a.getSessionPersistence, setSessionPersistence = _a.setSessionPersistence, publishForSession = _a.publishForSession;
                        target = getExecutionBySession().get(forSessionID);
                        targetSession = target === null || target === void 0 ? void 0 : target.session;
                        if (!targetSession)
                            return [2 /*return*/];
                        sessionStoreController = ctx.state.serviceDirectory.get(session_store_1.sessionStoreController);
                        targetSession.metadata = __assign({}, targetSession.metadata);
                        targetSession.metadata.pendingHumanTerminal = {
                            terminalID: input.terminalID,
                            reason: input.reason,
                            since: new Date().toISOString(),
                        };
                        pendingSnapshot = targetSession.metadata.pendingHumanTerminal;
                        sessionPersistence = ctx.ports.getSessionPersistenceForSession(forSessionID);
                        next = sessionPersistence
                            .then(function () {
                            return sessionStoreController.updateMetadata(forSessionID, {
                                pendingHumanTerminal: pendingSnapshot,
                            });
                        })
                            .catch(function (error) {
                            return publishForSession(target, {
                                type: "diagnostic",
                                level: "warning",
                                message: "pending human terminal persistence failed: ".concat(error instanceof Error ? error.message : String(error)),
                            });
                        });
                        ctx.ports.setSessionPersistenceForSession(forSessionID, next);
                        setSessionPersistence(Promise.allSettled([getSessionPersistence(), next]).then(function () { return undefined; }));
                        return [4 /*yield*/, next];
                    case 1:
                        _b.sent();
                        return [2 /*return*/];
                }
            });
        });
    }
    function clearPendingHumanTerminal(forSessionID) {
        return __awaiter(this, void 0, void 0, function () {
            var _a, getExecutionBySession, getSessionPersistence, setSessionPersistence, publishForSession, target, targetSession, sessionStoreController, sessionPersistence, next;
            var _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        _a = ctx.ports, getExecutionBySession = _a.getExecutionBySession, getSessionPersistence = _a.getSessionPersistence, setSessionPersistence = _a.setSessionPersistence, publishForSession = _a.publishForSession;
                        target = getExecutionBySession().get(forSessionID);
                        targetSession = target === null || target === void 0 ? void 0 : target.session;
                        if (!((_b = targetSession === null || targetSession === void 0 ? void 0 : targetSession.metadata) === null || _b === void 0 ? void 0 : _b.pendingHumanTerminal))
                            return [2 /*return*/, false];
                        sessionStoreController = ctx.state.serviceDirectory.get(session_store_1.sessionStoreController);
                        targetSession.metadata = __assign({}, targetSession.metadata);
                        delete targetSession.metadata.pendingHumanTerminal;
                        sessionPersistence = ctx.ports.getSessionPersistenceForSession(forSessionID);
                        next = sessionPersistence
                            .then(function () {
                            return sessionStoreController.updateMetadata(forSessionID, {
                                pendingHumanTerminal: undefined,
                            });
                        })
                            .catch(function (error) {
                            return publishForSession(target, {
                                type: "diagnostic",
                                level: "warning",
                                message: "pending human terminal clear failed: ".concat(error instanceof Error ? error.message : String(error)),
                            });
                        });
                        ctx.ports.setSessionPersistenceForSession(forSessionID, next);
                        setSessionPersistence(Promise.allSettled([getSessionPersistence(), next]).then(function () { return undefined; }));
                        return [4 /*yield*/, next];
                    case 1:
                        _c.sent();
                        return [2 /*return*/, true];
                }
            });
        });
    }
    /**
     * TERM-M.3 (c): when the human finishes the requested input on the pending
     * terminal, a new turn resumes the task automatically. Idempotent by
     * construction: the pending state is cleared first, so a second release
     * cannot double-resume.
     */
    function maybeContinueAfterHumanInput(terminalID, forSessionID) {
        return __awaiter(this, void 0, void 0, function () {
            var _a, getExecutionBySession, getActiveExec, publishForSession, submitInput, exec, pending;
            var _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        _a = ctx.ports, getExecutionBySession = _a.getExecutionBySession, getActiveExec = _a.getActiveExec, publishForSession = _a.publishForSession, submitInput = _a.submitInput;
                        exec = forSessionID
                            ? getExecutionBySession().get(forSessionID)
                            : getActiveExec();
                        if (!exec)
                            return [2 /*return*/];
                        pending = (_b = exec.session.metadata) === null || _b === void 0 ? void 0 : _b.pendingHumanTerminal;
                        if (!pending || pending.terminalID !== terminalID)
                            return [2 /*return*/];
                        return [4 /*yield*/, clearPendingHumanTerminal(exec.session.id)];
                    case 1:
                        _c.sent();
                        publishForSession(exec, {
                            type: "diagnostic",
                            level: "info",
                            message: "human completed input on terminal ".concat(terminalID, "; continuing the task"),
                        });
                        return [4 /*yield*/, submitInput({
                                text: "[automated continuation] The human finished providing input on terminal ".concat(terminalID, ". Check the terminal output and continue the original task."),
                                delivery: "next-turn",
                            }, exec.session.id)];
                    case 2:
                        _c.sent();
                        return [2 /*return*/];
                }
            });
        });
    }
    function publishTerminalSession(terminal, action, redacted) {
        if (redacted === void 0) { redacted = false; }
        var _a = ctx.ports, publish = _a.publish, scheduleRuntimeStatusSnapshot = _a.scheduleRuntimeStatusSnapshot;
        var terminalStatusByID = ctx.state.terminalStatusByID;
        publish(terminalLiveUpdate(terminal, action));
        if (action) {
            publish({
                type: "terminal.action",
                id: terminal.id,
                action: action,
                redacted: redacted,
                target: { kind: "host", cwd: terminal.cwd },
            });
            publish({
                type: "terminal.timeline",
                id: terminal.id,
                actor: "user",
                action: action,
                status: "executed",
                summary: redacted ? "sensitive input supplied" : "".concat(action, " executed"),
                at: new Date().toISOString(),
            });
        }
        if (terminalStatusByID.get(terminal.id) !== terminal.status) {
            if (terminal.status === "exited")
                terminalStatusByID.delete(terminal.id);
            else
                terminalStatusByID.set(terminal.id, terminal.status);
            scheduleRuntimeStatusSnapshot();
        }
    }
    function terminalLiveUpdate(terminal, action) {
        var _a;
        // Framebuffers and transcripts are read on demand. Sending either with every
        // output revision makes the live event stream retain and clone large snapshots.
        return {
            type: "terminal.update",
            id: terminal.id,
            command: terminal.command,
            cwd: terminal.cwd,
            status: terminal.status,
            attached: terminal.attached,
            rows: terminal.rows,
            cols: terminal.cols,
            activity: terminal.status === "running" ? "running" : "waiting",
            tail: terminal.tail,
            lastAction: action,
            target: { kind: "host", cwd: terminal.cwd },
            ownership: ((_a = terminal.inputOwner) === null || _a === void 0 ? void 0 : _a.type) === "viewer" ? "user" : "model",
            revision: terminal.revision,
            lastOutputAt: terminal.lastOutputAt,
            viewers: terminal.viewers,
            inputOwner: terminal.inputOwner,
            geometryOwner: terminal.geometryOwner,
        };
    }
    function publishTerminalViewer(terminal, viewerID, action, viewerKind) {
        var _a, _b;
        publishTerminalSession(terminal);
        var publish = ctx.ports.publish;
        publish({
            type: "terminal.viewer",
            id: terminal.id,
            viewerID: viewerID,
            viewerKind: viewerKind,
            action: action,
            inputOwner: (_a = terminal.inputOwner) !== null && _a !== void 0 ? _a : { type: "model" },
            geometryOwner: (_b = terminal.geometryOwner) !== null && _b !== void 0 ? _b : { type: "model" },
            at: new Date().toISOString(),
        });
    }
}
