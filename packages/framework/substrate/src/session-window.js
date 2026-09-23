"use strict";
/**
 * One contiguous, paged session window.
 *
 * This is the shared window/pagination primitive for every session surface
 * (main transcript, Navi, Nia, subagent, trajectory). It deliberately owns
 * only the data-window rules: tail install, older-page prepend, live append,
 * gap buffering, and resync. Rendering, virtualisation and scroll ownership
 * stay outside this module so there is exactly one window implementation.
 *
 * The loader contract is sequence based. A page is accepted only when it is
 * internally contiguous and, for an older page, its tail touches the current
 * `baseSeq`. A live event is accepted only when it extends the window tail by
 * exactly one sequence; anything ahead is buffered and repaired by reloading
 * the tail page.
 */
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
exports.SessionWindow = void 0;
exports.createRuntimeEventWindowLoader = createRuntimeEventWindowLoader;
function eventWindowPage(page) {
    var next = 1;
    return {
        events: page.events.map(function (item) {
            var _a;
            var seq = (_a = item.sessionSeq) !== null && _a !== void 0 ? _a : next;
            next = seq + 1;
            return { seq: seq, event: item.event };
        }),
        hasMore: page.hasMore,
    };
}
/**
 * Adapt the runtime's `session.eventWindow` RPC to the shared window primitive.
 *
 * The returned loader is the only paging adapter UI surfaces should use. It
 * preserves the server's per-session cursor and fails closed when the runtime
 * does not expose the window API.
 */
function createRuntimeEventWindowLoader(runtime, sessionID, pageSize) {
    var _this = this;
    if (pageSize === void 0) { pageSize = 50; }
    var load = function (options) { return __awaiter(_this, void 0, void 0, function () {
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    if (runtime.eventWindow === undefined)
                        throw new Error("runtime does not expose session.eventWindow");
                    _a = eventWindowPage;
                    return [4 /*yield*/, runtime.eventWindow(__assign({ sessionID: sessionID, limit: options.limit }, (options.beforeSeq === undefined
                            ? {}
                            : { beforeSeq: options.beforeSeq })))];
                case 1: return [2 /*return*/, _a.apply(void 0, [_b.sent()])];
            }
        });
    }); };
    return {
        loadTail: function () { return load({ limit: pageSize }); },
        loadBefore: function (beforeSeq) { return load({ beforeSeq: beforeSeq, limit: pageSize }); },
    };
}
function isContiguous(events) {
    for (var index = 1; index < events.length; index++) {
        if (events[index].seq !== events[index - 1].seq + 1)
            return false;
    }
    return true;
}
/**
 * Shared session event window.
 *
 * All methods are serialised by an internal promise chain so a caller cannot
 * start a second open/load/repair while one is in flight.
 */
var SessionWindow = /** @class */ (function () {
    function SessionWindow(options) {
        this.options = options;
        this.events = [];
        this.baseSeqValue = null;
        this.hasMoreValue = false;
        this.loadingOlderValue = false;
        this.openStateValue = "cold";
        this.liveBuffer = [];
        this.repairInFlight = null;
        this.queue = Promise.resolve();
    }
    Object.defineProperty(SessionWindow.prototype, "eventsView", {
        get: function () {
            return this.events;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(SessionWindow.prototype, "baseSeq", {
        get: function () {
            return this.baseSeqValue;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(SessionWindow.prototype, "tailSeq", {
        get: function () {
            var _a, _b;
            return (_b = (_a = this.events.at(-1)) === null || _a === void 0 ? void 0 : _a.seq) !== null && _b !== void 0 ? _b : null;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(SessionWindow.prototype, "hasMore", {
        get: function () {
            return this.hasMoreValue;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(SessionWindow.prototype, "loadingOlder", {
        get: function () {
            return this.loadingOlderValue;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(SessionWindow.prototype, "openState", {
        get: function () {
            return this.openStateValue;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(SessionWindow.prototype, "error", {
        get: function () {
            return this.errorValue;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(SessionWindow.prototype, "bufferedCount", {
        /** Number of live events waiting for a tail repair. */
        get: function () {
            return this.liveBuffer.length;
        },
        enumerable: false,
        configurable: true
    });
    SessionWindow.prototype.snapshot = function () {
        return {
            events: this.events,
            baseSeq: this.baseSeqValue,
            tailSeq: this.tailSeq,
            hasMore: this.hasMoreValue,
            loadingOlder: this.loadingOlderValue,
            openState: this.openStateValue,
            error: this.errorValue,
        };
    };
    /** Open (or re-open) the window by installing one tail page. */
    SessionWindow.prototype.open = function () {
        var _this = this;
        return this.enqueue(function () { return _this.openLocked(); });
    };
    SessionWindow.prototype.openLocked = function () {
        return __awaiter(this, void 0, void 0, function () {
            var page, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        this.openStateValue = "loading";
                        this.errorValue = undefined;
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, this.options.loader.loadTail()];
                    case 2:
                        page = _a.sent();
                        this.installTail(page);
                        this.openStateValue = "open";
                        return [3 /*break*/, 4];
                    case 3:
                        error_1 = _a.sent();
                        this.openStateValue = "error";
                        this.errorValue = error_1;
                        throw error_1;
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /** Pull one older page and prepend it when it touches the current head. */
    SessionWindow.prototype.loadOlder = function () {
        var _this = this;
        return this.enqueue(function () { return __awaiter(_this, void 0, void 0, function () {
            var page, events, tail;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (this.openStateValue !== "open" ||
                            !this.hasMoreValue ||
                            this.loadingOlderValue ||
                            this.baseSeqValue === null)
                            return [2 /*return*/, false];
                        this.loadingOlderValue = true;
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, , 3, 4]);
                        return [4 /*yield*/, this.options.loader.loadBefore(this.baseSeqValue)];
                    case 2:
                        page = _a.sent();
                        events = __spreadArray([], page.events, true);
                        if (events.length === 0) {
                            this.hasMoreValue = page.hasMore;
                            return [2 /*return*/, false];
                        }
                        if (!isContiguous(events)) {
                            // Fail soft: never render a discontinuous or out-of-order stream.
                            this.hasMoreValue = false;
                            return [2 /*return*/, false];
                        }
                        tail = events.at(-1);
                        if (tail.seq + 1 !== this.baseSeqValue) {
                            this.hasMoreValue = false;
                            return [2 /*return*/, false];
                        }
                        this.events = __spreadArray(__spreadArray([], events, true), this.events, true);
                        this.baseSeqValue = events[0].seq;
                        this.hasMoreValue = page.hasMore;
                        return [2 /*return*/, true];
                    case 3:
                        this.loadingOlderValue = false;
                        return [7 /*endfinally*/];
                    case 4: return [2 /*return*/];
                }
            });
        }); });
    };
    /**
     * Accept one live event.
     *
     * @returns `true` when the window appended it, `false` when it was buffered
     * for the next repair or dropped as an overlap.
     */
    SessionWindow.prototype.acceptLive = function (event) {
        var _a, _b;
        if (this.openStateValue !== "open") {
            this.buffer(event);
            return false;
        }
        var tail = this.tailSeq;
        if (tail !== null && event.seq <= tail)
            return false;
        if (tail !== null && event.seq > tail + 1) {
            this.buffer(event);
            (_b = (_a = this.options).onGap) === null || _b === void 0 ? void 0 : _b.call(_a, event);
            void this.repair();
            return false;
        }
        this.events.push(event);
        return true;
    };
    /** Re-pull the tail page and stitch buffered live events in sequence order. */
    SessionWindow.prototype.repair = function () {
        var _this = this;
        if (this.repairInFlight !== null)
            return this.repairInFlight;
        var repair = this.enqueue(function () { return __awaiter(_this, void 0, void 0, function () {
            var page, error_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, 3, 4]);
                        return [4 /*yield*/, this.options.loader.loadTail()];
                    case 1:
                        page = _a.sent();
                        this.installTail(page);
                        return [3 /*break*/, 4];
                    case 2:
                        error_2 = _a.sent();
                        this.errorValue = error_2;
                        return [2 /*return*/];
                    case 3:
                        this.repairInFlight = null;
                        return [7 /*endfinally*/];
                    case 4: return [2 /*return*/];
                }
            });
        }); });
        this.repairInFlight = repair;
        return repair;
    };
    /** Reset to cold and load the current tail page again. */
    SessionWindow.prototype.resync = function () {
        var _this = this;
        return this.enqueue(function () { return __awaiter(_this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        this.events = [];
                        this.baseSeqValue = null;
                        this.hasMoreValue = false;
                        this.liveBuffer = [];
                        this.openStateValue = "cold";
                        this.errorValue = undefined;
                        return [4 /*yield*/, this.openLocked()];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
    };
    SessionWindow.prototype.installTail = function (page) {
        var _a, _b;
        var events = __spreadArray([], page.events, true);
        if (!isContiguous(events)) {
            // The loader must return a contiguous page; fail closed rather than
            // installing a broken window.
            this.events = [];
            this.baseSeqValue = null;
            this.hasMoreValue = false;
            return;
        }
        this.events = events;
        this.baseSeqValue = (_b = (_a = events[0]) === null || _a === void 0 ? void 0 : _a.seq) !== null && _b !== void 0 ? _b : null;
        this.hasMoreValue = page.hasMore;
        this.stitchBuffered();
    };
    SessionWindow.prototype.stitchBuffered = function () {
        var buffered = this.liveBuffer;
        this.liveBuffer = [];
        for (var _i = 0, buffered_1 = buffered; _i < buffered_1.length; _i++) {
            var event_1 = buffered_1[_i];
            var tail = this.tailSeq;
            if (tail !== null && event_1.seq <= tail)
                continue;
            if (tail !== null && event_1.seq > tail + 1) {
                this.buffer(event_1);
                continue;
            }
            this.events.push(event_1);
        }
    };
    SessionWindow.prototype.buffer = function (event) {
        if (this.liveBuffer.some(function (candidate) { return candidate.seq === event.seq; }))
            return;
        this.liveBuffer.push(event);
        this.liveBuffer.sort(function (left, right) { return left.seq - right.seq; });
    };
    SessionWindow.prototype.enqueue = function (work) {
        var run = this.queue.then(work, work);
        this.queue = run.then(function () { return undefined; }, function () { return undefined; });
        return run;
    };
    return SessionWindow;
}());
exports.SessionWindow = SessionWindow;
