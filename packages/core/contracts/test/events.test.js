"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var bun_test_1 = require("bun:test");
var src_1 = require("../src");
(0, bun_test_1.test)("runtime event durability separates deltas from durable settlements", function () {
    (0, bun_test_1.expect)((0, src_1.runtimeEventDurability)({
        type: "content.delta",
        id: "turn",
        text: "partial",
    })).toBe("live");
    (0, bun_test_1.expect)((0, src_1.runtimeEventDurability)({
        type: "tool.update",
        id: "turn",
        name: "read",
        status: "running",
        summary: "reading",
    })).toBe("live");
    (0, bun_test_1.expect)((0, src_1.runtimeEventDurability)({
        type: "tool.update",
        id: "turn",
        name: "read",
        status: "succeeded",
        summary: "done",
    })).toBe("durable");
    (0, bun_test_1.expect)((0, src_1.runtimeEventDurability)({ type: "content.done", id: "turn" })).toBe("durable");
    (0, bun_test_1.expect)((0, src_1.runtimeEventDurability)({
        type: "approval.request",
        id: "approval",
        title: "Write",
        preview: "file",
    })).toBe("durable");
    (0, bun_test_1.expect)((0, src_1.runtimeEventDurability)({
        type: "navi.chat.turn.started",
        id: "chat:started",
        messageID: "chat:m1",
        startedAt: 1,
    })).toBe("live");
    (0, bun_test_1.expect)((0, src_1.runtimeEventDurability)({
        type: "nia.chat.thinking.done",
        id: "chat:thinking:done",
        messageID: "chat:m1",
        text: "durable reasoning",
    })).toBe("durable");
});
(0, bun_test_1.test)("collab.message carries the strict collaboration union", function () {
    var messages = [
        {
            id: "chat:1",
            threadID: "chat:1",
            kind: "chat",
            from: "main_agent",
            to: "live_chat",
            text: "hello",
            round: 1,
            expectsReply: true,
            at: "t0",
        },
        {
            id: "suggestion:1",
            threadID: "suggestion:1",
            kind: "suggestion",
            from: "live_chat",
            to: "main_agent",
            text: "use the service",
            priority: "high",
            expectsReply: true,
            at: "t0",
        },
        {
            id: "notice:1",
            threadID: "notice:1",
            kind: "notice",
            from: "main_agent",
            to: "live_chat",
            text: "blocked",
            noticeType: "blocked",
            expectsReply: false,
            at: "t0",
        },
        {
            id: "question:1",
            threadID: "question:1",
            kind: "question",
            from: "main_agent",
            to: "live_chat",
            text: "safe?",
            expectsReply: true,
            at: "t0",
        },
        {
            id: "answer:1",
            threadID: "question:1",
            replyToID: "question:1",
            kind: "answer",
            from: "live_chat",
            to: "main_agent",
            text: "yes",
            expectsReply: false,
            at: "t1",
        },
        {
            id: "response:1",
            threadID: "suggestion:1",
            replyToID: "suggestion:1",
            kind: "response",
            from: "main_agent",
            to: "live_chat",
            text: "adopted",
            decision: "adopted",
            expectsReply: false,
            at: "t1",
        },
    ];
    var events = messages.map(function (message) { return ({
        type: "collab.message",
        message: message,
    }); });
    (0, bun_test_1.expect)(events.map(function (event) { return event.type; })).toEqual(Array.from({ length: 6 }, function () { return "collab.message"; }));
});
(0, bun_test_1.test)("runtime event session sequence stays hidden transport metadata", function () {
    var event = {
        type: "content.done",
        id: "turn",
        text: "answer",
    };
    (0, src_1.markRuntimeEventSessionSeq)(event, 42);
    (0, bun_test_1.expect)((0, src_1.runtimeEventSessionSeq)(event)).toBe(42);
    (0, bun_test_1.expect)(Object.keys(event)).not.toContain("__nataliaSessionSeq");
    (0, bun_test_1.expect)(JSON.parse(JSON.stringify(event))).toEqual({
        type: "content.done",
        id: "turn",
        text: "answer",
    });
});
