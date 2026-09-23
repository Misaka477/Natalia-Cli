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
var session_1 = require("@anthelia/session");
var substrate_1 = require("@anthelia/substrate");
var session_store_1 = require("@anthelia/session-store");
var runtime_services_1 = require("@natalia/runtime-services");
var rule = {
    type: "constitution.rule_added",
    id: "rule:1",
    ruleID: "C-001",
    statement: "Never commit without approval",
    scope: "project",
    priority: "critical",
    source: "user",
    enforcement: "approval",
    overridePolicy: "forbidden",
};
var mailbox = {
    type: "mailbox.queued",
    id: "mailbox:1:queued",
    messageID: "mailbox:1",
    source: "system",
    priority: "normal",
    intent: "constraint",
    text: "never commit",
    safeSummary: "a constraint",
    deliveryPolicy: "before_next_tool",
    createdAt: "t0",
};
function noise(index) {
    return {
        type: "tool.update",
        id: "turn_1:call_".concat(index),
        name: "read_file",
        callID: "call_".concat(index),
        status: "succeeded",
        summary: "read",
    };
}
/** A 2502-event log: the fact lands on the first page, the tail on the last. */
function log() {
    var all = [rule];
    for (var index = 0; index < 2500; index += 1)
        all.push(noise(index));
    all.push(mailbox);
    return all;
}
function harness(all) {
    var historyCalls = 0;
    var store = {
        flush: function () { return Promise.resolve(); },
        history: function (_id, _fallback, options) {
            var _a, _b;
            if (options === void 0) { options = {}; }
            historyCalls += 1;
            var start = (_a = options.offset) !== null && _a !== void 0 ? _a : 0;
            var limit = (_b = options.limit) !== null && _b !== void 0 ? _b : 100;
            var slice = all.slice(start, start + limit);
            return Promise.resolve({
                events: slice.map(function (event, index) { return ({
                    seq: start + index + 1,
                    sessionSeq: start + index + 1,
                    event: event,
                }); }),
                hasMore: start + slice.length < all.length,
            });
        },
    };
    var ctx = {
        state: {
            serviceDirectory: (0, runtime_services_1.createTestContext)([
                session_store_1.sessionStoreController.mock(store),
            ]),
        },
        ports: {
            resolveService: function () { return store; },
            getSessionPersistenceForSession: function () { return Promise.resolve(undefined); },
        },
    };
    // The execution carries only its fast-attach tail.
    var exec = {
        session: { id: "ses_cold_fold", events: all.slice(-2) },
        fullEventsLoaded: false,
    };
    return { ctx: ctx, exec: exec, calls: function () { return historyCalls; } };
}
(0, bun_test_1.test)("completeSessionFactState folds paged history without loading the journal", function () { return __awaiter(void 0, void 0, void 0, function () {
    var all, _a, ctx, exec, calls, ok, state, expected;
    var _b, _c;
    return __generator(this, function (_d) {
        switch (_d.label) {
            case 0:
                all = log();
                _a = harness(all), ctx = _a.ctx, exec = _a.exec, calls = _a.calls;
                return [4 /*yield*/, (0, substrate_1.completeSessionFactState)(ctx, exec)];
            case 1:
                ok = _d.sent();
                (0, bun_test_1.expect)(ok).toBe(true);
                (0, bun_test_1.expect)(exec.factStateComplete).toBe(true);
                // It had to page more than once, and it left session.events as the tail.
                (0, bun_test_1.expect)(calls()).toBeGreaterThan(1);
                (0, bun_test_1.expect)(exec.session.events).toHaveLength(2);
                state = exec.factState;
                expected = (0, session_1.sessionFactStateFromEvents)(all);
                (0, bun_test_1.expect)((0, session_1.sessionFactConstitutionRules)(state)).toEqual((0, session_1.sessionFactConstitutionRules)(expected));
                (0, bun_test_1.expect)((0, session_1.sessionFactMailboxMessages)(state)).toEqual((0, session_1.sessionFactMailboxMessages)(expected));
                // The first-page fact survived the paging.
                (0, bun_test_1.expect)((_b = (0, session_1.sessionFactConstitutionRules)(state)[0]) === null || _b === void 0 ? void 0 : _b.ruleID).toBe("C-001");
                (0, bun_test_1.expect)((_c = (0, session_1.sessionFactMailboxMessages)(state)[0]) === null || _c === void 0 ? void 0 : _c.messageID).toBe("mailbox:1");
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("completeSessionFactState is a no-op once the state is complete", function () { return __awaiter(void 0, void 0, void 0, function () {
    var all, _a, ctx, exec, calls, before, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                all = log();
                _a = harness(all), ctx = _a.ctx, exec = _a.exec, calls = _a.calls;
                return [4 /*yield*/, (0, substrate_1.completeSessionFactState)(ctx, exec)];
            case 1:
                _c.sent();
                before = calls();
                _b = bun_test_1.expect;
                return [4 /*yield*/, (0, substrate_1.completeSessionFactState)(ctx, exec)];
            case 2:
                _b.apply(void 0, [_c.sent()]).toBe(true);
                (0, bun_test_1.expect)(calls()).toBe(before);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("completeSessionFactState completes from a persisted projection checkpoint (B tier)", function () { return __awaiter(void 0, void 0, void 0, function () {
    var all, prefix, projection, _i, prefix_1, event_1, serializedState, lastSeq, historyCalls, store, ctx, exec, full;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                all = log();
                prefix = all.slice(0, 100);
                projection = (0, session_1.initProjection)();
                for (_i = 0, prefix_1 = prefix; _i < prefix_1.length; _i++) {
                    event_1 = prefix_1[_i];
                    (0, session_1.applyProjection)(projection, event_1);
                }
                serializedState = (0, session_1.serializeProjectionState)(projection);
                lastSeq = prefix.length;
                historyCalls = 0;
                store = {
                    flush: function () { return Promise.resolve(); },
                    loadProjectionCheckpoint: function () { return ({ serializedState: serializedState, lastSeq: lastSeq }); },
                    eventsAfter: function (_id, after) { return all.slice(after); },
                    history: function () {
                        historyCalls += 1;
                        return Promise.resolve({ events: [], hasMore: false });
                    },
                };
                ctx = {
                    state: {
                        serviceDirectory: (0, runtime_services_1.createTestContext)([
                            session_store_1.sessionStoreController.mock(store),
                        ]),
                    },
                    ports: {
                        resolveService: function () { return store; },
                        getSessionPersistenceForSession: function () { return Promise.resolve(undefined); },
                    },
                };
                exec = {
                    session: { id: "ses_cold_fold", events: all.slice(-2) },
                    fullEventsLoaded: false,
                };
                return [4 /*yield*/, (0, substrate_1.completeSessionFactState)(ctx, exec)];
            case 1:
                _a.sent();
                // B tier: folded from the checkpoint + tail, never paged the journal.
                (0, bun_test_1.expect)(historyCalls).toBe(0);
                (0, bun_test_1.expect)(exec.factStateComplete).toBe(true);
                full = (0, session_1.sessionFactStateFromEvents)(all);
                (0, bun_test_1.expect)((0, session_1.sessionFactConstitutionRules)(exec.factState)).toEqual((0, session_1.sessionFactConstitutionRules)(full));
                (0, bun_test_1.expect)((0, session_1.sessionFactMailboxMessages)(exec.factState)).toEqual((0, session_1.sessionFactMailboxMessages)(full));
                return [2 /*return*/];
        }
    });
}); });
