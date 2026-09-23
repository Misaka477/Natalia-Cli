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
exports.buildModelCatalog = buildModelCatalog;
exports.discoverProviderModels = discoverProviderModels;
exports.configureProviderModels = configureProviderModels;
exports.resolveEffectiveModel = resolveEffectiveModel;
var contracts_1 = require("@natalia/contracts");
var policy_1 = require("./policy");
var DEFAULT_CAPABILITIES = {
    toolCall: true,
    reasoning: true,
    thinking: true,
    imageInput: false,
    videoInput: false,
};
function buildModelCatalog(config) {
    var _a;
    return Object.entries((_a = config.providers) !== null && _a !== void 0 ? _a : {})
        .filter(function (_a) {
        var id = _a[0], provider = _a[1];
        return provider.enabled &&
            (0, policy_1.evaluatePolicy)(config.experimental.policies, "provider.use", id, "allow") === "allow";
    })
        .map(function (_a) {
        var _b;
        var id = _a[0], provider = _a[1];
        return ({
            id: id,
            name: provider.name,
            driver: provider.driver,
            configured: Boolean((_b = provider.connection) === null || _b === void 0 ? void 0 : _b.apiKey),
            models: catalogModelsForProvider(config, id),
        });
    });
}
function catalogModelsForProvider(config, providerID) {
    var _a, _b, _c, _d, _e;
    var catalogModels = (_d = (_c = (_b = (_a = config.catalog) === null || _a === void 0 ? void 0 : _a.providers) === null || _b === void 0 ? void 0 : _b[providerID]) === null || _c === void 0 ? void 0 : _c.models) !== null && _d !== void 0 ? _d : {};
    var overrideKeys = Object.keys((_e = config.modelOverrides) !== null && _e !== void 0 ? _e : {}).filter(function (key) {
        return key.startsWith("".concat(providerID, "/"));
    });
    var modelIDs = new Set(__spreadArray(__spreadArray([], Object.keys(catalogModels), true), overrideKeys.map(function (key) { return key.slice(providerID.length + 1); }), true));
    return __spreadArray([], modelIDs, true).filter(function (modelID) {
        var _a;
        return ((_a = config.modelOverrides[(0, contracts_1.modelRefKey)({ provider: providerID, model: modelID })]) === null || _a === void 0 ? void 0 : _a.enabled) !== false;
    })
        .filter(function (modelID) {
        return (0, policy_1.evaluateModelPolicy)(config.experimental.policies, providerID, modelID) === "allow";
    })
        .map(function (modelID) {
        var _a, _b, _c, _d, _e, _f, _g;
        var catalogModel = catalogModels[modelID];
        var override = config.modelOverrides[(0, contracts_1.modelRefKey)({ provider: providerID, model: modelID })];
        return {
            id: modelID,
            provider: providerID,
            name: (_b = (_a = override === null || override === void 0 ? void 0 : override.name) !== null && _a !== void 0 ? _a : catalogModel === null || catalogModel === void 0 ? void 0 : catalogModel.name) !== null && _b !== void 0 ? _b : modelID,
            capabilities: (_c = catalogModel === null || catalogModel === void 0 ? void 0 : catalogModel.capabilities) !== null && _c !== void 0 ? _c : DEFAULT_CAPABILITIES,
            limits: (_e = (_d = override === null || override === void 0 ? void 0 : override.limits) !== null && _d !== void 0 ? _d : catalogModel === null || catalogModel === void 0 ? void 0 : catalogModel.limits) !== null && _e !== void 0 ? _e : { contextWindow: "auto" },
            status: (_f = catalogModel === null || catalogModel === void 0 ? void 0 : catalogModel.status) !== null && _f !== void 0 ? _f : "stable",
            source: (_g = catalogModel === null || catalogModel === void 0 ? void 0 : catalogModel.source) !== null && _g !== void 0 ? _g : "manual",
        };
    })
        .sort(function (left, right) { return left.id.localeCompare(right.id); });
}
function discoverProviderModels(driver, baseURL, apiKey, customHeaders) {
    return __awaiter(this, void 0, void 0, function () {
        var base, supported, parsed, headers, hasCustomAuth, anthropic, gemini, endpointPath, url, hasHeader, controller, timeout, response, payload, _a, record, list, values, error_1;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    base = baseURL.trim();
                    if (!base)
                        throw new Error("Provider base URL is required for model discovery");
                    supported = [
                        "openai",
                        "openai-compatible",
                        "anthropic",
                        "anthropic-compatible",
                        "gemini",
                    ];
                    if (!supported.includes(driver))
                        throw new Error("Unsupported provider driver for model discovery: ".concat(driver));
                    try {
                        parsed = new URL(base);
                    }
                    catch (_c) {
                        throw new Error("Provider base URL is invalid for model discovery");
                    }
                    if (parsed.protocol !== "http:" && parsed.protocol !== "https:")
                        throw new Error("Provider base URL must use http or https");
                    headers = new Headers(customHeaders);
                    hasCustomAuth = [
                        "authorization",
                        "x-api-key",
                        "api-key",
                        "x-goog-api-key",
                    ].some(function (name) { return headers.has(name); });
                    if (!apiKey.trim() && !hasCustomAuth)
                        throw new Error("Provider API key is required for model discovery");
                    anthropic = driver === "anthropic" || driver === "anthropic-compatible";
                    gemini = driver === "gemini";
                    endpointPath = parsed.pathname.replace(/\/+$/u, "");
                    parsed.pathname = "".concat(gemini || endpointPath ? endpointPath : "/v1", "/models");
                    url = parsed.toString();
                    hasHeader = function (name) { return headers.has(name); };
                    if (anthropic) {
                        if (apiKey && !hasHeader("x-api-key"))
                            headers.set("x-api-key", apiKey);
                        if (!hasHeader("anthropic-version"))
                            headers.set("anthropic-version", "2023-06-01");
                    }
                    else if (gemini) {
                        if (apiKey && !hasHeader("x-goog-api-key"))
                            headers.set("x-goog-api-key", apiKey);
                    }
                    else if (apiKey && !hasHeader("authorization")) {
                        headers.set("authorization", "Bearer ".concat(apiKey));
                    }
                    controller = new AbortController();
                    timeout = setTimeout(function () { return controller.abort(); }, 30000);
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 7, 8, 9]);
                    return [4 /*yield*/, fetch(url, {
                            headers: headers,
                            redirect: "error",
                            signal: controller.signal,
                        })];
                case 2:
                    response = _b.sent();
                    if (!response.ok)
                        throw new Error("Model discovery failed (".concat(response.status, ")"));
                    payload = void 0;
                    _b.label = 3;
                case 3:
                    _b.trys.push([3, 5, , 6]);
                    return [4 /*yield*/, response.json()];
                case 4:
                    payload = _b.sent();
                    return [3 /*break*/, 6];
                case 5:
                    _a = _b.sent();
                    throw new Error("Model discovery returned an invalid response");
                case 6:
                    if (!payload || typeof payload !== "object" || Array.isArray(payload))
                        throw new Error("Model discovery returned an invalid response");
                    record = payload;
                    list = gemini
                        ? record.models
                        : Array.isArray(record.data)
                            ? record.data
                            : record.models;
                    if (!Array.isArray(list))
                        throw new Error("Model discovery returned an invalid response");
                    values = list.map(function (model) {
                        var _a, _b;
                        if (!model || typeof model !== "object" || Array.isArray(model))
                            throw new Error("Model discovery returned an invalid response");
                        var item = model;
                        var value = gemini ? ((_a = item.name) !== null && _a !== void 0 ? _a : item.id) : ((_b = item.id) !== null && _b !== void 0 ? _b : item.name);
                        if (typeof value !== "string")
                            throw new Error("Model discovery returned an invalid response");
                        return value.trim().replace(/^models\//u, "");
                    });
                    return [2 /*return*/, __spreadArray([], new Set(values.filter(function (value) { return value.length > 0; })), true).sort(function (left, right) { return left.localeCompare(right); })];
                case 7:
                    error_1 = _b.sent();
                    if (controller.signal.aborted)
                        throw new Error("Model discovery timed out");
                    if (error_1 instanceof Error && error_1.message.startsWith("Model discovery"))
                        throw error_1;
                    throw new Error("Model discovery request failed");
                case 8:
                    clearTimeout(timeout);
                    return [7 /*endfinally*/];
                case 9: return [2 /*return*/];
            }
        });
    });
}
/**
 * Configures a provider and imports one or more models into the catalog.
 *
 * Discovery or manual import both land in `catalog.providers[providerID].models`;
 * model overrides are never touched, so existing user intent (enabled, name,
 * request tuning) survives re-import. A missing default model is set to the
 * first imported model; an existing default is preserved.
 */
function configureProviderModels(config, input) {
    var _a, _b;
    var _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0, _1, _2, _3, _4;
    var providerID = input.providerID.trim();
    if (!providerID)
        throw new Error("Provider ID is required");
    if (!input.driver.trim())
        throw new Error("Provider driver is required");
    if (input.source === "discovery" && !((_c = input.apiKey) === null || _c === void 0 ? void 0 : _c.trim()))
        throw new Error("Provider API key is required for discovery");
    var baseURL = (_d = input.baseURL) === null || _d === void 0 ? void 0 : _d.trim().replace(/\/+$/u, "");
    var modelIDs = __spreadArray([], new Set(input.modelIDs.map(function (id) { return id.trim(); }).filter(Boolean)), true);
    if (!modelIDs.length)
        throw new Error("At least one model ID is required");
    var existing = config.providers[providerID];
    var existingModels = (_h = (_g = (_f = (_e = config.catalog) === null || _e === void 0 ? void 0 : _e.providers) === null || _f === void 0 ? void 0 : _f[providerID]) === null || _g === void 0 ? void 0 : _g.models) !== null && _h !== void 0 ? _h : {};
    return contracts_1.configV3Schema.parse(__assign(__assign({}, config), { providers: __assign(__assign({}, config.providers), (_a = {}, _a[providerID] = {
            name: ((_j = input.providerName) === null || _j === void 0 ? void 0 : _j.trim()) || (existing === null || existing === void 0 ? void 0 : existing.name) || providerID,
            driver: input.driver,
            enabled: (_k = existing === null || existing === void 0 ? void 0 : existing.enabled) !== null && _k !== void 0 ? _k : true,
            connection: {
                baseURL: baseURL || ((_l = existing === null || existing === void 0 ? void 0 : existing.connection) === null || _l === void 0 ? void 0 : _l.baseURL),
                apiKey: ((_m = input.apiKey) === null || _m === void 0 ? void 0 : _m.trim()) || ((_o = existing === null || existing === void 0 ? void 0 : existing.connection) === null || _o === void 0 ? void 0 : _o.apiKey),
                authHeader: ((_p = input.authHeader) === null || _p === void 0 ? void 0 : _p.trim()) || ((_q = existing === null || existing === void 0 ? void 0 : existing.connection) === null || _q === void 0 ? void 0 : _q.authHeader),
            },
            requestDefaults: {
                stream: (_u = (_s = (_r = input.requestDefaults) === null || _r === void 0 ? void 0 : _r.stream) !== null && _s !== void 0 ? _s : (_t = existing === null || existing === void 0 ? void 0 : existing.requestDefaults) === null || _t === void 0 ? void 0 : _t.stream) !== null && _u !== void 0 ? _u : true,
                headers: __assign(__assign({}, ((_w = (_v = existing === null || existing === void 0 ? void 0 : existing.requestDefaults) === null || _v === void 0 ? void 0 : _v.headers) !== null && _w !== void 0 ? _w : {})), ((_y = (_x = input.requestDefaults) === null || _x === void 0 ? void 0 : _x.headers) !== null && _y !== void 0 ? _y : {})),
                options: __assign(__assign({}, ((_0 = (_z = existing === null || existing === void 0 ? void 0 : existing.requestDefaults) === null || _z === void 0 ? void 0 : _z.options) !== null && _0 !== void 0 ? _0 : {})), ((_2 = (_1 = input.requestDefaults) === null || _1 === void 0 ? void 0 : _1.options) !== null && _2 !== void 0 ? _2 : {})),
            },
        }, _a)), catalog: __assign(__assign({}, config.catalog), { providers: __assign(__assign({}, (_3 = config.catalog) === null || _3 === void 0 ? void 0 : _3.providers), (_b = {}, _b[providerID] = {
                models: __assign(__assign({}, existingModels), Object.fromEntries(modelIDs
                    .filter(function (modelID) { return !(modelID in existingModels); })
                    .map(function (modelID) { return [
                    modelID,
                    {
                        name: modelID,
                        capabilities: __assign({}, DEFAULT_CAPABILITIES),
                        limits: { contextWindow: "auto" },
                        status: "stable",
                        source: input.source,
                    },
                ]; }))),
            }, _b)) }), defaultModel: (_4 = config.defaultModel) !== null && _4 !== void 0 ? _4 : {
            provider: providerID,
            model: modelIDs[0],
        } }));
}
/**
 * Resolves the effective model: catalog facts merged under user overrides and
 * the provider's connection-level request defaults. Returns undefined when the
 * provider is unknown.
 */
function resolveEffectiveModel(config, ref) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q;
    var modelRef = typeof ref === "string" ? (0, contracts_1.parseModelRef)(ref) : ref;
    var provider = config.providers[modelRef.provider];
    if (!provider)
        return undefined;
    var key = (0, contracts_1.modelRefKey)(modelRef);
    var catalogModel = (_d = (_c = (_b = (_a = config.catalog) === null || _a === void 0 ? void 0 : _a.providers) === null || _b === void 0 ? void 0 : _b[modelRef.provider]) === null || _c === void 0 ? void 0 : _c.models) === null || _d === void 0 ? void 0 : _d[modelRef.model];
    var override = config.modelOverrides[key];
    if (!catalogModel && !override)
        return undefined;
    return {
        ref: modelRef,
        key: key,
        providerID: modelRef.provider,
        providerName: provider.name,
        driver: provider.driver,
        name: (_f = (_e = override === null || override === void 0 ? void 0 : override.name) !== null && _e !== void 0 ? _e : catalogModel === null || catalogModel === void 0 ? void 0 : catalogModel.name) !== null && _f !== void 0 ? _f : modelRef.model,
        enabled: (override === null || override === void 0 ? void 0 : override.enabled) !== undefined
            ? override.enabled
            : catalogModel !== undefined,
        capabilities: (_g = catalogModel === null || catalogModel === void 0 ? void 0 : catalogModel.capabilities) !== null && _g !== void 0 ? _g : DEFAULT_CAPABILITIES,
        limits: (_j = (_h = override === null || override === void 0 ? void 0 : override.limits) !== null && _h !== void 0 ? _h : catalogModel === null || catalogModel === void 0 ? void 0 : catalogModel.limits) !== null && _j !== void 0 ? _j : { contextWindow: "auto" },
        status: (_k = catalogModel === null || catalogModel === void 0 ? void 0 : catalogModel.status) !== null && _k !== void 0 ? _k : "stable",
        source: (_l = catalogModel === null || catalogModel === void 0 ? void 0 : catalogModel.source) !== null && _l !== void 0 ? _l : "manual",
        override: override,
        requestDefaults: {
            temperature: (_m = override === null || override === void 0 ? void 0 : override.requestDefaults.temperature) !== null && _m !== void 0 ? _m : null,
            topP: (_o = override === null || override === void 0 ? void 0 : override.requestDefaults.topP) !== null && _o !== void 0 ? _o : null,
            stream: (_p = override === null || override === void 0 ? void 0 : override.requestDefaults.stream) !== null && _p !== void 0 ? _p : provider.requestDefaults.stream,
            thinkingEnabled: (_q = override === null || override === void 0 ? void 0 : override.requestDefaults.thinkingEnabled) !== null && _q !== void 0 ? _q : true,
            headers: __assign(__assign({}, provider.requestDefaults.headers), override === null || override === void 0 ? void 0 : override.headers),
            options: __assign(__assign({}, provider.requestDefaults.options), override === null || override === void 0 ? void 0 : override.requestOptions),
        },
    };
}
