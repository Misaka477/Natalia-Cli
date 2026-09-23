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
var collab_1 = require("@natalia/collab");
/**
 * EI §8.1: plan provenance follows the caller. The Live Work Chat tools (used
 * by Navi) must pass createdBy:"live_chat" through to the plan-doc runtime —
 * the runtime records it, but only if the tool forwards it.
 */
(0, bun_test_1.test)("Navi's plan_doc_write / plan_doc_mark forward createdBy live_chat", function () { return __awaiter(void 0, void 0, void 0, function () {
    var calls, ctx;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                calls = [];
                ctx = {
                    ports: {
                        planDocRuntime: {
                            planDocWrite: function (input) { return __awaiter(void 0, void 0, void 0, function () {
                                return __generator(this, function (_a) {
                                    calls.push(input);
                                    return [2 /*return*/, { planID: "plan_1", documentPath: input.path }];
                                });
                            }); },
                            planDocMark: function (input) { return __awaiter(void 0, void 0, void 0, function () {
                                return __generator(this, function (_a) {
                                    calls.push(input);
                                    return [2 /*return*/, { planID: "plan_1" }];
                                });
                            }); },
                        },
                    },
                };
                return [4 /*yield*/, (0, collab_1.planDocWriteTool)(ctx, "write a plan", "live_chat").execute({ path: "plans/x.md", content: "# x" }, {})];
            case 1:
                _a.sent();
                return [4 /*yield*/, (0, collab_1.planDocMarkTool)(ctx, "live_chat").execute({ path: "plans/x.md" }, {})];
            case 2:
                _a.sent();
                (0, bun_test_1.expect)(calls[0]).toMatchObject({ createdBy: "live_chat" });
                (0, bun_test_1.expect)(calls[1]).toMatchObject({ createdBy: "live_chat" });
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("without an explicit caller the plan tools omit createdBy (runtime default)", function () { return __awaiter(void 0, void 0, void 0, function () {
    var calls, ctx;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                calls = [];
                ctx = {
                    ports: {
                        planDocRuntime: {
                            planDocMark: function (input) { return __awaiter(void 0, void 0, void 0, function () {
                                return __generator(this, function (_a) {
                                    calls.push(input);
                                    return [2 /*return*/, { planID: "plan_1" }];
                                });
                            }); },
                        },
                    },
                };
                return [4 /*yield*/, (0, collab_1.planDocMarkTool)(ctx).execute({ path: "plans/x.md" }, {})];
            case 1:
                _a.sent();
                (0, bun_test_1.expect)(calls[0]).not.toHaveProperty("createdBy");
                return [2 /*return*/];
        }
    });
}); });
