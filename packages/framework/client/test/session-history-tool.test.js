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
var session_history_tool_1 = require("../src/runtime/session-history-tool");
var session_store_1 = require("@anthelia/session-store");
var runtime_services_1 = require("@natalia/runtime-services");
var PAGE = {
    data: [],
    cursor: { previous: "older", next: "newer" },
};
function harness() {
    var captured = [];
    var session = { id: "ses_history" };
    var ctx = {
        state: {
            serviceDirectory: (0, runtime_services_1.createTestContext)([
                session_store_1.sessionStoreController.mock({
                    messages: function (id, _fallback, options) {
                        captured.push({ id: id, options: options });
                        return Promise.resolve(PAGE);
                    },
                }),
            ]),
        },
        ports: {
            getReady: function () { return Promise.resolve(); },
            getSessionID: function () { return "ses_history"; },
            getExecutionBySession: function () {
                return new Map([["ses_history", { session: session }]]);
            },
            getSession: function () { return session; },
            resolveService: function () { return ({
                messages: function (id, _fallback, options) {
                    captured.push({ id: id, options: options });
                    return Promise.resolve(PAGE);
                },
            }); },
        },
    };
    return { tool: (0, session_history_tool_1.createSessionHistoryTool)(ctx), captured: captured };
}
(0, bun_test_1.test)("session_history passes the cursor back and clamps the limit", function () { return __awaiter(void 0, void 0, void 0, function () {
    var _a, tool, captured, result;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _a = harness(), tool = _a.tool, captured = _a.captured;
                return [4 /*yield*/, tool.execute({ cursor: "page-2", limit: 999, order: "desc" }, { workspaceRoot: "/w", sessionID: "ses_history" })];
            case 1:
                result = _b.sent();
                (0, bun_test_1.expect)(captured).toHaveLength(1);
                (0, bun_test_1.expect)(captured[0].id).toBe("ses_history");
                (0, bun_test_1.expect)(captured[0].options).toEqual({
                    limit: 200,
                    cursor: "page-2",
                    order: "desc",
                });
                (0, bun_test_1.expect)(JSON.parse(result)).toEqual(PAGE);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("session_history defaults to a bounded page when no args are given", function () { return __awaiter(void 0, void 0, void 0, function () {
    var _a, tool, captured, result;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _a = harness(), tool = _a.tool, captured = _a.captured;
                return [4 /*yield*/, tool.execute({}, { workspaceRoot: "/w", sessionID: "ses_history" })];
            case 1:
                result = _b.sent();
                (0, bun_test_1.expect)(captured[0].options).toEqual({ limit: 40 });
                (0, bun_test_1.expect)(JSON.parse(result).cursor).toEqual({
                    previous: "older",
                    next: "newer",
                });
                return [2 /*return*/];
        }
    });
}); });
