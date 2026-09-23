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
exports.ensureCompleteSessionFactState = ensureCompleteSessionFactState;
exports.ensureSessionFullEvents = ensureSessionFullEvents;
var session_store_1 = require("@anthelia/session-store");
var runtime_1 = require("@natalia/runtime");
var session_event_retention_1 = require("./session-event-retention");
var operation_log_1 = require("@natalia/operation-log");
var session_facts_1 = require("./session-facts");
/**
 * Complete the incremental fact state for an execution that needs cross-history
 * facts. It streams the durable log into the state when a store can be paged, so
 * `exec.session.events` does not have to hold the whole journal; only when no
 * store is available does it fall back to the explicit full load.
 */
function ensureCompleteSessionFactState(ctx, exec) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (exec.factStateComplete === true)
                        return [2 /*return*/];
                    return [4 /*yield*/, (0, session_facts_1.completeSessionFactState)(ctx, exec)];
                case 1:
                    if (_a.sent())
                        return [2 /*return*/];
                    return [4 /*yield*/, ensureSessionFullEvents(ctx, exec)];
                case 2:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
/**
 * Load the full durable event log into an execution state.
 *
 * The fast attach path may initially provide only the context tail. Consumers
 * that need the complete transcript/history must call this before reading
 * `exec.session.events`. The promise is memoized per execution so concurrent
 * callers share one load.
 */
function ensureSessionFullEvents(ctx, exec) {
    var _this = this;
    var _a;
    if (exec.fullEventsPromise)
        return exec.fullEventsPromise;
    // The fast attach path seeds `session.events` with only the post-epoch tail
    // and sets `eventCount` to that tail length. Comparing `events.length` to
    // `eventCount` therefore cannot tell whether the complete durable log is
    // loaded. Consumers such as the Navi/Nia chat surfaces read this log directly
    // and saw an empty stream until the background full-load happened to finish.
    if (exec.fullEventsLoaded === true)
        return Promise.resolve();
    if (process.env.NATALIA_MEMORY_TRACE === "1" ||
        process.env.NATALIA_TRACE_FULL_EVENTS === "1") {
        var stack = (_a = new Error("full-events caller").stack) === null || _a === void 0 ? void 0 : _a.split("\n").slice(1, 8).join("\n");
        (0, operation_log_1.logOf)(ctx.state.serviceDirectory).warn("full-events", "caller session=".concat(exec.session.id, "\n").concat(stack));
    }
    var promise = (function () { return __awaiter(_this, void 0, void 0, function () {
        var sessionStore, full;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    sessionStore = ctx.state.serviceDirectory.getOptional(session_store_1.sessionStoreController);
                    if (!sessionStore)
                        throw new Error("session store unavailable (natalia-session-store)");
                    // A live event can be queued in the per-session persistence chain but not
                    // yet in the store. Drain that chain and the store flush before reading the
                    // full log, otherwise the load replaces `session.events` and drops the live
                    // tail (the window opener does the same before its gap check).
                    return [4 /*yield*/, ctx.ports
                            .getSessionPersistenceForSession(exec.session.id)
                            .catch(function () { return undefined; })];
                case 1:
                    // A live event can be queued in the per-session persistence chain but not
                    // yet in the store. Drain that chain and the store flush before reading the
                    // full log, otherwise the load replaces `session.events` and drops the live
                    // tail (the window opener does the same before its gap check).
                    _a.sent();
                    return [4 /*yield*/, sessionStore.flush(exec.session.id).catch(function () { return undefined; })];
                case 2:
                    _a.sent();
                    (0, runtime_1.memoryTrace)("execution.fullEvents.start", {
                        sessionID: exec.session.id,
                        currentEvents: exec.session.events.length,
                    });
                    return [4 /*yield*/, sessionStore.loadFullAsync(exec.session.id, {
                            runtimeEvents: true,
                        })];
                case 3:
                    full = _a.sent();
                    exec.session.events = (0, session_event_retention_1.windowRuntimeEvents)((0, session_event_retention_1.filterRuntimeRetainedEvents)(full.events, sessionStore.status().mode, true), (0, session_event_retention_1.maxLiveSessionEvents)());
                    exec.eventCount = exec.session.events.length;
                    exec.fullEventsLoaded = true;
                    // The base log changed, so the incremental fact state must be re-seeded.
                    (0, session_facts_1.reseedSessionFactState)(exec, true);
                    (0, runtime_1.memoryTrace)("execution.fullEvents.done", {
                        sessionID: exec.session.id,
                        events: exec.session.events.length,
                    });
                    return [2 /*return*/];
            }
        });
    }); })();
    exec.fullEventsPromise = promise.catch(function (error) {
        exec.fullEventsPromise = undefined;
        throw error;
    });
    return exec.fullEventsPromise;
}
