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
exports.collaborationWaiter = void 0;
exports.createInteractiveWaiter = createInteractiveWaiter;
var contracts_1 = require("@natalia/contracts");
var tools_1 = require("@anthelia/tools");
var session_1 = require("@anthelia/session");
var runtime_services_1 = require("@natalia/runtime-services");
/**
 * The waiter's service token. The id is the wire name the runtime has always
 * used for this binding; the token adds the typed face so consumers resolve it
 * without a `<T>` cast and the id lives in the package that owns the service
 * rather than a central table.
 */
exports.collaborationWaiter = (0, runtime_services_1.defineService)("collaboration.waiter", { scope: "workspace", capability: "services" });
function createInteractiveWaiter(deps) {
    var publish = deps.publish;
    var pendingApprovals = new Map();
    var pendingApprovalRequests = new Set();
    var approvalSessionByID = new Map();
    // These grants only live in this RuntimeClient instance. Reopening a
    // durable session must never silently restore side-effecting permissions.
    // D5.3: they are keyed per session — what session A approved never grants
    // session B, and a background turn of A keeps its grants when the UI
    // attaches to B.
    var sessionApprovedFamilies = new Map();
    var approvalFamilyByID = new Map();
    var approvalWorkGraphContext = new Map();
    var approvalWaiters = new Map();
    var pendingQuestions = new Map();
    var questionTurnByID = new Map();
    var questionWaiters = new Map();
    var pendingInteractives = new Map();
    var interactiveSessionByID = new Map();
    var interactiveWaiters = new Map();
    function requireApproval(approvalID, tool, call, turnID, options) {
        return __awaiter(this, void 0, void 0, function () {
            var permissionMode, session, agentID, permissionFamily, terminalApproval, presentation, expiresAt, response, error_1, aborted, reason;
            var _a, _b, _c, _d, _e, _f;
            return __generator(this, function (_g) {
                switch (_g.label) {
                    case 0:
                        permissionMode = deps.permissionMode(turnID);
                        if (permissionMode === "read_only")
                            return [2 /*return*/, { reason: (0, runtime_services_1.readOnlyToolMessage)(tool.name) }];
                        if (permissionMode === "auto" && !(options === null || options === void 0 ? void 0 : options.force))
                            return [2 /*return*/, undefined];
                        session = deps.sessionIDForTurn(turnID);
                        agentID = (_a = deps.agentIDForTurn) === null || _a === void 0 ? void 0 : _a.call(deps, turnID);
                        permissionFamily = (0, contracts_1.classifyPermissionFamily)(tool.name, (_b = deps.capabilityOwnerForTool) === null || _b === void 0 ? void 0 : _b.call(deps, tool.name));
                        if (!(options === null || options === void 0 ? void 0 : options.force) &&
                            ((_c = sessionApprovedFamilies.get(session)) === null || _c === void 0 ? void 0 : _c.has(permissionFamily.id)))
                            return [2 /*return*/, undefined];
                        terminalApproval = (0, runtime_services_1.terminalApprovalScope)(tool.name, call.arguments);
                        presentation = approvalPresentation(tool.name, call.arguments);
                        expiresAt = (terminalApproval === null || terminalApproval === void 0 ? void 0 : terminalApproval.risk) === "terminal_low"
                            ? Date.now() + terminalApproval.ttlMs
                            : undefined;
                        // Establish every lookup before publishing. Event sinks are allowed to reply
                        // synchronously; publishing first made an immediate `respondApproval()` look
                        // like a response to a non-pending request and silently ignored it.
                        pendingApprovalRequests.add(approvalID);
                        approvalSessionByID.set(approvalID, session);
                        approvalWorkGraphContext.set(approvalID, {
                            turnID: turnID,
                            callID: call.id,
                            toolName: tool.name,
                        });
                        approvalFamilyByID.set(approvalID, permissionFamily);
                        deps.publishForSession(session, __assign(__assign({ type: "approval.request", id: approvalID, title: (options === null || options === void 0 ? void 0 : options.force)
                                ? "Approve ".concat((_d = options.reason) !== null && _d !== void 0 ? _d : tool.name)
                                : "Approve ".concat(tool.name), preview: presentation.preview, detail: (options === null || options === void 0 ? void 0 : options.reason)
                                ? "".concat(options.reason, "\n").concat((_e = presentation.detail) !== null && _e !== void 0 ? _e : "").trim()
                                : presentation.detail, keyArguments: presentation.keyArguments, sensitive: presentation.sensitive, risk: terminalApproval === null || terminalApproval === void 0 ? void 0 : terminalApproval.risk, scope: terminalApproval === null || terminalApproval === void 0 ? void 0 : terminalApproval.scope, expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined, revocable: terminalApproval ? true : undefined }, ((options === null || options === void 0 ? void 0 : options.force) ? { allowSession: false } : {})), { permissionFamily: permissionFamily, agentID: agentID }));
                        _g.label = 1;
                    case 1:
                        _g.trys.push([1, 3, 4, 5]);
                        return [4 /*yield*/, waitForResponse(approvalID, pendingApprovals, approvalWaiters, deps.abortSignal(turnID), "approval timed out: ".concat(tool.name), expiresAt === undefined
                                ? undefined
                                : Math.max(0, expiresAt - Date.now()))];
                    case 2:
                        response = _g.sent();
                        if (response.decision !== "reject")
                            return [2 /*return*/, undefined];
                        deps.publishForSession(session, {
                            type: "policy.decision",
                            turnID: turnID,
                            toolName: tool.name,
                            toolCallID: call.id,
                            decision: "rejected",
                            reason: response.feedback,
                            agentID: agentID,
                        });
                        return [2 /*return*/, { reason: rejectedToolMessage(tool.name, response.feedback) }];
                    case 3:
                        error_1 = _g.sent();
                        aborted = ((_f = deps.abortSignal(turnID)) === null || _f === void 0 ? void 0 : _f.aborted) === true;
                        reason = aborted
                            ? "turn cancelled before an answer"
                            : "approval expired without an answer";
                        settleApproval(session, approvalID, reason, agentID);
                        if (aborted)
                            throw error_1;
                        deps.publishForSession(session, {
                            type: "policy.decision",
                            turnID: turnID,
                            toolName: tool.name,
                            toolCallID: call.id,
                            decision: "rejected",
                            reason: reason,
                            agentID: agentID,
                        });
                        return [2 /*return*/, { reason: expiredToolMessage(tool.name) }];
                    case 4:
                        pendingApprovalRequests.delete(approvalID);
                        approvalFamilyByID.delete(approvalID);
                        approvalWorkGraphContext.delete(approvalID);
                        approvalSessionByID.delete(approvalID);
                        return [7 /*endfinally*/];
                    case 5: return [2 /*return*/];
                }
            });
        });
    }
    function requireQuestion(requestID, turnID, request) {
        return __awaiter(this, void 0, void 0, function () {
            var session, agentID, answered, response;
            var _a, _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        session = deps.sessionIDForTurn(turnID);
                        agentID = (_a = deps.agentIDForTurn) === null || _a === void 0 ? void 0 : _a.call(deps, turnID);
                        questionTurnByID.set(requestID, turnID);
                        deps.publishForSession(session, __assign(__assign({ type: "question.request", id: requestID }, request), { agentID: agentID }));
                        answered = false;
                        _c.label = 1;
                    case 1:
                        _c.trys.push([1, , 3, 4]);
                        return [4 /*yield*/, waitForResponse(requestID, pendingQuestions, questionWaiters, deps.abortSignal(turnID), "question timed out", 
                            // ask_user has no timeout: it waits for the human until answered or
                            // cancelled. Cancel/abort still exits through the signal.
                            undefined)];
                    case 2:
                        response = _c.sent();
                        answered = true;
                        if (response.rejected)
                            throw new Error("user rejected question");
                        return [2 /*return*/, response.answers];
                    case 3:
                        if (!answered)
                            settleQuestion(session, requestID, ((_b = deps.abortSignal(turnID)) === null || _b === void 0 ? void 0 : _b.aborted) === true
                                ? "turn cancelled before an answer"
                                : "question wait ended without an answer", agentID);
                        questionTurnByID.delete(requestID);
                        return [7 /*endfinally*/];
                    case 4: return [2 /*return*/];
                }
            });
        });
    }
    /**
     * Issues a generic interactive request and waits for the human/UI response.
     * The runtime publishes an opaque `interactive.request`; `validate` is the
     * in-process business authority and runs after the answer arrives.
     */
    function requireInteractive(input) {
        return __awaiter(this, void 0, void 0, function () {
            var session, agentID, answered, response, errors;
            var _a, _b, _c;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        session = deps.sessionIDForTurn(input.turnID);
                        agentID = (_a = deps.agentIDForTurn) === null || _a === void 0 ? void 0 : _a.call(deps, input.turnID);
                        interactiveSessionByID.set(input.requestID, session);
                        deps.publishForSession(session, __assign(__assign(__assign(__assign({ type: "interactive.request", id: input.requestID, kind: input.kind, title: input.title, payload: input.payload }, (input.responseSchema ? { responseSchema: input.responseSchema } : {})), (input.expiresAt ? { expiresAt: input.expiresAt } : {})), (input.priority === undefined ? {} : { priority: input.priority })), { agentID: agentID }));
                        answered = false;
                        _d.label = 1;
                    case 1:
                        _d.trys.push([1, , 3, 4]);
                        return [4 /*yield*/, waitForResponse(input.requestID, pendingInteractives, interactiveWaiters, deps.abortSignal(input.turnID), "interactive request timed out", input.expiresAt === undefined
                                ? undefined
                                : Math.max(0, Date.parse(input.expiresAt) - Date.now()))];
                    case 2:
                        response = _d.sent();
                        answered = true;
                        if (response.rejected)
                            throw new Error("user rejected interactive request");
                        errors = (_b = input.validate) === null || _b === void 0 ? void 0 : _b.call(input, response.response);
                        if (errors && errors.length)
                            throw new Error("invalid interactive response: ".concat(errors.join("; ")));
                        return [2 /*return*/, { response: response.response, rejected: response.rejected }];
                    case 3:
                        if (!answered)
                            settleInteractive(session, input.requestID, input.kind, ((_c = deps.abortSignal(input.turnID)) === null || _c === void 0 ? void 0 : _c.aborted) === true
                                ? "turn cancelled before an answer"
                                : "interactive wait ended without an answer", agentID);
                        interactiveSessionByID.delete(input.requestID);
                        return [7 /*endfinally*/];
                    case 4: return [2 /*return*/];
                }
            });
        });
    }
    /**
     * Answers a generic interactive request. The runtime validates the envelope
     * (id/kind) only; business validation happened in the initiator's `validate`.
     */
    function respondInteractive(response) {
        var _a, _b, _c;
        var respondSession = (_b = (_a = interactiveSessionByID.get(response.requestID)) !== null && _a !== void 0 ? _a : response.sessionID) !== null && _b !== void 0 ? _b : deps.sessionID();
        if (!interactiveWaiters.has(response.requestID) &&
            !pendingInteractives.has(response.requestID) &&
            !deps.isPending(respondSession, response.requestID, response.kind)) {
            publish({
                type: "diagnostic",
                level: "warning",
                message: "ignored interactive response for a non-pending request",
            });
            return {
                accepted: false,
                reason: "the interactive request is no longer pending",
            };
        }
        deps.publishForSession(respondSession, __assign({ type: "interactive.response", id: response.requestID, kind: response.kind, response: response.response }, (response.rejected ? { rejected: true } : {})));
        pendingInteractives.set(response.requestID, response);
        (_c = interactiveWaiters.get(response.requestID)) === null || _c === void 0 ? void 0 : _c(response);
        return { accepted: true };
    }
    function settleInteractive(session, requestID, kind, reason, agentID) {
        if (!deps.isPending(session, requestID, kind))
            return;
        deps.publishForSession(session, __assign({ type: "interactive.response", id: requestID, kind: kind, response: null, rejected: true }, (agentID === undefined ? {} : { agentID: agentID })));
        publish({
            type: "diagnostic",
            level: "warning",
            message: "interactive ".concat(requestID, " closed without an answer: ").concat(reason),
        });
    }
    function restoreInteractiveState(events) {
        var pending = (0, session_1.projectInteractiveRequests)(events);
        restoreRecoveredInteractiveState(pending.approvals, pending.questions, pending.interactives);
    }
    function restoreRecoveredInteractiveState(approvals, questions, interactives) {
        if (interactives === void 0) { interactives = []; }
        for (var _i = 0, approvals_1 = approvals; _i < approvals_1.length; _i++) {
            var request = approvals_1[_i];
            pendingApprovalRequests.add(request.id);
            publish({
                type: "diagnostic",
                level: "warning",
                message: "Recovered unresolved approval record ".concat(request.id, "; active tool execution was not replayed and must be resubmitted after a response."),
            });
        }
        for (var _a = 0, questions_1 = questions; _a < questions_1.length; _a++) {
            var request = questions_1[_a];
            publish({
                type: "diagnostic",
                level: "warning",
                message: "Recovered unresolved question record ".concat(request.id, "; active tool execution was not replayed and must be resubmitted after an answer."),
            });
        }
        for (var _b = 0, interactives_1 = interactives; _b < interactives_1.length; _b++) {
            var request = interactives_1[_b];
            publish({
                type: "diagnostic",
                level: "warning",
                message: "Recovered unresolved interactive record ".concat(request.id, " (").concat(request.kind, "); active tool execution was not replayed and must be resubmitted after a response."),
            });
        }
    }
    /**
     * Answers an approval. Everything is published before the waiter is settled, so
     * a sink that replies synchronously cannot observe a half-resolved request.
     */
    function respondApproval(response) {
        var _a, _b, _c, _d, _e;
        var respondGraph = approvalWorkGraphContext.get(response.requestID);
        // Prefer the live waiter's own session. Only when the request has no live
        // waiter (recovered/stale) fall back to the client's routing hint, then to
        // the work-graph turn, then to the attached session.
        var respondSession = (_b = (_a = approvalSessionByID.get(response.requestID)) !== null && _a !== void 0 ? _a : response.sessionID) !== null && _b !== void 0 ? _b : (respondGraph
            ? deps.sessionIDForTurn(respondGraph.turnID)
            : deps.sessionID());
        if (!pendingApprovalRequests.has(response.requestID) &&
            !deps.isPending(respondSession, response.requestID, "approval")) {
            publish({
                type: "diagnostic",
                level: "warning",
                message: "ignored approval response for a non-pending request",
            });
            // The waiter already knew this; the caller did not. An external UI has to
            // learn that its answer arrived too late, because "the model was told this
            // call did not run" is a different fact from "your answer took effect".
            return {
                accepted: false,
                reason: "the approval request is no longer pending",
            };
        }
        var graphContext = approvalWorkGraphContext.get(response.requestID);
        var responseSession = respondSession;
        var agentID = graphContext
            ? (_c = deps.agentIDForTurn) === null || _c === void 0 ? void 0 : _c.call(deps, graphContext.turnID)
            : undefined;
        deps.publishForSession(responseSession, {
            type: "approval.response",
            id: response.requestID,
            decision: response.decision,
            feedback: response.feedback,
            agentID: agentID,
        });
        // A resolved approval is a Work Graph fact: who authorized a side effect.
        // The decision is recorded; the preview text is not, because it can carry a
        // command line.
        deps.publishForSession(responseSession, __assign(__assign({}, deps.workLedger().approvalNode({
            approvalID: response.requestID,
            decision: response.decision,
            toolName: graphContext === null || graphContext === void 0 ? void 0 : graphContext.toolName,
            sessionID: responseSession,
            turnID: graphContext === null || graphContext === void 0 ? void 0 : graphContext.turnID,
        })), { agentID: agentID }));
        if (graphContext)
            deps.publishForSession(responseSession, __assign(__assign({}, deps.workLedger().approvalEdge({
                approvalID: response.requestID,
                decision: response.decision,
                turnID: graphContext.turnID,
                callID: graphContext.callID,
            })), { agentID: agentID }));
        if (response.decision === "session") {
            var session = responseSession;
            var family = approvalFamilyByID.get(response.requestID);
            if (family) {
                var approved = (_d = sessionApprovedFamilies.get(session)) !== null && _d !== void 0 ? _d : new Set();
                approved.add(family.id);
                sessionApprovedFamilies.set(session, approved);
            }
        }
        pendingApprovals.set(response.requestID, response);
        pendingApprovalRequests.delete(response.requestID);
        approvalSessionByID.delete(response.requestID);
        (_e = approvalWaiters.get(response.requestID)) === null || _e === void 0 ? void 0 : _e(response);
        return { accepted: true };
    }
    function respondQuestion(response) {
        var _a, _b, _c, _d;
        var questionTurn = questionTurnByID.get(response.requestID);
        // Prefer the live waiter's own session; fall back to the client's routing
        // hint for recovered/stale requests, then to the attached session.
        var questionSession = (_b = (_a = (questionTurn ? deps.sessionIDForTurn(questionTurn) : undefined)) !== null && _a !== void 0 ? _a : response.sessionID) !== null && _b !== void 0 ? _b : deps.sessionID();
        if (!questionTurn &&
            !deps.isPending(questionSession, response.requestID, "question")) {
            publish({
                type: "diagnostic",
                level: "warning",
                message: "ignored question response for a non-pending request",
            });
            return {
                accepted: false,
                reason: "the question request is no longer pending",
            };
        }
        deps.publishForSession(questionSession, {
            type: "question.response",
            id: response.requestID,
            answers: response.answers,
            rejected: response.rejected,
            agentID: questionTurn ? (_c = deps.agentIDForTurn) === null || _c === void 0 ? void 0 : _c.call(deps, questionTurn) : undefined,
        });
        pendingQuestions.set(response.requestID, response);
        (_d = questionWaiters.get(response.requestID)) === null || _d === void 0 ? void 0 : _d(response);
        return { accepted: true };
    }
    /**
     * Closes a request that will never be answered (cancelled or expired) so the
     * durable journal stops reporting it as pending. Without this, a dismissed or
     * timed-out request re-appears on every session re-attach.
     */
    function settleApproval(session, approvalID, reason, agentID) {
        if (!deps.isPending(session, approvalID, "approval"))
            return;
        deps.publishForSession(session, __assign({ type: "approval.response", id: approvalID, decision: "reject", feedback: reason }, (agentID === undefined ? {} : { agentID: agentID })));
        publish({
            type: "diagnostic",
            level: "warning",
            message: "approval ".concat(approvalID, " closed without an answer: ").concat(reason),
        });
    }
    function settleQuestion(session, requestID, reason, agentID) {
        if (!deps.isPending(session, requestID, "question"))
            return;
        deps.publishForSession(session, __assign({ type: "question.response", id: requestID, answers: [], rejected: true }, (agentID === undefined ? {} : { agentID: agentID })));
        publish({
            type: "diagnostic",
            level: "warning",
            message: "question ".concat(requestID, " closed without an answer: ").concat(reason),
        });
    }
    /**
     * Drops the current session's interactive-terminal family grant. Someone revoking it expects the model's
     * next keystroke to ask again, so it takes effect now rather than on expiry.
     * Revocation is a UI action, so it targets the currently attached session.
     */
    function revokeTerminalApprovalScope(terminalID) {
        var _a;
        var scope = "terminal:".concat(terminalID, ":low-risk");
        var revoked = ((_a = sessionApprovedFamilies
            .get(deps.sessionID())) === null || _a === void 0 ? void 0 : _a.delete(contracts_1.PERMISSION_FAMILIES.interactiveTerminal.id)) === true;
        if (revoked)
            publish({
                type: "diagnostic",
                level: "info",
                message: "revoked terminal approval scope: ".concat(scope),
            });
        return { id: terminalID, scope: scope, revoked: revoked };
    }
    /** Whether anyone is still waiting on a human, which teardown has to know. */
    function hasPendingWaiters() {
        return (approvalWaiters.size > 0 ||
            questionWaiters.size > 0 ||
            interactiveWaiters.size > 0);
    }
    function requirePlanAcceptance(input) {
        return __awaiter(this, void 0, void 0, function () {
            var permissionMode, sessionID, family, error_2;
            var _a, _b, _c, _d, _e, _f, _g, _h;
            return __generator(this, function (_j) {
                switch (_j.label) {
                    case 0:
                        permissionMode = (_a = input.permissionMode) !== null && _a !== void 0 ? _a : deps.permissionMode();
                        sessionID = (_b = input.sessionID) !== null && _b !== void 0 ? _b : deps.sessionID();
                        family = (_c = input.permissionFamily) !== null && _c !== void 0 ? _c : contracts_1.PERMISSION_FAMILIES.planning;
                        if (permissionMode === "auto" && !input.requireExplicit)
                            return [2 /*return*/, { requestID: input.approvalID, decision: "once" }];
                        if (permissionMode === "read_only")
                            return [2 /*return*/, {
                                    requestID: input.approvalID,
                                    decision: "reject",
                                    feedback: "read_only",
                                }];
                        if (!input.requireExplicit &&
                            ((_d = sessionApprovedFamilies.get(sessionID)) === null || _d === void 0 ? void 0 : _d.has(family.id)))
                            return [2 /*return*/, { requestID: input.approvalID, decision: "session" }];
                        // Establish the pending record before publishing, so a synchronous
                        // `respondApproval` from an event sink is not mistaken for a response to a
                        // non-pending request (same rule as tool approvals, §waiter).
                        pendingApprovalRequests.add(input.approvalID);
                        approvalSessionByID.set(input.approvalID, sessionID);
                        approvalFamilyByID.set(input.approvalID, family);
                        deps.publishForSession(sessionID, __assign({ type: "approval.request", id: input.approvalID, title: input.title, preview: (_e = input.preview) !== null && _e !== void 0 ? _e : "Accept plan ".concat(input.planID), detail: input.detail, keyArguments: [input.planID], sensitive: false, scope: (_f = input.scope) !== null && _f !== void 0 ? _f : family.scope, permissionFamily: family }, (input.requireExplicit ? { allowSession: false } : {})));
                        _j.label = 1;
                    case 1:
                        _j.trys.push([1, 3, 4, 5]);
                        return [4 /*yield*/, waitForResponse(input.approvalID, pendingApprovals, approvalWaiters, input.signal, "plan acceptance timed out: ".concat(input.planID), 
                            // Plan acceptance waits for the human; cancel/abort still exits.
                            undefined)];
                    case 2: return [2 /*return*/, _j.sent()];
                    case 3:
                        error_2 = _j.sent();
                        settleApproval(sessionID, input.approvalID, ((_g = input.signal) === null || _g === void 0 ? void 0 : _g.aborted)
                            ? "turn cancelled before an answer"
                            : "plan acceptance ended without an answer");
                        if ((_h = input.signal) === null || _h === void 0 ? void 0 : _h.aborted)
                            throw error_2;
                        return [2 /*return*/, undefined];
                    case 4:
                        pendingApprovalRequests.delete(input.approvalID);
                        approvalSessionByID.delete(input.approvalID);
                        return [7 /*endfinally*/];
                    case 5: return [2 /*return*/];
                }
            });
        });
    }
    return {
        requireApproval: requireApproval,
        requireQuestion: requireQuestion,
        requireInteractive: requireInteractive,
        requirePlanAcceptance: requirePlanAcceptance,
        respondApproval: respondApproval,
        respondQuestion: respondQuestion,
        respondInteractive: respondInteractive,
        restoreInteractiveState: restoreInteractiveState,
        restoreRecoveredInteractiveState: restoreRecoveredInteractiveState,
        revokeTerminalApprovalScope: revokeTerminalApprovalScope,
        hasPendingWaiters: hasPendingWaiters,
    };
}
function waitForResponse(id, responses, waiters, signal, timeoutMessage, timeoutMs) {
    var existing = responses.get(id);
    if (existing) {
        responses.delete(id);
        return Promise.resolve(existing);
    }
    return new Promise(function (resolve, reject) {
        var _a;
        var timeout;
        var abort = function () {
            return finish(function () { var _a; return reject((_a = signal === null || signal === void 0 ? void 0 : signal.reason) !== null && _a !== void 0 ? _a : new Error("request cancelled")); });
        };
        var finish = function (settle) {
            if (timeout !== undefined)
                clearTimeout(timeout);
            waiters.delete(id);
            signal === null || signal === void 0 ? void 0 : signal.removeEventListener("abort", abort);
            settle();
        };
        // A timeout is optional: questions wait for a human until answered or
        // cancelled, while approvals/plan acceptance may carry their own expiry.
        if (timeoutMs !== undefined)
            timeout = setTimeout(function () { return finish(function () { return reject(new Error(timeoutMessage)); }); }, timeoutMs);
        waiters.set(id, function (response) {
            responses.delete(id);
            finish(function () { return resolve(response); });
        });
        signal === null || signal === void 0 ? void 0 : signal.addEventListener("abort", abort, { once: true });
        if (signal === null || signal === void 0 ? void 0 : signal.aborted) {
            abort();
            return;
        }
        var raced = responses.get(id);
        if (raced)
            (_a = waiters.get(id)) === null || _a === void 0 ? void 0 : _a(raced);
    });
}
function approvalPresentation(toolName, rawArguments) {
    var args;
    try {
        var parsed = (0, tools_1.parseToolArguments)(rawArguments);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed))
            args = parsed;
    }
    catch (_a) {
        // Keep malformed raw arguments only in the explicit detail pane.
    }
    var keyArguments = ["tool=".concat(toolName)];
    var terminalID = typeof (args === null || args === void 0 ? void 0 : args.id) === "string" ? args.id : undefined;
    if (terminalID && toolName.startsWith("interactive_terminal_"))
        keyArguments.push("terminal=".concat(terminalID));
    var path = typeof (args === null || args === void 0 ? void 0 : args.path) === "string" ? args.path : undefined;
    if (path)
        keyArguments.push("path=".concat(path));
    var sensitive = Object.keys(args !== null && args !== void 0 ? args : {}).some(function (key) {
        return /api[_-]?key|token|secret|password|authorization|cookie/iu.test(key);
    });
    var content = typeof (args === null || args === void 0 ? void 0 : args.content) === "string" ? args.content : undefined;
    var command = typeof (args === null || args === void 0 ? void 0 : args.command) === "string" ? args.command : undefined;
    var preview = toolName === "write_file" && path
        ? [
            "Write ".concat(path),
            content === undefined
                ? "Content: unavailable"
                : "Content: ".concat(Array.from(content).length, " chars").concat(content.trim() ? " \u00B7 ".concat(singleLine(content, 160)) : ""),
        ].join("\n")
        : command
            ? "Run command: ".concat(singleLine(command, 220))
            : path
                ? "".concat(toolName, ": ").concat(path)
                : "".concat(toolName, " requires approval");
    return { preview: preview, detail: rawArguments, keyArguments: keyArguments, sensitive: sensitive };
}
function singleLine(value, max) {
    var compact = value.replace(/\s+/gu, " ").trim();
    var chars = Array.from(compact);
    return chars.length > max ? "".concat(chars.slice(0, max).join(""), "...") : compact;
}
/**
 * The refusal a read-only session reports. Exported because the executor refuses
 * the same way before a call ever reaches an approval.
 */
/**
 * The refusal the model reads. The reason has to be actionable, because the
 * turn continues: repeating the same call would only be refused again.
 */
function rejectedToolMessage(toolName, feedback) {
    var reason = feedback === null || feedback === void 0 ? void 0 : feedback.trim();
    return reason
        ? "tool \"".concat(toolName, "\" was rejected by the user: ").concat(reason, ". Do not retry the same call; take this into account and continue.")
        : "tool \"".concat(toolName, "\" was rejected by the user without a reason. Do not retry the same call; consider a different approach or ask what to do instead.");
}
/**
 * An unanswered approval must never read as permission. The model is told the
 * call did not run so it can continue without it rather than assume success.
 */
function expiredToolMessage(toolName) {
    return "approval for tool \"".concat(toolName, "\" expired without an answer, so the call did not run. Do not assume it was allowed; continue without it or state what you need.");
}
