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
exports.runNpm = void 0;
exports.pluginClosurePaths = pluginClosurePaths;
exports.snapshotFile = snapshotFile;
exports.restoreFile = restoreFile;
exports.rollbackWith = rollbackWith;
exports.loadNataliaLock = loadNataliaLock;
exports.saveNataliaLock = saveNataliaLock;
exports.withStoreLock = withStoreLock;
exports.npmInstallArgs = npmInstallArgs;
exports.npmUninstallArgs = npmUninstallArgs;
exports.closureDependencies = closureDependencies;
exports.packageDirectory = packageDirectory;
exports.readPackageRecord = readPackageRecord;
var node_crypto_1 = require("node:crypto");
var promises_1 = require("node:fs/promises");
var node_path_1 = require("node:path");
var contracts_1 = require("@natalia/contracts");
function pluginClosurePaths(pluginStoreRoot) {
    var storeRoot = (0, node_path_1.resolve)(pluginStoreRoot);
    return {
        storeRoot: storeRoot,
        pluginsDir: storeRoot,
        lockPath: (0, node_path_1.join)(storeRoot, "natalia.lock"),
    };
}
function snapshotFile(path) {
    return __awaiter(this, void 0, void 0, function () {
        var error_1;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 2, , 3]);
                    _a = { path: path };
                    return [4 /*yield*/, (0, promises_1.readFile)(path)];
                case 1: return [2 /*return*/, (_a.contents = _b.sent(), _a)];
                case 2:
                    error_1 = _b.sent();
                    if (error_1.code === "ENOENT")
                        return [2 /*return*/, { path: path }];
                    throw error_1;
                case 3: return [2 /*return*/];
            }
        });
    });
}
function restoreFile(snapshot) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!!snapshot.contents) return [3 /*break*/, 2];
                    return [4 /*yield*/, (0, promises_1.rm)(snapshot.path, { force: true })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
                case 2: return [4 /*yield*/, (0, promises_1.mkdir)((0, node_path_1.dirname)(snapshot.path), { recursive: true, mode: 448 })];
                case 3:
                    _a.sent();
                    return [4 /*yield*/, (0, promises_1.writeFile)(snapshot.path, snapshot.contents, { mode: 384 })];
                case 4:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function rollbackWith(originalError, restorations) {
    return __awaiter(this, void 0, void 0, function () {
        var errors, _i, restorations_1, restore, error_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    errors = [originalError];
                    _i = 0, restorations_1 = restorations;
                    _a.label = 1;
                case 1:
                    if (!(_i < restorations_1.length)) return [3 /*break*/, 6];
                    restore = restorations_1[_i];
                    _a.label = 2;
                case 2:
                    _a.trys.push([2, 4, , 5]);
                    return [4 /*yield*/, restore()];
                case 3:
                    _a.sent();
                    return [3 /*break*/, 5];
                case 4:
                    error_2 = _a.sent();
                    errors.push(error_2);
                    return [3 /*break*/, 5];
                case 5:
                    _i++;
                    return [3 /*break*/, 1];
                case 6:
                    if (errors.length > 1)
                        throw new AggregateError(errors, "plugin transaction rollback failed");
                    throw originalError;
            }
        });
    });
}
function loadNataliaLock(pluginStoreRoot) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, _b, _c, _d, error_3;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    _e.trys.push([0, 2, , 3]);
                    _b = (_a = contracts_1.nataliaLockSchema).parse;
                    _d = (_c = JSON).parse;
                    return [4 /*yield*/, (0, promises_1.readFile)(pluginClosurePaths(pluginStoreRoot).lockPath, "utf8")];
                case 1: return [2 /*return*/, _b.apply(_a, [_d.apply(_c, [_e.sent()])])];
                case 2:
                    error_3 = _e.sent();
                    if (error_3.code === "ENOENT")
                        return [2 /*return*/, { version: 1, plugins: {} }];
                    throw error_3;
                case 3: return [2 /*return*/];
            }
        });
    });
}
function saveNataliaLock(pluginStoreRoot, lock) {
    return __awaiter(this, void 0, void 0, function () {
        var parsed, lockPath, temporary;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    parsed = contracts_1.nataliaLockSchema.parse(lock);
                    lockPath = pluginClosurePaths(pluginStoreRoot).lockPath;
                    return [4 /*yield*/, (0, promises_1.mkdir)((0, node_path_1.dirname)(lockPath), { recursive: true, mode: 448 })];
                case 1:
                    _a.sent();
                    temporary = "".concat(lockPath, ".tmp-").concat((0, node_crypto_1.randomUUID)());
                    _a.label = 2;
                case 2:
                    _a.trys.push([2, , 5, 7]);
                    return [4 /*yield*/, (0, promises_1.writeFile)(temporary, "".concat(JSON.stringify(parsed, null, 2), "\n"), {
                            mode: 384,
                        })];
                case 3:
                    _a.sent();
                    return [4 /*yield*/, (0, promises_1.rename)(temporary, lockPath)];
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
function withStoreLock(pluginStoreRoot, name, operation) {
    return __awaiter(this, void 0, void 0, function () {
        var lockDirectory, error_4;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    lockDirectory = (0, node_path_1.join)((0, node_path_1.resolve)(pluginStoreRoot), ".".concat(name, ".lock"));
                    return [4 /*yield*/, (0, promises_1.mkdir)((0, node_path_1.resolve)(pluginStoreRoot), { recursive: true, mode: 448 })];
                case 1:
                    _a.sent();
                    _a.label = 2;
                case 2:
                    _a.trys.push([2, 5, , 10]);
                    return [4 /*yield*/, (0, promises_1.mkdir)(lockDirectory, { mode: 448 })];
                case 3:
                    _a.sent();
                    return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(lockDirectory, "owner.json"), JSON.stringify({ pid: process.pid }), { mode: 384 })];
                case 4:
                    _a.sent();
                    return [3 /*break*/, 11];
                case 5:
                    error_4 = _a.sent();
                    if (error_4.code !== "EEXIST")
                        throw error_4;
                    return [4 /*yield*/, lockOwnerIsDead(lockDirectory)];
                case 6:
                    if (!_a.sent()) return [3 /*break*/, 8];
                    return [4 /*yield*/, (0, promises_1.rm)(lockDirectory, { recursive: true, force: true })];
                case 7:
                    _a.sent();
                    return [3 /*break*/, 10];
                case 8: return [4 /*yield*/, new Promise(function (resolveWait) { return setTimeout(resolveWait, 25); })];
                case 9:
                    _a.sent();
                    return [3 /*break*/, 10];
                case 10: return [3 /*break*/, 2];
                case 11:
                    _a.trys.push([11, , 13, 15]);
                    return [4 /*yield*/, operation()];
                case 12: return [2 /*return*/, _a.sent()];
                case 13: return [4 /*yield*/, (0, promises_1.rm)(lockDirectory, { recursive: true, force: true })];
                case 14:
                    _a.sent();
                    return [7 /*endfinally*/];
                case 15: return [2 /*return*/];
            }
        });
    });
}
function lockOwnerIsDead(lockDirectory) {
    return __awaiter(this, void 0, void 0, function () {
        var owner, _a, _b, error_5;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    _c.trys.push([0, 4, , 6]);
                    _b = (_a = JSON).parse;
                    return [4 /*yield*/, (0, promises_1.readFile)((0, node_path_1.join)(lockDirectory, "owner.json"), "utf8")];
                case 1:
                    owner = _b.apply(_a, [_c.sent()]);
                    if (!(!Number.isInteger(owner.pid) || owner.pid <= 0)) return [3 /*break*/, 3];
                    return [4 /*yield*/, invalidLockIsStale(lockDirectory)];
                case 2: return [2 /*return*/, _c.sent()];
                case 3:
                    try {
                        process.kill(owner.pid, 0);
                        return [2 /*return*/, false];
                    }
                    catch (error) {
                        return [2 /*return*/, error.code === "ESRCH"];
                    }
                    return [3 /*break*/, 6];
                case 4:
                    error_5 = _c.sent();
                    if (error_5.code === "ENOENT")
                        return [2 /*return*/, false];
                    return [4 /*yield*/, invalidLockIsStale(lockDirectory)];
                case 5: return [2 /*return*/, _c.sent()];
                case 6: return [2 /*return*/];
            }
        });
    });
}
function invalidLockIsStale(lockDirectory) {
    return __awaiter(this, void 0, void 0, function () {
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _a = Date.now();
                    return [4 /*yield*/, (0, promises_1.stat)(lockDirectory)];
                case 1: return [2 /*return*/, _a - (_b.sent()).mtimeMs > 30000];
            }
        });
    });
}
var runNpm = function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
    var child, _c, exitCode, stdout, stderr;
    var args = _b.args, cwd = _b.cwd;
    return __generator(this, function (_d) {
        switch (_d.label) {
            case 0:
                child = Bun.spawn(__spreadArray(["npm"], args, true), {
                    cwd: cwd,
                    stdout: "pipe",
                    stderr: "pipe",
                });
                return [4 /*yield*/, Promise.all([
                        child.exited,
                        new Response(child.stdout).text(),
                        new Response(child.stderr).text(),
                    ])];
            case 1:
                _c = _d.sent(), exitCode = _c[0], stdout = _c[1], stderr = _c[2];
                if (exitCode !== 0)
                    throw new Error("npm ".concat(args.join(" "), " failed: ").concat((stderr || stdout).trim()));
                return [2 /*return*/];
        }
    });
}); };
exports.runNpm = runNpm;
function npmInstallArgs(prefix, spec) {
    return [
        "install",
        "--no-audit",
        "--no-fund",
        "--ignore-scripts",
        "--install-links",
        "--save-exact",
        "--prefix",
        prefix,
        spec,
    ];
}
function npmUninstallArgs(prefix, packageName) {
    return [
        "uninstall",
        "--no-audit",
        "--no-fund",
        "--ignore-scripts",
        "--prefix",
        prefix,
        packageName,
    ];
}
function closureDependencies(prefix) {
    return __awaiter(this, void 0, void 0, function () {
        var value, _a, _b, error_6;
        var _c;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    _d.trys.push([0, 2, , 3]);
                    _b = (_a = JSON).parse;
                    return [4 /*yield*/, (0, promises_1.readFile)((0, node_path_1.join)(prefix, "package.json"), "utf8")];
                case 1:
                    value = _b.apply(_a, [_d.sent()]);
                    return [2 /*return*/, (_c = value.dependencies) !== null && _c !== void 0 ? _c : {}];
                case 2:
                    error_6 = _d.sent();
                    if (error_6.code === "ENOENT")
                        return [2 /*return*/, {}];
                    throw error_6;
                case 3: return [2 /*return*/];
            }
        });
    });
}
function packageDirectory(prefix, packageName) {
    return node_path_1.join.apply(void 0, __spreadArray([prefix, "node_modules"], packageName.split("/"), false));
}
function readPackageRecord(prefix, packageName) {
    return __awaiter(this, void 0, void 0, function () {
        var lock, _a, _b;
        var _c;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    _b = (_a = JSON).parse;
                    return [4 /*yield*/, (0, promises_1.readFile)((0, node_path_1.join)(prefix, "package-lock.json"), "utf8")];
                case 1:
                    lock = _b.apply(_a, [_d.sent()]);
                    return [2 /*return*/, (_c = lock.packages) === null || _c === void 0 ? void 0 : _c["node_modules/".concat(packageName)]];
            }
        });
    });
}
