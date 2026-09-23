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
var substrate_1 = require("@anthelia/substrate");
var substrate_2 = require("@anthelia/substrate");
var session_store_1 = require("@anthelia/session-store");
var runtime_services_1 = require("@natalia/runtime-services");
function entry(seq) {
    return {
        seq: seq,
        event: { type: "content.done", id: "e".concat(seq), text: "body-".concat(seq) },
    };
}
/** A six-event log served two entries per page, newest-first by the window. */
function harness() {
    return __awaiter(this, void 0, void 0, function () {
        var all, window, exec, ctx, project;
        var _this = this;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    all = [1, 2, 3, 4, 5, 6].map(entry);
                    window = new substrate_1.SessionWindow({
                        loader: {
                            loadTail: function () { return __awaiter(_this, void 0, void 0, function () { return __generator(this, function (_a) {
                                return [2 /*return*/, ({ events: all.slice(-2), hasMore: true })];
                            }); }); },
                            loadBefore: function (beforeSeq) { return __awaiter(_this, void 0, void 0, function () {
                                var end, start;
                                return __generator(this, function (_a) {
                                    end = beforeSeq - 1;
                                    start = Math.max(0, end - 2);
                                    return [2 /*return*/, { events: all.slice(start, end), hasMore: start > 0 }];
                                });
                            }); },
                        },
                    });
                    return [4 /*yield*/, window.open()];
                case 1:
                    _a.sent();
                    exec = {
                        session: { id: "ses_scan", events: [] },
                        eventWindow: window,
                    };
                    ctx = {
                        state: {
                            // The scan path only needs the binding to exist: with an open window it
                            // returns before touching the store, so a minimal double stands in.
                            serviceDirectory: (0, runtime_services_1.createTestContext)([
                                session_store_1.sessionStoreController.mock({
                                    flush: function () { return __awaiter(_this, void 0, void 0, function () { return __generator(this, function (_a) {
                                        return [2 /*return*/, undefined];
                                    }); }); },
                                }),
                            ]),
                        },
                        ports: { resolveService: function () { return ({}); } },
                    };
                    project = function (events) {
                        return events.map(function (event) { return ({ id: "id" in event ? String(event.id) : "" }); });
                    };
                    return [2 /*return*/, { ctx: ctx, exec: exec, project: project }];
            }
        });
    });
}
(0, bun_test_1.test)("scan finds in the tail without paging older", function () { return __awaiter(void 0, void 0, void 0, function () {
    var _a, ctx, exec, project, result;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, harness()];
            case 1:
                _a = _b.sent(), ctx = _a.ctx, exec = _a.exec, project = _a.project;
                return [4 /*yield*/, (0, substrate_2.scanSessionWindowNewestFirst)(ctx, exec, project, function (row) { return row.id === "e6"; })];
            case 2:
                result = _b.sent();
                (0, bun_test_1.expect)(result).toEqual({
                    kind: "found",
                    item: { id: "e6" },
                    newerCount: 0,
                });
                (0, bun_test_1.expect)(exec.eventWindow.baseSeq).toBe(5);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("scan pages older until it finds the row and counts newer rows", function () { return __awaiter(void 0, void 0, void 0, function () {
    var _a, ctx, exec, project, result;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, harness()];
            case 1:
                _a = _b.sent(), ctx = _a.ctx, exec = _a.exec, project = _a.project;
                return [4 /*yield*/, (0, substrate_2.scanSessionWindowNewestFirst)(ctx, exec, project, function (row) { return row.id === "e2"; })];
            case 2:
                result = _b.sent();
                (0, bun_test_1.expect)(result).toEqual({
                    kind: "found",
                    item: { id: "e2" },
                    newerCount: 4,
                });
                // It had to walk back to the base of the log.
                (0, bun_test_1.expect)(exec.eventWindow.baseSeq).toBe(1);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("scan reports exhausted when the whole log is searched", function () { return __awaiter(void 0, void 0, void 0, function () {
    var _a, ctx, exec, project, result;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, harness()];
            case 1:
                _a = _b.sent(), ctx = _a.ctx, exec = _a.exec, project = _a.project;
                return [4 /*yield*/, (0, substrate_2.scanSessionWindowNewestFirst)(ctx, exec, project, function (row) { return row.id === "missing"; })];
            case 2:
                result = _b.sent();
                (0, bun_test_1.expect)(result).toEqual({ kind: "exhausted" });
                (0, bun_test_1.expect)(exec.eventWindow.baseSeq).toBe(1);
                return [2 /*return*/];
        }
    });
}); });
