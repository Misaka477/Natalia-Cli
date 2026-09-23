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
var promises_1 = require("node:fs/promises");
var node_os_1 = require("node:os");
var node_path_1 = require("node:path");
var src_1 = require("../src");
(0, bun_test_1.test)("global-scope settings survive across different workspaces", function () { return __awaiter(void 0, void 0, void 0, function () {
    var rootA, rootB, globalPath, _a, b, a;
    var _b, _c;
    return __generator(this, function (_d) {
        switch (_d.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-global-a-"))];
            case 1:
                rootA = _d.sent();
                return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-global-b-"))];
            case 2:
                rootB = _d.sent();
                _a = node_path_1.join;
                return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-global-home-"))];
            case 3:
                globalPath = _a.apply(void 0, [_d.sent(), "config.json"]);
                // Write a user-level setting (team.maxConcurrent) to the GLOBAL scope.
                return [4 /*yield*/, (0, src_1.updateGlobalConfig)({ team: { maxConcurrent: 8 } }, globalPath)];
            case 4:
                // Write a user-level setting (team.maxConcurrent) to the GLOBAL scope.
                _d.sent();
                return [4 /*yield*/, (0, src_1.resolveConfig)({ workspaceRoot: rootB, globalPath: globalPath })];
            case 5:
                b = _d.sent();
                (0, bun_test_1.expect)((_b = b.config.team) === null || _b === void 0 ? void 0 : _b.maxConcurrent).toBe(8);
                return [4 /*yield*/, (0, src_1.resolveConfig)({ workspaceRoot: rootA, globalPath: globalPath })];
            case 6:
                a = _d.sent();
                (0, bun_test_1.expect)((_c = a.config.team) === null || _c === void 0 ? void 0 : _c.maxConcurrent).toBe(8);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("partial terminal overlay keeps the default pty backend", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, globalPath, _a, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-terminal-backend-"))];
            case 1:
                root = _c.sent();
                globalPath = (0, node_path_1.join)(root, "global.json");
                _a = bun_test_1.expect;
                return [4 /*yield*/, (0, src_1.resolveConfig)({ workspaceRoot: root, globalPath: globalPath })];
            case 2:
                _a.apply(void 0, [(_c.sent()).config.runtime
                        .terminal.backend]).toBe("pty");
                return [4 /*yield*/, (0, promises_1.mkdir)((0, node_path_1.join)(root, ".natalia"), { recursive: true })];
            case 3:
                _c.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(root, ".natalia", "config.json"), JSON.stringify({
                        version: 3,
                        runtime: { terminal: { windowMode: "window" } },
                    }))];
            case 4:
                _c.sent();
                _b = bun_test_1.expect;
                return [4 /*yield*/, (0, src_1.resolveConfig)({ workspaceRoot: root, globalPath: globalPath })];
            case 5:
                _b.apply(void 0, [(_c.sent()).config.runtime
                        .terminal]).toEqual({ windowMode: "window", backend: "pty" });
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("collaboration auto rounds default to three and accept project overrides", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, globalPath, _a, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-collaboration-config-"))];
            case 1:
                root = _c.sent();
                globalPath = (0, node_path_1.join)(root, "global.json");
                _a = bun_test_1.expect;
                return [4 /*yield*/, (0, src_1.resolveConfig)({ workspaceRoot: root, globalPath: globalPath })];
            case 2:
                _a.apply(void 0, [(_c.sent()).config.runtime
                        .collaboration.maxAutoRounds]).toBe(3);
                return [4 /*yield*/, (0, src_1.updateConfigAtScope)(root, { runtime: { collaboration: { maxAutoRounds: 7 } } }, "project", { globalPath: globalPath })];
            case 3:
                _c.sent();
                _b = bun_test_1.expect;
                return [4 /*yield*/, (0, src_1.resolveConfig)({ workspaceRoot: root, globalPath: globalPath })];
            case 4:
                _b.apply(void 0, [(_c.sent()).config.runtime
                        .collaboration.maxAutoRounds]).toBe(7);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("legacy project model settings migrate once without moving other settings", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, globalPath, projectPath, first, _a, _b, _c, second;
    return __generator(this, function (_d) {
        switch (_d.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-model-migration-"))];
            case 1:
                root = _d.sent();
                globalPath = (0, node_path_1.join)(root, "global.json");
                projectPath = (0, node_path_1.join)(root, ".natalia", "config.json");
                return [4 /*yield*/, (0, promises_1.mkdir)((0, node_path_1.join)(root, ".natalia"), { recursive: true })];
            case 2:
                _d.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)(globalPath, JSON.stringify({
                        providers: {
                            shared: {
                                name: "Shared",
                                driver: "openai",
                                connection: { apiKey: "global-key" },
                            },
                        },
                    }))];
            case 3:
                _d.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)(projectPath, JSON.stringify({
                        providers: {
                            shared: { connection: { baseURL: "https://project.invalid" } },
                        },
                        catalog: {
                            providers: { shared: { models: { model: { name: "model" } } } },
                        },
                        defaultModel: { provider: "shared", model: "model" },
                        context: { compactionThresholdPercent: 92 },
                    }))];
            case 4:
                _d.sent();
                return [4 /*yield*/, (0, src_1.migrateProjectModelConfigToGlobal)(root, { globalPath: globalPath })];
            case 5:
                first = _d.sent();
                (0, bun_test_1.expect)(first.migrated).toEqual(["providers", "catalog", "defaultModel"]);
                (0, bun_test_1.expect)(first.config.providers.shared).toMatchObject({
                    connection: {
                        apiKey: "global-key",
                        baseURL: "https://project.invalid",
                    },
                });
                (0, bun_test_1.expect)(first.config.defaultModel).toEqual({
                    provider: "shared",
                    model: "model",
                });
                _a = bun_test_1.expect;
                _c = (_b = JSON).parse;
                return [4 /*yield*/, (0, promises_1.readFile)(projectPath, "utf8")];
            case 6:
                _a.apply(void 0, [_c.apply(_b, [_d.sent()])]).toEqual({
                    context: { compactionThresholdPercent: 92 },
                });
                return [4 /*yield*/, (0, src_1.migrateProjectModelConfigToGlobal)(root, { globalPath: globalPath })];
            case 7:
                second = _d.sent();
                (0, bun_test_1.expect)(second.migrated).toEqual([]);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("project writes route model settings globally and preserve legacy data", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, globalPath, projectPath, global, _a, _b, project, _c, _d, resolved;
    var _e;
    return __generator(this, function (_f) {
        switch (_f.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-global-models-"))];
            case 1:
                root = _f.sent();
                globalPath = (0, node_path_1.join)(root, "global.json");
                projectPath = (0, node_path_1.join)(root, ".natalia", "config.json");
                return [4 /*yield*/, (0, promises_1.mkdir)((0, node_path_1.join)(root, ".natalia"), { recursive: true })];
            case 2:
                _f.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)(projectPath, JSON.stringify({
                        providers: { legacy: { name: "Legacy" } },
                        catalog: { providers: { legacy: { models: {} } } },
                        modelOverrides: { "legacy/model": { enabled: true } },
                        defaultModel: { provider: "legacy", model: "model" },
                        context: { compactionThresholdPercent: 80 },
                    }))];
            case 3:
                _f.sent();
                return [4 /*yield*/, (0, src_1.updateConfigAtScope)(root, {
                        providers: {
                            global: {
                                name: "Global",
                                driver: "openai",
                                connection: { apiKey: "test-only" },
                            },
                        },
                        catalog: {
                            providers: {
                                global: { models: { model: { name: "model" } } },
                            },
                        },
                        modelOverrides: { "global/model": { enabled: true } },
                        defaultModel: { provider: "global", model: "model" },
                        context: { compactionThresholdPercent: 91 },
                    }, "project", { globalPath: globalPath })];
            case 4:
                _f.sent();
                _b = (_a = JSON).parse;
                return [4 /*yield*/, (0, promises_1.readFile)(globalPath, "utf8")];
            case 5:
                global = _b.apply(_a, [_f.sent()]);
                (0, bun_test_1.expect)(global).toMatchObject({
                    providers: { global: { name: "Global" } },
                    catalog: {
                        providers: { global: { models: { model: { name: "model" } } } },
                    },
                    modelOverrides: { "global/model": { enabled: true } },
                    defaultModel: { provider: "global", model: "model" },
                });
                (0, bun_test_1.expect)(global.context).toBeUndefined();
                _d = (_c = JSON).parse;
                return [4 /*yield*/, (0, promises_1.readFile)(projectPath, "utf8")];
            case 6:
                project = _d.apply(_c, [_f.sent()]);
                (0, bun_test_1.expect)(project).toEqual({
                    providers: { legacy: { name: "Legacy" } },
                    catalog: { providers: { legacy: { models: {} } } },
                    modelOverrides: { "legacy/model": { enabled: true } },
                    defaultModel: { provider: "legacy", model: "model" },
                    context: { compactionThresholdPercent: 91 },
                });
                return [4 /*yield*/, (0, src_1.resolveConfig)({ workspaceRoot: root, globalPath: globalPath })];
            case 7:
                resolved = _f.sent();
                (0, bun_test_1.expect)((_e = resolved.config.providers.global) === null || _e === void 0 ? void 0 : _e.name).toBe("Global");
                (0, bun_test_1.expect)(resolved.config.providers.legacy).toBeUndefined();
                (0, bun_test_1.expect)(resolved.config.context.compactionThresholdPercent).toBe(91);
                return [2 /*return*/];
        }
    });
}); });
