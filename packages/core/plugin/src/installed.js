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
exports.loadNataliaPluginLock = loadNataliaPluginLock;
exports.resolveInstalledPluginEntries = resolveInstalledPluginEntries;
exports.validatePluginPath = validatePluginPath;
var promises_1 = require("node:fs/promises");
var node_path_1 = require("node:path");
var contracts_1 = require("@natalia/contracts");
var manifest_1 = require("./manifest");
function loadNataliaPluginLock(pluginStoreRoot) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, _b, _c, _d, error_1;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    _e.trys.push([0, 2, , 3]);
                    _b = (_a = contracts_1.nataliaLockSchema).parse;
                    _d = (_c = JSON).parse;
                    return [4 /*yield*/, (0, promises_1.readFile)((0, node_path_1.join)(pluginStoreRoot, "natalia.lock"), "utf8")];
                case 1: return [2 /*return*/, _b.apply(_a, [_d.apply(_c, [_e.sent()])])];
                case 2:
                    error_1 = _e.sent();
                    if (error_1.code === "ENOENT")
                        return [2 /*return*/, { version: 1, plugins: {} }];
                    throw error_1;
                case 3: return [2 /*return*/];
            }
        });
    });
}
function resolveInstalledPluginEntries(input) {
    return __awaiter(this, void 0, void 0, function () {
        var entries, errors, lock, error_2, modulesRoot, _i, _a, _b, id, locked, packageRoot, manifestPath, _c, actualModulesRoot, actualPackageRoot, actualManifestPath, manifest, _d, _e, _f, _g, entry, _h, _j, error_3;
        var _k;
        return __generator(this, function (_l) {
            switch (_l.label) {
                case 0:
                    entries = [];
                    errors = [];
                    _l.label = 1;
                case 1:
                    _l.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, loadNataliaPluginLock(input.pluginStoreRoot)];
                case 2:
                    lock = _l.sent();
                    return [3 /*break*/, 4];
                case 3:
                    error_2 = _l.sent();
                    return [2 /*return*/, {
                            entries: entries,
                            errors: [
                                {
                                    id: "plugin-store",
                                    error: new Error("could not read natalia.lock: ".concat(error_2 instanceof Error ? error_2.message : String(error_2))),
                                },
                            ],
                        }];
                case 4:
                    modulesRoot = (0, node_path_1.resolve)(input.pluginStoreRoot, "node_modules");
                    _i = 0, _a = Object.entries(lock.plugins);
                    _l.label = 5;
                case 5:
                    if (!(_i < _a.length)) return [3 /*break*/, 12];
                    _b = _a[_i], id = _b[0], locked = _b[1];
                    if (((_k = input.enabled) === null || _k === void 0 ? void 0 : _k[id]) === false)
                        return [3 /*break*/, 11];
                    _l.label = 6;
                case 6:
                    _l.trys.push([6, 10, , 11]);
                    if (locked.metadata.id !== id)
                        throw new Error("plugin ".concat(id, " lock entry has id ").concat(locked.metadata.id));
                    if (!/^(?:@[a-z0-9_.-]+\/)?[a-z0-9_.-]+$/iu.test(locked.packageName))
                        throw new Error("plugin ".concat(id, " has invalid package name in natalia.lock"));
                    packageRoot = node_path_1.resolve.apply(void 0, __spreadArray([modulesRoot], locked.packageName.split("/"), false));
                    assertPathInside(modulesRoot, packageRoot, "plugin package path escapes closure");
                    manifestPath = (0, node_path_1.resolve)(locked.manifest);
                    assertPathInside(packageRoot, manifestPath, "plugin manifest escapes package");
                    return [4 /*yield*/, Promise.all([
                            (0, promises_1.realpath)(modulesRoot),
                            (0, promises_1.realpath)(packageRoot),
                            (0, promises_1.realpath)(manifestPath),
                        ])];
                case 7:
                    _c = _l.sent(), actualModulesRoot = _c[0], actualPackageRoot = _c[1], actualManifestPath = _c[2];
                    assertPathInside(actualModulesRoot, actualPackageRoot, "plugin package path escapes closure");
                    assertPathInside(actualPackageRoot, actualManifestPath, "plugin manifest escapes package");
                    _e = (_d = manifest_1.pluginManifestSchema).parse;
                    _g = (_f = JSON).parse;
                    return [4 /*yield*/, (0, promises_1.readFile)(actualManifestPath, "utf8")];
                case 8:
                    manifest = _e.apply(_d, [_g.apply(_f, [_l.sent()])]);
                    if (manifest.id !== id)
                        throw new Error("plugin ".concat(id, " manifest has id ").concat(manifest.id));
                    if (manifest.version !== locked.metadata.resolvedVersion)
                        throw new Error("plugin ".concat(id, " version does not match natalia.lock"));
                    if (manifest.scope !== locked.metadata.scope)
                        throw new Error("plugin ".concat(id, " scope does not match natalia.lock"));
                    entry = validatePluginPath((0, node_path_1.resolve)(actualManifestPath, ".."), manifest.entry);
                    _h = assertPathInside;
                    _j = [actualPackageRoot];
                    return [4 /*yield*/, (0, promises_1.realpath)(entry)];
                case 9:
                    _h.apply(void 0, _j.concat([_l.sent(), "plugin entry escapes package"]));
                    entries.push({ manifest: manifest, path: actualManifestPath });
                    return [3 /*break*/, 11];
                case 10:
                    error_3 = _l.sent();
                    errors.push({
                        id: id,
                        error: error_3 instanceof Error ? error_3 : new Error(String(error_3)),
                    });
                    return [3 /*break*/, 11];
                case 11:
                    _i++;
                    return [3 /*break*/, 5];
                case 12: return [2 /*return*/, { entries: entries, errors: errors }];
            }
        });
    });
}
function assertPathInside(root, candidate, message) {
    var inside = (0, node_path_1.relative)((0, node_path_1.resolve)(root), (0, node_path_1.resolve)(candidate));
    if (inside !== "" && (inside.startsWith("..") || (0, node_path_1.isAbsolute)(inside)))
        throw new Error(message);
}
function validatePluginPath(root, path) {
    var resolved = (0, node_path_1.resolve)(root, path);
    var inside = (0, node_path_1.relative)((0, node_path_1.resolve)(root), resolved);
    if (inside !== "" && (inside.startsWith("..") || (0, node_path_1.isAbsolute)(inside)))
        throw new Error("plugin path escapes root");
    if (!(0, node_path_1.isAbsolute)(resolved) ||
        ![".js", ".mjs", ".ts"].some(function (extension) { return resolved.endsWith(extension); }))
        throw new Error("plugin entry must be a local JS or TS module");
    return resolved;
}
