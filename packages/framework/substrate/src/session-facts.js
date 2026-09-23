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
exports.ensureSessionFactState = ensureSessionFactState;
exports.reseedSessionFactState = reseedSessionFactState;
exports.feedSessionFactState = feedSessionFactState;
exports.completeSessionFactState = completeSessionFactState;
/**
 * Incremental hot memory for one execution — the client-side owner of
 * `SessionFactState`.
 *
 * The fact state is the in-memory half of the RINA memory tier: it keeps the
 * active-set facts (open drift, live constitution rules, un-terminated mailbox,
 * recent decisions, collab threads, turn status) without re-scanning the whole
 * journal. It is seeded lazily from `exec.session.events` and then maintained
 * in O(1) per durable event at the single event-sink choke point.
 *
 * Completeness matters: a fast-attach execution holds only the post-epoch tail,
 * so a state seeded from it is missing pre-epoch facts. `factStateComplete`
 * records which case we are in. `completeSessionFactState` fills a tail state by
 * streaming the durable log in pages, without materialising the whole journal;
 * only when no store can serve those pages does a caller fall back to the
 * explicit full-history escape hatch.
 */
var session_1 = require("@anthelia/session");
var contracts_1 = require("@natalia/contracts");
var session_store_1 = require("@anthelia/session-store");
var FACT_PAGE_LIMIT = 2000;
/** Lazily build (and memoize) the incremental fact state for an execution. */
function ensureSessionFactState(exec) {
    if (!exec.factState)
        seedSessionFactState(exec);
    return exec.factState;
}
/** Re-seed after `exec.session.events` is replaced with a new base. */
function reseedSessionFactState(exec, complete) {
    if (complete === void 0) { complete = exec.fullEventsLoaded === true; }
    seedSessionFactState(exec, complete);
    return exec.factState;
}
/** Feed one durable event already appended to `exec.session.events`. */
function feedSessionFactState(exec, event) {
    if (exec.factState)
        (0, session_1.applySessionFactEvent)(exec.factState, event);
}
/**
 * Complete the hot state without materialising the whole journal.
 *
 * A fast-attach execution holds only the post-epoch tail, so the state cannot be
 * completed from memory. Stream the durable log forward in pages, fold each page
 * into a fresh state, then fold any live events that landed past the persisted
 * pages. `exec.session.events` intentionally stays a tail; callers that need the
 * full raw array use `ensureSessionFullEvents` instead.
 *
 * Returns false when no store is available, so the caller can fall back.
 */
function completeSessionFactState(ctx, exec) {
    return __awaiter(this, void 0, void 0, function () {
        var store, commitFactState, checkpoint, projection, state_1, _i, _a, event_1, _b, _c, event_2, _d, _e, event_3, seq, state, offset, maxSeq, page, _f, _g, entry, seq, _h, _j, event_4, seq;
        var _k, _l, _m, _o;
        return __generator(this, function (_p) {
            switch (_p.label) {
                case 0:
                    ensureSessionFactState(exec);
                    if (exec.factStateComplete === true)
                        return [2 /*return*/, true];
                    if (exec.fullEventsLoaded === true) {
                        reseedSessionFactState(exec, true);
                        return [2 /*return*/, true];
                    }
                    store = ctx.state.serviceDirectory.getOptional(session_store_1.sessionStoreController);
                    if (!store)
                        return [2 /*return*/, false];
                    // Make the persisted tail match the live log before paging it.
                    return [4 /*yield*/, ctx.ports
                            .getSessionPersistenceForSession(exec.session.id)
                            .catch(function () { return undefined; })];
                case 1:
                    // Make the persisted tail match the live log before paging it.
                    _p.sent();
                    return [4 /*yield*/, store.flush(exec.session.id).catch(function () { return undefined; })];
                case 2:
                    _p.sent();
                    commitFactState = function (state) {
                        exec.factState = state;
                        exec.factStateComplete = true;
                        // EI Phase 1 "降档": after the complete history is folded, bound the
                        // terminal entries so hot memory does not grow with the whole session. The
                        // journal keeps everything; a read reconstructs on demand.
                        exec.factStateTerminalEvicted = (0, session_1.evictTerminalFacts)(state);
                    };
                    checkpoint = (_k = store.loadProjectionCheckpoint) === null || _k === void 0 ? void 0 : _k.call(store, exec.session.id);
                    if (checkpoint) {
                        projection = (0, session_1.deserializeProjectionState)(checkpoint.serializedState);
                        if (projection) {
                            state_1 = (0, session_1.emptySessionFactState)();
                            for (_i = 0, _a = projection.events; _i < _a.length; _i++) {
                                event_1 = _a[_i];
                                (0, session_1.applySessionFactEvent)(state_1, event_1);
                            }
                            for (_b = 0, _c = (_m = (_l = store.eventsAfter) === null || _l === void 0 ? void 0 : _l.call(store, exec.session.id, checkpoint.lastSeq)) !== null && _m !== void 0 ? _m : []; _b < _c.length; _b++) {
                                event_2 = _c[_b];
                                (0, session_1.applySessionFactEvent)(state_1, event_2);
                            }
                            for (_d = 0, _e = exec.session.events; _d < _e.length; _d++) {
                                event_3 = _e[_d];
                                seq = (0, contracts_1.runtimeEventSessionSeq)(event_3);
                                if (seq !== undefined && seq > checkpoint.lastSeq)
                                    (0, session_1.applySessionFactEvent)(state_1, event_3);
                            }
                            commitFactState(state_1);
                            return [2 /*return*/, true];
                        }
                    }
                    state = (0, session_1.emptySessionFactState)();
                    offset = 0;
                    maxSeq = 0;
                    _p.label = 3;
                case 3: return [4 /*yield*/, store.history(exec.session.id, exec.session.events, {
                        offset: offset,
                        limit: FACT_PAGE_LIMIT,
                    })];
                case 4:
                    page = _p.sent();
                    for (_f = 0, _g = page.events; _f < _g.length; _f++) {
                        entry = _g[_f];
                        (0, session_1.applySessionFactEvent)(state, entry.event);
                        seq = (_o = entry.sessionSeq) !== null && _o !== void 0 ? _o : entry.seq;
                        if (typeof seq === "number")
                            maxSeq = Math.max(maxSeq, seq);
                    }
                    if (!page.hasMore || page.events.length === 0)
                        return [3 /*break*/, 6];
                    offset += page.events.length;
                    _p.label = 5;
                case 5: return [3 /*break*/, 3];
                case 6:
                    // Events appended while we paged (or not yet persisted) are newer than the
                    // last folded sequence; fold them on top so the state matches the live log.
                    for (_h = 0, _j = exec.session.events; _h < _j.length; _h++) {
                        event_4 = _j[_h];
                        seq = (0, contracts_1.runtimeEventSessionSeq)(event_4);
                        if (seq !== undefined && seq > maxSeq)
                            (0, session_1.applySessionFactEvent)(state, event_4);
                    }
                    commitFactState(state);
                    return [2 /*return*/, true];
            }
        });
    });
}
function seedSessionFactState(exec, complete) {
    if (complete === void 0) { complete = exec.fullEventsLoaded === true; }
    exec.factState = (0, session_1.sessionFactStateFromEvents)(exec.session.events);
    exec.factStateComplete = complete;
}
