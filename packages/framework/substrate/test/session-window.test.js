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
var substrate_1 = require("@anthelia/substrate");
function event(seq) {
    return { seq: seq, text: "event-".concat(seq) };
}
function page(events, hasMore) {
    return { events: events, hasMore: hasMore };
}
(0, bun_test_1.test)("session window opens on a contiguous tail page", function () { return __awaiter(void 0, void 0, void 0, function () {
    var window;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                window = new substrate_1.SessionWindow({
                    loader: {
                        loadTail: function () { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/, page([event(3), event(4), event(5)], true)];
                        }); }); },
                        loadBefore: function () { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/, page([], false)];
                        }); }); },
                    },
                });
                return [4 /*yield*/, window.open()];
            case 1:
                _a.sent();
                (0, bun_test_1.expect)(window.openState).toBe("open");
                (0, bun_test_1.expect)(window.eventsView.map(function (item) { return item.seq; })).toEqual([3, 4, 5]);
                (0, bun_test_1.expect)(window.baseSeq).toBe(3);
                (0, bun_test_1.expect)(window.tailSeq).toBe(5);
                (0, bun_test_1.expect)(window.hasMore).toBe(true);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("session window prepends one contiguous older page", function () { return __awaiter(void 0, void 0, void 0, function () {
    var before, window, _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                before = [];
                window = new substrate_1.SessionWindow({
                    loader: {
                        loadTail: function () { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/, page([event(4), event(5)], true)];
                        }); }); },
                        loadBefore: function (beforeSeq) { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                before.push(beforeSeq);
                                return [2 /*return*/, page([event(2), event(3)], false)];
                            });
                        }); },
                    },
                });
                return [4 /*yield*/, window.open()];
            case 1:
                _b.sent();
                _a = bun_test_1.expect;
                return [4 /*yield*/, window.loadOlder()];
            case 2:
                _a.apply(void 0, [_b.sent()]).toBe(true);
                (0, bun_test_1.expect)(before).toEqual([4]);
                (0, bun_test_1.expect)(window.eventsView.map(function (item) { return item.seq; })).toEqual([2, 3, 4, 5]);
                (0, bun_test_1.expect)(window.baseSeq).toBe(2);
                (0, bun_test_1.expect)(window.hasMore).toBe(false);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("session window rejects a discontinuous older page", function () { return __awaiter(void 0, void 0, void 0, function () {
    var window, _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                window = new substrate_1.SessionWindow({
                    loader: {
                        loadTail: function () { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/, page([event(5), event(6)], true)];
                        }); }); },
                        loadBefore: function () { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/, page([event(2), event(4)], true)];
                        }); }); },
                    },
                });
                return [4 /*yield*/, window.open()];
            case 1:
                _b.sent();
                _a = bun_test_1.expect;
                return [4 /*yield*/, window.loadOlder()];
            case 2:
                _a.apply(void 0, [_b.sent()]).toBe(false);
                (0, bun_test_1.expect)(window.eventsView.map(function (item) { return item.seq; })).toEqual([5, 6]);
                (0, bun_test_1.expect)(window.hasMore).toBe(false);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("session window appends in-order live events and drops overlap", function () { return __awaiter(void 0, void 0, void 0, function () {
    var window;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                window = new substrate_1.SessionWindow({
                    loader: {
                        loadTail: function () { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/, page([event(1), event(2)], false)];
                        }); }); },
                        loadBefore: function () { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/, page([], false)];
                        }); }); },
                    },
                });
                return [4 /*yield*/, window.open()];
            case 1:
                _a.sent();
                (0, bun_test_1.expect)(window.acceptLive(event(3))).toBe(true);
                (0, bun_test_1.expect)(window.acceptLive(event(2))).toBe(false);
                (0, bun_test_1.expect)(window.eventsView.map(function (item) { return item.seq; })).toEqual([1, 2, 3]);
                (0, bun_test_1.expect)(window.tailSeq).toBe(3);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("session window repairs a live gap and stitches buffered events", function () { return __awaiter(void 0, void 0, void 0, function () {
    var tailCalls, gaps, window;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                tailCalls = 0;
                gaps = [];
                window = new substrate_1.SessionWindow({
                    loader: {
                        loadTail: function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                tailCalls += 1;
                                return [2 /*return*/, tailCalls === 1
                                        ? page([event(1), event(2)], true)
                                        : page([event(3), event(4)], true)];
                            });
                        }); },
                        loadBefore: function () { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/, page([], false)];
                        }); }); },
                    },
                    onGap: function (item) { return gaps.push(item.seq); },
                });
                return [4 /*yield*/, window.open()];
            case 1:
                _a.sent();
                (0, bun_test_1.expect)(window.acceptLive(event(4))).toBe(false);
                (0, bun_test_1.expect)(gaps).toEqual([4]);
                return [4 /*yield*/, Bun.sleep(0)];
            case 2:
                _a.sent();
                (0, bun_test_1.expect)(window.eventsView.map(function (item) { return item.seq; })).toEqual([3, 4]);
                (0, bun_test_1.expect)(window.baseSeq).toBe(3);
                (0, bun_test_1.expect)(window.bufferedCount).toBe(0);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("session window resync clears the old window before reopening", function () { return __awaiter(void 0, void 0, void 0, function () {
    var tailCalls, window;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                tailCalls = 0;
                window = new substrate_1.SessionWindow({
                    loader: {
                        loadTail: function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                tailCalls += 1;
                                return [2 /*return*/, tailCalls === 1
                                        ? page([event(1), event(2)], false)
                                        : page([event(8), event(9)], false)];
                            });
                        }); },
                        loadBefore: function () { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/, page([], false)];
                        }); }); },
                    },
                });
                return [4 /*yield*/, window.open()];
            case 1:
                _a.sent();
                return [4 /*yield*/, window.resync()];
            case 2:
                _a.sent();
                (0, bun_test_1.expect)(window.eventsView.map(function (item) { return item.seq; })).toEqual([8, 9]);
                (0, bun_test_1.expect)(window.baseSeq).toBe(8);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("runtime event window loader preserves the per-session cursor", function () { return __awaiter(void 0, void 0, void 0, function () {
    var calls, runtime, loader, tail, older;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                calls = [];
                runtime = {
                    eventWindow: function (options) {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                calls.push({ beforeSeq: options === null || options === void 0 ? void 0 : options.beforeSeq, limit: options === null || options === void 0 ? void 0 : options.limit });
                                if ((options === null || options === void 0 ? void 0 : options.beforeSeq) === undefined)
                                    return [2 /*return*/, {
                                            events: [
                                                { seq: 30, sessionSeq: 3, event: event(3) },
                                                { seq: 40, sessionSeq: 4, event: event(4) },
                                            ],
                                            hasMore: true,
                                        }];
                                return [2 /*return*/, {
                                        events: [
                                            { seq: 10, sessionSeq: 1, event: event(1) },
                                            { seq: 20, sessionSeq: 2, event: event(2) },
                                        ],
                                        hasMore: false,
                                    }];
                            });
                        });
                    },
                };
                loader = (0, substrate_1.createRuntimeEventWindowLoader)(runtime, "ses_window", 2);
                return [4 /*yield*/, loader.loadTail()];
            case 1:
                tail = _a.sent();
                (0, bun_test_1.expect)(tail.events.map(function (entry) { return entry.seq; })).toEqual([3, 4]);
                (0, bun_test_1.expect)(tail.hasMore).toBe(true);
                return [4 /*yield*/, loader.loadBefore(3)];
            case 2:
                older = _a.sent();
                (0, bun_test_1.expect)(older.events.map(function (entry) { return entry.seq; })).toEqual([1, 2]);
                (0, bun_test_1.expect)(calls).toEqual([
                    { beforeSeq: undefined, limit: 2 },
                    { beforeSeq: 3, limit: 2 },
                ]);
                return [2 /*return*/];
        }
    });
}); });
