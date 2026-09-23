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
exports.createSessionAdmission = createSessionAdmission;
/**
 * Input admission — runtime/session-admission.ts.
 *
 * `submitInput` admits a user turn to a session: it applies the team-mode
 * directive, stores attachments, publishes the durable `input.admitted` fact,
 * wakes and runs the session's drain, and records the work graph agent node.
 * `turn.submitted` is published later, when a turn actually starts. Reads host
 * state through `RuntimeContext` at call time.
 */
var session_1 = require("@anthelia/session");
var work_ledger_1 = require("@natalia/work-ledger");
var attachments_1 = require("@anthelia/attachments");
function createSessionAdmission(ctx, options) {
    return {
        submitInput: submitInput,
    };
    function submitInput(input, forSessionID) {
        return __awaiter(this, void 0, void 0, function () {
            var _a, getReady, isDisposed, getSessionID, ensureExecution, teamBehavior, publishForSession, getActiveExec, setLastSubmitted, rememberTitleInput, drainSessionFor, turnSession, attachmentService, workLedger, targetSessionID, targetExec, targetSession, text, activeTeamBehavior, message, attachments, _b, id, delivery, submitted, existing, admitted, targetCoordinator, injectable;
            var _c, _d, _e, _f, _g, _h, _j, _k;
            return __generator(this, function (_l) {
                switch (_l.label) {
                    case 0:
                        _a = ctx.ports, getReady = _a.getReady, isDisposed = _a.isDisposed, getSessionID = _a.getSessionID, ensureExecution = _a.ensureExecution, teamBehavior = _a.teamBehavior, publishForSession = _a.publishForSession, getActiveExec = _a.getActiveExec, setLastSubmitted = _a.setLastSubmitted, rememberTitleInput = _a.rememberTitleInput, drainSessionFor = _a.drainSessionFor;
                        turnSession = ctx.state.turnSession;
                        return [4 /*yield*/, getReady()];
                    case 1:
                        _l.sent();
                        if (isDisposed())
                            throw new Error("runtime disposed");
                        attachmentService = ctx.state.serviceDirectory.get(attachments_1.attachmentService);
                        workLedger = ctx.state.serviceDirectory.get(work_ledger_1.workLedgerController);
                        targetSessionID = ((_d = (_c = input.sessionID) !== null && _c !== void 0 ? _c : forSessionID) !== null && _d !== void 0 ? _d : getSessionID());
                        return [4 /*yield*/, ensureExecution(targetSessionID)];
                    case 2:
                        targetExec = _l.sent();
                        if (isDisposed())
                            throw new Error("runtime disposed");
                        targetSession = targetExec.session;
                        text = input.text;
                        activeTeamBehavior = teamBehavior();
                        if (activeTeamBehavior && text.trim().startsWith("/team")) {
                            message = text.trim().slice("/team".length).trim();
                            if (!message)
                                throw new Error("/team requires a message after it");
                            targetExec.context.add({
                                id: "team-mode:".concat(targetExec.context.journalStatus().journalOffset),
                                role: "system",
                                content: activeTeamBehavior.directive(),
                            });
                            text = message;
                        }
                        if (!((_e = input.attachments) === null || _e === void 0 ? void 0 : _e.length)) return [3 /*break*/, 4];
                        return [4 /*yield*/, attachmentService.store(input.attachments)];
                    case 3:
                        _b = _l.sent();
                        return [3 /*break*/, 5];
                    case 4:
                        _b = [];
                        _l.label = 5;
                    case 5:
                        attachments = _b;
                        if (isDisposed())
                            throw new Error("runtime disposed");
                        id = (_f = input.id) !== null && _f !== void 0 ? _f : "turn_".concat(crypto.randomUUID().replace(/-/gu, ""));
                        delivery = (_g = input.delivery) !== null && _g !== void 0 ? _g : "next-turn";
                        submitted = (0, session_1.buildSubmittedTurn)({
                            id: id,
                            text: text,
                            attachments: attachments,
                            resources: input.resources,
                            agents: input.agents,
                            internal: input.internal,
                        });
                        if (attachments.length)
                            targetExec === null || targetExec === void 0 ? void 0 : targetExec.attachmentReferences.set("".concat(id, ":user"), attachments);
                        if (!targetSession)
                            throw new Error("session initialization did not complete");
                        existing = (0, session_1.admittedInputs)(targetSession).find(function (item) { return item.id === id; });
                        admitted = (0, session_1.admitInput)(targetSession, {
                            id: id,
                            text: text,
                            delivery: delivery,
                            attachments: attachments,
                            resources: input.resources,
                            agents: input.agents,
                            internal: input.internal,
                        });
                        targetCoordinator = function () { return (0, session_1.sessionRunCoordinator)(targetSessionID); };
                        if (existing) {
                            if (!existing.promotedAt && delivery === "next-step")
                                void targetCoordinator().wake(drainSessionFor(targetSessionID));
                            return [2 /*return*/, submitted];
                        }
                        injectable = delivery === "next-step" &&
                            targetCoordinator().active &&
                            Boolean(targetExec === null || targetExec === void 0 ? void 0 : targetExec.activeTurnID);
                        targetExec.lastSubmitted = submitted;
                        if (targetExec === getActiveExec())
                            setLastSubmitted(submitted);
                        turnSession.set(id, targetSessionID);
                        // Admission is durable and observable whether the input will be injected
                        // or start its own turn; `turn.submitted` is published when a turn begins.
                        publishForSession(targetExec, (0, session_1.buildInputAdmission)({
                            id: id,
                            text: text,
                            attachments: attachments,
                            resources: input.resources,
                            agents: input.agents,
                            internal: input.internal,
                            delivery: delivery,
                            admittedAt: admitted.admittedAt,
                            admittedSeq: admitted.admittedSeq,
                        }));
                        // One Work Graph node per turn. An injected input never starts a turn, so
                        // it gets no node of its own.
                        if (!injectable)
                            publishForSession(targetExec, workLedger.agentActionNode({
                                turnID: id,
                                sessionID: targetSessionID,
                                agent: (_h = targetExec === null || targetExec === void 0 ? void 0 : targetExec.selectedAgent) === null || _h === void 0 ? void 0 : _h.name,
                            }));
                        if (!input.internal) {
                            rememberTitleInput(targetSessionID, text);
                            (_k = (_j = ctx.state.initialize) === null || _j === void 0 ? void 0 : _j.scheduleTitleGeneration) === null || _k === void 0 ? void 0 : _k.call(_j, targetSessionID);
                        }
                        void targetCoordinator().wake(drainSessionFor(targetSessionID));
                        return [2 /*return*/, submitted];
                }
            });
        });
    }
}
