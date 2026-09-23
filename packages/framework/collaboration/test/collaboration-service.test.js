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
var bun_test_1 = require("bun:test");
var src_1 = require("../src");
var sessionID = "ses_collaboration_service";
function setup(maxAutoRounds) {
    if (maxAutoRounds === void 0) { maxAutoRounds = 3; }
    var events = [];
    var sequence = 0;
    var service = (0, src_1.createCollaborationService)({
        events: function (candidate) { return (candidate === sessionID ? events : undefined); },
        publish: function (_sessionID, event) { return events.push(event); },
        nextSequence: function () { return ++sequence; },
        maxAutoRounds: function () { return maxAutoRounds; },
        now: function () { return new Date("2026-08-25T00:00:00.000Z"); },
    });
    return { events: events, service: service };
}
(0, bun_test_1.test)("service sends every collaboration kind as collab.message", function () { return __awaiter(void 0, void 0, void 0, function () {
    var _a, events, service, question, suggestion;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _a = setup(), events = _a.events, service = _a.service;
                return [4 /*yield*/, service.send({
                        sessionID: sessionID,
                        kind: "question",
                        from: "main_agent",
                        text: "safe?",
                    })];
            case 1:
                question = _b.sent();
                return [4 /*yield*/, service.send({
                        sessionID: sessionID,
                        kind: "answer",
                        from: "live_chat",
                        replyToID: question.message.id,
                        text: "yes",
                    })];
            case 2:
                _b.sent();
                return [4 /*yield*/, service.send({
                        sessionID: sessionID,
                        kind: "suggestion",
                        from: "live_chat",
                        text: "use echo",
                        priority: "high",
                    })];
            case 3:
                suggestion = _b.sent();
                return [4 /*yield*/, service.send({
                        sessionID: sessionID,
                        kind: "response",
                        from: "main_agent",
                        replyToID: suggestion.message.id,
                        text: "adopted",
                        decision: "adopted",
                    })];
            case 4:
                _b.sent();
                return [4 /*yield*/, service.send({
                        sessionID: sessionID,
                        kind: "notice",
                        from: "main_agent",
                        text: "blocked",
                        noticeType: "blocked",
                    })];
            case 5:
                _b.sent();
                return [4 /*yield*/, service.send({
                        sessionID: sessionID,
                        kind: "chat",
                        from: "main_agent",
                        text: "hello",
                    })];
            case 6:
                _b.sent();
                (0, bun_test_1.expect)(events).toHaveLength(6);
                (0, bun_test_1.expect)(events.map(function (event) { return event.type; })).toEqual([
                    "natalia.collab.message", // question from main_agent
                    "navi.collab.message", // answer from live_chat
                    "navi.collab.message", // suggestion from live_chat
                    "natalia.collab.message", // response from main_agent
                    "natalia.collab.message", // notice from main_agent
                    "natalia.collab.message", // chat from main_agent
                ]);
                (0, bun_test_1.expect)(service.pendingFor(sessionID, "live_chat")).toHaveLength(1);
                (0, bun_test_1.expect)(service.pendingFor(sessionID, "main_agent")).toHaveLength(0);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("service namespaces Nia chat as nia.collab.message", function () { return __awaiter(void 0, void 0, void 0, function () {
    var _a, events, service;
    var _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                _a = setup(), events = _a.events, service = _a.service;
                return [4 /*yield*/, service.send({
                        sessionID: sessionID,
                        kind: "chat",
                        from: "nia",
                        text: "audit findings are ready",
                    })];
            case 1:
                _c.sent();
                (0, bun_test_1.expect)(events).toHaveLength(1);
                (0, bun_test_1.expect)((_b = events[0]) === null || _b === void 0 ? void 0 : _b.type).toBe("nia.collab.message");
                (0, bun_test_1.expect)(events[0]).toMatchObject({
                    message: {
                        from: "nia",
                        to: "main_agent",
                        text: "audit findings are ready",
                    },
                });
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("service rejects invalid, inexact, and duplicate replies", function () { return __awaiter(void 0, void 0, void 0, function () {
    var service, question, invalid;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                service = setup().service;
                return [4 /*yield*/, service.send({
                        sessionID: sessionID,
                        kind: "question",
                        from: "main_agent",
                        text: "safe?",
                    })];
            case 1:
                question = _a.sent();
                invalid = {
                    sessionID: sessionID,
                    kind: "answer",
                    from: "live_chat",
                    replyToID: question.message.id.slice(8),
                    text: "yes",
                };
                return [4 /*yield*/, (0, bun_test_1.expect)(service.send(invalid)).rejects.toThrow("no pending question")];
            case 2:
                _a.sent();
                return [4 /*yield*/, service.send(__assign(__assign({}, invalid), { replyToID: question.message.id }))];
            case 3:
                _a.sent();
                return [4 /*yield*/, (0, bun_test_1.expect)(service.send(__assign(__assign({}, invalid), { replyToID: question.message.id }))).rejects.toThrow("no pending question")];
            case 4:
                _a.sent();
                return [4 /*yield*/, (0, bun_test_1.expect)(service.send({
                        sessionID: sessionID,
                        kind: "chat",
                        from: "live_chat",
                        replyToID: question.message.id,
                        text: "wrong kind",
                    })).rejects.toThrow("no pending chat")];
            case 5:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("service closes chat at the automatic round limit", function () { return __awaiter(void 0, void 0, void 0, function () {
    var service, first, final;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                service = setup(1).service;
                return [4 /*yield*/, service.send({
                        sessionID: sessionID,
                        kind: "chat",
                        from: "main_agent",
                        text: "one check",
                    })];
            case 1:
                first = _a.sent();
                return [4 /*yield*/, service.send({
                        sessionID: sessionID,
                        kind: "chat",
                        from: "live_chat",
                        replyToID: first.message.id,
                        continueConversation: true,
                        text: "closed",
                    })];
            case 2:
                final = _a.sent();
                (0, bun_test_1.expect)(final.message).toMatchObject({
                    kind: "chat",
                    round: 1,
                    expectsReply: false,
                });
                (0, bun_test_1.expect)(final.wake).toEqual({
                    recipient: "main_agent",
                    messageID: final.message.id,
                    replyRequired: false,
                });
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("new chats reject continueConversation because they always request one reply", function () { return __awaiter(void 0, void 0, void 0, function () {
    var service, first;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                service = setup().service;
                return [4 /*yield*/, (0, bun_test_1.expect)(service.send({
                        sessionID: sessionID,
                        kind: "chat",
                        from: "live_chat",
                        text: "Are you free?",
                        continueConversation: false,
                    })).rejects.toThrow("continueConversation is only valid when replying with replyToID")];
            case 1:
                _a.sent();
                return [4 /*yield*/, service.send({
                        sessionID: sessionID,
                        kind: "chat",
                        from: "live_chat",
                        text: "Are you free?",
                    })];
            case 2:
                first = _a.sent();
                (0, bun_test_1.expect)(first.message).toMatchObject({
                    kind: "chat",
                    round: 1,
                    expectsReply: true,
                });
                return [2 /*return*/];
        }
    });
}); });
