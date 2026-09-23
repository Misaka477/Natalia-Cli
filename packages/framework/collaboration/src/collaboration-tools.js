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
exports.COLLAB_CHAT_RECIPIENTS = exports.COLLAB_RESPONSE_DECISIONS = void 0;
exports.collaborationTools = collaborationTools;
var session_1 = require("@anthelia/session");
var runtime_services_1 = require("@natalia/runtime-services");
exports.COLLAB_RESPONSE_DECISIONS = [
    "adopted",
    "rejected",
    "deferred",
];
exports.COLLAB_CHAT_RECIPIENTS = ["live_chat", "nia"];
var COLLAB_INBOX_PAGE_LIMIT = 8;
var COLLAB_INBOX_BYTE_BUDGET = 40 * 1024;
function collaborationTools(ports) {
    var sessionEvents = function (sessionID) {
        return sessionID ? ports.events(sessionID) : undefined;
    };
    var mailboxAcknowledge = (0, runtime_services_1.createMailboxAcknowledgeTool)({
        onAcknowledge: function (messageIDs, context) {
            return __awaiter(this, void 0, void 0, function () {
                var sessionID, events, at, _loop_1, _i, messageIDs_1, messageID;
                return __generator(this, function (_a) {
                    sessionID = context.sessionID;
                    events = sessionEvents(sessionID);
                    if (!sessionID || !events)
                        return [2 /*return*/];
                    at = new Date().toISOString();
                    _loop_1 = function (messageID) {
                        var message = (0, session_1.projectedMailboxMessages)(events).find(function (candidate) {
                            return candidate.messageID === messageID &&
                                candidate.status === "delivered";
                        });
                        if (!message)
                            return "continue";
                        ports.publish(sessionID, (0, runtime_services_1.buildMailboxStatus)({
                            id: "".concat(messageID, ":acknowledged:").concat(ports.nextMailboxSequence()),
                            messageID: messageID,
                            status: "acknowledged",
                            at: at,
                        }));
                    };
                    for (_i = 0, messageIDs_1 = messageIDs; _i < messageIDs_1.length; _i++) {
                        messageID = messageIDs_1[_i];
                        _loop_1(messageID);
                    }
                    return [2 /*return*/];
                });
            });
        },
    });
    var respond = {
        name: "collab_respond",
        description: "Respond to a suggestion from Navi, the Live Work Chat collaborator: adopt it, reject it, or defer it with a reason. The message id comes from the <navi_collaborations> context block.",
        requiresApproval: false,
        parameters: {
            type: "object",
            properties: {
                messageID: { type: "string" },
                decision: {
                    type: "string",
                    enum: __spreadArray([], exports.COLLAB_RESPONSE_DECISIONS, true),
                },
                reason: { type: "string" },
            },
            required: ["messageID", "decision"],
            additionalProperties: false,
        },
        execute: function (parsed, context) {
            return __awaiter(this, void 0, void 0, function () {
                var args, sessionID, result, error_1;
                var _a;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            args = parsed;
                            if (typeof args.messageID !== "string" ||
                                typeof args.decision !== "string")
                                return [2 /*return*/, "collab_respond requires messageID and decision; messageID comes from the <navi_collaborations> context block"];
                            sessionID = context.sessionID;
                            if (!sessionID || !sessionEvents(sessionID))
                                return [2 /*return*/, "no session"];
                            _b.label = 1;
                        case 1:
                            _b.trys.push([1, 3, , 4]);
                            return [4 /*yield*/, ports.service.send(__assign({ sessionID: sessionID, kind: "response", from: "main_agent", replyToID: args.messageID, decision: args.decision, text: ports.redact((_a = args.reason) !== null && _a !== void 0 ? _a : args.decision) }, (args.reason ? { reason: ports.redact(args.reason) } : {})))];
                        case 2:
                            result = _b.sent();
                            return [3 /*break*/, 4];
                        case 3:
                            error_1 = _b.sent();
                            return [2 /*return*/, "collab_respond: ".concat(error_1 instanceof Error ? error_1.message : String(error_1))];
                        case 4:
                            ports.requestWake(sessionID, {
                                recipient: result.wake.recipient,
                                messageID: result.message.id,
                                kind: "response",
                                source: "live_chat",
                            });
                            return [2 /*return*/, JSON.stringify({ responded: true })];
                    }
                });
            });
        },
    };
    var inbox = {
        name: "collab_inbox",
        description: "Read the collaboration channel with Navi: her answers, pending suggestions, and their outcomes. The response is a JSON page with messages, returned, total, truncated, and nextCursor. Pass nextCursor back to read older pages.",
        requiresApproval: false,
        parameters: {
            type: "object",
            properties: {
                cursor: {
                    type: "string",
                    description: "Opaque cursor from a previous collab_inbox response; returns older messages before it.",
                },
            },
            additionalProperties: false,
        },
        execute: function (parsed, context) {
            return __awaiter(this, void 0, void 0, function () {
                var events, args, messages, end, index, page, index, entry, candidate, start;
                return __generator(this, function (_a) {
                    events = sessionEvents(context.sessionID);
                    if (!events)
                        return [2 /*return*/, "[]"];
                    args = parsed;
                    messages = ports.service.list(context.sessionID);
                    end = messages.length;
                    if (typeof args.cursor === "string" && args.cursor) {
                        index = messages.findIndex(function (message) { return message.id === args.cursor; });
                        if (index < 0)
                            return [2 /*return*/, JSON.stringify({
                                    messages: [],
                                    returned: 0,
                                    total: messages.length,
                                    truncated: false,
                                    error: "cursor_not_found",
                                })];
                        end = index;
                    }
                    page = [];
                    for (index = end - 1; index >= 0 && page.length < COLLAB_INBOX_PAGE_LIMIT; index -= 1) {
                        entry = collabInboxMessage(messages[index]);
                        candidate = __spreadArray([entry], page, true);
                        if (page.length > 0 &&
                            utf8Bytes(JSON.stringify({ messages: candidate })) >
                                COLLAB_INBOX_BYTE_BUDGET)
                            break;
                        page.unshift(entry);
                    }
                    start = end - page.length;
                    return [2 /*return*/, JSON.stringify(__assign({ messages: page, returned: page.length, total: messages.length, truncated: start > 0 }, (start > 0 ? { nextCursor: messages[start].id } : {})))];
                });
            });
        },
    };
    var chat = createMainAgentChatTool(ports, sessionEvents);
    var ask = {
        name: "collab_ask",
        description: "Ask Navi, the Live Work Chat collaborator, for a second opinion on an approach, risk, or tradeoff. " +
            "Use proactively when you need expert technical advice on architecture, test strategy, implementation detail, " +
            "or a difficult decision — not only after an error.",
        requiresApproval: false,
        parameters: {
            type: "object",
            properties: { question: { type: "string" } },
            required: ["question"],
            additionalProperties: false,
        },
        execute: function (parsed, context) {
            return __awaiter(this, void 0, void 0, function () {
                var question, sessionID, result, error_2;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            question = parsed.question;
                            if (typeof question !== "string" || !question.trim())
                                return [2 /*return*/, "collab_ask requires a non-empty question"];
                            sessionID = context.sessionID;
                            if (!sessionID || !sessionEvents(sessionID))
                                return [2 /*return*/, "collab_ask: no active session; retry after the session is ready"];
                            _a.label = 1;
                        case 1:
                            _a.trys.push([1, 3, , 4]);
                            return [4 /*yield*/, ports.service.send({
                                    sessionID: sessionID,
                                    kind: "question",
                                    from: "main_agent",
                                    text: ports.redact(question),
                                })];
                        case 2:
                            result = _a.sent();
                            return [3 /*break*/, 4];
                        case 3:
                            error_2 = _a.sent();
                            return [2 /*return*/, "collab_ask: ".concat(error_2 instanceof Error ? error_2.message : String(error_2))];
                        case 4:
                            ports.requestWake(sessionID, {
                                recipient: result.wake.recipient,
                                messageID: result.message.id,
                                kind: "question",
                                source: "main_agent",
                            });
                            return [2 /*return*/, JSON.stringify({ asked: true })];
                    }
                });
            });
        },
    };
    return [mailboxAcknowledge, respond, inbox, chat, ask];
}
function createMainAgentChatTool(ports, sessionEvents) {
    return {
        name: "collab_chat",
        description: 'Send or directly reply to an informal message with Navi or Nia. A new message has no messageID and always continues the thread. To answer a REPLY_REQUIRED message, provide its exact messageID; having that messageID means that sister already replied to you. Every reply is sent as the next step of the thread unless the automatic exchange limit is reached. For a new message to Nia, set to to "nia"; otherwise it defaults to Navi. ',
        requiresApproval: false,
        parameters: {
            type: "object",
            properties: {
                text: { type: "string" },
                to: {
                    type: "string",
                    enum: __spreadArray([], exports.COLLAB_CHAT_RECIPIENTS, true),
                    description: "The sister to send a new informal chat to. Omitted means Navi (live_chat). When replying with messageID, the recipient is inferred from the original message.",
                },
                messageID: { type: "string" },
            },
            required: ["text"],
            additionalProperties: false,
        },
        execute: function (parsed, context) {
            return __awaiter(this, void 0, void 0, function () {
                var args, sessionID, events, suppliedID, wantsContinuation, messages, target, to, result, error_3;
                var _a, _b;
                return __generator(this, function (_c) {
                    switch (_c.label) {
                        case 0:
                            args = parsed;
                            if (typeof args.text !== "string" || !args.text.trim())
                                return [2 /*return*/, "collab_chat requires a non-empty text"];
                            sessionID = context.sessionID;
                            events = sessionEvents(sessionID);
                            if (!sessionID || !events)
                                return [2 /*return*/, "no session"];
                            suppliedID = (_a = args.messageID) === null || _a === void 0 ? void 0 : _a.trim();
                            wantsContinuation = Boolean(suppliedID);
                            messages = (0, session_1.projectedCollabMessages)(events);
                            target = suppliedID
                                ? messages.find(function (message) { return message.id === suppliedID; })
                                : undefined;
                            to = (_b = args.to) !== null && _b !== void 0 ? _b : (target
                                ? target.from === "main_agent"
                                    ? target.to
                                    : target.from
                                : "live_chat");
                            _c.label = 1;
                        case 1:
                            _c.trys.push([1, 3, , 4]);
                            return [4 /*yield*/, ports.service.send(__assign(__assign({ sessionID: sessionID, kind: "chat", from: "main_agent", to: to, text: ports.redact(args.text) }, (suppliedID ? { replyToID: suppliedID } : {})), (suppliedID ? { continueConversation: true } : {})))];
                        case 2:
                            result = _c.sent();
                            return [3 /*break*/, 4];
                        case 3:
                            error_3 = _c.sent();
                            return [2 /*return*/, "collab_chat: ".concat(error_3 instanceof Error ? error_3.message : String(error_3))];
                        case 4:
                            ports.requestWake(sessionID, {
                                recipient: result.wake.recipient,
                                messageID: result.message.id,
                                kind: "chat",
                                source: "main_agent",
                            });
                            return [2 /*return*/, JSON.stringify(__assign({ sent: true, messageID: result.message.id, threadID: result.message.threadID, to: result.message.to, round: result.message.kind === "chat" ? result.message.round : 1, expectsReply: result.message.expectsReply, receivedReply: Boolean(suppliedID) }, (wantsContinuation && !result.message.expectsReply
                                    ? {
                                        autoRoundLimitReached: true,
                                        maxAutoRounds: ports.maxAutoRounds(),
                                    }
                                    : {})))];
                    }
                });
            });
        },
    };
}
function collabInboxMessage(message) {
    return __assign(__assign(__assign(__assign(__assign({ id: message.id, kind: message.kind, from: message.from, to: message.to, text: message.text, status: message.status }, (message.questionID ? { questionID: message.questionID } : {})), (message.threadID ? { threadID: message.threadID } : {})), (message.replyToID ? { replyToID: message.replyToID } : {})), (message.kind === "chat" ? { round: message.round } : {})), (message.expectsReply !== undefined
        ? { expectsReply: message.expectsReply }
        : {}));
}
function utf8Bytes(value) {
    return new TextEncoder().encode(value).byteLength;
}
