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
var promises_1 = require("node:fs/promises");
var node_os_1 = require("node:os");
var node_path_1 = require("node:path");
var contracts_1 = require("@natalia/contracts");
var catalog_1 = require("../src/catalog");
var service_1 = require("../src/service");
(0, bun_test_1.test)("discovers models from configured provider URL and imports them in batch", function () { return __awaiter(void 0, void 0, void 0, function () {
    var requests, server, workspaceRoot, globalPath, models, configured, persisted, _a, _b;
    var _c;
    return __generator(this, function (_d) {
        switch (_d.label) {
            case 0:
                requests = [];
                server = Bun.serve({
                    port: 0,
                    fetch: function (request) {
                        requests.push({
                            path: new URL(request.url).pathname,
                            authorization: request.headers.get("authorization"),
                        });
                        return Response.json({
                            data: [{ id: "model-b" }, { id: "model-a" }, { id: "model-a" }],
                        });
                    },
                });
                return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-provider-config-"))];
            case 1:
                workspaceRoot = _d.sent();
                globalPath = (0, node_path_1.join)(workspaceRoot, "global.json");
                _d.label = 2;
            case 2:
                _d.trys.push([2, , 6, 8]);
                return [4 /*yield*/, (0, catalog_1.discoverProviderModels)("openai-compatible", server.url.toString(), "secret-key")];
            case 3:
                models = _d.sent();
                (0, bun_test_1.expect)(models).toEqual(["model-a", "model-b"]);
                (0, bun_test_1.expect)(requests).toEqual([
                    { path: "/v1/models", authorization: "Bearer secret-key" },
                ]);
                configured = (0, catalog_1.configureProviderModels)(contracts_1.configV3Schema.parse({ version: 3 }), {
                    providerID: "private-provider",
                    providerName: "Private Gateway",
                    driver: "openai-compatible",
                    apiKey: "secret-key",
                    baseURL: server.url.toString(),
                    source: "discovery",
                    modelIDs: models,
                });
                return [4 /*yield*/, (0, service_1.updateConfig)(workspaceRoot, configured, { globalPath: globalPath })];
            case 4:
                _d.sent();
                _b = (_a = JSON).parse;
                return [4 /*yield*/, (0, promises_1.readFile)(globalPath, "utf8")];
            case 5:
                persisted = _b.apply(_a, [_d.sent()]);
                (0, bun_test_1.expect)(persisted.defaultModel).toEqual({
                    provider: "private-provider",
                    model: "model-a",
                });
                (0, bun_test_1.expect)(persisted.providers["private-provider"]).toMatchObject({
                    name: "Private Gateway",
                    driver: "openai-compatible",
                    connection: {
                        baseURL: server.url.toString().replace(/\/+$/u, ""),
                        apiKey: "secret-key",
                    },
                });
                (0, bun_test_1.expect)((_c = persisted.catalog.providers["private-provider"]) === null || _c === void 0 ? void 0 : _c.models).toMatchObject({
                    "model-a": { source: "discovery" },
                    "model-b": { source: "discovery" },
                });
                return [3 /*break*/, 8];
            case 6:
                server.stop(true);
                return [4 /*yield*/, (0, promises_1.rm)(workspaceRoot, { recursive: true, force: true })];
            case 7:
                _d.sent();
                return [7 /*endfinally*/];
            case 8: return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("discovers native and compatible providers with custom auth and normalized endpoints", function () { return __awaiter(void 0, void 0, void 0, function () {
    var requests, server, _a, _b;
    var _c, _d, _e, _f;
    return __generator(this, function (_g) {
        switch (_g.label) {
            case 0:
                requests = [];
                server = Bun.serve({
                    port: 0,
                    fetch: function (request) {
                        requests.push({
                            path: new URL(request.url).pathname,
                            headers: request.headers,
                        });
                        if (new URL(request.url).pathname === "/models")
                            return Response.json({
                                models: [{ name: "models/gemini-2" }, { name: "gemini-1" }],
                            });
                        return Response.json({ data: [{ id: "claude-3" }, { id: "claude-3" }] });
                    },
                });
                _g.label = 1;
            case 1:
                _g.trys.push([1, , 4, 5]);
                _a = bun_test_1.expect;
                return [4 /*yield*/, (0, catalog_1.discoverProviderModels)("anthropic-compatible", "".concat(server.url, "/v1"), "key", {
                        "X-Api-Key": "custom-key",
                    })];
            case 2:
                _a.apply(void 0, [_g.sent()]).toEqual(["claude-3"]);
                _b = bun_test_1.expect;
                return [4 /*yield*/, (0, catalog_1.discoverProviderModels)("gemini", server.url.toString(), "", {
                        "x-goog-api-key": "custom-key",
                    })];
            case 3:
                _b.apply(void 0, [_g.sent()]).toEqual(["gemini-1", "gemini-2"]);
                (0, bun_test_1.expect)((_c = requests[0]) === null || _c === void 0 ? void 0 : _c.path).toBe("/v1/models");
                (0, bun_test_1.expect)((_d = requests[0]) === null || _d === void 0 ? void 0 : _d.headers.get("x-api-key")).toBe("custom-key");
                (0, bun_test_1.expect)((_e = requests[0]) === null || _e === void 0 ? void 0 : _e.headers.get("anthropic-version")).toBe("2023-06-01");
                (0, bun_test_1.expect)((_f = requests[1]) === null || _f === void 0 ? void 0 : _f.path).toBe("/models");
                return [3 /*break*/, 5];
            case 4:
                server.stop(true);
                return [7 /*endfinally*/];
            case 5: return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("discovery preserves URL queries, rejects redirects and invalid model lists", function () { return __awaiter(void 0, void 0, void 0, function () {
    var server, _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                server = Bun.serve({
                    port: 0,
                    fetch: function (request) {
                        var path = new URL(request.url).pathname;
                        if (path === "/redirect/models")
                            return Response.redirect(new URL("/models", request.url), 302);
                        if (path === "/invalid/models")
                            return Response.json({ data: {} });
                        return Response.json({ data: [{ id: " model " }] });
                    },
                });
                _b.label = 1;
            case 1:
                _b.trys.push([1, , 5, 6]);
                _a = bun_test_1.expect;
                return [4 /*yield*/, (0, catalog_1.discoverProviderModels)("openai-compatible", "".concat(server.url, "?tenant=one"), "key")];
            case 2:
                _a.apply(void 0, [_b.sent()]).toEqual(["model"]);
                return [4 /*yield*/, (0, bun_test_1.expect)((0, catalog_1.discoverProviderModels)("openai-compatible", "".concat(server.url, "/invalid"), "key")).rejects.toThrow("invalid response")];
            case 3:
                _b.sent();
                return [4 /*yield*/, (0, bun_test_1.expect)((0, catalog_1.discoverProviderModels)("openai-compatible", "".concat(server.url, "/redirect"), "key")).rejects.toThrow("request failed")];
            case 4:
                _b.sent();
                return [3 /*break*/, 6];
            case 5:
                server.stop(true);
                return [7 /*endfinally*/];
            case 6: return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("discovery rejects unknown drivers and does not expose upstream response bodies or keys", function () { return __awaiter(void 0, void 0, void 0, function () {
    var secret, server;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                secret = "secret-discovery-key";
                server = Bun.serve({
                    port: 0,
                    fetch: function () {
                        return new Response("upstream leaked ".concat(secret), { status: 401 });
                    },
                });
                _a.label = 1;
            case 1:
                _a.trys.push([1, , 5, 6]);
                return [4 /*yield*/, (0, bun_test_1.expect)((0, catalog_1.discoverProviderModels)("unknown", server.url.toString(), "key")).rejects.toThrow("Unsupported provider driver")];
            case 2:
                _a.sent();
                return [4 /*yield*/, (0, bun_test_1.expect)((0, catalog_1.discoverProviderModels)("openai", server.url.toString(), secret)).rejects.toThrow("Model discovery failed (401)")];
            case 3:
                _a.sent();
                return [4 /*yield*/, (0, bun_test_1.expect)((0, catalog_1.discoverProviderModels)("openai", server.url.toString(), secret)).rejects.not.toThrow(secret)];
            case 4:
                _a.sent();
                return [3 /*break*/, 6];
            case 5:
                server.stop(true);
                return [7 /*endfinally*/];
            case 6: return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("rejects a discovery import without credentials or model IDs", function () {
    (0, bun_test_1.expect)(function () {
        return (0, catalog_1.configureProviderModels)(contracts_1.configV3Schema.parse({ version: 3 }), {
            providerID: "private-provider",
            driver: "openai-compatible",
            source: "discovery",
            modelIDs: ["real-model"],
        });
    }).toThrow("Provider API key is required for discovery");
    (0, bun_test_1.expect)(function () {
        return (0, catalog_1.configureProviderModels)(contracts_1.configV3Schema.parse({ version: 3 }), {
            providerID: "private-provider",
            driver: "openai-compatible",
            source: "manual",
            modelIDs: [],
        });
    }).toThrow("At least one model ID is required");
});
(0, bun_test_1.test)("manual import preserves existing overrides and an existing default model", function () {
    var _a, _b, _c;
    var base = contracts_1.configV3Schema.parse({
        version: 3,
        providers: {
            local: {
                name: "Local",
                driver: "openai-compatible",
                connection: { apiKey: "existing-key" },
            },
        },
        catalog: {
            providers: {
                local: {
                    models: {
                        m1: { name: "m1", source: "manual" },
                    },
                },
            },
        },
        modelOverrides: {
            "local/m1": {
                enabled: true,
                requestDefaults: { temperature: 0.7, stream: false },
            },
        },
        defaultModel: { provider: "local", model: "m1" },
    });
    var next = (0, catalog_1.configureProviderModels)(base, {
        providerID: "local",
        providerName: "Renamed Gateway",
        driver: "openai-compatible",
        source: "manual",
        modelIDs: ["m1", "m2"],
    });
    // The user's override survives the re-import untouched.
    (0, bun_test_1.expect)(next.modelOverrides["local/m1"]).toMatchObject({
        requestDefaults: { temperature: 0.7, stream: false },
    });
    (0, bun_test_1.expect)(next.modelOverrides["local/m2"]).toBeUndefined();
    // The previous default stays; the provider name is user editable.
    (0, bun_test_1.expect)(next.defaultModel).toEqual({ provider: "local", model: "m1" });
    (0, bun_test_1.expect)((_a = next.providers["local"]) === null || _a === void 0 ? void 0 : _a.name).toBe("Renamed Gateway");
    // Existing catalog facts are preserved; new IDs are added with the source.
    (0, bun_test_1.expect)((_b = next.catalog.providers["local"]) === null || _b === void 0 ? void 0 : _b.models["m1"]).toMatchObject({
        name: "m1",
        source: "manual",
    });
    (0, bun_test_1.expect)((_c = next.catalog.providers["local"]) === null || _c === void 0 ? void 0 : _c.models["m2"]).toMatchObject({
        source: "manual",
        status: "stable",
    });
});
(0, bun_test_1.test)("resolveEffectiveModel merges catalog facts, override and provider defaults", function () {
    var config = contracts_1.configV3Schema.parse({
        version: 3,
        providers: {
            local: {
                name: "Local",
                driver: "openai-compatible",
                connection: { apiKey: "key" },
                requestDefaults: {
                    stream: false,
                    headers: { "x-base": "1" },
                    options: { baseOpt: 1 },
                },
            },
        },
        catalog: {
            providers: {
                local: {
                    models: {
                        m1: {
                            name: "m1 name",
                            capabilities: { thinking: false },
                            limits: { maxOutputTokens: 2000 },
                        },
                    },
                },
            },
        },
        modelOverrides: {
            "local/m1": {
                requestDefaults: { temperature: 0.5, thinkingEnabled: false },
                requestOptions: { opt: 2 },
                headers: { "x-override": "2" },
            },
        },
    });
    var effective = (0, catalog_1.resolveEffectiveModel)(config, "local/m1");
    (0, bun_test_1.expect)(effective).toMatchObject({
        name: "m1 name",
        capabilities: { thinking: false },
        limits: { maxOutputTokens: 2000 },
        requestDefaults: {
            temperature: 0.5,
            topP: null,
            // stream is not overridden, so the provider-level default wins.
            stream: false,
            thinkingEnabled: false,
            headers: { "x-base": "1", "x-override": "2" },
            options: { baseOpt: 1, opt: 2 },
        },
    });
    (0, bun_test_1.expect)((0, contracts_1.modelRefKey)(effective.ref)).toBe("local/m1");
});
(0, bun_test_1.test)("resolveEffectiveModel is undefined for an unknown provider or model", function () {
    var config = contracts_1.configV3Schema.parse({ version: 3 });
    (0, bun_test_1.expect)((0, catalog_1.resolveEffectiveModel)(config, { provider: "missing", model: "m" })).toBeUndefined();
    (0, bun_test_1.expect)((0, catalog_1.resolveEffectiveModel)(config, { provider: "p", model: "m" })).toBeUndefined();
});
(0, bun_test_1.test)("NATALIA_MODEL makes a transient default model ref without mutating the catalog", function () { return __awaiter(void 0, void 0, void 0, function () {
    var workspaceRoot, resolved;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-env-model-"))];
            case 1:
                workspaceRoot = _a.sent();
                _a.label = 2;
            case 2:
                _a.trys.push([2, , 4, 6]);
                return [4 /*yield*/, (0, service_1.resolveConfig)({
                        workspaceRoot: workspaceRoot,
                        environment: { NATALIA_MODEL: "openai/gpt-test" },
                    })];
            case 3:
                resolved = _a.sent();
                (0, bun_test_1.expect)(resolved.config.defaultModel).toEqual({
                    provider: "openai",
                    model: "gpt-test",
                });
                (0, bun_test_1.expect)(resolved.config.catalog.providers.openai).toBeUndefined();
                (0, bun_test_1.expect)(resolved.config.modelOverrides["openai/gpt-test"]).toBeUndefined();
                (0, bun_test_1.expect)(resolved.sources).toContainEqual({
                    scope: "environment",
                    applied: true,
                    diagnostic: "NATALIA_MODEL",
                });
                return [3 /*break*/, 6];
            case 4: return [4 /*yield*/, (0, promises_1.rm)(workspaceRoot, { recursive: true, force: true })];
            case 5:
                _a.sent();
                return [7 /*endfinally*/];
            case 6: return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("writes settings mutations to the requested config scope", function () { return __awaiter(void 0, void 0, void 0, function () {
    var workspaceRoot, home, previousHome, previousAppData, previousUserProfile, project, _a, _b, globalConfigPath, global_1, _c, _d, resolved;
    return __generator(this, function (_e) {
        switch (_e.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-config-write-scope-"))];
            case 1:
                workspaceRoot = _e.sent();
                return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-config-write-home-"))];
            case 2:
                home = _e.sent();
                previousHome = process.env.HOME;
                previousAppData = process.env.APPDATA;
                previousUserProfile = process.env.USERPROFILE;
                // Global-scope resolution reads HOME on POSIX and APPDATA on Windows, so
                // the fixture points the platform's own variable at the temp home.
                process.env.HOME = home;
                if (process.platform === "win32") {
                    process.env.APPDATA = home;
                    process.env.USERPROFILE = home;
                }
                _e.label = 3;
            case 3:
                _e.trys.push([3, , 9, 12]);
                return [4 /*yield*/, (0, service_1.updateConfigAtScope)(workspaceRoot, { runtime: { maxStepsPerTurn: 7 } }, "project")];
            case 4:
                _e.sent();
                return [4 /*yield*/, (0, service_1.updateConfigAtScope)(workspaceRoot, { context: { compactionThresholdPercent: 91 } }, "global")];
            case 5:
                _e.sent();
                _b = (_a = JSON).parse;
                return [4 /*yield*/, (0, promises_1.readFile)((0, node_path_1.join)(workspaceRoot, ".natalia", "config.json"), "utf8")];
            case 6:
                project = _b.apply(_a, [_e.sent()]);
                globalConfigPath = process.platform === "win32"
                    ? (0, node_path_1.join)(home, "natalia-cli", "config.json")
                    : (0, node_path_1.join)(home, ".config", "natalia-cli", "config.json");
                _d = (_c = JSON).parse;
                return [4 /*yield*/, (0, promises_1.readFile)(globalConfigPath, "utf8")];
            case 7:
                global_1 = _d.apply(_c, [_e.sent()]);
                (0, bun_test_1.expect)(project).toEqual({ runtime: { maxStepsPerTurn: 7 } });
                (0, bun_test_1.expect)(global_1).toEqual({ context: { compactionThresholdPercent: 91 } });
                return [4 /*yield*/, (0, service_1.resolveConfig)({ workspaceRoot: workspaceRoot })];
            case 8:
                resolved = _e.sent();
                (0, bun_test_1.expect)(resolved.config.runtime.maxStepsPerTurn).toBe(7);
                (0, bun_test_1.expect)(resolved.config.context.compactionThresholdPercent).toBe(91);
                return [3 /*break*/, 12];
            case 9:
                if (previousHome === undefined)
                    delete process.env.HOME;
                else
                    process.env.HOME = previousHome;
                if (previousAppData === undefined)
                    delete process.env.APPDATA;
                else
                    process.env.APPDATA = previousAppData;
                if (previousUserProfile === undefined)
                    delete process.env.USERPROFILE;
                else
                    process.env.USERPROFILE = previousUserProfile;
                return [4 /*yield*/, (0, promises_1.rm)(workspaceRoot, { recursive: true, force: true })];
            case 10:
                _e.sent();
                return [4 /*yield*/, (0, promises_1.rm)(home, { recursive: true, force: true })];
            case 11:
                _e.sent();
                return [7 /*endfinally*/];
            case 12: return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("persists different context windows for individual provider models", function () { return __awaiter(void 0, void 0, void 0, function () {
    var workspaceRoot, globalPath, base, next, resolved, _a, _b, _c;
    var _d, _e, _f, _g;
    return __generator(this, function (_h) {
        switch (_h.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-model-context-window-"))];
            case 1:
                workspaceRoot = _h.sent();
                globalPath = (0, node_path_1.join)(workspaceRoot, "global.json");
                _h.label = 2;
            case 2:
                _h.trys.push([2, , 7, 9]);
                base = contracts_1.configV3Schema.parse({
                    version: 3,
                    providers: {
                        local: { name: "Local", driver: "openai-compatible" },
                    },
                    catalog: {
                        providers: {
                            local: {
                                models: {
                                    small: { name: "Small" },
                                    large: { name: "Large" },
                                },
                            },
                        },
                    },
                });
                return [4 /*yield*/, (0, service_1.updateConfigAtScope)(workspaceRoot, { providers: base.providers, catalog: base.catalog }, "global", { globalPath: globalPath })];
            case 3:
                _h.sent();
                next = structuredClone(base);
                next.catalog.providers.local.models.small.limits.contextWindow = 32768;
                next.catalog.providers.local.models.large.limits.contextWindow = 262144;
                return [4 /*yield*/, (0, service_1.updateConfigAtScope)(workspaceRoot, (0, service_1.configPatch)(base, next), "global", { globalPath: globalPath })];
            case 4:
                _h.sent();
                return [4 /*yield*/, (0, service_1.resolveConfig)({ workspaceRoot: workspaceRoot, globalPath: globalPath, environment: {} })];
            case 5:
                resolved = (_h.sent()).config;
                (0, bun_test_1.expect)((_e = (_d = resolved.catalog.providers.local) === null || _d === void 0 ? void 0 : _d.models.small) === null || _e === void 0 ? void 0 : _e.limits.contextWindow).toBe(32768);
                (0, bun_test_1.expect)((_g = (_f = resolved.catalog.providers.local) === null || _f === void 0 ? void 0 : _f.models.large) === null || _g === void 0 ? void 0 : _g.limits.contextWindow).toBe(262144);
                _a = bun_test_1.expect;
                _c = (_b = JSON).parse;
                return [4 /*yield*/, (0, promises_1.readFile)(globalPath, "utf8")];
            case 6:
                _a.apply(void 0, [_c.apply(_b, [_h.sent()])]).toMatchObject({
                    catalog: {
                        providers: {
                            local: {
                                models: {
                                    small: { limits: { contextWindow: 32768 } },
                                    large: { limits: { contextWindow: 262144 } },
                                },
                            },
                        },
                    },
                });
                return [3 /*break*/, 9];
            case 7: return [4 /*yield*/, (0, promises_1.rm)(workspaceRoot, { recursive: true, force: true })];
            case 8:
                _h.sent();
                return [7 /*endfinally*/];
            case 9: return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("config patches preserve complete changed records and delete removed records", function () {
    var base = contracts_1.configV3Schema.parse({
        version: 3,
        providers: {
            retained: {
                name: "Retained",
                driver: "openai",
                connection: { apiKey: "base-key" },
            },
            removed: {
                name: "Removed",
                driver: "openai",
                connection: { apiKey: "remove-key" },
            },
        },
    });
    var next = contracts_1.configV3Schema.parse(__assign(__assign({}, base), { providers: {
            retained: __assign(__assign({}, base.providers.retained), { connection: __assign(__assign({}, base.providers.retained.connection), { baseURL: "https://example.invalid" }) }),
        } }));
    (0, bun_test_1.expect)((0, service_1.configPatch)(base, next)).toMatchObject({
        providers: {
            retained: {
                name: "Retained",
                driver: "openai",
                connection: {
                    apiKey: "base-key",
                    baseURL: "https://example.invalid",
                },
            },
            removed: undefined,
        },
    });
});
(0, bun_test_1.test)("config patches delete removed plugin package records", function () {
    var base = contracts_1.configV3Schema.parse({
        version: 3,
        plugins: {
            packages: {
                "fixture.plugin": {
                    source: { type: "registry", spec: "@fixture/plugin" },
                    version: "1.0.0",
                    scope: "workspace",
                },
            },
        },
    });
    var next = contracts_1.configV3Schema.parse(__assign(__assign({}, base), { plugins: __assign(__assign({}, base.plugins), { packages: {} }) }));
    (0, bun_test_1.expect)((0, service_1.configPatch)(base, next)).toMatchObject({
        plugins: { packages: { "fixture.plugin": undefined } },
    });
});
(0, bun_test_1.test)("settings arrays and browser fields persist as a minimal selected-scope patch", function () { return __awaiter(void 0, void 0, void 0, function () {
    var workspaceRoot, home, previousHome, base, next, resolved, patch, _a, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-config-settings-surface-"))];
            case 1:
                workspaceRoot = _c.sent();
                return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-config-settings-home-"))];
            case 2:
                home = _c.sent();
                previousHome = process.env.HOME;
                process.env.HOME = home;
                _c.label = 3;
            case 3:
                _c.trys.push([3, , 8, 11]);
                return [4 /*yield*/, (0, service_1.resolveConfig)({ workspaceRoot: workspaceRoot })];
            case 4:
                base = (_c.sent()).config;
                next = contracts_1.configV3Schema.parse(__assign(__assign({}, base), { instructions: __assign(__assign({}, base.instructions), { extraFiles: ["AGENTS.md", "docs/local.md"] }), browser: __assign(__assign({}, base.browser), { binary: "/usr/bin/chromium", userAgent: "Natalia test agent", persistentProfile: true, profileDir: ".natalia/browser-profile", locale: "zh-CN", timezone: "Asia/Shanghai", headers: { "x-browser-test": "enabled" } }), security: __assign(__assign({}, base.security), { envAllowlist: ["SAFE_TOKEN", "PATH"] }), webSearch: __assign(__assign({}, base.webSearch), { endpoint: "https://search.example/v1", providerPriority: ["configured", "duckduckgo"] }), network: __assign(__assign({}, base.network), { allowedHosts: ["example.com", "*.example.net"], allowedSchemes: ["https"] }), mcpServers: __assign(__assign({}, base.mcpServers), { local: {
                            type: "stdio",
                            command: "mcp-server",
                            args: ["--stdio", "--scope", "test"],
                            cwd: "tools/mcp",
                            headers: { "x-mcp-key": "test-only" },
                            environment: { MCP_MODE: "test" },
                            timeoutSec: 45,
                            allowedTools: ["read"],
                            excludedTools: ["write"],
                            readOnly: true,
                            enabled: true,
                        } }), skills: { urls: ["https://skills.example/index.json"] }, plugins: {
                        enabled: { formatter: true },
                        paths: [".natalia/plugins-extra"],
                        capabilities: { formatter: ["tools"] },
                        readOnly: { formatter: true },
                    }, checkpoint: __assign(__assign({}, base.checkpoint), { additionalDirs: ["generated"] }), workspace: __assign(__assign({}, base.workspace), { root: "worktree", additionalDirs: ["shared"] }), agentModes: __assign(__assign({}, base.agentModes), { guarded: {
                            approval: "read_only",
                            description: "Safe inspection",
                            systemPrompt: "",
                            allowedTools: ["read_file"],
                            excludedTools: [],
                            commandRules: {
                                mode: "whitelist",
                                rules: [{ command: "git diff", reason: "inspect changes" }],
                            },
                            skills: false,
                            mcpServers: [],
                        }, review: {
                            approval: "ask",
                            description: "Review only",
                            systemPrompt: "Inspect changes and report findings.",
                            model: "review-model",
                            allowedTools: ["read_file", "grep"],
                            excludedTools: ["run_shell"],
                            mcpServers: ["docs"],
                            skills: true,
                        } }) }));
                return [4 /*yield*/, (0, service_1.updateConfigAtScope)(workspaceRoot, (0, service_1.configPatch)(base, next), "project")];
            case 5:
                _c.sent();
                return [4 /*yield*/, (0, service_1.resolveConfig)({ workspaceRoot: workspaceRoot })];
            case 6:
                resolved = (_c.sent()).config;
                (0, bun_test_1.expect)(resolved.workspace.root).toBe("worktree");
                (0, bun_test_1.expect)(resolved.instructions.extraFiles).toEqual([
                    "AGENTS.md",
                    "docs/local.md",
                ]);
                (0, bun_test_1.expect)(resolved.browser).toMatchObject({
                    binary: "/usr/bin/chromium",
                    userAgent: "Natalia test agent",
                    persistentProfile: true,
                    profileDir: ".natalia/browser-profile",
                    locale: "zh-CN",
                    timezone: "Asia/Shanghai",
                    headers: { "x-browser-test": "enabled" },
                });
                (0, bun_test_1.expect)(resolved.network).toMatchObject({
                    allowedHosts: ["example.com", "*.example.net"],
                    allowedSchemes: ["https"],
                });
                (0, bun_test_1.expect)(resolved.security.envAllowlist).toEqual(["SAFE_TOKEN", "PATH"]);
                (0, bun_test_1.expect)(resolved.webSearch.endpoint).toBe("https://search.example/v1");
                (0, bun_test_1.expect)(resolved.webSearch.providerPriority).toEqual([
                    "configured",
                    "duckduckgo",
                ]);
                (0, bun_test_1.expect)(resolved.mcpServers.local).toMatchObject({
                    args: ["--stdio", "--scope", "test"],
                    cwd: "tools/mcp",
                    headers: { "x-mcp-key": "test-only" },
                    environment: { MCP_MODE: "test" },
                    allowedTools: ["read"],
                    excludedTools: ["write"],
                });
                (0, bun_test_1.expect)(resolved.skills.urls).toEqual(["https://skills.example/index.json"]);
                (0, bun_test_1.expect)(resolved.plugins).toMatchObject({
                    enabled: { formatter: true },
                    paths: [".natalia/plugins-extra"],
                    capabilities: { formatter: ["tools"] },
                    readOnly: { formatter: true },
                });
                (0, bun_test_1.expect)(resolved.checkpoint.additionalDirs).toEqual(["generated"]);
                (0, bun_test_1.expect)(resolved.workspace.additionalDirs).toEqual(["shared"]);
                (0, bun_test_1.expect)(resolved.agentModes.guarded).toEqual({
                    approval: "read_only",
                    description: "Safe inspection",
                    systemPrompt: "",
                    allowedTools: ["read_file"],
                    excludedTools: [],
                    commandRules: {
                        mode: "whitelist",
                        rules: [{ command: "git diff", reason: "inspect changes" }],
                    },
                    skills: false,
                    mcpServers: [],
                });
                (0, bun_test_1.expect)(resolved.agentModes.review).toMatchObject({
                    systemPrompt: "Inspect changes and report findings.",
                    model: "review-model",
                    allowedTools: ["read_file", "grep"],
                    excludedTools: ["run_shell"],
                    mcpServers: ["docs"],
                });
                _b = (_a = JSON).parse;
                return [4 /*yield*/, (0, promises_1.readFile)((0, node_path_1.join)(workspaceRoot, ".natalia", "config.json"), "utf8")];
            case 7:
                patch = _b.apply(_a, [_c.sent()]);
                (0, bun_test_1.expect)(patch).toMatchObject({
                    workspace: { root: "worktree" },
                    instructions: { extraFiles: ["AGENTS.md", "docs/local.md"] },
                    browser: { binary: "/usr/bin/chromium" },
                    security: { envAllowlist: ["SAFE_TOKEN", "PATH"] },
                    mcpServers: {
                        local: bun_test_1.expect.objectContaining({
                            args: ["--stdio", "--scope", "test"],
                            headers: { "x-mcp-key": "test-only" },
                            environment: { MCP_MODE: "test" },
                        }),
                    },
                });
                return [3 /*break*/, 11];
            case 8:
                if (previousHome === undefined)
                    delete process.env.HOME;
                else
                    process.env.HOME = previousHome;
                return [4 /*yield*/, (0, promises_1.rm)(workspaceRoot, { recursive: true, force: true })];
            case 9:
                _c.sent();
                return [4 /*yield*/, (0, promises_1.rm)(home, { recursive: true, force: true })];
            case 10:
                _c.sent();
                return [7 /*endfinally*/];
            case 11: return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("catalog excludes providers denied by the configured policy", function () {
    var config = contracts_1.configV3Schema.parse({
        version: 3,
        providers: {
            approved: {
                name: "Approved",
                driver: "openai-compatible",
                connection: { apiKey: "approved-key" },
            },
            blocked: {
                name: "Blocked",
                driver: "openai-compatible",
                connection: { apiKey: "blocked-key" },
            },
        },
        catalog: {
            providers: {
                approved: { models: { "approved-model": { name: "approved-model" } } },
                blocked: { models: { "blocked-model": { name: "blocked-model" } } },
            },
        },
        experimental: {
            policies: [
                { effect: "deny", action: "provider.use", resource: "*" },
                { effect: "allow", action: "provider.use", resource: "approved" },
            ],
        },
    });
    (0, bun_test_1.expect)((0, catalog_1.buildModelCatalog)(config)).toEqual([
        {
            id: "approved",
            name: "Approved",
            driver: "openai-compatible",
            configured: true,
            models: [
                {
                    id: "approved-model",
                    provider: "approved",
                    name: "approved-model",
                    capabilities: {
                        toolCall: true,
                        reasoning: true,
                        thinking: true,
                        imageInput: false,
                        videoInput: false,
                    },
                    limits: { contextWindow: "auto" },
                    status: "stable",
                    source: "discovery",
                },
            ],
        },
    ]);
});
(0, bun_test_1.test)("catalog filters disabled and policy-denied models while preserving capabilities", function () {
    var _a;
    var config = contracts_1.configV3Schema.parse({
        version: 3,
        providers: {
            local: {
                name: "Local",
                driver: "openai-compatible",
                connection: { apiKey: "key" },
            },
        },
        catalog: {
            providers: {
                local: {
                    models: {
                        capable: {
                            name: "capable",
                            capabilities: {
                                toolCall: false,
                                reasoning: false,
                                thinking: false,
                            },
                        },
                        disabled: { name: "disabled" },
                        denied: { name: "denied" },
                    },
                },
            },
        },
        modelOverrides: {
            "local/disabled": { enabled: false },
        },
        experimental: {
            policies: [
                { effect: "deny", action: "provider.use", resource: "local/denied" },
            ],
        },
    });
    var models = (_a = (0, catalog_1.buildModelCatalog)(config)[0]) === null || _a === void 0 ? void 0 : _a.models;
    (0, bun_test_1.expect)(models === null || models === void 0 ? void 0 : models.map(function (model) { return model.id; })).toEqual(["capable"]);
    (0, bun_test_1.expect)(models === null || models === void 0 ? void 0 : models[0]).toMatchObject({
        capabilities: {
            toolCall: false,
            reasoning: false,
            thinking: false,
            imageInput: false,
            videoInput: false,
        },
    });
});
