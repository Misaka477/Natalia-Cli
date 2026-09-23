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
var node_path_1 = require("node:path");
var node_os_1 = require("node:os");
var src_1 = require("../src");
(0, bun_test_1.test)("session store supports rename and delete for TUI session management", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, store, session, _a, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-session-manage-"))];
            case 1:
                root = _c.sent();
                store = new src_1.JsonSessionStore(root);
                return [4 /*yield*/, store.loadOrCreate("ses_manage", "before")];
            case 2:
                session = _c.sent();
                _a = bun_test_1.expect;
                return [4 /*yield*/, store.rename(session.id, "after")];
            case 3:
                _a.apply(void 0, [(_c.sent()).title]).toBe("after");
                return [4 /*yield*/, store.delete(session.id)];
            case 4:
                _c.sent();
                _b = bun_test_1.expect;
                return [4 /*yield*/, store.load(session.id)];
            case 5:
                _b.apply(void 0, [_c.sent()]).toBeUndefined();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("session store updateMetadata merges into existing record", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, store, session, loaded, reloaded;
    var _a, _b, _c, _d;
    return __generator(this, function (_e) {
        switch (_e.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-session-meta-"))];
            case 1:
                root = _e.sent();
                store = new src_1.JsonSessionStore(root);
                return [4 /*yield*/, store.loadOrCreate("ses_meta1", "meta test")];
            case 2:
                session = _e.sent();
                return [4 /*yield*/, store.updateMetadata(session.id, {
                        pinned: true,
                        lastAccessedAt: "2026-07-01T00:00:00.000Z",
                    })];
            case 3:
                _e.sent();
                return [4 /*yield*/, store.load(session.id)];
            case 4:
                loaded = _e.sent();
                (0, bun_test_1.expect)((_a = loaded === null || loaded === void 0 ? void 0 : loaded.metadata) === null || _a === void 0 ? void 0 : _a.pinned).toBe(true);
                (0, bun_test_1.expect)((_b = loaded === null || loaded === void 0 ? void 0 : loaded.metadata) === null || _b === void 0 ? void 0 : _b.lastAccessedAt).toBe("2026-07-01T00:00:00.000Z");
                return [4 /*yield*/, store.updateMetadata(session.id, {
                        lastAccessedAt: "2026-07-18T00:00:00.000Z",
                    })];
            case 5:
                _e.sent();
                return [4 /*yield*/, store.load(session.id)];
            case 6:
                reloaded = _e.sent();
                (0, bun_test_1.expect)((_c = reloaded === null || reloaded === void 0 ? void 0 : reloaded.metadata) === null || _c === void 0 ? void 0 : _c.pinned).toBe(true);
                (0, bun_test_1.expect)((_d = reloaded === null || reloaded === void 0 ? void 0 : reloaded.metadata) === null || _d === void 0 ? void 0 : _d.lastAccessedAt).toBe("2026-07-18T00:00:00.000Z");
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("session store updateMetadata rejects missing session", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, store;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-session-meta-miss-"))];
            case 1:
                root = _a.sent();
                store = new src_1.JsonSessionStore(root);
                return [4 /*yield*/, (0, bun_test_1.expect)(store.updateMetadata("ses_nonexistent", { pinned: true })).rejects.toThrow("session not found")];
            case 2:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("session store duplicate creates a copy with new ID", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, store, original, event, copy, loaded;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-session-dup-"))];
            case 1:
                root = _b.sent();
                store = new src_1.JsonSessionStore(root);
                return [4 /*yield*/, store.loadOrCreate("ses_orig", "original")];
            case 2:
                original = _b.sent();
                event = {
                    type: "diagnostic",
                    level: "info",
                    message: "test",
                };
                original.events.push(event);
                return [4 /*yield*/, store.save(original)];
            case 3:
                _b.sent();
                return [4 /*yield*/, store.duplicate("ses_orig", "ses_copy")];
            case 4:
                copy = _b.sent();
                (0, bun_test_1.expect)(copy.id).toBe("ses_copy");
                (0, bun_test_1.expect)(copy.title).toBe("original (copy)");
                (0, bun_test_1.expect)(copy.events).toHaveLength(1);
                (0, bun_test_1.expect)((_a = copy.metadata) === null || _a === void 0 ? void 0 : _a.lastAccessedAt).toBeDefined();
                return [4 /*yield*/, store.load("ses_orig")];
            case 5:
                loaded = _b.sent();
                (0, bun_test_1.expect)(loaded === null || loaded === void 0 ? void 0 : loaded.id).toBe("ses_orig");
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("session store duplicate generates ID when not provided", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, store, copy, _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-session-dup-auto-"))];
            case 1:
                root = _b.sent();
                store = new src_1.JsonSessionStore(root);
                return [4 /*yield*/, store.loadOrCreate("ses_autodup", "auto dup")];
            case 2:
                _b.sent();
                return [4 /*yield*/, store.duplicate("ses_autodup")];
            case 3:
                copy = _b.sent();
                (0, bun_test_1.expect)(copy.id).toMatch(/^ses_/u);
                (0, bun_test_1.expect)(copy.title).toBe("auto dup (copy)");
                _a = bun_test_1.expect;
                return [4 /*yield*/, store.load(copy.id)];
            case 4:
                _a.apply(void 0, [_b.sent()]).toBeDefined();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("session store duplicate rejects missing session", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, store;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-session-dup-miss-"))];
            case 1:
                root = _a.sent();
                store = new src_1.JsonSessionStore(root);
                return [4 /*yield*/, (0, bun_test_1.expect)(store.duplicate("ses_ghost")).rejects.toThrow("session not found")];
            case 2:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("session list orders pinned sessions first, then by lastAccessedAt", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, store, s1, s2, s3, list;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-session-order-"))];
            case 1:
                root = _a.sent();
                store = new src_1.JsonSessionStore(root);
                return [4 /*yield*/, store.loadOrCreate("ses_a", "A")];
            case 2:
                s1 = _a.sent();
                return [4 /*yield*/, store.loadOrCreate("ses_b", "B")];
            case 3:
                s2 = _a.sent();
                return [4 /*yield*/, store.loadOrCreate("ses_c", "C")];
            case 4:
                s3 = _a.sent();
                return [4 /*yield*/, store.updateMetadata(s3.id, {
                        pinned: true,
                        lastAccessedAt: "2026-07-18T00:00:00.000Z",
                    })];
            case 5:
                _a.sent();
                return [4 /*yield*/, store.updateMetadata(s1.id, {
                        pinned: true,
                        lastAccessedAt: "2026-07-17T00:00:00.000Z",
                    })];
            case 6:
                _a.sent();
                return [4 /*yield*/, store.updateMetadata(s2.id, {
                        lastAccessedAt: "2026-07-16T00:00:00.000Z",
                    })];
            case 7:
                _a.sent();
                return [4 /*yield*/, store.list()];
            case 8:
                list = _a.sent();
                (0, bun_test_1.expect)(list[0].id).toBe("ses_c");
                (0, bun_test_1.expect)(list[1].id).toBe("ses_a");
                (0, bun_test_1.expect)(list[2].id).toBe("ses_b");
                return [2 /*return*/];
        }
    });
}); });
