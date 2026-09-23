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
exports.useWorkspaceCleanup = useWorkspaceCleanup;
exports.registerTestArtifact = registerTestArtifact;
exports.officialPluginWorkspace = officialPluginWorkspace;
exports.createOfficialRuntimeClient = createOfficialRuntimeClient;
exports.officialPluginStoreRoot = officialPluginStoreRoot;
exports.installFixturePlugin = installFixturePlugin;
exports.restoreOfficialPluginConfig = restoreOfficialPluginConfig;
exports.installPluginSdkLinks = installPluginSdkLinks;
exports.pluginSdkImportPath = pluginSdkImportPath;
var promises_1 = require("node:fs/promises");
var bun_test_1 = require("bun:test");
var node_fs_1 = require("node:fs");
var node_path_1 = require("node:path");
var node_url_1 = require("node:url");
var installer_1 = require("@natalia/installer");
var src_1 = require("../src");
var plugin_1 = require("@natalia/plugin");
var officialPluginDistribution = (0, node_path_1.resolve)("dist", "ts", "plugins");
var officialPluginTestWorkspaces = (0, node_path_1.resolve)("dist", "ts", "client-test-workspaces");
var officialPluginConfigFixture = "official-plugin-config.test.json";
var officialPluginStoreSuffix = "-plugin-store";
var testWorkspaces = new Set();
var allWorkspaces = new Set();
var trackedClients = new Set();
/**
 * Registers this test file's workspace cleanup.
 *
 * Every test file that creates workspaces through this helper MUST call this
 * once at module scope. A module-scope `afterEach` inside an imported helper
 * only attaches to the first file that loads the module in a bun process
 * (probe: two files sharing one helper leave the second file's workspaces
 * behind), so the hooks have to be registered from the test file itself.
 *
 * The dispose-then-remove order is load-bearing: an undisposed runtime client
 * keeps async session persistence alive, and its next flush does
 * `mkdir(<workspace>/.natalia/sessions, { recursive: true })` — recreating the
 * workspace directory seconds after the removal, which is how a fully green
 * suite still left ~60 directories per run. Disposing first lands the flush
 * inside the workspace while it still exists, so the removal sticks.
 *
 * The one bounded settle lives in the afterAll pass rather than per test: a
 * child execution (a subagent's checkpoint journal) can write one file after
 * the parent dispose returns, so every workspace gets one re-removal after a
 * short delay — once per file instead of once per test, which keeps the suite
 * from paying hundreds of sleeps. The consequence of getting any of this
 * wrong is not a dirty directory: one leaked workspace per test filled the
 * disk until every verify failed with ENOSPC (95,927 leftovers exhausted
 * btrfs metadata). The test-workspace hygiene guard at the end of `npm test`
 * fails loudly on any residue, so a forgotten call cannot pass silently.
 */
function useWorkspaceCleanup() {
    var _this = this;
    (0, bun_test_1.afterEach)(function () { return __awaiter(_this, void 0, void 0, function () {
        var clients, _i, clients_1, client, _a, workspaces;
        var _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    clients = __spreadArray([], trackedClients, true);
                    trackedClients.clear();
                    _i = 0, clients_1 = clients;
                    _c.label = 1;
                case 1:
                    if (!(_i < clients_1.length)) return [3 /*break*/, 6];
                    client = clients_1[_i];
                    _c.label = 2;
                case 2:
                    _c.trys.push([2, 4, , 5]);
                    return [4 /*yield*/, ((_b = client.dispose) === null || _b === void 0 ? void 0 : _b.call(client))];
                case 3:
                    _c.sent();
                    return [3 /*break*/, 5];
                case 4:
                    _a = _c.sent();
                    return [3 /*break*/, 5];
                case 5:
                    _i++;
                    return [3 /*break*/, 1];
                case 6:
                    workspaces = __spreadArray([], testWorkspaces, true);
                    testWorkspaces.clear();
                    return [4 /*yield*/, Promise.all(workspaces.map(function (workspace) {
                            return (0, promises_1.rm)(workspace, { recursive: true, force: true });
                        }))];
                case 7:
                    _c.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    (0, bun_test_1.afterAll)(function () { return __awaiter(_this, void 0, void 0, function () {
        var pass, remaining, _i, allWorkspaces_1, workspace;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    pass = 0;
                    _a.label = 1;
                case 1:
                    if (!(pass < 8)) return [3 /*break*/, 5];
                    if (!(pass > 0)) return [3 /*break*/, 3];
                    return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 250); })];
                case 2:
                    _a.sent();
                    _a.label = 3;
                case 3:
                    remaining = 0;
                    for (_i = 0, allWorkspaces_1 = allWorkspaces; _i < allWorkspaces_1.length; _i++) {
                        workspace = allWorkspaces_1[_i];
                        try {
                            (0, node_fs_1.rmSync)(workspace, { recursive: true, force: true });
                            if ((0, node_fs_1.existsSync)(workspace))
                                remaining++;
                        }
                        catch (_b) {
                            remaining++;
                        }
                    }
                    if (remaining === 0)
                        return [3 /*break*/, 5];
                    _a.label = 4;
                case 4:
                    pass++;
                    return [3 /*break*/, 1];
                case 5:
                    allWorkspaces.clear();
                    return [2 /*return*/];
            }
        });
    }); });
}
/**
 * Registers a path outside `officialPluginWorkspace` for the same per-file
 * sweep — for artifacts a test derives from its workspace (e.g. the governance
 * ledger root real-runtime.test.ts points at a sibling directory). Unregistered
 * artifacts accumulate exactly like leaked workspaces did.
 */
function registerTestArtifact(path) {
    allWorkspaces.add(path);
}
function officialPluginWorkspace(prefix) {
    return __awaiter(this, void 0, void 0, function () {
        var workspaceRoot, pluginStoreRoot, configPath, _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, assertOfficialPluginDistribution()];
                case 1:
                    _c.sent();
                    return [4 /*yield*/, (0, promises_1.mkdir)(officialPluginTestWorkspaces, { recursive: true })];
                case 2:
                    _c.sent();
                    return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)(officialPluginTestWorkspaces, (0, node_path_1.basename)(prefix)))];
                case 3:
                    workspaceRoot = _c.sent();
                    testWorkspaces.add(workspaceRoot);
                    pluginStoreRoot = officialPluginStoreRoot(workspaceRoot);
                    testWorkspaces.add(pluginStoreRoot);
                    allWorkspaces.add(workspaceRoot);
                    allWorkspaces.add(pluginStoreRoot);
                    return [4 /*yield*/, (0, installer_1.initializeOfficialPlugins)({
                            pluginStoreRoot: pluginStoreRoot,
                            distributionRoot: officialPluginDistribution,
                            runPackageManager: installPrebuiltPackage,
                        })];
                case 4:
                    _c.sent();
                    configPath = (0, node_path_1.join)(workspaceRoot, ".natalia", "config.json");
                    return [4 /*yield*/, (0, promises_1.mkdir)((0, node_path_1.join)(workspaceRoot, ".natalia"), { recursive: true })];
                case 5:
                    _c.sent();
                    return [4 /*yield*/, (0, promises_1.writeFile)(configPath, JSON.stringify({ version: 3 }))];
                case 6:
                    _c.sent();
                    _a = promises_1.writeFile;
                    _b = [(0, node_path_1.join)(workspaceRoot, ".natalia", officialPluginConfigFixture)];
                    return [4 /*yield*/, (0, promises_1.readFile)(configPath)];
                case 7: return [4 /*yield*/, _a.apply(void 0, _b.concat([_c.sent()]))];
                case 8:
                    _c.sent();
                    return [2 /*return*/, workspaceRoot];
            }
        });
    });
}
function createOfficialRuntimeClient(options) {
    var _this = this;
    var _a, _b, _c, _d, _e;
    if (options === void 0) { options = {}; }
    restoreOfficialPluginConfig((_a = options.workspaceRoot) !== null && _a !== void 0 ? _a : process.cwd());
    var capabilityRegistry = options.capabilityRegistry;
    var client = (0, src_1.createRealRuntimeClient)(__assign(__assign(__assign({}, options), { pluginStoreRoot: (_b = options.pluginStoreRoot) !== null && _b !== void 0 ? _b : officialPluginStoreRoot((_c = options.workspaceRoot) !== null && _c !== void 0 ? _c : process.cwd()) }), (capabilityRegistry ? { capabilityRegistry: capabilityRegistry } : {})));
    var reloadConfig = (_d = client.reloadConfig) === null || _d === void 0 ? void 0 : _d.bind(client);
    if (reloadConfig)
        client.reloadConfig = function () { return __awaiter(_this, void 0, void 0, function () {
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        restoreOfficialPluginConfig((_a = options.workspaceRoot) !== null && _a !== void 0 ? _a : process.cwd());
                        return [4 /*yield*/, reloadConfig()];
                    case 1: return [2 /*return*/, _b.sent()];
                }
            });
        }); };
    var dispose = (_e = client.dispose) === null || _e === void 0 ? void 0 : _e.bind(client);
    if (dispose)
        client.dispose = function () { return __awaiter(_this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, dispose()];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); };
    // Tracked so `useWorkspaceCleanup()` can dispose before removing the
    // workspace — otherwise the runtime's deferred session flush recreates the
    // directory after removal (see the hook's doc comment).
    trackedClients.add(client);
    return client;
}
function officialPluginStoreRoot(workspaceRoot) {
    return "".concat(workspaceRoot).concat(officialPluginStoreSuffix);
}
function installFixturePlugin(workspaceRoot, sourceRoot) {
    return __awaiter(this, void 0, void 0, function () {
        var manifest, _a, _b, _c, _d, pluginStoreRoot, packageName, packageRoot, manifestPath, lockPath, lock;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    _b = (_a = plugin_1.pluginManifestSchema).parse;
                    _d = (_c = JSON).parse;
                    return [4 /*yield*/, (0, promises_1.readFile)((0, node_path_1.join)(sourceRoot, "natalia.plugin.json"), "utf8")];
                case 1:
                    manifest = _b.apply(_a, [_d.apply(_c, [_e.sent()])]);
                    pluginStoreRoot = officialPluginStoreRoot(workspaceRoot);
                    packageName = "fixture-".concat(manifest.id);
                    packageRoot = (0, node_path_1.join)(pluginStoreRoot, "node_modules", packageName);
                    return [4 /*yield*/, (0, promises_1.rm)(packageRoot, { recursive: true, force: true })];
                case 2:
                    _e.sent();
                    return [4 /*yield*/, (0, promises_1.mkdir)((0, node_path_1.dirname)(packageRoot), { recursive: true })];
                case 3:
                    _e.sent();
                    return [4 /*yield*/, (0, promises_1.cp)(sourceRoot, packageRoot, { recursive: true })];
                case 4:
                    _e.sent();
                    manifestPath = (0, node_path_1.join)(packageRoot, "natalia.plugin.json");
                    lockPath = (0, node_path_1.join)(pluginStoreRoot, "natalia.lock");
                    return [4 /*yield*/, readJSONFile(lockPath, { version: 1, plugins: {} })];
                case 5:
                    lock = _e.sent();
                    lock.plugins[manifest.id] = {
                        packageName: packageName,
                        manifest: manifestPath,
                        metadata: {
                            id: manifest.id,
                            source: { type: "path", path: sourceRoot },
                            resolvedVersion: manifest.version,
                            scope: manifest.scope,
                            dependencies: [],
                        },
                    };
                    return [4 /*yield*/, (0, promises_1.writeFile)(lockPath, JSON.stringify(lock))];
                case 6:
                    _e.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function restoreOfficialPluginConfig(workspaceRoot) {
    var _a, _b, _c, _d;
    var fixturePath = (0, node_path_1.join)(workspaceRoot, ".natalia", officialPluginConfigFixture);
    if (!(0, node_fs_1.existsSync)(fixturePath))
        return;
    var configPath = (0, node_path_1.join)(workspaceRoot, ".natalia", "config.json");
    try {
        var fixture = JSON.parse((0, node_fs_1.readFileSync)(fixturePath, "utf8"));
        var current = (0, node_fs_1.existsSync)(configPath)
            ? JSON.parse((0, node_fs_1.readFileSync)(configPath, "utf8"))
            : {};
        current.plugins = __assign(__assign(__assign({}, fixture.plugins), current.plugins), { enabled: __assign(__assign({}, (_a = fixture.plugins) === null || _a === void 0 ? void 0 : _a.enabled), (_b = current.plugins) === null || _b === void 0 ? void 0 : _b.enabled), packages: __assign(__assign({}, (_c = fixture.plugins) === null || _c === void 0 ? void 0 : _c.packages), (_d = current.plugins) === null || _d === void 0 ? void 0 : _d.packages) });
        (0, node_fs_1.writeFileSync)(configPath, JSON.stringify(current));
    }
    catch (_e) {
        // Invalid config is intentional in rollback and diagnostic tests.
    }
}
function assertOfficialPluginDistribution() {
    return __awaiter(this, void 0, void 0, function () {
        var _i, OFFICIAL_PLUGIN_PACKAGES_1, directory, manifest, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _i = 0, OFFICIAL_PLUGIN_PACKAGES_1 = installer_1.OFFICIAL_PLUGIN_PACKAGES;
                    _a.label = 1;
                case 1:
                    if (!(_i < OFFICIAL_PLUGIN_PACKAGES_1.length)) return [3 /*break*/, 6];
                    directory = OFFICIAL_PLUGIN_PACKAGES_1[_i].directory;
                    manifest = (0, node_path_1.join)(officialPluginDistribution, directory, "natalia.plugin.json");
                    _a.label = 2;
                case 2:
                    _a.trys.push([2, 4, , 5]);
                    return [4 /*yield*/, (0, promises_1.readFile)(manifest)];
                case 3:
                    _a.sent();
                    return [3 /*break*/, 5];
                case 4:
                    error_1 = _a.sent();
                    if (error_1.code === "ENOENT")
                        throw new Error("framework client tests require prebuilt official plugins at ".concat(officialPluginDistribution, "; run ts:build first (missing ").concat(manifest, ")"));
                    throw error_1;
                case 5:
                    _i++;
                    return [3 /*break*/, 1];
                case 6: return [2 /*return*/];
            }
        });
    });
}
var installPrebuiltPackage = function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
    var prefix, source, packageJSON, _c, _d, target, _i, _e, file, destination, sourcePath, dependencies, lockPath, packages;
    var _f;
    var args = _b.args;
    return __generator(this, function (_g) {
        switch (_g.label) {
            case 0:
                if (args[0] !== "install")
                    throw new Error("unsupported test package-manager operation: ".concat(args[0]));
                prefix = args[args.indexOf("--prefix") + 1];
                source = args.at(-1);
                if (!prefix || !source)
                    throw new Error("invalid test package-manager install arguments");
                _d = (_c = JSON).parse;
                return [4 /*yield*/, (0, promises_1.readFile)((0, node_path_1.join)(source, "package.json"), "utf8")];
            case 1:
                packageJSON = _d.apply(_c, [_g.sent()]);
                target = node_path_1.join.apply(void 0, __spreadArray([prefix, "node_modules"], packageJSON.name.split("/"), false));
                return [4 /*yield*/, (0, promises_1.mkdir)(target, { recursive: true })];
            case 2:
                _g.sent();
                _i = 0, _e = new Set(__spreadArray([
                    "package.json",
                    "natalia.plugin.json"
                ], ((_f = packageJSON.files) !== null && _f !== void 0 ? _f : []), true));
                _g.label = 3;
            case 3:
                if (!(_i < _e.length)) return [3 /*break*/, 10];
                file = _e[_i];
                // Native executable packaging is verified by the release lifecycle test.
                // Framework tests need the plugin module, not a 165 MB copy per workspace.
                if (file === "wezterm")
                    return [3 /*break*/, 9];
                destination = (0, node_path_1.join)(target, file);
                return [4 /*yield*/, (0, promises_1.mkdir)((0, node_path_1.dirname)(destination), { recursive: true })];
            case 4:
                _g.sent();
                sourcePath = (0, node_path_1.join)(source, file);
                return [4 /*yield*/, (0, promises_1.stat)(sourcePath)];
            case 5:
                if (!(_g.sent()).isDirectory()) return [3 /*break*/, 7];
                return [4 /*yield*/, (0, promises_1.cp)(sourcePath, destination, { recursive: true })];
            case 6:
                _g.sent();
                return [3 /*break*/, 9];
            case 7: return [4 /*yield*/, (0, promises_1.link)(sourcePath, destination)];
            case 8:
                _g.sent();
                _g.label = 9;
            case 9:
                _i++;
                return [3 /*break*/, 3];
            case 10: return [4 /*yield*/, readJSON((0, node_path_1.join)(prefix, "package.json"), "dependencies")];
            case 11:
                dependencies = _g.sent();
                dependencies[packageJSON.name] = packageJSON.version;
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(prefix, "package.json"), JSON.stringify({ dependencies: dependencies }))];
            case 12:
                _g.sent();
                lockPath = (0, node_path_1.join)(prefix, "package-lock.json");
                return [4 /*yield*/, readJSON(lockPath, "packages")];
            case 13:
                packages = _g.sent();
                packages["node_modules/".concat(packageJSON.name)] = {
                    version: packageJSON.version,
                };
                return [4 /*yield*/, (0, promises_1.writeFile)(lockPath, JSON.stringify({ lockfileVersion: 3, packages: packages }))];
            case 14:
                _g.sent();
                return [2 /*return*/];
        }
    });
}); };
function readJSON(path, key) {
    return __awaiter(this, void 0, void 0, function () {
        var value, _a, _b, error_2;
        var _c;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    _d.trys.push([0, 2, , 3]);
                    _b = (_a = JSON).parse;
                    return [4 /*yield*/, (0, promises_1.readFile)(path, "utf8")];
                case 1:
                    value = _b.apply(_a, [_d.sent()]);
                    return [2 /*return*/, (_c = value[key]) !== null && _c !== void 0 ? _c : {}];
                case 2:
                    error_2 = _d.sent();
                    if (error_2.code === "ENOENT")
                        return [2 /*return*/, {}];
                    throw error_2;
                case 3: return [2 /*return*/];
            }
        });
    });
}
function readJSONFile(path, fallback) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, _b, error_3;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    _c.trys.push([0, 2, , 3]);
                    _b = (_a = JSON).parse;
                    return [4 /*yield*/, (0, promises_1.readFile)(path, "utf8")];
                case 1: return [2 /*return*/, _b.apply(_a, [_c.sent()])];
                case 2:
                    error_3 = _c.sent();
                    if (error_3.code === "ENOENT")
                        return [2 /*return*/, fallback];
                    throw error_3;
                case 3: return [2 /*return*/];
            }
        });
    });
}
/**
 * Test helper: makes `@natalia/*` resolvable from a plugin workspace outside
 * the repo (bun resolves bare specifiers by walking up from the importing
 * file, and `/tmp` workspaces have no bun.lock/workspace context). Real
 * deployments must provide the same resolution — see the plugin guide's
 * dependency-resolution note.
 */
function installPluginSdkLinks(root) {
    return __awaiter(this, void 0, void 0, function () {
        var scoped, _i, _a, pkg, target, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    scoped = (0, node_path_1.join)(root, "node_modules", "@natalia");
                    return [4 /*yield*/, (0, promises_1.mkdir)(scoped, { recursive: true })];
                case 1:
                    _c.sent();
                    _i = 0, _a = ["plugin", "contracts"];
                    _c.label = 2;
                case 2:
                    if (!(_i < _a.length)) return [3 /*break*/, 8];
                    pkg = _a[_i];
                    target = (0, node_path_1.join)(scoped, pkg);
                    _c.label = 3;
                case 3:
                    _c.trys.push([3, 5, , 7]);
                    return [4 /*yield*/, (0, promises_1.symlink)((0, node_path_1.join)(process.cwd(), "packages", pkg), target, "dir")];
                case 4:
                    _c.sent();
                    return [3 /*break*/, 7];
                case 5:
                    _b = _c.sent();
                    // Windows without Developer Mode cannot create directory symlinks, and a
                    // hard failure here would mask the plugin-loading behaviour under test.
                    // A copy resolves identically inside the test process. The packages'
                    // own node_modules links (bun junctions) cannot be copied either, so
                    // they are excluded: `@natalia/contracts` resolves from the sibling
                    // copy, and anything else resolves up through the repository root.
                    return [4 /*yield*/, (0, promises_1.cp)((0, node_path_1.join)(process.cwd(), "packages", pkg), target, {
                            recursive: true,
                            filter: function (source) { return !source.includes("".concat(node_path_1.sep, "node_modules").concat(node_path_1.sep)); },
                        })];
                case 6:
                    // Windows without Developer Mode cannot create directory symlinks, and a
                    // hard failure here would mask the plugin-loading behaviour under test.
                    // A copy resolves identically inside the test process. The packages'
                    // own node_modules links (bun junctions) cannot be copied either, so
                    // they are excluded: `@natalia/contracts` resolves from the sibling
                    // copy, and anything else resolves up through the repository root.
                    _c.sent();
                    return [3 /*break*/, 7];
                case 7:
                    _i++;
                    return [3 /*break*/, 2];
                case 8: return [2 /*return*/];
            }
        });
    });
}
/**
 * The plugin SDK entry as a file URL for plugin test fixtures. Bare-specifier
 * resolution from a /tmp workspace is unreliable inside a test process that
 * has already resolved the specifier from the repo (bun caches resolution by
 * context), so fixtures import the SDK by absolute URL. A Windows drive path
 * must be a file URL: bun parses a raw `E:\...` import specifier as an
 * unix-style path and mangles the drive letter.
 */
function pluginSdkImportPath() {
    return (0, node_url_1.pathToFileURL)((0, node_path_1.join)(process.cwd(), "packages", "core", "plugin", "src", "index.ts")).href;
}
