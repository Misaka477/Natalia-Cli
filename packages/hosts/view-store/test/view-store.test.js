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
var bun_test_1 = require("bun:test");
var contracts_1 = require("@natalia/contracts");
var src_1 = require("../src");
// The whole point of this layer is that it projects an event stream with no
// runtime, no framework and no I/O. If any test here needed a client, the
// layer would not be consumable by an external UI.
/** What a UI would show: confirmed text plus the streaming tail. */
function text(state, id) {
    var block = state.messages.find(function (item) { return item.id === id; });
    return block ? (0, src_1.displayText)(block) : undefined;
}
function roles(state) {
    return state.messages.map(function (block) { return block.role; });
}
var submitted = function (id, body) { return ({
    type: "turn.submitted",
    id: id,
    text: body,
    byteLength: body.length,
    lineCount: 1,
    sha256: "x",
}); };
var admitted = function (id, body, delivery) { return ({
    type: "input.admitted",
    id: id,
    text: body,
    byteLength: body.length,
    lineCount: 1,
    sha256: "x",
    delivery: delivery,
    admittedAt: "2026-01-01T00:00:00.000Z",
    admittedSeq: 1,
}); };
function takeTurn(state, turnID) {
    (0, src_1.applyEvent)(state, { type: "turn.started", id: turnID });
}
(0, bun_test_1.test)("a whole turn projects to user text, assistant text and a stop reason", function () {
    var events = [
        { type: "session.created", sessionID: "ses_1", title: "Work" },
        { type: "session.ready", sessionID: "ses_1" },
        submitted("t1", "explain this"),
        { type: "content.delta", id: "t1", text: "Because " },
        { type: "content.delta", id: "t1", text: "of the cache." },
        { type: "content.done", id: "t1", text: "Because of the cache." },
        { type: "turn.finished", id: "t1", stopReason: "done" },
    ];
    var state = (0, src_1.projectEvents)(events);
    (0, bun_test_1.expect)(state.sessionID).toBe("ses_1");
    (0, bun_test_1.expect)(state.title).toBe("Work");
    (0, bun_test_1.expect)(state.status).toBe("ready");
    (0, bun_test_1.expect)(text(state, "t1:user")).toBe("explain this");
    (0, bun_test_1.expect)(text(state, (0, src_1.streamID)("t1", "assistant"))).toBe("Because of the cache.");
    (0, bun_test_1.expect)(roles(state)).toEqual(["user", "assistant"]);
    (0, bun_test_1.expect)(state.activeTurn).toBeUndefined();
    (0, bun_test_1.expect)(state.lastStopReason).toBe("done");
});
(0, bun_test_1.test)("a generated session title updates the active conversation", function () {
    var state = (0, src_1.projectEvents)([
        {
            type: "session.created",
            sessionID: "ses_1",
            title: "New session",
        },
        {
            type: "session.title.updated",
            sessionID: "ses_1",
            title: "Readable topic",
        },
    ]);
    (0, bun_test_1.expect)(state.title).toBe("Readable topic");
});
(0, bun_test_1.test)("collaboration chat renders both Natalia and Navi directions", function () {
    var state = (0, src_1.projectEvents)([
        {
            type: "collab.chat",
            id: "collab:chat:1",
            threadID: "collab:chat:1",
            from: "main_agent",
            to: "live_chat",
            text: "Check this edge case.",
            round: 1,
            expectsReply: true,
            at: "t0",
        },
        {
            type: "collab.chat",
            id: "collab:chat:2",
            threadID: "collab:chat:1",
            replyToID: "collab:chat:1",
            from: "live_chat",
            to: "main_agent",
            text: "It is covered.",
            round: 1,
            expectsReply: false,
            at: "t1",
        },
    ]);
    (0, bun_test_1.expect)(state.natalia.messages.map(function (message) { return (0, src_1.displayText)(message); })).toEqual(["Natalia → Navi: Check this edge case."]);
    (0, bun_test_1.expect)(state.navi.messages.map(function (message) { return (0, src_1.displayText)(message); })).toEqual([
        "Navi → Natalia: It is covered.",
    ]);
    (0, bun_test_1.expect)(state.natalia.messages.every(function (message) { return message.role === "system"; })).toBe(true);
    (0, bun_test_1.expect)(state.navi.messages.every(function (message) { return message.role === "system"; })).toBe(true);
});
(0, bun_test_1.test)("unified collaboration messages render as system rows", function () {
    var _a;
    var state = (0, src_1.projectEvents)([
        {
            type: "collab.message",
            message: {
                id: "collab:response:1",
                threadID: "collab:suggestion:1",
                replyToID: "collab:suggestion:1",
                kind: "response",
                from: "main_agent",
                to: "live_chat",
                text: "adopted",
                decision: "adopted",
                reason: "lower risk",
                expectsReply: false,
                at: "t1",
            },
        },
    ]);
    (0, bun_test_1.expect)((0, src_1.displayText)(state.natalia.messages[0])).toBe("Natalia adopted the suggestion (lower risk)");
    (0, bun_test_1.expect)((_a = state.natalia.messages[0]) === null || _a === void 0 ? void 0 : _a.role).toBe("system");
});
(0, bun_test_1.test)("collaboration routing is strictly by sender, not by recipient", function () {
    var state = (0, src_1.projectEvents)([
        {
            type: "collab.message",
            message: {
                id: "legacy:nia->natalia",
                threadID: "legacy:nia->natalia",
                kind: "chat",
                from: "nia",
                to: "main_agent",
                text: "legacy nia to natalia",
                round: 1,
                expectsReply: false,
                at: "t0",
            },
        },
        {
            type: "collab.message",
            message: {
                id: "legacy:natalia->nia",
                threadID: "legacy:natalia->nia",
                kind: "chat",
                from: "main_agent",
                to: "nia",
                text: "legacy natalia to nia",
                round: 1,
                expectsReply: false,
                at: "t1",
            },
        },
        {
            type: "collab.message",
            message: {
                id: "legacy:navi->natalia",
                threadID: "legacy:navi->natalia",
                kind: "chat",
                from: "live_chat",
                to: "main_agent",
                text: "legacy navi to natalia",
                round: 1,
                expectsReply: false,
                at: "t2",
            },
        },
        {
            type: "collab.message",
            message: {
                id: "legacy:natalia->navi",
                threadID: "legacy:natalia->navi",
                kind: "chat",
                from: "main_agent",
                to: "live_chat",
                text: "legacy natalia to navi",
                round: 1,
                expectsReply: false,
                at: "t3",
            },
        },
        {
            type: "collab.message",
            message: {
                id: "legacy:nia->navi",
                threadID: "legacy:nia->navi",
                kind: "chat",
                from: "nia",
                to: "live_chat",
                text: "legacy nia to navi",
                round: 1,
                expectsReply: false,
                at: "t4",
            },
        },
        {
            type: "collab.message",
            message: {
                id: "legacy:navi->nia",
                threadID: "legacy:navi->nia",
                kind: "chat",
                from: "live_chat",
                to: "nia",
                text: "legacy navi to nia",
                round: 1,
                expectsReply: false,
                at: "t5",
            },
        },
        {
            type: "nia.collab.message",
            message: {
                id: "new:nia->natalia",
                threadID: "new:nia->natalia",
                kind: "chat",
                from: "nia",
                to: "main_agent",
                text: "new nia to natalia",
                round: 1,
                expectsReply: false,
                at: "t6",
            },
        },
        {
            type: "natalia.collab.message",
            message: {
                id: "new:natalia->nia",
                threadID: "new:natalia->nia",
                kind: "chat",
                from: "main_agent",
                to: "nia",
                text: "new natalia to nia",
                round: 1,
                expectsReply: false,
                at: "t7",
            },
        },
        {
            type: "navi.collab.message",
            message: {
                id: "new:navi->natalia",
                threadID: "new:navi->natalia",
                kind: "chat",
                from: "live_chat",
                to: "main_agent",
                text: "new navi to natalia",
                round: 1,
                expectsReply: false,
                at: "t8",
            },
        },
        {
            type: "natalia.collab.message",
            message: {
                id: "new:natalia->navi",
                threadID: "new:natalia->navi",
                kind: "chat",
                from: "main_agent",
                to: "live_chat",
                text: "new natalia to navi",
                round: 1,
                expectsReply: false,
                at: "t9",
            },
        },
        {
            type: "nia.collab.message",
            message: {
                id: "new:nia->navi",
                threadID: "new:nia->navi",
                kind: "chat",
                from: "nia",
                to: "live_chat",
                text: "new nia to navi",
                round: 1,
                expectsReply: false,
                at: "t10",
            },
        },
        {
            type: "navi.collab.message",
            message: {
                id: "new:navi->nia",
                threadID: "new:navi->nia",
                kind: "chat",
                from: "live_chat",
                to: "nia",
                text: "new navi to nia",
                round: 1,
                expectsReply: false,
                at: "t11",
            },
        },
    ]);
    (0, bun_test_1.expect)(state.natalia.messages.map(function (block) { return (0, src_1.displayText)(block); })).toEqual([
        "Natalia → Nia: legacy natalia to nia",
        "Natalia → Navi: legacy natalia to navi",
        "Natalia → Nia: new natalia to nia",
        "Natalia → Navi: new natalia to navi",
    ]);
    (0, bun_test_1.expect)(state.navi.messages.map(function (block) { return (0, src_1.displayText)(block); })).toEqual([
        "Navi → Natalia: legacy navi to natalia",
        "Navi → Nia: legacy navi to nia",
        "Navi → Natalia: new navi to natalia",
        "Navi → Nia: new navi to nia",
    ]);
    (0, bun_test_1.expect)(state.nia.messages.map(function (block) { return (0, src_1.displayText)(block); })).toEqual([
        "Nia → Natalia: legacy nia to natalia",
        "Nia → Navi: legacy nia to navi",
        "Nia → Natalia: new nia to natalia",
        "Nia → Navi: new nia to navi",
    ]);
    (0, bun_test_1.expect)(state.natalia.messages.some(function (block) {
        return block.text.startsWith("Nia →") || block.text.startsWith("Navi →");
    })).toBe(false);
    (0, bun_test_1.expect)(state.navi.messages.some(function (block) {
        return block.text.startsWith("Nia →") || block.text.startsWith("Natalia →");
    })).toBe(false);
    (0, bun_test_1.expect)(state.nia.messages.some(function (block) {
        return block.text.startsWith("Navi →") || block.text.startsWith("Natalia →");
    })).toBe(false);
});
(0, bun_test_1.test)("tool results remain available on the generic transcript block", function () {
    var _a, _b;
    var result = JSON.stringify({
        saved: 1,
        items: [{ content: "ship todo projection", status: "in_progress" }],
    });
    var state = (0, src_1.projectEvents)([
        {
            type: "tool.update",
            id: "t1:call_todo",
            name: "todo_write",
            callID: "call_todo",
            status: "succeeded",
            summary: "saved 1 todo items",
            result: result,
            endedAt: 1,
        },
    ]);
    (0, bun_test_1.expect)(Object.values(state.tools)[0]).toMatchObject({
        name: "todo_write",
        status: "succeeded",
        result: result,
    });
    (0, bun_test_1.expect)((_b = (_a = state.messages.find(function (block) { return block.tool; })) === null || _a === void 0 ? void 0 : _a.tool) === null || _b === void 0 ? void 0 : _b.result).toBe(result);
});
(0, bun_test_1.test)("a queued input waits in the queue slice without replacing active work", function () {
    var _a;
    var state = (0, src_1.projectEvents)([
        submitted("t1", "first"),
        { type: "thinking.delta", id: "t1", text: "working" },
        admitted("t2", "next", "next-turn"),
    ]);
    (0, bun_test_1.expect)(state.pendingInputs).toEqual([
        bun_test_1.expect.objectContaining({
            id: "t2",
            text: "next",
            delivery: "next-turn",
            status: "queued",
        }),
    ]);
    // The queue is not part of the transcript until the turn actually starts.
    (0, bun_test_1.expect)(state.messages.some(function (block) { return block.id === "t2:user"; })).toBe(false);
    (0, bun_test_1.expect)(state.activeTurn).toBe("t1");
    (0, bun_test_1.expect)((0, src_1.selectPrimaryActivity)(state)).toMatchObject({
        turnID: "t1",
        kind: "thinking",
    });
    // When the turn starts it leaves the queue and becomes the turn's user row.
    (0, src_1.applyEvent)(state, submitted("t2", "next"));
    (0, bun_test_1.expect)(state.pendingInputs).toEqual([]);
    (0, bun_test_1.expect)((_a = state.messages.find(function (block) { return block.id === "t2:user"; })) === null || _a === void 0 ? void 0 : _a.text).toBe("next");
    takeTurn(state, "t2");
    (0, bun_test_1.expect)(state.activeTurn).toBe("t2");
});
(0, bun_test_1.test)("a claimed next-step leaves the queue and lands inside the running turn", function () {
    var state = (0, src_1.projectEvents)([
        submitted("t1", "first"),
        { type: "thinking.delta", id: "t1", text: "working" },
        admitted("in_1", "also do X", "next-step"),
        // A mid-turn claim publishes `turn.input` only; there is no `turn.submitted`
        // for an injected input, so it never becomes a phantom turn.
        {
            type: "turn.input",
            turnID: "t1",
            inputID: "in_1",
            text: "also do X",
            delivery: "next-step",
        },
    ]);
    (0, bun_test_1.expect)(state.pendingInputs).toEqual([]);
    (0, bun_test_1.expect)(state.activeTurn).toBe("t1");
    var ids = state.messages.map(function (block) { return block.id; });
    (0, bun_test_1.expect)(ids).toContain("t1:user");
    (0, bun_test_1.expect)(ids).toContain("t1:user:in_1");
    // The injected input belongs to t1: it is ordered after t1's own user row and
    // never starts a turn of its own.
    (0, bun_test_1.expect)(ids.indexOf("t1:user:in_1")).toBeGreaterThan(ids.indexOf("t1:user"));
    (0, bun_test_1.expect)(ids.some(function (id) { return id.startsWith("in_1:"); })).toBe(false);
    (0, bun_test_1.expect)(state.messages.find(function (block) { return block.id === "t1:user:in_1"; })).toMatchObject({
        role: "user",
        text: "also do X",
        pendingText: "",
        status: "steering",
    });
});
(0, bun_test_1.test)("admitting a submission does not mark a turn running before it starts", function () {
    var state = (0, src_1.projectEvents)([submitted("t1", "first")]);
    (0, bun_test_1.expect)(state.activeTurn).toBeUndefined();
    (0, src_1.applyEvent)(state, { type: "content.delta", id: "t1", text: "hi" });
    (0, bun_test_1.expect)(state.activeTurn).toBe("t1");
});
(0, bun_test_1.test)("an internal wake turn projects as system context, not user input", function () {
    var state = (0, src_1.projectEvents)([
        __assign(__assign({}, submitted("wake", "internal collaboration wake")), { internal: true }),
    ]);
    (0, bun_test_1.expect)(state.messages).toEqual([
        bun_test_1.expect.objectContaining({
            id: "wake:system",
            role: "system",
            text: "internal collaboration wake",
        }),
    ]);
    (0, bun_test_1.expect)(state.lastSubmission).toBeUndefined();
});
(0, bun_test_1.test)("removing a queued input clears it from the queue slice", function () {
    var state = (0, src_1.projectEvents)([
        admitted("t1", "next", "next-turn"),
        { type: "input.removed", id: "t1" },
    ]);
    (0, bun_test_1.expect)(state.pendingInputs).toEqual([]);
    (0, bun_test_1.expect)(state.messages.some(function (block) { return block.id === "t1:user"; })).toBe(false);
});
(0, bun_test_1.test)("editing and promoting a queued input update the queue slice in place", function () {
    var state = (0, src_1.projectEvents)([
        admitted("t1", "next", "next-turn"),
        {
            type: "input.updated",
            id: "t1",
            text: "edited",
            byteLength: 6,
            lineCount: 1,
            sha256: "y",
        },
        { type: "input.promoted", id: "t1" },
    ]);
    (0, bun_test_1.expect)(state.pendingInputs).toEqual([
        bun_test_1.expect.objectContaining({
            id: "t1",
            text: "edited",
            delivery: "next-step",
            status: "steering",
        }),
    ]);
});
(0, bun_test_1.test)("an internal wake admission stays out of the user-editable queue", function () {
    var state = (0, src_1.projectEvents)([
        __assign(__assign({}, admitted("wake", "internal", "next-turn")), { internal: true }),
    ]);
    (0, bun_test_1.expect)(state.pendingInputs).toEqual([]);
    (0, bun_test_1.expect)(state.messages.some(function (block) { return block.id === "wake:user"; })).toBe(false);
});
(0, bun_test_1.test)("admitting or editing a queued input never touches the transcript", function () {
    var state = (0, src_1.projectEvents)([submitted("t1", "first")]);
    var before = state.messages;
    (0, src_1.applyEvent)(state, admitted("t2", "queued later", "next-turn"));
    (0, src_1.applyEvent)(state, {
        type: "input.updated",
        id: "t2",
        text: "edited later",
        byteLength: 12,
        lineCount: 1,
        sha256: "z",
    });
    (0, bun_test_1.expect)(state.pendingInputs).toHaveLength(1);
    // The transcript array is untouched (same reference), so a queue edit cannot
    // invalidate transcript row identity.
    (0, bun_test_1.expect)(state.messages).toBe(before);
    (0, bun_test_1.expect)(state.messages.some(function (block) { return block.id.startsWith("t2"); })).toBe(false);
});
(0, bun_test_1.test)("content.done does not duplicate a response that already streamed", function () {
    var streamed = (0, src_1.projectEvents)([
        submitted("t1", "hi"),
        { type: "content.delta", id: "t1", text: "hello" },
        { type: "content.done", id: "t1", text: "hello" },
    ]);
    (0, bun_test_1.expect)(streamed.messages.filter(function (b) { return b.role === "assistant"; })).toHaveLength(1);
    // A provider that never streams still has to produce a visible block.
    var unstreamed = (0, src_1.projectEvents)([
        submitted("t2", "hi"),
        { type: "content.done", id: "t2", text: "hello" },
    ]);
    (0, bun_test_1.expect)(text(unstreamed, (0, src_1.streamID)("t2", "assistant"))).toBe("hello");
});
(0, bun_test_1.test)("durable replay after hydration is idempotent for turn rows", function () {
    var events = [
        submitted("t1", "hi"),
        { type: "thinking.done", id: "t1", text: "think" },
        { type: "content.done", id: "t1", text: "answer" },
        { type: "turn.finished", id: "t1", stopReason: "done" },
    ];
    var state = (0, src_1.projectEvents)(events);
    // Message-page hydration and durable SSE replay can both reach one
    // projection. Re-applying the same turn boundary must not append a second
    // row with the same id, because duplicate virtualizer keys render the whole
    // turn twice.
    for (var _i = 0, events_1 = events; _i < events_1.length; _i++) {
        var event_1 = events_1[_i];
        (0, src_1.applyEvent)(state, event_1);
    }
    var ids = state.messages.map(function (block) { return block.id; });
    (0, bun_test_1.expect)(new Set(ids).size).toBe(ids.length);
    (0, bun_test_1.expect)(state.messages.filter(function (block) { return block.role === "user"; })).toHaveLength(1);
    (0, bun_test_1.expect)(state.messages.filter(function (block) { return block.role === "thinking"; })).toHaveLength(1);
    (0, bun_test_1.expect)(state.messages.filter(function (block) { return block.role === "assistant"; })).toHaveLength(1);
});
(0, bun_test_1.test)("a retried attempt replaces the superseded text instead of appending", function () {
    var state = (0, src_1.projectEvents)([
        submitted("t1", "hi"),
        { type: "content.delta", id: "t1", text: "first try", attempt: 1 },
        { type: "content.delta", id: "t1", text: "second try", attempt: 2 },
        { type: "content.done", id: "t1", text: "second try" },
    ]);
    var assistant = state.messages.filter(function (b) { return b.role === "assistant"; });
    (0, bun_test_1.expect)(assistant).toHaveLength(1);
    (0, bun_test_1.expect)((0, src_1.displayText)(assistant[0])).toBe("second try");
});
(0, bun_test_1.test)("thinking and assistant phases do not interleave", function () {
    var state = (0, src_1.projectEvents)([
        submitted("t1", "hi"),
        { type: "thinking.delta", id: "t1", text: "considering" },
        { type: "content.delta", id: "t1", text: "answer" },
    ]);
    (0, bun_test_1.expect)(roles(state)).toEqual(["user", "thinking", "assistant"]);
    (0, bun_test_1.expect)(text(state, (0, src_1.streamID)("t1", "thinking"))).toBe("considering");
    (0, bun_test_1.expect)(text(state, (0, src_1.streamID)("t1", "assistant"))).toBe("answer");
});
(0, bun_test_1.test)("hidden reasoning is marked so a consumer can refuse to render it", function () {
    var _a;
    var state = (0, src_1.projectEvents)([
        submitted("t1", "hi"),
        { type: "thinking.delta", id: "t1", text: "private", visible: false },
    ]);
    (0, bun_test_1.expect)((_a = state.messages.find(function (b) { return b.role === "thinking"; })) === null || _a === void 0 ? void 0 : _a.reasoningVisible).toBe(false);
});
(0, bun_test_1.test)("model text after a tool call renders below the tool card", function () {
    var state = (0, src_1.projectEvents)([
        submitted("t1", "read it"),
        { type: "content.delta", id: "t1", text: "Reading now." },
        {
            type: "tool.update",
            id: "t1",
            name: "read_file",
            callID: "c1",
            status: "running",
            summary: "read_file src/index.ts",
        },
        { type: "content.delta", id: "t1", text: "It configures the server." },
    ]);
    (0, bun_test_1.expect)(roles(state)).toEqual(["user", "assistant", "tool", "assistant"]);
    (0, bun_test_1.expect)((0, src_1.displayText)(state.messages.at(-1))).toBe("It configures the server.");
});
(0, bun_test_1.test)("a tool card is updated in place across its lifecycle", function () {
    var _a;
    var events = [
        submitted("t1", "read it"),
        {
            type: "tool.update",
            id: "t1",
            name: "read_file",
            callID: "c1",
            status: "running",
            summary: "read_file src/index.ts",
            startedAt: 10,
        },
        {
            type: "tool.update",
            id: "t1",
            name: "read_file",
            callID: "c1",
            status: "succeeded",
            summary: "read 42 lines",
            result: "contents",
            endedAt: 20,
        },
    ];
    var state = (0, src_1.projectEvents)(events);
    (0, bun_test_1.expect)(state.messages.filter(function (b) { return b.role === "tool"; })).toHaveLength(1);
    var stateID = (0, src_1.toolStateID)({ id: "t1", name: "read_file", callID: "c1" });
    (0, bun_test_1.expect)(state.tools[stateID]).toMatchObject({
        status: "succeeded",
        summary: "read 42 lines",
        result: "contents",
        // The start time from the earlier event must survive the update.
        startedAt: 10,
        endedAt: 20,
    });
    (0, bun_test_1.expect)((_a = state.messages.find(function (b) { return b.id === stateID; })) === null || _a === void 0 ? void 0 : _a.status).toBe("succeeded");
});
(0, bun_test_1.test)("two calls to the same tool are separate cards", function () {
    var state = (0, src_1.projectEvents)([
        submitted("t1", "read both"),
        {
            type: "tool.update",
            id: "t1",
            name: "read_file",
            callID: "c1",
            status: "succeeded",
            summary: "a",
        },
        {
            type: "tool.update",
            id: "t1",
            name: "read_file",
            callID: "c2",
            status: "succeeded",
            summary: "b",
        },
    ]);
    (0, bun_test_1.expect)(state.messages.filter(function (b) { return b.role === "tool"; })).toHaveLength(2);
});
(0, bun_test_1.test)("pending approvals and questions appear and clear on response", function () {
    var state = (0, src_1.projectEvents)([
        submitted("t1", "write it"),
        {
            type: "approval.request",
            id: "a1",
            title: "Approve write_file",
            preview: "write config.json",
        },
        { type: "question.request", id: "q1", title: "Which target?" },
    ]);
    (0, bun_test_1.expect)(state.pendingApprovals.map(function (item) { return item.id; })).toEqual(["a1"]);
    (0, bun_test_1.expect)(state.pendingQuestions.map(function (item) { return item.id; })).toEqual(["q1"]);
    state = (0, src_1.reduceState)(state, {
        type: "approval.response",
        id: "a1",
        decision: "once",
    });
    state = (0, src_1.reduceState)(state, {
        type: "question.response",
        id: "q1",
        answers: [["staging"]],
    });
    (0, bun_test_1.expect)(state.pendingApprovals).toEqual([]);
    (0, bun_test_1.expect)(state.pendingQuestions).toEqual([]);
});
(0, bun_test_1.test)("activity facts follow a turn and prioritize user input", function () {
    var _a, _b;
    var state = (0, src_1.projectEvents)([
        submitted("t1", "update the config"),
        { type: "thinking.delta", id: "t1", text: "checking" },
        {
            type: "tool.update",
            id: "t1",
            name: "execute",
            callID: "c1",
            status: "running",
            summary: "npm test",
        },
    ]);
    (0, bun_test_1.expect)((0, src_1.selectPrimaryActivity)(state)).toMatchObject({
        id: "t1:tool:c1",
        kind: "command",
        state: "active",
        label: "execute",
        detail: "npm test",
    });
    state = (0, src_1.reduceState)(state, {
        type: "approval.request",
        id: "a1",
        title: "Approve command",
        preview: "npm test",
    });
    (0, bun_test_1.expect)((0, src_1.selectPrimaryActivity)(state)).toMatchObject({
        id: "approval:a1",
        kind: "waiting_for_user",
        state: "waiting",
    });
    state = (0, src_1.reduceState)(state, {
        type: "approval.response",
        id: "a1",
        decision: "once",
    });
    (0, bun_test_1.expect)((_a = (0, src_1.selectPrimaryActivity)(state)) === null || _a === void 0 ? void 0 : _a.kind).toBe("command");
    state = (0, src_1.reduceState)(state, {
        type: "tool.update",
        id: "t1",
        name: "execute",
        callID: "c1",
        status: "succeeded",
        summary: "tests passed",
    });
    (0, bun_test_1.expect)((_b = (0, src_1.selectPrimaryActivity)(state)) === null || _b === void 0 ? void 0 : _b.kind).toBe("thinking");
    state = (0, src_1.reduceState)(state, {
        type: "turn.finished",
        id: "t1",
        stopReason: "done",
    });
    (0, bun_test_1.expect)((0, src_1.selectPrimaryActivity)(state)).toBeUndefined();
});
(0, bun_test_1.test)("a plan document that reached a settled status is not live planning work", function () {
    var state = (0, src_1.projectEvents)([
        {
            type: "plan.doc.created",
            id: "plan:1:created",
            planID: "plan:1",
            title: "Scan remaining modules",
            documentPath: ".natalia/plans/scan.md",
            createdBy: "live_chat",
            status: "marked",
            createdAt: "now",
        },
    ]);
    (0, bun_test_1.expect)((0, src_1.selectPrimaryActivity)(state)).toMatchObject({
        kind: "planning",
        state: "active",
    });
    state = (0, src_1.reduceState)(state, {
        type: "plan.doc.status",
        id: "plan:1:status",
        planID: "plan:1",
        status: "audit_passed",
        at: "now",
    });
    (0, bun_test_1.expect)((0, src_1.selectPrimaryActivity)(state)).toBeUndefined();
});
(0, bun_test_1.test)("retry and compaction activities clear after their terminal events", function () {
    var state = (0, src_1.projectEvents)([
        submitted("t1", "continue"),
        {
            type: "step.retry",
            id: "t1",
            operation: "llm_step",
            step: 1,
            attempt: 1,
            maxAttempts: 3,
            waitMs: 1000,
            reason: "rate_limit",
        },
        {
            type: "compaction.begin",
            id: "c1",
            trigger: "ratio",
            beforeTokens: 100,
            maxTokens: 120,
            reservedTokens: 10,
            thresholdPercent: 80,
            attempt: 1,
            startedAt: "now",
        },
    ]);
    (0, bun_test_1.expect)((0, src_1.selectPrimaryActivity)(state)).toMatchObject({
        id: "retry:t1",
        kind: "retrying",
    });
    state = (0, src_1.reduceState)(state, {
        type: "thinking.delta",
        id: "t1",
        text: "retry recovered",
    });
    (0, bun_test_1.expect)(state.activities["retry:t1"]).toBeUndefined();
    state = (0, src_1.reduceState)(state, {
        type: "compaction.end",
        id: "c1",
        trigger: "ratio",
        success: true,
        beforeTokens: 100,
        afterTokens: 50,
        durationMs: 12,
        attempts: 1,
    });
    (0, bun_test_1.expect)(state.activities["compaction:c1"]).toBeUndefined();
    state = (0, src_1.reduceState)(state, {
        type: "step.retry.cleared",
        id: "t1",
        operation: "llm_step",
        step: 1,
        attempts: 1,
    });
    (0, bun_test_1.expect)(state.activities["retry:t1"]).toBeUndefined();
});
(0, bun_test_1.test)("streamed text is confirmed as markdown completes it, not only at the end", function () {
    // `text` is documented as the confirmed record and `pendingText` as the part
    // not confirmed yet. A consumer renders the first as markdown and the second as
    // provisional, so the boundary has to move while the answer streams.
    var state = (0, src_1.projectEvents)([
        submitted("t1", "explain"),
        { type: "content.delta", id: "t1", text: "First paragraph.\n\n" },
        { type: "content.delta", id: "t1", text: "second, still unfinished" },
    ]);
    var assistant = state.messages.find(function (block) { return block.role === "assistant"; });
    (0, bun_test_1.expect)(assistant === null || assistant === void 0 ? void 0 : assistant.text).toBe("First paragraph.\n\n");
    (0, bun_test_1.expect)(assistant === null || assistant === void 0 ? void 0 : assistant.pendingText).toBe("second, still unfinished");
    // Nothing is duplicated by confirming early.
    (0, bun_test_1.expect)((0, src_1.displayText)(assistant)).toBe("First paragraph.\n\nsecond, still unfinished");
});
(0, bun_test_1.test)("cancelling a turn keeps the answer already read and drops only the unfinished tail", function () {
    // Cancelling discards unconfirmed output, which is right — but with nothing
    // confirmed until the turn ended, the unconfirmed part was the entire response,
    // so a user who cancelled a long answer watched all of it disappear from the
    // transcript.
    var state = (0, src_1.projectEvents)([
        submitted("t1", "long job"),
        { type: "content.delta", id: "t1", text: "Para one.\n\nPara two.\n\n" },
        { type: "content.delta", id: "t1", text: "half a sen" },
        { type: "turn.cancelled", id: "t1", reason: "user cancelled" },
        { type: "turn.finished", id: "t1", stopReason: "cancelled" },
    ]);
    var assistant = state.messages.find(function (block) { return block.role === "assistant"; });
    (0, bun_test_1.expect)(assistant === null || assistant === void 0 ? void 0 : assistant.text).toBe("Para one.\n\nPara two.\n\n");
    // The half sentence is not kept as though the model had said it.
    (0, bun_test_1.expect)(assistant === null || assistant === void 0 ? void 0 : assistant.pendingText).toBe("");
    (0, bun_test_1.expect)((0, src_1.displayText)(assistant)).not.toContain("half a sen");
    (0, bun_test_1.expect)(state.status).toBe("ready");
});
(0, bun_test_1.test)("closing a segment confirms only what markdown had completed", function () {
    var _a, _b;
    // A segment closes at the boundary already confirmed, so the block left behind
    // holds exactly the confirmed record and the unfinished remainder moves on to
    // the next segment. Cutting the remainder instead would sweep unconfirmed text
    // into a block a consumer is told is safe to keep, and split it mid-word.
    var paragraph = "".concat("word ".repeat(1180), "\n\n");
    var unfinished = "x".repeat(200);
    var state = (0, src_1.projectEvents)([
        submitted("t1", "q"),
        { type: "content.delta", id: "t1", text: paragraph },
        { type: "content.delta", id: "t1", text: unfinished },
    ]);
    var assistant = state.messages.filter(function (block) { return block.role === "assistant"; });
    (0, bun_test_1.expect)(assistant).toHaveLength(1);
    (0, bun_test_1.expect)((_a = assistant[0]) === null || _a === void 0 ? void 0 : _a.text).toBe(paragraph);
    (0, bun_test_1.expect)((_b = assistant[0]) === null || _b === void 0 ? void 0 : _b.pendingText).toBe(unfinished);
    (0, bun_test_1.expect)((0, src_1.displayText)(assistant[0])).toBe(paragraph + unfinished);
});
(0, bun_test_1.test)("an announced retry whose resend is attempt-stamped keeps the whole answer", function () {
    // This is the shape the shipped fixture runtime emits, and what a provider is
    // allowed to emit: the retry is announced *and* the resent deltas carry the new
    // attempt number. Two supersede mechanisms then fired at once — the stamp
    // discarded the confirmed text while the overlap skip assumed it was still
    // there — so everything up to the point where the resend diverged was lost and
    // the reader saw the answer start mid-sentence.
    var state = (0, src_1.projectEvents)([
        submitted("t1", "q"),
        {
            type: "content.delta",
            id: "t1",
            attempt: 1,
            text: "# Retry demo\n\npartial duplicate",
        },
        {
            type: "step.retry",
            id: "t1",
            operation: "llm_step",
            step: 1,
            attempt: 2,
            maxAttempts: 3,
            waitMs: 10,
            reason: "timeout",
        },
        {
            type: "content.delta",
            id: "t1",
            attempt: 2,
            text: "# Retry demo\n\npartial duplicate",
        },
        {
            type: "content.delta",
            id: "t1",
            attempt: 2,
            text: " content committed once.\n",
        },
        { type: "content.done", id: "t1", attempt: 2 },
    ]);
    var assistant = state.messages.filter(function (block) { return block.role === "assistant"; });
    (0, bun_test_1.expect)(assistant).toHaveLength(1);
    (0, bun_test_1.expect)((0, src_1.displayText)(assistant[0])).toBe("# Retry demo\n\npartial duplicate content committed once.\n");
});
(0, bun_test_1.test)("an attempt stamp still supersedes a retry nobody announced", function () {
    // With no retry event, the stamp is the only signal that this attempt replaces
    // the last one, so it has to keep working.
    var state = (0, src_1.projectEvents)([
        submitted("t1", "q"),
        { type: "content.delta", id: "t1", text: "first try", attempt: 1 },
        { type: "content.delta", id: "t1", text: "second try", attempt: 2 },
    ]);
    var assistant = state.messages.filter(function (block) { return block.role === "assistant"; });
    (0, bun_test_1.expect)(assistant).toHaveLength(1);
    (0, bun_test_1.expect)((0, src_1.displayText)(assistant[0])).toBe("second try");
});
(0, bun_test_1.test)("an announced retry that continues with a stamped delta keeps the earlier text", function () {
    // The provider carries on instead of restarting, and stamps the continuation.
    // Discarding the confirmed text on the stamp would lose the beginning.
    var state = (0, src_1.projectEvents)([
        submitted("t1", "q"),
        { type: "content.delta", id: "t1", attempt: 1, text: "Hello.\n\n" },
        {
            type: "step.retry",
            id: "t1",
            operation: "llm_step",
            step: 1,
            attempt: 2,
            maxAttempts: 3,
            waitMs: 10,
            reason: "timeout",
        },
        { type: "content.delta", id: "t1", attempt: 2, text: "World." },
    ]);
    (0, bun_test_1.expect)((0, src_1.displayText)(state.messages.find(function (block) { return block.role === "assistant"; }))).toBe("Hello.\n\nWorld.");
});
(0, bun_test_1.test)("alternating reasoning and answering keeps the order the model produced", function () {
    // A model may think, answer, think again and answer again within one turn, with
    // no tool call in between to separate the blocks. Each phase used to keep
    // growing its single block, so the second thought merged into the first and the
    // first answer was rendered *above* the thought that came before the second
    // one — a transcript in an order the model never produced.
    var state = (0, src_1.projectEvents)([
        submitted("t1", "q"),
        { type: "thinking.delta", id: "t1", text: "first thought" },
        { type: "content.delta", id: "t1", text: "first answer" },
        { type: "thinking.delta", id: "t1", text: "second thought" },
        { type: "content.delta", id: "t1", text: "final answer" },
    ]);
    (0, bun_test_1.expect)(state.messages.map(function (block) { return [block.role, (0, src_1.displayText)(block)]; })).toEqual([
        ["user", "q"],
        ["thinking", "first thought"],
        ["assistant", "first answer"],
        ["thinking", "second thought"],
        ["assistant", "final answer"],
    ]);
});
(0, bun_test_1.test)("a tool event carrying the runtime's own id shape still belongs to its turn", function () {
    // The runtime publishes tool events as `${turnID}:${callID}`, with the call id
    // repeated in `callID`. Read literally, the card was filed under a turn that
    // does not exist: the text above the call was never committed, no new segment
    // opened, so the card sank below text that arrived after it and the text from
    // before and after the call merged into one block. Every real tool call took
    // this path — only fixtures that pass a bare turn id did not.
    var state = (0, src_1.projectEvents)([
        submitted("t1", "read it"),
        { type: "content.delta", id: "t1", text: "Reading now." },
        {
            type: "tool.update",
            id: "t1:call_1",
            name: "read_file",
            callID: "call_1",
            status: "succeeded",
            summary: "read 42 lines",
            result: "contents",
        },
        { type: "content.delta", id: "t1", text: "It configures the server." },
    ]);
    (0, bun_test_1.expect)(state.messages.map(function (block) { return block.id; })).toEqual([
        "t1:user",
        (0, src_1.streamID)("t1", "assistant"),
        "t1:tool:call_1",
        (0, src_1.segmentID)((0, src_1.streamID)("t1", "assistant"), 1),
    ]);
    (0, bun_test_1.expect)(Object.keys(state.tools)).toEqual(["t1:tool:call_1"]);
    (0, bun_test_1.expect)(text(state, (0, src_1.streamID)("t1", "assistant"))).toBe("Reading now.");
    (0, bun_test_1.expect)(text(state, (0, src_1.segmentID)((0, src_1.streamID)("t1", "assistant"), 1))).toBe("It configures the server.");
});
(0, bun_test_1.test)("a tool event whose id is already the turn id is left alone", function () {
    // Not every producer repeats the call id in the event id, so normalising must
    // only strip a suffix that is actually there.
    var state = (0, src_1.projectEvents)([
        submitted("t1", "read it"),
        {
            type: "tool.update",
            id: "t1",
            name: "read_file",
            callID: "call_1",
            status: "succeeded",
            summary: "read 42 lines",
        },
    ]);
    (0, bun_test_1.expect)(Object.keys(state.tools)).toEqual(["t1:tool:call_1"]);
});
(0, bun_test_1.test)("a settled turn releases its streaming buffers", function () {
    // A stream holds its turn's confirmed text, which the transcript already has.
    // Keeping it after the turn ends leaves a second copy of every response in the
    // projection, two entries per turn, that transcript eviction never reaches.
    var answered = (0, src_1.projectEvents)([
        submitted("t1", "hi"),
        { type: "thinking.delta", id: "t1", text: "considering" },
        { type: "content.delta", id: "t1", text: "the answer" },
        { type: "turn.finished", id: "t1", stopReason: "done" },
    ]);
    (0, bun_test_1.expect)(answered.streams).toEqual({});
    (0, bun_test_1.expect)(answered.streamPhases).toEqual({});
    // The text itself is kept where it belongs.
    (0, bun_test_1.expect)(text(answered, (0, src_1.streamID)("t1", "assistant"))).toBe("the answer");
    // A turn still running keeps its buffers, and a second turn does not disturb
    // the first one's release.
    var running = (0, src_1.projectEvents)([
        submitted("t1", "hi"),
        { type: "content.delta", id: "t1", text: "one" },
        { type: "turn.finished", id: "t1", stopReason: "done" },
        submitted("t2", "again"),
        { type: "content.delta", id: "t2", text: "two" },
    ]);
    (0, bun_test_1.expect)(Object.keys(running.streams).sort()).toEqual([
        (0, src_1.streamID)("t2", "assistant"),
        (0, src_1.streamID)("t2", "thinking"),
    ]);
});
(0, bun_test_1.test)("a cancelled or failed turn leaves no request nobody will answer", function () {
    var pending = [
        submitted("t1", "write it"),
        {
            type: "approval.request",
            id: "a1",
            title: "Approve write_file",
            preview: "write config.json",
        },
    ];
    var cancelled = (0, src_1.projectEvents)(__spreadArray(__spreadArray([], pending, true), [
        { type: "turn.cancelled", id: "t1", reason: "user cancelled" },
    ], false));
    (0, bun_test_1.expect)(cancelled.pendingApprovals).toEqual([]);
    (0, bun_test_1.expect)(cancelled.lastStopReason).toBe("cancelled");
    var failed = (0, src_1.projectEvents)(__spreadArray(__spreadArray([], pending, true), [
        { type: "turn.finished", id: "t1", stopReason: "error" },
    ], false));
    (0, bun_test_1.expect)(failed.pendingApprovals).toEqual([]);
    // A normal completion is the case where an approval could still be live, so
    // clearing must be tied to the abnormal stop reasons only.
    var done = (0, src_1.projectEvents)(__spreadArray(__spreadArray([], pending, true), [
        { type: "turn.finished", id: "t1", stopReason: "done" },
    ], false));
    (0, bun_test_1.expect)(done.pendingApprovals.map(function (item) { return item.id; })).toEqual(["a1"]);
});
(0, bun_test_1.test)("reduceState does not mutate the state it was given", function () {
    var before = (0, src_1.projectEvents)([submitted("t1", "hi")]);
    var snapshot = JSON.stringify(before);
    var after = (0, src_1.reduceState)(before, {
        type: "content.delta",
        id: "t1",
        text: "hello",
    });
    (0, bun_test_1.expect)(JSON.stringify(before)).toBe(snapshot);
    (0, bun_test_1.expect)(after).not.toBe(before);
    (0, bun_test_1.expect)(after.messages).not.toBe(before.messages);
});
(0, bun_test_1.test)("reduceState survives a state held behind a proxy", function () {
    // Cloning a reactive proxy with structuredClone is what broke the first
    // attempt at this layer, so the copy must not depend on it.
    var plain = (0, src_1.projectEvents)([submitted("t1", "hi")]);
    var proxied = new Proxy(plain, {
        get: function (target, key) { return target[key]; },
    });
    var next = (0, src_1.reduceState)(proxied, {
        type: "content.delta",
        id: "t1",
        text: "hello",
    });
    (0, bun_test_1.expect)(text(next, (0, src_1.streamID)("t1", "assistant"))).toBe("hello");
});
(0, bun_test_1.test)("hydrateProjectedMessages replace drops later transcript rows", function () {
    var state = (0, src_1.projectEvents)([
        submitted("t1", "one"),
        {
            type: "content.delta",
            id: (0, src_1.streamID)("t1", "assistant"),
            text: "a",
        },
        submitted("t2", "two"),
    ]);
    (0, bun_test_1.expect)(state.messages.length).toBeGreaterThan(1);
    (0, src_1.hydrateProjectedMessages)(state, [
        {
            id: "t1",
            turnID: "t1",
            submitted: submitted("t1", "one"),
            rows: [
                {
                    id: "t1:user",
                    turnID: "t1",
                    kind: "user",
                    event: submitted("t1", "one"),
                },
            ],
        },
    ], "older", { replace: true });
    (0, bun_test_1.expect)(state.messages.some(function (message) { return message.id.includes("t2"); })).toBe(false);
});
(0, bun_test_1.test)("hydrateProjectedMessages keeps every row in an oversized turn page", function () {
    var _a, _b;
    var state = (0, src_1.initialState)();
    var rows = Array.from({ length: 400 }, function (_, index) {
        return ({
            id: "t1:tool:".concat(index),
            turnID: "t1",
            kind: "tool",
            event: {
                type: "tool.update",
                id: "t1:tool:".concat(index),
                name: "read_file",
                callID: "call_".concat(index),
                status: "succeeded",
                summary: "ok",
                result: "ok",
            },
        });
    });
    (0, src_1.hydrateProjectedMessages)(state, [
        {
            id: "t1",
            turnID: "t1",
            submitted: submitted("t1", "one big turn"),
            rows: __spreadArray([], rows, true),
        },
    ], "newer");
    (0, bun_test_1.expect)(state.messages).toHaveLength(rows.length);
    (0, bun_test_1.expect)((_a = state.messages[0]) === null || _a === void 0 ? void 0 : _a.id).toContain("t1:tool:0");
    (0, bun_test_1.expect)((_b = state.messages.at(-1)) === null || _b === void 0 ? void 0 : _b.id).toContain("t1:tool:399");
});
(0, bun_test_1.test)("an unknown event is ignored rather than fatal", function () {
    var state = (0, src_1.initialState)();
    (0, bun_test_1.expect)(function () {
        return (0, src_1.applyEvent)(state, { type: "not.a.real.event" });
    }).not.toThrow();
    (0, bun_test_1.expect)(state).toEqual((0, src_1.initialState)());
});
(0, bun_test_1.test)("status snapshot and diagnostics project to the status surfaces", function () {
    var events = [
        {
            type: "status.snapshot",
            model: "m",
            provider: "p",
            context: "1/2",
            step: "3",
            permissions: "auto",
            cwd: "/work",
            background: "0",
        },
        { type: "diagnostic", level: "warning", message: "slow provider" },
    ];
    var state = (0, src_1.projectEvents)(events);
    (0, bun_test_1.expect)(state.statusSegments).toEqual([
        "mode:runtime",
        "model:m",
        "provider:p",
        "ctx:1/2",
        "step:3",
        "auto",
        "bg:0",
    ]);
    (0, bun_test_1.expect)(state.footer).toBe("warning: slow provider");
});
(0, bun_test_1.test)("a long response stays in one contiguous assistant block", function () {
    var chunk = "x".repeat(2500);
    var state = (0, src_1.projectEvents)([
        submitted("t1", "long"),
        { type: "content.delta", id: "t1", text: chunk },
        { type: "content.delta", id: "t1", text: chunk },
        { type: "content.delta", id: "t1", text: chunk },
        { type: "content.delta", id: "t1", text: chunk },
    ]);
    var assistant = state.messages.filter(function (b) { return b.role === "assistant"; });
    (0, bun_test_1.expect)(assistant).toHaveLength(1);
    (0, bun_test_1.expect)((0, src_1.displayText)(assistant[0])).toBe(chunk.repeat(4));
});
(0, bun_test_1.test)("provider-hidden reasoning is never retained anywhere in the projection", function () {
    var _a;
    // The consumer guide tells a UI to render `displayText(block)`. If the raw
    // reasoning were stored, following that advice would display exactly what the
    // provider forbade showing — so it must not be stored at all, in the block or
    // the stream.
    var secret = "SECRET-CHAIN-OF-THOUGHT";
    var events = [
        submitted("t1", "q"),
        { type: "thinking.delta", id: "t1", text: secret, visible: false },
        {
            type: "thinking.delta",
            id: "t1",
            text: "".concat(secret, "-more"),
            visible: false,
        },
        { type: "thinking.done", id: "t1" },
        { type: "content.delta", id: "t1", text: "answer" },
        { type: "content.done", id: "t1", text: "answer" },
        { type: "turn.finished", id: "t1", stopReason: "done" },
    ];
    var state = (0, src_1.projectEvents)(events);
    (0, bun_test_1.expect)(JSON.stringify(state)).not.toContain(secret);
    var thinking = state.messages.find(function (block) { return block.role === "thinking"; });
    // A consumer can still tell that thinking happened, and can hide the row.
    (0, bun_test_1.expect)(thinking === null || thinking === void 0 ? void 0 : thinking.reasoningVisible).toBe(false);
    (0, bun_test_1.expect)((0, src_1.displayText)(thinking)).toContain("hidden by provider policy");
    // Visible content is unaffected.
    (0, bun_test_1.expect)((_a = state.messages.find(function (block) { return block.role === "assistant"; })) === null || _a === void 0 ? void 0 : _a.text).toBe("answer");
});
(0, bun_test_1.test)("visible reasoning is still projected in full", function () {
    var state = (0, src_1.projectEvents)([
        submitted("t1", "q"),
        { type: "thinking.delta", id: "t1", text: "step one, " },
        { type: "thinking.delta", id: "t1", text: "step two" },
    ]);
    var thinking = state.messages.find(function (block) { return block.role === "thinking"; });
    (0, bun_test_1.expect)((0, src_1.displayText)(thinking)).toBe("step one, step two");
    (0, bun_test_1.expect)(thinking === null || thinking === void 0 ? void 0 : thinking.reasoningVisible).toBe(true);
});
(0, bun_test_1.test)("durable done-only reasoning is restored on session reload", function () {
    // `turn.submitted` creates an empty thinking stream. Durable replay has no
    // deltas, so the done event's full text still has to materialize the block.
    var state = (0, src_1.projectEvents)([
        submitted("t1", "q"),
        { type: "thinking.done", id: "t1", text: "restored reasoning" },
        { type: "content.done", id: "t1", text: "answer" },
        { type: "turn.finished", id: "t1", stopReason: "done" },
    ]);
    var thinking = state.messages.find(function (block) { return block.role === "thinking"; });
    (0, bun_test_1.expect)((0, src_1.displayText)(thinking)).toBe("restored reasoning");
    (0, bun_test_1.expect)(thinking === null || thinking === void 0 ? void 0 : thinking.reasoningVisible).toBe(true);
});
(0, bun_test_1.test)("a turn that mixes hidden and visible reasoning keeps them apart", function () {
    // Providers can change policy mid-turn. The hidden part must not leak because a
    // later chunk was allowed.
    var state = (0, src_1.projectEvents)([
        submitted("t1", "q"),
        { type: "thinking.delta", id: "t1", text: "HIDDEN-PART", visible: false },
        { type: "thinking.delta", id: "t1", text: "shown part" },
    ]);
    (0, bun_test_1.expect)(JSON.stringify(state)).not.toContain("HIDDEN-PART");
    // The allowed chunk still renders; it simply replaces the placeholder, because
    // there is no hidden text to interleave it with.
    var thinking = state.messages.find(function (block) { return block.role === "thinking"; });
    (0, bun_test_1.expect)((0, src_1.displayText)(thinking)).toBe("shown part");
});
(0, bun_test_1.test)("a retry that resends everything does not duplicate the response", function () {
    // A retrying provider restarts its stream. Without skipping the overlap the
    // user sees the answer twice.
    var state = (0, src_1.projectEvents)([
        submitted("t1", "q"),
        { type: "content.delta", id: "t1", text: "Hello" },
        {
            type: "step.retry",
            id: "t1",
            operation: "llm_step",
            step: 1,
            attempt: 2,
            maxAttempts: 3,
            waitMs: 10,
            reason: "timeout",
        },
        { type: "content.delta", id: "t1", text: "Hello world" },
        { type: "content.done", id: "t1", text: "Hello world" },
    ]);
    var assistant = state.messages.filter(function (block) { return block.role === "assistant"; });
    (0, bun_test_1.expect)(assistant).toHaveLength(1);
    (0, bun_test_1.expect)((0, src_1.displayText)(assistant[0])).toBe("Hello world");
});
(0, bun_test_1.test)("a retry that resends in different chunk boundaries still reads once", function () {
    // The resend is not guaranteed to arrive in the same chunks, so the overlap has
    // to be tracked across chunks rather than compared per chunk.
    var state = (0, src_1.projectEvents)([
        submitted("t1", "q"),
        { type: "content.delta", id: "t1", text: "Hello" },
        {
            type: "step.retry",
            id: "t1",
            operation: "llm_step",
            step: 1,
            attempt: 2,
            maxAttempts: 3,
            waitMs: 10,
            reason: "timeout",
        },
        { type: "content.delta", id: "t1", text: "Hel" },
        { type: "content.delta", id: "t1", text: "lo wor" },
        { type: "content.delta", id: "t1", text: "ld" },
        { type: "content.done", id: "t1", text: "Hello world" },
    ]);
    (0, bun_test_1.expect)((0, src_1.displayText)(state.messages.find(function (block) { return block.role === "assistant"; }))).toBe("Hello world");
});
(0, bun_test_1.test)("a retry keeps confirmed text and continues from it", function () {
    // Dropping confirmed text on retry would lose it whenever the provider carries
    // on from where it stopped instead of starting over.
    var state = (0, src_1.projectEvents)([
        submitted("t1", "q"),
        { type: "content.delta", id: "t1", text: "Hello.\n\n" },
        {
            type: "step.retry",
            id: "t1",
            operation: "llm_step",
            step: 1,
            attempt: 2,
            maxAttempts: 3,
            waitMs: 10,
            reason: "timeout",
        },
        { type: "content.delta", id: "t1", text: "World." },
        { type: "content.done", id: "t1", text: "Hello.\n\nWorld." },
    ]);
    (0, bun_test_1.expect)((0, src_1.displayText)(state.messages.find(function (block) { return block.role === "assistant"; }))).toBe("Hello.\n\nWorld.");
});
(0, bun_test_1.test)("a retry does not glue the failed attempt's unfinished fragment onto the answer", function () {
    // The attempt that failed left half a sentence in flight. The retry is a new
    // completion and generally words things differently, so that fragment belongs
    // to nothing: keeping it prefixes the new answer with the tail of the old one.
    // This is why the fragment is dropped while confirmed text is kept — the two
    // halves of a stream mean different things once an attempt has failed.
    var state = (0, src_1.projectEvents)([
        submitted("t1", "q"),
        { type: "content.delta", id: "t1", text: "failed transient tail" },
        {
            type: "step.retry",
            id: "t1",
            operation: "llm_step",
            step: 1,
            attempt: 2,
            maxAttempts: 3,
            waitMs: 10,
            reason: "timeout",
        },
        { type: "content.delta", id: "t1", text: "clean final" },
        { type: "content.done", id: "t1" },
    ]);
    (0, bun_test_1.expect)((0, src_1.displayText)(state.messages.find(function (block) { return block.role === "assistant"; }))).toBe("clean final");
});
(0, bun_test_1.test)("a retry also clears unconfirmed text so it cannot be shown twice", function () {
    var _a;
    var state = (0, src_1.projectEvents)([
        submitted("t1", "q"),
        { type: "content.delta", id: "t1", text: "Hello" },
        { type: "content.delta", id: "t1", text: " partial" },
        {
            type: "step.retry",
            id: "t1",
            operation: "llm_step",
            step: 1,
            attempt: 2,
            maxAttempts: 3,
            waitMs: 10,
            reason: "timeout",
        },
    ]);
    var assistant = state.messages.find(function (block) { return block.role === "assistant"; });
    // The banner is up and the unconfirmed tail is gone.
    (0, bun_test_1.expect)(assistant === null || assistant === void 0 ? void 0 : assistant.pendingText).toBe("");
    (0, bun_test_1.expect)((_a = state.retryBanner) === null || _a === void 0 ? void 0 : _a.kind).toBe("step_retry");
});
(0, bun_test_1.test)("a long response does not split a fenced code block across segments", function () {
    var _a;
    // Segmentation triggers exactly on long responses, which is when code blocks
    // appear. Cutting inside a fence leaves both segments with an unpaired fence and
    // a markdown renderer then swallows everything after it.
    var filler = "word ".repeat(1200);
    var body = "".concat(filler, "\n```ts\nconst a = 1;\n");
    var rest = "const b = 2;\n```\ndone\n";
    var state = (0, src_1.projectEvents)([
        submitted("t1", "q"),
        { type: "content.delta", id: "t1", text: body },
        { type: "content.delta", id: "t1", text: rest },
    ]);
    var assistant = state.messages.filter(function (block) { return block.role === "assistant"; });
    (0, bun_test_1.expect)(assistant).toHaveLength(1);
    var fences = ((_a = (0, src_1.displayText)(assistant[0]).match(/```/gu)) !== null && _a !== void 0 ? _a : []).length;
    (0, bun_test_1.expect)(fences % 2).toBe(0);
    (0, bun_test_1.expect)((0, src_1.displayText)(assistant[0])).toBe(body + rest);
});
(0, bun_test_1.test)("a fence still open at the threshold is not split", function () {
    var _a;
    // The dangerous case: the size threshold is crossed while a fenced block has not
    // closed yet. There is no safe boundary inside a fence, and a hard split here
    // would leave one segment with an unpaired fence.
    var open = "```ts\n".concat("const x = 1;\n".repeat(700));
    var state = (0, src_1.projectEvents)([
        submitted("t1", "q"),
        { type: "content.delta", id: "t1", text: open },
    ]);
    var assistant = state.messages.filter(function (block) { return block.role === "assistant"; });
    // Kept whole: a readable block beats an exactly sized one.
    (0, bun_test_1.expect)(assistant).toHaveLength(1);
    (0, bun_test_1.expect)((0, src_1.displayText)(assistant[0])).toBe(open);
    // Once the fence closes, later output stays in the same contiguous block.
    var closed = (0, src_1.projectEvents)([
        { type: "content.delta", id: "t1", text: "```\n" },
        { type: "content.delta", id: "t1", text: "after. ".repeat(1200) },
    ], state);
    var blocks = closed.messages.filter(function (block) { return block.role === "assistant"; });
    (0, bun_test_1.expect)(blocks).toHaveLength(1);
    (0, bun_test_1.expect)(((_a = (0, src_1.displayText)(blocks[0]).match(/```/gu)) !== null && _a !== void 0 ? _a : []).length % 2).toBe(0);
});
(0, bun_test_1.test)("plain long prose stays in one contiguous assistant block", function () {
    var prose = "sentence. ".repeat(2000);
    var state = (0, src_1.projectEvents)([
        submitted("t1", "q"),
        { type: "content.delta", id: "t1", text: prose },
    ]);
    var assistant = state.messages.filter(function (block) { return block.role === "assistant"; });
    (0, bun_test_1.expect)(assistant).toHaveLength(1);
    (0, bun_test_1.expect)((0, src_1.displayText)(assistant[0])).toBe(prose);
});
(0, bun_test_1.test)("chat tool calls render in event order with post-tool text below the card", function () {
    var _a;
    var state = (0, src_1.initialState)();
    (0, src_1.applyEvent)(state, {
        type: "navi.chat.message.new",
        id: "chat:1",
        messageID: "chat:m1",
        role: "user",
        text: "check the status",
        at: "now",
    });
    (0, src_1.applyEvent)(state, {
        type: "navi.chat.message.delta",
        id: "chat:2",
        messageID: "chat:m2",
        text: "I will look.",
    });
    (0, src_1.applyEvent)(state, {
        type: "navi.chat.tool.used",
        id: "chat:m2:tool:1",
        messageID: "chat:m2",
        toolName: "session_snapshot",
        status: "succeeded",
        summary: "snapshot read",
        result: '{"agentStatus":"idle"}',
        argumentsRaw: "{}",
        at: "now",
    });
    (0, src_1.applyEvent)(state, {
        type: "navi.chat.message.delta",
        id: "chat:3",
        messageID: "chat:m2",
        text: " the main agent is idle.",
    });
    (0, src_1.applyEvent)(state, {
        type: "navi.chat.message.added",
        id: "chat:4",
        messageID: "chat:m2",
        role: "chat",
        text: "I will look. the main agent is idle.",
        at: "now",
    });
    var blocks = state.navi.messages;
    var order = blocks.map(function (block) { return block.id; });
    // user -> pre-tool text -> tool card -> post-tool segment below the card.
    (0, bun_test_1.expect)(order).toEqual([
        "chat:chat:m1:user",
        "chat:chat:m2:assistant",
        "chat:chat:m2:tool:1:tool",
        "chat:chat:m2:assistant:segment:1",
    ]);
    var tool = blocks.find(function (block) { return block.id === "chat:chat:m2:tool:1:tool"; });
    (0, bun_test_1.expect)(tool === null || tool === void 0 ? void 0 : tool.role).toBe("tool");
    (0, bun_test_1.expect)((_a = tool === null || tool === void 0 ? void 0 : tool.tool) === null || _a === void 0 ? void 0 : _a.name).toBe("session_snapshot");
    var post = blocks.find(function (block) { return block.id === "chat:chat:m2:assistant:segment:1"; });
    (0, bun_test_1.expect)((0, src_1.displayText)(post)).toBe(" the main agent is idle.");
});
(0, bun_test_1.test)("chat attachments project into Navi and Nia rows and hydrate intact", function () {
    var _a, _b, _c;
    var attachment = {
        id: "att_image",
        path: ".natalia/attachments/att_image.png",
        filename: "image.png",
        mediaType: "image/png",
        byteLength: 24,
        sha256: "image-hash",
        width: 1,
        height: 1,
    };
    var state = (0, src_1.projectEvents)([
        {
            type: "navi.chat.message.new",
            id: "chat:navi:user",
            messageID: "chat:navi",
            role: "user",
            text: "see image",
            at: "t1",
            attachments: [attachment],
        },
        {
            type: "nia.chat.message.new",
            id: "chat:nia:user",
            messageID: "chat:nia",
            role: "user",
            text: "see image too",
            at: "t2",
            attachments: [attachment],
        },
    ]);
    (0, bun_test_1.expect)((_a = state.navi.messages[0]) === null || _a === void 0 ? void 0 : _a.attachments).toEqual([attachment]);
    (0, bun_test_1.expect)((_b = state.nia.messages[0]) === null || _b === void 0 ? void 0 : _b.attachments).toEqual([attachment]);
    var hydrated = (0, src_1.initialState)();
    (0, src_1.hydrateNaviMessages)(hydrated, [
        {
            messageID: "chat:hydrated",
            role: "user",
            text: "hydrated image",
            at: "t3",
            attachments: [attachment],
        },
    ]);
    (0, bun_test_1.expect)((_c = hydrated.navi.messages[0]) === null || _c === void 0 ? void 0 : _c.attachments).toEqual([attachment]);
});
(0, bun_test_1.test)("chat activity follows its own lifecycle without replacing main activity", function () {
    var _a;
    var state = (0, src_1.projectEvents)([
        submitted("t1", "main work"),
        { type: "turn.started", id: "t1" },
        {
            type: "navi.chat.turn.started",
            id: "chat:m1:started",
            messageID: "chat:m1",
            startedAt: 100,
        },
        {
            type: "navi.chat.turn.phase",
            id: "chat:m1:thinking",
            messageID: "chat:m1",
            phase: "thinking",
        },
    ]);
    (0, bun_test_1.expect)(state.navi.activity).toEqual({
        messageID: "chat:m1",
        phase: "thinking",
        startedAt: 100,
        toolName: undefined,
    });
    (0, bun_test_1.expect)((_a = (0, src_1.selectPrimaryActivity)(state)) === null || _a === void 0 ? void 0 : _a.turnID).toBe("t1");
    (0, src_1.applyEvent)(state, {
        type: "navi.chat.turn.finished",
        id: "chat:m1:finished",
        messageID: "chat:m1",
        stopReason: "done",
        startedAt: 100,
        endedAt: 200,
    });
    (0, bun_test_1.expect)(state.navi.activity).toBeUndefined();
});
(0, bun_test_1.test)("Nia has its own complete chat stream and never mixes into Navi", function () {
    var _a, _b;
    var state = (0, src_1.projectEvents)([
        {
            type: "navi.chat.turn.started",
            id: "chat:navi:started",
            messageID: "chat:navi",
            startedAt: 1,
        },
        {
            type: "navi.chat.message.new",
            id: "chat:navi:user",
            messageID: "chat:navi",
            role: "user",
            text: "Navi question",
            at: "t1",
        },
        {
            type: "navi.chat.message.added",
            id: "chat:navi:chat",
            messageID: "chat:navi",
            role: "chat",
            text: "Navi answer",
            at: "t2",
        },
        {
            type: "nia.chat.turn.started",
            id: "chat:nia:started",
            messageID: "chat:nia",
            startedAt: 3,
        },
        {
            type: "nia.chat.message.delta",
            id: "chat:nia:delta",
            messageID: "chat:nia",
            text: "Nia audit result ",
        },
        {
            type: "nia.chat.tool.used",
            id: "chat:nia:tool:1",
            messageID: "chat:nia",
            toolName: "read_file",
            status: "succeeded",
            summary: "read a file",
            result: "{}",
            argumentsRaw: "{}",
            at: "t3",
        },
        {
            type: "collab.chat",
            id: "collab:nia:1",
            threadID: "collab:nia:1",
            from: "nia",
            to: "main_agent",
            text: "audit findings sent",
            round: 1,
            expectsReply: false,
            at: "t4",
        },
        {
            type: "nia.chat.message.added",
            id: "chat:nia:chat",
            messageID: "chat:nia",
            role: "chat",
            text: "Nia audit result",
            at: "t5",
        },
    ]);
    (0, bun_test_1.expect)(state.navi.messages.map(function (block) { return (0, src_1.displayText)(block); })).toEqual([
        "Navi question",
        "Navi answer",
    ]);
    (0, bun_test_1.expect)(state.nia.messages.map(function (block) { return (0, src_1.displayText)(block); })).toEqual([
        "Nia audit result ",
        "read a file",
        "Nia → Natalia: audit findings sent",
        "Nia audit result",
    ]);
    (0, bun_test_1.expect)((_a = state.navi.activity) === null || _a === void 0 ? void 0 : _a.messageID).toBe("chat:navi");
    (0, bun_test_1.expect)((_b = state.nia.activity) === null || _b === void 0 ? void 0 : _b.messageID).toBe("chat:nia");
    (0, bun_test_1.expect)(state.nia.messages.some(function (block) { return block.id.includes("chat:navi"); })).toBe(false);
    (0, bun_test_1.expect)(state.navi.messages.some(function (block) { return block.id.includes("chat:nia"); })).toBe(false);
});
(0, bun_test_1.test)("chat namespace prefixes isolate simultaneous identical message IDs", function () {
    var state = (0, src_1.projectEvents)([
        {
            type: "navi.chat.message.new",
            id: "navi:shared:user",
            messageID: "shared",
            role: "user",
            text: "Navi request",
            at: "t1",
        },
        {
            type: "nia.chat.message.new",
            id: "nia:shared:user",
            messageID: "shared",
            role: "user",
            text: "Nia request",
            at: "t2",
        },
        {
            type: "navi.chat.thinking.delta",
            id: "navi:shared:thinking",
            messageID: "shared",
            text: "Navi reasoning",
        },
        {
            type: "nia.chat.thinking.delta",
            id: "nia:shared:thinking",
            messageID: "shared",
            text: "Nia reasoning",
        },
    ]);
    (0, bun_test_1.expect)(state.navi.messages.map(function (block) { return (0, src_1.displayText)(block); })).toEqual([
        "Navi request",
        "Navi reasoning",
    ]);
    (0, bun_test_1.expect)(state.nia.messages.map(function (block) { return (0, src_1.displayText)(block); })).toEqual([
        "Nia request",
        "Nia reasoning",
    ]);
});
(0, bun_test_1.test)("durable chat thinking replaces live deltas and restores thinking after restart", function () {
    var _a, _b, _c, _d;
    var state = (0, src_1.initialState)();
    (0, src_1.applyEvent)(state, {
        type: "navi.chat.thinking.delta",
        id: "navi:shared:thinking:delta",
        messageID: "shared",
        text: "partial ",
    });
    (0, src_1.applyEvent)(state, {
        type: "navi.chat.thinking.done",
        id: "navi:shared:thinking:done",
        messageID: "shared",
        text: "complete Navi reasoning",
    });
    (0, src_1.applyEvent)(state, {
        type: "nia.chat.thinking.done",
        id: "nia:shared:thinking:done",
        messageID: "shared",
        text: "complete Nia reasoning",
    });
    (0, bun_test_1.expect)(state.navi.messages.map(src_1.displayText)).toEqual([
        "complete Navi reasoning",
    ]);
    (0, bun_test_1.expect)(state.nia.messages.map(src_1.displayText)).toEqual([
        "complete Nia reasoning",
    ]);
    (0, bun_test_1.expect)((_a = state.navi.messages[0]) === null || _a === void 0 ? void 0 : _a.status).toBe("completed");
    (0, bun_test_1.expect)((_b = state.nia.messages[0]) === null || _b === void 0 ? void 0 : _b.status).toBe("completed");
    var reloaded = (0, src_1.initialState)();
    var changed = (0, src_1.hydrateNaviMessages)(reloaded, [
        {
            messageID: "shared",
            role: "chat",
            text: "complete Navi reasoning",
            at: "",
            kind: "thinking",
        },
    ]);
    (0, src_1.hydrateNiaMessages)(reloaded, [
        {
            messageID: "shared",
            role: "chat",
            text: "complete Nia reasoning",
            at: "",
            kind: "thinking",
        },
    ]);
    (0, bun_test_1.expect)(changed).toBe(true);
    (0, bun_test_1.expect)(reloaded.navi.messages.map(src_1.displayText)).toEqual([
        "complete Navi reasoning",
    ]);
    (0, bun_test_1.expect)(reloaded.nia.messages.map(src_1.displayText)).toEqual([
        "complete Nia reasoning",
    ]);
    (0, bun_test_1.expect)((_c = reloaded.navi.messages[0]) === null || _c === void 0 ? void 0 : _c.role).toBe("thinking");
    (0, bun_test_1.expect)((_d = reloaded.nia.messages[0]) === null || _d === void 0 ? void 0 : _d.role).toBe("thinking");
});
(0, bun_test_1.test)("chat namespace prefixes override stale channel payloads", function () {
    var state = (0, src_1.projectEvents)([
        {
            type: "navi.chat.message.new",
            id: "navi:stale-channel",
            messageID: "shared",
            role: "user",
            text: "Navi request",
            at: "t1",
            channel: "nia",
        },
        {
            type: "nia.chat.message.new",
            id: "nia:stale-channel",
            messageID: "shared",
            role: "user",
            text: "Nia request",
            at: "t2",
            channel: "navi",
        },
    ]);
    (0, bun_test_1.expect)(state.navi.messages.map(function (block) { return (0, src_1.displayText)(block); })).toEqual([
        "Navi request",
    ]);
    (0, bun_test_1.expect)(state.nia.messages.map(function (block) { return (0, src_1.displayText)(block); })).toEqual([
        "Nia request",
    ]);
});
(0, bun_test_1.test)("hydrating chat rows splits Navi and Nia into independent streams", function () {
    var state = (0, src_1.initialState)();
    var changed = (0, src_1.hydrateNaviMessages)(state, [
        {
            messageID: "chat:navi",
            role: "user",
            text: "hi navi",
            at: "t1",
        },
    ]);
    (0, src_1.hydrateNiaMessages)(state, [
        {
            messageID: "chat:nia",
            role: "chat",
            text: "audit result",
            at: "t2",
        },
    ]);
    (0, bun_test_1.expect)(changed).toBe(true);
    (0, bun_test_1.expect)(state.navi.messages.map(function (block) { return block.text; })).toEqual(["hi navi"]);
    (0, bun_test_1.expect)(state.nia.messages.map(function (block) { return block.text; })).toEqual([
        "audit result",
    ]);
});
(0, bun_test_1.test)("paged chat hydration prepends older and appends newer in order", function () {
    var state = (0, src_1.initialState)();
    (0, src_1.hydrateNaviMessages)(state, [
        {
            messageID: "page:new",
            role: "chat",
            text: "new",
            at: "t2",
        },
    ], { replace: true });
    (0, src_1.hydrateNaviMessages)(state, [
        {
            messageID: "page:old",
            role: "chat",
            text: "old",
            at: "t1",
        },
    ], { direction: "older" });
    (0, src_1.hydrateNaviMessages)(state, [
        {
            messageID: "page:newest",
            role: "chat",
            text: "newest",
            at: "t3",
        },
    ], { direction: "newer" });
    (0, bun_test_1.expect)(state.navi.messages.map(function (block) { return block.text; })).toEqual([
        "old",
        "new",
        "newest",
    ]);
});
(0, bun_test_1.test)("events from another session do not mix into the current transcript", function () {
    var state = (0, src_1.initialState)();
    (0, src_1.applyEvent)(state, {
        type: "session.created",
        sessionID: "ses_a",
        title: "A",
    });
    (0, src_1.applyEvent)(state, submitted("t_a", "from a"));
    (0, src_1.applyEvent)(state, __assign(__assign({}, submitted("t_b", "from b")), { sessionID: "ses_b" }));
    (0, src_1.applyEvent)(state, {
        type: "session.ready",
        sessionID: "ses_b",
    });
    (0, bun_test_1.expect)(state.sessionID).toBe("ses_a");
    (0, bun_test_1.expect)(state.messages.map(function (block) { return block.text; })).toEqual(["from a"]);
});
(0, bun_test_1.test)("replace hydration preserves collaboration system rows", function () {
    var state = (0, src_1.projectEvents)([
        {
            type: "collab.chat",
            id: "collab:keep:1",
            threadID: "collab:keep:1",
            from: "main_agent",
            to: "live_chat",
            text: "Natalia collaboration row",
            round: 1,
            expectsReply: true,
            at: "t0",
        },
    ]);
    (0, bun_test_1.expect)(state.natalia.messages.map(function (message) { return (0, src_1.displayText)(message); })).toEqual(["Natalia → Navi: Natalia collaboration row"]);
    (0, src_1.hydrateProjectedMessages)(state, [], "older", { replace: true });
    (0, bun_test_1.expect)(state.natalia.messages.map(function (message) { return (0, src_1.displayText)(message); })).toEqual(["Natalia → Navi: Natalia collaboration row"]);
});
(0, bun_test_1.test)("empty replace hydration does not clear existing turn rows", function () {
    var state = (0, src_1.projectEvents)([
        submitted("t1", "existing main turn"),
        { type: "content.done", id: "t1", text: "existing answer" },
    ]);
    (0, bun_test_1.expect)(state.natalia.messages).not.toHaveLength(0);
    (0, src_1.hydrateProjectedMessages)(state, [], "older", { replace: true });
    (0, bun_test_1.expect)(state.natalia.messages.map(function (message) { return (0, src_1.displayText)(message); })).toEqual(["existing main turn", "existing answer"]);
});
(0, bun_test_1.test)("boundTranscript trims an internal-heavy transcript without wiping it", function () {
    var messages = Array.from({ length: 400 }, function (_, index) { return ({
        id: "internal:".concat(index),
        role: index % 2 === 0 ? "system" : "tool",
        text: "x",
    }); });
    var bounded = (0, src_1.boundTranscript)(messages, "older");
    (0, bun_test_1.expect)(bounded.messages.length).toBeGreaterThan(0);
    (0, bun_test_1.expect)(bounded.messages.length).toBeLessThan(messages.length);
    (0, bun_test_1.expect)(bounded.evicted).toBe(true);
});
(0, bun_test_1.test)("boundTranscript newer keeps the newest end", function () {
    var messages = Array.from({ length: 400 }, function (_, index) { return ({
        id: "row:".concat(index),
        role: index % 20 === 0 ? "user" : "tool",
        text: "x",
    }); });
    var bounded = (0, src_1.boundTranscript)(messages, "newer");
    (0, bun_test_1.expect)(bounded.evicted).toBe(true);
    (0, bun_test_1.expect)(bounded.messages.at(-1)).toBe(messages.at(-1));
    var internalOnly = Array.from({ length: 400 }, function (_, index) { return ({
        id: "internal:".concat(index),
        role: index % 2 === 0 ? "system" : "tool",
        text: "x",
    }); });
    var fallback = (0, src_1.boundTranscript)(internalOnly, "newer");
    (0, bun_test_1.expect)(fallback.evicted).toBe(true);
    (0, bun_test_1.expect)(fallback.messages.at(-1)).toBe(internalOnly.at(-1));
});
(0, bun_test_1.test)("boundTranscript newer never undershoots the watermark on sparse user boundaries", function () {
    var messages = Array.from({ length: 1140 }, function (_, index) { return ({
        id: "row:".concat(index),
        role: index === 4 || index === 1075 ? "user" : "tool",
        text: "x",
    }); });
    var bounded = (0, src_1.boundTranscript)(messages, "newer");
    (0, bun_test_1.expect)(bounded.evicted).toBe(true);
    (0, bun_test_1.expect)(bounded.messages).toHaveLength(240);
    (0, bun_test_1.expect)(bounded.messages.at(-1)).toBe(messages.at(-1));
});
(0, bun_test_1.test)("hydrating chat tool rows keeps distinct ids for repeated tool names", function () {
    var state = (0, src_1.initialState)();
    (0, src_1.hydrateNaviMessages)(state, [
        {
            messageID: "chat:tools",
            role: "chat",
            text: "",
            at: "t1",
            kind: "tool",
            tool: {
                eventID: "event:tool:1",
                name: "read_file",
                status: "succeeded",
                summary: "first",
                result: "first",
            },
        },
        {
            messageID: "chat:tools",
            role: "chat",
            text: "",
            at: "t2",
            kind: "tool",
            tool: {
                eventID: "event:tool:2",
                name: "read_file",
                status: "succeeded",
                summary: "second",
                result: "second",
            },
        },
    ]);
    var ids = state.navi.messages.map(function (block) { return block.id; });
    (0, bun_test_1.expect)(ids).toEqual(["chat:event:tool:1:tool", "chat:event:tool:2:tool"]);
    (0, bun_test_1.expect)(new Set(ids).size).toBe(ids.length);
});
(0, bun_test_1.test)("empty explicit stream hydration clears durable rows without losing live output", function () {
    var state = (0, src_1.initialState)();
    (0, src_1.hydrateNaviMessages)(state, [
        { messageID: "old", role: "chat", text: "old", at: "t" },
    ]);
    (0, src_1.beginNaviHydration)(state);
    (0, src_1.hydrateNaviMessages)(state, []);
    (0, bun_test_1.expect)(state.navi.messages).toEqual([]);
    (0, src_1.beginNaviHydration)(state);
    (0, src_1.applyEvent)(state, {
        type: "navi.chat.message.delta",
        id: "live",
        messageID: "new",
        text: "live",
    });
    (0, src_1.hydrateNaviMessages)(state, []);
    (0, bun_test_1.expect)(state.navi.messages.map(src_1.displayText)).toEqual(["live"]);
});
(0, bun_test_1.test)("a late snapshot retains a live delta for the same message ID", function () {
    var state = (0, src_1.initialState)();
    (0, src_1.hydrateNaviMessages)(state, [
        { messageID: "same", role: "chat", text: "durable", at: "t" },
    ]);
    (0, src_1.beginNaviHydration)(state);
    (0, src_1.applyEvent)(state, {
        type: "navi.chat.message.delta",
        id: "same:delta",
        messageID: "same",
        text: " live",
    });
    (0, src_1.hydrateNaviMessages)(state, [
        { messageID: "same", role: "chat", text: "durable", at: "t" },
    ]);
    (0, bun_test_1.expect)(state.navi.messages.map(src_1.displayText)).toEqual(["durable live"]);
});
(0, bun_test_1.test)("generic interactive requests project and clear on response", function () {
    var state = (0, src_1.projectEvents)([
        {
            type: "interactive.request",
            id: "ix1",
            kind: "custom.kind",
            title: "Pick one",
            payload: { options: ["a", "b"] },
        },
    ]);
    (0, bun_test_1.expect)(state.pendingInteractives).toEqual([
        bun_test_1.expect.objectContaining({ id: "ix1", kind: "custom.kind" }),
    ]);
    (0, src_1.applyEvent)(state, {
        type: "interactive.response",
        id: "ix1",
        kind: "custom.kind",
        response: "a",
    });
    (0, bun_test_1.expect)(state.pendingInteractives).toEqual([]);
});
(0, bun_test_1.test)("context snapshots route to their owning stream", function () {
    var _a, _b, _c, _d, _e, _f, _g;
    var state = (0, src_1.initialState)();
    (0, src_1.applyEvent)(state, {
        type: "context.snapshot",
        usedTokens: 100,
        pressureTokens: 80,
        projectedTokens: 100,
        contextWindow: 1000,
        source: "provider_usage",
        at: "t",
    });
    (0, bun_test_1.expect)((_a = state.context) === null || _a === void 0 ? void 0 : _a.used).toBe(100);
    (0, bun_test_1.expect)((_b = state.context) === null || _b === void 0 ? void 0 : _b.max).toBe(1000);
    (0, bun_test_1.expect)((_c = state.natalia.context) === null || _c === void 0 ? void 0 : _c.used).toBe(100);
    (0, src_1.applyEvent)(state, {
        type: "context.snapshot",
        channel: "navi",
        usedTokens: 200,
        contextWindow: 2000,
        source: "estimate",
        at: "t",
    });
    (0, src_1.applyEvent)(state, {
        type: "context.snapshot",
        channel: "nia",
        usedTokens: 300,
        contextWindow: 3000,
        source: "estimate",
        at: "t",
    });
    (0, bun_test_1.expect)((_d = state.navi.context) === null || _d === void 0 ? void 0 : _d.used).toBe(200);
    (0, bun_test_1.expect)((_e = state.navi.context) === null || _e === void 0 ? void 0 : _e.max).toBe(2000);
    (0, bun_test_1.expect)((_f = state.nia.context) === null || _f === void 0 ? void 0 : _f.used).toBe(300);
    (0, bun_test_1.expect)((_g = state.nia.context) === null || _g === void 0 ? void 0 : _g.max).toBe(3000);
});
(0, bun_test_1.test)("context snapshots with agentID route to the isolated subagent state", function () {
    var _a, _b, _c, _d;
    var state = (0, src_1.initialState)();
    (0, src_1.applyEvent)(state, {
        type: "context.snapshot",
        agentID: "sub-1",
        usedTokens: 400,
        contextWindow: 4000,
        source: "provider_usage",
        at: "t",
    });
    (0, bun_test_1.expect)(state.context).toBeUndefined();
    (0, bun_test_1.expect)((_b = (_a = state.subagentStates["sub-1"]) === null || _a === void 0 ? void 0 : _a.context) === null || _b === void 0 ? void 0 : _b.used).toBe(400);
    (0, bun_test_1.expect)((_d = (_c = state.subagentStates["sub-1"]) === null || _c === void 0 ? void 0 : _c.context) === null || _d === void 0 ? void 0 : _d.max).toBe(4000);
});
(0, bun_test_1.test)("durable content.partial batches reconstruct a stream killed mid-flight", function () {
    var state = (0, src_1.projectEvents)([
        submitted("t1", "hi"),
        {
            type: "content.partial",
            id: "t1",
            text: "partial one ",
            at: "2026-01-01T00:00:00.000Z",
        },
        {
            type: "content.partial",
            id: "t1",
            text: "partial two",
            at: "2026-01-01T00:00:01.000Z",
        },
        // The process died here: no content.done was ever written.
    ]);
    (0, bun_test_1.expect)(text(state, (0, src_1.streamID)("t1", "assistant"))).toBe("partial one partial two");
});
(0, bun_test_1.test)("content.partial batches do not duplicate the final content.done", function () {
    var state = (0, src_1.projectEvents)([
        submitted("t1", "hi"),
        {
            type: "content.partial",
            id: "t1",
            text: "hello ",
            at: "2026-01-01T00:00:00.000Z",
        },
        {
            type: "content.partial",
            id: "t1",
            text: "world",
            at: "2026-01-01T00:00:01.000Z",
        },
        { type: "content.done", id: "t1", text: "hello world" },
    ]);
    (0, bun_test_1.expect)(state.messages.filter(function (block) { return block.role === "assistant"; })).toHaveLength(1);
    (0, bun_test_1.expect)(text(state, (0, src_1.streamID)("t1", "assistant"))).toBe("hello world");
});
(0, bun_test_1.test)("hydrateProjectedMessages restores a row missing from an existing turn", function () {
    var state = (0, src_1.initialState)();
    // A reconnect/replay left the user row, but the answer row is gone.
    state.messages.push({
        id: "t1:user",
        role: "user",
        text: "question",
        pendingText: "",
    });
    (0, src_1.hydrateProjectedMessages)(state, [
        {
            id: "t1",
            turnID: "t1",
            submitted: submitted("t1", "question"),
            rows: [
                {
                    id: "t1:user",
                    turnID: "t1",
                    kind: "user",
                    event: submitted("t1", "question"),
                },
                {
                    id: "t1:assistant",
                    turnID: "t1",
                    kind: "assistant",
                    event: { type: "content.done", id: "t1", text: "answer" },
                },
            ],
        },
    ], "newer");
    (0, bun_test_1.expect)(state.messages.map(function (message) { return message.id; })).toContain("t1:assistant");
    (0, bun_test_1.expect)(text(state, "t1:assistant")).toBe("answer");
});
(0, bun_test_1.test)("hydrateProjectedMessages does not roll a longer live row back to a stale page", function () {
    var state = (0, src_1.initialState)();
    state.messages.push({
        id: "t1:assistant",
        role: "assistant",
        text: "hello world",
        pendingText: "",
    });
    (0, src_1.hydrateProjectedMessages)(state, [
        {
            id: "t1",
            turnID: "t1",
            submitted: submitted("t1", "question"),
            rows: [
                {
                    id: "t1:user",
                    turnID: "t1",
                    kind: "user",
                    event: submitted("t1", "question"),
                },
                {
                    id: "t1:assistant",
                    turnID: "t1",
                    kind: "assistant",
                    event: { type: "content.done", id: "t1", text: "hi" },
                },
            ],
        },
    ], "newer");
    (0, bun_test_1.expect)(text(state, "t1:assistant")).toBe("hello world");
});
(0, bun_test_1.test)("context.instructions events and the projected notices contract converge on one view (ADR Phase C)", function () {
    var _a;
    var configReload = function (id, revision, at, summary) { return ({
        type: "context.instructions",
        id: id,
        kind: "config_reload",
        at: at,
        revision: revision,
        summary: summary,
    }); };
    // Live stream: an earlier reload arrives first.
    var state = (0, src_1.projectEvents)([
        configReload("context:config:1", 1, "2026-09-16T00:00:00.000Z", "runtime config reloaded; provider unchanged"),
    ]);
    (0, bun_test_1.expect)(state.runtimeNotices).toEqual([
        {
            noticeID: "context:config:1",
            kind: "config_reload",
            revision: 1,
            at: "2026-09-16T00:00:00.000Z",
            summary: "runtime config reloaded; provider unchanged",
        },
    ]);
    // A later reload supersedes it — the earlier event stays in the journal.
    var next = (0, src_1.reduceState)(state, configReload("context:config:2", 2, "2026-09-16T01:00:00.000Z", "runtime config reloaded; provider reconfigured"));
    (0, bun_test_1.expect)(next.runtimeNotices).toEqual([
        {
            noticeID: "context:config:2",
            kind: "config_reload",
            revision: 2,
            at: "2026-09-16T01:00:00.000Z",
            summary: "runtime config reloaded; provider reconfigured",
        },
    ]);
    // The server-projected contract merges into the same view: a lower
    // revision never clobbers the newer live state, a higher one applies.
    (0, bun_test_1.expect)((0, src_1.hydrateRuntimeNotices)(next, [
        {
            noticeID: "context:config:1",
            kind: "config_reload",
            revision: 1,
            at: "2026-09-16T00:00:00.000Z",
            summary: "stale",
        },
    ])).toBe(false);
    (0, bun_test_1.expect)((_a = next.runtimeNotices[0]) === null || _a === void 0 ? void 0 : _a.revision).toBe(2);
    // An agent_switch notice joins the view without touching the config one.
    var withAgent = (0, src_1.reduceState)(next, {
        type: "context.instructions",
        id: "context:agent:1",
        kind: "agent_switch",
        at: "2026-09-16T02:00:00.000Z",
        revision: 1,
        summary: "active agent switched to reviewer",
    });
    (0, bun_test_1.expect)(withAgent.runtimeNotices.map(function (notice) { return notice.kind; })).toEqual([
        "config_reload",
        "agent_switch",
    ]);
});
(0, bun_test_1.test)("runtime.step_usage folds into per-session token/latency totals with derived figures", function () {
    var step = function (id, inputTokens, outputTokens, cacheRead, llmMs, ttftMs, toolMs) {
        return (__assign(__assign({ type: "runtime.step_usage", id: id, inputTokens: inputTokens, outputTokens: outputTokens, cacheReadInputTokens: cacheRead, llmMs: llmMs }, (ttftMs !== undefined ? { ttftMs: ttftMs } : {})), (toolMs !== undefined ? { toolMs: toolMs } : {})));
    };
    var state = (0, src_1.projectEvents)([
        step("s1", 1000, 200, 4000, 1500, 300, 500),
        step("s2", 1200, 180, 6000, 1800, 350),
    ]);
    (0, bun_test_1.expect)(state.sessionUsage).toMatchObject({
        steps: 2,
        inputTokens: 2200,
        outputTokens: 380,
        cacheReadInputTokens: 10000,
        llmMs: 3300,
        toolMs: 500,
        ttftMs: 650,
        ttftSteps: 2,
    });
    var view = (0, src_1.deriveSessionUsageView)(state.sessionUsage);
    // totalInput = 2200 + 10000 + 0(cacheCreation); hitRate = 10000/12200.
    (0, bun_test_1.expect)(view.totalInputTokens).toBe(12200);
    (0, bun_test_1.expect)(view.cacheHitRate).toBeCloseTo(10000 / 12200, 5);
    (0, bun_test_1.expect)(view.avgTtftMs).toBe(325);
    // decodeMs wasn't reported, so throughput is 0 (no denominator).
    (0, bun_test_1.expect)(view.tokensPerSecond).toBe(0);
});
(0, bun_test_1.test)("per-channel usage keeps Natalia, Navi and Nia totals separate", function () {
    var step = function (id, channel, inputTokens, outputTokens) {
        return ({
            type: "runtime.step_usage",
            id: id,
            channel: channel,
            inputTokens: inputTokens,
            outputTokens: outputTokens,
        });
    };
    var state = (0, src_1.projectEvents)([
        step("m1", "main", 100, 10),
        step("n1", "navi", 200, 20),
        step("a1", "nia", 300, 30),
    ]);
    (0, bun_test_1.expect)(state.usageByChannel.main).toMatchObject({
        inputTokens: 100,
        outputTokens: 10,
        steps: 1,
    });
    (0, bun_test_1.expect)(state.usageByChannel.navi).toMatchObject({
        inputTokens: 200,
        outputTokens: 20,
        steps: 1,
    });
    (0, bun_test_1.expect)(state.usageByChannel.nia).toMatchObject({
        inputTokens: 300,
        outputTokens: 30,
        steps: 1,
    });
    // The legacy aggregate remains the session-wide sum for existing consumers.
    (0, bun_test_1.expect)(state.sessionUsage).toMatchObject({
        inputTokens: 600,
        outputTokens: 60,
        steps: 3,
    });
});
(0, bun_test_1.test)("session usage is per-session isolated via the session id on events", function () {
    var usage = function (id, sessionID, outputTokens) {
        return ({
            type: "runtime.step_usage",
            id: id,
            sessionID: sessionID,
            outputTokens: outputTokens,
            llmMs: 100,
        });
    };
    var stateA = (0, src_1.projectEvents)([usage("a1", "ses_A", 50)]);
    var stateB = (0, src_1.projectEvents)([usage("b1", "ses_B", 70)]);
    (0, bun_test_1.expect)(stateA.sessionUsage.outputTokens).toBe(50);
    (0, bun_test_1.expect)(stateB.sessionUsage.outputTokens).toBe(70);
});
(0, bun_test_1.test)("a real tool-call causal chain folds into the work-graph forest and step usage accumulates (end-to-end data flow)", function () {
    var sessionID = "ses_e2e";
    var turnID = "turn_1";
    var callID = "call_1";
    var path = "packages/x/src/app.ts";
    var actionNode = "wg:action:".concat(turnID);
    var toolNode = "wg:tool:".concat(turnID, ":").concat(callID);
    var changeNode = "wg:change:".concat(turnID, ":").concat(path);
    var events = [
        {
            type: "workgraph.node_added",
            id: actionNode,
            nodeID: actionNode,
            kind: "agent_action",
            summary: "agent acted",
            sessionID: sessionID,
            turnID: turnID,
        },
        {
            type: "workgraph.node_added",
            id: toolNode,
            nodeID: toolNode,
            kind: "tool_call",
            summary: "run_shell succeeded",
            sessionID: sessionID,
            turnID: turnID,
        },
        {
            type: "workgraph.edge_added",
            id: "e:caused:".concat(toolNode),
            sourceID: actionNode,
            targetID: toolNode,
            kind: "caused",
        },
        {
            type: "workgraph.node_added",
            id: changeNode,
            nodeID: changeNode,
            kind: "workspace_change",
            summary: "run_shell changed",
            target: path,
            sessionID: sessionID,
            turnID: turnID,
        },
        {
            type: "workgraph.edge_added",
            id: "e:modified:".concat(changeNode),
            sourceID: toolNode,
            targetID: changeNode,
            kind: "modified",
        },
        {
            type: "runtime.step_usage",
            id: "u1",
            sessionID: sessionID,
            inputTokens: 1000,
            outputTokens: 200,
            cacheReadInputTokens: 5000,
            llmMs: 1200,
            ttftMs: 300,
        },
        {
            type: "runtime.step_usage",
            id: "u2",
            sessionID: sessionID,
            outputTokens: 150,
            toolMs: 400,
        },
    ];
    var state = (0, src_1.projectEvents)(events);
    // The three causal nodes folded into the per-session graph.
    (0, bun_test_1.expect)(Object.keys(state.workGraphNodes).sort()).toEqual([actionNode, changeNode, toolNode].sort());
    // The forest is one root (the agent action, no inbound edge) whose branch
    // walks action --caused--> tool_call --modified--> workspace_change.
    var forest = (0, src_1.buildWorkGraphForest)(state);
    (0, bun_test_1.expect)(forest).toHaveLength(1);
    (0, bun_test_1.expect)(forest[0].node.nodeID).toBe(actionNode);
    var toolChild = forest[0].children.find(function (child) { return child.node.nodeID === toolNode; });
    (0, bun_test_1.expect)(toolChild === null || toolChild === void 0 ? void 0 : toolChild.via).toBe("caused");
    var changeChild = toolChild === null || toolChild === void 0 ? void 0 : toolChild.children.find(function (child) { return child.node.nodeID === changeNode; });
    (0, bun_test_1.expect)(changeChild === null || changeChild === void 0 ? void 0 : changeChild.via).toBe("modified");
    // Step usage accumulated over the two steps.
    (0, bun_test_1.expect)(state.sessionUsage).toMatchObject({
        steps: 2,
        inputTokens: 1000,
        outputTokens: 350,
        cacheReadInputTokens: 5000,
        toolMs: 400,
    });
});
(0, bun_test_1.test)("the default forest omits runtime self-protection constraints but keeps them when linked", function () {
    var sessionID = "ses_filter";
    var runtimeConstraint = "wg:constraint:C-TERM-001";
    var decision = "wg:decision:d1";
    // A runtime self-protection constraint is a root on a fresh session (nothing
    // constrained yet); a decision node is also a root.
    var state = (0, src_1.projectEvents)([
        {
            type: "workgraph.node_added",
            id: runtimeConstraint,
            nodeID: runtimeConstraint,
            kind: "constraint",
            summary: "constraint · C-TERM-001",
            actor: "runtime",
            target: "C-TERM-001",
            sessionID: sessionID,
        },
        {
            type: "workgraph.node_added",
            id: decision,
            nodeID: decision,
            kind: "decision",
            summary: "a decision",
            actor: "model",
            sessionID: sessionID,
        },
    ]);
    // The runtime constraint is filtered from the default roots; the decision stays.
    (0, bun_test_1.expect)((0, src_1.buildWorkGraphForest)(state).map(function (node) { return node.node.nodeID; })).toEqual([
        decision,
    ]);
    // When a tool call is actually constrained by it, the runtime constraint
    // still appears (as a child), so the filter does not lose the information.
    var toolCall = "wg:tool:turn_1:call_1";
    var linked = (0, src_1.projectEvents)([
        {
            type: "workgraph.node_added",
            id: toolCall,
            nodeID: toolCall,
            kind: "tool_call",
            summary: "shell · succeeded",
            actor: "shell",
            sessionID: sessionID,
            turnID: "turn_1",
        },
        {
            type: "workgraph.node_added",
            id: runtimeConstraint,
            nodeID: runtimeConstraint,
            kind: "constraint",
            summary: "constraint · C-TERM-001",
            actor: "runtime",
            target: "C-TERM-001",
            sessionID: sessionID,
        },
        {
            type: "workgraph.edge_added",
            id: "e:constrained",
            sourceID: toolCall,
            targetID: runtimeConstraint,
            kind: "constrained_by",
        },
    ]);
    var forest = (0, src_1.buildWorkGraphForest)(linked);
    (0, bun_test_1.expect)(forest).toHaveLength(1);
    (0, bun_test_1.expect)(forest[0].node.nodeID).toBe(toolCall);
    (0, bun_test_1.expect)(forest[0].children.map(function (child) { return child.node.nodeID; })).toContain(runtimeConstraint);
});
(0, bun_test_1.test)("an older session (tool.update + turn.finished only) still rebuilds the causal forest and usage (historical replay)", function () {
    var sessionID = "ses_old";
    var turnID = "turn_old";
    // A pre-workgraph-event session: the journal has durable tool.update and
    // turn.finished events but none of the runtime.step_usage / workgraph.*
    // events newer code emits.
    var events = [
        { type: "turn.submitted", id: turnID, text: "do the thing", sessionID: sessionID },
        {
            type: "tool.update",
            id: "".concat(turnID, ":call_a"),
            name: "run_shell",
            callID: "call_a",
            status: "succeeded",
            summary: "ran tests",
            sessionID: sessionID,
        },
        {
            type: "tool.update",
            id: "".concat(turnID, ":call_b"),
            name: "apply_edits",
            callID: "call_b",
            status: "succeeded",
            summary: "edited files",
            sessionID: sessionID,
        },
        {
            type: "turn.finished",
            id: turnID,
            stopReason: "done",
            durationMs: 4200,
            sessionID: sessionID,
        },
    ];
    var state = (0, src_1.projectEvents)(events);
    var actionID = "wg:action:".concat(turnID);
    // The causal backbone is reconstructed from the tool events alone.
    (0, bun_test_1.expect)(state.workGraphNodes[actionID]).toMatchObject({
        kind: "agent_action",
    });
    (0, bun_test_1.expect)(state.workGraphNodes["wg:tool:".concat(turnID, ":call_a")]).toMatchObject({
        kind: "tool_call",
    });
    var forest = (0, src_1.buildWorkGraphForest)(state);
    (0, bun_test_1.expect)(forest).toHaveLength(1);
    (0, bun_test_1.expect)(forest[0].node.nodeID).toBe(actionID);
    // Both tool calls hang off the action via the caused edge.
    (0, bun_test_1.expect)(forest[0].children.map(function (child) { return child.node.nodeID; }).sort()).toEqual(["wg:tool:".concat(turnID, ":call_a"), "wg:tool:".concat(turnID, ":call_b")].sort());
    // Turn count and wall time come from the durable turn.finished.
    (0, bun_test_1.expect)(state.sessionUsage).toMatchObject({ turns: 1, llmMs: 4200 });
    // No per-step token data exists for an old session — honest zeros, not guesses.
    (0, bun_test_1.expect)(state.sessionUsage.inputTokens).toBe(0);
});
(0, bun_test_1.test)("context.instructions interleave into the transcript as system bubbles at their sequence position (ADR Phase C)", function () {
    var sessionID = "ses_notice";
    var events = [
        { type: "turn.submitted", id: "t1", text: "first", sessionID: sessionID },
        {
            type: "context.instructions",
            id: "ctx:1",
            kind: "config_reload",
            at: "2026-09-16T01:00:00.000Z",
            revision: 1,
            summary: "runtime config reloaded",
            sessionID: sessionID,
        },
        { type: "turn.submitted", id: "t2", text: "second", sessionID: sessionID },
    ];
    var state = (0, src_1.projectEvents)(events);
    var ids = state.natalia.messages.map(function (message) { return message.id; });
    // The notice bubble lands between the two turns (its fold position), not at
    // the top or the very end.
    var noticeIndex = ids.indexOf("notice:ctx:1");
    (0, bun_test_1.expect)(noticeIndex).toBeGreaterThan(ids.indexOf("t1:user"));
    (0, bun_test_1.expect)(noticeIndex).toBeLessThan(ids.indexOf("t2:user"));
    var notice = state.natalia.messages[noticeIndex];
    (0, bun_test_1.expect)(notice.role).toBe("system");
    (0, bun_test_1.expect)(notice.text).toBe("config_reload: runtime config reloaded");
});
(0, bun_test_1.test)("per-channel token usage accumulates on the root state, not the agent sub-state", function () {
    // Regression: the per-channel token bars (main/navi/nia) accumulate
    // usageByChannel on the root AppState. Folding a navi/nia turn.finished must
    // not throw by writing to the agent sub-state (which has no usageByChannel),
    // and each channel's turns/llmMs must land under its own key.
    var state = (0, src_1.initialState)();
    (0, src_1.applyEvent)(state, {
        type: "navi.chat.turn.finished",
        id: "navi:fin:1",
        messageID: "navi:m1",
        stopReason: "done",
        startedAt: 1000,
        endedAt: 1250,
    });
    (0, src_1.applyEvent)(state, {
        type: "nia.chat.turn.finished",
        id: "nia:fin:1",
        messageID: "nia:m1",
        stopReason: "done",
        startedAt: 2000,
        endedAt: 2100,
    });
    (0, src_1.applyEvent)(state, {
        type: "navi.chat.turn.finished",
        id: "navi:fin:2",
        messageID: "navi:m2",
        stopReason: "done",
        startedAt: 3000,
        endedAt: 3400,
    });
    (0, bun_test_1.expect)(state.usageByChannel.navi.turns).toBe(2);
    (0, bun_test_1.expect)(state.usageByChannel.navi.llmMs).toBe(250 + 400);
    (0, bun_test_1.expect)(state.usageByChannel.nia.turns).toBe(1);
    (0, bun_test_1.expect)(state.usageByChannel.nia.llmMs).toBe(100);
    // The main channel is untouched by navi/nia turns.
    (0, bun_test_1.expect)(state.usageByChannel.main.turns).toBe(0);
});
(0, bun_test_1.test)("buildWorkGraphFileNavigation answers why-changed from a file path (WG5)", function () {
    var sessionID = "ses_wg5";
    var turnID = "turn_1";
    var callID = "call_1";
    var path = "packages/x/src/app.ts";
    var goalNode = "wg:goal:g1";
    var actionNode = "wg:action:".concat(turnID);
    var toolNode = "wg:tool:".concat(turnID, ":").concat(callID);
    var changeNode = "wg:change:".concat(turnID, ":").concat(path);
    var events = [
        {
            type: "workgraph.node_added",
            id: goalNode,
            nodeID: goalNode,
            kind: "goal",
            summary: "ship feature",
            sessionID: sessionID,
        },
        {
            type: "workgraph.node_added",
            id: actionNode,
            nodeID: actionNode,
            kind: "agent_action",
            summary: "agent acted",
            sessionID: sessionID,
            turnID: turnID,
        },
        {
            type: "workgraph.edge_added",
            id: "e:toward:".concat(actionNode),
            sourceID: goalNode,
            targetID: actionNode,
            kind: "toward",
        },
        {
            type: "workgraph.node_added",
            id: toolNode,
            nodeID: toolNode,
            kind: "tool_call",
            summary: "run_shell succeeded",
            sessionID: sessionID,
            turnID: turnID,
        },
        {
            type: "workgraph.edge_added",
            id: "e:caused:".concat(toolNode),
            sourceID: actionNode,
            targetID: toolNode,
            kind: "caused",
        },
        {
            type: "workgraph.node_added",
            id: changeNode,
            nodeID: changeNode,
            kind: "workspace_change",
            summary: "run_shell changed",
            target: path,
            sessionID: sessionID,
            turnID: turnID,
        },
        {
            type: "workgraph.edge_added",
            id: "e:modified:".concat(changeNode),
            sourceID: toolNode,
            targetID: changeNode,
            kind: "modified",
        },
    ];
    var state = (0, src_1.projectEvents)(events);
    // From the file path, the backward "why changed" chain walks
    // change <- tool_call <- agent_action <- goal (nested as branch trees).
    var flatten = function (trees) {
        return trees.flatMap(function (tree) { return __spreadArray([tree.node.nodeID], flatten(tree.children), true); });
    };
    var nav = (0, src_1.buildWorkGraphFileNavigation)(state, path);
    (0, bun_test_1.expect)(nav.filePath).toBe(path);
    (0, bun_test_1.expect)(nav.matches.map(function (node) { return node.nodeID; })).toEqual([changeNode]);
    var whyIDs = flatten(nav.whyChanged);
    (0, bun_test_1.expect)(whyIDs).toContain(toolNode);
    (0, bun_test_1.expect)(whyIDs).toContain(actionNode);
    (0, bun_test_1.expect)(whyIDs).toContain(goalNode);
    // A suffix match on the basename also resolves the same node.
    (0, bun_test_1.expect)((0, src_1.buildWorkGraphFileNavigation)(state, "app.ts").matches.map(function (n) { return n.nodeID; })).toEqual([changeNode]);
    // An unknown path returns no matches and no fabricated cause.
    var missing = (0, src_1.buildWorkGraphFileNavigation)(state, "does/not/exist.ts");
    (0, bun_test_1.expect)(missing.matches).toEqual([]);
    (0, bun_test_1.expect)(missing.whyChanged).toEqual([]);
    (0, bun_test_1.expect)(missing.whatChanged).toEqual([]);
});
(0, bun_test_1.test)("a subagent step's cache metrics fold into the session totals", function () {
    // A subagent publishes the same `runtime.step_usage` shape as the main runner
    // and carries no channel tag, so its cache traffic reaches the session totals
    // the dashboard's hit rate is computed from. Before the subagent carried these
    // fields, its steps reported full-price input however warm their cache was.
    var state = (0, src_1.projectEvents)([
        {
            type: "runtime.step_usage",
            id: "a1:usage:1",
            inputTokens: 1000,
            outputTokens: 200,
            cacheReadInputTokens: 40000,
            cacheCreationInputTokens: 2000,
            llmMs: 1500,
        },
        {
            type: "runtime.step_usage",
            id: "a1:usage:2",
            inputTokens: 900,
            outputTokens: 150,
            // A step with no cache metrics still contributes its plain tokens.
            llmMs: 1200,
        },
    ]);
    (0, bun_test_1.expect)(state.sessionUsage.steps).toBe(2);
    (0, bun_test_1.expect)(state.sessionUsage.inputTokens).toBe(1900);
    (0, bun_test_1.expect)(state.sessionUsage.cacheReadInputTokens).toBe(40000);
    (0, bun_test_1.expect)(state.sessionUsage.cacheCreationInputTokens).toBe(2000);
    // The write-aware rate counts cache writes, so a subagent warming a prefix is
    // not reported as if it had hit one.
    (0, bun_test_1.expect)((0, contracts_1.cacheHitRate)(state.sessionUsage)).toBeCloseTo(40000 / (1900 + 40000 + 2000), 10);
});
(0, bun_test_1.test)("invariant findings project as an open->resolved lifecycle, once per edge", function () {
    var state = (0, src_1.initialState)();
    var violation = {
        type: "invariant.violation",
        at: "2026-01-01T00:00:00.000Z",
        owner: "session",
        invariant: "session.projection-complete-after-turns",
        code: "session.projection_incomplete",
        detail: "ses_x ran turns",
        sessionID: "ses_x",
    };
    (0, src_1.applyEvent)(state, violation);
    // A repeated or replayed violation of the same identity stacks nothing.
    (0, src_1.applyEvent)(state, violation);
    (0, bun_test_1.expect)(state.invariantFindings).toHaveLength(1);
    (0, bun_test_1.expect)(state.invariantFindings[0]).toMatchObject({
        key: "session|session.projection-complete-after-turns|session.projection_incomplete|ses_x ran turns",
        owner: "session",
        resolved: false,
        sessionID: "ses_x",
    });
    (0, src_1.applyEvent)(state, __assign(__assign({}, violation), { type: "invariant.resolved" }));
    (0, bun_test_1.expect)(state.invariantFindings).toHaveLength(1);
    (0, bun_test_1.expect)(state.invariantFindings[0].resolved).toBe(true);
    // A re-open is a fresh row (the clone round-trip keeps them all).
    (0, src_1.applyEvent)(state, violation);
    (0, bun_test_1.expect)(state.invariantFindings).toHaveLength(2);
    (0, bun_test_1.expect)(state.invariantFindings.filter(function (finding) { return !finding.resolved; })).toHaveLength(1);
});
