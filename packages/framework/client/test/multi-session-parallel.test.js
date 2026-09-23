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
var node_path_1 = require("node:path");
var plugin_test_helpers_1 = require("./plugin-test-helpers");
(0, plugin_test_helpers_1.useWorkspaceCleanup)();
(0, bun_test_1.test)("two sessions submit and finish concurrently without cross-cancel", function () { return __awaiter(void 0, void 0, void 0, function () {
    var workspaceRoot, client, createdA, createdB, first, second, _a, a, b;
    var _b, _c, _d, _e, _f;
    return __generator(this, function (_g) {
        switch (_g.label) {
            case 0: return [4 /*yield*/, (0, plugin_test_helpers_1.officialPluginWorkspace)("multi-session-parallel")];
            case 1:
                workspaceRoot = _g.sent();
                client = (0, plugin_test_helpers_1.createOfficialRuntimeClient)({
                    workspaceRoot: workspaceRoot,
                    provider: {
                        provider: "scripted",
                        model: "m1",
                        stream: function () {
                            return __asyncGenerator(this, arguments, function stream_1() {
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0: return [4 /*yield*/, __await({ type: "content", text: "done" })];
                                        case 1: return [4 /*yield*/, _a.sent()];
                                        case 2:
                                            _a.sent();
                                            return [4 /*yield*/, __await({ type: "done" })];
                                        case 3: return [4 /*yield*/, _a.sent()];
                                        case 4:
                                            _a.sent();
                                            return [2 /*return*/];
                                    }
                                });
                            });
                        },
                    },
                });
                client.start(function () { return undefined; });
                return [4 /*yield*/, ((_b = client.sessionNew) === null || _b === void 0 ? void 0 : _b.call(client))];
            case 2:
                createdA = _g.sent();
                return [4 /*yield*/, ((_c = client.sessionNew) === null || _c === void 0 ? void 0 : _c.call(client))];
            case 3:
                createdB = _g.sent();
                first = (_d = client.submitAndWait) === null || _d === void 0 ? void 0 : _d.call(client, {
                    text: "first session",
                    sessionID: createdA === null || createdA === void 0 ? void 0 : createdA.sessionID,
                });
                second = (_e = client.submitAndWait) === null || _e === void 0 ? void 0 : _e.call(client, {
                    text: "second session",
                    sessionID: createdB === null || createdB === void 0 ? void 0 : createdB.sessionID,
                });
                return [4 /*yield*/, Promise.all([first, second])];
            case 4:
                _a = _g.sent(), a = _a[0], b = _a[1];
                (0, bun_test_1.expect)(a === null || a === void 0 ? void 0 : a.id).toBeTruthy();
                (0, bun_test_1.expect)(b === null || b === void 0 ? void 0 : b.id).toBeTruthy();
                return [4 /*yield*/, ((_f = client.dispose) === null || _f === void 0 ? void 0 : _f.call(client))];
            case 5:
                _g.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("ten sessions submit and finish concurrently without cross-cancel", function () { return __awaiter(void 0, void 0, void 0, function () {
    var workspaceRoot, client, sessions, i, created, tasks, results, _i, results_1, result;
    var _a, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0: return [4 /*yield*/, (0, plugin_test_helpers_1.officialPluginWorkspace)("multi-session-parallel-10")];
            case 1:
                workspaceRoot = _c.sent();
                client = (0, plugin_test_helpers_1.createOfficialRuntimeClient)({
                    workspaceRoot: workspaceRoot,
                    provider: {
                        provider: "scripted",
                        model: "m1",
                        stream: function () {
                            return __asyncGenerator(this, arguments, function stream_2() {
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0: return [4 /*yield*/, __await({ type: "content", text: "done" })];
                                        case 1: return [4 /*yield*/, _a.sent()];
                                        case 2:
                                            _a.sent();
                                            return [4 /*yield*/, __await({ type: "done" })];
                                        case 3: return [4 /*yield*/, _a.sent()];
                                        case 4:
                                            _a.sent();
                                            return [2 /*return*/];
                                    }
                                });
                            });
                        },
                    },
                });
                client.start(function () { return undefined; });
                sessions = [];
                i = 0;
                _c.label = 2;
            case 2:
                if (!(i < 10)) return [3 /*break*/, 5];
                return [4 /*yield*/, ((_a = client.sessionNew) === null || _a === void 0 ? void 0 : _a.call(client))];
            case 3:
                created = _c.sent();
                if (created === null || created === void 0 ? void 0 : created.sessionID)
                    sessions.push(created.sessionID);
                _c.label = 4;
            case 4:
                i++;
                return [3 /*break*/, 2];
            case 5:
                tasks = sessions.map(function (sessionID, index) {
                    var _a;
                    return (_a = client.submitAndWait) === null || _a === void 0 ? void 0 : _a.call(client, {
                        text: "session ".concat(index),
                        sessionID: sessionID,
                    });
                });
                return [4 /*yield*/, Promise.all(tasks)];
            case 6:
                results = _c.sent();
                (0, bun_test_1.expect)(results.length).toBe(10);
                for (_i = 0, results_1 = results; _i < results_1.length; _i++) {
                    result = results_1[_i];
                    (0, bun_test_1.expect)(result === null || result === void 0 ? void 0 : result.id).toBeTruthy();
                }
                return [4 /*yield*/, ((_b = client.dispose) === null || _b === void 0 ? void 0 : _b.call(client))];
            case 7:
                _c.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("twenty sessions submit and finish concurrently without cross-cancel", function () { return __awaiter(void 0, void 0, void 0, function () {
    var workspaceRoot, client, sessions, i, created, tasks, results, _i, results_2, result;
    var _a, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0: return [4 /*yield*/, (0, plugin_test_helpers_1.officialPluginWorkspace)("multi-session-parallel-20")];
            case 1:
                workspaceRoot = _c.sent();
                client = (0, plugin_test_helpers_1.createOfficialRuntimeClient)({
                    workspaceRoot: workspaceRoot,
                    provider: {
                        provider: "scripted",
                        model: "m1",
                        stream: function () {
                            return __asyncGenerator(this, arguments, function stream_3() {
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0: return [4 /*yield*/, __await({ type: "content", text: "done" })];
                                        case 1: return [4 /*yield*/, _a.sent()];
                                        case 2:
                                            _a.sent();
                                            return [4 /*yield*/, __await({ type: "done" })];
                                        case 3: return [4 /*yield*/, _a.sent()];
                                        case 4:
                                            _a.sent();
                                            return [2 /*return*/];
                                    }
                                });
                            });
                        },
                    },
                });
                client.start(function () { return undefined; });
                sessions = [];
                i = 0;
                _c.label = 2;
            case 2:
                if (!(i < 20)) return [3 /*break*/, 5];
                return [4 /*yield*/, ((_a = client.sessionNew) === null || _a === void 0 ? void 0 : _a.call(client))];
            case 3:
                created = _c.sent();
                if (created === null || created === void 0 ? void 0 : created.sessionID)
                    sessions.push(created.sessionID);
                _c.label = 4;
            case 4:
                i++;
                return [3 /*break*/, 2];
            case 5:
                tasks = sessions.map(function (sessionID, index) {
                    var _a;
                    return (_a = client.submitAndWait) === null || _a === void 0 ? void 0 : _a.call(client, {
                        text: "session ".concat(index),
                        sessionID: sessionID,
                    });
                });
                return [4 /*yield*/, Promise.all(tasks)];
            case 6:
                results = _c.sent();
                (0, bun_test_1.expect)(results.length).toBe(20);
                for (_i = 0, results_2 = results; _i < results_2.length; _i++) {
                    result = results_2[_i];
                    (0, bun_test_1.expect)(result === null || result === void 0 ? void 0 : result.id).toBeTruthy();
                }
                return [4 /*yield*/, ((_b = client.dispose) === null || _b === void 0 ? void 0 : _b.call(client))];
            case 7:
                _c.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("fifty sessions submit and finish concurrently without cross-cancel", function () { return __awaiter(void 0, void 0, void 0, function () {
    var workspaceRoot, client, sessions, i, created, tasks, results, _i, results_3, result;
    var _a, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0: return [4 /*yield*/, (0, plugin_test_helpers_1.officialPluginWorkspace)("multi-session-parallel-50")];
            case 1:
                workspaceRoot = _c.sent();
                client = (0, plugin_test_helpers_1.createOfficialRuntimeClient)({
                    workspaceRoot: workspaceRoot,
                    provider: {
                        provider: "scripted",
                        model: "m1",
                        stream: function () {
                            return __asyncGenerator(this, arguments, function stream_4() {
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0: return [4 /*yield*/, __await({ type: "content", text: "done" })];
                                        case 1: return [4 /*yield*/, _a.sent()];
                                        case 2:
                                            _a.sent();
                                            return [4 /*yield*/, __await({ type: "done" })];
                                        case 3: return [4 /*yield*/, _a.sent()];
                                        case 4:
                                            _a.sent();
                                            return [2 /*return*/];
                                    }
                                });
                            });
                        },
                    },
                });
                client.start(function () { return undefined; });
                sessions = [];
                i = 0;
                _c.label = 2;
            case 2:
                if (!(i < 50)) return [3 /*break*/, 5];
                return [4 /*yield*/, ((_a = client.sessionNew) === null || _a === void 0 ? void 0 : _a.call(client))];
            case 3:
                created = _c.sent();
                if (created === null || created === void 0 ? void 0 : created.sessionID)
                    sessions.push(created.sessionID);
                _c.label = 4;
            case 4:
                i++;
                return [3 /*break*/, 2];
            case 5:
                tasks = sessions.map(function (sessionID, index) {
                    var _a;
                    return (_a = client.submitAndWait) === null || _a === void 0 ? void 0 : _a.call(client, {
                        text: "session ".concat(index),
                        sessionID: sessionID,
                    });
                });
                return [4 /*yield*/, Promise.all(tasks)];
            case 6:
                results = _c.sent();
                (0, bun_test_1.expect)(results.length).toBe(50);
                for (_i = 0, results_3 = results; _i < results_3.length; _i++) {
                    result = results_3[_i];
                    (0, bun_test_1.expect)(result === null || result === void 0 ? void 0 : result.id).toBeTruthy();
                }
                return [4 /*yield*/, ((_b = client.dispose) === null || _b === void 0 ? void 0 : _b.call(client))];
            case 7:
                _c.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("hundred sessions submit and finish concurrently without cross-cancel", function () { return __awaiter(void 0, void 0, void 0, function () {
    var workspaceRoot, client, sessions, i, created, tasks, results, _i, results_4, result;
    var _a, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0: return [4 /*yield*/, (0, plugin_test_helpers_1.officialPluginWorkspace)("multi-session-parallel-100")];
            case 1:
                workspaceRoot = _c.sent();
                client = (0, plugin_test_helpers_1.createOfficialRuntimeClient)({
                    workspaceRoot: workspaceRoot,
                    provider: {
                        provider: "scripted",
                        model: "m1",
                        stream: function () {
                            return __asyncGenerator(this, arguments, function stream_5() {
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0: return [4 /*yield*/, __await({ type: "content", text: "done" })];
                                        case 1: return [4 /*yield*/, _a.sent()];
                                        case 2:
                                            _a.sent();
                                            return [4 /*yield*/, __await({ type: "done" })];
                                        case 3: return [4 /*yield*/, _a.sent()];
                                        case 4:
                                            _a.sent();
                                            return [2 /*return*/];
                                    }
                                });
                            });
                        },
                    },
                });
                client.start(function () { return undefined; });
                sessions = [];
                i = 0;
                _c.label = 2;
            case 2:
                if (!(i < 100)) return [3 /*break*/, 5];
                return [4 /*yield*/, ((_a = client.sessionNew) === null || _a === void 0 ? void 0 : _a.call(client))];
            case 3:
                created = _c.sent();
                if (created === null || created === void 0 ? void 0 : created.sessionID)
                    sessions.push(created.sessionID);
                _c.label = 4;
            case 4:
                i++;
                return [3 /*break*/, 2];
            case 5:
                tasks = sessions.map(function (sessionID, index) {
                    var _a;
                    return (_a = client.submitAndWait) === null || _a === void 0 ? void 0 : _a.call(client, {
                        text: "session ".concat(index),
                        sessionID: sessionID,
                    });
                });
                return [4 /*yield*/, Promise.all(tasks)];
            case 6:
                results = _c.sent();
                (0, bun_test_1.expect)(results.length).toBe(100);
                for (_i = 0, results_4 = results; _i < results_4.length; _i++) {
                    result = results_4[_i];
                    (0, bun_test_1.expect)(result === null || result === void 0 ? void 0 : result.id).toBeTruthy();
                }
                return [4 /*yield*/, ((_b = client.dispose) === null || _b === void 0 ? void 0 : _b.call(client))];
            case 7:
                _c.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("two sessions chat concurrently without cross-channel mixing", function () { return __awaiter(void 0, void 0, void 0, function () {
    var workspaceRoot, client, createdA, createdB, a, b, rowsA, rowsB;
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l;
    return __generator(this, function (_m) {
        switch (_m.label) {
            case 0: return [4 /*yield*/, (0, plugin_test_helpers_1.officialPluginWorkspace)("multi-session-parallel-chat")];
            case 1:
                workspaceRoot = _m.sent();
                client = (0, plugin_test_helpers_1.createOfficialRuntimeClient)({
                    workspaceRoot: workspaceRoot,
                    provider: {
                        provider: "scripted",
                        model: "m1",
                        stream: function () {
                            return __asyncGenerator(this, arguments, function stream_6() {
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0: return [4 /*yield*/, __await({ type: "content", text: "chat reply" })];
                                        case 1: return [4 /*yield*/, _a.sent()];
                                        case 2:
                                            _a.sent();
                                            return [4 /*yield*/, __await({ type: "done" })];
                                        case 3: return [4 /*yield*/, _a.sent()];
                                        case 4:
                                            _a.sent();
                                            return [2 /*return*/];
                                    }
                                });
                            });
                        },
                    },
                });
                client.start(function () { return undefined; });
                return [4 /*yield*/, ((_a = client.sessionNew) === null || _a === void 0 ? void 0 : _a.call(client))];
            case 2:
                createdA = _m.sent();
                return [4 /*yield*/, ((_b = client.sessionNew) === null || _b === void 0 ? void 0 : _b.call(client))];
            case 3:
                createdB = _m.sent();
                return [4 /*yield*/, ((_d = (_c = client.naviChat) === null || _c === void 0 ? void 0 : _c.submit) === null || _d === void 0 ? void 0 : _d.call(_c, {
                        text: "chat a",
                        sessionID: createdA === null || createdA === void 0 ? void 0 : createdA.sessionID,
                    }))];
            case 4:
                a = _m.sent();
                return [4 /*yield*/, ((_f = (_e = client.naviChat) === null || _e === void 0 ? void 0 : _e.submit) === null || _f === void 0 ? void 0 : _f.call(_e, {
                        text: "chat b",
                        sessionID: createdB === null || createdB === void 0 ? void 0 : createdB.sessionID,
                    }))];
            case 5:
                b = _m.sent();
                (0, bun_test_1.expect)(a === null || a === void 0 ? void 0 : a.messageID).toBeTruthy();
                (0, bun_test_1.expect)(b === null || b === void 0 ? void 0 : b.messageID).toBeTruthy();
                return [4 /*yield*/, ((_h = (_g = client.naviChat) === null || _g === void 0 ? void 0 : _g.messages) === null || _h === void 0 ? void 0 : _h.call(_g, createdA === null || createdA === void 0 ? void 0 : createdA.sessionID))];
            case 6:
                rowsA = _m.sent();
                return [4 /*yield*/, ((_k = (_j = client.naviChat) === null || _j === void 0 ? void 0 : _j.messages) === null || _k === void 0 ? void 0 : _k.call(_j, createdB === null || createdB === void 0 ? void 0 : createdB.sessionID))];
            case 7:
                rowsB = _m.sent();
                (0, bun_test_1.expect)(rowsA === null || rowsA === void 0 ? void 0 : rowsA.some(function (row) { return row.text.includes("chat a"); })).toBe(true);
                (0, bun_test_1.expect)(rowsB === null || rowsB === void 0 ? void 0 : rowsB.some(function (row) { return row.text.includes("chat b"); })).toBe(true);
                (0, bun_test_1.expect)(rowsA === null || rowsA === void 0 ? void 0 : rowsA.some(function (row) { return row.text.includes("chat b"); })).toBe(false);
                (0, bun_test_1.expect)(rowsB === null || rowsB === void 0 ? void 0 : rowsB.some(function (row) { return row.text.includes("chat a"); })).toBe(false);
                return [4 /*yield*/, ((_l = client.dispose) === null || _l === void 0 ? void 0 : _l.call(client))];
            case 8:
                _m.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("two sessions mailbox messages do not leak across sessions", function () { return __awaiter(void 0, void 0, void 0, function () {
    var workspaceRoot, client, createdA, createdB, rowsA, rowsB;
    var _a, _b, _c, _d, _e, _f, _g;
    return __generator(this, function (_h) {
        switch (_h.label) {
            case 0: return [4 /*yield*/, (0, plugin_test_helpers_1.officialPluginWorkspace)("multi-session-parallel-mailbox")];
            case 1:
                workspaceRoot = _h.sent();
                client = (0, plugin_test_helpers_1.createOfficialRuntimeClient)({
                    workspaceRoot: workspaceRoot,
                    provider: {
                        provider: "scripted",
                        model: "m1",
                        stream: function () {
                            return __asyncGenerator(this, arguments, function stream_7() {
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0: return [4 /*yield*/, __await({ type: "content", text: "done" })];
                                        case 1: return [4 /*yield*/, _a.sent()];
                                        case 2:
                                            _a.sent();
                                            return [4 /*yield*/, __await({ type: "done" })];
                                        case 3: return [4 /*yield*/, _a.sent()];
                                        case 4:
                                            _a.sent();
                                            return [2 /*return*/];
                                    }
                                });
                            });
                        },
                    },
                });
                client.start(function () { return undefined; });
                return [4 /*yield*/, ((_a = client.sessionNew) === null || _a === void 0 ? void 0 : _a.call(client))];
            case 2:
                createdA = _h.sent();
                return [4 /*yield*/, ((_b = client.sessionNew) === null || _b === void 0 ? void 0 : _b.call(client))];
            case 3:
                createdB = _h.sent();
                return [4 /*yield*/, ((_c = client.mailboxSend) === null || _c === void 0 ? void 0 : _c.call(client, {
                        intent: "request_report",
                        text: "mailbox for A",
                        sessionID: createdA === null || createdA === void 0 ? void 0 : createdA.sessionID,
                    }))];
            case 4:
                _h.sent();
                return [4 /*yield*/, ((_d = client.mailboxSend) === null || _d === void 0 ? void 0 : _d.call(client, {
                        intent: "request_report",
                        text: "mailbox for B",
                        sessionID: createdB === null || createdB === void 0 ? void 0 : createdB.sessionID,
                    }))];
            case 5:
                _h.sent();
                return [4 /*yield*/, ((_e = client.mailboxList) === null || _e === void 0 ? void 0 : _e.call(client, createdA === null || createdA === void 0 ? void 0 : createdA.sessionID))];
            case 6:
                rowsA = _h.sent();
                return [4 /*yield*/, ((_f = client.mailboxList) === null || _f === void 0 ? void 0 : _f.call(client, createdB === null || createdB === void 0 ? void 0 : createdB.sessionID))];
            case 7:
                rowsB = _h.sent();
                (0, bun_test_1.expect)(rowsA === null || rowsA === void 0 ? void 0 : rowsA.some(function (row) { return row.text.includes("mailbox for A"); })).toBe(true);
                (0, bun_test_1.expect)(rowsB === null || rowsB === void 0 ? void 0 : rowsB.some(function (row) { return row.text.includes("mailbox for B"); })).toBe(true);
                (0, bun_test_1.expect)(rowsA === null || rowsA === void 0 ? void 0 : rowsA.some(function (row) { return row.text.includes("mailbox for B"); })).toBe(false);
                (0, bun_test_1.expect)(rowsB === null || rowsB === void 0 ? void 0 : rowsB.some(function (row) { return row.text.includes("mailbox for A"); })).toBe(false);
                return [4 /*yield*/, ((_g = client.dispose) === null || _g === void 0 ? void 0 : _g.call(client))];
            case 8:
                _h.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("two sessions runtimeStatus resolve independently", function () { return __awaiter(void 0, void 0, void 0, function () {
    var workspaceRoot, client, createdA, createdB, statusA, statusB;
    var _a, _b, _c, _d, _e, _f, _g;
    return __generator(this, function (_h) {
        switch (_h.label) {
            case 0: return [4 /*yield*/, (0, plugin_test_helpers_1.officialPluginWorkspace)("multi-session-parallel-status")];
            case 1:
                workspaceRoot = _h.sent();
                client = (0, plugin_test_helpers_1.createOfficialRuntimeClient)({
                    workspaceRoot: workspaceRoot,
                    provider: {
                        provider: "scripted",
                        model: "m1",
                        stream: function () {
                            return __asyncGenerator(this, arguments, function stream_8() {
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0: return [4 /*yield*/, __await({ type: "content", text: "done" })];
                                        case 1: return [4 /*yield*/, _a.sent()];
                                        case 2:
                                            _a.sent();
                                            return [4 /*yield*/, __await({ type: "done" })];
                                        case 3: return [4 /*yield*/, _a.sent()];
                                        case 4:
                                            _a.sent();
                                            return [2 /*return*/];
                                    }
                                });
                            });
                        },
                    },
                });
                client.start(function () { return undefined; });
                return [4 /*yield*/, ((_a = client.sessionNew) === null || _a === void 0 ? void 0 : _a.call(client))];
            case 2:
                createdA = _h.sent();
                return [4 /*yield*/, ((_b = client.sessionNew) === null || _b === void 0 ? void 0 : _b.call(client))];
            case 3:
                createdB = _h.sent();
                return [4 /*yield*/, ((_c = client.submitAndWait) === null || _c === void 0 ? void 0 : _c.call(client, { text: "a", sessionID: createdA === null || createdA === void 0 ? void 0 : createdA.sessionID }))];
            case 4:
                _h.sent();
                return [4 /*yield*/, ((_d = client.submitAndWait) === null || _d === void 0 ? void 0 : _d.call(client, { text: "b", sessionID: createdB === null || createdB === void 0 ? void 0 : createdB.sessionID }))];
            case 5:
                _h.sent();
                return [4 /*yield*/, ((_e = client.runtimeStatus) === null || _e === void 0 ? void 0 : _e.call(client, createdA === null || createdA === void 0 ? void 0 : createdA.sessionID))];
            case 6:
                statusA = _h.sent();
                return [4 /*yield*/, ((_f = client.runtimeStatus) === null || _f === void 0 ? void 0 : _f.call(client, createdB === null || createdB === void 0 ? void 0 : createdB.sessionID))];
            case 7:
                statusB = _h.sent();
                (0, bun_test_1.expect)(statusA).toBeTruthy();
                (0, bun_test_1.expect)(statusB).toBeTruthy();
                return [4 /*yield*/, ((_g = client.dispose) === null || _g === void 0 ? void 0 : _g.call(client))];
            case 8:
                _h.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("two sessions provider/model and reasoning selections remain isolated", function () { return __awaiter(void 0, void 0, void 0, function () {
    var workspaceRoot, modelConfig, globalConfigPath, client, createdA, createdB, sessionID_A, sessionID_B, _a, _b, _c, _d;
    var _e, _f, _g, _h, _j, _k, _l, _m, _o;
    return __generator(this, function (_p) {
        switch (_p.label) {
            case 0: return [4 /*yield*/, (0, plugin_test_helpers_1.officialPluginWorkspace)("multi-session-parallel-provider")];
            case 1:
                workspaceRoot = _p.sent();
                return [4 /*yield*/, (0, promises_1.mkdir)((0, node_path_1.join)(workspaceRoot, ".natalia"), { recursive: true })];
            case 2:
                _p.sent();
                modelConfig = {
                    version: 3,
                    providers: {
                        local: {
                            name: "Local",
                            driver: "openai",
                            enabled: true,
                            connection: { apiKey: "test", baseURL: "http://127.0.0.1:9" },
                        },
                    },
                    catalog: {
                        providers: {
                            local: {
                                models: {
                                    alpha: { name: "alpha" },
                                    beta: { name: "beta" },
                                },
                            },
                        },
                    },
                    defaultModel: { provider: "local", model: "alpha" },
                };
                globalConfigPath = (0, node_path_1.join)(workspaceRoot, ".natalia-test-global.json");
                return [4 /*yield*/, (0, promises_1.writeFile)(globalConfigPath, JSON.stringify(modelConfig))];
            case 3:
                _p.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(workspaceRoot, ".natalia", "config.json"), JSON.stringify(modelConfig))];
            case 4:
                _p.sent();
                client = (0, plugin_test_helpers_1.createOfficialRuntimeClient)({
                    workspaceRoot: workspaceRoot,
                    globalConfigPath: globalConfigPath,
                    provider: {
                        provider: "scripted",
                        model: "alpha",
                        stream: function () {
                            return __asyncGenerator(this, arguments, function stream_9() {
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0: return [4 /*yield*/, __await({ type: "content", text: "done" })];
                                        case 1: return [4 /*yield*/, _a.sent()];
                                        case 2:
                                            _a.sent();
                                            return [4 /*yield*/, __await({ type: "done" })];
                                        case 3: return [4 /*yield*/, _a.sent()];
                                        case 4:
                                            _a.sent();
                                            return [2 /*return*/];
                                    }
                                });
                            });
                        },
                    },
                });
                client.start(function () { return undefined; });
                return [4 /*yield*/, ((_e = client.sessionNew) === null || _e === void 0 ? void 0 : _e.call(client))];
            case 5:
                createdA = _p.sent();
                return [4 /*yield*/, ((_f = client.sessionNew) === null || _f === void 0 ? void 0 : _f.call(client))];
            case 6:
                createdB = _p.sent();
                sessionID_A = createdA === null || createdA === void 0 ? void 0 : createdA.sessionID;
                sessionID_B = createdB === null || createdB === void 0 ? void 0 : createdB.sessionID;
                return [4 /*yield*/, ((_g = client.selectModel) === null || _g === void 0 ? void 0 : _g.call(client, "local/beta", undefined, sessionID_A))];
            case 7:
                _p.sent();
                return [4 /*yield*/, ((_h = client.setReasoningEffort) === null || _h === void 0 ? void 0 : _h.call(client, "high", sessionID_A))];
            case 8:
                _p.sent();
                _a = bun_test_1.expect;
                return [4 /*yield*/, ((_j = client.modelSelection) === null || _j === void 0 ? void 0 : _j.call(client, sessionID_A))];
            case 9:
                _a.apply(void 0, [_p.sent()]).toMatchObject({
                    modelID: "local/beta",
                });
                _b = bun_test_1.expect;
                return [4 /*yield*/, ((_k = client.modelSelection) === null || _k === void 0 ? void 0 : _k.call(client, sessionID_B))];
            case 10:
                _b.apply(void 0, [_p.sent()]).toMatchObject({
                    modelID: "local/alpha",
                });
                _c = bun_test_1.expect;
                return [4 /*yield*/, ((_l = client.reasoningEffort) === null || _l === void 0 ? void 0 : _l.call(client, sessionID_A))];
            case 11:
                _c.apply(void 0, [_p.sent()]).toBe("high");
                _d = bun_test_1.expect;
                return [4 /*yield*/, ((_m = client.reasoningEffort) === null || _m === void 0 ? void 0 : _m.call(client, sessionID_B))];
            case 12:
                _d.apply(void 0, [_p.sent()]).toBeUndefined();
                return [4 /*yield*/, ((_o = client.dispose) === null || _o === void 0 ? void 0 : _o.call(client))];
            case 13:
                _p.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("fifty sessions run concurrently through a real OpenAI-compatible HTTP provider", function () { return __awaiter(void 0, void 0, void 0, function () {
    var workspaceRoot, requests, server, modelConfig, globalConfigPath, client_1, sessions, i, created, tasks, results, _i, results_5, result;
    var _a, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0: return [4 /*yield*/, (0, plugin_test_helpers_1.officialPluginWorkspace)("multi-session-parallel-http-provider")];
            case 1:
                workspaceRoot = _c.sent();
                requests = [];
                server = Bun.serve({
                    port: 0,
                    fetch: function (request) {
                        return __awaiter(this, void 0, void 0, function () {
                            var body, text;
                            var _a, _b;
                            return __generator(this, function (_c) {
                                switch (_c.label) {
                                    case 0: return [4 /*yield*/, request.json()];
                                    case 1:
                                        body = (_c.sent());
                                        requests.push(body);
                                        text = (_b = (_a = body.messages.filter(function (message) { return message.role === "user"; }).at(-1)) === null || _a === void 0 ? void 0 : _a.content) !== null && _b !== void 0 ? _b : "";
                                        return [2 /*return*/, new Response([
                                                "data: ".concat(JSON.stringify({
                                                    choices: [{ delta: { content: "done:".concat(text) } }],
                                                })),
                                                "",
                                                "data: [DONE]",
                                                "",
                                            ].join("\n"), { headers: { "content-type": "text/event-stream" } })];
                                }
                            });
                        });
                    },
                });
                _c.label = 2;
            case 2:
                _c.trys.push([2, , 12, 13]);
                return [4 /*yield*/, (0, promises_1.mkdir)((0, node_path_1.join)(workspaceRoot, ".natalia"), { recursive: true })];
            case 3:
                _c.sent();
                modelConfig = {
                    version: 3,
                    providers: {
                        local: {
                            name: "local",
                            driver: "openai",
                            enabled: true,
                            connection: {
                                apiKey: "local-key",
                                baseURL: server.url.toString(),
                            },
                        },
                    },
                    catalog: {
                        providers: {
                            local: {
                                models: {
                                    alpha: { name: "alpha" },
                                },
                            },
                        },
                    },
                    defaultModel: { provider: "local", model: "alpha" },
                };
                globalConfigPath = (0, node_path_1.join)(workspaceRoot, ".natalia-test-global.json");
                return [4 /*yield*/, (0, promises_1.writeFile)(globalConfigPath, JSON.stringify(modelConfig))];
            case 4:
                _c.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(workspaceRoot, ".natalia", "config.json"), JSON.stringify(modelConfig))];
            case 5:
                _c.sent();
                client_1 = (0, plugin_test_helpers_1.createOfficialRuntimeClient)({
                    workspaceRoot: workspaceRoot,
                    globalConfigPath: globalConfigPath,
                    permissionMode: "auto",
                });
                client_1.start(function () { return undefined; });
                sessions = [];
                i = 0;
                _c.label = 6;
            case 6:
                if (!(i < 50)) return [3 /*break*/, 9];
                return [4 /*yield*/, ((_a = client_1.sessionNew) === null || _a === void 0 ? void 0 : _a.call(client_1))];
            case 7:
                created = _c.sent();
                if (created === null || created === void 0 ? void 0 : created.sessionID)
                    sessions.push(created.sessionID);
                _c.label = 8;
            case 8:
                i++;
                return [3 /*break*/, 6];
            case 9:
                tasks = sessions.map(function (sessionID, index) {
                    var _a;
                    return (_a = client_1.submitAndWait) === null || _a === void 0 ? void 0 : _a.call(client_1, {
                        text: "real provider session ".concat(index),
                        sessionID: sessionID,
                    });
                });
                return [4 /*yield*/, Promise.all(tasks)];
            case 10:
                results = _c.sent();
                (0, bun_test_1.expect)(results.length).toBe(50);
                for (_i = 0, results_5 = results; _i < results_5.length; _i++) {
                    result = results_5[_i];
                    (0, bun_test_1.expect)(result === null || result === void 0 ? void 0 : result.id).toBeTruthy();
                }
                (0, bun_test_1.expect)(requests.length).toBeGreaterThanOrEqual(50);
                return [4 /*yield*/, ((_b = client_1.dispose) === null || _b === void 0 ? void 0 : _b.call(client_1))];
            case 11:
                _c.sent();
                return [3 /*break*/, 13];
            case 12:
                server.stop(true);
                return [7 /*endfinally*/];
            case 13: return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("two sessions diagnostics resolve independently", function () { return __awaiter(void 0, void 0, void 0, function () {
    var workspaceRoot, client, createdA, createdB, diagA, diagB;
    var _a, _b, _c, _d, _e;
    return __generator(this, function (_f) {
        switch (_f.label) {
            case 0: return [4 /*yield*/, (0, plugin_test_helpers_1.officialPluginWorkspace)("multi-session-parallel-diag")];
            case 1:
                workspaceRoot = _f.sent();
                client = (0, plugin_test_helpers_1.createOfficialRuntimeClient)({
                    workspaceRoot: workspaceRoot,
                    provider: {
                        provider: "scripted",
                        model: "m1",
                        stream: function () {
                            return __asyncGenerator(this, arguments, function stream_10() {
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0: return [4 /*yield*/, __await({ type: "content", text: "done" })];
                                        case 1: return [4 /*yield*/, _a.sent()];
                                        case 2:
                                            _a.sent();
                                            return [4 /*yield*/, __await({ type: "done" })];
                                        case 3: return [4 /*yield*/, _a.sent()];
                                        case 4:
                                            _a.sent();
                                            return [2 /*return*/];
                                    }
                                });
                            });
                        },
                    },
                });
                client.start(function () { return undefined; });
                return [4 /*yield*/, ((_a = client.sessionNew) === null || _a === void 0 ? void 0 : _a.call(client))];
            case 2:
                createdA = _f.sent();
                return [4 /*yield*/, ((_b = client.sessionNew) === null || _b === void 0 ? void 0 : _b.call(client))];
            case 3:
                createdB = _f.sent();
                return [4 /*yield*/, ((_c = client.diagnostics) === null || _c === void 0 ? void 0 : _c.call(client, 100, createdA === null || createdA === void 0 ? void 0 : createdA.sessionID))];
            case 4:
                diagA = _f.sent();
                return [4 /*yield*/, ((_d = client.diagnostics) === null || _d === void 0 ? void 0 : _d.call(client, 100, createdB === null || createdB === void 0 ? void 0 : createdB.sessionID))];
            case 5:
                diagB = _f.sent();
                (0, bun_test_1.expect)(Array.isArray(diagA)).toBe(true);
                (0, bun_test_1.expect)(Array.isArray(diagB)).toBe(true);
                return [4 /*yield*/, ((_e = client.dispose) === null || _e === void 0 ? void 0 : _e.call(client))];
            case 6:
                _f.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("two hundred sessions submit and finish concurrently without cross-cancel", function () { return __awaiter(void 0, void 0, void 0, function () {
    var workspaceRoot, client, sessions, i, created, tasks, results, _i, results_6, result;
    var _a, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0: return [4 /*yield*/, (0, plugin_test_helpers_1.officialPluginWorkspace)("multi-session-parallel-200")];
            case 1:
                workspaceRoot = _c.sent();
                client = (0, plugin_test_helpers_1.createOfficialRuntimeClient)({
                    workspaceRoot: workspaceRoot,
                    provider: {
                        provider: "scripted",
                        model: "m1",
                        stream: function () {
                            return __asyncGenerator(this, arguments, function stream_11() {
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0: return [4 /*yield*/, __await({ type: "content", text: "done" })];
                                        case 1: return [4 /*yield*/, _a.sent()];
                                        case 2:
                                            _a.sent();
                                            return [4 /*yield*/, __await({ type: "done" })];
                                        case 3: return [4 /*yield*/, _a.sent()];
                                        case 4:
                                            _a.sent();
                                            return [2 /*return*/];
                                    }
                                });
                            });
                        },
                    },
                });
                client.start(function () { return undefined; });
                sessions = [];
                i = 0;
                _c.label = 2;
            case 2:
                if (!(i < 200)) return [3 /*break*/, 5];
                return [4 /*yield*/, ((_a = client.sessionNew) === null || _a === void 0 ? void 0 : _a.call(client))];
            case 3:
                created = _c.sent();
                if (created === null || created === void 0 ? void 0 : created.sessionID)
                    sessions.push(created.sessionID);
                _c.label = 4;
            case 4:
                i++;
                return [3 /*break*/, 2];
            case 5:
                tasks = sessions.map(function (sessionID, index) {
                    var _a;
                    return (_a = client.submitAndWait) === null || _a === void 0 ? void 0 : _a.call(client, {
                        text: "session ".concat(index),
                        sessionID: sessionID,
                    });
                });
                return [4 /*yield*/, Promise.all(tasks)];
            case 6:
                results = _c.sent();
                (0, bun_test_1.expect)(results.length).toBe(200);
                for (_i = 0, results_6 = results; _i < results_6.length; _i++) {
                    result = results_6[_i];
                    (0, bun_test_1.expect)(result === null || result === void 0 ? void 0 : result.id).toBeTruthy();
                }
                return [4 /*yield*/, ((_b = client.dispose) === null || _b === void 0 ? void 0 : _b.call(client))];
            case 7:
                _c.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("five hundred sessions submit and finish concurrently without cross-cancel", function () { return __awaiter(void 0, void 0, void 0, function () {
    var workspaceRoot, client, sessions, i, created, tasks, results, _i, results_7, result;
    var _a, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0: return [4 /*yield*/, (0, plugin_test_helpers_1.officialPluginWorkspace)("multi-session-parallel-500")];
            case 1:
                workspaceRoot = _c.sent();
                client = (0, plugin_test_helpers_1.createOfficialRuntimeClient)({
                    workspaceRoot: workspaceRoot,
                    provider: {
                        provider: "scripted",
                        model: "m1",
                        stream: function () {
                            return __asyncGenerator(this, arguments, function stream_12() {
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0: return [4 /*yield*/, __await({ type: "content", text: "done" })];
                                        case 1: return [4 /*yield*/, _a.sent()];
                                        case 2:
                                            _a.sent();
                                            return [4 /*yield*/, __await({ type: "done" })];
                                        case 3: return [4 /*yield*/, _a.sent()];
                                        case 4:
                                            _a.sent();
                                            return [2 /*return*/];
                                    }
                                });
                            });
                        },
                    },
                });
                client.start(function () { return undefined; });
                sessions = [];
                i = 0;
                _c.label = 2;
            case 2:
                if (!(i < 500)) return [3 /*break*/, 5];
                return [4 /*yield*/, ((_a = client.sessionNew) === null || _a === void 0 ? void 0 : _a.call(client))];
            case 3:
                created = _c.sent();
                if (created === null || created === void 0 ? void 0 : created.sessionID)
                    sessions.push(created.sessionID);
                _c.label = 4;
            case 4:
                i++;
                return [3 /*break*/, 2];
            case 5:
                tasks = sessions.map(function (sessionID, index) {
                    var _a;
                    return (_a = client.submitAndWait) === null || _a === void 0 ? void 0 : _a.call(client, {
                        text: "session ".concat(index),
                        sessionID: sessionID,
                    });
                });
                return [4 /*yield*/, Promise.all(tasks)];
            case 6:
                results = _c.sent();
                (0, bun_test_1.expect)(results.length).toBe(500);
                for (_i = 0, results_7 = results; _i < results_7.length; _i++) {
                    result = results_7[_i];
                    (0, bun_test_1.expect)(result === null || result === void 0 ? void 0 : result.id).toBeTruthy();
                }
                return [4 /*yield*/, ((_b = client.dispose) === null || _b === void 0 ? void 0 : _b.call(client))];
            case 7:
                _c.sent();
                return [2 /*return*/];
        }
    });
}); });
