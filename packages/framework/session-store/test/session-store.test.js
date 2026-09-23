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
var bun_test_1 = require("bun:test");
var promises_1 = require("node:fs/promises");
var node_os_1 = require("node:os");
var node_path_1 = require("node:path");
var attachments_1 = require("@anthelia/attachments");
var session_1 = require("@anthelia/session");
var src_1 = require("../src");
(0, bun_test_1.test)("local session service preserves offline JSON and SQLite visibility", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, json, sqlite, sessions, _a, _b, _c;
    return __generator(this, function (_d) {
        switch (_d.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-local-session-service-"))];
            case 1:
                root = _d.sent();
                json = new session_1.JsonSessionStore((0, node_path_1.join)(root, ".natalia", "sessions"));
                return [4 /*yield*/, json.save((0, session_1.createSessionRecord)("ses_json", "JSON"))];
            case 2:
                _d.sent();
                return [4 /*yield*/, (0, promises_1.mkdir)((0, node_path_1.join)(root, ".natalia"), { recursive: true })];
            case 3:
                _d.sent();
                sqlite = new session_1.SqliteSessionStore((0, node_path_1.join)(root, ".natalia", "sessions.db"));
                sqlite.create("ses_sqlite", "SQLite");
                sqlite.close();
                sessions = (0, src_1.createLocalSessionService)(root);
                _a = bun_test_1.expect;
                return [4 /*yield*/, sessions.list()];
            case 4:
                _a.apply(void 0, [(_d.sent()).map(function (session) { return session.id; }).sort()]).toEqual([
                    "ses_json",
                    "ses_sqlite",
                ]);
                _b = bun_test_1.expect;
                return [4 /*yield*/, sessions.show("ses_sqlite")];
            case 5:
                _b.apply(void 0, [_d.sent()]).toMatchObject({
                    id: "ses_sqlite",
                    title: "SQLite",
                });
                _c = bun_test_1.expect;
                return [4 /*yield*/, sessions.rename("ses_json", "Renamed")];
            case 6:
                _c.apply(void 0, [_d.sent()]).toEqual({
                    id: "ses_json",
                    title: "Renamed",
                });
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("session store controller initializes sqlite mode and lists sessions", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, controller, listing;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-session-store-"))];
            case 1:
                root = _a.sent();
                controller = (0, src_1.createSessionStoreController)({
                    workspaceRoot: root,
                    sessionID: function () { return "ses_host"; },
                    useSqliteStore: true,
                    attachments: (0, attachments_1.createAttachmentService)(root),
                });
                return [4 /*yield*/, controller.init()];
            case 2:
                _a.sent();
                (0, bun_test_1.expect)(controller.status()).toEqual({ initialized: true, mode: "sqlite" });
                return [4 /*yield*/, controller.list()];
            case 3:
                listing = _a.sent();
                (0, bun_test_1.expect)(listing.some(function (session) { return session.id === "ses_host"; })).toBe(true);
                return [4 /*yield*/, controller.close()];
            case 4:
                _a.sent();
                (0, bun_test_1.expect)(controller.status()).toEqual({ initialized: false, mode: "sqlite" });
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("sqlite init preserves existing active JSON session history", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, json, legacy, controller, listing;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-session-store-active-json-"))];
            case 1:
                root = _a.sent();
                json = new session_1.JsonSessionStore((0, node_path_1.join)(root, ".natalia", "sessions"));
                legacy = (0, session_1.createSessionRecord)("ses_active_json", "Active JSON");
                legacy.events.push({
                    type: "turn.finished",
                    id: "turn_json",
                    sessionID: "ses_active_json",
                });
                return [4 /*yield*/, json.save(legacy)];
            case 2:
                _a.sent();
                controller = (0, src_1.createSessionStoreController)({
                    workspaceRoot: root,
                    sessionID: function () { return "ses_active_json"; },
                    useSqliteStore: true,
                    attachments: (0, attachments_1.createAttachmentService)(root),
                });
                return [4 /*yield*/, controller.init()];
            case 3:
                _a.sent();
                return [4 /*yield*/, controller.list()];
            case 4:
                listing = _a.sent();
                (0, bun_test_1.expect)(listing.find(function (session) { return session.id === "ses_active_json"; })).toMatchObject({
                    id: "ses_active_json",
                    title: "Active JSON",
                    events: 1,
                });
                return [4 /*yield*/, controller.close()];
            case 5:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("sqlite mode deletes a legacy JSON session not yet imported", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, json, controller, after, _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-session-store-delete-legacy-"))];
            case 1:
                root = _b.sent();
                json = new session_1.JsonSessionStore((0, node_path_1.join)(root, ".natalia", "sessions"));
                return [4 /*yield*/, json.save((0, session_1.createSessionRecord)("ses_legacy_delete", "Legacy Delete"))];
            case 2:
                _b.sent();
                controller = (0, src_1.createSessionStoreController)({
                    workspaceRoot: root,
                    sessionID: function () { return "ses_host"; },
                    useSqliteStore: true,
                    attachments: (0, attachments_1.createAttachmentService)(root),
                });
                return [4 /*yield*/, controller.init()];
            case 3:
                _b.sent();
                return [4 /*yield*/, controller.delete("ses_legacy_delete")];
            case 4:
                _b.sent();
                after = new session_1.JsonSessionStore((0, node_path_1.join)(root, ".natalia", "sessions"));
                _a = bun_test_1.expect;
                return [4 /*yield*/, after.load("ses_legacy_delete")];
            case 5:
                _a.apply(void 0, [_b.sent()]).toBeUndefined();
                return [4 /*yield*/, controller.close()];
            case 6:
                _b.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("sqlite init does not resurrect JSON sessions after they were deleted", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, json, first, _a, second, listing, leftover, _b, _c;
    return __generator(this, function (_d) {
        switch (_d.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-session-store-no-resurrect-"))];
            case 1:
                root = _d.sent();
                json = new session_1.JsonSessionStore((0, node_path_1.join)(root, ".natalia", "sessions"));
                return [4 /*yield*/, json.save((0, session_1.createSessionRecord)("ses_keep", "Keep"))];
            case 2:
                _d.sent();
                return [4 /*yield*/, json.save((0, session_1.createSessionRecord)("ses_gone", "Gone"))];
            case 3:
                _d.sent();
                first = (0, src_1.createSessionStoreController)({
                    workspaceRoot: root,
                    sessionID: function () { return "ses_host"; },
                    useSqliteStore: true,
                    attachments: (0, attachments_1.createAttachmentService)(root),
                });
                return [4 /*yield*/, first.init()];
            case 4:
                _d.sent();
                _a = bun_test_1.expect;
                return [4 /*yield*/, first.list()];
            case 5:
                _a.apply(void 0, [(_d.sent()).some(function (session) { return session.id === "ses_keep"; })]).toBe(true);
                return [4 /*yield*/, first.delete("ses_gone")];
            case 6:
                _d.sent();
                return [4 /*yield*/, json.save((0, session_1.createSessionRecord)("ses_gone", "Gone again"))];
            case 7:
                _d.sent();
                return [4 /*yield*/, first.close()];
            case 8:
                _d.sent();
                second = (0, src_1.createSessionStoreController)({
                    workspaceRoot: root,
                    sessionID: function () { return "ses_host"; },
                    useSqliteStore: true,
                    attachments: (0, attachments_1.createAttachmentService)(root),
                });
                return [4 /*yield*/, second.init()];
            case 9:
                _d.sent();
                return [4 /*yield*/, second.list()];
            case 10:
                listing = _d.sent();
                (0, bun_test_1.expect)(listing.some(function (session) { return session.id === "ses_keep"; })).toBe(true);
                (0, bun_test_1.expect)(listing.some(function (session) { return session.id === "ses_gone"; })).toBe(false);
                leftover = new session_1.JsonSessionStore((0, node_path_1.join)(root, ".natalia", "sessions"));
                _b = bun_test_1.expect;
                return [4 /*yield*/, leftover.load("ses_gone")];
            case 11:
                _b.apply(void 0, [_d.sent()]).toBeUndefined();
                _c = bun_test_1.expect;
                return [4 /*yield*/, leftover.load("ses_keep")];
            case 12:
                _c.apply(void 0, [_d.sent()]).toBeUndefined();
                return [4 /*yield*/, second.close()];
            case 13:
                _d.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("session store eventWindow pages contiguous per-session order", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, controller, created, loaded, tail, older;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-session-window-"))];
            case 1:
                root = _a.sent();
                controller = (0, src_1.createSessionStoreController)({
                    workspaceRoot: root,
                    sessionID: function () { return "ses_host"; },
                    useSqliteStore: true,
                    attachments: (0, attachments_1.createAttachmentService)(root),
                });
                return [4 /*yield*/, controller.init()];
            case 2:
                _a.sent();
                return [4 /*yield*/, controller.create({
                        id: "ses_window",
                        title: "Window",
                    })];
            case 3:
                created = _a.sent();
                return [4 /*yield*/, controller.load(created.sessionID)];
            case 4:
                loaded = _a.sent();
                return [4 /*yield*/, controller.appendEvents(loaded.session, Array.from({ length: 5 }, function (_, index) { return ({
                        type: "content.done",
                        id: "turn_".concat(index),
                        text: "answer ".concat(index),
                    }); }))];
            case 5:
                _a.sent();
                return [4 /*yield*/, controller.flush(created.sessionID)];
            case 6:
                _a.sent();
                return [4 /*yield*/, controller.eventWindow(created.sessionID, [], {
                        limit: 3,
                    })];
            case 7:
                tail = _a.sent();
                (0, bun_test_1.expect)(tail.events.map(function (entry) { return entry.sessionSeq; })).toEqual([3, 4, 5]);
                (0, bun_test_1.expect)(tail.events.map(function (entry) {
                    return entry.event.type === "content.done" ? entry.event.text : undefined;
                })).toEqual(["answer 2", "answer 3", "answer 4"]);
                (0, bun_test_1.expect)(tail.hasMore).toBe(true);
                return [4 /*yield*/, controller.eventWindow(created.sessionID, [], { beforeSeq: 3, limit: 3 })];
            case 8:
                older = _a.sent();
                (0, bun_test_1.expect)(older.events.map(function (entry) { return entry.sessionSeq; })).toEqual([1, 2]);
                (0, bun_test_1.expect)(older.hasMore).toBe(false);
                return [4 /*yield*/, controller.close()];
            case 9:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("session store controller archives and restores a session without deleting it", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, controller, archived, listing, restored, after;
    var _a, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-session-archive-"))];
            case 1:
                root = _c.sent();
                controller = (0, src_1.createSessionStoreController)({
                    workspaceRoot: root,
                    sessionID: function () { return "ses_host"; },
                    useSqliteStore: true,
                    attachments: (0, attachments_1.createAttachmentService)(root),
                });
                return [4 /*yield*/, controller.init()];
            case 2:
                _c.sent();
                return [4 /*yield*/, controller.create({ id: "ses_archive", title: "Archive me" })];
            case 3:
                _c.sent();
                return [4 /*yield*/, controller.archive("ses_archive")];
            case 4:
                archived = _c.sent();
                (0, bun_test_1.expect)(archived).toEqual({ id: "ses_archive", archived: true });
                return [4 /*yield*/, controller.list()];
            case 5:
                listing = _c.sent();
                (0, bun_test_1.expect)((_a = listing.find(function (session) { return session.id === "ses_archive"; })) === null || _a === void 0 ? void 0 : _a.archived).toBe(true);
                return [4 /*yield*/, controller.restore("ses_archive")];
            case 6:
                restored = _c.sent();
                (0, bun_test_1.expect)(restored).toEqual({ id: "ses_archive", archived: false });
                return [4 /*yield*/, controller.list()];
            case 7:
                after = _c.sent();
                (0, bun_test_1.expect)((_b = after.find(function (session) { return session.id === "ses_archive"; })) === null || _b === void 0 ? void 0 : _b.archived).toBe(false);
                return [4 /*yield*/, controller.close()];
            case 8:
                _c.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("session store controller rolls messages back to a turn boundary", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, controller, created, loaded, result, after;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-session-message-rollback-"))];
            case 1:
                root = _a.sent();
                controller = (0, src_1.createSessionStoreController)({
                    workspaceRoot: root,
                    sessionID: function () { return "ses_host"; },
                    useSqliteStore: true,
                    attachments: (0, attachments_1.createAttachmentService)(root),
                });
                return [4 /*yield*/, controller.init()];
            case 2:
                _a.sent();
                return [4 /*yield*/, controller.create({
                        id: "ses_rollback",
                        title: "Rollback",
                    })];
            case 3:
                created = _a.sent();
                return [4 /*yield*/, controller.load(created.sessionID)];
            case 4:
                loaded = _a.sent();
                return [4 /*yield*/, controller.appendEvents(loaded.session, [
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
                    ])];
            case 5:
                _a.sent();
                return [4 /*yield*/, controller.messageRollback("ses_rollback", "turn_two")];
            case 6:
                result = _a.sent();
                (0, bun_test_1.expect)(result).toEqual({ id: "ses_rollback", rolledBackTo: "turn_two" });
                return [4 /*yield*/, controller.load("ses_rollback")];
            case 7:
                after = _a.sent();
                (0, bun_test_1.expect)(after.session.events.map(function (event) { return event.type; })).toEqual([
                    "turn.submitted",
                    "turn.finished",
                ]);
                return [4 /*yield*/, controller.close()];
            case 8:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
