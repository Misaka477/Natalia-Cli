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
exports.updateConfig = updateConfig;
exports.updateGlobalConfig = updateGlobalConfig;
exports.migrateProjectModelConfigToGlobal = migrateProjectModelConfigToGlobal;
exports.updateConfigAtScope = updateConfigAtScope;
var promises_1 = require("node:fs/promises");
var node_path_1 = require("node:path");
var contracts_1 = require("@natalia/contracts");
var file_1 = require("./file");
var service_merge_1 = require("./service-merge");
var service_resolution_1 = require("./service-resolution");
function updateConfig(workspaceRoot_1, patch_1) {
    return __awaiter(this, arguments, void 0, function (workspaceRoot, patch, options) {
        if (options === void 0) { options = {}; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, updateConfigAtScope(workspaceRoot, patch, "project", options)];
                case 1: return [2 /*return*/, _a.sent()];
            }
        });
    });
}
function updateProjectConfig(workspaceRoot, patch, globalPath) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, config, projectConfigPath, projectPatch, overlay, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, (0, service_resolution_1.resolveConfig)({
                        workspaceRoot: workspaceRoot,
                        globalPath: globalPath,
                    })];
                case 1:
                    _a = _c.sent(), config = _a.config, projectConfigPath = _a.projectConfigPath;
                    projectPatch = (0, service_resolution_1.withoutGlobalModelConfig)(patch);
                    _b = service_merge_1.mergeOverlay;
                    return [4 /*yield*/, loadOverlay(projectConfigPath)];
                case 2:
                    overlay = _b.apply(void 0, [_c.sent(), projectPatch]);
                    if (!Object.keys(projectPatch).length) return [3 /*break*/, 4];
                    return [4 /*yield*/, (0, file_1.saveConfigOverlayFile)(projectConfigPath, overlay)];
                case 3:
                    _c.sent();
                    _c.label = 4;
                case 4: return [2 /*return*/, (0, service_merge_1.mergeConfig)(config, projectPatch)];
            }
        });
    });
}
function updateGlobalConfig(patch, globalPath) {
    return __awaiter(this, void 0, void 0, function () {
        var path, persisted, base, next;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    path = globalPath !== null && globalPath !== void 0 ? globalPath : (0, service_resolution_1.defaultGlobalConfigPath)();
                    return [4 /*yield*/, loadOverlay(path)];
                case 1:
                    persisted = _a.sent();
                    base = (0, service_merge_1.mergeConfig)(contracts_1.configV3Schema.parse({ version: 3 }), persisted);
                    next = (0, service_merge_1.mergeConfig)(base, patch);
                    return [4 /*yield*/, (0, file_1.saveConfigOverlayFile)(path, (0, service_merge_1.mergeOverlay)(persisted, patch))];
                case 2:
                    _a.sent();
                    return [2 /*return*/, next];
            }
        });
    });
}
function migrateProjectModelConfigToGlobal(workspaceRoot_1) {
    return __awaiter(this, arguments, void 0, function (workspaceRoot, options) {
        var projectConfigPath, project, migrated, globalPath, globalBase, _a, _b, effective, _i, migrated_1, key;
        var _c, _d;
        var _e;
        if (options === void 0) { options = {}; }
        return __generator(this, function (_f) {
            switch (_f.label) {
                case 0:
                    projectConfigPath = (0, node_path_1.resolve)(workspaceRoot, ".natalia", "config.json");
                    return [4 /*yield*/, loadOverlay(projectConfigPath)];
                case 1:
                    project = _f.sent();
                    migrated = (0, service_resolution_1.presentGlobalModelConfigKeys)(project);
                    if (!!migrated.length) return [3 /*break*/, 3];
                    _c = {
                        migrated: migrated
                    };
                    return [4 /*yield*/, (0, service_resolution_1.resolveConfig)({ workspaceRoot: workspaceRoot, globalPath: options.globalPath })];
                case 2: return [2 /*return*/, (_c.config = (_f.sent()).config,
                        _c)];
                case 3:
                    globalPath = (_e = options.globalPath) !== null && _e !== void 0 ? _e : (0, service_resolution_1.defaultGlobalConfigPath)();
                    _a = service_merge_1.mergeConfig;
                    _b = [contracts_1.configV3Schema.parse({ version: 3 })];
                    return [4 /*yield*/, loadOverlay(globalPath)];
                case 4:
                    globalBase = _a.apply(void 0, _b.concat([(_f.sent())]));
                    effective = (0, service_merge_1.mergeConfig)(globalBase, (0, service_resolution_1.onlyGlobalModelConfig)(project));
                    return [4 /*yield*/, updateGlobalConfig(Object.fromEntries(migrated.map(function (key) { return [key, effective[key]]; })), globalPath)];
                case 5:
                    _f.sent();
                    for (_i = 0, migrated_1 = migrated; _i < migrated_1.length; _i++) {
                        key = migrated_1[_i];
                        delete project[key];
                    }
                    return [4 /*yield*/, (0, file_1.saveConfigOverlayFile)(projectConfigPath, project)];
                case 6:
                    _f.sent();
                    _d = {
                        migrated: migrated
                    };
                    return [4 /*yield*/, (0, service_resolution_1.resolveConfig)({ workspaceRoot: workspaceRoot, globalPath: globalPath })];
                case 7: return [2 /*return*/, (_d.config = (_f.sent()).config,
                        _d)];
            }
        });
    });
}
function loadOverlay(path) {
    return __awaiter(this, void 0, void 0, function () {
        var raw, _a, error_1;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 2, , 3]);
                    _a = file_1.parseConfigText;
                    return [4 /*yield*/, (0, promises_1.readFile)(path, "utf8")];
                case 1:
                    raw = _a.apply(void 0, [_b.sent()]);
                    return [2 /*return*/, raw && typeof raw === "object" && !Array.isArray(raw)
                            ? raw
                            : {}];
                case 2:
                    error_1 = _b.sent();
                    if (error_1.code === "ENOENT")
                        return [2 /*return*/, {}];
                    throw error_1;
                case 3: return [2 /*return*/];
            }
        });
    });
}
function updateConfigAtScope(workspaceRoot_1, patch_1) {
    return __awaiter(this, arguments, void 0, function (workspaceRoot, patch, scope, options) {
        var globalPatch;
        if (scope === void 0) { scope = "project"; }
        if (options === void 0) { options = {}; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!(scope === "global")) return [3 /*break*/, 2];
                    return [4 /*yield*/, updateGlobalConfig(patch, options.globalPath)];
                case 1: return [2 /*return*/, _a.sent()];
                case 2:
                    globalPatch = (0, service_resolution_1.onlyGlobalModelConfig)(patch);
                    if (!Object.keys(globalPatch).length) return [3 /*break*/, 4];
                    return [4 /*yield*/, updateGlobalConfig(globalPatch, options.globalPath)];
                case 3:
                    _a.sent();
                    _a.label = 4;
                case 4: return [4 /*yield*/, updateProjectConfig(workspaceRoot, patch, options.globalPath)];
                case 5:
                    _a.sent();
                    return [4 /*yield*/, (0, service_resolution_1.resolveConfig)({ workspaceRoot: workspaceRoot, globalPath: options.globalPath })];
                case 6: return [2 /*return*/, (_a.sent()).config];
            }
        });
    });
}
