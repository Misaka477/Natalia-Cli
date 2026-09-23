"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var bun_test_1 = require("bun:test");
var src_1 = require("../src");
(0, bun_test_1.test)("empty and wildcard filters match every runtime event type", function () {
    (0, bun_test_1.expect)((0, src_1.eventMatches)("session.created", undefined)).toBe(true);
    (0, bun_test_1.expect)((0, src_1.eventMatches)("turn.submitted", [])).toBe(true);
    (0, bun_test_1.expect)((0, src_1.eventMatches)("navi.chat.message.added", ["*"])).toBe(true);
    (0, bun_test_1.expect)((0, src_1.eventMatches)("checkpoint.created", ["runtime.*"])).toBe(true);
});
(0, bun_test_1.test)("turn, chat, and checkpoint prefixes match only their families", function () {
    (0, bun_test_1.expect)((0, src_1.eventMatches)("turn.submitted", ["runtime.turn.*"])).toBe(true);
    (0, bun_test_1.expect)((0, src_1.eventMatches)("turn.started", ["runtime.turn.*"])).toBe(true);
    (0, bun_test_1.expect)((0, src_1.eventMatches)("navi.chat.message.added", ["runtime.turn.*"])).toBe(false);
    (0, bun_test_1.expect)((0, src_1.eventMatches)("navi.chat.message.added", ["runtime.navi.chat.*"])).toBe(true);
    (0, bun_test_1.expect)((0, src_1.eventMatches)("nia.chat.turn.started", ["runtime.navi.chat.*"])).toBe(false);
    (0, bun_test_1.expect)((0, src_1.eventMatches)("nia.chat.turn.started", ["runtime.nia.chat.*"])).toBe(true);
    (0, bun_test_1.expect)((0, src_1.eventMatches)("turn.submitted", ["runtime.chat.*"])).toBe(false);
    (0, bun_test_1.expect)((0, src_1.eventMatches)("checkpoint.created", ["runtime.checkpoint.*"])).toBe(true);
    (0, bun_test_1.expect)((0, src_1.eventMatches)("checkpoint.failed", ["runtime.checkpoint.*"])).toBe(true);
    (0, bun_test_1.expect)((0, src_1.eventMatches)("session.created", ["runtime.checkpoint.*"])).toBe(false);
});
(0, bun_test_1.test)("exact event names match with or without the runtime prefix", function () {
    (0, bun_test_1.expect)((0, src_1.eventMatches)("session.created", ["session.created"])).toBe(true);
    (0, bun_test_1.expect)((0, src_1.eventMatches)("session.created", ["runtime.session.created"])).toBe(true);
    (0, bun_test_1.expect)((0, src_1.eventMatches)("turn.submitted", ["session.created"])).toBe(false);
});
(0, bun_test_1.test)("the event bus fans out only to matching subscribers", function () {
    var bus = (0, src_1.createUiEventBus)();
    var all = [];
    var turns = [];
    var offAll = bus.subscribe(function (event) { return all.push(event.type); });
    var offTurns = bus.subscribe(function (event) { return turns.push(event.type); }, ["runtime.turn.*"]);
    bus.emit({
        type: "session.created",
        sessionID: "ses_1",
        title: "Work",
    });
    bus.emit({
        type: "turn.submitted",
        id: "t1",
        text: "hi",
        byteLength: 2,
        lineCount: 1,
        sha256: "x",
    });
    offAll();
    offTurns();
    bus.emit({
        type: "turn.started",
        id: "t1",
    });
    (0, bun_test_1.expect)(all).toEqual(["session.created", "turn.submitted"]);
    (0, bun_test_1.expect)(turns).toEqual(["turn.submitted"]);
});
