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
var bun_test_1 = require("bun:test");
var promises_1 = require("node:fs/promises");
var node_os_1 = require("node:os");
var node_path_1 = require("node:path");
var attachments_1 = require("@anthelia/attachments");
var session_store_1 = require("@anthelia/session-store");
var session_1 = require("@anthelia/session");
var main_1 = require("../src/runtime/main");
var provider = {
    provider: "goal-status-test",
    model: "goal-status-test-model",
    stream: function (_request) {
        return __asyncGenerator(this, arguments, function stream_1() {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __await({ type: "done" })];
                    case 1: return [4 /*yield*/, _a.sent()];
                    case 2:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    },
};
/**
 * Regression: the fast startup path attaches to the runtime's already-selected
 * session without replaying the durable journal, so an existing goal never
 * reached the status bar. Attach must re-seed it from `recovery_goal` and emit
 * a live `goal.status`.
 */
(0, bun_test_1.test)("same-id attach re-publishes an existing goal as a live goal.status", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, sessionID, seeder, record, goalEvent, events, client, deadline, status_1, waitForGoalEvent, edited, editEvents, stale, paused, _a, resumed, _b, cleared, _c;
    var _d, _e, _f, _g, _h, _j, _k;
    return __generator(this, function (_l) {
        switch (_l.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-goal-status-"))];
            case 1:
                root = _l.sent();
                sessionID = "ses_goal_status";
                seeder = (0, session_store_1.createSessionStoreController)({
                    workspaceRoot: root,
                    sessionID: function () { return sessionID; },
                    useSqliteStore: true,
                    attachments: (0, attachments_1.createAttachmentService)(root),
                });
                return [4 /*yield*/, seeder.init()];
            case 2:
                _l.sent();
                return [4 /*yield*/, seeder.create({ id: sessionID, title: "Goal status" })];
            case 3:
                _l.sent();
                return [4 /*yield*/, seeder.load(sessionID)];
            case 4:
                record = (_l.sent()).session;
                goalEvent = {
                    type: "goal.changed",
                    id: "goal_evt_seed",
                    operation: "create",
                    snapshot: {
                        goalID: "goal_seed",
                        revision: 1,
                        objective: "resume the plan",
                        phase: "active",
                        maxGoalRounds: 256,
                        maxGoalTokens: 0,
                        maxGoalWallClockMs: 0,
                        spentGoalTokens: 0,
                        goalWallClockMs: 0,
                    },
                    roundsStarted: 0,
                    at: "2026-01-01T00:00:00.000Z",
                };
                record.events.push(goalEvent);
                return [4 /*yield*/, seeder.appendEvent(record, goalEvent)];
            case 5:
                _l.sent();
                return [4 /*yield*/, seeder.flush(sessionID)];
            case 6:
                _l.sent();
                return [4 /*yield*/, seeder.close()];
            case 7:
                _l.sent();
                events = [];
                client = (0, main_1.createRealRuntimeClient)({
                    workspaceRoot: root,
                    sessionID: sessionID,
                    useSqliteStore: true,
                    provider: provider,
                });
                _l.label = 8;
            case 8:
                _l.trys.push([8, , 22, 24]);
                client.start(function (event) { return events.push(event); });
                return [4 /*yield*/, ((_d = client.sessionAttach) === null || _d === void 0 ? void 0 : _d.call(client, sessionID))];
            case 9:
                _l.sent();
                deadline = Date.now() + 2000;
                _l.label = 10;
            case 10:
                if (!(Date.now() < deadline &&
                    !events.some(function (event) { return event.type === "goal.status"; }))) return [3 /*break*/, 12];
                return [4 /*yield*/, Bun.sleep(20)];
            case 11:
                _l.sent();
                return [3 /*break*/, 10];
            case 12:
                status_1 = events.find(function (event) { return event.type === "goal.status"; });
                (0, bun_test_1.expect)(status_1).toMatchObject({
                    type: "goal.status",
                    goal: {
                        goalID: "goal_seed",
                        revision: 1,
                        objective: "resume the plan",
                        phase: "active",
                        roundsStarted: 0,
                    },
                });
                waitForGoalEvent = function (predicate) { return __awaiter(void 0, void 0, void 0, function () {
                    var waitUntil;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0:
                                waitUntil = Date.now() + 2000;
                                _a.label = 1;
                            case 1:
                                if (!(Date.now() < waitUntil && !events.some(predicate))) return [3 /*break*/, 3];
                                return [4 /*yield*/, Bun.sleep(20)];
                            case 2:
                                _a.sent();
                                return [3 /*break*/, 1];
                            case 3: return [2 /*return*/, events.filter(predicate)];
                        }
                    });
                }); };
                return [4 /*yield*/, ((_e = client.goalEdit) === null || _e === void 0 ? void 0 : _e.call(client, { goalID: "goal_seed", revision: 1, objective: "edited objective" }, sessionID))];
            case 13:
                edited = _l.sent();
                (0, bun_test_1.expect)(edited).toMatchObject({ ok: true, action: "edit" });
                return [4 /*yield*/, waitForGoalEvent(function (event) { return event.type === "goal.changed" && event.operation === "edit"; })];
            case 14:
                editEvents = _l.sent();
                (0, bun_test_1.expect)(editEvents).toHaveLength(1);
                (0, bun_test_1.expect)(editEvents[0]).toMatchObject({
                    type: "goal.changed",
                    operation: "edit",
                    snapshot: { objective: "edited objective", revision: 2 },
                });
                return [4 /*yield*/, ((_f = client.goalEdit) === null || _f === void 0 ? void 0 : _f.call(client, { goalID: "goal_seed", revision: 1, objective: "stale objective" }, sessionID))];
            case 15:
                stale = _l.sent();
                (0, bun_test_1.expect)(stale).toMatchObject({ ok: false, action: "edit" });
                return [4 /*yield*/, ((_g = client.goalControl) === null || _g === void 0 ? void 0 : _g.call(client, "pause", sessionID))];
            case 16:
                paused = _l.sent();
                (0, bun_test_1.expect)(paused).toMatchObject({ ok: true, action: "pause" });
                _a = bun_test_1.expect;
                return [4 /*yield*/, waitForGoalEvent(function (event) { return event.type === "goal.changed" && event.operation === "pause"; })];
            case 17:
                _a.apply(void 0, [_l.sent()]).toHaveLength(1);
                return [4 /*yield*/, ((_h = client.goalControl) === null || _h === void 0 ? void 0 : _h.call(client, "resume", sessionID))];
            case 18:
                resumed = _l.sent();
                (0, bun_test_1.expect)(resumed).toMatchObject({ ok: true, action: "resume" });
                _b = bun_test_1.expect;
                return [4 /*yield*/, waitForGoalEvent(function (event) {
                        return event.type === "goal.changed" && event.operation === "resume";
                    })];
            case 19:
                _b.apply(void 0, [_l.sent()]).toHaveLength(1);
                return [4 /*yield*/, ((_j = client.goalControl) === null || _j === void 0 ? void 0 : _j.call(client, "clear", sessionID))];
            case 20:
                cleared = _l.sent();
                (0, bun_test_1.expect)(cleared).toMatchObject({ ok: true, action: "clear" });
                _c = bun_test_1.expect;
                return [4 /*yield*/, waitForGoalEvent(function (event) { return event.type === "goal.changed" && event.operation === "clear"; })];
            case 21:
                _c.apply(void 0, [_l.sent()]).toHaveLength(1);
                return [3 /*break*/, 24];
            case 22: return [4 /*yield*/, ((_k = client.dispose) === null || _k === void 0 ? void 0 : _k.call(client))];
            case 23:
                _l.sent();
                return [7 /*endfinally*/];
            case 24: return [2 /*return*/];
        }
    });
}); });
/**
 * The status-bar toggle and inline editor must act on the *running* round:
 * `pause` hard-stops it (not just the next round), and `edit` steers it at the
 * next step while the durable edit makes the next round use the new objective.
 */
(0, bun_test_1.test)("pause hard-stops the running goal round and edit steers it", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, sessionID, seeder, record, goalEvent, calls, releases, provider, events, waitUntil, client, goalRevision, edited, paused, _i, _a, release;
    var _b, _c, _d, _e, _f, _g, _h;
    return __generator(this, function (_j) {
        switch (_j.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-goal-steer-"))];
            case 1:
                root = _j.sent();
                sessionID = "ses_goal_steer";
                seeder = (0, session_store_1.createSessionStoreController)({
                    workspaceRoot: root,
                    sessionID: function () { return sessionID; },
                    useSqliteStore: true,
                    attachments: (0, attachments_1.createAttachmentService)(root),
                });
                return [4 /*yield*/, seeder.init()];
            case 2:
                _j.sent();
                return [4 /*yield*/, seeder.create({ id: sessionID, title: "Goal steer" })];
            case 3:
                _j.sent();
                return [4 /*yield*/, seeder.load(sessionID)];
            case 4:
                record = (_j.sent()).session;
                goalEvent = {
                    type: "goal.changed",
                    id: "goal_evt_steer",
                    operation: "create",
                    snapshot: {
                        goalID: "goal_steer",
                        revision: 1,
                        objective: "steady the boat",
                        phase: "active",
                        maxGoalRounds: 256,
                        maxGoalTokens: 0,
                        maxGoalWallClockMs: 0,
                        spentGoalTokens: 0,
                        goalWallClockMs: 0,
                    },
                    roundsStarted: 0,
                    at: new Date().toISOString(),
                };
                record.events.push(goalEvent);
                return [4 /*yield*/, seeder.appendEvent(record, goalEvent)];
            case 5:
                _j.sent();
                return [4 /*yield*/, seeder.flush(sessionID)];
            case 6:
                _j.sent();
                return [4 /*yield*/, seeder.close()];
            case 7:
                _j.sent();
                calls = 0;
                releases = new Map();
                provider = {
                    provider: "goal-steer-test",
                    model: "goal-steer-test-model",
                    stream: function (request) {
                        return __asyncGenerator(this, arguments, function stream_2() {
                            var index;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        index = calls++;
                                        if (!(index === 0 || index === 2)) return [3 /*break*/, 2];
                                        return [4 /*yield*/, __await(new Promise(function (resolve) {
                                                var _a;
                                                releases.set(index, resolve);
                                                (_a = request.signal) === null || _a === void 0 ? void 0 : _a.addEventListener("abort", function () { return resolve(); }, {
                                                    once: true,
                                                });
                                            }))];
                                    case 1:
                                        _a.sent();
                                        _a.label = 2;
                                    case 2: return [4 /*yield*/, __await({ type: "done" })];
                                    case 3: return [4 /*yield*/, _a.sent()];
                                    case 4:
                                        _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        });
                    },
                };
                events = [];
                waitUntil = function (predicate_1, label_1) {
                    var args_1 = [];
                    for (var _i = 2; _i < arguments.length; _i++) {
                        args_1[_i - 2] = arguments[_i];
                    }
                    return __awaiter(void 0, __spreadArray([predicate_1, label_1], args_1, true), void 0, function (predicate, label, timeoutMs) {
                        var deadline;
                        if (timeoutMs === void 0) { timeoutMs = 5000; }
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    deadline = Date.now() + timeoutMs;
                                    _a.label = 1;
                                case 1:
                                    if (!(Date.now() < deadline)) return [3 /*break*/, 3];
                                    if (predicate())
                                        return [2 /*return*/];
                                    return [4 /*yield*/, Bun.sleep(20)];
                                case 2:
                                    _a.sent();
                                    return [3 /*break*/, 1];
                                case 3: throw new Error("timed out waiting for ".concat(label));
                            }
                        });
                    });
                };
                client = (0, main_1.createRealRuntimeClient)({
                    workspaceRoot: root,
                    sessionID: sessionID,
                    useSqliteStore: true,
                    provider: provider,
                });
                _j.label = 8;
            case 8:
                _j.trys.push([8, , 20, 22]);
                client.start(function (event) { return events.push(event); });
                return [4 /*yield*/, ((_b = client.sessionAttach) === null || _b === void 0 ? void 0 : _b.call(client, sessionID))];
            case 9:
                _j.sent();
                // Arm + drive a round: the seeded goal starts disarmed by design.
                return [4 /*yield*/, ((_c = client.goalControl) === null || _c === void 0 ? void 0 : _c.call(client, "pause", sessionID))];
            case 10:
                // Arm + drive a round: the seeded goal starts disarmed by design.
                _j.sent();
                return [4 /*yield*/, ((_d = client.goalControl) === null || _d === void 0 ? void 0 : _d.call(client, "resume", sessionID))];
            case 11:
                _j.sent();
                return [4 /*yield*/, waitUntil(function () {
                        return events.some(function (event) { return event.type === "goal.round" && event.round === 1; });
                    }, "goal round 1 admission")];
            case 12:
                _j.sent();
                return [4 /*yield*/, waitUntil(function () {
                        return events.some(function (event) {
                            return event.type === "turn.started" && event.id.includes("round_1");
                        });
                    }, "round 1 turn start")];
            case 13:
                _j.sent();
                goalRevision = events
                    .filter(function (event) {
                    return event.type === "goal.changed";
                })
                    .at(-1).snapshot.revision;
                return [4 /*yield*/, ((_e = client.goalEdit) === null || _e === void 0 ? void 0 : _e.call(client, {
                        goalID: "goal_steer",
                        revision: goalRevision,
                        objective: "steady the NEW boat",
                    }, sessionID))];
            case 14:
                edited = _j.sent();
                (0, bun_test_1.expect)(edited).toMatchObject({ ok: true, action: "edit" });
                (0, bun_test_1.expect)(events.some(function (event) { return event.type === "goal.changed" && event.operation === "edit"; })).toBe(true);
                (_f = releases.get(0)) === null || _f === void 0 ? void 0 : _f();
                return [4 /*yield*/, waitUntil(function () {
                        return events.some(function (event) {
                            return event.type === "turn.input" &&
                                event.internal === true &&
                                event.text.includes("goal edited by user");
                        });
                    }, "next-step steering note")];
            case 15:
                _j.sent();
                // The edit preserves continuation authority, so round 2 is driven and its
                // first provider call blocks. Pausing then hard-stops that in-flight round.
                return [4 /*yield*/, waitUntil(function () {
                        return events.some(function (event) { return event.type === "goal.round" && event.round === 2; });
                    }, "goal round 2 admission")];
            case 16:
                // The edit preserves continuation authority, so round 2 is driven and its
                // first provider call blocks. Pausing then hard-stops that in-flight round.
                _j.sent();
                return [4 /*yield*/, waitUntil(function () {
                        return events.some(function (event) {
                            return event.type === "turn.started" && event.id.includes("round_2");
                        });
                    }, "round 2 turn start")];
            case 17:
                _j.sent();
                return [4 /*yield*/, ((_g = client.goalControl) === null || _g === void 0 ? void 0 : _g.call(client, "pause", sessionID))];
            case 18:
                paused = _j.sent();
                (0, bun_test_1.expect)(paused).toMatchObject({ ok: true, action: "pause" });
                return [4 /*yield*/, waitUntil(function () {
                        return events.some(function (event) {
                            return event.type === "turn.cancelled" && event.id.includes("round_2");
                        });
                    }, "round 2 hard-stop")];
            case 19:
                _j.sent();
                (0, bun_test_1.expect)(events.some(function (event) { return event.type === "goal.changed" && event.operation === "pause"; })).toBe(true);
                return [3 /*break*/, 22];
            case 20:
                for (_i = 0, _a = releases.values(); _i < _a.length; _i++) {
                    release = _a[_i];
                    release();
                }
                return [4 /*yield*/, ((_h = client.dispose) === null || _h === void 0 ? void 0 : _h.call(client))];
            case 21:
                _j.sent();
                return [7 /*endfinally*/];
            case 22: return [2 /*return*/];
        }
    });
}); });
/**
 * A stream killed mid-flight must keep the text it already generated. The
 * event sink coalesces `content.delta` into durable `content.partial` batches,
 * and dispose flushes the last buffer before the store closes.
 */
(0, bun_test_1.test)("a killed stream keeps its generated text as durable partial batches", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, sessionID, yielded, bothChunksYielded, provider, live, client, reader, session, projected, assistantRows, partialText;
    var _a, _b, _c;
    return __generator(this, function (_d) {
        switch (_d.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-partial-kill-"))];
            case 1:
                root = _d.sent();
                sessionID = "ses_partial_kill";
                bothChunksYielded = new Promise(function (resolve) {
                    yielded = resolve;
                });
                provider = {
                    provider: "partial-kill-test",
                    model: "partial-kill-test-model",
                    stream: function (request) {
                        return __asyncGenerator(this, arguments, function stream_3() {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, __await({ type: "content", text: "Recovered " })];
                                    case 1: return [4 /*yield*/, _a.sent()];
                                    case 2:
                                        _a.sent();
                                        return [4 /*yield*/, __await({ type: "content", text: "partial text" })];
                                    case 3: return [4 /*yield*/, _a.sent()];
                                    case 4:
                                        _a.sent();
                                        yielded === null || yielded === void 0 ? void 0 : yielded();
                                        // Simulate a provider request that never completes on its own; the abort
                                        // is what lets dispose finish.
                                        return [4 /*yield*/, __await(new Promise(function (resolve) {
                                                var _a, _b;
                                                if ((_a = request.signal) === null || _a === void 0 ? void 0 : _a.aborted)
                                                    return resolve();
                                                (_b = request.signal) === null || _b === void 0 ? void 0 : _b.addEventListener("abort", function () { return resolve(); }, {
                                                    once: true,
                                                });
                                            }))];
                                    case 5:
                                        // Simulate a provider request that never completes on its own; the abort
                                        // is what lets dispose finish.
                                        _a.sent();
                                        return [4 /*yield*/, __await({ type: "done" })];
                                    case 6: return [4 /*yield*/, _a.sent()];
                                    case 7:
                                        _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        });
                    },
                };
                live = [];
                client = (0, main_1.createRealRuntimeClient)({
                    workspaceRoot: root,
                    sessionID: sessionID,
                    useSqliteStore: true,
                    provider: provider,
                });
                client.start(function (event) { return live.push(event); });
                return [4 /*yield*/, ((_a = client.sessionAttach) === null || _a === void 0 ? void 0 : _a.call(client, sessionID))];
            case 2:
                _d.sent();
                void ((_b = client.submit) === null || _b === void 0 ? void 0 : _b.call(client, "go"));
                return [4 /*yield*/, bothChunksYielded];
            case 3:
                _d.sent();
                return [4 /*yield*/, ((_c = client.dispose) === null || _c === void 0 ? void 0 : _c.call(client))];
            case 4:
                _d.sent();
                // Partials are the durable copy; they must never be re-broadcast live (the
                // live transcript already has the raw deltas).
                (0, bun_test_1.expect)(live.some(function (event) { return event.type === "content.delta"; })).toBe(true);
                (0, bun_test_1.expect)(live.some(function (event) { return event.type === "content.partial"; })).toBe(false);
                reader = (0, session_store_1.createSessionStoreController)({
                    workspaceRoot: root,
                    sessionID: function () { return sessionID; },
                    useSqliteStore: true,
                    attachments: (0, attachments_1.createAttachmentService)(root),
                });
                return [4 /*yield*/, reader.init()];
            case 5:
                _d.sent();
                return [4 /*yield*/, reader.load(sessionID)];
            case 6:
                session = (_d.sent()).session;
                return [4 /*yield*/, reader.close()];
            case 7:
                _d.sent();
                projected = (0, session_1.projectSessionMessages)(session, { order: "asc" });
                assistantRows = projected.data.flatMap(function (message) {
                    return message.rows.filter(function (row) { return row.kind === "assistant"; });
                });
                partialText = assistantRows
                    .flatMap(function (row) {
                    return row.event.type === "content.partial" ? [row.event.text] : [];
                })
                    .join("");
                (0, bun_test_1.expect)(partialText).toBe("Recovered partial text");
                return [2 /*return*/];
        }
    });
}); });
/**
 * Regression for the original ordering bug: when an answer partial flushes on
 * its timer before the provider stream ends, the durable journal must still
 * settle reasoning before that partial.
 */
(0, bun_test_1.test)("durable thinking.done precedes a timer-flushed answer partial", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, sessionID, previousFlushMs, provider_1, live_1, client, deadline, reader, session, turnID_1, turnEvents, thinkingIndex, partialIndex;
    var _a, _b, _c, _d;
    return __generator(this, function (_e) {
        switch (_e.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-partial-order-"))];
            case 1:
                root = _e.sent();
                sessionID = "ses_partial_order";
                previousFlushMs = process.env.NATALIA_PARTIAL_FLUSH_MS;
                process.env.NATALIA_PARTIAL_FLUSH_MS = "100";
                _e.label = 2;
            case 2:
                _e.trys.push([2, , 14, 15]);
                provider_1 = {
                    provider: "partial-order-test",
                    model: "partial-order-test-model",
                    stream: function () {
                        return __asyncGenerator(this, arguments, function stream_4() {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, __await({ type: "thinking", text: "reasoning" })];
                                    case 1: return [4 /*yield*/, _a.sent()];
                                    case 2:
                                        _a.sent();
                                        return [4 /*yield*/, __await({ type: "content", text: "answer" })];
                                    case 3: return [4 /*yield*/, _a.sent()];
                                    case 4:
                                        _a.sent();
                                        return [4 /*yield*/, __await(Bun.sleep(150))];
                                    case 5:
                                        _a.sent();
                                        return [4 /*yield*/, __await({ type: "done" })];
                                    case 6: return [4 /*yield*/, _a.sent()];
                                    case 7:
                                        _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        });
                    },
                };
                live_1 = [];
                client = (0, main_1.createRealRuntimeClient)({
                    workspaceRoot: root,
                    sessionID: sessionID,
                    useSqliteStore: true,
                    provider: provider_1,
                });
                _e.label = 3;
            case 3:
                _e.trys.push([3, , 8, 10]);
                client.start(function (event) { return live_1.push(event); });
                return [4 /*yield*/, ((_a = client.sessionAttach) === null || _a === void 0 ? void 0 : _a.call(client, sessionID))];
            case 4:
                _e.sent();
                void ((_b = client.submit) === null || _b === void 0 ? void 0 : _b.call(client, "go"));
                deadline = Date.now() + 5000;
                _e.label = 5;
            case 5:
                if (!(Date.now() < deadline &&
                    !live_1.some(function (event) { return event.type === "turn.finished"; }))) return [3 /*break*/, 7];
                return [4 /*yield*/, Bun.sleep(20)];
            case 6:
                _e.sent();
                return [3 /*break*/, 5];
            case 7:
                (0, bun_test_1.expect)(live_1.some(function (event) { return event.type === "turn.finished"; })).toBe(true);
                return [3 /*break*/, 10];
            case 8: return [4 /*yield*/, ((_c = client.dispose) === null || _c === void 0 ? void 0 : _c.call(client))];
            case 9:
                _e.sent();
                return [7 /*endfinally*/];
            case 10:
                reader = (0, session_store_1.createSessionStoreController)({
                    workspaceRoot: root,
                    sessionID: function () { return sessionID; },
                    useSqliteStore: true,
                    attachments: (0, attachments_1.createAttachmentService)(root),
                });
                return [4 /*yield*/, reader.init()];
            case 11:
                _e.sent();
                return [4 /*yield*/, reader.load(sessionID)];
            case 12:
                session = (_e.sent()).session;
                return [4 /*yield*/, reader.close()];
            case 13:
                _e.sent();
                turnID_1 = (_d = live_1.find(function (event) { return event.type === "turn.finished"; })) === null || _d === void 0 ? void 0 : _d.id;
                (0, bun_test_1.expect)(turnID_1).toBeDefined();
                turnEvents = session.events.filter(function (event) { return "id" in event && event.id === turnID_1; });
                thinkingIndex = turnEvents.findIndex(function (event) { return event.type === "thinking.done"; });
                partialIndex = turnEvents.findIndex(function (event) { return event.type === "content.partial"; });
                (0, bun_test_1.expect)(thinkingIndex).toBeGreaterThanOrEqual(0);
                (0, bun_test_1.expect)(partialIndex).toBeGreaterThanOrEqual(0);
                (0, bun_test_1.expect)(thinkingIndex).toBeLessThan(partialIndex);
                return [3 /*break*/, 15];
            case 14:
                if (previousFlushMs === undefined)
                    delete process.env.NATALIA_PARTIAL_FLUSH_MS;
                else
                    process.env.NATALIA_PARTIAL_FLUSH_MS = previousFlushMs;
                return [7 /*endfinally*/];
            case 15: return [2 /*return*/];
        }
    });
}); });
