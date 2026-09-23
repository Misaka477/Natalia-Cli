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
exports.serialized = serialized;
exports.installPlugin = installPlugin;
exports.setPluginEnabled = setPluginEnabled;
exports.uninstallPlugin = uninstallPlugin;
var promises_1 = require("node:fs/promises");
var node_path_1 = require("node:path");
var config_1 = require("@natalia/config");
var closure_1 = require("./closure");
var package_metadata_1 = require("./package-metadata");
var package_metadata_2 = require("./package-metadata");
var workspaceOperations = new Map();
function serialized(pluginStoreRoot, operation) {
    return __awaiter(this, void 0, void 0, function () {
        var key, previous, result, pending;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, (0, promises_1.mkdir)((0, node_path_1.resolve)(pluginStoreRoot), { recursive: true, mode: 448 })];
                case 1:
                    _b.sent();
                    return [4 /*yield*/, (0, promises_1.realpath)((0, node_path_1.resolve)(pluginStoreRoot))];
                case 2:
                    key = _b.sent();
                    previous = (_a = workspaceOperations.get(key)) !== null && _a !== void 0 ? _a : Promise.resolve();
                    result = previous
                        .catch(function () { return undefined; })
                        .then(function () { return (0, closure_1.withStoreLock)(key, "operation", operation); });
                    pending = result.then(function () { return undefined; }, function () { return undefined; });
                    workspaceOperations.set(key, pending);
                    return [4 /*yield*/, result.finally(function () {
                            if (workspaceOperations.get(key) === pending)
                                workspaceOperations.delete(key);
                        })];
                case 3: return [2 /*return*/, _b.sent()];
            }
        });
    });
}
function installPlugin(input) {
    return __awaiter(this, void 0, void 0, function () {
        var _this = this;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, serialized(input.pluginStoreRoot, function () { return __awaiter(_this, void 0, void 0, function () {
                        var paths, run, _a, beforeLock, beforeDependencies, afterDependencies, packageName, installed, lock, error_1, afterDependencies_1, extras, _i, extras_1, packageName, _b;
                        var _c;
                        var _d, _e, _f, _g, _h;
                        return __generator(this, function (_j) {
                            switch (_j.label) {
                                case 0:
                                    paths = (0, closure_1.pluginClosurePaths)(input.pluginStoreRoot);
                                    run = (_d = input.runPackageManager) !== null && _d !== void 0 ? _d : closure_1.runNpm;
                                    return [4 /*yield*/, Promise.all([
                                            (0, closure_1.loadNataliaLock)(input.pluginStoreRoot),
                                            (0, closure_1.closureDependencies)(paths.pluginsDir),
                                        ])];
                                case 1:
                                    _a = _j.sent(), beforeLock = _a[0], beforeDependencies = _a[1];
                                    _j.label = 2;
                                case 2:
                                    _j.trys.push([2, 9, , 17]);
                                    return [4 /*yield*/, run({
                                            cwd: input.pluginStoreRoot,
                                            args: (0, closure_1.npmInstallArgs)(paths.pluginsDir, input.spec),
                                        })];
                                case 3:
                                    _j.sent();
                                    return [4 /*yield*/, (0, closure_1.closureDependencies)(paths.pluginsDir)];
                                case 4:
                                    afterDependencies = _j.sent();
                                    packageName = resolveInstalledPackageName({
                                        spec: input.spec,
                                        beforeDependencies: beforeDependencies,
                                        afterDependencies: afterDependencies,
                                        lock: beforeLock,
                                    });
                                    return [4 /*yield*/, (0, package_metadata_1.validateStagedPackage)(paths.pluginsDir, input.spec, packageName)];
                                case 5:
                                    installed = _j.sent();
                                    assertPackageOwnership(beforeLock, installed.packageName, installed.manifest.id);
                                    lock = structuredClone(beforeLock);
                                    lock.plugins[installed.manifest.id] = {
                                        packageName: installed.packageName,
                                        manifest: (0, node_path_1.join)((0, closure_1.packageDirectory)(paths.pluginsDir, installed.packageName), installed.relativeManifest),
                                        metadata: installed.metadata,
                                    };
                                    return [4 /*yield*/, ((_f = (_e = input.seams) === null || _e === void 0 ? void 0 : _e.saveLock) !== null && _f !== void 0 ? _f : closure_1.saveNataliaLock)(input.pluginStoreRoot, lock)];
                                case 6:
                                    _j.sent();
                                    if (!input.workspaceRoot) return [3 /*break*/, 8];
                                    return [4 /*yield*/, ((_h = (_g = input.seams) === null || _g === void 0 ? void 0 : _g.updateConfig) !== null && _h !== void 0 ? _h : config_1.updateConfig)(input.workspaceRoot, {
                                            plugins: { enabled: (_c = {}, _c[installed.manifest.id] = true, _c) },
                                        }, input.config)];
                                case 7:
                                    _j.sent();
                                    _j.label = 8;
                                case 8: return [2 /*return*/, __assign({ installed: true, pluginID: installed.manifest.id, packageName: installed.packageName, metadata: installed.metadata }, (input.workspaceRoot
                                        ? { enabled: true, workspaceRoot: input.workspaceRoot }
                                        : {}))];
                                case 9:
                                    error_1 = _j.sent();
                                    return [4 /*yield*/, (0, closure_1.closureDependencies)(paths.pluginsDir)];
                                case 10:
                                    afterDependencies_1 = _j.sent();
                                    extras = Object.keys(afterDependencies_1).filter(function (name) { return beforeDependencies[name] !== afterDependencies_1[name]; });
                                    _i = 0, extras_1 = extras;
                                    _j.label = 11;
                                case 11:
                                    if (!(_i < extras_1.length)) return [3 /*break*/, 16];
                                    packageName = extras_1[_i];
                                    _j.label = 12;
                                case 12:
                                    _j.trys.push([12, 14, , 15]);
                                    return [4 /*yield*/, run({
                                            cwd: input.pluginStoreRoot,
                                            args: (0, closure_1.npmUninstallArgs)(paths.pluginsDir, packageName),
                                        })];
                                case 13:
                                    _j.sent();
                                    return [3 /*break*/, 15];
                                case 14:
                                    _b = _j.sent();
                                    return [3 /*break*/, 15];
                                case 15:
                                    _i++;
                                    return [3 /*break*/, 11];
                                case 16: throw error_1;
                                case 17: return [2 /*return*/];
                            }
                        });
                    }); })];
                case 1: return [2 /*return*/, _a.sent()];
            }
        });
    });
}
function setPluginEnabled(input) {
    return __awaiter(this, void 0, void 0, function () {
        var _this = this;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, serialized(input.pluginStoreRoot, function () { return __awaiter(_this, void 0, void 0, function () {
                        var lock;
                        var _a;
                        var _b, _c, _d;
                        return __generator(this, function (_e) {
                            switch (_e.label) {
                                case 0: return [4 /*yield*/, (0, closure_1.loadNataliaLock)(input.pluginStoreRoot)];
                                case 1:
                                    lock = _e.sent();
                                    if (!lock.plugins[input.pluginID])
                                        throw new Error("unknown plugin: ".concat(input.pluginID));
                                    return [4 /*yield*/, ((_c = (_b = input.seams) === null || _b === void 0 ? void 0 : _b.updateConfig) !== null && _c !== void 0 ? _c : config_1.updateConfig)(input.workspaceRoot, {
                                            plugins: { enabled: (_a = {}, _a[input.pluginID] = input.enabled, _a) },
                                        }, input.config)];
                                case 2:
                                    _e.sent();
                                    return [4 /*yield*/, ((_d = input.apply) === null || _d === void 0 ? void 0 : _d.call(input))];
                                case 3:
                                    _e.sent();
                                    return [2 /*return*/, { pluginID: input.pluginID, enabled: input.enabled }];
                            }
                        });
                    }); })];
                case 1: return [2 /*return*/, _a.sent()];
            }
        });
    });
}
function uninstallPlugin(input) {
    return __awaiter(this, void 0, void 0, function () {
        var _this = this;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, serialized(input.pluginStoreRoot, function () { return __awaiter(_this, void 0, void 0, function () {
                        var lock, installed, paths;
                        var _a, _b, _c;
                        return __generator(this, function (_d) {
                            switch (_d.label) {
                                case 0: return [4 /*yield*/, (0, closure_1.loadNataliaLock)(input.pluginStoreRoot)];
                                case 1:
                                    lock = _d.sent();
                                    installed = lock.plugins[input.pluginID];
                                    if (!installed)
                                        throw new Error("unknown plugin: ".concat(input.pluginID));
                                    paths = (0, closure_1.pluginClosurePaths)(input.pluginStoreRoot);
                                    return [4 /*yield*/, ((_a = input.runPackageManager) !== null && _a !== void 0 ? _a : closure_1.runNpm)({
                                            cwd: input.pluginStoreRoot,
                                            args: (0, closure_1.npmUninstallArgs)(paths.pluginsDir, installed.packageName),
                                        })];
                                case 2:
                                    _d.sent();
                                    delete lock.plugins[input.pluginID];
                                    return [4 /*yield*/, ((_c = (_b = input.seams) === null || _b === void 0 ? void 0 : _b.saveLock) !== null && _c !== void 0 ? _c : closure_1.saveNataliaLock)(input.pluginStoreRoot, lock)];
                                case 3:
                                    _d.sent();
                                    return [2 /*return*/, {
                                            uninstalled: true,
                                            pluginID: input.pluginID,
                                            disposition: "removed",
                                        }];
                            }
                        });
                    }); })];
                case 1: return [2 /*return*/, _a.sent()];
            }
        });
    });
}
function resolveInstalledPackageName(input) {
    var changed = Object.keys(input.afterDependencies).filter(function (name) { return input.beforeDependencies[name] !== input.afterDependencies[name]; });
    if (changed.length === 1)
        return changed[0];
    var source = (0, package_metadata_2.packageSource)(input.spec);
    if (source.type === "registry") {
        var packageName = registryPackageName(source.spec);
        if (packageName && input.afterDependencies[packageName])
            return packageName;
    }
    var locked = Object.values(input.lock.plugins).filter(function (entry) { return (0, package_metadata_2.sourceSpec)(entry.metadata.source) === (0, package_metadata_2.sourceSpec)(source); });
    if (changed.length === 0 && locked.length === 1)
        return locked[0].packageName;
    if (changed.length === 0 && Object.keys(input.afterDependencies).length === 1)
        return Object.keys(input.afterDependencies)[0];
    throw new Error("plugin install must change exactly one direct dependency; found ".concat(changed.length));
}
function registryPackageName(spec) {
    var _a;
    var match = /^(?<name>@[^/]+\/[^@]+|[^@/][^@]*)?(?:@.*)?$/u.exec(spec);
    return (_a = match === null || match === void 0 ? void 0 : match.groups) === null || _a === void 0 ? void 0 : _a.name;
}
function assertPackageOwnership(lock, packageName, pluginID) {
    var idOwner = lock.plugins[pluginID];
    if (idOwner && idOwner.packageName !== packageName)
        throw new Error("plugin id ".concat(pluginID, " is already owned by package ").concat(idOwner.packageName));
    var packageOwner = Object.entries(lock.plugins).find(function (_a) {
        var entry = _a[1];
        return entry.packageName === packageName;
    });
    if (packageOwner && packageOwner[0] !== pluginID)
        throw new Error("package ".concat(packageName, " is already installed as plugin ").concat(packageOwner[0], "; changing plugin id to ").concat(pluginID, " is not supported"));
}
