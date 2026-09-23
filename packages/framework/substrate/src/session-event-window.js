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
exports.ensureSessionEventWindow = ensureSessionEventWindow;
exports.feedSessionEventWindow = feedSessionEventWindow;
exports.sessionWindowEventsForExec = sessionWindowEventsForExec;
exports.sessionWindowEvents = sessionWindowEvents;
exports.scanSessionWindowNewestFirst = scanSessionWindowNewestFirst;
var session_store_1 = require("@anthelia/session-store");
var contracts_1 = require("@natalia/contracts");
var session_full_events_1 = require("./session-full-events");
var operation_log_1 = require("@natalia/operation-log");
var session_window_1 = require("./session-window");
var DEFAULT_EVENT_WINDOW_PAGE = 2000;
function storeLoader(store, exec, limit) {
    var _this = this;
    var mapPage = function (page) {
        var next = 1;
        return {
            events: page.events.map(function (entry) {
                var _a;
                var seq = (_a = entry.sessionSeq) !== null && _a !== void 0 ? _a : next;
                next = seq + 1;
                return { seq: seq, event: entry.event };
            }),
            hasMore: page.hasMore,
        };
    };
    return {
        loadTail: function () { return __awaiter(_this, void 0, void 0, function () {
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = mapPage;
                        return [4 /*yield*/, store.eventWindow(exec.session.id, exec.session.events, {
                                limit: limit,
                            })];
                    case 1: return [2 /*return*/, _a.apply(void 0, [_b.sent()])];
                }
            });
        }); },
        loadBefore: function (beforeSeq) { return __awaiter(_this, void 0, void 0, function () {
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = mapPage;
                        return [4 /*yield*/, store.eventWindow(exec.session.id, exec.session.events, {
                                beforeSeq: beforeSeq,
                                limit: limit,
                            })];
                    case 1: return [2 /*return*/, _a.apply(void 0, [_b.sent()])];
                }
            });
        }); },
    };
}
/**
 * Lazily create the one per-session event window used by secondary surfaces.
 *
 * The full journal remains reachable through ensureSessionFullEvents(); this
 * helper is the normal path for chat/subagent/tool projections that only need
 * the current tail and can page older later.
 */
function hasSequenceGap(exec, window) {
    var seqs = new Set();
    for (var _i = 0, _a = window.eventsView; _i < _a.length; _i++) {
        var entry = _a[_i];
        seqs.add(entry.seq);
    }
    for (var _b = 0, _c = exec.session.events; _b < _c.length; _b++) {
        var event_1 = _c[_b];
        var seq = (0, contracts_1.runtimeEventSessionSeq)(event_1);
        if (seq !== undefined)
            seqs.add(seq);
    }
    var sorted = __spreadArray([], seqs, true).sort(function (left, right) { return left - right; });
    for (var index = 1; index < sorted.length; index++) {
        if (sorted[index] !== sorted[index - 1] + 1)
            return true;
    }
    return false;
}
function ensureSessionEventWindow(ctx_1, exec_1) {
    return __awaiter(this, arguments, void 0, function (ctx, exec, limit) {
        var store, existing, window, _i, _a, event_2, seq, windowSeqs, liveSeqs;
        if (limit === void 0) { limit = DEFAULT_EVENT_WINDOW_PAGE; }
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    if (exec.fullEventsLoaded)
                        return [2 /*return*/, undefined];
                    store = ctx.state.serviceDirectory.getOptional(session_store_1.sessionStoreController);
                    if (!store)
                        return [2 /*return*/, undefined];
                    existing = exec.eventWindow;
                    if (!!existing) return [3 /*break*/, 3];
                    // A just-finished startup turn may still be queued in the persistence
                    // chain. Drain the per-session chain before the store flush, otherwise the
                    // DB tail can lag the live cursor and look like a real gap.
                    return [4 /*yield*/, ctx.ports
                            .getSessionPersistenceForSession(exec.session.id)
                            .catch(function () { return undefined; })];
                case 1:
                    // A just-finished startup turn may still be queued in the persistence
                    // chain. Drain the per-session chain before the store flush, otherwise the
                    // DB tail can lag the live cursor and look like a real gap.
                    _b.sent();
                    return [4 /*yield*/, store.flush(exec.session.id).catch(function () { return undefined; })];
                case 2:
                    _b.sent();
                    _b.label = 3;
                case 3:
                    if (!(existing && existing.openState === "open")) return [3 /*break*/, 5];
                    if (!hasSequenceGap(exec, existing))
                        return [2 /*return*/, existing];
                    exec.eventWindow = undefined;
                    return [4 /*yield*/, (0, session_full_events_1.ensureSessionFullEvents)(ctx, exec)];
                case 4:
                    _b.sent();
                    return [2 /*return*/, undefined];
                case 5:
                    window = existing !== null && existing !== void 0 ? existing : new session_window_1.SessionWindow({
                        loader: storeLoader(store, exec, limit),
                    });
                    exec.eventWindow = window;
                    return [4 /*yield*/, window.open()];
                case 6:
                    _b.sent();
                    // A live event may have landed before the first secondary read created the
                    // window. Replay the hidden-seq events already resident in the execution so
                    // the window covers the same prefix the chat/subagent projection sees.
                    for (_i = 0, _a = exec.session.events; _i < _a.length; _i++) {
                        event_2 = _a[_i];
                        seq = (0, contracts_1.runtimeEventSessionSeq)(event_2);
                        if (seq !== undefined)
                            window.acceptLive({ seq: seq, event: event_2 });
                    }
                    if (!hasSequenceGap(exec, window)) return [3 /*break*/, 8];
                    if (process.env.NATALIA_MEMORY_TRACE === "1" ||
                        process.env.NATALIA_TRACE_FULL_EVENTS === "1") {
                        windowSeqs = window.eventsView.map(function (entry) { return entry.seq; });
                        liveSeqs = exec.session.events
                            .map(function (event) { return (0, contracts_1.runtimeEventSessionSeq)(event); })
                            .filter(function (seq) { return seq !== undefined; });
                        (0, operation_log_1.logOf)(ctx.state.serviceDirectory).warn("event-window", "gap", {
                            sessionID: exec.session.id,
                            windowCount: windowSeqs.length,
                            windowFirst: windowSeqs[0],
                            windowLast: windowSeqs.at(-1),
                            windowHead: windowSeqs.slice(0, 3),
                            windowTail: windowSeqs.slice(-3),
                            liveCount: liveSeqs.length,
                            liveFirst: liveSeqs[0],
                            liveLast: liveSeqs.at(-1),
                        });
                    }
                    exec.eventWindow = undefined;
                    return [4 /*yield*/, (0, session_full_events_1.ensureSessionFullEvents)(ctx, exec)];
                case 7:
                    _b.sent();
                    return [2 /*return*/, undefined];
                case 8: return [2 /*return*/, window];
            }
        });
    });
}
/** Feed one durable live event into the shared window, when it exists. */
function feedSessionEventWindow(exec, seq, event) {
    var _a;
    (_a = exec.eventWindow) === null || _a === void 0 ? void 0 : _a.acceptLive({ seq: seq, event: event });
}
/**
 * Merge the persisted window with durable live events already resident in the
 * execution. The persistence queue can lag a just-finished turn, so a read
 * must not discard the live tail merely because the window page is older.
 */
function sessionWindowEventsForExec(ctx, exec) {
    return __awaiter(this, void 0, void 0, function () {
        var window;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, ensureSessionEventWindow(ctx, exec)];
                case 1:
                    window = _a.sent();
                    return [2 /*return*/, window ? sessionWindowEvents(exec, window) : exec.session.events];
            }
        });
    });
}
function sessionWindowEvents(exec, window) {
    var bySeq = new Map();
    for (var _i = 0, _a = window.eventsView; _i < _a.length; _i++) {
        var entry = _a[_i];
        bySeq.set(entry.seq, entry.event);
    }
    for (var _b = 0, _c = exec.session.events; _b < _c.length; _b++) {
        var event_3 = _c[_b];
        var seq = (0, contracts_1.runtimeEventSessionSeq)(event_3);
        if (seq !== undefined && !bySeq.has(seq))
            bySeq.set(seq, event_3);
    }
    var result = __spreadArray([], bySeq.entries(), true).sort(function (_a, _b) {
        var left = _a[0];
        var right = _b[0];
        return left - right;
    })
        .map(function (_a) {
        var event = _a[1];
        return event;
    });
    return result;
}
/**
 * Walk the shared window from the newest event backwards until `match` finds an
 * item in the projected view, or the window reaches the start of the durable
 * log.
 *
 * `newerCount` is the number of projected items after the match in the current
 * (physically newest-anchored) view, so a caller can compute "removed N" without
 * materialising the whole history. The window is always contiguous and anchored
 * at the newest event, so once the match is inside it every newer item is too.
 *
 * Returns `gap` when an older page failed to stitch, and `exhausted` when the
 * whole log was searched without a match.
 */
function scanSessionWindowNewestFirst(ctx, exec, project, match) {
    return __awaiter(this, void 0, void 0, function () {
        var settled, window, result, advanced;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    settled = function (items) {
                        var index = items.findIndex(match);
                        return index >= 0
                            ? {
                                kind: "found",
                                item: items[index],
                                newerCount: items.length - index - 1,
                            }
                            : { kind: "exhausted" };
                    };
                    return [4 /*yield*/, ensureSessionEventWindow(ctx, exec)];
                case 1:
                    window = _a.sent();
                    if (!window) {
                        // Full events are already resident, or a gap forced the explicit full load.
                        return [2 /*return*/, settled(project(exec.session.events))];
                    }
                    _a.label = 2;
                case 2:
                    result = settled(project(sessionWindowEvents(exec, window)));
                    if (result.kind === "found")
                        return [2 /*return*/, result];
                    // The first durable event carries sessionSeq 1, so this is the real base.
                    if (window.baseSeq === 1)
                        return [2 /*return*/, result];
                    return [4 /*yield*/, window.loadOlder()];
                case 3:
                    advanced = _a.sent();
                    if (!advanced && window.baseSeq !== 1)
                        return [2 /*return*/, { kind: "gap" }];
                    _a.label = 4;
                case 4: return [3 /*break*/, 2];
                case 5: return [2 /*return*/];
            }
        });
    });
}
