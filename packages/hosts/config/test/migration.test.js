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
var contracts_1 = require("@natalia/contracts");
var promises_1 = require("node:fs/promises");
var node_path_1 = require("node:path");
var node_os_1 = require("node:os");
var file_1 = require("../src/file");
var migration_1 = require("../src/migration");
var registry_1 = require("../src/registry");
var file_2 = require("../src/file");
var service_1 = require("../src/service");
var setup_1 = require("../src/setup");
function configuredConfig() {
    return contracts_1.configV3Schema.parse(__assign(__assign({}, (0, migration_1.defaultConfigV3)()), { providers: {
            openai: {
                name: "OpenAI",
                driver: "openai-compatible",
                enabled: true,
                connection: {
                    baseURL: "https://api.example/v1",
                    apiKey: "test-only",
                },
            },
        }, catalog: {
            providers: {
                openai: { models: { "test-model": { name: "test-model" } } },
            },
        }, defaultModel: { provider: "openai", model: "test-model" } }));
}
(0, bun_test_1.test)("setup snapshot exposes detection source and manual override", function () {
    var migrated = (0, migration_1.migrateConfig)(configuredConfig());
    var snapshot = (0, setup_1.createSetupSnapshot)(migrated.config, "openai/test-model", {
        tokens: 200000,
        source: "known_catalog",
        confidence: "medium",
        diagnostic: "catalog",
    });
    (0, bun_test_1.expect)(snapshot.contextWindow.manualOverrideAllowed).toBe(true);
    (0, bun_test_1.expect)(snapshot.contextWindow.source).toBe("known_catalog");
    (0, bun_test_1.expect)(snapshot.outputLimit.semantics).toBe("omitted");
    (0, bun_test_1.expect)(snapshot.secretFields).toContain("providers.*.connection.apiKey");
});
(0, bun_test_1.test)("config v3 save/load roundtrip preserves an omitted output limit", function () { return __awaiter(void 0, void 0, void 0, function () {
    var dir, path, config, loaded;
    var _a, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-config-v3-"))];
            case 1:
                dir = _c.sent();
                _c.label = 2;
            case 2:
                _c.trys.push([2, , 5, 7]);
                path = (0, node_path_1.join)(dir, "config.json");
                config = configuredConfig();
                return [4 /*yield*/, (0, file_1.saveConfigFile)(config, path)];
            case 3:
                _c.sent();
                return [4 /*yield*/, (0, file_1.loadConfigFile)(path)];
            case 4:
                loaded = _c.sent();
                (0, bun_test_1.expect)(loaded.config.version).toBe(3);
                (0, bun_test_1.expect)((_b = (_a = loaded.config.catalog.providers.openai) === null || _a === void 0 ? void 0 : _a.models["test-model"]) === null || _b === void 0 ? void 0 : _b.limits.maxOutputTokens).toBeUndefined();
                (0, bun_test_1.expect)(loaded.summary.changed).toEqual([]);
                return [3 /*break*/, 7];
            case 5: return [4 /*yield*/, (0, promises_1.rm)(dir, { recursive: true, force: true })];
            case 6:
                _c.sent();
                return [7 /*endfinally*/];
            case 7: return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("config save atomically replaces the target without leaving temporary files", function () { return __awaiter(void 0, void 0, void 0, function () {
    var dir, path, _a, _b, _c, _d;
    return __generator(this, function (_e) {
        switch (_e.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-config-atomic-"))];
            case 1:
                dir = _e.sent();
                _e.label = 2;
            case 2:
                _e.trys.push([2, , 7, 9]);
                path = (0, node_path_1.join)(dir, "config.json");
                return [4 /*yield*/, (0, promises_1.writeFile)(path, '{"old":true}\n')];
            case 3:
                _e.sent();
                return [4 /*yield*/, (0, file_1.saveConfigFile)(configuredConfig(), path)];
            case 4:
                _e.sent();
                _a = bun_test_1.expect;
                _c = (_b = JSON).parse;
                return [4 /*yield*/, (0, promises_1.readFile)(path, "utf8")];
            case 5:
                _a.apply(void 0, [_c.apply(_b, [_e.sent()])]).toMatchObject({
                    version: 3,
                });
                _d = bun_test_1.expect;
                return [4 /*yield*/, (0, promises_1.readdir)(dir)];
            case 6:
                _d.apply(void 0, [(_e.sent()).filter(function (name) { return name.includes(".tmp-"); }).length]).toBe(0);
                return [3 /*break*/, 9];
            case 7: return [4 /*yield*/, (0, promises_1.rm)(dir, { recursive: true, force: true })];
            case 8:
                _e.sent();
                return [7 /*endfinally*/];
            case 9: return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("versioned migration registry applies steps and reports unsupported versions", function () { return __awaiter(void 0, void 0, void 0, function () {
    var registry, migrated, unsupported;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                registry = new registry_1.VersionedMigrationRegistry(2);
                registry.register({
                    id: "legacy-to-v1",
                    fromVersion: "legacy",
                    toVersion: 1,
                    apply: function (input) { return (__assign(__assign({}, input), { version: 1, value: "".concat(input.value, ":v1") })); },
                });
                registry.register({
                    id: "v1-to-v2",
                    fromVersion: 1,
                    toVersion: 2,
                    apply: function (input) { return (__assign(__assign({}, input), { version: 2, value: "".concat(input.value, ":v2") })); },
                });
                return [4 /*yield*/, registry.migrate({
                        fromVersion: "legacy",
                        value: { version: 0, value: "start" },
                    })];
            case 1:
                migrated = _a.sent();
                (0, bun_test_1.expect)(migrated.applied).toEqual(["legacy-to-v1", "v1-to-v2"]);
                (0, bun_test_1.expect)(migrated.value).toEqual({ version: 2, value: "start:v1:v2" });
                return [4 /*yield*/, registry.migrate({
                        fromVersion: 99,
                        value: { version: 99, value: "old" },
                    })];
            case 2:
                unsupported = _a.sent();
                (0, bun_test_1.expect)(unsupported.diagnostics[0]).toMatchObject({
                    code: "migration.unsupported_version",
                    supported: false,
                });
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("TS config settings store creates a schema-valid config when absent", function () { return __awaiter(void 0, void 0, void 0, function () {
    var dir, result, _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-config-create-"))];
            case 1:
                dir = _b.sent();
                _b.label = 2;
            case 2:
                _b.trys.push([2, , 5, 7]);
                return [4 /*yield*/, (0, file_2.loadOrCreateConfigFile)((0, node_path_1.join)(dir, "config.json"))];
            case 3:
                result = _b.sent();
                (0, bun_test_1.expect)(result.config.version).toBe(3);
                (0, bun_test_1.expect)(result.config.defaultModel).toBeNull();
                (0, bun_test_1.expect)(result.summary.changed).toContain("created default TS config");
                _a = bun_test_1.expect;
                return [4 /*yield*/, (0, promises_1.readFile)((0, node_path_1.join)(dir, "config.json"), "utf8")];
            case 4:
                _a.apply(void 0, [_b.sent()]).toContain('"version": 3');
                return [3 /*break*/, 7];
            case 5: return [4 /*yield*/, (0, promises_1.rm)(dir, { recursive: true, force: true })];
            case 6:
                _b.sent();
                return [7 /*endfinally*/];
            case 7: return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("layered config reads model settings only from the global scope", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, globalPath, projectPath, resolved;
    var _a, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-config-layered-"))];
            case 1:
                root = _c.sent();
                globalPath = (0, node_path_1.join)(root, "global.json");
                projectPath = (0, node_path_1.join)(root, ".natalia", "config.json");
                _c.label = 2;
            case 2:
                _c.trys.push([2, , 7, 9]);
                return [4 /*yield*/, (0, promises_1.mkdir)((0, node_path_1.join)(root, ".natalia"), { recursive: true })];
            case 3:
                _c.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)(globalPath, JSON.stringify({
                        version: 3,
                        providers: {
                            openai: {
                                name: "OpenAI",
                                driver: "openai-compatible",
                                connection: { apiKey: "global-key" },
                                requestDefaults: { stream: false },
                            },
                        },
                        catalog: {
                            providers: {
                                openai: { models: { "gpt-test": { name: "gpt-test" } } },
                            },
                        },
                        modelOverrides: {
                            "openai/gpt-test": { requestDefaults: { temperature: 0.7 } },
                        },
                        defaultModel: { provider: "openai", model: "gpt-test" },
                    }))];
            case 4:
                _c.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)(projectPath, JSON.stringify({
                        version: 3,
                        providers: {
                            openai: {
                                name: "OpenAI Project",
                                connection: { baseURL: "https://project.example/v1" },
                            },
                        },
                        modelOverrides: {
                            "openai/gpt-test": { requestDefaults: { temperature: 0.2 } },
                        },
                        context: { compactionThresholdPercent: 90 },
                    }))];
            case 5:
                _c.sent();
                return [4 /*yield*/, (0, service_1.resolveConfig)({ workspaceRoot: root, globalPath: globalPath })];
            case 6:
                resolved = _c.sent();
                // Project model settings are legacy data and cannot override the global
                // provider, catalog, override, or default model.
                (0, bun_test_1.expect)(resolved.config.providers.openai).toMatchObject({
                    name: "OpenAI",
                    connection: {
                        apiKey: "global-key",
                    },
                    requestDefaults: { stream: false },
                });
                (0, bun_test_1.expect)((_a = resolved.config.catalog.providers.openai) === null || _a === void 0 ? void 0 : _a.models["gpt-test"]).toMatchObject({ name: "gpt-test" });
                (0, bun_test_1.expect)(resolved.config.modelOverrides["openai/gpt-test"]).toMatchObject({
                    requestDefaults: { temperature: 0.7 },
                });
                (0, bun_test_1.expect)(resolved.config.defaultModel).toEqual({
                    provider: "openai",
                    model: "gpt-test",
                });
                (0, bun_test_1.expect)(resolved.config.context.compactionEnabled).toBe(true);
                (0, bun_test_1.expect)(resolved.config.context.compactionThresholdPercent).toBe(90);
                (0, bun_test_1.expect)(resolved.sources.filter(function (source) { return source.applied; })).toHaveLength(3);
                (0, bun_test_1.expect)((_b = resolved.sources.find(function (source) { return source.scope === "project"; })) === null || _b === void 0 ? void 0 : _b.diagnostic).toContain("ignored global-only settings");
                return [3 /*break*/, 9];
            case 7: return [4 /*yield*/, (0, promises_1.rm)(root, { recursive: true, force: true })];
            case 8:
                _c.sent();
                return [7 /*endfinally*/];
            case 9: return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("layered config isolates an invalid source and retains valid sources", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, globalPath, resolved;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-config-invalid-source-"))];
            case 1:
                root = _a.sent();
                globalPath = (0, node_path_1.join)(root, "global.json");
                _a.label = 2;
            case 2:
                _a.trys.push([2, , 7, 9]);
                return [4 /*yield*/, (0, promises_1.mkdir)((0, node_path_1.join)(root, ".natalia"), { recursive: true })];
            case 3:
                _a.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)(globalPath, "{ not json")];
            case 4:
                _a.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(root, ".natalia", "config.json"), JSON.stringify({
                        version: 3,
                        context: { compactionThresholdPercent: 91 },
                    }))];
            case 5:
                _a.sent();
                return [4 /*yield*/, (0, service_1.resolveConfig)({ workspaceRoot: root, globalPath: globalPath })];
            case 6:
                resolved = _a.sent();
                (0, bun_test_1.expect)(resolved.config.context.compactionThresholdPercent).toBe(91);
                // The rejected source names the reason, so the operator can find the
                // offending file content instead of only learning that something failed.
                (0, bun_test_1.expect)(resolved.sources).toContainEqual({
                    scope: "global",
                    path: globalPath,
                    applied: false,
                    diagnostic: bun_test_1.expect.stringContaining("invalid_config: JSON Parse error"),
                });
                return [3 /*break*/, 9];
            case 7: return [4 /*yield*/, (0, promises_1.rm)(root, { recursive: true, force: true })];
            case 8:
                _a.sent();
                return [7 /*endfinally*/];
            case 9: return [2 /*return*/];
        }
    });
}); });
