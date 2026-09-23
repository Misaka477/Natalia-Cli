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
var __await = (this && this.__await) || function (v) { return this instanceof __await ? (this.v = v, this) : new __await(v); }
var __asyncGenerator = (this && this.__asyncGenerator) || function (thisArg, _arguments, generator) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var g = generator.apply(thisArg, _arguments || []), i, q = [];
    return i = Object.create((typeof AsyncIterator === "function" ? AsyncIterator : Object).prototype), verb("next"), verb("throw"), verb("return", awaitReturn), i[Symbol.asyncIterator] = function () { return this; }, i;
    function awaitReturn(f) { return function (v) { return Promise.resolve(v).then(f, reject); }; }
    function verb(n, f) { if (g[n]) { i[n] = function (v) { return new Promise(function (a, b) { q.push([n, v, a, b]) > 1 || resume(n, v); }); }; if (f) i[n] = f(i[n]); } }
    function resume(n, v) { try { step(g[n](v)); } catch (e) { settle(q[0][3], e); } }
    function step(r) { r.value instanceof __await ? Promise.resolve(r.value.v).then(fulfill, reject) : settle(q[0][2], r); }
    function fulfill(value) { resume("next", value); }
    function reject(value) { resume("throw", value); }
    function settle(f, v) { if (f(v), q.shift(), q.length) resume(q[0][0], q[0][1]); }
};
Object.defineProperty(exports, "__esModule", { value: true });
var bun_test_1 = require("bun:test");
var promises_1 = require("node:fs/promises");
var node_os_1 = require("node:os");
var node_path_1 = require("node:path");
var session_title_1 = require("../src/session-title");
var session_store_1 = require("@anthelia/session-store");
var attachments_1 = require("@anthelia/attachments");
(0, bun_test_1.test)("session titles sanitize secrets, JWTs, and home paths", function () {
    var input = (0, session_title_1.sanitizeSessionTitleInput)("Fix token=super-secret-value /home/alice/.config key=abc eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.signature");
    (0, bun_test_1.expect)(input).toContain("[redacted]");
    (0, bun_test_1.expect)(input).toContain("[home path]");
    (0, bun_test_1.expect)(input).not.toContain("super-secret-value");
    (0, bun_test_1.expect)(input).not.toContain("/home/alice");
    (0, bun_test_1.expect)((0, session_title_1.normalizeSessionTitle)('## "Fix: cache!"\nnow')).toBe("Fix cache now");
});
(0, bun_test_1.test)("session title generator sends only bounded text and normalizes output", function () { return __awaiter(void 0, void 0, void 0, function () {
    var request, provider, title, userContent;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                provider = {
                    provider: "test",
                    model: "test",
                    stream: function (value) {
                        return __asyncGenerator(this, arguments, function stream_1() {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        request = value;
                                        return [4 /*yield*/, __await({ type: "content", text: "** 修复: 登录! **" })];
                                    case 1: return [4 /*yield*/, _a.sent()];
                                    case 2:
                                        _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        });
                    },
                };
                return [4 /*yield*/, (0, session_title_1.generateSessionTitle)(provider, "修复 登录 " + "x".repeat(700))];
            case 1:
                title = _a.sent();
                (0, bun_test_1.expect)(title).toBe("修复 登录");
                userContent = request
                    .messages[1].content;
                (0, bun_test_1.expect)(userContent.length).toBeLessThanOrEqual(600);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("session title generator rejects provider and tool protocol IDs", function () { return __awaiter(void 0, void 0, void 0, function () {
    var idProvider, _a, toolProvider, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                (0, bun_test_1.expect)((0, session_title_1.isInvalidGeneratedSessionTitle)("chatcmpl-tool-b10625d073fa5e8d")).toBe(true);
                (0, bun_test_1.expect)((0, session_title_1.normalizeSessionTitle)("chatcmpl-tool-b10625d073fa5e8d")).toBe("");
                (0, bun_test_1.expect)((0, session_title_1.normalizeSessionTitle)("chatcmpl tool b10625d073fa5e8d")).toBe("");
                idProvider = {
                    provider: "test",
                    model: "test",
                    stream: function () {
                        return __asyncGenerator(this, arguments, function stream_2() {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, __await({
                                            type: "content",
                                            text: "chatcmpl-tool-b10625d073fa5e8d",
                                        })];
                                    case 1: return [4 /*yield*/, _a.sent()];
                                    case 2:
                                        _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        });
                    },
                };
                _a = bun_test_1.expect;
                return [4 /*yield*/, (0, session_title_1.generateSessionTitle)(idProvider, "修复会话标题")];
            case 1:
                _a.apply(void 0, [_c.sent()]).toBe("");
                toolProvider = {
                    provider: "test",
                    model: "test",
                    stream: function () {
                        return __asyncGenerator(this, arguments, function stream_3() {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, __await({ type: "content", text: "Valid looking title" })];
                                    case 1: return [4 /*yield*/, _a.sent()];
                                    case 2:
                                        _a.sent();
                                        return [4 /*yield*/, __await({ type: "tool_call", calls: [] })];
                                    case 3: return [4 /*yield*/, _a.sent()];
                                    case 4:
                                        _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        });
                    },
                };
                _b = bun_test_1.expect;
                return [4 /*yield*/, (0, session_title_1.generateSessionTitle)(toolProvider, "Fix session titles")];
            case 2:
                _b.apply(void 0, [_c.sent()]).toBe("");
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("session title generation aborts on timeout and external cancellation", function () { return __awaiter(void 0, void 0, void 0, function () {
    var timeoutAborted, provider, controller, cancelled;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                timeoutAborted = false;
                provider = {
                    provider: "test",
                    model: "test",
                    stream: function (request) {
                        return __asyncGenerator(this, arguments, function stream_4() {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, __await(new Promise(function (resolve) {
                                            var _a;
                                            (_a = request.signal) === null || _a === void 0 ? void 0 : _a.addEventListener("abort", function () {
                                                timeoutAborted = true;
                                                resolve();
                                            }, { once: true });
                                        }))];
                                    case 1:
                                        _a.sent();
                                        return [4 /*yield*/, __await({ type: "done" })];
                                    case 2: return [4 /*yield*/, _a.sent()];
                                    case 3:
                                        _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        });
                    },
                };
                return [4 /*yield*/, (0, bun_test_1.expect)((0, session_title_1.generateSessionTitle)(provider, "A valid title request", { timeoutMs: 10 })).rejects.toThrow("timed out")];
            case 1:
                _a.sent();
                (0, bun_test_1.expect)(timeoutAborted).toBe(true);
                controller = new AbortController();
                cancelled = (0, session_title_1.generateSessionTitle)(provider, "Another valid request", {
                    signal: controller.signal,
                    timeoutMs: 1000,
                });
                controller.abort(new Error("runtime disposed"));
                return [4 /*yield*/, (0, bun_test_1.expect)(cancelled).rejects.toThrow()];
            case 2:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("session title fallback and manual rename take precedence in JSON and SQLite", function () { return __awaiter(void 0, void 0, void 0, function () {
    var _i, _a, useSqliteStore, root, controller, title;
    var _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                _i = 0, _a = [false, true];
                _c.label = 1;
            case 1:
                if (!(_i < _a.length)) return [3 /*break*/, 13];
                useSqliteStore = _a[_i];
                return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-session-title-"))];
            case 2:
                root = _c.sent();
                controller = (0, session_store_1.createSessionStoreController)({
                    workspaceRoot: root,
                    sessionID: function () { return "ses_host"; },
                    useSqliteStore: useSqliteStore,
                    attachments: (0, attachments_1.createAttachmentService)(root),
                });
                return [4 /*yield*/, controller.init()];
            case 3:
                _c.sent();
                _c.label = 4;
            case 4:
                _c.trys.push([4, , 10, 12]);
                return [4 /*yield*/, controller.create({ id: "ses_title" })];
            case 5:
                _c.sent();
                return [4 /*yield*/, controller.setAutoTitle("ses_title", "Fallback topic", "fallback")];
            case 6:
                _c.sent();
                return [4 /*yield*/, controller.rename("ses_title", "My manual topic")];
            case 7:
                _c.sent();
                return [4 /*yield*/, controller.setAutoTitle("ses_title", "Delayed generated topic", "generated")];
            case 8:
                _c.sent();
                return [4 /*yield*/, controller.list()];
            case 9:
                title = (_b = (_c.sent()).find(function (item) { return item.id === "ses_title"; })) === null || _b === void 0 ? void 0 : _b.title;
                (0, bun_test_1.expect)(title).toBe("My manual topic");
                (0, bun_test_1.expect)((0, session_title_1.fallbackSessionTitle)("  Fix the cache. ")).toBe("Fix the cache");
                return [3 /*break*/, 12];
            case 10: return [4 /*yield*/, controller.close()];
            case 11:
                _c.sent();
                return [7 /*endfinally*/];
            case 12:
                _i++;
                return [3 /*break*/, 1];
            case 13: return [2 /*return*/];
        }
    });
}); });
