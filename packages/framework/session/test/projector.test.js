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
var src_1 = require("../src");
var src_2 = require("../src");
var promises_1 = require("node:fs/promises");
var node_os_1 = require("node:os");
var node_path_1 = require("node:path");
(0, bun_test_1.test)("session projector separates completed, active, and unpromoted durable input", function () {
    var session = (0, src_1.createSessionRecord)("ses_projector", "Projector");
    (0, src_1.admitInput)(session, { id: "turn_done", text: "done", delivery: "next-step" });
    (0, src_1.admitInput)(session, {
        id: "turn_queue",
        text: "queue",
        delivery: "next-turn",
    });
    (0, src_1.appendSessionEvent)(session, {
        type: "turn.submitted",
        id: "turn_done",
        text: "done",
        byteLength: 4,
        lineCount: 1,
        sha256: "test",
    });
    (0, src_1.appendSessionEvent)(session, {
        type: "tool.update",
        id: "turn_interrupted:call_1",
        name: "read_file",
        callID: "call_1",
        status: "succeeded",
        summary: "read",
        result: "orphaned output",
    });
    (0, src_1.appendSessionEvent)(session, {
        type: "turn.finished",
        id: "turn_done",
        stopReason: "done",
    });
    (0, src_1.appendSessionEvent)(session, {
        type: "turn.submitted",
        id: "turn_interrupted",
        text: "interrupted",
        byteLength: 11,
        lineCount: 1,
        sha256: "test",
    });
    var projection = (0, src_1.projectSession)(session);
    (0, bun_test_1.expect)(projection.completedTurnIDs).toEqual(["turn_done"]);
    (0, bun_test_1.expect)(projection.activeTurnIDs).toEqual(["turn_interrupted"]);
    (0, bun_test_1.expect)(projection.pendingInputs.map(function (input) { return input.id; })).toEqual([
        "turn_done",
        "turn_queue",
    ]);
    (0, bun_test_1.expect)(projection.replayableEvents).toHaveLength(2);
    (0, bun_test_1.expect)(projection.replayableEvents.some(function (event) {
        return event.type === "turn.submitted" && event.id === "turn_interrupted";
    })).toBe(false);
    (0, bun_test_1.expect)(projection.replayableEvents.some(function (event) {
        return event.type === "tool.update" && event.id === "turn_interrupted:call_1";
    })).toBe(false);
});
(0, bun_test_1.test)("projects the last durable model and variant selection", function () {
    var events = [
        { type: "model.selection", modelID: "alpha", variant: "fast" },
        { type: "model.selection", modelID: "beta", variant: "careful" },
    ];
    (0, bun_test_1.expect)((0, src_1.selectedModelFromEvents)(__spreadArray([], events, true))).toEqual({
        modelID: "beta",
        variant: "careful",
    });
});
(0, bun_test_1.test)("session projector replays only committed agent selection", function () {
    var events = [
        { type: "agent.selection", name: "first", pending: false },
        { type: "agent.selection", name: "second", pending: true },
        { type: "agent.selection", name: "third", pending: false },
    ];
    (0, bun_test_1.expect)((0, src_1.selectedAgentFromEvents)(events)).toBe("third");
});
(0, bun_test_1.test)("interrupted turns reject only their unresolved interactive requests", function () {
    var session = (0, src_1.createSessionRecord)("ses_interrupted", "Interrupted");
    (0, src_1.appendSessionEvent)(session, {
        type: "turn.submitted",
        id: "turn_crashed",
        text: "write",
        byteLength: 5,
        lineCount: 1,
        sha256: "test",
    });
    (0, src_1.appendSessionEvent)(session, {
        type: "approval.request",
        id: "turn_crashed:write",
        title: "Write",
        preview: "file",
    });
    (0, src_1.appendSessionEvent)(session, {
        type: "question.request",
        id: "turn_crashed:write:question",
        title: "Confirm",
    });
    (0, src_1.appendSessionEvent)(session, {
        type: "approval.request",
        id: "independent_approval",
        title: "Independent",
        preview: "safe",
    });
    (0, bun_test_1.expect)((0, src_1.settleInterruptedTurns)(session)).toEqual([
        {
            type: "approval.response",
            id: "turn_crashed:write",
            decision: "reject",
            feedback: "interrupted turn cannot continue after runtime restart",
        },
        {
            type: "question.response",
            id: "turn_crashed:write:question",
            answers: [],
            rejected: true,
        },
        { type: "turn.finished", id: "turn_crashed", stopReason: "error" },
    ]);
    (0, bun_test_1.expect)((0, src_1.projectSession)(session).activeTurnIDs).toEqual([]);
});
(0, bun_test_1.test)("model-visible selection starts after the latest durable context epoch", function () {
    var events = [
        {
            type: "turn.submitted",
            id: "old",
            text: "old",
            byteLength: 3,
            lineCount: 1,
            sha256: "x",
        },
        {
            type: "context.checkpoint",
            id: "epoch",
            snapshot: {
                entries: [],
                resources: [],
                journalOffset: 1,
                step: 1,
                tokenEstimate: 1,
                compactionGeneration: 0,
            },
        },
        {
            type: "turn.submitted",
            id: "new",
            text: "new",
            byteLength: 3,
            lineCount: 1,
            sha256: "x",
        },
    ];
    (0, bun_test_1.expect)((0, src_1.modelVisibleEvents)(events).map(function (event) {
        return event.type === "turn.submitted" ? event.id : event.type;
    })).toEqual(["new"]);
});
(0, bun_test_1.test)("session fork truncates at a durable submitted-turn boundary", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, store, session, _i, _a, id, fork;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-session-fork-"))];
            case 1:
                root = _b.sent();
                _b.label = 2;
            case 2:
                _b.trys.push([2, , 5, 7]);
                store = new src_2.JsonSessionStore(root);
                session = (0, src_1.createSessionRecord)("ses_parent", "Parent");
                for (_i = 0, _a = ["turn_one", "turn_two"]; _i < _a.length; _i++) {
                    id = _a[_i];
                    (0, src_1.appendSessionEvent)(session, {
                        type: "turn.submitted",
                        id: id,
                        text: id,
                        byteLength: id.length,
                        lineCount: 1,
                        sha256: "test",
                    });
                }
                (0, src_1.appendSessionEvent)(session, {
                    type: "content.done",
                    id: "turn_one",
                    text: "first result",
                });
                return [4 /*yield*/, store.save(session)];
            case 3:
                _b.sent();
                return [4 /*yield*/, store.fork("ses_parent", "turn_two", "ses_fork")];
            case 4:
                fork = _b.sent();
                (0, bun_test_1.expect)(fork.id).toBe("ses_fork");
                (0, bun_test_1.expect)(fork.title).toBe("Parent (fork)");
                (0, bun_test_1.expect)(fork.events.map(function (event) {
                    return event.type === "turn.submitted" ? event.id : event.type;
                })).toEqual(["turn_one"]);
                (0, bun_test_1.expect)(fork.events.some(function (event) { return "id" in event && event.id === "turn_two"; })).toBe(false);
                return [3 /*break*/, 7];
            case 5: return [4 /*yield*/, (0, promises_1.rm)(root, { recursive: true, force: true })];
            case 6:
                _b.sent();
                return [7 /*endfinally*/];
            case 7: return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("projects ordered turn messages without splitting durable rows", function () {
    var _a, _b;
    var session = (0, src_1.createSessionRecord)("ses_messages", "Messages");
    for (var _i = 0, _c = ["turn_one", "turn_two", "turn_three"]; _i < _c.length; _i++) {
        var id = _c[_i];
        (0, src_1.appendSessionEvent)(session, {
            type: "turn.submitted",
            id: id,
            text: id,
            byteLength: id.length,
            lineCount: 1,
            sha256: "test",
        });
        (0, src_1.appendSessionEvent)(session, {
            type: "content.done",
            id: id,
            text: "".concat(id, " response"),
        });
        (0, src_1.appendSessionEvent)(session, {
            type: "tool.update",
            id: "".concat(id, ":tool:read"),
            name: "read_file",
            status: "succeeded",
            summary: "read",
            result: "content",
        });
        (0, src_1.appendSessionEvent)(session, {
            type: "turn.finished",
            id: id,
            stopReason: "done",
        });
    }
    var first = (0, src_1.projectSessionMessages)(session, { order: "asc", limit: 2 });
    (0, bun_test_1.expect)(first.data.map(function (message) { return message.id; })).toEqual([
        "turn_one",
        "turn_two",
    ]);
    (0, bun_test_1.expect)((_a = first.data[0]) === null || _a === void 0 ? void 0 : _a.rows.map(function (row) { return row.kind; })).toEqual([
        "user",
        "assistant",
        "tool",
        "system",
    ]);
    (0, bun_test_1.expect)((_b = first.data[0]) === null || _b === void 0 ? void 0 : _b.stopReason).toBe("done");
    (0, bun_test_1.expect)(first.cursor.next).toEqual(bun_test_1.expect.any(String));
    var next = (0, src_1.projectSessionMessages)(session, {
        cursor: first.cursor.next,
    });
    (0, bun_test_1.expect)(next.data.map(function (message) { return message.id; })).toEqual(["turn_three"]);
    (0, bun_test_1.expect)(next.cursor.previous).toEqual(bun_test_1.expect.any(String));
    var previous = (0, src_1.projectSessionMessages)(session, {
        cursor: next.cursor.previous,
        limit: 2,
    });
    (0, bun_test_1.expect)(previous.data.map(function (message) { return message.id; })).toEqual([
        "turn_one",
        "turn_two",
    ]);
});
(0, bun_test_1.test)("projected turn inputs attach to the running turn as user rows", function () {
    var session = (0, src_1.createSessionRecord)("ses_turn_input", "Turn input");
    (0, src_1.appendSessionEvent)(session, {
        type: "turn.submitted",
        id: "turn_live",
        text: "start",
        byteLength: 5,
        lineCount: 1,
        sha256: "test",
    });
    (0, src_1.appendSessionEvent)(session, {
        type: "turn.input",
        turnID: "turn_live",
        inputID: "input_1",
        text: "also do X",
        delivery: "next-step",
    });
    (0, src_1.appendSessionEvent)(session, {
        type: "content.done",
        id: "turn_live",
        text: "done",
    });
    (0, src_1.appendSessionEvent)(session, {
        type: "turn.finished",
        id: "turn_live",
        stopReason: "done",
    });
    var projected = (0, src_1.projectSessionMessages)(session, { order: "asc" });
    (0, bun_test_1.expect)(projected.data.map(function (message) { return message.id; })).toEqual(["turn_live"]);
    (0, bun_test_1.expect)(projected.data[0].rows.map(function (row) { return row.id; })).toEqual([
        "turn_live:turn.submitted",
        "turn_live:user:input_1",
        "turn_live:content.done",
        "turn_live:turn.finished",
    ]);
    (0, bun_test_1.expect)(projected.data[0].rows.map(function (row) { return row.kind; })).toEqual([
        "user",
        "user",
        "assistant",
        "system",
    ]);
});
(0, bun_test_1.test)("projected row ids stay unique across repeated events in one turn", function () {
    var session = (0, src_1.createSessionRecord)("ses_message_row_ids", "Row ids");
    (0, src_1.appendSessionEvent)(session, {
        type: "turn.submitted",
        id: "turn_rows",
        text: "hello",
        byteLength: 5,
        lineCount: 1,
        sha256: "test",
    });
    (0, src_1.appendSessionEvent)(session, {
        type: "thinking.done",
        id: "turn_rows",
        text: "first thought",
    });
    (0, src_1.appendSessionEvent)(session, {
        type: "content.done",
        id: "turn_rows",
        text: "first answer",
    });
    (0, src_1.appendSessionEvent)(session, {
        type: "content.done",
        id: "turn_rows",
        text: "",
    });
    (0, src_1.appendSessionEvent)(session, {
        type: "turn.finished",
        id: "turn_rows",
        stopReason: "done",
    });
    var rows = (0, src_1.projectSessionMessages)(session, { order: "asc" }).data[0].rows;
    var ids = rows.map(function (row) { return row.id; });
    (0, bun_test_1.expect)(new Set(ids).size).toBe(ids.length);
});
(0, bun_test_1.test)("message projection rejects malformed or stale opaque cursors", function () {
    var session = (0, src_1.createSessionRecord)("ses_message_cursor", "Messages");
    (0, src_1.appendSessionEvent)(session, {
        type: "turn.submitted",
        id: "turn_one",
        text: "one",
        byteLength: 3,
        lineCount: 1,
        sha256: "test",
    });
    (0, bun_test_1.expect)(function () { return (0, src_1.projectSessionMessages)(session, { cursor: "invalid" }); }).toThrow("invalid message cursor");
    (0, bun_test_1.expect)(function () {
        return (0, src_1.projectSessionMessages)(session, {
            cursor: Buffer.from(JSON.stringify({
                version: 1,
                order: "asc",
                direction: "next",
                anchor: "missing",
            })).toString("base64url"),
        });
    }).toThrow("message cursor anchor is no longer available");
});
(0, bun_test_1.test)("message projection keeps large histories within a bounded local budget", function () {
    var session = (0, src_1.createSessionRecord)("ses_large_projection", "Large projection");
    for (var index = 0; index < 1000; index++) {
        var id = "turn_".concat(index);
        (0, src_1.appendSessionEvent)(session, {
            type: "turn.submitted",
            id: id,
            text: "prompt ".concat(index),
            byteLength: 8,
            lineCount: 1,
            sha256: "fixture",
        });
        (0, src_1.appendSessionEvent)(session, {
            type: "content.done",
            id: id,
            text: "response ".concat(index),
        });
        (0, src_1.appendSessionEvent)(session, {
            type: "turn.finished",
            id: id,
            stopReason: "done",
        });
    }
    var start = performance.now();
    var page = (0, src_1.projectSessionMessages)(session, { limit: 100 });
    (0, bun_test_1.expect)(page.data).toHaveLength(100);
    (0, bun_test_1.expect)(performance.now() - start).toBeLessThan(100);
});
(0, bun_test_1.test)("projectedConstitutionRules collects rules and applies updates", function () {
    var _a, _b, _c;
    var session = (0, src_1.createSessionRecord)("ses_constitution", "Constitution");
    (0, src_1.appendSessionEvent)(session, {
        type: "constitution.rule_added",
        id: "evt_1",
        ruleID: "C-001",
        statement: "Never commit without approval",
        scope: "project",
        priority: "critical",
        source: "user",
        enforcement: "approval",
        overridePolicy: "forbidden",
    });
    (0, src_1.appendSessionEvent)(session, {
        type: "constitution.rule_added",
        id: "evt_2",
        ruleID: "C-002",
        statement: "Use TypeScript only",
        scope: "project",
        priority: "high",
        source: "master_plan",
        enforcement: "deny",
        overridePolicy: "forbidden",
    });
    var rules = (0, src_1.projectedConstitutionRules)(session.events);
    (0, bun_test_1.expect)(rules).toHaveLength(2);
    (0, bun_test_1.expect)((_a = rules[0]) === null || _a === void 0 ? void 0 : _a.ruleID).toBe("C-001");
    (0, bun_test_1.expect)((_b = rules[0]) === null || _b === void 0 ? void 0 : _b.priority).toBe("critical");
    (0, bun_test_1.expect)((_c = rules[1]) === null || _c === void 0 ? void 0 : _c.ruleID).toBe("C-002");
});
(0, bun_test_1.test)("projectedDecisionRecords collects decision records", function () {
    var _a, _b;
    var session = (0, src_1.createSessionRecord)("ses_decisions", "Decisions");
    (0, src_1.appendSessionEvent)(session, {
        type: "decision.recorded",
        id: "evt_1",
        decision: "Use TypeScript/Bun runtime only",
        rationale: ["Go fallback was removed", "TypeScript provides better DX"],
        status: "accepted",
        linkedPlans: ["natalia-engineering-intelligence-mainline"],
        linkedConstraints: ["C-002"],
    });
    var records = (0, src_1.projectedDecisionRecords)(session.events);
    (0, bun_test_1.expect)(records).toHaveLength(1);
    (0, bun_test_1.expect)((_a = records[0]) === null || _a === void 0 ? void 0 : _a.decision).toContain("TypeScript/Bun");
    (0, bun_test_1.expect)((_b = records[0]) === null || _b === void 0 ? void 0 : _b.status).toBe("accepted");
});
(0, bun_test_1.test)("projectedMailboxMessages tracks the full mailbox lifecycle", function () {
    var _a, _b, _c, _d;
    var session = (0, src_1.createSessionRecord)("ses_mailbox", "Mailbox");
    (0, src_1.appendSessionEvent)(session, {
        type: "mailbox.queued",
        id: "mailbox:1:queued",
        messageID: "mailbox:1",
        source: "user_via_live_chat",
        priority: "high",
        intent: "reprioritize",
        text: "focus on docs",
        safeSummary: "reprioritize to docs",
        deliveryPolicy: "next_safe_boundary",
        createdAt: "t0",
    });
    (0, bun_test_1.expect)((_a = (0, src_1.projectedMailboxMessages)(session.events)[0]) === null || _a === void 0 ? void 0 : _a.status).toBe("queued");
    (0, src_1.appendSessionEvent)(session, {
        type: "mailbox.deferred",
        id: "mailbox:1:deferred",
        messageID: "mailbox:1",
        reason: "unsafe boundary",
        deferredAt: "t1",
    });
    (0, bun_test_1.expect)((_b = (0, src_1.projectedMailboxMessages)(session.events)[0]) === null || _b === void 0 ? void 0 : _b.status).toBe("deferred");
    (0, bun_test_1.expect)((_c = (0, src_1.projectedMailboxMessages)(session.events)[0]) === null || _c === void 0 ? void 0 : _c.reason).toBe("unsafe boundary");
    (0, src_1.appendSessionEvent)(session, {
        type: "mailbox.superseded",
        id: "mailbox:1:superseded",
        messageID: "mailbox:1",
        reason: "newer instruction",
        supersededAt: "t2",
    });
    (0, bun_test_1.expect)((_d = (0, src_1.projectedMailboxMessages)(session.events)[0]) === null || _d === void 0 ? void 0 : _d.status).toBe("superseded");
    // A transition for an unknown message is ignored.
    (0, src_1.appendSessionEvent)(session, {
        type: "mailbox.acknowledged",
        id: "mailbox:2:ack",
        messageID: "mailbox:2",
        acknowledgedAt: "t3",
    });
    (0, bun_test_1.expect)((0, src_1.projectedMailboxMessages)(session.events)).toHaveLength(1);
});
(0, bun_test_1.test)("projectedMailboxMessages replays to the same status from replay", function () {
    var session = (0, src_1.createSessionRecord)("ses_mailbox_replay", "Mailbox");
    (0, src_1.appendSessionEvent)(session, {
        type: "mailbox.queued",
        id: "mailbox:3:queued",
        messageID: "mailbox:3",
        source: "system",
        priority: "normal",
        intent: "constraint",
        text: "never commit",
        safeSummary: "a constraint",
        deliveryPolicy: "before_next_tool",
        createdAt: "t0",
    });
    (0, src_1.appendSessionEvent)(session, {
        type: "mailbox.delivered",
        id: "mailbox:3:delivered",
        messageID: "mailbox:3",
        deliveredAt: "t1",
    });
    (0, src_1.appendSessionEvent)(session, {
        type: "mailbox.acknowledged",
        id: "mailbox:3:ack",
        messageID: "mailbox:3",
        acknowledgedAt: "t2",
    });
    // Replaying the same journal produces the same projected state.
    var projected = (0, src_1.projectedMailboxMessages)(session.events);
    (0, bun_test_1.expect)(projected[0]).toMatchObject({
        messageID: "mailbox:3",
        intent: "constraint",
        status: "acknowledged",
    });
});
(0, bun_test_1.test)("projectedCollabMessages tracks required replies and closed chat threads", function () {
    var session = (0, src_1.createSessionRecord)("ses_collab_chat", "Collaboration chat");
    (0, src_1.appendSessionEvent)(session, {
        type: "collab.chat",
        id: "collab:chat:1",
        threadID: "collab:chat:1",
        from: "main_agent",
        to: "live_chat",
        text: "Can you sanity-check this?",
        round: 1,
        expectsReply: true,
        at: "t0",
    });
    (0, src_1.appendSessionEvent)(session, {
        type: "collab.chat",
        id: "collab:chat:2",
        threadID: "collab:chat:1",
        replyToID: "collab:chat:1",
        from: "live_chat",
        to: "main_agent",
        text: "Yes. One more detail?",
        round: 2,
        expectsReply: true,
        at: "t1",
    });
    (0, src_1.appendSessionEvent)(session, {
        type: "collab.chat",
        id: "collab:chat:3",
        threadID: "collab:chat:1",
        replyToID: "collab:chat:2",
        from: "main_agent",
        to: "live_chat",
        text: "No, that closes it.",
        round: 2,
        expectsReply: false,
        at: "t2",
    });
    (0, bun_test_1.expect)((0, src_1.projectedCollabMessages)(session.events)).toEqual([
        bun_test_1.expect.objectContaining({
            id: "collab:chat:1",
            kind: "chat",
            status: "replied",
            threadID: "collab:chat:1",
            round: 1,
            expectsReply: true,
        }),
        bun_test_1.expect.objectContaining({
            id: "collab:chat:2",
            status: "replied",
            replyToID: "collab:chat:1",
            round: 2,
        }),
        bun_test_1.expect.objectContaining({
            id: "collab:chat:3",
            status: "informational",
            replyToID: "collab:chat:2",
            expectsReply: false,
        }),
    ]);
});
(0, bun_test_1.test)("projectedCollabMessages normalizes mixed and out-of-order replies", function () {
    var events = [
        {
            type: "collab.answer",
            id: "answer:1",
            questionID: "question:1",
            from: "live_chat",
            to: "main_agent",
            answer: "yes",
            at: "t1",
        },
        {
            type: "collab.question",
            id: "question:1",
            from: "main_agent",
            to: "live_chat",
            question: "safe?",
            at: "t0",
        },
        {
            type: "collab.message",
            message: {
                id: "suggestion:1",
                threadID: "suggestion:1",
                kind: "suggestion",
                from: "live_chat",
                to: "main_agent",
                text: "use echo",
                priority: "normal",
                expectsReply: true,
                at: "t2",
            },
        },
        {
            type: "collab.message",
            message: {
                id: "response:1",
                threadID: "suggestion:1",
                replyToID: "suggestion:1",
                kind: "response",
                from: "main_agent",
                to: "live_chat",
                text: "adopted",
                decision: "adopted",
                expectsReply: false,
                at: "t3",
            },
        },
    ];
    (0, bun_test_1.expect)((0, src_1.projectedCollabMessages)(events)).toEqual([
        bun_test_1.expect.objectContaining({
            id: "answer:1",
            kind: "answer",
            threadID: "question:1",
            replyToID: "question:1",
            status: "informational",
        }),
        bun_test_1.expect.objectContaining({ id: "question:1", status: "replied" }),
        bun_test_1.expect.objectContaining({ id: "suggestion:1", status: "replied" }),
        bun_test_1.expect.objectContaining({
            id: "response:1",
            kind: "response",
            decision: "adopted",
            status: "informational",
        }),
    ]);
});
(0, bun_test_1.test)("projectedCollabMessages normalizes namespaced collab events", function () {
    var events = [
        {
            type: "natalia.collab.message",
            message: {
                id: "ns:1",
                threadID: "ns:1",
                kind: "chat",
                from: "main_agent",
                to: "live_chat",
                text: "from Natalia",
                round: 1,
                expectsReply: true,
                at: "t0",
            },
        },
        {
            type: "navi.collab.message",
            message: {
                id: "ns:2",
                threadID: "ns:1",
                replyToID: "ns:1",
                kind: "chat",
                from: "live_chat",
                to: "main_agent",
                text: "from Navi",
                round: 2,
                expectsReply: false,
                at: "t1",
            },
        },
        {
            type: "nia.collab.message",
            message: {
                id: "ns:3",
                threadID: "ns:3",
                kind: "chat",
                from: "nia",
                to: "main_agent",
                text: "from Nia",
                round: 1,
                expectsReply: false,
                at: "t2",
            },
        },
    ];
    (0, bun_test_1.expect)((0, src_1.projectedCollabMessages)(events)).toEqual([
        bun_test_1.expect.objectContaining({ id: "ns:1", status: "replied" }),
        bun_test_1.expect.objectContaining({ id: "ns:2", status: "informational" }),
        bun_test_1.expect.objectContaining({
            id: "ns:3",
            from: "nia",
            status: "informational",
        }),
    ]);
});
(0, bun_test_1.test)("projectedPlanDocs tracks mark, status and deletion", function () {
    var session = (0, src_1.createSessionRecord)("ses_plan_docs", "Plan docs");
    (0, src_1.appendSessionEvent)(session, {
        type: "plan.doc.created",
        id: "plan:1:created:0",
        planID: "plan:1",
        title: "Bun-native HTTP plan",
        documentPath: ".natalia/plans/plan_1.md",
        createdBy: "live_chat",
        status: "marked",
        createdAt: "t0",
    });
    (0, bun_test_1.expect)((0, src_1.projectedPlanDocs)(session.events)[0]).toMatchObject({
        planID: "plan:1",
        documentPath: ".natalia/plans/plan_1.md",
        status: "marked",
    });
    (0, src_1.appendSessionEvent)(session, {
        type: "plan.doc.marked",
        id: "plan:1:marked:1",
        planID: "plan:1",
        markedAt: "t1",
    });
    (0, src_1.appendSessionEvent)(session, {
        type: "plan.doc.status",
        id: "plan:1:status:2",
        planID: "plan:1",
        status: "executing",
        at: "t2",
    });
    var projected = (0, src_1.projectedPlanDocs)(session.events)[0];
    (0, bun_test_1.expect)(projected === null || projected === void 0 ? void 0 : projected.markedAt).toBe("t1");
    (0, bun_test_1.expect)(projected === null || projected === void 0 ? void 0 : projected.status).toBe("executing");
    (0, src_1.appendSessionEvent)(session, {
        type: "plan.doc.deleted",
        id: "plan:1:deleted:3",
        planID: "plan:1",
        deletedAt: "t3",
    });
    (0, bun_test_1.expect)((0, src_1.projectedPlanDocs)(session.events)).toEqual([]);
});
(0, bun_test_1.test)("projectedPlanDocs ignores status events for a plan that was never created", function () {
    var session = (0, src_1.createSessionRecord)("ses_plan_docs_unknown", "Plan docs");
    (0, src_1.appendSessionEvent)(session, {
        type: "plan.doc.status",
        id: "plan:9:status:0",
        planID: "plan:9",
        status: "executing",
        at: "t0",
    });
    (0, bun_test_1.expect)((0, src_1.projectedPlanDocs)(session.events)).toEqual([]);
});
(0, bun_test_1.test)("projectedEvidenceRecords collects evidence records", function () {
    var _a, _b;
    var session = (0, src_1.createSessionRecord)("ses_evidence", "Evidence");
    (0, src_1.appendSessionEvent)(session, {
        type: "evidence.recorded",
        id: "evt_1",
        taskID: "T-001",
        objective: "Add completion evidence schema",
        status: "validated",
        knownGaps: ["Needs full integration test"],
    });
    var records = (0, src_1.projectedEvidenceRecords)(session.events);
    (0, bun_test_1.expect)(records).toHaveLength(1);
    (0, bun_test_1.expect)((_a = records[0]) === null || _a === void 0 ? void 0 : _a.taskID).toBe("T-001");
    (0, bun_test_1.expect)((_b = records[0]) === null || _b === void 0 ? void 0 : _b.status).toBe("validated");
});
(0, bun_test_1.test)("projectedWorkGraphNodes and Edges collect graph nodes", function () {
    var _a, _b;
    var session = (0, src_1.createSessionRecord)("ses_wg", "WorkGraph");
    (0, src_1.appendSessionEvent)(session, {
        type: "workgraph.node_added",
        id: "evt_1",
        nodeID: "G-001",
        kind: "goal",
        summary: "Fix empty provider response",
        sessionID: "ses_wg",
    });
    (0, src_1.appendSessionEvent)(session, {
        type: "workgraph.node_added",
        id: "evt_2",
        nodeID: "A-001",
        kind: "agent_action",
        summary: "edit-parser-fallback",
    });
    (0, src_1.appendSessionEvent)(session, {
        type: "workgraph.edge_added",
        id: "evt_3",
        sourceID: "A-001",
        targetID: "G-001",
        kind: "requested_by",
    });
    var nodes = (0, src_1.projectedWorkGraphNodes)(session.events);
    var edges = (0, src_1.projectedWorkGraphEdges)(session.events);
    (0, bun_test_1.expect)(nodes).toHaveLength(2);
    (0, bun_test_1.expect)(edges).toHaveLength(1);
    (0, bun_test_1.expect)((_a = nodes[0]) === null || _a === void 0 ? void 0 : _a.kind).toBe("goal");
    (0, bun_test_1.expect)((_b = edges[0]) === null || _b === void 0 ? void 0 : _b.kind).toBe("requested_by");
});
(0, bun_test_1.test)("projectedCapabilities tracks loaded/unloaded capabilities", function () {
    var _a, _b, _c, _d, _e;
    var session = (0, src_1.createSessionRecord)("ses_cap", "Capabilities");
    (0, src_1.appendSessionEvent)(session, {
        type: "capability.loaded",
        id: "evt_1",
        apiVersion: 1,
        name: "Test Capability",
        version: "1.0.0",
        scope: "session",
        grants: ["tools"],
    });
    var caps = (0, src_1.projectedCapabilities)(session.events);
    (0, bun_test_1.expect)(caps).toHaveLength(1);
    (0, bun_test_1.expect)((_a = caps[0]) === null || _a === void 0 ? void 0 : _a.name).toBe("Test Capability");
    (0, bun_test_1.expect)((_b = caps[0]) === null || _b === void 0 ? void 0 : _b.manifest.scope).toBe("session");
    (0, bun_test_1.expect)((_c = caps[0]) === null || _c === void 0 ? void 0 : _c.manifest.apiVersion).toBe(1);
    (0, bun_test_1.expect)((_d = caps[0]) === null || _d === void 0 ? void 0 : _d.manifest.version).toBe("1.0.0");
    (0, bun_test_1.expect)((_e = caps[0]) === null || _e === void 0 ? void 0 : _e.manifest.grants).toEqual(["tools"]);
    (0, src_1.appendSessionEvent)(session, {
        type: "capability.unloaded",
        id: "evt_1",
        name: "Test Capability",
    });
    (0, bun_test_1.expect)((0, src_1.projectedCapabilities)(session.events)).toEqual([]);
});
(0, bun_test_1.test)("projectedCapabilities keeps a removal out of the projection", function () {
    // A capability going away is not a capability being present. The projection
    // reads `loaded` only, so a removal contributes nothing.
    var session = (0, src_1.createSessionRecord)("ses_cap_unloaded", "Capabilities");
    (0, src_1.appendSessionEvent)(session, {
        type: "capability.unloaded",
        id: "evt_1",
        name: "Removed Capability",
    });
    (0, bun_test_1.expect)((0, src_1.projectedCapabilities)(session.events)).toEqual([]);
});
(0, bun_test_1.test)("projectedCanonicalTools registers and unregisters tools", function () {
    var _a, _b;
    var session = (0, src_1.createSessionRecord)("ses_treg", "ToolReg");
    (0, src_1.appendSessionEvent)(session, {
        type: "tool.registered",
        id: "evt_1",
        name: "read_file",
        owner: "natalia",
        scope: "session",
        recovery: "retry",
        precedence: 0,
        requiresApproval: false,
    });
    var tools = (0, src_1.projectedCanonicalTools)(session.events);
    (0, bun_test_1.expect)(tools).toHaveLength(1);
    (0, bun_test_1.expect)((_a = tools[0]) === null || _a === void 0 ? void 0 : _a.name).toBe("read_file");
    (0, bun_test_1.expect)((_b = tools[0]) === null || _b === void 0 ? void 0 : _b.owner).toBe("natalia");
});
(0, bun_test_1.test)("projectedDriftFindings tracks findings and status updates", function () {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
    var session = (0, src_1.createSessionRecord)("ses_drift", "Drift");
    (0, src_1.appendSessionEvent)(session, {
        type: "drift.finding_opened",
        id: "evt_1",
        findingID: "DF-001",
        severity: "warning",
        confidence: 0.75,
        originalObjective: "Fix parser",
        currentActivity: "Auth config",
        evidence: ["12 actions without parser files"],
        applicableConstraints: [],
        contractVersion: 2,
    });
    var opened = (0, src_1.projectedDriftFindings)(session.events);
    (0, bun_test_1.expect)(opened).toHaveLength(1);
    (0, bun_test_1.expect)((_a = opened[0]) === null || _a === void 0 ? void 0 : _a.severity).toBe("warning");
    (0, bun_test_1.expect)((_b = opened[0]) === null || _b === void 0 ? void 0 : _b.originalObjective).toBe("Fix parser");
    // A finding starts open, and the status is owned by the projection rather
    // than by the opening event.
    (0, bun_test_1.expect)((_c = opened[0]) === null || _c === void 0 ? void 0 : _c.status).toBe("open");
    (0, bun_test_1.expect)((_d = opened[0]) === null || _d === void 0 ? void 0 : _d.rationale).toBeUndefined();
    (0, src_1.appendSessionEvent)(session, {
        type: "drift.finding_updated",
        id: "evt_2",
        findingID: "DF-001",
        status: "explained",
        rationale: "Auth config is a prerequisite of the parser fix",
    });
    var explained = (0, src_1.projectedDriftFindings)(session.events);
    (0, bun_test_1.expect)(explained).toHaveLength(1);
    (0, bun_test_1.expect)((_e = explained[0]) === null || _e === void 0 ? void 0 : _e.status).toBe("explained");
    (0, bun_test_1.expect)((_f = explained[0]) === null || _f === void 0 ? void 0 : _f.rationale).toBe("Auth config is a prerequisite of the parser fix");
    // The opening facts survive the update.
    (0, bun_test_1.expect)((_g = explained[0]) === null || _g === void 0 ? void 0 : _g.originalObjective).toBe("Fix parser");
    (0, bun_test_1.expect)((_h = explained[0]) === null || _h === void 0 ? void 0 : _h.evidence).toEqual(["12 actions without parser files"]);
    (0, src_1.appendSessionEvent)(session, {
        type: "drift.finding_updated",
        id: "evt_3",
        findingID: "DF-001",
        status: "corrected",
    });
    var corrected = (0, src_1.projectedDriftFindings)(session.events);
    (0, bun_test_1.expect)((_j = corrected[0]) === null || _j === void 0 ? void 0 : _j.status).toBe("corrected");
    // The latest update wins, and it does not clear an earlier rationale.
    (0, bun_test_1.expect)((_k = corrected[0]) === null || _k === void 0 ? void 0 : _k.rationale).toBe("Auth config is a prerequisite of the parser fix");
});
(0, bun_test_1.test)("projectedDriftFindings ignores an update for a finding that was never opened", function () {
    var session = (0, src_1.createSessionRecord)("ses_drift_orphan", "Drift");
    (0, src_1.appendSessionEvent)(session, {
        type: "drift.finding_updated",
        id: "evt_1",
        findingID: "DF-404",
        status: "dismissed",
    });
    // An update carries no objective or evidence, so no finding can be
    // reconstructed from it.
    (0, bun_test_1.expect)((0, src_1.projectedDriftFindings)(session.events)).toEqual([]);
});
(0, bun_test_1.test)("latestSessionSnapshot returns the most recent snapshot", function () {
    var session = (0, src_1.createSessionRecord)("ses_snap", "Snapshot");
    (0, src_1.appendSessionEvent)(session, {
        type: "session.snapshot",
        id: "evt_1",
        agentStatus: "running",
        currentStep: "fix parser",
        changedFiles: 3,
        unvalidatedChanges: 1,
        hasPTY: true,
        hasSandbox: false,
    });
    var snap = (0, src_1.latestSessionSnapshot)(session.events);
    (0, bun_test_1.expect)(snap === null || snap === void 0 ? void 0 : snap.agentStatus).toBe("running");
    (0, bun_test_1.expect)(snap === null || snap === void 0 ? void 0 : snap.currentStep).toBe("fix parser");
    (0, bun_test_1.expect)(snap === null || snap === void 0 ? void 0 : snap.hasPTY).toBe(true);
});
(0, bun_test_1.test)("the Navi conversation projects messages and honours rollback boundaries", function () {
    var session = (0, src_1.createSessionRecord)("ses_chat", "Chat");
    (0, src_1.appendSessionEvent)(session, {
        type: "navi.chat.message.added",
        id: "chat:1",
        messageID: "chat:m1",
        role: "user",
        text: "what is the agent doing",
        at: "2026-08-14T00:00:00.000Z",
    });
    (0, src_1.appendSessionEvent)(session, {
        type: "navi.chat.message.added",
        id: "chat:2",
        messageID: "chat:m2",
        role: "chat",
        text: "it is running step 2 of the plan",
        at: "2026-08-14T00:00:01.000Z",
    });
    (0, src_1.appendSessionEvent)(session, {
        type: "navi.chat.message.added",
        id: "chat:3",
        messageID: "chat:m3",
        role: "user",
        text: "stop and re-plan",
        at: "2026-08-14T00:00:02.000Z",
    });
    var history = (0, src_1.projectedChatMessages)(session.events);
    (0, bun_test_1.expect)(history.map(function (message) { return message.messageID; })).toEqual([
        "chat:m1",
        "chat:m2",
        "chat:m3",
    ]);
    (0, bun_test_1.expect)(history[1]).toMatchObject({
        role: "chat",
        text: "it is running step 2 of the plan",
    });
    (0, src_1.appendSessionEvent)(session, {
        type: "navi.chat.rollback",
        id: "chat:r1",
        toMessageID: "chat:m2",
        removed: 1,
        at: "2026-08-14T00:00:03.000Z",
    });
    var after = (0, src_1.projectedChatMessages)(session.events);
    (0, bun_test_1.expect)(after.map(function (message) { return message.messageID; })).toEqual([
        "chat:m1",
        "chat:m2",
    ]);
});
(0, bun_test_1.test)("namespaced chat tool projections keep durable event ids", function () {
    var events = [
        {
            type: "navi.chat.tool.used",
            id: "chat:tool:1",
            messageID: "chat:m1",
            toolName: "read_file",
            status: "succeeded",
            summary: "first",
            at: "t1",
        },
        {
            type: "navi.chat.tool.used",
            id: "chat:tool:2",
            messageID: "chat:m1",
            toolName: "read_file",
            status: "succeeded",
            summary: "second",
            at: "t2",
        },
    ];
    (0, bun_test_1.expect)((0, src_1.projectedNaviChatMessages)(events).map(function (row) { var _a; return (_a = row.tool) === null || _a === void 0 ? void 0 : _a.eventID; })).toEqual(["chat:tool:1", "chat:tool:2"]);
});
(0, bun_test_1.test)("chat replay preserves user attachment metadata", function () {
    var _a;
    var session = (0, src_1.createSessionRecord)("ses_chat_attachment", "Chat attachment");
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
    (0, src_1.appendSessionEvent)(session, {
        type: "navi.chat.message.new",
        id: "navi:attachment:user",
        messageID: "attachment-user",
        role: "user",
        text: "see image",
        at: "2026-08-14T00:00:00.000Z",
        attachments: [attachment],
    });
    (0, bun_test_1.expect)((_a = (0, src_1.projectedNaviChatMessages)(session.events)[0]) === null || _a === void 0 ? void 0 : _a.attachments).toEqual([
        attachment,
    ]);
});
(0, bun_test_1.test)("chat replay keeps identical Navi and Nia message IDs and thinking isolated", function () {
    var session = (0, src_1.createSessionRecord)("ses_chat_namespaces", "Chat namespaces");
    (0, src_1.appendSessionEvent)(session, {
        type: "navi.chat.message.new",
        id: "navi:shared:user",
        messageID: "shared",
        role: "user",
        text: "Navi question",
        at: "2026-08-14T00:00:00.000Z",
    });
    (0, src_1.appendSessionEvent)(session, {
        type: "nia.chat.message.new",
        id: "nia:shared:user",
        messageID: "shared",
        role: "user",
        text: "Nia question",
        at: "2026-08-14T00:00:01.000Z",
    });
    (0, src_1.appendSessionEvent)(session, {
        type: "navi.chat.thinking.delta",
        id: "navi:shared:thinking:1",
        messageID: "shared",
        text: "Navi thinks. ",
    });
    (0, src_1.appendSessionEvent)(session, {
        type: "nia.chat.thinking.delta",
        id: "nia:shared:thinking:1",
        messageID: "shared",
        text: "Nia thinks. ",
    });
    (0, src_1.appendSessionEvent)(session, {
        type: "navi.chat.thinking.delta",
        id: "navi:shared:thinking:2",
        messageID: "shared",
        text: "Still Navi.",
    });
    (0, src_1.appendSessionEvent)(session, {
        type: "nia.chat.message.added",
        id: "nia:shared:chat",
        messageID: "shared",
        role: "chat",
        text: "Nia answer",
        at: "2026-08-14T00:00:02.000Z",
    });
    (0, bun_test_1.expect)((0, src_1.projectedChatMessages)(session.events)).toEqual([
        {
            messageID: "shared",
            role: "user",
            text: "Navi question",
            at: "2026-08-14T00:00:00.000Z",
            kind: "message",
        },
        {
            messageID: "shared",
            role: "user",
            text: "Nia question",
            at: "2026-08-14T00:00:01.000Z",
            kind: "message",
        },
        {
            messageID: "shared",
            role: "chat",
            text: "Navi thinks. Still Navi.",
            at: "",
            kind: "thinking",
        },
        {
            messageID: "shared",
            role: "chat",
            text: "Nia thinks. ",
            at: "",
            kind: "thinking",
        },
        {
            messageID: "shared",
            role: "chat",
            text: "Nia answer",
            at: "2026-08-14T00:00:02.000Z",
            kind: "message",
        },
    ]);
});
(0, bun_test_1.test)("projected Nia/Navi chat streams include collaboration rows by sender", function () {
    var events = [
        {
            type: "nia.collab.message",
            message: {
                id: "collab:nia:1",
                threadID: "collab:nia:1",
                kind: "chat",
                from: "nia",
                to: "main_agent",
                text: "Nia audit result",
                round: 1,
                expectsReply: false,
                at: "t1",
            },
        },
        {
            type: "natalia.collab.message",
            message: {
                id: "collab:natalia:1",
                threadID: "collab:natalia:1",
                kind: "chat",
                from: "main_agent",
                to: "nia",
                text: "Natalia reply",
                round: 1,
                expectsReply: false,
                at: "t2",
            },
        },
    ];
    (0, bun_test_1.expect)((0, src_1.projectedNiaChatMessages)(events)).toEqual([
        bun_test_1.expect.objectContaining({
            messageID: "collab:nia:1",
            role: "system",
            kind: "collab",
            text: "Nia → Natalia: Nia audit result",
        }),
    ]);
    (0, bun_test_1.expect)((0, src_1.projectedNaviChatMessages)(events)).toEqual([]);
});
(0, bun_test_1.test)("durable chat thinking replaces live deltas and restores done-only streams", function () {
    var events = [
        {
            type: "navi.chat.thinking.delta",
            id: "navi:shared:thinking:delta",
            messageID: "shared",
            text: "partial ",
        },
        {
            type: "navi.chat.thinking.done",
            id: "navi:shared:thinking:done",
            messageID: "shared",
            text: "complete Navi reasoning",
        },
        {
            type: "nia.chat.thinking.done",
            id: "nia:shared:thinking:done",
            messageID: "shared",
            text: "complete Nia reasoning",
        },
    ];
    (0, bun_test_1.expect)((0, src_1.projectedChatMessages)(events)).toEqual([
        {
            messageID: "shared",
            role: "chat",
            text: "complete Navi reasoning",
            at: "",
            kind: "thinking",
        },
        {
            messageID: "shared",
            role: "chat",
            text: "complete Nia reasoning",
            at: "",
            kind: "thinking",
        },
    ]);
});
(0, bun_test_1.test)("namespaced chat replay ignores stale channel payloads", function () {
    var events = [
        {
            type: "navi.chat.message.new",
            id: "navi:stale-channel",
            messageID: "shared",
            role: "user",
            text: "Navi remains Navi",
            at: "t1",
            channel: "nia",
        },
        {
            type: "nia.chat.thinking.delta",
            id: "nia:stale-channel",
            messageID: "shared",
            text: "Nia remains Nia",
            channel: "navi",
        },
    ];
    (0, bun_test_1.expect)((0, src_1.projectedChatMessages)(events)).toEqual([
        {
            messageID: "shared",
            role: "user",
            text: "Navi remains Navi",
            at: "t1",
            kind: "message",
        },
        {
            messageID: "shared",
            role: "chat",
            text: "Nia remains Nia",
            at: "",
            kind: "thinking",
        },
    ]);
});
(0, bun_test_1.test)("legacy persisted chat records retain isolated channel histories", function () {
    var events = [
        {
            type: "chat.message.added",
            id: "legacy:navi:user",
            messageID: "shared",
            role: "user",
            text: "Legacy Navi",
            at: "t1",
            channel: "navi",
        },
        {
            type: "chat.message.added",
            id: "legacy:nia:user",
            messageID: "shared",
            role: "user",
            text: "Legacy Nia",
            at: "t2",
            channel: "nia",
        },
        {
            type: "chat.message.added",
            id: "legacy:navi:later",
            messageID: "navi-later",
            role: "chat",
            text: "Legacy Navi later",
            at: "t3",
            channel: "navi",
        },
        {
            type: "chat.message.added",
            id: "legacy:nia:later",
            messageID: "nia-later",
            role: "chat",
            text: "Legacy Nia later",
            at: "t4",
            channel: "nia",
        },
        {
            type: "chat.rollback",
            id: "legacy:nia:rollback",
            toMessageID: "shared",
            removed: 0,
            at: "t5",
            channel: "nia",
        },
    ];
    (0, bun_test_1.expect)((0, src_1.projectedChatMessages)(events)).toEqual([
        {
            messageID: "shared",
            role: "user",
            text: "Legacy Navi",
            at: "t1",
            kind: "message",
        },
        {
            messageID: "shared",
            role: "user",
            text: "Legacy Nia",
            at: "t2",
            kind: "message",
        },
        {
            messageID: "navi-later",
            role: "chat",
            text: "Legacy Navi later",
            at: "t3",
            kind: "message",
        },
    ]);
});
(0, bun_test_1.test)("session projection carries the current goal, folded and disarmed", function () {
    var _a;
    var session = (0, src_1.createSessionRecord)("ses_goal_projection", "Goal");
    var at = "2026-01-01T00:00:00.000Z";
    var goalEvent = function (operation, revision, objective) {
        return ({
            type: "goal.changed",
            id: "goal:".concat(operation, ":").concat(revision),
            operation: operation,
            snapshot: {
                goalID: "goal_1",
                revision: revision,
                objective: objective,
                phase: "active",
                maxGoalRounds: 256,
            },
            roundsStarted: 0,
            at: at,
        });
    };
    (0, src_1.appendSessionEvent)(session, goalEvent("create", 1, "first"));
    (0, src_1.appendSessionEvent)(session, goalEvent("edit", 2, "second"));
    var goal = (0, src_1.projectSession)(session).goal;
    (0, bun_test_1.expect)(goal === null || goal === void 0 ? void 0 : goal.objective).toBe("second");
    (0, bun_test_1.expect)(goal === null || goal === void 0 ? void 0 : goal.revision).toBe(2);
    (0, bun_test_1.expect)(goal === null || goal === void 0 ? void 0 : goal.phase).toBe("active");
    (0, bun_test_1.expect)(goal === null || goal === void 0 ? void 0 : goal.activation).toBe("disarmed");
    (0, bun_test_1.expect)((_a = (0, src_1.projectedGoal)(session.events)) === null || _a === void 0 ? void 0 : _a.objective).toBe("second");
});
(0, bun_test_1.test)("projected messages include collaboration rows in event order", function () {
    var session = (0, src_1.createSessionRecord)("ses_collab_projection", "Collab");
    (0, src_1.appendSessionEvent)(session, {
        type: "turn.submitted",
        id: "turn_collab_1",
        text: "ask navi",
        byteLength: 8,
        lineCount: 1,
        sha256: "test",
    });
    (0, src_1.appendSessionEvent)(session, {
        type: "natalia.collab.message",
        message: {
            id: "collab:chat:abc:1",
            threadID: "collab:chat:abc:1",
            kind: "chat",
            from: "main_agent",
            to: "live_chat",
            text: "please review this",
            expectsReply: false,
            round: 1,
            at: "2026-01-01T00:00:00.000Z",
        },
    });
    (0, src_1.appendSessionEvent)(session, {
        type: "turn.finished",
        id: "turn_collab_1",
        stopReason: "done",
    });
    var page = (0, src_1.projectSessionMessages)(session, { order: "asc" });
    var rows = page.data.flatMap(function (message) { return message.rows; });
    var collab = rows.find(function (row) { return row.event.type === "natalia.collab.message"; });
    (0, bun_test_1.expect)(collab).toBeDefined();
    (0, bun_test_1.expect)(collab === null || collab === void 0 ? void 0 : collab.turnID).toBe("turn_collab_1");
    (0, bun_test_1.expect)(collab === null || collab === void 0 ? void 0 : collab.kind).toBe("system");
});
(0, bun_test_1.test)("message projection keeps durable content.partial rows for a killed stream", function () {
    var session = (0, src_1.createSessionRecord)("ses_partial_rows", "Partial rows");
    (0, src_1.appendSessionEvent)(session, {
        type: "turn.submitted",
        id: "turn_partial",
        text: "start",
        byteLength: 5,
        lineCount: 1,
        sha256: "test",
    });
    (0, src_1.appendSessionEvent)(session, {
        type: "content.partial",
        id: "turn_partial",
        text: "par",
        at: "2026-01-01T00:00:00.000Z",
    });
    (0, src_1.appendSessionEvent)(session, {
        type: "content.partial",
        id: "turn_partial",
        text: "tial",
        at: "2026-01-01T00:00:01.000Z",
    });
    // Killed mid-stream: there is no content.done.
    var projected = (0, src_1.projectSessionMessages)(session, { order: "asc" });
    (0, bun_test_1.expect)(projected.data.map(function (message) { return message.id; })).toEqual(["turn_partial"]);
    var rows = projected.data[0].rows;
    (0, bun_test_1.expect)(rows.filter(function (row) { return row.kind === "assistant"; })).toHaveLength(2);
    (0, bun_test_1.expect)(rows.map(function (row) { return row.event.type; })).toEqual([
        "turn.submitted",
        "content.partial",
        "content.partial",
    ]);
});
(0, bun_test_1.test)("static history restores thinking before its answer partials", function () {
    var session = (0, src_1.createSessionRecord)("ses_partial_order", "Partial order");
    (0, src_1.appendSessionEvent)(session, {
        type: "turn.submitted",
        id: "turn_partial_order",
        text: "go",
        byteLength: 2,
        lineCount: 1,
        sha256: "test",
    });
    (0, src_1.appendSessionEvent)(session, {
        type: "content.partial",
        id: "turn_partial_order",
        text: "hello ",
        at: "2026-01-01T00:00:00.000Z",
    });
    (0, src_1.appendSessionEvent)(session, {
        type: "content.partial",
        id: "turn_partial_order",
        text: "world",
        at: "2026-01-01T00:00:01.000Z",
    });
    (0, src_1.appendSessionEvent)(session, {
        type: "thinking.done",
        id: "turn_partial_order",
        text: "thought",
    });
    (0, src_1.appendSessionEvent)(session, {
        type: "content.done",
        id: "turn_partial_order",
        text: "hello world",
    });
    (0, src_1.appendSessionEvent)(session, {
        type: "turn.finished",
        id: "turn_partial_order",
        stopReason: "done",
    });
    var rows = (0, src_1.projectSessionMessages)(session, { order: "asc" }).data[0].rows;
    (0, bun_test_1.expect)(rows.map(function (row) { return row.event.type; })).toEqual([
        "turn.submitted",
        "thinking.done",
        "content.partial",
        "content.partial",
        "content.done",
        "turn.finished",
    ]);
});
(0, bun_test_1.test)("alternating reasoning and answering keeps the order the model produced", function () {
    var session = (0, src_1.createSessionRecord)("ses_partial_alternating", "Partial alternating");
    (0, src_1.appendSessionEvent)(session, {
        type: "turn.submitted",
        id: "turn_partial_alternating",
        text: "go",
        byteLength: 2,
        lineCount: 1,
        sha256: "test",
    });
    (0, src_1.appendSessionEvent)(session, {
        type: "thinking.done",
        id: "turn_partial_alternating",
        text: "first thought",
    });
    (0, src_1.appendSessionEvent)(session, {
        type: "content.partial",
        id: "turn_partial_alternating",
        text: "first answer",
        at: "2026-01-01T00:00:00.000Z",
    });
    (0, src_1.appendSessionEvent)(session, {
        type: "content.done",
        id: "turn_partial_alternating",
        text: "first answer",
    });
    (0, src_1.appendSessionEvent)(session, {
        type: "thinking.done",
        id: "turn_partial_alternating",
        text: "second thought",
    });
    (0, src_1.appendSessionEvent)(session, {
        type: "content.partial",
        id: "turn_partial_alternating",
        text: "second answer",
        at: "2026-01-01T00:00:01.000Z",
    });
    (0, src_1.appendSessionEvent)(session, {
        type: "content.done",
        id: "turn_partial_alternating",
        text: "second answer",
    });
    (0, src_1.appendSessionEvent)(session, {
        type: "turn.finished",
        id: "turn_partial_alternating",
        stopReason: "done",
    });
    var rows = (0, src_1.projectSessionMessages)(session, { order: "asc" }).data[0].rows;
    (0, bun_test_1.expect)(rows.map(function (row) { return row.event.type; })).toEqual([
        "turn.submitted",
        "thinking.done",
        "content.partial",
        "content.done",
        "thinking.done",
        "content.partial",
        "content.done",
        "turn.finished",
    ]);
});
(0, bun_test_1.test)("attempt-stamped thinking.done is not treated as historical late settlement", function () {
    var session = (0, src_1.createSessionRecord)("ses_partial_attempt_order", "Partial attempt order");
    (0, src_1.appendSessionEvent)(session, {
        type: "turn.submitted",
        id: "turn_partial_attempt_order",
        text: "go",
        byteLength: 2,
        lineCount: 1,
        sha256: "test",
    });
    (0, src_1.appendSessionEvent)(session, {
        type: "content.partial",
        id: "turn_partial_attempt_order",
        text: "answer",
        at: "2026-01-01T00:00:00.000Z",
    });
    (0, src_1.appendSessionEvent)(session, {
        type: "thinking.done",
        id: "turn_partial_attempt_order",
        text: "answer came first",
        attempt: 1,
    });
    (0, src_1.appendSessionEvent)(session, {
        type: "content.done",
        id: "turn_partial_attempt_order",
        text: "answer",
    });
    (0, src_1.appendSessionEvent)(session, {
        type: "turn.finished",
        id: "turn_partial_attempt_order",
        stopReason: "done",
    });
    var rows = (0, src_1.projectSessionMessages)(session, { order: "asc" }).data[0].rows;
    (0, bun_test_1.expect)(rows.map(function (row) { return row.event.type; })).toEqual([
        "turn.submitted",
        "content.partial",
        "thinking.done",
        "content.done",
        "turn.finished",
    ]);
});
(0, bun_test_1.test)("foldable projection unit reproduces projectSession for a mixed log", function () {
    var _a;
    var session = (0, src_1.createSessionRecord)("ses_projection_unit", "Projection Unit");
    // Completed turn with scalar selections and a tool call.
    (0, src_1.appendSessionEvent)(session, {
        type: "turn.submitted",
        id: "turn_a",
        text: "a",
        byteLength: 1,
        lineCount: 1,
        sha256: "x",
    });
    (0, src_1.appendSessionEvent)(session, {
        type: "agent.selection",
        name: "reviewer",
        pending: false,
    });
    (0, src_1.appendSessionEvent)(session, {
        type: "model.selection",
        modelID: "alpha",
        variant: "fast",
    });
    (0, src_1.appendSessionEvent)(session, {
        type: "model.reasoning.set",
        reasoningEffort: "high",
    });
    (0, src_1.appendSessionEvent)(session, {
        type: "session.permission.mode",
        mode: "auto",
        profile: "default",
    });
    (0, src_1.appendSessionEvent)(session, {
        type: "tool.update",
        id: "turn_a:call_1",
        name: "read_file",
        callID: "call_1",
        status: "succeeded",
        summary: "read",
        result: "ok",
    });
    (0, src_1.appendSessionEvent)(session, {
        type: "turn.finished",
        id: "turn_a",
        stopReason: "done",
    });
    // Interrupted turn (submitted, never finished) with its own tool output.
    (0, src_1.appendSessionEvent)(session, {
        type: "turn.submitted",
        id: "turn_b",
        text: "b",
        byteLength: 1,
        lineCount: 1,
        sha256: "y",
    });
    (0, src_1.appendSessionEvent)(session, {
        type: "tool.update",
        id: "turn_b:call_2",
        name: "read_file",
        callID: "call_2",
        status: "succeeded",
        summary: "read",
        result: "orphaned",
    });
    // A later model selection that survives (not part of the interrupted turn).
    (0, src_1.appendSessionEvent)(session, {
        type: "model.selection",
        modelID: "beta",
        variant: "careful",
    });
    // A pending input that must appear in the projection.
    (0, src_1.admitInput)(session, {
        id: "input_pending",
        text: "queued",
        delivery: "next-turn",
    });
    var full = (0, src_1.projectSession)(session);
    var folded = (0, src_1.foldProjection)(session.events, (_a = session.inbox) !== null && _a !== void 0 ? _a : []);
    (0, bun_test_1.expect)(folded).toEqual(full);
    (0, bun_test_1.expect)(folded.activeTurnIDs).toEqual(["turn_b"]);
    (0, bun_test_1.expect)(folded.completedTurnIDs).toEqual(["turn_a"]);
    (0, bun_test_1.expect)(folded.selectedModel).toEqual({ modelID: "beta", variant: "careful" });
    (0, bun_test_1.expect)(folded.pendingInputs.map(function (input) { return input.id; })).toEqual([
        "input_pending",
    ]);
});
(0, bun_test_1.test)("foldable projection unit folds a goal incrementally to the same view", function () {
    var _a;
    var session = (0, src_1.createSessionRecord)("ses_projection_goal", "Projection Goal");
    (0, src_1.appendSessionEvent)(session, {
        type: "turn.submitted",
        id: "turn_g",
        text: "g",
        byteLength: 1,
        lineCount: 1,
        sha256: "x",
    });
    (0, src_1.appendSessionEvent)(session, {
        type: "goal.changed",
        id: "goal:create:1",
        operation: "create",
        at: "2026-01-01T00:00:00.000Z",
        roundsStarted: 0,
        snapshot: {
            goalID: "goal_1",
            revision: 1,
            objective: "ship the thing",
            phase: "active",
            maxGoalRounds: 0,
            maxGoalTokens: 0,
            maxGoalWallClockMs: 0,
            spentGoalTokens: 0,
            goalWallClockMs: 0,
        },
    });
    (0, src_1.appendSessionEvent)(session, {
        type: "goal.round",
        id: "goal:round:1",
        goalID: "goal_1",
        revision: 1,
        round: 1,
        at: "2026-01-01T00:01:00.000Z",
    });
    (0, src_1.appendSessionEvent)(session, {
        type: "turn.finished",
        id: "turn_g",
        stopReason: "done",
    });
    (0, bun_test_1.expect)((0, src_1.foldProjection)(session.events)).toEqual((0, src_1.projectSession)(session));
    (0, bun_test_1.expect)((_a = (0, src_1.foldProjection)(session.events).goal) === null || _a === void 0 ? void 0 : _a.roundsStarted).toBe(1);
});
(0, bun_test_1.test)("deserializeProjectionState round-trips a serialized state", function () {
    var state = {
        version: 1,
        events: [],
        activeTurnIDs: new Set(["turn_1"]),
        completedTurnIDs: new Set(),
    };
    var restored = (0, src_1.deserializeProjectionState)(JSON.stringify({
        version: 1,
        events: [],
        activeTurnIDs: ["turn_1"],
        completedTurnIDs: [],
    }));
    (0, bun_test_1.expect)(restored === null || restored === void 0 ? void 0 : restored.activeTurnIDs).toEqual(new Set(["turn_1"]));
    (0, bun_test_1.expect)(restored === null || restored === void 0 ? void 0 : restored.completedTurnIDs).toEqual(new Set());
    // absent set fields are tolerated (default empty)
    var partial = (0, src_1.deserializeProjectionState)(JSON.stringify({ version: 1, events: [] }));
    (0, bun_test_1.expect)(partial === null || partial === void 0 ? void 0 : partial.activeTurnIDs).toEqual(new Set());
});
(0, bun_test_1.test)("deserializeProjectionState fails soft on a non-array set field instead of throwing", function () {
    // A same-version, valid-JSON payload whose activeTurnIDs is not an array must
    // be discarded (recovery falls back to a full projection), never crash on
    // `new Set(nonIterable)`.
    for (var _i = 0, _a = [5, { a: 1 }, true]; _i < _a.length; _i++) {
        var bad = _a[_i];
        var json = JSON.stringify({ version: 1, events: [], activeTurnIDs: bad });
        (0, bun_test_1.expect)((0, src_1.deserializeProjectionState)(json)).toBeUndefined();
    }
    var badCompleted = JSON.stringify({
        version: 1,
        events: [],
        completedTurnIDs: "nope",
    });
    (0, bun_test_1.expect)((0, src_1.deserializeProjectionState)(badCompleted)).toBeUndefined();
});
