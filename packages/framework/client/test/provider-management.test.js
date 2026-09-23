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
var config_1 = require("@natalia/config");
var selection_1 = require("../src/runtime/provider-selection/selection");
function harness() {
    return __awaiter(this, void 0, void 0, function () {
        var root, globalPath, config, executions, ctx;
        var _this = this;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-provider-management-"))];
                case 1:
                    root = _a.sent();
                    globalPath = (0, node_path_1.join)(root, "global.json");
                    config = contracts_1.configV3Schema.parse({
                        version: 3,
                        providers: {
                            target: {
                                name: "Target",
                                driver: "openai-compatible",
                                connection: { apiKey: "test-secret" },
                            },
                            keep: { name: "Keep", driver: "openai-compatible" },
                        },
                        catalog: {
                            providers: {
                                target: { models: { model: { name: "model" } } },
                                keep: { models: { model: { name: "keep" } } },
                            },
                        },
                        modelOverrides: {
                            "target/model": { name: "Target override" },
                            "keep/model": { name: "Keep override" },
                        },
                    });
                    return [4 /*yield*/, (0, config_1.updateConfigAtScope)(root, config, "global", { globalPath: globalPath })];
                case 2:
                    _a.sent();
                    executions = new Map();
                    ctx = {
                        ports: {
                            getReady: function () { return __awaiter(_this, void 0, void 0, function () { return __generator(this, function (_a) {
                                return [2 /*return*/];
                            }); }); },
                            getTsRuntimeConfig: function () { return config; },
                            getWorkspaceRoot: function () { return root; },
                            getExecutionBySession: function () { return executions; },
                            getActiveExec: function () { return undefined; },
                            getSelectedModel: function () { return undefined; },
                            applyConfigFromDisk: function () { return __awaiter(_this, void 0, void 0, function () {
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0: return [4 /*yield*/, (0, config_1.resolveConfig)({ workspaceRoot: root, globalPath: globalPath })];
                                        case 1:
                                            config = (_a.sent())
                                                .config;
                                            return [2 /*return*/];
                                    }
                                });
                            }); },
                        },
                    };
                    return [2 /*return*/, {
                            surface: (0, selection_1.createSelectionSurface)(ctx, { globalConfigPath: globalPath }),
                            config: function () { return config; },
                            executions: executions,
                            globalPath: globalPath,
                            dispose: function () { return (0, promises_1.rm)(root, { recursive: true, force: true }); },
                        }];
            }
        });
    });
}
(0, bun_test_1.test)("provider deletion atomically removes its credentials, catalog and overrides only", function () { return __awaiter(void 0, void 0, void 0, function () {
    var h, _a, config, _b, _c;
    var _d, _e, _f, _g;
    return __generator(this, function (_h) {
        switch (_h.label) {
            case 0: return [4 /*yield*/, harness()];
            case 1:
                h = _h.sent();
                _h.label = 2;
            case 2:
                _h.trys.push([2, , 6, 8]);
                _a = bun_test_1.expect;
                return [4 /*yield*/, h.surface.providerRemove("target")];
            case 3:
                _a.apply(void 0, [_h.sent()]).toEqual({
                    removed: true,
                });
                config = h.config();
                (0, bun_test_1.expect)(config.providers.target).toBeUndefined();
                (0, bun_test_1.expect)(config.catalog.providers.target).toBeUndefined();
                (0, bun_test_1.expect)(config.modelOverrides["target/model"]).toBeUndefined();
                (0, bun_test_1.expect)((_d = config.providers.keep) === null || _d === void 0 ? void 0 : _d.name).toBe("Keep");
                (0, bun_test_1.expect)((_f = (_e = config.catalog.providers.keep) === null || _e === void 0 ? void 0 : _e.models.model) === null || _f === void 0 ? void 0 : _f.name).toBe("keep");
                (0, bun_test_1.expect)((_g = config.modelOverrides["keep/model"]) === null || _g === void 0 ? void 0 : _g.name).toBe("Keep override");
                _b = bun_test_1.expect;
                return [4 /*yield*/, (0, promises_1.readFile)(h.globalPath, "utf8")];
            case 4:
                _b.apply(void 0, [_h.sent()]).not.toContain("test-secret");
                _c = bun_test_1.expect;
                return [4 /*yield*/, h.surface.providerRemove("target")];
            case 5:
                _c.apply(void 0, [_h.sent()]).toEqual({
                    removed: true,
                });
                return [3 /*break*/, 8];
            case 6: return [4 /*yield*/, h.dispose()];
            case 7:
                _h.sent();
                return [7 /*endfinally*/];
            case 8: return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("provider model additions, edits and deletions replace the picker catalog", function () { return __awaiter(void 0, void 0, void 0, function () {
    var h, save, listed;
    var _a, _b, _c;
    return __generator(this, function (_d) {
        switch (_d.label) {
            case 0: return [4 /*yield*/, harness()];
            case 1:
                h = _d.sent();
                save = function (models) {
                    return h.surface.providerAdd({
                        name: "target",
                        type: "openai-compatible",
                        apiKey: "test-secret",
                        models: models,
                    });
                };
                listed = function () {
                    return (0, config_1.buildModelCatalog)(h.config()).find(function (provider) { return provider.id === "target"; })
                        .models;
                };
                _d.label = 2;
            case 2:
                _d.trys.push([2, , 7, 9]);
                return [4 /*yield*/, save([
                        { id: "model" },
                        { id: "new-model", name: "New", reasoning: false },
                    ])];
            case 3:
                _d.sent();
                (0, bun_test_1.expect)(listed()
                    .map(function (model) { return model.id; })
                    .sort()).toEqual(["model", "new-model"]);
                return [4 /*yield*/, save([{ id: "new-model", name: "Edited", reasoning: true }])];
            case 4:
                _d.sent();
                (0, bun_test_1.expect)(listed()).toHaveLength(1);
                (0, bun_test_1.expect)(listed()[0]).toMatchObject({
                    id: "new-model",
                    name: "Edited",
                    capabilities: { reasoning: true },
                });
                (0, bun_test_1.expect)((_a = h.config().catalog.providers.target) === null || _a === void 0 ? void 0 : _a.models.model).toBeUndefined();
                (0, bun_test_1.expect)(h.config().modelOverrides["target/model"]).toBeUndefined();
                return [4 /*yield*/, save()];
            case 5:
                _d.sent(); // Omitting models changes provider settings without clearing its catalog.
                (0, bun_test_1.expect)(listed()).toHaveLength(1);
                return [4 /*yield*/, save([])];
            case 6:
                _d.sent();
                (0, bun_test_1.expect)(listed()).toEqual([]);
                (0, bun_test_1.expect)((_b = h.config().catalog.providers.target) === null || _b === void 0 ? void 0 : _b.models).toEqual({});
                (0, bun_test_1.expect)((_c = h.config().catalog.providers.keep) === null || _c === void 0 ? void 0 : _c.models.model).toBeDefined();
                (0, bun_test_1.expect)(h.config().modelOverrides["keep/model"]).toBeDefined();
                return [3 /*break*/, 9];
            case 7: return [4 /*yield*/, h.dispose()];
            case 8:
                _d.sent();
                return [7 /*endfinally*/];
            case 9: return [2 /*return*/];
        }
    });
}); });
bun_test_1.test.each(["default", "agent", "mode", "session", "navi", "nia"])("provider deletion preserves config when referenced by %s", function (reference) { return __awaiter(void 0, void 0, void 0, function () {
    var h, config, before, result, after, _a, _b, _c;
    return __generator(this, function (_d) {
        switch (_d.label) {
            case 0: return [4 /*yield*/, harness()];
            case 1:
                h = _d.sent();
                _d.label = 2;
            case 2:
                _d.trys.push([2, , 8, 10]);
                config = h.config();
                if (reference === "default")
                    config.defaultModel = { provider: "target", model: "model" };
                if (reference === "agent")
                    config.agents = contracts_1.configV3Schema.parse({
                        version: 3,
                        agents: { reviewer: { model: "target/model" } },
                    }).agents;
                if (reference === "mode")
                    config.agentModes.ask.model = "target/model";
                if (["session", "navi", "nia"].includes(reference)) {
                    h.executions.set("background", __assign({ session: { id: "background" } }, (reference === "session"
                        ? { selectedModel: { modelID: "target/model" } }
                        : reference === "navi"
                            ? {
                                naviChatModelProfile: {
                                    normal: { modelID: "target/model" },
                                },
                            }
                            : {
                                niaChatModelProfile: {
                                    normal: { modelID: "target/model" },
                                },
                            })));
                }
                return [4 /*yield*/, (0, promises_1.readFile)(h.globalPath, "utf8")];
            case 3:
                before = _d.sent();
                return [4 /*yield*/, h.surface.providerRemove("target")];
            case 4:
                result = _d.sent();
                if (!(reference === "default")) return [3 /*break*/, 6];
                // Removing the provider that supplies the global default is allowed;
                // the runtime switches the default to the first remaining model.
                (0, bun_test_1.expect)(result.removed).toBe(true);
                (0, bun_test_1.expect)(result.defaultModel).toBe("keep/model");
                _b = (_a = JSON).parse;
                return [4 /*yield*/, (0, promises_1.readFile)(h.globalPath, "utf8")];
            case 5:
                after = _b.apply(_a, [_d.sent()]);
                (0, bun_test_1.expect)(after.defaultModel).toEqual({
                    provider: "keep",
                    model: "model",
                });
                return [2 /*return*/];
            case 6:
                (0, bun_test_1.expect)(result.removed).toBe(false);
                (0, bun_test_1.expect)(result.reason).toContain("referenced");
                _c = bun_test_1.expect;
                return [4 /*yield*/, (0, promises_1.readFile)(h.globalPath, "utf8")];
            case 7:
                _c.apply(void 0, [_d.sent()]).toBe(before);
                return [3 /*break*/, 10];
            case 8: return [4 /*yield*/, h.dispose()];
            case 9:
                _d.sent();
                return [7 /*endfinally*/];
            case 10: return [2 /*return*/];
        }
    });
}); });
