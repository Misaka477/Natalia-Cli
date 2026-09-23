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
/**
 * Routing and settlement regressions for the interactive waiter.
 *
 * Two bugs this locks down:
 *   - a response for a recovered/stale request must be routed by the client's
 *     `sessionID` hint instead of the currently attached session;
 *   - a cancelled or expired request must settle the durable journal with a
 *     `*response` event, or the UI re-opens it on every re-attach.
 */
var bun_test_1 = require("bun:test");
var interactive_waiter_1 = require("../src/interactive-waiter");
var work_ledger_1 = require("@natalia/work-ledger");
function harness(options) {
    var _a, _b;
    var attached = (_a = options.attached) !== null && _a !== void 0 ? _a : "ses_attached";
    var published = [];
    var waiter = (0, interactive_waiter_1.createInteractiveWaiter)({
        publish: function (event) {
            published.push({ session: attached, event: event });
        },
        publishForSession: function (session, event) {
            published.push({ session: session, event: event });
        },
        sessionID: function () { return attached; },
        sessionIDForTurn: function () { return attached; },
        permissionMode: function () { return "ask"; },
        abortSignal: function () { return options.signal; },
        activeTurnID: function () { return undefined; },
        isPending: (_b = options.isPending) !== null && _b !== void 0 ? _b : (function () { return false; }),
        agentIDForTurn: function () { return undefined; },
        workLedger: function () {
            return (0, work_ledger_1.createWorkLedgerController)({ openFindingIDs: function () { return new Set(); } });
        },
    });
    return { waiter: waiter, published: published };
}
function responseSession(published) {
    var _a;
    return (_a = published.find(function (_a) {
        var event = _a.event;
        return event.type === "question.response";
    })) === null || _a === void 0 ? void 0 : _a.session;
}
(0, bun_test_1.test)("a live question response keeps the live session over a conflicting hint", function () { return __awaiter(void 0, void 0, void 0, function () {
    var h, pending, outcome;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                h = harness({});
                pending = h.waiter.requireQuestion("q1", "turn_a", {
                    title: "t",
                    questions: [],
                });
                outcome = h.waiter.respondQuestion({
                    requestID: "q1",
                    answers: [["a"]],
                    sessionID: "ses_other",
                });
                (0, bun_test_1.expect)(outcome).toEqual({ accepted: true });
                (0, bun_test_1.expect)(responseSession(h.published)).toBe("ses_attached");
                return [4 /*yield*/, (0, bun_test_1.expect)(pending).resolves.toEqual([["a"]])];
            case 1:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("a recovered question response is routed by its session hint", function () {
    var h = harness({
        attached: "ses_attached",
        isPending: function (session, id, kind) {
            return session === "ses_target" &&
                kind === "question" &&
                id === "q1";
        },
    });
    var outcome = h.waiter.respondQuestion({
        requestID: "q1",
        answers: [["a"]],
        sessionID: "ses_target",
    });
    (0, bun_test_1.expect)(outcome).toEqual({ accepted: true });
    (0, bun_test_1.expect)(responseSession(h.published)).toBe("ses_target");
});
(0, bun_test_1.test)("cancelling a question settles the durable journal", function () { return __awaiter(void 0, void 0, void 0, function () {
    var controller, h, pending, settled;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                controller = new AbortController();
                h = harness({
                    attached: "ses_a",
                    signal: controller.signal,
                    isPending: function (session, id, kind) {
                        return session === "ses_a" && kind === "question" && id === "q1";
                    },
                });
                pending = h.waiter.requireQuestion("q1", "turn_a", {
                    title: "t",
                    questions: [],
                });
                controller.abort(new Error("stop"));
                return [4 /*yield*/, (0, bun_test_1.expect)(pending).rejects.toThrow("stop")];
            case 1:
                _a.sent();
                settled = h.published.find(function (_a) {
                    var event = _a.event;
                    return event.type === "question.response";
                });
                (0, bun_test_1.expect)(settled === null || settled === void 0 ? void 0 : settled.session).toBe("ses_a");
                if ((settled === null || settled === void 0 ? void 0 : settled.event.type) === "question.response")
                    (0, bun_test_1.expect)(settled.event.rejected).toBe(true);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("a generic interactive request publishes, waits and settles by kind", function () { return __awaiter(void 0, void 0, void 0, function () {
    var h, pending;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                h = harness({});
                pending = h.waiter.requireInteractive({
                    requestID: "x1",
                    turnID: "turn_a",
                    kind: "custom.kind",
                    title: "Pick one",
                    payload: { options: ["a", "b"] },
                    validate: function (response) { return (response === "a" ? undefined : ["must be a"]); },
                });
                (0, bun_test_1.expect)(h.published.some(function (_a) {
                    var event = _a.event;
                    return event.type === "interactive.request" &&
                        event.id === "x1" &&
                        event.kind === "custom.kind";
                })).toBe(true);
                (0, bun_test_1.expect)(h.waiter.respondInteractive({
                    requestID: "x1",
                    kind: "custom.kind",
                    response: "a",
                })).toEqual({ accepted: true });
                return [4 /*yield*/, (0, bun_test_1.expect)(pending).resolves.toEqual({
                        response: "a",
                        rejected: undefined,
                    })];
            case 1:
                _a.sent();
                (0, bun_test_1.expect)(h.published.some(function (_a) {
                    var event = _a.event;
                    return event.type === "interactive.response" &&
                        event.id === "x1" &&
                        event.kind === "custom.kind";
                })).toBe(true);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("a generic interactive validate failure rejects the wait", function () { return __awaiter(void 0, void 0, void 0, function () {
    var h, pending;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                h = harness({});
                pending = h.waiter.requireInteractive({
                    requestID: "x2",
                    turnID: "turn_a",
                    kind: "custom.kind",
                    title: "Pick",
                    payload: {},
                    validate: function () { return ["bad value"]; },
                });
                h.waiter.respondInteractive({
                    requestID: "x2",
                    kind: "custom.kind",
                    response: 1,
                });
                return [4 /*yield*/, (0, bun_test_1.expect)(pending).rejects.toThrow("invalid interactive response")];
            case 1:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("a response to a non-pending generic interactive is refused", function () {
    var h = harness({});
    (0, bun_test_1.expect)(h.waiter.respondInteractive({
        requestID: "gone",
        kind: "custom.kind",
        response: null,
    })).toEqual({
        accepted: false,
        reason: "the interactive request is no longer pending",
    });
});
