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
exports.WorkspaceSandboxManager = void 0;
exports.containPath = containPath;
exports.isSecretEnvKey = isSecretEnvKey;
var promises_1 = require("node:fs/promises");
var node_path_1 = require("node:path");
var platform_1 = require("@natalia/platform");
var WorkspaceSandboxManager = /** @class */ (function () {
    function WorkspaceSandboxManager(baseRoot) {
        this.baseRoot = baseRoot;
        this.sandboxes = new Map();
        this.resources = new Map();
    }
    WorkspaceSandboxManager.prototype.initialize = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!this.initialized)
                            this.initialized = this.load();
                        return [4 /*yield*/, this.initialized];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    WorkspaceSandboxManager.prototype.create = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            var root, manifest;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.initialize()];
                    case 1:
                        _a.sent();
                        root = (0, node_path_1.resolve)(this.baseRoot, id);
                        return [4 /*yield*/, (0, promises_1.mkdir)(root, { recursive: true })];
                    case 2:
                        _a.sent();
                        manifest = {
                            id: id,
                            root: root,
                            isolationLevel: "workspace",
                            changedFiles: [],
                            runningResources: [],
                            envAllowlist: ["PATH", "HOME", "LANG", "TERM"],
                        };
                        this.sandboxes.set(id, manifest);
                        return [4 /*yield*/, this.persist(manifest)];
                    case 3:
                        _a.sent();
                        return [2 /*return*/, manifest];
                }
            });
        });
    };
    WorkspaceSandboxManager.prototype.list = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.initialize()];
                    case 1:
                        _a.sent();
                        return [2 /*return*/, __spreadArray([], this.sandboxes.values(), true).map(function (manifest) { return (__assign(__assign({}, manifest), { changedFiles: manifest.changedFiles.map(function (change) { return (__assign({}, change)); }), runningResources: __spreadArray([], manifest.runningResources, true), envAllowlist: __spreadArray([], manifest.envAllowlist, true) })); })];
                }
            });
        });
    };
    WorkspaceSandboxManager.prototype.target = function (id) {
        var manifest = this.mustGet(id);
        return {
            kind: "sandbox",
            sandboxID: id,
            root: manifest.root,
            isolationLevel: manifest.isolationLevel,
        };
    };
    WorkspaceSandboxManager.prototype.environment = function (allowlist, source) {
        if (source === void 0) { source = process.env; }
        var env = {};
        for (var _i = 0, allowlist_1 = allowlist; _i < allowlist_1.length; _i++) {
            var key = allowlist_1[_i];
            var value = source[key];
            if (value !== undefined && !isSecretEnvKey(key))
                env[key] = value;
        }
        return env;
    };
    WorkspaceSandboxManager.prototype.execute = function (id_1, command_1) {
        return __awaiter(this, arguments, void 0, function (id, command, options) {
            var manifest, shell, process, abort, _a, stdout, stderr, exitCode;
            var _b, _c;
            if (options === void 0) { options = {}; }
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        manifest = this.mustGet(id);
                        shell = (0, platform_1.profileShellCommand)(command);
                        process = Bun.spawn(__spreadArray([shell.executable], shell.args, true), {
                            cwd: manifest.root,
                            stdin: "ignore",
                            stdout: "pipe",
                            stderr: "pipe",
                            env: this.environment(manifest.envAllowlist, options.env),
                        });
                        abort = function () { return process.kill("SIGTERM"); };
                        (_b = options.signal) === null || _b === void 0 ? void 0 : _b.addEventListener("abort", abort, { once: true });
                        return [4 /*yield*/, Promise.all([
                                new Response(process.stdout).text(),
                                new Response(process.stderr).text(),
                                process.exited,
                            ])];
                    case 1:
                        _a = _d.sent(), stdout = _a[0], stderr = _a[1], exitCode = _a[2];
                        (_c = options.signal) === null || _c === void 0 ? void 0 : _c.removeEventListener("abort", abort);
                        return [2 /*return*/, { exitCode: exitCode, output: "".concat(stdout).concat(stderr), target: this.target(id) }];
                }
            });
        });
    };
    WorkspaceSandboxManager.prototype.startResource = function (id, command, resourceID) {
        return __awaiter(this, void 0, void 0, function () {
            var manifest, finalID, outputPath, pid, resource;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.initialize()];
                    case 1:
                        _a.sent();
                        manifest = this.mustGet(id);
                        finalID = resourceID !== null && resourceID !== void 0 ? resourceID : "sbx_".concat(id, "_").concat(manifest.runningResources.length + 1);
                        if (this.resources.has(finalID))
                            throw new Error("sandbox resource already exists: ".concat(finalID));
                        outputPath = (0, node_path_1.resolve)(manifest.root, ".natalia", "resources", "".concat(finalID, ".log"));
                        return [4 /*yield*/, (0, promises_1.mkdir)((0, node_path_1.dirname)(outputPath), { recursive: true, mode: 448 })];
                    case 2:
                        _a.sent();
                        return [4 /*yield*/, (0, platform_1.startDetachedProcess)({
                                command: command,
                                posixScript: "bash -c ".concat((0, platform_1.shellQuote)(command), " > ").concat((0, platform_1.shellQuote)(outputPath), " 2>&1 & echo $!"),
                                cwd: manifest.root,
                                outputPath: outputPath,
                                env: this.environment(manifest.envAllowlist),
                            })];
                    case 3:
                        pid = (_a.sent()).pid;
                        resource = {
                            id: finalID,
                            sandboxID: id,
                            command: command,
                            pid: pid,
                            status: "running",
                            outputPath: outputPath,
                            startedAt: new Date().toISOString(),
                        };
                        this.resources.set(finalID, resource);
                        manifest.runningResources.push(finalID);
                        return [4 /*yield*/, this.persist(manifest)];
                    case 4:
                        _a.sent();
                        return [2 /*return*/, __assign({}, resource)];
                }
            });
        });
    };
    WorkspaceSandboxManager.prototype.resourcesFor = function (id) {
        var _this = this;
        var manifest = this.mustGet(id);
        return manifest.runningResources
            .map(function (resourceID) { return _this.refreshResource(_this.resources.get(resourceID)); })
            .filter(function (resource) { return resource !== undefined; });
    };
    WorkspaceSandboxManager.prototype.runningResourceCount = function () {
        var _this = this;
        return __spreadArray([], this.resources.values(), true).filter(function (resource) { var _a; return ((_a = _this.refreshResource(resource)) === null || _a === void 0 ? void 0 : _a.status) === "running"; }).length;
    };
    WorkspaceSandboxManager.prototype.close = function () {
        return __awaiter(this, void 0, void 0, function () {
            var errors, _i, _a, manifest, _b, _c, resourceID, error_1;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        if (!this.initialized)
                            return [2 /*return*/];
                        return [4 /*yield*/, this.initialized];
                    case 1:
                        _d.sent();
                        errors = [];
                        _i = 0, _a = this.sandboxes.values();
                        _d.label = 2;
                    case 2:
                        if (!(_i < _a.length)) return [3 /*break*/, 9];
                        manifest = _a[_i];
                        _b = 0, _c = __spreadArray([], manifest.runningResources, true);
                        _d.label = 3;
                    case 3:
                        if (!(_b < _c.length)) return [3 /*break*/, 8];
                        resourceID = _c[_b];
                        _d.label = 4;
                    case 4:
                        _d.trys.push([4, 6, , 7]);
                        return [4 /*yield*/, this.stopResource(manifest.id, resourceID)];
                    case 5:
                        _d.sent();
                        return [3 /*break*/, 7];
                    case 6:
                        error_1 = _d.sent();
                        errors.push(error_1);
                        return [3 /*break*/, 7];
                    case 7:
                        _b++;
                        return [3 /*break*/, 3];
                    case 8:
                        _i++;
                        return [3 /*break*/, 2];
                    case 9:
                        if (errors.length)
                            throw new AggregateError(errors, "sandbox resource cleanup failed");
                        return [2 /*return*/];
                }
            });
        });
    };
    WorkspaceSandboxManager.prototype.resourceOutput = function (id_1, resourceID_1) {
        return __awaiter(this, arguments, void 0, function (id, resourceID, maxBytes) {
            var resource, error_2;
            if (maxBytes === void 0) { maxBytes = 20000; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        this.mustGet(id);
                        resource = this.mustResource(resourceID);
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, (0, promises_1.readFile)(resource.outputPath, "utf8")];
                    case 2: return [2 /*return*/, (_a.sent()).slice(-maxBytes)];
                    case 3:
                        error_2 = _a.sent();
                        if (error_2.code === "ENOENT")
                            return [2 /*return*/, ""];
                        throw error_2;
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    WorkspaceSandboxManager.prototype.stopResource = function (id, resourceID) {
        return __awaiter(this, void 0, void 0, function () {
            var manifest, resource;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.initialize()];
                    case 1:
                        _a.sent();
                        manifest = this.mustGet(id);
                        resource = this.mustResource(resourceID);
                        if (resource.status === "running")
                            process.kill(resource.pid, "SIGTERM");
                        resource.status = "stopped";
                        resource.endedAt = new Date().toISOString();
                        manifest.runningResources = manifest.runningResources.filter(function (item) { return item !== resourceID; });
                        return [4 /*yield*/, this.persist(manifest)];
                    case 2:
                        _a.sent();
                        return [2 /*return*/, __assign({}, resource)];
                }
            });
        });
    };
    WorkspaceSandboxManager.prototype.write = function (id, path, content, mode) {
        return __awaiter(this, void 0, void 0, function () {
            var manifest, full;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.initialize()];
                    case 1:
                        _a.sent();
                        manifest = this.mustGet(id);
                        return [4 /*yield*/, containPath(manifest.root, path)];
                    case 2:
                        full = _a.sent();
                        return [4 /*yield*/, (0, promises_1.mkdir)((0, node_path_1.dirname)(full), { recursive: true })];
                    case 3:
                        _a.sent();
                        return [4 /*yield*/, (0, promises_1.writeFile)(full, content)];
                    case 4:
                        _a.sent();
                        this.record(id, { kind: "modify", path: path, mode: mode, content: content });
                        return [4 /*yield*/, this.persist(manifest)];
                    case 5:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    WorkspaceSandboxManager.prototype.deletePath = function (id, path) {
        return __awaiter(this, void 0, void 0, function () {
            var manifest, full;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.initialize()];
                    case 1:
                        _a.sent();
                        manifest = this.mustGet(id);
                        return [4 /*yield*/, containPath(manifest.root, path)];
                    case 2:
                        full = _a.sent();
                        return [4 /*yield*/, (0, promises_1.rm)(full, { recursive: true, force: true })];
                    case 3:
                        _a.sent();
                        this.record(id, { kind: "delete", path: path });
                        return [4 /*yield*/, this.persist(manifest)];
                    case 4:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    WorkspaceSandboxManager.prototype.renamePath = function (id, oldPath, path) {
        return __awaiter(this, void 0, void 0, function () {
            var manifest, oldFull, newFull;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.initialize()];
                    case 1:
                        _a.sent();
                        manifest = this.mustGet(id);
                        return [4 /*yield*/, containPath(manifest.root, oldPath)];
                    case 2:
                        oldFull = _a.sent();
                        return [4 /*yield*/, containPath(manifest.root, path)];
                    case 3:
                        newFull = _a.sent();
                        return [4 /*yield*/, (0, promises_1.mkdir)((0, node_path_1.dirname)(newFull), { recursive: true })];
                    case 4:
                        _a.sent();
                        return [4 /*yield*/, (0, promises_1.rename)(oldFull, newFull)];
                    case 5:
                        _a.sent();
                        this.record(id, { kind: "rename", oldPath: oldPath, path: path });
                        return [4 /*yield*/, this.persist(manifest)];
                    case 6:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    WorkspaceSandboxManager.prototype.modePath = function (id, path, mode) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.initialize()];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, containPath(this.mustGet(id).root, path)];
                    case 2:
                        _a.sent();
                        this.record(id, { kind: "mode", path: path, mode: mode });
                        return [4 /*yield*/, this.persist(this.mustGet(id))];
                    case 3:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Runs a validation command in the candidate's root — the build evidence a
     * candidate must produce before its PR is ready. Shared by every backend.
     */
    /**
     * Validates the candidate, then promotes it. Empty commands are refused so a
     * missing check cannot be mistaken for a green promote.
     */
    WorkspaceSandboxManager.prototype.promoteWithValidation = function (id, input) {
        return __awaiter(this, void 0, void 0, function () {
            var command, evidence, hostRoot, changedFiles, rollbackPoint;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        command = input.command.trim();
                        if (!command)
                            throw new Error("sandbox promote command must not be empty");
                        return [4 /*yield*/, this.validate(id, command)];
                    case 1:
                        evidence = _a.sent();
                        if (!evidence.ok)
                            throw new Error("candidate ".concat(id, " failed validation (exit ").concat(evidence.exitCode, "):\n").concat(evidence.output.slice(0, 2000)));
                        hostRoot = input.hostRoot;
                        if (!hostRoot)
                            throw new Error("sandbox promote requires hostRoot");
                        return [4 /*yield*/, this.merge(id, hostRoot, input.authorize)];
                    case 2:
                        changedFiles = _a.sent();
                        return [4 /*yield*/, this.rollbackPoint(id)];
                    case 3:
                        rollbackPoint = _a.sent();
                        return [2 /*return*/, __assign({ sandboxID: id, changedFiles: changedFiles }, (rollbackPoint ? { lastKnownGood: rollbackPoint } : {}))];
                }
            });
        });
    };
    /**
     * Undoes one sandbox's promotion, restoring the host to what it was before.
     *
     * Takes the sandbox id because that is what the caller has: an entry point
     * that reaches a rollback by sandbox id is the only shape that can be exposed
     * as a tool. `restored: false` means there was nothing to undo.
     */
    WorkspaceSandboxManager.prototype.rollback = function (_id) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, { restored: false }];
            });
        });
    };
    /**
     * A marker for the rollback point a promotion left, or undefined when it left
     * none. Backends name it differently — a commit, a backup directory — so the
     * marker is opaque and only its presence is meaningful.
     */
    WorkspaceSandboxManager.prototype.rollbackPoint = function (_id) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, undefined];
            });
        });
    };
    WorkspaceSandboxManager.prototype.validate = function (id, command) {
        return __awaiter(this, void 0, void 0, function () {
            var manifest, process, _a, stdout, stderr, exitCode;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        manifest = this.mustGet(id);
                        process = Bun.spawn(["bash", "-c", command], {
                            cwd: manifest.root,
                            stdin: "ignore",
                            stdout: "pipe",
                            stderr: "pipe",
                        });
                        return [4 /*yield*/, Promise.all([
                                new Response(process.stdout).text(),
                                new Response(process.stderr).text(),
                                process.exited,
                            ])];
                    case 1:
                        _a = _b.sent(), stdout = _a[0], stderr = _a[1], exitCode = _a[2];
                        return [2 /*return*/, { ok: exitCode === 0, exitCode: exitCode, output: "".concat(stdout).concat(stderr) }];
                }
            });
        });
    };
    WorkspaceSandboxManager.prototype.previewMerge = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            var manifest;
            return __generator(this, function (_a) {
                manifest = this.mustGet(id);
                manifest.changedFiles = classifyRenames(manifest.changedFiles);
                return [2 /*return*/, manifest.changedFiles.map(function (change) { return (__assign({}, change)); })];
            });
        });
    };
    WorkspaceSandboxManager.prototype.merge = function (id, hostRoot, authorize) {
        return __awaiter(this, void 0, void 0, function () {
            var manifest, changes, previewRevision, backups, _i, changes_1, change, target, oldTarget, _a, existing, old, source, _b, _c, error_3, _d, _e, backup;
            return __generator(this, function (_f) {
                switch (_f.label) {
                    case 0: return [4 /*yield*/, this.initialize()];
                    case 1:
                        _f.sent();
                        manifest = this.mustGet(id);
                        return [4 /*yield*/, this.previewMerge(id)];
                    case 2:
                        changes = _f.sent();
                        previewRevision = JSON.stringify(changes);
                        return [4 /*yield*/, (authorize === null || authorize === void 0 ? void 0 : authorize(mergeMutationPaths(changes)))];
                    case 3:
                        _f.sent();
                        if (JSON.stringify(manifest.changedFiles) !== previewRevision)
                            throw new Error("sandbox manifest changed during merge authorization");
                        backups = [];
                        _f.label = 4;
                    case 4:
                        _f.trys.push([4, 27, , 34]);
                        _i = 0, changes_1 = changes;
                        _f.label = 5;
                    case 5:
                        if (!(_i < changes_1.length)) return [3 /*break*/, 25];
                        change = changes_1[_i];
                        return [4 /*yield*/, containPath(hostRoot, change.path)];
                    case 6:
                        target = _f.sent();
                        if (!change.oldPath) return [3 /*break*/, 8];
                        return [4 /*yield*/, containPath(hostRoot, change.oldPath)];
                    case 7:
                        _a = _f.sent();
                        return [3 /*break*/, 9];
                    case 8:
                        _a = undefined;
                        _f.label = 9;
                    case 9:
                        oldTarget = _a;
                        return [4 /*yield*/, readOptional(target)];
                    case 10:
                        existing = _f.sent();
                        backups.push({
                            path: target,
                            content: existing,
                            existed: existing !== undefined,
                        });
                        if (!oldTarget) return [3 /*break*/, 12];
                        return [4 /*yield*/, readOptional(oldTarget)];
                    case 11:
                        old = _f.sent();
                        backups.push({
                            path: oldTarget,
                            content: old,
                            existed: old !== undefined,
                        });
                        _f.label = 12;
                    case 12:
                        if (!(change.kind === "delete")) return [3 /*break*/, 14];
                        return [4 /*yield*/, (0, platform_1.forceRemove)(target, { recursive: true })];
                    case 13:
                        _f.sent();
                        return [3 /*break*/, 24];
                    case 14:
                        if (!(change.kind === "mode")) return [3 /*break*/, 16];
                        if (!change.mode)
                            throw new Error("sandbox mode change is missing mode");
                        return [4 /*yield*/, (0, promises_1.chmod)(target, Number.parseInt(change.mode, 8))];
                    case 15:
                        _f.sent();
                        return [3 /*break*/, 24];
                    case 16: return [4 /*yield*/, (0, promises_1.mkdir)((0, node_path_1.dirname)(target), { recursive: true })];
                    case 17:
                        _f.sent();
                        return [4 /*yield*/, containPath(manifest.root, change.path)];
                    case 18:
                        source = _f.sent();
                        _b = promises_1.writeFile;
                        _c = [target];
                        return [4 /*yield*/, (0, promises_1.readFile)(source)];
                    case 19: return [4 /*yield*/, _b.apply(void 0, _c.concat([_f.sent()]))];
                    case 20:
                        _f.sent();
                        if (!change.mode) return [3 /*break*/, 22];
                        return [4 /*yield*/, (0, promises_1.chmod)(target, Number.parseInt(change.mode, 8))];
                    case 21:
                        _f.sent();
                        _f.label = 22;
                    case 22:
                        if (!oldTarget) return [3 /*break*/, 24];
                        return [4 /*yield*/, (0, platform_1.forceRemove)(oldTarget, { recursive: true })];
                    case 23:
                        _f.sent();
                        _f.label = 24;
                    case 24:
                        _i++;
                        return [3 /*break*/, 5];
                    case 25:
                        manifest.changedFiles = [];
                        return [4 /*yield*/, this.persist(manifest)];
                    case 26:
                        _f.sent();
                        return [2 /*return*/, changes];
                    case 27:
                        error_3 = _f.sent();
                        _d = 0, _e = backups.reverse();
                        _f.label = 28;
                    case 28:
                        if (!(_d < _e.length)) return [3 /*break*/, 33];
                        backup = _e[_d];
                        if (!!backup.existed) return [3 /*break*/, 30];
                        return [4 /*yield*/, (0, platform_1.forceRemove)(backup.path)];
                    case 29:
                        _f.sent();
                        return [3 /*break*/, 32];
                    case 30:
                        if (!backup.content) return [3 /*break*/, 32];
                        return [4 /*yield*/, (0, promises_1.writeFile)(backup.path, backup.content)];
                    case 31:
                        _f.sent();
                        _f.label = 32;
                    case 32:
                        _d++;
                        return [3 /*break*/, 28];
                    case 33: throw error_3;
                    case 34: return [2 /*return*/];
                }
            });
        });
    };
    WorkspaceSandboxManager.prototype.delete = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            var manifest, result, _i, _a, resourceID;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, this.initialize()];
                    case 1:
                        _b.sent();
                        manifest = this.mustGet(id);
                        result = {
                            pendingChanges: manifest.changedFiles.map(function (change) { return (__assign({}, change)); }),
                            runningResources: __spreadArray([], manifest.runningResources, true),
                        };
                        _i = 0, _a = manifest.runningResources;
                        _b.label = 2;
                    case 2:
                        if (!(_i < _a.length)) return [3 /*break*/, 5];
                        resourceID = _a[_i];
                        return [4 /*yield*/, this.stopResource(id, resourceID).catch(function () { return undefined; })];
                    case 3:
                        _b.sent();
                        _b.label = 4;
                    case 4:
                        _i++;
                        return [3 /*break*/, 2];
                    case 5:
                        this.sandboxes.delete(id);
                        return [4 /*yield*/, (0, platform_1.forceRemove)(manifest.root, { recursive: true })];
                    case 6:
                        _b.sent();
                        return [2 /*return*/, result];
                }
            });
        });
    };
    /**
     * The sandbox's status event.
     *
     * The manifest can only describe two states — has changes, has none — so a
     * caller naming a transition the manifest cannot see (a merge that was
     * previewed, landed, or conflicted) passes it explicitly. Left to the default
     * those transitions were unreportable, and `merge_previewed`/`merged`/
     * `conflicted` were vocabulary nothing could emit.
     */
    WorkspaceSandboxManager.prototype.updateEvent = function (id, status) {
        var manifest = this.mustGet(id);
        return {
            type: "sandbox.update",
            id: id,
            status: status !== null && status !== void 0 ? status : (manifest.changedFiles.length ? "changed" : "created"),
            root: manifest.root,
            isolationLevel: manifest.isolationLevel,
            changedFiles: manifest.changedFiles.length,
            runningResources: manifest.runningResources.length,
            target: this.target(id),
            resourcePolicy: "workspace isolation only; no namespace/container/VM limits",
        };
    };
    WorkspaceSandboxManager.prototype.diffEvent = function (id) {
        return { type: "sandbox.diff", id: id, changes: this.mustGet(id).changedFiles };
    };
    WorkspaceSandboxManager.prototype.auditEvent = function (id, action, approvalRequired) {
        if (approvalRequired === void 0) { approvalRequired = true; }
        return {
            type: "sandbox.audit",
            id: id,
            action: action,
            target: this.target(id),
            approvalRequired: approvalRequired,
            checkpointPolicy: "sandbox_manifest",
            message: "Sandbox is workspace isolation, not container or VM security.",
        };
    };
    WorkspaceSandboxManager.prototype.record = function (id, change) {
        var manifest = this.mustGet(id);
        manifest.changedFiles.push(change);
    };
    WorkspaceSandboxManager.prototype.load = function () {
        return __awaiter(this, void 0, void 0, function () {
            var entries, _i, entries_1, entry, state, _a, _b, manifest, _c, _d, resource, _e;
            var _f, _g;
            return __generator(this, function (_h) {
                switch (_h.label) {
                    case 0: return [4 /*yield*/, (0, promises_1.readdir)(this.baseRoot, { withFileTypes: true }).catch(function () { return []; })];
                    case 1:
                        entries = _h.sent();
                        _i = 0, entries_1 = entries;
                        _h.label = 2;
                    case 2:
                        if (!(_i < entries_1.length)) return [3 /*break*/, 8];
                        entry = entries_1[_i];
                        if (!entry.isDirectory())
                            return [3 /*break*/, 7];
                        _h.label = 3;
                    case 3:
                        _h.trys.push([3, 6, , 7]);
                        _b = (_a = JSON).parse;
                        return [4 /*yield*/, (0, promises_1.readFile)((0, node_path_1.join)(this.baseRoot, entry.name, ".natalia-manifest.json"), "utf8")];
                    case 4:
                        state = _b.apply(_a, [_h.sent()]);
                        if (!state.manifest || state.manifest.id !== entry.name)
                            return [3 /*break*/, 7];
                        manifest = __assign(__assign({}, state.manifest), { root: (0, node_path_1.resolve)(this.baseRoot, entry.name) });
                        manifest.runningResources = [];
                        this.sandboxes.set(manifest.id, manifest);
                        for (_c = 0, _d = (_f = state.resources) !== null && _f !== void 0 ? _f : []; _c < _d.length; _c++) {
                            resource = _d[_c];
                            this.resources.set(resource.id, __assign(__assign({}, resource), { sandboxID: (_g = resource.sandboxID) !== null && _g !== void 0 ? _g : manifest.id, status: resource.status === "running" ? "stopped" : resource.status, endedAt: resource.status === "running"
                                    ? new Date().toISOString()
                                    : resource.endedAt }));
                        }
                        return [4 /*yield*/, this.persist(manifest)];
                    case 5:
                        _h.sent();
                        return [3 /*break*/, 7];
                    case 6:
                        _e = _h.sent();
                        return [3 /*break*/, 7];
                    case 7:
                        _i++;
                        return [3 /*break*/, 2];
                    case 8: return [2 /*return*/];
                }
            });
        });
    };
    WorkspaceSandboxManager.prototype.persist = function (manifest) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (0, promises_1.mkdir)(manifest.root, { recursive: true, mode: 448 })];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(manifest.root, ".natalia-manifest.json"), "".concat(JSON.stringify({
                                manifest: manifest,
                                resources: __spreadArray([], this.resources.values(), true).filter(function (resource) { return resource.sandboxID === manifest.id; }),
                            }, null, 2), "\n"), { mode: 384 })];
                    case 2:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    WorkspaceSandboxManager.prototype.mustGet = function (id) {
        var manifest = this.sandboxes.get(id);
        if (!manifest)
            throw new Error("unknown sandbox: ".concat(id));
        return manifest;
    };
    WorkspaceSandboxManager.prototype.mustResource = function (id) {
        var resource = this.refreshResource(this.resources.get(id));
        if (!resource)
            throw new Error("unknown sandbox resource: ".concat(id));
        return resource;
    };
    WorkspaceSandboxManager.prototype.refreshResource = function (resource) {
        if (!resource || resource.status !== "running")
            return resource;
        try {
            process.kill(resource.pid, 0);
        }
        catch (_a) {
            resource.status = "exited";
            resource.endedAt = new Date().toISOString();
        }
        return resource;
    };
    return WorkspaceSandboxManager;
}());
exports.WorkspaceSandboxManager = WorkspaceSandboxManager;
function containPath(root, requested) {
    return __awaiter(this, void 0, void 0, function () {
        var resolvedRoot, target, rel;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if ((0, node_path_1.isAbsolute)(requested))
                        throw new Error("absolute sandbox paths are not allowed");
                    resolvedRoot = (0, node_path_1.resolve)(root);
                    target = (0, node_path_1.resolve)(resolvedRoot, requested);
                    rel = (0, node_path_1.relative)(resolvedRoot, target);
                    if (rel.startsWith("..") || (0, node_path_1.isAbsolute)(rel))
                        throw new Error("sandbox path escape blocked");
                    return [4 /*yield*/, rejectSymlinkEscape(resolvedRoot, target)];
                case 1:
                    _a.sent();
                    return [2 /*return*/, target];
            }
        });
    });
}
function isSecretEnvKey(key) {
    return /(?:TOKEN|SECRET|PASSWORD|API[_-]?KEY|AUTHORIZATION)/iu.test(key);
}
function classifyRenames(changes) {
    var normalized = [];
    for (var _i = 0, changes_2 = changes; _i < changes_2.length; _i++) {
        var change = changes_2[_i];
        if (change.kind === "rename" && change.oldPath)
            removeChangesForPath(normalized, change.oldPath);
        if (change.kind === "delete")
            removeChangesForPath(normalized, change.path);
        normalized.push(__assign({}, change));
    }
    return normalized;
}
function mergeMutationPaths(changes) {
    return __spreadArray([], new Set(changes.flatMap(function (change) {
        return change.oldPath ? [change.path, change.oldPath] : [change.path];
    })), true).sort();
}
function removeChangesForPath(changes, path) {
    for (var index = changes.length - 1; index >= 0; index--) {
        var change = changes[index];
        if (change.path === path)
            changes.splice(index, 1);
    }
}
function rejectSymlinkEscape(root, target) {
    return __awaiter(this, void 0, void 0, function () {
        var cursor, stats, real, error_4, parent_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    cursor = (0, node_path_1.dirname)(target);
                    _a.label = 1;
                case 1:
                    if (!cursor.startsWith(root)) return [3 /*break*/, 8];
                    _a.label = 2;
                case 2:
                    _a.trys.push([2, 6, , 7]);
                    return [4 /*yield*/, (0, promises_1.lstat)(cursor)];
                case 3:
                    stats = _a.sent();
                    if (!stats.isSymbolicLink()) return [3 /*break*/, 5];
                    return [4 /*yield*/, (0, promises_1.realpath)(cursor)];
                case 4:
                    real = _a.sent();
                    if (!real.startsWith(root))
                        throw new Error("sandbox symlink escape blocked");
                    _a.label = 5;
                case 5: return [3 /*break*/, 7];
                case 6:
                    error_4 = _a.sent();
                    if (error_4.code !== "ENOENT")
                        throw error_4;
                    return [3 /*break*/, 7];
                case 7:
                    parent_1 = (0, node_path_1.dirname)(cursor);
                    if (parent_1 === cursor)
                        return [3 /*break*/, 8];
                    cursor = parent_1;
                    return [3 /*break*/, 1];
                case 8: return [2 /*return*/];
            }
        });
    });
}
function readOptional(path) {
    return __awaiter(this, void 0, void 0, function () {
        var error_5;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, (0, promises_1.readFile)(path)];
                case 1: return [2 /*return*/, _a.sent()];
                case 2:
                    error_5 = _a.sent();
                    if (error_5.code === "ENOENT")
                        return [2 /*return*/, undefined];
                    throw error_5;
                case 3: return [2 /*return*/];
            }
        });
    });
}
