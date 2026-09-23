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
Object.defineProperty(exports, "__esModule", { value: true });
var bun_test_1 = require("bun:test");
var runtime_services_1 = require("@natalia/runtime-services");
var compaction_1 = require("@anthelia/compaction");
var runtime_1 = require("@natalia/runtime");
var collab_1 = require("@natalia/collab");
var session_1 = require("@anthelia/session");
(0, bun_test_1.test)("Navi and Nia compaction retain independent ledgers, providers, and durable boundaries", function () { return __awaiter(void 0, void 0, void 0, function () {
    var calls, published, naviLedger, niaLedger, naviProvider, niaProvider, compaction, ctx, exec, messages, run;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                calls = [];
                published = [];
                naviLedger = new runtime_1.ContextLedger();
                niaLedger = new runtime_1.ContextLedger();
                naviProvider = { provider: "navi", model: "navi-model" };
                niaProvider = { provider: "nia", model: "nia-model" };
                compaction = {
                    compactBeforeProviderStep: function () {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                return [2 /*return*/, { compacted: false }];
                            });
                        });
                    },
                    runWithContextLimitRecovery: function () {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                return [2 /*return*/, { recovered: false }];
                            });
                        });
                    },
                    prepareContextRequest: function (input) {
                        return __awaiter(this, void 0, void 0, function () {
                            var rebuilt;
                            return __generator(this, function (_a) {
                                calls.push({ ledger: input.ledger, provider: input.provider });
                                input.ledger.replaceAfterCompaction({ id: "summary", role: "summary", content: "summary" }, []);
                                rebuilt = input.rebuildOutbound(input.ledger.snapshot().entries, "compact");
                                return [2 /*return*/, {
                                        outbound: rebuilt,
                                        decision: "ratio",
                                        compacted: true,
                                        pruned: 0,
                                        used: 0,
                                    }];
                            });
                        });
                    },
                };
                ctx = {
                    state: {
                        serviceDirectory: (0, runtime_services_1.createTestContext)([compaction_1.compactionService.mock(compaction)]),
                    },
                    ports: {
                        resolveService: function () { return compaction; },
                        getTsRuntimeConfig: function () { return ({ context: { compactionEnabled: true } }); },
                    },
                };
                exec = {
                    session: { id: "ses_compaction", events: [] },
                    runtimeContextConfig: { max: 1, thresholdPercent: 1, reserved: 0 },
                };
                messages = [
                    { role: "system", content: "system" },
                    { role: "user", content: "first" },
                    { role: "assistant", content: "answer" },
                ];
                run = function (ledger, provider, type) {
                    return (0, collab_1.compactChatBeforeProviderStep)(ctx, exec, ledger, provider, messages, new AbortController().signal, {
                        meter: new runtime_1.TokenMeter(),
                        compactionID: "".concat(type, ":ses_compaction"),
                        instruction: "".concat(type, " instruction"),
                        prune: true,
                        durableMessages: [
                            { messageID: "".concat(type, "-1"), role: "user", text: "first" },
                            { messageID: "".concat(type, "-2"), role: "chat", text: "answer" },
                        ],
                        publishCompacted: function (summary, compactedThroughMessageID) {
                            return published.push({
                                type: "".concat(type, ".chat.compacted"),
                                id: "".concat(type, "-compacted"),
                                messageID: "".concat(type, "-summary"),
                                summary: summary,
                                compactedThroughMessageID: compactedThroughMessageID,
                                at: "now",
                            });
                        },
                        publishCompactionEvent: function () { return undefined; },
                    });
                };
                return [4 /*yield*/, run(naviLedger, naviProvider, "navi")];
            case 1:
                _a.sent();
                return [4 /*yield*/, run(niaLedger, niaProvider, "nia")];
            case 2:
                _a.sent();
                (0, bun_test_1.expect)(calls).toEqual([
                    { ledger: naviLedger, provider: naviProvider },
                    { ledger: niaLedger, provider: niaProvider },
                ]);
                (0, bun_test_1.expect)(naviLedger).not.toBe(niaLedger);
                (0, bun_test_1.expect)(published).toEqual([
                    bun_test_1.expect.objectContaining({
                        type: "navi.chat.compacted",
                        compactedThroughMessageID: "navi-2",
                    }),
                    bun_test_1.expect.objectContaining({
                        type: "nia.chat.compacted",
                        compactedThroughMessageID: "nia-2",
                    }),
                ]);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("a truncated stream history resets only its own compaction ledger", function () { return __awaiter(void 0, void 0, void 0, function () {
    var ledger, compaction, ctx, exec, stream;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                ledger = new runtime_1.ContextLedger();
                compaction = {
                    prepareContextRequest: function (input) {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                return [2 /*return*/, {
                                        outbound: input.outbound,
                                        decision: "none",
                                        compacted: false,
                                        pruned: 0,
                                        used: 0,
                                    }];
                            });
                        });
                    },
                };
                ctx = {
                    state: {
                        serviceDirectory: (0, runtime_services_1.createTestContext)([
                            compaction_1.compactionService.mock(__assign(__assign({}, compaction), { compactBeforeProviderStep: function () { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                                    return [2 /*return*/, ({ compacted: false })];
                                }); }); }, runWithContextLimitRecovery: function () { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                                    return [2 /*return*/, ({ recovered: false })];
                                }); }); } })),
                        ]),
                    },
                    ports: {
                        resolveService: function () { return compaction; },
                        getTsRuntimeConfig: function () { return ({ context: { compactionEnabled: true } }); },
                    },
                };
                exec = {
                    session: { id: "ses_rollback", events: [] },
                    runtimeContextConfig: { max: 9999, thresholdPercent: 90, reserved: 0 },
                };
                stream = {
                    meter: new runtime_1.TokenMeter(),
                    compactionID: "navi:ses_rollback",
                    instruction: "Navi instruction",
                    durableMessages: [],
                    prune: true,
                    publishCompacted: function () { return undefined; },
                    publishCompactionEvent: function () { return undefined; },
                };
                return [4 /*yield*/, (0, collab_1.compactChatBeforeProviderStep)(ctx, exec, ledger, {}, [
                        { role: "user", content: "first" },
                        { role: "assistant", content: "second" },
                    ], new AbortController().signal, stream)];
            case 1:
                _a.sent();
                return [4 /*yield*/, (0, collab_1.compactChatBeforeProviderStep)(ctx, exec, ledger, {}, [{ role: "user", content: "first" }], new AbortController().signal, stream)];
            case 2:
                _a.sent();
                (0, bun_test_1.expect)(ledger.snapshot().entries.map(function (entry) { return entry.content; })).toEqual([
                    "first",
                ]);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("namespaced compaction boundaries replay independently and honor rollback", function () {
    var events = [
        {
            type: "navi.chat.message.new",
            id: "navi-1",
            messageID: "navi-1",
            role: "user",
            text: "Navi original",
            at: "t1",
        },
        {
            type: "nia.chat.message.new",
            id: "nia-1",
            messageID: "nia-1",
            role: "user",
            text: "Nia original",
            at: "t2",
        },
        {
            type: "navi.chat.compacted",
            id: "navi-compact",
            messageID: "navi-summary",
            summary: "Navi summary",
            compactedThroughMessageID: "navi-1",
            at: "t3",
        },
        {
            type: "navi.chat.rollback",
            id: "navi-rollback",
            toMessageID: "navi-summary",
            removed: 0,
            at: "t4",
        },
    ];
    (0, bun_test_1.expect)((0, session_1.projectedNaviChatMessages)(events).map(function (message) { return message.text; })).toEqual(["[已压缩的聊天历史]\nNavi summary"]);
    (0, bun_test_1.expect)((0, session_1.projectedNiaChatMessages)(events).map(function (message) { return message.text; })).toEqual(["Nia original"]);
});
