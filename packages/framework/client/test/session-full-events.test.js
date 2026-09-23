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
var bun_test_1 = require("bun:test");
var substrate_1 = require("@anthelia/substrate");
var session_store_1 = require("@anthelia/session-store");
var runtime_services_1 = require("@natalia/runtime-services");
(0, bun_test_1.test)("ensureSessionFullEvents loads the full log when the fast path seeded only a tail", function () { return __awaiter(void 0, void 0, void 0, function () {
    var partial, full, loadFullCalls, store, ctx, exec;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                partial = [
                    {
                        type: "navi.chat.message.new",
                        id: "navi:partial",
                        messageID: "partial",
                        role: "chat",
                        text: "tail only",
                        at: "2026-01-01T00:00:00.000Z",
                    },
                ];
                full = __spreadArray([
                    {
                        type: "navi.chat.message.new",
                        id: "navi:old",
                        messageID: "old",
                        role: "chat",
                        text: "old durable row",
                        at: "2025-01-01T00:00:00.000Z",
                    }
                ], partial, true);
                loadFullCalls = 0;
                store = {
                    status: function () { return ({ initialized: true, mode: "sqlite" }); },
                    flush: function () { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                        return [2 /*return*/, undefined];
                    }); }); },
                    loadFullAsync: function () { return __awaiter(void 0, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            loadFullCalls += 1;
                            return [2 /*return*/, {
                                    id: "ses_full_events",
                                    title: "",
                                    createdAt: "",
                                    events: full,
                                    cancelled: false,
                                    resumable: true,
                                }];
                        });
                    }); },
                };
                ctx = {
                    state: {
                        // The full-events path reads only the status/loadFullAsync pair; the
                        // double is path-limited, hence the explicit face cast.
                        serviceDirectory: (0, runtime_services_1.createTestContext)([
                            session_store_1.sessionStoreController.mock(store),
                        ]),
                    },
                    ports: {
                        resolveService: function () { return store; },
                        // Production always exposes this; the test store has no pending
                        // persistence chain to drain, but the contract must still be honored.
                        getSessionPersistenceForSession: function () { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/, undefined];
                        }); }); },
                    },
                };
                exec = {
                    session: {
                        id: "ses_full_events",
                        title: "",
                        createdAt: "",
                        events: partial,
                        cancelled: false,
                        resumable: true,
                    },
                    eventCount: partial.length,
                    fullEventsLoaded: false,
                };
                return [4 /*yield*/, (0, substrate_1.ensureSessionFullEvents)(ctx, exec)];
            case 1:
                _a.sent();
                (0, bun_test_1.expect)(loadFullCalls).toBe(1);
                (0, bun_test_1.expect)(exec.fullEventsLoaded).toBe(true);
                (0, bun_test_1.expect)(exec.session.events).toEqual(full);
                return [4 /*yield*/, (0, substrate_1.ensureSessionFullEvents)(ctx, exec)];
            case 2:
                _a.sent();
                (0, bun_test_1.expect)(loadFullCalls).toBe(1);
                return [2 /*return*/];
        }
    });
}); });
