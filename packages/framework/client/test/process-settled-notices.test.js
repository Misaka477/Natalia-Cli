"use strict";
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
var bun_test_1 = require("bun:test");
var process_settled_notices_1 = require("../src/runtime/initialize/process-settled-notices");
/** A fake ledger that records what was appended. */
function ledger() {
    var entries = [];
    return {
        entries: entries,
        snapshot: function () { return ({ entries: entries }); },
        add: function (entry) {
            entries.push(entry);
        },
    };
}
function harness(input) {
    var executions = new Map();
    for (var _i = 0, _a = Object.entries(input.sessions); _i < _a.length; _i++) {
        var _b = _a[_i], id = _b[0], ledgerFor = _b[1];
        executions.set(id, { context: ledgerFor });
    }
    var ctx = {
        ports: { getExecutionBySession: function () { return executions; } },
    };
    return ctx;
}
/** A capability registry whose observer can be swapped in late. */
function capabilityRegistry() {
    var observer;
    var updates = [];
    return {
        setObserver: function (next) {
            observer = next;
            for (var _i = 0, _a = __spreadArray([], updates, true); _i < _a.length; _i++) {
                var listener = _a[_i];
                listener();
            }
        },
        api: {
            service: function (_name) { return observer; },
            onServiceUpdate: function (listener) {
                updates.push(listener);
                return function () {
                    var at = updates.indexOf(listener);
                    if (at >= 0)
                        updates.splice(at, 1);
                };
            },
        },
    };
}
var notice = function (input) {
    var _a;
    return (__assign(__assign(__assign({ id: input.id, command: "sleep 30", status: (_a = input.status) !== null && _a !== void 0 ? _a : "exited", workspaceRoot: "/ws" }, (input.sessionID ? { sessionID: input.sessionID } : {})), { startedAt: "2026-01-01T00:00:00.000Z", endedAt: "2026-01-01T00:00:30.000Z" }), (input.exitCode === undefined ? {} : { exitCode: input.exitCode })));
};
(0, bun_test_1.test)("a process exit lands in the session that started it", function () { return __awaiter(void 0, void 0, void 0, function () {
    var starter, other, ctx, registry, wire, emit;
    return __generator(this, function (_a) {
        starter = ledger();
        other = ledger();
        ctx = harness({ sessions: { ses_a: starter, ses_b: other } });
        registry = capabilityRegistry();
        wire = (0, process_settled_notices_1.wireProcessSettledNotices)(ctx, registry.api);
        emit = function () { };
        registry.setObserver({
            subscribe: function (fn) {
                emit = fn;
                return function () { };
            },
        });
        emit(notice({ id: "proc_1", sessionID: "ses_a", exitCode: 3 }));
        // Only the starter is told: a notice in every session of a workspace would
        // tell agents about work they never did.
        (0, bun_test_1.expect)(starter.entries).toHaveLength(1);
        (0, bun_test_1.expect)(other.entries).toHaveLength(0);
        (0, bun_test_1.expect)(starter.entries[0].role).toBe("dynamic");
        (0, bun_test_1.expect)(starter.entries[0].id).toBe("process_settled:proc_1");
        (0, bun_test_1.expect)(starter.entries[0].content).toContain('source="process_settled"');
        (0, bun_test_1.expect)(starter.entries[0].content).toContain("exit code 3");
        (0, bun_test_1.expect)(starter.entries[0].content).toContain("sleep 30");
        (0, bun_test_1.expect)(starter.entries[0].content).toContain("This is the runtime reporting the outcome");
        wire();
        return [2 /*return*/];
    });
}); });
(0, bun_test_1.test)("the same process is noticed once", function () { return __awaiter(void 0, void 0, void 0, function () {
    var starter, ctx, registry, wire, emit;
    return __generator(this, function (_a) {
        starter = ledger();
        ctx = harness({ sessions: { ses_a: starter } });
        registry = capabilityRegistry();
        wire = (0, process_settled_notices_1.wireProcessSettledNotices)(ctx, registry.api);
        emit = function () { };
        registry.setObserver({
            subscribe: function (fn) {
                emit = fn;
                return function () { };
            },
        });
        emit(notice({ id: "proc_1", sessionID: "ses_a" }));
        emit(notice({ id: "proc_1", sessionID: "ses_a" }));
        // A second entry would read as a second process having finished.
        (0, bun_test_1.expect)(starter.entries).toHaveLength(1);
        wire();
        return [2 /*return*/];
    });
}); });
(0, bun_test_1.test)("a notice with no starting session is dropped", function () { return __awaiter(void 0, void 0, void 0, function () {
    var starter, ctx, registry, wire, emit;
    return __generator(this, function (_a) {
        starter = ledger();
        ctx = harness({ sessions: { ses_a: starter } });
        registry = capabilityRegistry();
        wire = (0, process_settled_notices_1.wireProcessSettledNotices)(ctx, registry.api);
        emit = function () { };
        registry.setObserver({
            subscribe: function (fn) {
                emit = fn;
                return function () { };
            },
        });
        emit(notice({ id: "proc_1" }));
        (0, bun_test_1.expect)(starter.entries).toHaveLength(0);
        wire();
        return [2 /*return*/];
    });
}); });
(0, bun_test_1.test)("a notice for an unknown session is dropped", function () { return __awaiter(void 0, void 0, void 0, function () {
    var starter, ctx, registry, wire, emit;
    return __generator(this, function (_a) {
        starter = ledger();
        ctx = harness({ sessions: { ses_a: starter } });
        registry = capabilityRegistry();
        wire = (0, process_settled_notices_1.wireProcessSettledNotices)(ctx, registry.api);
        emit = function () { };
        registry.setObserver({
            subscribe: function (fn) {
                emit = fn;
                return function () { };
            },
        });
        emit(notice({ id: "proc_1", sessionID: "ses_gone" }));
        (0, bun_test_1.expect)(starter.entries).toHaveLength(0);
        wire();
        return [2 /*return*/];
    });
}); });
(0, bun_test_1.test)("an observer arriving late is still subscribed", function () { return __awaiter(void 0, void 0, void 0, function () {
    var starter, ctx, registry, wire, emit;
    return __generator(this, function (_a) {
        starter = ledger();
        ctx = harness({ sessions: { ses_a: starter } });
        registry = capabilityRegistry();
        wire = (0, process_settled_notices_1.wireProcessSettledNotices)(ctx, registry.api);
        emit = function () { };
        registry.setObserver({
            subscribe: function (fn) {
                emit = fn;
                return function () { };
            },
        });
        emit(notice({ id: "proc_1", sessionID: "ses_a" }));
        (0, bun_test_1.expect)(starter.entries).toHaveLength(1);
        wire();
        return [2 /*return*/];
    });
}); });
(0, bun_test_1.test)("a swapped observer replaces the subscription instead of stacking one", function () { return __awaiter(void 0, void 0, void 0, function () {
    var starter, ctx, registry, wire, second;
    return __generator(this, function (_a) {
        starter = ledger();
        ctx = harness({ sessions: { ses_a: starter } });
        registry = capabilityRegistry();
        wire = (0, process_settled_notices_1.wireProcessSettledNotices)(ctx, registry.api);
        registry.setObserver({
            subscribe: function (fn) {
                return function () { };
            },
        });
        second = function () { };
        registry.setObserver({
            subscribe: function (fn) {
                second = fn;
                return function () { };
            },
        });
        // Only the second is live, so only it can deliver.
        second(notice({ id: "proc_1", sessionID: "ses_a" }));
        (0, bun_test_1.expect)(starter.entries).toHaveLength(1);
        wire();
        return [2 /*return*/];
    });
}); });
