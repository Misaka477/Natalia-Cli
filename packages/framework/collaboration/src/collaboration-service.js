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
exports.COLLABORATION_SERVICE = void 0;
exports.createCollaborationService = createCollaborationService;
var session_1 = require("@anthelia/session");
exports.COLLABORATION_SERVICE = "natalia.collaboration.service";
function createCollaborationService(ports) {
    var list = function (sessionID) { var _a; return (0, session_1.projectedCollabMessages)((_a = ports.events(sessionID)) !== null && _a !== void 0 ? _a : []); };
    return {
        list: list,
        pendingFor: function (sessionID, recipient) {
            return list(sessionID).filter(function (message) { return message.to === recipient && message.status === "pending"; });
        },
        send: function (input) {
            return __awaiter(this, void 0, void 0, function () {
                var messages, to, target, message;
                var _a;
                return __generator(this, function (_b) {
                    if (!input.text.trim())
                        throw new Error("collaboration text is required");
                    if (!ports.events(input.sessionID))
                        throw new Error("no session");
                    messages = list(input.sessionID);
                    to = (_a = input.to) !== null && _a !== void 0 ? _a : (input.from === "main_agent" ? "live_chat" : "main_agent");
                    target = "replyToID" in input
                        ? messages.find(function (message) { return message.id === input.replyToID; })
                        : undefined;
                    message = buildMessage(input, to, target, messages, ports);
                    ports.publish(input.sessionID, {
                        type: "".concat(collaborationStream(input.from), ".collab.message"),
                        message: message,
                    });
                    console.log("[collab-trace] send", {
                        from: input.from,
                        to: to,
                        kind: message.kind,
                        messageID: message.id,
                        threadID: message.threadID,
                        replyToID: message.replyToID,
                        expectsReply: message.expectsReply,
                        text: input.text.slice(0, 120),
                    });
                    return [2 /*return*/, {
                            message: message,
                            wake: {
                                recipient: to,
                                messageID: message.id,
                                replyRequired: message.expectsReply,
                            },
                        }];
                });
            });
        },
    };
}
function collaborationStream(from) {
    switch (from) {
        case "main_agent":
            return "natalia";
        case "live_chat":
            return "navi";
        case "nia":
            return "nia";
    }
}
function buildMessage(input, to, target, messages, ports) {
    var _a, _b, _c, _d;
    var now = (_b = (_a = ports.now) === null || _a === void 0 ? void 0 : _a.call(ports)) !== null && _b !== void 0 ? _b : new Date();
    var at = now.toISOString();
    var id = "collab:".concat(input.kind, ":").concat(now.getTime().toString(36), ":").concat(ports.nextSequence());
    if (input.kind === "chat") {
        var pendingIncoming = messages.find(function (message) {
            return message.kind === "chat" &&
                message.to === input.from &&
                message.status === "pending";
        });
        var pendingOutgoing = messages.find(function (message) {
            return message.kind === "chat" &&
                message.from === input.from &&
                message.status === "pending";
        });
        if (input.replyToID) {
            validateReply(target, input.from, "chat");
        }
        else if (input.continueConversation !== undefined) {
            throw new Error("continueConversation is only valid when replying with replyToID; a new chat always requests one reply");
        }
        else if (pendingIncoming) {
            throw new Error("reply required for chat message ".concat(pendingIncoming.id));
        }
        else if (pendingOutgoing) {
            throw new Error("awaiting reply to chat message ".concat(pendingOutgoing.id));
        }
        var chatTarget = (target === null || target === void 0 ? void 0 : target.kind) === "chat" ? target : undefined;
        var maxRounds = ports.maxAutoRounds();
        var mayContinue = chatTarget
            ? input.continueConversation === true && chatTarget.round < maxRounds
            : true;
        return __assign(__assign({ id: id, threadID: (_c = chatTarget === null || chatTarget === void 0 ? void 0 : chatTarget.threadID) !== null && _c !== void 0 ? _c : id }, (chatTarget ? { replyToID: chatTarget.id } : {})), { kind: "chat", from: input.from, to: to, text: input.text, round: chatTarget
                ? mayContinue
                    ? chatTarget.round + 1
                    : chatTarget.round
                : 1, expectsReply: mayContinue, at: at });
    }
    if (input.kind === "suggestion")
        return __assign(__assign({ id: id, threadID: id, kind: input.kind, from: input.from, to: to, text: input.text, expectsReply: true, priority: (_d = input.priority) !== null && _d !== void 0 ? _d : "normal" }, (input.rationale ? { rationale: input.rationale } : {})), { at: at });
    if (input.kind === "notice")
        return {
            id: id,
            threadID: id,
            kind: input.kind,
            from: input.from,
            to: to,
            text: input.text,
            expectsReply: false,
            noticeType: input.noticeType,
            at: at,
        };
    if (input.kind === "question")
        return {
            id: id,
            threadID: id,
            kind: input.kind,
            from: input.from,
            to: to,
            text: input.text,
            expectsReply: true,
            at: at,
        };
    validateReply(target, input.from, input.kind === "answer" ? "question" : "suggestion");
    if (input.kind === "answer")
        return {
            id: id,
            threadID: target.threadID,
            replyToID: target.id,
            kind: input.kind,
            from: input.from,
            to: to,
            text: input.text,
            expectsReply: false,
            at: at,
        };
    return __assign(__assign({ id: id, threadID: target.threadID, replyToID: target.id, kind: input.kind, from: input.from, to: to, text: input.text, expectsReply: false, decision: input.decision }, (input.reason ? { reason: input.reason } : {})), { at: at });
}
function validateReply(target, sender, expectedKind) {
    if (!target || target.kind !== expectedKind || target.status !== "pending")
        throw new Error("no pending ".concat(expectedKind, " message"));
    if (target.to !== sender || target.from === sender)
        throw new Error("collaboration reply direction is invalid");
}
