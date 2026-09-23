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
var node_os_1 = require("node:os");
var node_path_1 = require("node:path");
var session_1 = require("@anthelia/session");
var main_1 = require("../src/runtime/main");
var provider = {
    provider: "context-seed-test",
    model: "context-seed-test-model",
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
(0, bun_test_1.test)("same-id attach restores stream context snapshots without full event replay", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, session, store, events, client, deadline;
    var _a, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-context-seed-"))];
            case 1:
                root = _c.sent();
                session = (0, session_1.createSessionRecord)("ses_context_seed", "Context seed");
                session.events.push({
                    type: "navi.chat.message.added",
                    id: "navi_seed",
                    messageID: "navi_msg",
                    role: "chat",
                    text: "hello navi",
                    at: "2026-01-01T00:00:00Z",
                }, {
                    type: "context.snapshot",
                    channel: "navi",
                    usedTokens: 42,
                    pressureTokens: 42,
                    projectedTokens: 42,
                    contextWindow: 1000,
                    source: "provider_usage",
                    at: "2026-01-01T00:00:00Z",
                }, {
                    type: "nia.chat.message.added",
                    id: "nia_seed",
                    messageID: "nia_msg",
                    role: "chat",
                    text: "hello nia",
                    at: "2026-01-01T00:00:00Z",
                });
                store = new session_1.JsonSessionStore((0, node_path_1.join)(root, ".natalia", "sessions"));
                return [4 /*yield*/, store.save(session)];
            case 2:
                _c.sent();
                events = [];
                client = (0, main_1.createRealRuntimeClient)({
                    workspaceRoot: root,
                    sessionID: session.id,
                    provider: provider,
                });
                _c.label = 3;
            case 3:
                _c.trys.push([3, , 8, 10]);
                client.start(function (event) { return events.push(event); });
                return [4 /*yield*/, ((_a = client.sessionAttach) === null || _a === void 0 ? void 0 : _a.call(client, session.id))];
            case 4:
                _c.sent();
                deadline = Date.now() + 2000;
                _c.label = 5;
            case 5:
                if (!(Date.now() < deadline &&
                    !(events.some(function (event) { return event.type === "navi.context.snapshot"; }) &&
                        events.some(function (event) { return event.type === "nia.context.snapshot"; })))) return [3 /*break*/, 7];
                return [4 /*yield*/, Bun.sleep(20)];
            case 6:
                _c.sent();
                return [3 /*break*/, 5];
            case 7:
                // Existing durable snapshot: republished to the live sink as a Navi-owned
                // event, no shared channel identity.
                (0, bun_test_1.expect)(events.find(function (event) { return event.type === "navi.context.snapshot"; })).toMatchObject({
                    type: "navi.context.snapshot",
                    usedTokens: 42,
                    pressureTokens: 42,
                    projectedTokens: 42,
                    contextWindow: 1000,
                });
                // Legacy stream with no durable snapshot: seeded from projected history.
                (0, bun_test_1.expect)(events.find(function (event) { return event.type === "nia.context.snapshot"; })).toMatchObject({
                    type: "nia.context.snapshot",
                });
                (0, bun_test_1.expect)(events.some(function (event) { return event.type === "nia.context.snapshot"; })).toBe(true);
                return [3 /*break*/, 10];
            case 8: return [4 /*yield*/, ((_b = client.dispose) === null || _b === void 0 ? void 0 : _b.call(client))];
            case 9:
                _c.sent();
                return [7 /*endfinally*/];
            case 10: return [2 /*return*/];
        }
    });
}); });
