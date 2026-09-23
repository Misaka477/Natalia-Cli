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
exports.CONSERVATIVE_MODEL_LIMIT_FALLBACK = exports.ContextWindowResolver = void 0;
exports.knownModelContextWindow = knownModelContextWindow;
exports.knownModelOutputLimit = knownModelOutputLimit;
exports.modelsDevModelLimits = modelsDevModelLimits;
var promises_1 = require("node:fs/promises");
var node_path_1 = require("node:path");
function keyIdentity(apiKey) {
    if (!apiKey)
        return "no-key";
    return new Bun.CryptoHasher("sha256")
        .update(apiKey)
        .digest("hex")
        .slice(0, 12);
}
var ContextWindowResolver = /** @class */ (function () {
    function ContextWindowResolver(options) {
        if (options === void 0) { options = {}; }
        this.cache = new Map();
        this.diskCache = new Map();
        this.diskLoaded = false;
        this.diskWriteQueue = Promise.resolve();
        this.cacheFile = options.cacheFile;
        configureModelsDevCatalogCache(options.cacheFile
            ? (0, node_path_1.join)((0, node_path_1.dirname)(options.cacheFile), "models-dev-catalog.json")
            : undefined);
    }
    ContextWindowResolver.prototype.resolve = function (input) {
        return __awaiter(this, void 0, void 0, function () {
            var now, ttlMs, cacheKey, cached, diskCached, fromModels, detail, detailTokens, result, catalog, result, known, result, fallback;
            var _a, _b, _c, _d, _e;
            return __generator(this, function (_f) {
                switch (_f.label) {
                    case 0:
                        now = (_a = input.now) !== null && _a !== void 0 ? _a : new Date();
                        ttlMs = (_b = input.ttlMs) !== null && _b !== void 0 ? _b : 24 * 60 * 60 * 1000;
                        if (typeof input.explicitContextWindow === "number") {
                            return [2 /*return*/, resolution(input.explicitContextWindow, "config", "high", now, ttlMs, "explicit config context_window")];
                        }
                        cacheKey = this.cacheKey(input);
                        cached = this.cache.get(cacheKey);
                        if (cached && Date.parse(cached.expiresAt) > now.getTime())
                            return [2 /*return*/, cached];
                        if (!(this.cacheFile && !this.diskLoaded)) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.loadDiskCache()];
                    case 1:
                        _f.sent();
                        _f.label = 2;
                    case 2:
                        diskCached = this.diskCache.get(cacheKey);
                        if (diskCached && Date.parse(diskCached.expiresAt) > now.getTime()) {
                            this.cache.set(cacheKey, diskCached);
                            return [2 /*return*/, diskCached];
                        }
                        return [4 /*yield*/, this.fromProviderMetadata(input, now, ttlMs)];
                    case 3:
                        fromModels = _f.sent();
                        if (!fromModels) return [3 /*break*/, 5];
                        this.cache.set(cacheKey, fromModels);
                        return [4 /*yield*/, this.persist(cacheKey, fromModels)];
                    case 4:
                        _f.sent();
                        return [2 /*return*/, fromModels];
                    case 5: return [4 /*yield*/, ((_d = (_c = input.providerAdapter) === null || _c === void 0 ? void 0 : _c.modelDetail) === null || _d === void 0 ? void 0 : _d.call(_c, input.model).catch(function () { return undefined; }))];
                    case 6:
                        detail = _f.sent();
                        detailTokens = (_e = detail === null || detail === void 0 ? void 0 : detail.contextWindow) !== null && _e !== void 0 ? _e : detail === null || detail === void 0 ? void 0 : detail.inputTokenLimit;
                        if (!(detailTokens && detailTokens > 0)) return [3 /*break*/, 8];
                        result = resolution(detailTokens, "provider_detail", "high", now, ttlMs, "provider model detail context window", detail === null || detail === void 0 ? void 0 : detail.maxOutputTokens);
                        this.cache.set(cacheKey, result);
                        return [4 /*yield*/, this.persist(cacheKey, result)];
                    case 7:
                        _f.sent();
                        return [2 /*return*/, result];
                    case 8:
                        if (!input.useModelsDevCatalog) return [3 /*break*/, 11];
                        return [4 /*yield*/, modelsDevModelLimits(input.provider, input.model)];
                    case 9:
                        catalog = _f.sent();
                        if (!(catalog === null || catalog === void 0 ? void 0 : catalog.contextWindow)) return [3 /*break*/, 11];
                        result = resolution(catalog.contextWindow, "models_dev", "medium", now, ttlMs, "Models.dev model catalog context window", catalog.maxOutputTokens);
                        this.cache.set(cacheKey, result);
                        return [4 /*yield*/, this.persist(cacheKey, result)];
                    case 10:
                        _f.sent();
                        return [2 /*return*/, result];
                    case 11:
                        known = knownModelContextWindow(input.model);
                        if (known) {
                            result = resolution(known, "known_catalog", "medium", now, ttlMs, "known-model catalog fallback");
                            this.cache.set(cacheKey, result);
                            return [2 /*return*/, result];
                        }
                        fallback = resolution(32000, "fallback", "low", now, ttlMs, "conservative fallback; provider metadata unavailable");
                        this.cache.set(cacheKey, fallback);
                        return [2 /*return*/, fallback];
                }
            });
        });
    };
    ContextWindowResolver.prototype.loadDiskCache = function () {
        return __awaiter(this, void 0, void 0, function () {
            var raw, parsed, _i, _a, _b, key, value, _c;
            var _d;
            return __generator(this, function (_e) {
                switch (_e.label) {
                    case 0:
                        this.diskLoaded = true;
                        if (!this.cacheFile)
                            return [2 /*return*/];
                        _e.label = 1;
                    case 1:
                        _e.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, (0, promises_1.readFile)(this.cacheFile, "utf8")];
                    case 2:
                        raw = _e.sent();
                        parsed = JSON.parse(raw);
                        for (_i = 0, _a = Object.entries((_d = parsed.entries) !== null && _d !== void 0 ? _d : {}); _i < _a.length; _i++) {
                            _b = _a[_i], key = _b[0], value = _b[1];
                            this.diskCache.set(key, value);
                        }
                        return [3 /*break*/, 4];
                    case 3:
                        _c = _e.sent();
                        return [3 /*break*/, 4];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    ContextWindowResolver.prototype.persist = function (cacheKey, value) {
        return __awaiter(this, void 0, void 0, function () {
            var snapshot;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!this.cacheFile)
                            return [2 /*return*/];
                        this.diskCache.set(cacheKey, value);
                        snapshot = Object.fromEntries(this.diskCache.entries());
                        this.diskWriteQueue = this.diskWriteQueue
                            .then(function () { return __awaiter(_this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, (0, promises_1.mkdir)((0, node_path_1.dirname)(this.cacheFile), { recursive: true, mode: 448 })];
                                    case 1:
                                        _a.sent();
                                        return [4 /*yield*/, (0, promises_1.writeFile)(this.cacheFile, "".concat(JSON.stringify({ version: 1, entries: snapshot }, null, 2), "\n"), { mode: 384 })];
                                    case 2:
                                        _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        }); })
                            .catch(function () {
                            // Never let cache write failures break model resolution.
                        });
                        return [4 /*yield*/, this.diskWriteQueue];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    ContextWindowResolver.prototype.cacheKey = function (input) {
        var _a;
        return [
            input.provider,
            (_a = input.baseURL) !== null && _a !== void 0 ? _a : "default",
            input.model,
            keyIdentity(input.apiKey),
            input.useModelsDevCatalog ? "models-dev" : "local-only",
        ].join("|");
    };
    ContextWindowResolver.prototype.fromProviderMetadata = function (input, now, ttlMs) {
        return __awaiter(this, void 0, void 0, function () {
            var models, item, tokens;
            var _a, _b, _c;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0: return [4 /*yield*/, ((_b = (_a = input.providerAdapter) === null || _a === void 0 ? void 0 : _a.listModels) === null || _b === void 0 ? void 0 : _b.call(_a).catch(function () { return undefined; }))];
                    case 1:
                        models = _d.sent();
                        item = models === null || models === void 0 ? void 0 : models.find(function (candidate) { return candidate.id === input.model; });
                        tokens = (_c = item === null || item === void 0 ? void 0 : item.contextWindow) !== null && _c !== void 0 ? _c : item === null || item === void 0 ? void 0 : item.inputTokenLimit;
                        if (!tokens || tokens <= 0)
                            return [2 /*return*/, undefined];
                        return [2 /*return*/, resolution(tokens, "provider_metadata", "high", now, ttlMs, "provider /models metadata context window", item === null || item === void 0 ? void 0 : item.maxOutputTokens)];
                }
            });
        });
    };
    return ContextWindowResolver;
}());
exports.ContextWindowResolver = ContextWindowResolver;
function knownModelContextWindow(model) {
    var normalized = model.toLowerCase();
    if (normalized.includes("gpt-5.5"))
        return 200000;
    if (normalized.includes("gpt-5"))
        return 400000;
    if (normalized.includes("gpt-4.1"))
        return 1000000;
    if (normalized.includes("gpt-4o"))
        return 128000;
    if (normalized.includes("o1") || normalized.includes("o3"))
        return 200000;
    if (normalized.includes("claude"))
        return 200000;
    if (normalized.includes("gemini") && normalized.includes("2.5"))
        return 1048576;
    if (normalized.includes("gemini") && normalized.includes("1.5"))
        return 1000000;
    return undefined;
}
function knownModelOutputLimit(model) {
    var normalized = model.toLowerCase();
    if (normalized.includes("gpt-5"))
        return 128000;
    if (normalized.includes("gpt-4.1"))
        return 32768;
    if (normalized.includes("gpt-4o"))
        return 16384;
    if (normalized.includes("claude"))
        return 64000;
    if (normalized.includes("gemini") && normalized.includes("2.5"))
        return 65536;
    return undefined;
}
exports.CONSERVATIVE_MODEL_LIMIT_FALLBACK = 32000;
var modelsDevCache;
var modelsDevPending;
var modelsDevCacheFile;
function configureModelsDevCatalogCache(cacheFile) {
    modelsDevCacheFile = cacheFile;
}
function modelsDevModelLimits(provider_1, model_1) {
    return __awaiter(this, arguments, void 0, function (provider, model, fetchImpl) {
        var catalog, candidates, selected;
        if (fetchImpl === void 0) { fetchImpl = fetch; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, loadModelsDevCatalog(fetchImpl).catch(function () { return undefined; })];
                case 1:
                    catalog = _a.sent();
                    if (!catalog)
                        return [2 /*return*/, undefined];
                    candidates = Object.entries(catalog).flatMap(function (_a) {
                        var _b, _c;
                        var providerID = _a[0], item = _a[1];
                        var entry = (_b = item.models) === null || _b === void 0 ? void 0 : _b[model];
                        if (!(entry === null || entry === void 0 ? void 0 : entry.limit))
                            return [];
                        var providerText = "".concat(providerID, " ").concat((_c = item.name) !== null && _c !== void 0 ? _c : "").toLowerCase();
                        var providerWords = provider
                            .toLowerCase()
                            .split(/[^a-z0-9]+/u)
                            .filter(function (word) { return word.length > 2 && word !== "compatible"; });
                        return [
                            {
                                providerID: providerID,
                                score: providerWords.filter(function (word) { return providerText.includes(word); })
                                    .length,
                                limit: entry.limit,
                            },
                        ];
                    });
                    if (!candidates.length)
                        return [2 /*return*/, undefined];
                    candidates.sort(function (left, right) {
                        return right.score - left.score ||
                            left.providerID.localeCompare(right.providerID);
                    });
                    selected = candidates[0].limit;
                    return [2 /*return*/, {
                            contextWindow: positiveNumber(selected.context),
                            inputTokenLimit: positiveNumber(selected.input),
                            maxOutputTokens: positiveNumber(selected.output),
                        }];
            }
        });
    });
}
function loadModelsDevCatalog(fetchImpl) {
    return __awaiter(this, void 0, void 0, function () {
        var response, now, raw, parsed, _a;
        var _this = this;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    if (!(fetchImpl !== fetch)) return [3 /*break*/, 3];
                    return [4 /*yield*/, fetchImpl("https://models.dev/api.json", {
                            signal: AbortSignal.timeout(3000),
                        })];
                case 1:
                    response = _b.sent();
                    if (!response.ok)
                        throw new Error("Models.dev catalog request failed (".concat(response.status, ")"));
                    return [4 /*yield*/, response.json()];
                case 2: return [2 /*return*/, (_b.sent())];
                case 3:
                    now = Date.now();
                    if (modelsDevCache && modelsDevCache.expiresAt > now)
                        return [2 /*return*/, modelsDevCache.value];
                    if (!modelsDevCacheFile) return [3 /*break*/, 7];
                    _b.label = 4;
                case 4:
                    _b.trys.push([4, 6, , 7]);
                    return [4 /*yield*/, (0, promises_1.readFile)(modelsDevCacheFile, "utf8")];
                case 5:
                    raw = _b.sent();
                    parsed = JSON.parse(raw);
                    if (parsed.expiresAt > now) {
                        modelsDevCache = parsed;
                        return [2 /*return*/, parsed.value];
                    }
                    return [3 /*break*/, 7];
                case 6:
                    _a = _b.sent();
                    return [3 /*break*/, 7];
                case 7:
                    if (!modelsDevPending) {
                        modelsDevPending = fetchImpl("https://models.dev/api.json", {
                            signal: AbortSignal.timeout(3000),
                        })
                            .then(function (response) { return __awaiter(_this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        if (!response.ok)
                                            throw new Error("Models.dev catalog request failed (".concat(response.status, ")"));
                                        return [4 /*yield*/, response.json()];
                                    case 1: return [2 /*return*/, (_a.sent())];
                                }
                            });
                        }); })
                            .then(function (value) { return __awaiter(_this, void 0, void 0, function () {
                            var next, _a;
                            return __generator(this, function (_b) {
                                switch (_b.label) {
                                    case 0:
                                        next = {
                                            expiresAt: Date.now() + 24 * 60 * 60 * 1000,
                                            value: value,
                                        };
                                        modelsDevCache = next;
                                        if (!modelsDevCacheFile) return [3 /*break*/, 5];
                                        _b.label = 1;
                                    case 1:
                                        _b.trys.push([1, 4, , 5]);
                                        return [4 /*yield*/, (0, promises_1.mkdir)((0, node_path_1.dirname)(modelsDevCacheFile), {
                                                recursive: true,
                                                mode: 448,
                                            })];
                                    case 2:
                                        _b.sent();
                                        return [4 /*yield*/, (0, promises_1.writeFile)(modelsDevCacheFile, "".concat(JSON.stringify(next, null, 2), "\n"), { mode: 384 })];
                                    case 3:
                                        _b.sent();
                                        return [3 /*break*/, 5];
                                    case 4:
                                        _a = _b.sent();
                                        return [3 /*break*/, 5];
                                    case 5: return [2 /*return*/, value];
                                }
                            });
                        }); })
                            .catch(function () {
                            var value = {};
                            modelsDevCache = { expiresAt: Date.now() + 5 * 60 * 1000, value: value };
                            return value;
                        })
                            .finally(function () {
                            modelsDevPending = undefined;
                        });
                    }
                    return [4 /*yield*/, modelsDevPending];
                case 8: return [2 /*return*/, _b.sent()];
            }
        });
    });
}
function positiveNumber(value) {
    return typeof value === "number" && value > 0 ? value : undefined;
}
function resolution(tokens, source, confidence, now, ttlMs, diagnostic, maxOutputTokens) {
    return __assign({ tokens: tokens, source: source, confidence: confidence, detectedAt: now.toISOString(), expiresAt: new Date(now.getTime() + ttlMs).toISOString(), ttlMs: ttlMs, diagnostic: diagnostic }, (maxOutputTokens !== undefined ? { maxOutputTokens: maxOutputTokens } : {}));
}
