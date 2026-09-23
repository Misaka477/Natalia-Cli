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
var promises_1 = require("node:fs/promises");
var node_fs_1 = require("node:fs");
var node_path_1 = require("node:path");
var node_os_1 = require("node:os");
var bun_test_1 = require("bun:test");
var src_1 = require("../src");
var src_2 = require("../src");
(0, bun_test_1.test)("SQLite auto titles preserve manual titles and unrelated metadata", function () {
    var path = (0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-title-".concat(crypto.randomUUID(), ".db"));
    var store = new src_1.SqliteSessionStore(path);
    var sessionID = "ses_title";
    try {
        store.create(sessionID, "New session");
        store.updateMetadata(sessionID, {
            pinned: true,
            lastAccessedAt: "2026-08-17T00:00:00.000Z",
        });
        store.setAutoTitle(sessionID, "Generated title", "generated");
        (0, bun_test_1.expect)(store.get(sessionID)).toMatchObject({
            title: "Generated title",
            metadata: {
                titleSource: "generated",
                pinned: true,
                lastAccessedAt: "2026-08-17T00:00:00.000Z",
            },
        });
        store.rename(sessionID, "Manual title");
        store.setAutoTitle(sessionID, "Delayed title", "generated");
        (0, bun_test_1.expect)(store.get(sessionID)).toMatchObject({
            title: "Manual title",
            metadata: {
                titleSource: "manual",
                pinned: true,
                lastAccessedAt: "2026-08-17T00:00:00.000Z",
            },
        });
    }
    finally {
        store.close();
    }
});
(0, bun_test_1.test)("SQLite session history uses stable sequence cursors", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, store, _i, _a, id, first, second;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-sqlite-history-"))];
            case 1:
                root = _b.sent();
                store = new src_1.SqliteSessionStore((0, node_path_1.join)(root, "sessions.db"));
                store.create("ses_history", "History");
                for (_i = 0, _a = ["one", "two", "three"]; _i < _a.length; _i++) {
                    id = _a[_i];
                    store.appendEvent("ses_history", {
                        type: "turn.submitted",
                        id: id,
                        text: id,
                        byteLength: id.length,
                        lineCount: 1,
                        sha256: "test",
                    });
                }
                first = store.loadEventPage("ses_history", { limit: 2 });
                (0, bun_test_1.expect)(first.events.map(function (item) { return item.seq; })).toEqual([1, 2]);
                (0, bun_test_1.expect)(first.hasMore).toBe(true);
                second = store.loadEventPage("ses_history", {
                    after: first.events[1].seq,
                    limit: 2,
                });
                (0, bun_test_1.expect)(second.events.map(function (item) { return item.seq; })).toEqual([3]);
                (0, bun_test_1.expect)(second.hasMore).toBe(false);
                store.close();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("SQLite message pages use turn cursors without loading unrelated history", function () {
    var _a;
    var path = (0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-message-page-".concat(crypto.randomUUID(), ".db"));
    var store = new src_1.SqliteSessionStore(path);
    var sessionID = "ses_message_page";
    try {
        store.create(sessionID, "Message page");
        for (var _i = 0, _b = ["turn_one", "turn_two", "turn_three"]; _i < _b.length; _i++) {
            var id = _b[_i];
            store.appendEvents(sessionID, [
                {
                    type: "turn.submitted",
                    id: id,
                    text: id,
                    byteLength: id.length,
                    lineCount: 1,
                    sha256: "fixture",
                },
                { type: "content.done", id: id, text: "".concat(id, " response") },
                { type: "turn.finished", id: id, stopReason: "done" },
            ]);
        }
        var first = store.loadMessagePage(sessionID, { order: "asc", limit: 2 });
        (0, bun_test_1.expect)(first.data.map(function (message) { return message.id; })).toEqual([
            "turn_one",
            "turn_two",
        ]);
        (0, bun_test_1.expect)((_a = first.data[0]) === null || _a === void 0 ? void 0 : _a.rows.map(function (row) { return row.kind; })).toEqual([
            "user",
            "assistant",
            "system",
        ]);
        (0, bun_test_1.expect)(first.cursor.next).toEqual(bun_test_1.expect.any(String));
        var next = store.loadMessagePage(sessionID, {
            cursor: first.cursor.next,
        });
        (0, bun_test_1.expect)(next.data.map(function (message) { return message.id; })).toEqual(["turn_three"]);
        (0, bun_test_1.expect)(next.cursor.previous).toEqual(bun_test_1.expect.any(String));
        var previous = store.loadMessagePage(sessionID, {
            cursor: next.cursor.previous,
            limit: 2,
        });
        (0, bun_test_1.expect)(previous.data.map(function (message) { return message.id; })).toEqual([
            "turn_one",
            "turn_two",
        ]);
        var latest = store.loadMessagePage(sessionID, { limit: 2 });
        (0, bun_test_1.expect)(latest.data.map(function (message) { return message.id; })).toEqual([
            "turn_three",
            "turn_two",
        ]);
        var older = store.loadMessagePage(sessionID, {
            cursor: latest.cursor.next,
            limit: 2,
        });
        (0, bun_test_1.expect)(older.data.map(function (message) { return message.id; })).toEqual(["turn_one"]);
    }
    finally {
        store.close();
        (0, node_fs_1.rmSync)(path, { force: true });
        (0, node_fs_1.rmSync)("".concat(path, "-wal"), { force: true });
        (0, node_fs_1.rmSync)("".concat(path, "-shm"), { force: true });
    }
});
(0, bun_test_1.test)("SQLite descending message pages keep turn.input with its owning turn", function () {
    var path = (0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-message-input-".concat(crypto.randomUUID(), ".db"));
    var store = new src_1.SqliteSessionStore(path);
    var sessionID = "ses_message_input";
    try {
        store.create(sessionID, "Message input page");
        for (var _i = 0, _a = ["turn_one", "turn_two", "turn_three"]; _i < _a.length; _i++) {
            var id = _a[_i];
            store.appendEvents(sessionID, __spreadArray(__spreadArray([
                {
                    type: "turn.submitted",
                    id: id,
                    text: id,
                    byteLength: id.length,
                    lineCount: 1,
                    sha256: "fixture",
                }
            ], (id === "turn_two"
                ? [
                    {
                        type: "turn.input",
                        turnID: id,
                        inputID: "input_two",
                        text: "steer turn two",
                        delivery: "next-step",
                    },
                ]
                : []), true), [
                { type: "content.done", id: id, text: "".concat(id, " response") },
                { type: "turn.finished", id: id, stopReason: "done" },
            ], false));
        }
        var page_1 = store.loadMessagePage(sessionID, { limit: 3 });
        (0, bun_test_1.expect)(page_1.data.map(function (message) { return message.id; })).toEqual([
            "turn_three",
            "turn_two",
            "turn_one",
        ]);
        var rowsFor = function (turnID) {
            var _a, _b;
            return (_b = (_a = page_1.data
                .find(function (message) { return message.id === turnID; })) === null || _a === void 0 ? void 0 : _a.rows.map(function (row) { return row.event; }).filter(function (event) { return event.type === "turn.input"; })) !== null && _b !== void 0 ? _b : [];
        };
        (0, bun_test_1.expect)(rowsFor("turn_one")).toEqual([]);
        (0, bun_test_1.expect)(rowsFor("turn_two")).toEqual([
            {
                type: "turn.input",
                turnID: "turn_two",
                inputID: "input_two",
                text: "steer turn two",
                delivery: "next-step",
            },
        ]);
        (0, bun_test_1.expect)(rowsFor("turn_three")).toEqual([]);
    }
    finally {
        store.close();
        (0, node_fs_1.rmSync)(path, { force: true });
        (0, node_fs_1.rmSync)("".concat(path, "-wal"), { force: true });
        (0, node_fs_1.rmSync)("".concat(path, "-shm"), { force: true });
    }
});
(0, bun_test_1.test)("SQLite message pages match the event-stream projector", function () {
    var path = (0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-message-parity-".concat(crypto.randomUUID(), ".db"));
    var store = new src_1.SqliteSessionStore(path);
    var sessionID = "ses_message_parity";
    try {
        store.create(sessionID, "Message parity");
        for (var _i = 0, _a = ["turn_one", "turn_two", "turn_three"]; _i < _a.length; _i++) {
            var id = _a[_i];
            store.appendEvents(sessionID, __spreadArray(__spreadArray([
                {
                    type: "turn.submitted",
                    id: id,
                    text: id,
                    byteLength: id.length,
                    lineCount: 1,
                    sha256: "fixture",
                }
            ], (id === "turn_two"
                ? [
                    {
                        type: "turn.input",
                        turnID: id,
                        inputID: "input_two",
                        text: "steer two",
                        delivery: "next-step",
                    },
                ]
                : []), true), [
                { type: "content.done", id: id, text: "".concat(id, " answer") },
                { type: "turn.finished", id: id, stopReason: "done" },
            ], false));
        }
        var events = store.loadEvents(sessionID);
        for (var _b = 0, _c = ["asc", "desc"]; _b < _c.length; _b++) {
            var order = _c[_b];
            var sqlite = store.loadMessagePage(sessionID, { order: order, limit: 3 });
            var projected = (0, src_1.projectSessionMessages)({
                id: sessionID,
                title: "",
                createdAt: "",
                events: events,
                cancelled: false,
                resumable: true,
            }, { order: order, limit: 3 });
            (0, bun_test_1.expect)(sqlite).toEqual(projected);
        }
    }
    finally {
        store.close();
        (0, node_fs_1.rmSync)(path, { force: true });
        (0, node_fs_1.rmSync)("".concat(path, "-wal"), { force: true });
        (0, node_fs_1.rmSync)("".concat(path, "-shm"), { force: true });
    }
});
(0, bun_test_1.test)("SQLite context epoch tracks checkpoint baseline sequence", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, store;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-sqlite-context-epoch-"))];
            case 1:
                root = _a.sent();
                store = new src_1.SqliteSessionStore((0, node_path_1.join)(root, "sessions.db"));
                store.create("ses_epoch", "Epoch");
                store.appendEvent("ses_epoch", {
                    type: "context.checkpoint",
                    id: "epoch_one",
                    snapshot: {
                        entries: [{ id: "user", role: "user", content: "hello" }],
                        resources: [],
                        journalOffset: 1,
                        step: 1,
                        tokenEstimate: 2,
                        compactionGeneration: 0,
                    },
                });
                store.appendEvent("ses_epoch", {
                    type: "turn.finished",
                    id: "turn_one",
                    stopReason: "done",
                });
                (0, bun_test_1.expect)(store.loadContextEpoch("ses_epoch")).toEqual({
                    baselineSeq: 1,
                    snapshot: {
                        entries: [{ id: "user", role: "user", content: "hello" }],
                        resources: [],
                        journalOffset: 1,
                        step: 1,
                        tokenEstimate: 2,
                        compactionGeneration: 0,
                    },
                });
                store.close();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("SQLite compaction removes live-only and epoch-superseded events", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, store, sessionID, events;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-sqlite-compact-"))];
            case 1:
                root = _a.sent();
                store = new src_1.SqliteSessionStore((0, node_path_1.join)(root, "sessions.db"));
                sessionID = "ses_compact";
                try {
                    store.create(sessionID, "Compact");
                    store.appendEvents(sessionID, [
                        {
                            type: "session.snapshot",
                            id: "snap_one",
                            agentStatus: "idle",
                            changedFiles: 0,
                            unvalidatedChanges: 0,
                            hasPTY: false,
                            hasSandbox: false,
                        },
                        {
                            type: "rollback.previewed",
                            preview: {
                                checkpointID: "checkpoint_one",
                                dryRun: true,
                                changes: [],
                                context: {
                                    truncateMessages: 0,
                                    targetJournalOffset: 0,
                                    targetStep: 0,
                                    targetTokens: 0,
                                    compactionGeneration: 0,
                                },
                                resources: [],
                                ignoredFiles: 0,
                                diskUsageBytes: 0,
                                complete: true,
                                warnings: [],
                            },
                        },
                        {
                            type: "context.checkpoint",
                            id: "epoch_one",
                            snapshot: {
                                entries: [{ id: "user", role: "user", content: "hello" }],
                                resources: [],
                                journalOffset: 1,
                                step: 1,
                                tokenEstimate: 2,
                                compactionGeneration: 0,
                            },
                        },
                        { type: "turn.finished", id: "turn_one", stopReason: "done" },
                    ]);
                    store.writeContextEpoch(sessionID, {
                        entries: [{ id: "user", role: "user", content: "hello" }],
                        resources: [],
                        journalOffset: 1,
                        step: 1,
                        tokenEstimate: 2,
                        compactionGeneration: 0,
                    });
                    (0, bun_test_1.expect)(store.compactHistoricalEvents()).toContain(sessionID);
                    events = store.loadEvents(sessionID);
                    (0, bun_test_1.expect)(events.some(function (event) { return event.type === "session.snapshot"; })).toBe(false);
                    (0, bun_test_1.expect)(events.some(function (event) { return event.type === "rollback.previewed"; })).toBe(false);
                    (0, bun_test_1.expect)(events.some(function (event) { return event.type === "context.checkpoint"; })).toBe(false);
                    (0, bun_test_1.expect)(events.some(function (event) { return event.type === "turn.finished"; })).toBe(true);
                }
                finally {
                    store.close();
                }
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("SQLite recovery projection tracks durable control state and backfills history", function () {
    var _a, _b;
    var path = (0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-recovery-".concat(crypto.randomUUID(), ".db"));
    var store = new src_1.SqliteSessionStore(path);
    var sessionID = "ses_recovery";
    try {
        store.create(sessionID, "Recovery");
        store.appendEvents(sessionID, [
            {
                type: "agent.selection",
                name: "reviewer",
                pending: false,
            },
            { type: "model.selection", modelID: "model-a", variant: "fast" },
            {
                type: "turn.submitted",
                id: "turn_active",
                text: "active",
                byteLength: 6,
                lineCount: 1,
                sha256: "fixture",
                attachments: [
                    {
                        id: "attachment_one",
                        path: "/tmp/one.txt",
                        filename: "one.txt",
                        mediaType: "text/plain",
                        byteLength: 1,
                        sha256: "fixture",
                    },
                ],
            },
            {
                type: "approval.request",
                id: "turn_active:approval",
                title: "Approve",
                preview: "fixture",
            },
            {
                type: "question.request",
                id: "turn_active:question",
                title: "Question",
                questions: [],
            },
        ]);
        var projection = store.loadRecoveryProjection(sessionID);
        (0, bun_test_1.expect)(projection.activeTurnIDs).toEqual(["turn_active"]);
        (0, bun_test_1.expect)(projection.approvals).toHaveLength(1);
        (0, bun_test_1.expect)(projection.questions).toHaveLength(1);
        (0, bun_test_1.expect)(projection.selectedAgent).toBe("reviewer");
        (0, bun_test_1.expect)(projection.selectedModel).toEqual({
            modelID: "model-a",
            variant: "fast",
        });
        (0, bun_test_1.expect)((_b = (_a = projection.attachments.get("turn_active")) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.filename).toBe("one.txt");
        store.appendEvents(sessionID, [
            {
                type: "approval.response",
                id: "turn_active:approval",
                decision: "once",
            },
            { type: "question.response", id: "turn_active:question", answers: [] },
            { type: "turn.finished", id: "turn_active", stopReason: "done" },
        ]);
        var settled = store.loadRecoveryProjection(sessionID);
        (0, bun_test_1.expect)(settled.activeTurnIDs).toEqual([]);
        (0, bun_test_1.expect)(settled.approvals).toEqual([]);
        (0, bun_test_1.expect)(settled.questions).toEqual([]);
    }
    finally {
        store.close();
        (0, node_fs_1.rmSync)(path, { force: true });
        (0, node_fs_1.rmSync)("".concat(path, "-wal"), { force: true });
        (0, node_fs_1.rmSync)("".concat(path, "-shm"), { force: true });
    }
});
(0, bun_test_1.test)("SQLite recovery projection keeps the latest bounded diagnostics", function () {
    var _a, _b;
    var path = (0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-diagnostics-".concat(crypto.randomUUID(), ".db"));
    var store = new src_1.SqliteSessionStore(path);
    var sessionID = "ses_diagnostics";
    try {
        store.create(sessionID, "Diagnostics");
        store.appendEvents(sessionID, Array.from({ length: 505 }, function (_, index) { return ({
            type: "diagnostic",
            level: "info",
            message: "diagnostic ".concat(index),
            at: "2026-07-25T00:00:00.000Z",
        }); }));
        var diagnostics = store.loadRecoveryProjection(sessionID).diagnostics;
        (0, bun_test_1.expect)(diagnostics).toHaveLength(500);
        (0, bun_test_1.expect)((_a = diagnostics[0]) === null || _a === void 0 ? void 0 : _a.message).toBe("diagnostic 5");
        (0, bun_test_1.expect)((_b = diagnostics.at(-1)) === null || _b === void 0 ? void 0 : _b.message).toBe("diagnostic 504");
    }
    finally {
        store.close();
        (0, node_fs_1.rmSync)(path, { force: true });
        (0, node_fs_1.rmSync)("".concat(path, "-wal"), { force: true });
        (0, node_fs_1.rmSync)("".concat(path, "-shm"), { force: true });
    }
});
(0, bun_test_1.test)("SQLite attachment references include history and pending input attachments", function () {
    var path = (0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-attachments-".concat(crypto.randomUUID(), ".db"));
    var store = new src_1.SqliteSessionStore(path);
    var session = (0, src_2.createSessionRecord)("ses_attachments", "Attachments");
    var historyAttachment = {
        id: "att_history",
        path: ".natalia/attachments/att_history-history.txt",
        filename: "history.txt",
        mediaType: "text/plain",
        byteLength: 1,
        sha256: "history",
    };
    var inputAttachment = {
        id: "att_input",
        path: ".natalia/attachments/att_input-input.txt",
        filename: "input.txt",
        mediaType: "text/plain",
        byteLength: 1,
        sha256: "input",
    };
    session.events.push({
        type: "turn.submitted",
        id: "turn_history",
        text: "history",
        byteLength: 7,
        lineCount: 1,
        sha256: "fixture",
        attachments: [historyAttachment],
    });
    session.inbox = [
        {
            id: "turn_input",
            sessionID: session.id,
            text: "input",
            attachments: [inputAttachment],
            delivery: "next-turn",
            admittedAt: "2026-07-25T00:00:00.000Z",
            admittedSeq: 1,
        },
    ];
    try {
        store.replace(session);
        (0, bun_test_1.expect)(store.referencedAttachments().map(function (attachment) { return attachment.id; })).toEqual(bun_test_1.expect.arrayContaining(["att_history", "att_input"]));
    }
    finally {
        store.close();
        (0, node_fs_1.rmSync)(path, { force: true });
        (0, node_fs_1.rmSync)("".concat(path, "-wal"), { force: true });
        (0, node_fs_1.rmSync)("".concat(path, "-shm"), { force: true });
    }
});
(0, bun_test_1.test)("SQLite session replacement preserves duplicate history and metadata", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, store, session;
    var _a, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-sqlite-replace-"))];
            case 1:
                root = _c.sent();
                store = new src_1.SqliteSessionStore((0, node_path_1.join)(root, "sessions.db"));
                session = (0, src_2.createSessionRecord)("ses_copy", "Copy");
                session.metadata = {
                    pinned: true,
                    lastAccessedAt: "2026-07-22T00:00:00.000Z",
                };
                session.events.push({
                    type: "turn.submitted",
                    id: "turn_copy",
                    text: "hello",
                    byteLength: 5,
                    lineCount: 1,
                    sha256: "test",
                });
                store.replace(session);
                (0, bun_test_1.expect)((_a = store.get("ses_copy")) === null || _a === void 0 ? void 0 : _a.pinned).toBe(true);
                (0, bun_test_1.expect)(store.eventCount("ses_copy")).toBe(1);
                store.updateMetadata("ses_copy", { pinned: false });
                (0, bun_test_1.expect)((_b = store.get("ses_copy")) === null || _b === void 0 ? void 0 : _b.pinned).toBe(false);
                store.delete("ses_copy");
                (0, bun_test_1.expect)(store.get("ses_copy")).toBeUndefined();
                (0, bun_test_1.expect)(store.loadEvents("ses_copy")).toEqual([]);
                (0, bun_test_1.expect)(store.loadContextEpoch("ses_copy")).toBeUndefined();
                store.close();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("SQLite session records retain inbox through duplicate and fork", function () {
    var root = (0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-sqlite-inbox-".concat(crypto.randomUUID(), ".db"));
    var store = new src_1.SqliteSessionStore(root);
    var session = (0, src_2.createSessionRecord)("ses_inbox", "Inbox");
    session.events.push({
        type: "turn.submitted",
        id: "turn_one",
        text: "one",
        byteLength: 3,
        lineCount: 1,
        sha256: "fixture",
    }, {
        type: "turn.submitted",
        id: "turn_two",
        text: "two",
        byteLength: 3,
        lineCount: 1,
        sha256: "fixture",
    });
    session.inbox = [
        {
            id: "turn_one",
            sessionID: session.id,
            text: "one",
            delivery: "next-step",
            admittedAt: "2026-07-25T00:00:00.000Z",
            admittedSeq: 1,
            promotedAt: "2026-07-25T00:00:01.000Z",
            promotedSeq: 1,
        },
        {
            id: "turn_two",
            sessionID: session.id,
            text: "two",
            delivery: "next-turn",
            admittedAt: "2026-07-25T00:00:02.000Z",
            admittedSeq: 2,
        },
    ];
    try {
        store.replace(session);
        (0, bun_test_1.expect)(store.pendingInputCount(session.id)).toBe(1);
        (0, bun_test_1.expect)(store.duplicate(session.id, "ses_inbox_copy").inbox).toEqual(bun_test_1.expect.arrayContaining([
            bun_test_1.expect.objectContaining({ sessionID: "ses_inbox_copy" }),
        ]));
        (0, bun_test_1.expect)(store.fork(session.id, "turn_two", "ses_inbox_fork").inbox).toEqual([
            bun_test_1.expect.objectContaining({ id: "turn_one", sessionID: "ses_inbox_fork" }),
        ]);
    }
    finally {
        store.close();
        (0, node_fs_1.rmSync)(root, { force: true, recursive: true });
        (0, node_fs_1.rmSync)("".concat(root, "-wal"), { force: true });
        (0, node_fs_1.rmSync)("".concat(root, "-shm"), { force: true });
    }
});
(0, bun_test_1.test)("SQLite delete removes message index state before session row", function () {
    var path = (0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-message-index-delete-".concat(crypto.randomUUID(), ".db"));
    var store = new src_1.SqliteSessionStore(path);
    var sessionID = "ses_delete_index";
    try {
        store.create(sessionID, "Delete with message index");
        store.appendEvent(sessionID, {
            type: "turn.submitted",
            id: "turn_delete",
            text: "hello",
            byteLength: 5,
            lineCount: 1,
            sha256: "test",
        });
        store.loadMessagePage(sessionID, {});
        store.delete(sessionID);
        (0, bun_test_1.expect)(store.get(sessionID)).toBeUndefined();
        (0, bun_test_1.expect)(store.wasDeleted(sessionID)).toBe(true);
        store.create(sessionID, "Recreated");
        (0, bun_test_1.expect)(store.wasDeleted(sessionID)).toBe(false);
    }
    finally {
        store.close();
    }
});
(0, bun_test_1.test)("SQLite truncateAfter removes events and message turn suffixes", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, store, sessionID;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-sqlite-truncate-after-"))];
            case 1:
                root = _a.sent();
                store = new src_1.SqliteSessionStore((0, node_path_1.join)(root, "sessions.db"));
                sessionID = "ses_truncate";
                try {
                    store.create(sessionID, "Truncate");
                    store.appendEvents(sessionID, [
                        {
                            type: "turn.submitted",
                            id: "turn_one",
                            text: "one",
                            byteLength: 3,
                            lineCount: 1,
                            sha256: "test",
                        },
                        {
                            type: "turn.finished",
                            id: "turn_one",
                            stopReason: "done",
                        },
                        {
                            type: "turn.submitted",
                            id: "turn_two",
                            text: "two",
                            byteLength: 3,
                            lineCount: 1,
                            sha256: "test",
                        },
                    ]);
                    store.truncateAfter(sessionID, 2);
                    (0, bun_test_1.expect)(store.loadEvents(sessionID).map(function (event) { return event.type; })).toEqual([
                        "turn.submitted",
                        "turn.finished",
                    ]);
                    (0, bun_test_1.expect)(store.loadMessagePage(sessionID, {}).data.length).toBe(1);
                }
                finally {
                    store.close();
                    (0, node_fs_1.rmSync)(root, { force: true, recursive: true });
                    (0, node_fs_1.rmSync)("".concat(root, "-wal"), { force: true });
                    (0, node_fs_1.rmSync)("".concat(root, "-shm"), { force: true });
                }
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("SQLite enforces session foreign keys", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, store;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-sqlite-foreign-keys-"))];
            case 1:
                root = _a.sent();
                store = new src_1.SqliteSessionStore((0, node_path_1.join)(root, "sessions.db"));
                (0, bun_test_1.expect)(function () {
                    return store.appendEvent("ses_missing", {
                        type: "turn.finished",
                        id: "turn_missing",
                        stopReason: "done",
                    });
                }).toThrow();
                store.close();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("SQLite batches async durable appends and flushes settlement barriers", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, store, sessionID;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-sqlite-async-batch-"))];
            case 1:
                root = _a.sent();
                store = new src_1.SqliteSessionStore((0, node_path_1.join)(root, "sessions.db"));
                sessionID = "ses_async_batch";
                _a.label = 2;
            case 2:
                _a.trys.push([2, , 5, 6]);
                store.create(sessionID, "async batch");
                store.enqueueEvent(sessionID, {
                    type: "turn.submitted",
                    id: "turn_async",
                    text: "hello",
                    byteLength: 5,
                    lineCount: 1,
                    sha256: "test",
                });
                store.enqueueEvent(sessionID, {
                    type: "status.update",
                    status: "working",
                });
                return [4 /*yield*/, store.flushPendingWrites(sessionID)];
            case 3:
                _a.sent();
                (0, bun_test_1.expect)(store.loadEvents(sessionID).map(function (event) { return event.type; })).toEqual([
                    "turn.submitted",
                    "status.update",
                ]);
                return [4 /*yield*/, store.appendEventAsync(sessionID, {
                        type: "turn.finished",
                        id: "turn_async",
                        stopReason: "done",
                    })];
            case 4:
                _a.sent();
                (0, bun_test_1.expect)(store.loadRecoveryProjection(sessionID).activeTurnIDs).toEqual([]);
                (0, bun_test_1.expect)(store.loadEvents(sessionID)).toHaveLength(3);
                return [3 /*break*/, 6];
            case 5:
                store.close();
                (0, node_fs_1.rmSync)(root, { force: true, recursive: true });
                (0, node_fs_1.rmSync)("".concat(root, "-wal"), { force: true });
                (0, node_fs_1.rmSync)("".concat(root, "-shm"), { force: true });
                return [7 /*endfinally*/];
            case 6: return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("SQLite close flushes queued async durable appends", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, path, sessionID, store, reopened;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-sqlite-close-flush-"))];
            case 1:
                root = _a.sent();
                path = (0, node_path_1.join)(root, "sessions.db");
                sessionID = "ses_close_flush";
                store = new src_1.SqliteSessionStore(path);
                store.create(sessionID, "close flush");
                store.enqueueEvent(sessionID, {
                    type: "turn.submitted",
                    id: "turn_close",
                    text: "persist me",
                    byteLength: 10,
                    lineCount: 1,
                    sha256: "test",
                });
                store.close();
                reopened = new src_1.SqliteSessionStore(path);
                try {
                    (0, bun_test_1.expect)(reopened.loadEvents(sessionID)).toEqual([
                        bun_test_1.expect.objectContaining({ type: "turn.submitted", id: "turn_close" }),
                    ]);
                }
                finally {
                    reopened.close();
                    (0, node_fs_1.rmSync)(root, { force: true, recursive: true });
                    (0, node_fs_1.rmSync)("".concat(root, "-wal"), { force: true });
                    (0, node_fs_1.rmSync)("".concat(root, "-shm"), { force: true });
                }
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("SQLite batch barriers survive reopen without waiting for the timer", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, path, sessionID, store, reopened;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-sqlite-barrier-reopen-"))];
            case 1:
                root = _a.sent();
                path = (0, node_path_1.join)(root, "sessions.db");
                sessionID = "ses_barrier_reopen";
                store = new src_1.SqliteSessionStore(path);
                store.create(sessionID, "barrier reopen");
                store.enqueueEvent(sessionID, {
                    type: "turn.submitted",
                    id: "turn_barrier",
                    text: "durable before settlement",
                    byteLength: 25,
                    lineCount: 1,
                    sha256: "test",
                });
                store.enqueueEvent(sessionID, {
                    type: "turn.finished",
                    id: "turn_barrier",
                    stopReason: "done",
                });
                return [4 /*yield*/, store.flushPendingWrites(sessionID)];
            case 2:
                _a.sent();
                store.close();
                reopened = new src_1.SqliteSessionStore(path);
                try {
                    (0, bun_test_1.expect)(reopened.loadEvents(sessionID).map(function (event) { return event.type; })).toEqual([
                        "turn.submitted",
                        "turn.finished",
                    ]);
                    (0, bun_test_1.expect)(reopened.loadRecoveryProjection(sessionID).activeTurnIDs).toEqual([]);
                }
                finally {
                    reopened.close();
                    (0, node_fs_1.rmSync)(root, { force: true, recursive: true });
                }
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("SQLite passive checkpoint preserves event reads", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, store;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-sqlite-checkpoint-"))];
            case 1:
                root = _a.sent();
                store = new src_1.SqliteSessionStore((0, node_path_1.join)(root, "sessions.db"));
                try {
                    store.create("ses_checkpoint", "checkpoint");
                    store.appendEvent("ses_checkpoint", {
                        type: "diagnostic",
                        level: "info",
                        message: "checkpoint me",
                        at: "2026-07-25T00:00:00.000Z",
                    });
                    (0, bun_test_1.expect)(store.checkpoint()).toMatchObject({ busy: bun_test_1.expect.any(Number) });
                    (0, bun_test_1.expect)(store.eventCount("ses_checkpoint")).toBe(1);
                }
                finally {
                    store.close();
                    (0, node_fs_1.rmSync)(root, { force: true, recursive: true });
                }
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("recovery projects the current goal and its admitted rounds", function () {
    var _a, _b, _c, _d;
    var path = (0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-goal-recovery-".concat(crypto.randomUUID(), ".db"));
    var store = new src_1.SqliteSessionStore(path);
    var sessionID = "ses_goal_recovery";
    try {
        store.create(sessionID, "Goal");
        store.appendEvents(sessionID, [
            {
                type: "goal.changed",
                id: "goal:create",
                operation: "create",
                snapshot: {
                    goalID: "goal_1",
                    revision: 1,
                    objective: "ship it",
                    phase: "active",
                    maxGoalRounds: 256,
                },
                roundsStarted: 0,
                at: "2026-01-01T00:00:00.000Z",
            },
        ]);
        var recovery = store.loadRecoveryProjection(sessionID);
        (0, bun_test_1.expect)((_a = recovery.goal) === null || _a === void 0 ? void 0 : _a.goalID).toBe("goal_1");
        (0, bun_test_1.expect)((_b = recovery.goal) === null || _b === void 0 ? void 0 : _b.roundsStarted).toBe(0);
        (0, bun_test_1.expect)((_c = recovery.goal) === null || _c === void 0 ? void 0 : _c.activation).toBe("disarmed");
        store.appendEvents(sessionID, [
            {
                type: "goal.round",
                id: "goal:round:1",
                goalID: "goal_1",
                revision: 1,
                round: 1,
                at: "2026-01-01T00:00:30.000Z",
            },
        ]);
        recovery = store.loadRecoveryProjection(sessionID);
        (0, bun_test_1.expect)((_d = recovery.goal) === null || _d === void 0 ? void 0 : _d.roundsStarted).toBe(1);
        store.appendEvents(sessionID, [
            {
                type: "goal.changed",
                id: "goal:clear",
                operation: "clear",
                cleared: { goalID: "goal_1", revision: 2 },
                roundsStarted: 1,
                at: "2026-01-01T00:01:00.000Z",
            },
        ]);
        (0, bun_test_1.expect)(store.loadRecoveryProjection(sessionID).goal).toBeUndefined();
    }
    finally {
        store.close();
        (0, node_fs_1.rmSync)(path, { force: true });
    }
});
(0, bun_test_1.test)("auto-saved checkpoint + tail replay matches a full projection", function () {
    var path = (0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-projection-cache-".concat(crypto.randomUUID(), ".db"));
    var store = new src_1.SqliteSessionStore(path);
    var sessionID = "ses_projection_cache";
    try {
        store.create(sessionID, "Projection cache");
        var events_1 = [];
        var push = function (event) {
            events_1.push(event);
            store.appendEvent(sessionID, event);
        };
        // A durable barrier auto-saves the checkpoint here (seq 4).
        push({
            type: "turn.submitted",
            id: "t1",
            text: "a",
            byteLength: 1,
            lineCount: 1,
            sha256: "x",
        });
        push({ type: "agent.selection", name: "reviewer", pending: false });
        push({ type: "model.selection", modelID: "alpha", variant: "fast" });
        push({ type: "turn.finished", id: "t1", stopReason: "done" });
        var checkpoint = store.loadProjectionCheckpoint(sessionID);
        (0, bun_test_1.expect)(checkpoint).toBeDefined();
        (0, bun_test_1.expect)(checkpoint.lastSeq).toBe(4);
        // A non-barrier tail: the checkpoint stays at the barrier sequence.
        push({
            type: "turn.submitted",
            id: "t2",
            text: "b",
            byteLength: 1,
            lineCount: 1,
            sha256: "y",
        });
        push({
            type: "tool.update",
            id: "t2:call_1",
            name: "read_file",
            callID: "call_1",
            status: "succeeded",
            summary: "read",
            result: "ok",
        });
        push({ type: "model.selection", modelID: "beta", variant: "careful" });
        var loaded = store.loadProjectionCheckpoint(sessionID);
        (0, bun_test_1.expect)(loaded.lastSeq).toBe(4);
        for (var _i = 0, _a = store.loadEventsAfter(sessionID, loaded.lastSeq); _i < _a.length; _i++) {
            var event_1 = _a[_i];
            (0, src_1.applyProjection)(loaded.state, event_1);
        }
        var resumed = (0, src_1.viewProjection)(loaded.state);
        var full = (0, src_1.foldProjection)(events_1);
        (0, bun_test_1.expect)(resumed).toEqual(full);
        (0, bun_test_1.expect)(resumed.selectedModel).toEqual({
            modelID: "beta",
            variant: "careful",
        });
        (0, bun_test_1.expect)(resumed.completedTurnIDs.sort()).toEqual(["t1"]);
        (0, bun_test_1.expect)(resumed.activeTurnIDs).toEqual(["t2"]);
    }
    finally {
        store.close();
        (0, node_fs_1.rmSync)(path, { force: true });
    }
});
(0, bun_test_1.test)("a projection checkpoint from an older state version is discarded", function () {
    var path = (0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-projection-stale-".concat(crypto.randomUUID(), ".db"));
    var store = new src_1.SqliteSessionStore(path);
    var sessionID = "ses_projection_stale";
    try {
        store.create(sessionID, "Stale cache");
        store.appendEvent(sessionID, {
            type: "turn.submitted",
            id: "t1",
            text: "a",
            byteLength: 1,
            lineCount: 1,
            sha256: "x",
        });
        var state = (0, src_1.initProjection)();
        (0, src_1.applyProjection)(state, {
            type: "turn.submitted",
            id: "t1",
            text: "a",
            byteLength: 1,
            lineCount: 1,
            sha256: "x",
        });
        store.saveProjectionCheckpoint(sessionID, state);
        // Simulate a checkpoint written by a future/older fold shape.
        var db = store;
        db.db.run("UPDATE projection_checkpoints SET state_version = state_version + 999 WHERE session_id = ?", [sessionID]);
        (0, bun_test_1.expect)(store.loadProjectionCheckpoint(sessionID)).toBeUndefined();
    }
    finally {
        store.close();
        (0, node_fs_1.rmSync)(path, { force: true });
    }
});
(0, bun_test_1.test)("restoreProjection uses a disk checkpoint + tail and fails soft to full", function () {
    var path = (0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-restore-ladder-".concat(crypto.randomUUID(), ".db"));
    var store = new src_1.SqliteSessionStore(path);
    var sessionID = "ses_restore_ladder";
    try {
        store.create(sessionID, "Restore ladder");
        var events_2 = [];
        var push = function (event) {
            events_2.push(event);
            store.appendEvent(sessionID, event);
        };
        push({
            type: "turn.submitted",
            id: "t1",
            text: "a",
            byteLength: 1,
            lineCount: 1,
            sha256: "x",
        });
        push({ type: "model.selection", modelID: "alpha", variant: "fast" });
        var full = { id: sessionID, events: events_2 };
        var adapter = {
            loadProjectionCheckpoint: function (id) {
                var loaded = store.loadProjectionCheckpoint(id);
                return loaded
                    ? {
                        serializedState: (0, src_1.serializeProjectionState)(loaded.state),
                        lastSeq: loaded.lastSeq,
                    }
                    : undefined;
            },
            eventsAfter: function (id, after) {
                return store.loadEventsAfter(id, after);
            },
        };
        // No checkpoint yet: fail soft to a full projection (no regression).
        (0, bun_test_1.expect)((0, src_1.restoreProjection)(sessionID, full, adapter)).toEqual((0, src_1.foldProjection)(events_2));
        // Checkpoint after the first two events (lastSeq = 2).
        var checkpointState = (0, src_1.initProjection)();
        (0, src_1.applyProjection)(checkpointState, events_2[0]);
        (0, src_1.applyProjection)(checkpointState, events_2[1]);
        (0, bun_test_1.expect)(store.saveProjectionCheckpoint(sessionID, checkpointState)).toBe(2);
        // Append the tail, then restore: checkpoint + tail replay.
        push({ type: "turn.finished", id: "t1", stopReason: "done" });
        var resumed = (0, src_1.restoreProjection)(sessionID, full, adapter);
        (0, bun_test_1.expect)(resumed).toEqual((0, src_1.foldProjection)(events_2));
        (0, bun_test_1.expect)(resumed.completedTurnIDs).toEqual(["t1"]);
        (0, bun_test_1.expect)(resumed.selectedModel).toEqual({
            modelID: "alpha",
            variant: "fast",
        });
    }
    finally {
        store.close();
        (0, node_fs_1.rmSync)(path, { force: true });
    }
});
(0, bun_test_1.test)("appending durable events auto-saves a projection checkpoint", function () {
    var path = (0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-projection-autosave-".concat(crypto.randomUUID(), ".db"));
    var store = new src_1.SqliteSessionStore(path);
    var sessionID = "ses_projection_autosave";
    try {
        store.create(sessionID, "Autosave");
        // A non-barrier event does not persist a checkpoint yet.
        store.appendEvent(sessionID, {
            type: "model.selection",
            modelID: "alpha",
            variant: "fast",
        });
        (0, bun_test_1.expect)(store.loadProjectionCheckpoint(sessionID)).toBeUndefined();
        // A durable barrier (turn.finished) flushes a checkpoint.
        store.appendEvent(sessionID, {
            type: "turn.submitted",
            id: "t1",
            text: "a",
            byteLength: 1,
            lineCount: 1,
            sha256: "x",
        });
        store.appendEvent(sessionID, {
            type: "turn.finished",
            id: "t1",
            stopReason: "done",
        });
        var checkpoint = store.loadProjectionCheckpoint(sessionID);
        (0, bun_test_1.expect)(checkpoint).toBeDefined();
        (0, bun_test_1.expect)(checkpoint.lastSeq).toBe(3);
        (0, bun_test_1.expect)(__spreadArray([], checkpoint.state.completedTurnIDs, true)).toEqual(["t1"]);
        (0, bun_test_1.expect)((0, src_1.viewProjection)(checkpoint.state).selectedModel).toEqual({
            modelID: "alpha",
            variant: "fast",
        });
        // A rollback drops the checkpoint and the live fold.
        store.truncateAfter(sessionID, 2);
        (0, bun_test_1.expect)(store.loadProjectionCheckpoint(sessionID)).toBeUndefined();
        // A new durable barrier re-saves a checkpoint reflecting the truncated log
        // (turn.submitted survived, so t1 completes again).
        store.appendEvent(sessionID, {
            type: "turn.finished",
            id: "t1",
            stopReason: "done",
        });
        var afterRollback = store.loadProjectionCheckpoint(sessionID);
        (0, bun_test_1.expect)(afterRollback).toBeDefined();
        (0, bun_test_1.expect)(__spreadArray([], afterRollback.state.completedTurnIDs, true)).toEqual(["t1"]);
    }
    finally {
        store.close();
        (0, node_fs_1.rmSync)(path, { force: true });
    }
});
