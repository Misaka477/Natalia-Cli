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
var session_store_1 = require("@anthelia/session-store");
var attachments_1 = require("@anthelia/attachments");
(0, bun_test_1.test)("session store: create is idempotent, archive marks, export dumps", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, controller, created, replay, loaded, archived, exported, list, removed, after, missing;
    var _a, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-session-store-"))];
            case 1:
                root = _c.sent();
                controller = (0, session_store_1.createSessionStoreController)({
                    workspaceRoot: root,
                    sessionID: function () { return "ses_host"; },
                    attachments: (0, attachments_1.createAttachmentService)(root),
                });
                return [4 /*yield*/, controller.init()];
            case 2:
                _c.sent();
                return [4 /*yield*/, controller.create({ id: "ses_a", title: "A" })];
            case 3:
                created = _c.sent();
                (0, bun_test_1.expect)(created).toEqual({ sessionID: "ses_a", created: true });
                return [4 /*yield*/, controller.create({ id: "ses_a" })];
            case 4:
                replay = _c.sent();
                (0, bun_test_1.expect)(replay.created).toBe(false);
                // Metadata updates only need the session id; callers must not have to clone
                // (or otherwise construct) the full event-bearing record.
                return [4 /*yield*/, controller.updateMetadata("ses_a", { pinned: true })];
            case 5:
                // Metadata updates only need the session id; callers must not have to clone
                // (or otherwise construct) the full event-bearing record.
                _c.sent();
                return [4 /*yield*/, controller.load("ses_a")];
            case 6:
                loaded = _c.sent();
                (0, bun_test_1.expect)(loaded).toBeDefined();
                (0, bun_test_1.expect)((_b = (_a = loaded === null || loaded === void 0 ? void 0 : loaded.session) === null || _a === void 0 ? void 0 : _a.metadata) === null || _b === void 0 ? void 0 : _b.pinned).toBe(true);
                return [4 /*yield*/, controller.archive("ses_a")];
            case 7:
                archived = _c.sent();
                (0, bun_test_1.expect)(archived.archived).toBe(true);
                return [4 /*yield*/, controller.export("ses_a")];
            case 8:
                exported = _c.sent();
                (0, bun_test_1.expect)(exported.title).toBe("A");
                (0, bun_test_1.expect)(exported.archived).toBe(true);
                return [4 /*yield*/, controller.list()];
            case 9:
                list = _c.sent();
                (0, bun_test_1.expect)(list.some(function (summary) { return summary.id === "ses_a"; })).toBe(true);
                return [4 /*yield*/, controller.delete("ses_a")];
            case 10:
                removed = _c.sent();
                (0, bun_test_1.expect)(removed.removedAttachments).toBe(0);
                return [4 /*yield*/, controller.list()];
            case 11:
                after = _c.sent();
                (0, bun_test_1.expect)(after.some(function (summary) { return summary.id === "ses_a"; })).toBe(false);
                return [4 /*yield*/, controller
                        .archive("ses_unknown")
                        .catch(function (error) { return error; })];
            case 12:
                missing = _c.sent();
                (0, bun_test_1.expect)(missing.message).toContain("session not found");
                return [4 /*yield*/, controller.close()];
            case 13:
                _c.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("session store: the active session refuses deletion", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, controller, refused;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-session-store-2-"))];
            case 1:
                root = _a.sent();
                controller = (0, session_store_1.createSessionStoreController)({
                    workspaceRoot: root,
                    sessionID: function () { return "ses_active"; },
                    attachments: (0, attachments_1.createAttachmentService)(root),
                });
                return [4 /*yield*/, controller.init()];
            case 2:
                _a.sent();
                return [4 /*yield*/, controller
                        .delete("ses_active")
                        .catch(function (error) { return error; })];
            case 3:
                refused = _a.sent();
                (0, bun_test_1.expect)(refused.message).toContain("cannot delete the active runtime session");
                return [4 /*yield*/, controller.close()];
            case 4:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("session store: JSON summaries project the pending human terminal", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, controller, record, summary, after;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-session-store-pending-"))];
            case 1:
                root = _b.sent();
                controller = (0, session_store_1.createSessionStoreController)({
                    workspaceRoot: root,
                    sessionID: function () { return "ses_host"; },
                    attachments: (0, attachments_1.createAttachmentService)(root),
                });
                return [4 /*yield*/, controller.init()];
            case 2:
                _b.sent();
                _b.label = 3;
            case 3:
                _b.trys.push([3, , 10, 12]);
                return [4 /*yield*/, controller.create({ id: "ses_wait", title: "Waiting" })];
            case 4:
                _b.sent();
                return [4 /*yield*/, controller.load("ses_wait")];
            case 5:
                record = (_b.sent()).session;
                record.metadata = {
                    pendingHumanTerminal: {
                        terminalID: "tty_wait",
                        reason: "needs the sudo password",
                        since: "2026-08-12T00:00:00.000Z",
                    },
                };
                return [4 /*yield*/, controller.updateMetadata(record, record.metadata)];
            case 6:
                _b.sent();
                return [4 /*yield*/, controller.list()];
            case 7:
                summary = (_b.sent()).find(function (entry) { return entry.id === "ses_wait"; });
                (0, bun_test_1.expect)(summary === null || summary === void 0 ? void 0 : summary.pendingHumanTerminal).toMatchObject({
                    terminalID: "tty_wait",
                    reason: "needs the sudo password",
                    since: "2026-08-12T00:00:00.000Z",
                });
                delete record.metadata.pendingHumanTerminal;
                return [4 /*yield*/, controller.updateMetadata(record, {
                        pendingHumanTerminal: undefined,
                    })];
            case 8:
                _b.sent();
                return [4 /*yield*/, controller.list()];
            case 9:
                after = _b.sent();
                (0, bun_test_1.expect)((_a = after.find(function (entry) { return entry.id === "ses_wait"; })) === null || _a === void 0 ? void 0 : _a.pendingHumanTerminal).toBeUndefined();
                return [3 /*break*/, 12];
            case 10: return [4 /*yield*/, controller.close()];
            case 11:
                _b.sent();
                return [7 /*endfinally*/];
            case 12: return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("session store: SQLite summaries project the pending human terminal", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, controller, record, summary, after;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-session-store-pending-db"))];
            case 1:
                root = _b.sent();
                controller = (0, session_store_1.createSessionStoreController)({
                    workspaceRoot: root,
                    sessionID: function () { return "ses_host"; },
                    useSqliteStore: true,
                    attachments: (0, attachments_1.createAttachmentService)(root),
                });
                return [4 /*yield*/, controller.init()];
            case 2:
                _b.sent();
                _b.label = 3;
            case 3:
                _b.trys.push([3, , 10, 12]);
                return [4 /*yield*/, controller.create({ id: "ses_wait_sqlite", title: "Waiting" })];
            case 4:
                _b.sent();
                return [4 /*yield*/, controller.load("ses_wait_sqlite")];
            case 5:
                record = (_b.sent()).session;
                record.metadata = {
                    pendingHumanTerminal: {
                        terminalID: "tty_wait_sqlite",
                        reason: "needs the sudo password",
                        since: "2026-08-12T00:00:00.000Z",
                    },
                };
                return [4 /*yield*/, controller.updateMetadata(record, record.metadata)];
            case 6:
                _b.sent();
                return [4 /*yield*/, controller.list()];
            case 7:
                summary = (_b.sent()).find(function (entry) { return entry.id === "ses_wait_sqlite"; });
                (0, bun_test_1.expect)(summary === null || summary === void 0 ? void 0 : summary.pendingHumanTerminal).toMatchObject({
                    terminalID: "tty_wait_sqlite",
                    reason: "needs the sudo password",
                });
                delete record.metadata.pendingHumanTerminal;
                return [4 /*yield*/, controller.updateMetadata(record, {
                        pendingHumanTerminal: undefined,
                    })];
            case 8:
                _b.sent();
                return [4 /*yield*/, controller.list()];
            case 9:
                after = _b.sent();
                (0, bun_test_1.expect)((_a = after.find(function (entry) { return entry.id === "ses_wait_sqlite"; })) === null || _a === void 0 ? void 0 : _a.pendingHumanTerminal).toBeUndefined();
                return [3 /*break*/, 12];
            case 10: return [4 /*yield*/, controller.close()];
            case 11:
                _b.sent();
                return [7 /*endfinally*/];
            case 12: return [2 /*return*/];
        }
    });
}); });
