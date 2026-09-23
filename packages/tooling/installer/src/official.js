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
exports.OFFICIAL_PLUGIN_PACKAGES = void 0;
exports.resolveOfficialPluginPackage = resolveOfficialPluginPackage;
exports.initializeOfficialPlugins = initializeOfficialPlugins;
exports.reinstallOfficialPlugin = reinstallOfficialPlugin;
var promises_1 = require("node:fs/promises");
var node_path_1 = require("node:path");
var closure_1 = require("./closure");
var lifecycle_1 = require("./lifecycle");
exports.OFFICIAL_PLUGIN_PACKAGES = [
    {
        id: "natalia-local-tools",
        packageName: "@natalia/plugin-local-tools",
        directory: "natalia-local-tools",
    },
    {
        id: "natalia-file-editor",
        packageName: "@natalia/plugin-file-editor",
        directory: "natalia-file-editor",
    },
    {
        id: "natalia-pending-inbox",
        packageName: "@natalia/plugin-pending-inbox",
        directory: "natalia-pending-inbox",
    },
    {
        id: "natalia-browser",
        packageName: "@natalia/plugin-browser",
        directory: "natalia-browser",
    },
    {
        id: "natalia-skills",
        packageName: "@natalia/plugin-skills",
        directory: "natalia-skills",
    },
    {
        id: "natalia-team",
        packageName: "@natalia/plugin-team",
        directory: "natalia-team",
    },
    {
        id: "natalia-mcp",
        packageName: "@natalia/plugin-mcp",
        directory: "natalia-mcp",
    },
    {
        id: "natalia-tool-ask",
        packageName: "@natalia/plugin-tool-ask",
        directory: "natalia-tool-ask",
    },
    {
        id: "natalia-tool-fs-read",
        packageName: "@natalia/plugin-tool-fs-read",
        directory: "natalia-tool-fs-read",
    },
    {
        id: "natalia-tool-fs-write",
        packageName: "@natalia/plugin-tool-fs-write",
        directory: "natalia-tool-fs-write",
    },
    {
        id: "natalia-tool-process",
        packageName: "@natalia/plugin-tool-process",
        directory: "natalia-tool-process",
    },
    {
        id: "natalia-tool-search",
        packageName: "@natalia/plugin-tool-search",
        directory: "natalia-tool-search",
    },
    {
        id: "natalia-tool-shell",
        packageName: "@natalia/plugin-tool-shell",
        directory: "natalia-tool-shell",
    },
    {
        id: "natalia-tool-terminal",
        packageName: "@natalia/plugin-native-terminal",
        directory: "natalia-tool-terminal",
    },
    {
        id: "natalia-tool-todo",
        packageName: "@natalia/plugin-tool-todo",
        directory: "natalia-tool-todo",
    },
    {
        id: "natalia-tool-web",
        packageName: "@natalia/plugin-tool-web",
        directory: "natalia-tool-web",
    },
];
var initializationMarker = "official-plugins-initialized-v1";
function resolveOfficialPluginPackage(distributionRoot, pluginID) {
    return __awaiter(this, void 0, void 0, function () {
        var entry, root, packageDirectory, pathFromRoot, _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    entry = exports.OFFICIAL_PLUGIN_PACKAGES.find(function (_a) {
                        var id = _a.id;
                        return id === pluginID;
                    });
                    if (!entry)
                        throw new Error("unknown official plugin: ".concat(pluginID));
                    return [4 /*yield*/, (0, promises_1.realpath)((0, node_path_1.resolve)(distributionRoot))];
                case 1:
                    root = _b.sent();
                    return [4 /*yield*/, (0, promises_1.realpath)((0, node_path_1.join)(root, entry.directory)).catch(function (error) {
                            if (error.code === "ENOENT")
                                throw new Error("official plugin package is missing from distribution: ".concat(pluginID));
                            throw error;
                        })];
                case 2:
                    packageDirectory = _b.sent();
                    pathFromRoot = (0, node_path_1.relative)(root, packageDirectory);
                    _a = pathFromRoot === ".." ||
                        pathFromRoot.startsWith("..".concat(node_path_1.sep));
                    if (_a) return [3 /*break*/, 4];
                    return [4 /*yield*/, (0, promises_1.stat)(packageDirectory)];
                case 3:
                    _a = (_b.sent()).isDirectory() === false;
                    _b.label = 4;
                case 4:
                    if (_a)
                        throw new Error("official plugin package escapes distribution: ".concat(pluginID));
                    return [2 /*return*/, packageDirectory];
            }
        });
    });
}
function initializeOfficialPlugins(input) {
    return __awaiter(this, void 0, void 0, function () {
        var _this = this;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, closure_1.withStoreLock)(input.pluginStoreRoot, "official-initialization", function () { return __awaiter(_this, void 0, void 0, function () {
                        var marker, installed, _i, _a, pluginID, _b, _c, _d;
                        var _e;
                        var _f, _g, _h;
                        return __generator(this, function (_j) {
                            switch (_j.label) {
                                case 0:
                                    marker = (0, node_path_1.join)((0, node_path_1.resolve)(input.pluginStoreRoot), initializationMarker);
                                    return [4 /*yield*/, fileExists(marker)];
                                case 1:
                                    if (_j.sent())
                                        return [2 /*return*/, { initialized: false, installed: [] }];
                                    installed = [];
                                    _i = 0, _a = (_f = input.pluginIDs) !== null && _f !== void 0 ? _f : exports.OFFICIAL_PLUGIN_PACKAGES.map(function (_a) {
                                        var id = _a.id;
                                        return id;
                                    });
                                    _j.label = 2;
                                case 2:
                                    if (!(_i < _a.length)) return [3 /*break*/, 6];
                                    pluginID = _a[_i];
                                    _c = (_b = installed).push;
                                    _d = ((_h = (_g = input.seams) === null || _g === void 0 ? void 0 : _g.installPlugin) !== null && _h !== void 0 ? _h : lifecycle_1.installPlugin);
                                    _e = {
                                        pluginStoreRoot: input.pluginStoreRoot
                                    };
                                    return [4 /*yield*/, resolveOfficialPluginPackage(input.distributionRoot, pluginID)];
                                case 3: return [4 /*yield*/, _d.apply(void 0, [(_e.spec = _j.sent(),
                                            _e.runPackageManager = input.runPackageManager,
                                            _e)])];
                                case 4:
                                    _c.apply(_b, [_j.sent()]);
                                    _j.label = 5;
                                case 5:
                                    _i++;
                                    return [3 /*break*/, 2];
                                case 6: return [4 /*yield*/, writeInitializationMarker(marker)];
                                case 7:
                                    _j.sent();
                                    return [2 /*return*/, { initialized: true, installed: installed }];
                            }
                        });
                    }); })];
                case 1: return [2 /*return*/, _a.sent()];
            }
        });
    });
}
function reinstallOfficialPlugin(input) {
    return __awaiter(this, void 0, void 0, function () {
        var _a;
        var _b;
        var _c, _d;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    _a = ((_d = (_c = input.seams) === null || _c === void 0 ? void 0 : _c.installPlugin) !== null && _d !== void 0 ? _d : lifecycle_1.installPlugin);
                    _b = {
                        pluginStoreRoot: input.pluginStoreRoot
                    };
                    return [4 /*yield*/, resolveOfficialPluginPackage(input.distributionRoot, input.pluginID)];
                case 1: return [4 /*yield*/, _a.apply(void 0, [(_b.spec = _e.sent(),
                            _b.runPackageManager = input.runPackageManager,
                            _b)])];
                case 2: return [2 /*return*/, _e.sent()];
            }
        });
    });
}
function fileExists(path) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, promises_1.readFile)(path)
                        .then(function () { return true; })
                        .catch(function (error) {
                        if (error.code === "ENOENT")
                            return false;
                        throw error;
                    })];
                case 1: return [2 /*return*/, _a.sent()];
            }
        });
    });
}
function writeInitializationMarker(path) {
    return __awaiter(this, void 0, void 0, function () {
        var temporary;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, promises_1.mkdir)((0, node_path_1.dirname)(path), { recursive: true, mode: 448 })];
                case 1:
                    _a.sent();
                    temporary = "".concat(path, ".").concat(process.pid);
                    _a.label = 2;
                case 2:
                    _a.trys.push([2, , 5, 7]);
                    return [4 /*yield*/, (0, promises_1.writeFile)(temporary, "initialized\n", { mode: 384 })];
                case 3:
                    _a.sent();
                    return [4 /*yield*/, (0, promises_1.rename)(temporary, path)];
                case 4:
                    _a.sent();
                    return [3 /*break*/, 7];
                case 5: return [4 /*yield*/, (0, promises_1.rm)(temporary, { force: true }).catch(function () { return undefined; })];
                case 6:
                    _a.sent();
                    return [7 /*endfinally*/];
                case 7: return [2 /*return*/];
            }
        });
    });
}
