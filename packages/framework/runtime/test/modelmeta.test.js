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
var src_1 = require("../src");
(0, bun_test_1.test)("resolver priority is explicit config before provider metadata", function () { return __awaiter(void 0, void 0, void 0, function () {
    var resolver, result;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                resolver = new src_1.ContextWindowResolver();
                return [4 /*yield*/, resolver.resolve({
                        provider: "openai",
                        model: "gpt-5.5",
                        explicitContextWindow: 123456,
                        providerAdapter: {
                            listModels: function () { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                                return [2 /*return*/, [{ id: "gpt-5.5", contextWindow: 1 }]];
                            }); }); },
                        },
                    })];
            case 1:
                result = _a.sent();
                (0, bun_test_1.expect)(result.tokens).toBe(123456);
                (0, bun_test_1.expect)(result.source).toBe("config");
                (0, bun_test_1.expect)(result.confidence).toBe("high");
                (0, bun_test_1.expect)(result.ttlMs).toBeGreaterThan(0);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("Models.dev resolves context and output limits when provider metadata is absent", function () { return __awaiter(void 0, void 0, void 0, function () {
    var fetchImpl, _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                fetchImpl = Object.assign(function () { return __awaiter(void 0, void 0, void 0, function () {
                    return __generator(this, function (_a) {
                        return [2 /*return*/, Response.json({
                                "stepfun-step-plan": {
                                    name: "StepFun Step Plan",
                                    models: {
                                        "step-3.7-flash": {
                                            limit: { context: 256000, input: 256000, output: 256000 },
                                        },
                                    },
                                },
                            })];
                    });
                }); }, { preconnect: fetch.preconnect });
                _a = bun_test_1.expect;
                return [4 /*yield*/, (0, src_1.modelsDevModelLimits)("step-plan", "step-3.7-flash", fetchImpl)];
            case 1:
                _a.apply(void 0, [_b.sent()]).toEqual({
                    contextWindow: 256000,
                    inputTokenLimit: 256000,
                    maxOutputTokens: 256000,
                });
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("resolver uses provider metadata, detail, catalog, fallback and isolated cache", function () { return __awaiter(void 0, void 0, void 0, function () {
    var resolver, now, metadata, detail, catalog, fallback;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                resolver = new src_1.ContextWindowResolver();
                now = new Date("2026-07-17T00:00:00Z");
                return [4 /*yield*/, resolver.resolve({
                        provider: "openai",
                        model: "model-a",
                        baseURL: "https://one.example/v1",
                        apiKey: "key-a",
                        now: now,
                        providerAdapter: {
                            listModels: function () { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                                return [2 /*return*/, [{ id: "model-a", contextWindow: 64000 }]];
                            }); }); },
                        },
                    })];
            case 1:
                metadata = _a.sent();
                (0, bun_test_1.expect)(metadata.source).toBe("provider_metadata");
                (0, bun_test_1.expect)(metadata.detectedAt).toBe(now.toISOString());
                return [4 /*yield*/, resolver.resolve({
                        provider: "anthropic",
                        model: "model-b",
                        providerAdapter: { modelDetail: function () { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                                return [2 /*return*/, ({ inputTokenLimit: 128000 })];
                            }); }); } },
                    })];
            case 2:
                detail = _a.sent();
                (0, bun_test_1.expect)(detail.source).toBe("provider_detail");
                return [4 /*yield*/, resolver.resolve({
                        provider: "openai",
                        model: "gpt-5.5",
                    })];
            case 3:
                catalog = _a.sent();
                (0, bun_test_1.expect)(catalog.source).toBe("known_catalog");
                return [4 /*yield*/, resolver.resolve({
                        provider: "unknown",
                        model: "unknown-model",
                    })];
            case 4:
                fallback = _a.sent();
                (0, bun_test_1.expect)(fallback.source).toBe("fallback");
                (0, bun_test_1.expect)(fallback.confidence).toBe("low");
                (0, bun_test_1.expect)(resolver.cacheKey({
                    provider: "openai",
                    model: "model-a",
                    baseURL: "https://one.example/v1",
                    apiKey: "key-a",
                })).not.toBe(resolver.cacheKey({
                    provider: "openai",
                    model: "model-a",
                    baseURL: "https://two.example/v1",
                    apiKey: "key-a",
                }));
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("resolver persists provider metadata results across instances", function () { return __awaiter(void 0, void 0, void 0, function () {
    var mkdtemp, tmpdir, join, dir, cacheFile, calls, input, first, firstResult, second, secondResult;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require("node:fs/promises"); })];
            case 1:
                mkdtemp = (_a.sent()).mkdtemp;
                return [4 /*yield*/, Promise.resolve().then(function () { return require("node:os"); })];
            case 2:
                tmpdir = (_a.sent()).tmpdir;
                return [4 /*yield*/, Promise.resolve().then(function () { return require("node:path"); })];
            case 3:
                join = (_a.sent()).join;
                return [4 /*yield*/, mkdtemp(join(tmpdir(), "natalia-context-window-cache-"))];
            case 4:
                dir = _a.sent();
                cacheFile = join(dir, "context-window-cache.json");
                calls = 0;
                input = {
                    provider: "openai",
                    model: "model-persist",
                    baseURL: "https://one.example/v1",
                    apiKey: "key-persist",
                    providerAdapter: {
                        listModels: function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                calls++;
                                return [2 /*return*/, [{ id: "model-persist", contextWindow: 77777 }]];
                            });
                        }); },
                    },
                };
                first = new src_1.ContextWindowResolver({ cacheFile: cacheFile });
                return [4 /*yield*/, first.resolve(input)];
            case 5:
                firstResult = _a.sent();
                (0, bun_test_1.expect)(firstResult.source).toBe("provider_metadata");
                (0, bun_test_1.expect)(firstResult.tokens).toBe(77777);
                (0, bun_test_1.expect)(calls).toBe(1);
                second = new src_1.ContextWindowResolver({ cacheFile: cacheFile });
                return [4 /*yield*/, second.resolve(input)];
            case 6:
                secondResult = _a.sent();
                (0, bun_test_1.expect)(secondResult.source).toBe("provider_metadata");
                (0, bun_test_1.expect)(secondResult.tokens).toBe(77777);
                (0, bun_test_1.expect)(calls).toBe(1);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("provider request omits generic max token fields unless explicit or required", function () {
    var omitted = (0, src_1.buildProviderRequest)({
        model: "x",
        messages: [],
        maxOutputTokens: null,
    });
    (0, bun_test_1.expect)(omitted.request).not.toHaveProperty("max_tokens");
    var zero = (0, src_1.buildProviderRequest)({
        model: "x",
        messages: [],
        maxOutputTokens: 0,
    });
    (0, bun_test_1.expect)(zero.request).not.toHaveProperty("max_tokens");
    var explicit = (0, src_1.buildProviderRequest)({
        model: "x",
        messages: [],
        maxOutputTokens: 42,
    });
    (0, bun_test_1.expect)(explicit.request.max_tokens).toBe(42);
    var anthropic = (0, src_1.buildProviderRequest)({
        model: "claude",
        messages: [],
        providerRequiresOutputLimit: true,
        providerDefaultOutputLimit: 4096,
    });
    (0, bun_test_1.expect)(anthropic.request.max_tokens).toBe(4096);
    (0, bun_test_1.expect)(anthropic.outputLimit.kind).toBe("provider-required");
});
