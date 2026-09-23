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
exports.createWorkspaceRuntime = createWorkspaceRuntime;
exports.collectWorkspaceGitDiff = collectWorkspaceGitDiff;
exports.parseStatusLine = parseStatusLine;
var node_crypto_1 = require("node:crypto");
var promises_1 = require("node:fs/promises");
var node_path_1 = require("node:path");
var object_store_1 = require("@natalia/object-store");
var platform_1 = require("@natalia/platform");
var contracts_1 = require("@natalia/contracts");
var plugin_workspace_resources_1 = require("./plugin-workspace-resources");
function appendWorkspaceMutation(ctx, record) {
    return __awaiter(this, void 0, void 0, function () {
        var logPath, rows, _a, _b, _c, _d;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    _e.trys.push([0, 7, , 8]);
                    logPath = (0, node_path_1.resolve)(ctx.ports.getWorkspaceRoot(), ".natalia", "workspace-mutations.json");
                    return [4 /*yield*/, (0, promises_1.mkdir)((0, node_path_1.dirname)(logPath), { recursive: true })];
                case 1:
                    _e.sent();
                    rows = [];
                    _e.label = 2;
                case 2:
                    _e.trys.push([2, 4, , 5]);
                    _b = (_a = JSON).parse;
                    return [4 /*yield*/, (0, promises_1.readFile)(logPath, "utf8")];
                case 3:
                    rows = _b.apply(_a, [_e.sent()]);
                    return [3 /*break*/, 5];
                case 4:
                    _c = _e.sent();
                    rows = [];
                    return [3 /*break*/, 5];
                case 5:
                    rows.push(record);
                    return [4 /*yield*/, (0, promises_1.writeFile)(logPath, JSON.stringify(rows, null, 2))];
                case 6:
                    _e.sent();
                    return [3 /*break*/, 8];
                case 7:
                    _d = _e.sent();
                    return [3 /*break*/, 8];
                case 8: return [2 /*return*/];
            }
        });
    });
}
function astDiffWithWorkerFallback(oldText, newText, language) {
    return __awaiter(this, void 0, void 0, function () {
        var astDiffInWorker, _a, diffWasmAst;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 3, , 5]);
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("./runtime-ast-client"); })];
                case 1:
                    astDiffInWorker = (_b.sent()).astDiffInWorker;
                    return [4 /*yield*/, astDiffInWorker(oldText, newText, language)];
                case 2: return [2 /*return*/, _b.sent()];
                case 3:
                    _a = _b.sent();
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("@natalia/diff-wasm/ast"); })];
                case 4:
                    diffWasmAst = (_b.sent()).diffWasmAst;
                    return [2 /*return*/, diffWasmAst(oldText, newText, language)];
                case 5: return [2 /*return*/];
            }
        });
    });
}
function astIndexWithWorkerFallback(source, language) {
    return __awaiter(this, void 0, void 0, function () {
        var astIndexInWorker, _a, indexWasmAst;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 3, , 5]);
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("./runtime-ast-client"); })];
                case 1:
                    astIndexInWorker = (_b.sent()).astIndexInWorker;
                    return [4 /*yield*/, astIndexInWorker(source, language)];
                case 2: return [2 /*return*/, _b.sent()];
                case 3:
                    _a = _b.sent();
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("@natalia/diff-wasm/ast"); })];
                case 4:
                    indexWasmAst = (_b.sent()).indexWasmAst;
                    return [2 /*return*/, indexWasmAst(source, language)];
                case 5: return [2 /*return*/];
            }
        });
    });
}
function createWorkspaceRuntime(ctx) {
    return {
        workspaceFiles: function (input) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, ctx.ports.getReady()];
                        case 1:
                            _a.sent();
                            return [4 /*yield*/, (0, platform_1.findWorkspaceFiles)(__assign({ workspaceRoot: ctx.ports.getWorkspaceRoot() }, input))];
                        case 2: return [2 /*return*/, _a.sent()];
                    }
                });
            });
        },
        workspaceSearch: function (input) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, ctx.ports.getReady()];
                        case 1:
                            _a.sent();
                            return [4 /*yield*/, (0, platform_1.searchWorkspaceFiles)(__assign({ workspaceRoot: ctx.ports.getWorkspaceRoot() }, input))];
                        case 2: return [2 /*return*/, _a.sent()];
                    }
                });
            });
        },
        workspaceList: function (input) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, ctx.ports.getReady()];
                        case 1:
                            _a.sent();
                            return [4 /*yield*/, (0, platform_1.listWorkspaceFiles)(__assign({ workspaceRoot: ctx.ports.getWorkspaceRoot() }, input))];
                        case 2: return [2 /*return*/, _a.sent()];
                    }
                });
            });
        },
        workspaceRead: function (input) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, ctx.ports.getReady()];
                        case 1:
                            _a.sent();
                            return [4 /*yield*/, (0, platform_1.readWorkspaceFile)(__assign({ workspaceRoot: ctx.ports.getWorkspaceRoot() }, input))];
                        case 2: return [2 /*return*/, _a.sent()];
                    }
                });
            });
        },
        resourceRead: function (input) {
            return __awaiter(this, void 0, void 0, function () {
                var resource, result;
                var _a;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0: return [4 /*yield*/, ctx.ports.getReady()];
                        case 1:
                            _b.sent();
                            resource = (0, plugin_workspace_resources_1.resolveNamedPluginWorkspaceResource)({
                                registry: ctx.ports.getCapabilityRegistry(),
                                resource: input.resource,
                                params: (_a = input.params) !== null && _a !== void 0 ? _a : {},
                                sessionID: ctx.ports.getSessionID(),
                                reader: input.reader,
                            });
                            if (!resource)
                                throw new contracts_1.RuntimeRefusal("plugin resource is unavailable or not authorized");
                            return [4 /*yield*/, (0, platform_1.readWorkspaceFile)({
                                    workspaceRoot: ctx.ports.getWorkspaceRoot(),
                                    path: resource.relativePath,
                                })];
                        case 2:
                            result = _b.sent();
                            if (resource.audit) {
                                ctx.ports.publish(__assign(__assign({ type: "resource.read", id: "resource:".concat(resource.pluginID, ":").concat((0, node_crypto_1.randomUUID)()), resource: resource.contributionName, owner: resource.pluginID }, (input.reader ? { reader: input.reader } : {})), { path: resource.relativePath, at: new Date().toISOString() }));
                            }
                            return [2 /*return*/, result];
                    }
                });
            });
        },
        workspaceGlob: function (input) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, ctx.ports.getReady()];
                        case 1:
                            _a.sent();
                            return [4 /*yield*/, (0, platform_1.globWorkspaceFiles)(__assign({ workspaceRoot: ctx.ports.getWorkspaceRoot() }, input))];
                        case 2: return [2 /*return*/, _a.sent()];
                    }
                });
            });
        },
        workspaceWrite: function (input) {
            return __awaiter(this, void 0, void 0, function () {
                var result;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, ctx.ports.getReady()];
                        case 1:
                            _a.sent();
                            return [4 /*yield*/, (0, platform_1.writeWorkspaceFile)(__assign({ workspaceRoot: ctx.ports.getWorkspaceRoot() }, input))];
                        case 2:
                            result = _a.sent();
                            void appendWorkspaceMutation(ctx, {
                                id: "mut_".concat(Date.now().toString(36)),
                                at: new Date().toISOString(),
                                workspaceRoot: ctx.ports.getWorkspaceRoot(),
                                sessionID: ctx.ports.getSessionID(),
                                path: input.path,
                                operation: "modify",
                                origin: "tool",
                            });
                            return [2 /*return*/, result];
                    }
                });
            });
        },
        workspaceCreate: function (input) {
            return __awaiter(this, void 0, void 0, function () {
                var result;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, ctx.ports.getReady()];
                        case 1:
                            _a.sent();
                            return [4 /*yield*/, (0, platform_1.createWorkspaceFile)(__assign({ workspaceRoot: ctx.ports.getWorkspaceRoot() }, input))];
                        case 2:
                            result = _a.sent();
                            void appendWorkspaceMutation(ctx, {
                                id: "mut_".concat(Date.now().toString(36)),
                                at: new Date().toISOString(),
                                workspaceRoot: ctx.ports.getWorkspaceRoot(),
                                sessionID: ctx.ports.getSessionID(),
                                path: input.path,
                                operation: "add",
                                origin: "tool",
                            });
                            return [2 /*return*/, result];
                    }
                });
            });
        },
        workspaceRename: function (input) {
            return __awaiter(this, void 0, void 0, function () {
                var result;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, ctx.ports.getReady()];
                        case 1:
                            _a.sent();
                            return [4 /*yield*/, (0, platform_1.renameWorkspaceFile)(__assign({ workspaceRoot: ctx.ports.getWorkspaceRoot() }, input))];
                        case 2:
                            result = _a.sent();
                            void appendWorkspaceMutation(ctx, {
                                id: "mut_".concat(Date.now().toString(36)),
                                at: new Date().toISOString(),
                                workspaceRoot: ctx.ports.getWorkspaceRoot(),
                                sessionID: ctx.ports.getSessionID(),
                                path: input.newPath,
                                oldPath: input.path,
                                operation: "rename",
                                origin: "tool",
                            });
                            return [2 /*return*/, result];
                    }
                });
            });
        },
        workspaceDelete: function (input) {
            return __awaiter(this, void 0, void 0, function () {
                var result;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, ctx.ports.getReady()];
                        case 1:
                            _a.sent();
                            return [4 /*yield*/, (0, platform_1.deleteWorkspaceFile)(__assign({ workspaceRoot: ctx.ports.getWorkspaceRoot() }, input))];
                        case 2:
                            result = _a.sent();
                            void appendWorkspaceMutation(ctx, {
                                id: "mut_".concat(Date.now().toString(36)),
                                at: new Date().toISOString(),
                                workspaceRoot: ctx.ports.getWorkspaceRoot(),
                                sessionID: ctx.ports.getSessionID(),
                                path: input.path,
                                operation: "delete",
                                origin: "tool",
                            });
                            return [2 /*return*/, result];
                    }
                });
            });
        },
        workspaceWriteConflicts: function () {
            return __awaiter(this, void 0, void 0, function () {
                var _a, _b;
                return __generator(this, function (_c) {
                    switch (_c.label) {
                        case 0: return [4 /*yield*/, ctx.ports.getReady()];
                        case 1:
                            _c.sent();
                            return [2 /*return*/, (_b = (_a = ctx.ports.getWorkspaceWriteLock()) === null || _a === void 0 ? void 0 : _a.snapshot()) !== null && _b !== void 0 ? _b : []];
                    }
                });
            });
        },
        workspaceGitDiff: function (input) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, ctx.ports.getReady()];
                        case 1:
                            _a.sent();
                            return [4 /*yield*/, collectWorkspaceGitDiff(ctx.ports.getWorkspaceRoot(), input)];
                        case 2: return [2 /*return*/, _a.sent()];
                    }
                });
            });
        },
        astDiff: function (input) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, ctx.ports.getReady()];
                        case 1:
                            _a.sent();
                            return [4 /*yield*/, astDiffWithWorkerFallback(input.oldText, input.newText, input.language)];
                        case 2: return [2 /*return*/, _a.sent()];
                    }
                });
            });
        },
        astDiffBatch: function (input) {
            return __awaiter(this, void 0, void 0, function () {
                var diffWasmAst, files, results, cursor, worker;
                var _this = this;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, ctx.ports.getReady()];
                        case 1:
                            _a.sent();
                            return [4 /*yield*/, Promise.resolve().then(function () { return require("@natalia/diff-wasm/ast"); })];
                        case 2:
                            diffWasmAst = (_a.sent()).diffWasmAst;
                            files = input.files.slice(0, 50);
                            results = [];
                            cursor = 0;
                            worker = function () { return __awaiter(_this, void 0, void 0, function () {
                                var file, result, error_1;
                                var _a;
                                return __generator(this, function (_b) {
                                    switch (_b.label) {
                                        case 0:
                                            if (!(cursor < files.length)) return [3 /*break*/, 5];
                                            file = files[cursor++];
                                            _b.label = 1;
                                        case 1:
                                            _b.trys.push([1, 3, , 4]);
                                            return [4 /*yield*/, diffWasmAst(file.oldText, file.newText, file.language)];
                                        case 2:
                                            result = _b.sent();
                                            results.push({
                                                path: file.path,
                                                language: result.language,
                                                changes: ((_a = input.options) === null || _a === void 0 ? void 0 : _a.maxChangesPerFile)
                                                    ? result.changes.slice(0, input.options.maxChangesPerFile)
                                                    : result.changes,
                                            });
                                            return [3 /*break*/, 4];
                                        case 3:
                                            error_1 = _b.sent();
                                            results.push({
                                                path: file.path,
                                                language: file.language,
                                                changes: [],
                                                error: error_1 instanceof Error ? error_1.message : String(error_1),
                                            });
                                            return [3 /*break*/, 4];
                                        case 4: return [3 /*break*/, 0];
                                        case 5: return [2 /*return*/];
                                    }
                                });
                            }); };
                            return [4 /*yield*/, Promise.all(Array.from({ length: Math.min(4, files.length) }, function () { return worker(); }))];
                        case 3:
                            _a.sent();
                            return [2 /*return*/, { files: results }];
                    }
                });
            });
        },
        astRefactorPreview: function (input) {
            return __awaiter(this, void 0, void 0, function () {
                var result;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.astDiffBatch({ files: input.files })];
                        case 1:
                            result = _a.sent();
                            return [2 /*return*/, { operation: input.operation, files: result.files }];
                    }
                });
            });
        },
        astService: function (input) {
            return __awaiter(this, void 0, void 0, function () {
                var astIndexStore, files, results, matches, cursor, worker;
                var _this = this;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, ctx.ports.getReady()];
                        case 1:
                            _a.sent();
                            astIndexStore = new object_store_1.ObjectStore((0, platform_1.resolveWorkspaceObjectsRoot)(ctx.ports.getWorkspaceRoot()));
                            files = input.files.slice(0, 50);
                            results = [];
                            matches = [];
                            cursor = 0;
                            worker = function () { return __awaiter(_this, void 0, void 0, function () {
                                var _loop_1;
                                var _a;
                                return __generator(this, function (_b) {
                                    switch (_b.label) {
                                        case 0:
                                            _loop_1 = function () {
                                                var file, cacheKey, cached, indexed, nodes, lower_1, error_2;
                                                return __generator(this, function (_c) {
                                                    switch (_c.label) {
                                                        case 0:
                                                            file = files[cursor++];
                                                            _c.label = 1;
                                                        case 1:
                                                            _c.trys.push([1, 7, , 8]);
                                                            cacheKey = "ast-index:".concat(file.language, ":").concat((0, node_crypto_1.createHash)("sha256")
                                                                .update(file.source)
                                                                .digest("hex"));
                                                            return [4 /*yield*/, astIndexStore.getMeta(cacheKey)];
                                                        case 2:
                                                            cached = _c.sent();
                                                            indexed = void 0;
                                                            if (!cached) return [3 /*break*/, 3];
                                                            indexed = { language: file.language, nodes: cached.nodes };
                                                            return [3 /*break*/, 6];
                                                        case 3: return [4 /*yield*/, astIndexWithWorkerFallback(file.source, file.language)];
                                                        case 4:
                                                            indexed = _c.sent();
                                                            return [4 /*yield*/, astIndexStore.putMeta(cacheKey, { nodes: indexed.nodes })];
                                                        case 5:
                                                            _c.sent();
                                                            _c.label = 6;
                                                        case 6:
                                                            nodes = indexed.nodes;
                                                            if (input.operation === "query" && input.query) {
                                                                lower_1 = (_a = input.query.textIncludes) === null || _a === void 0 ? void 0 : _a.toLowerCase();
                                                                nodes = nodes.filter(function (node) {
                                                                    if (input.query.nodeKind &&
                                                                        node.nodeKind !== input.query.nodeKind)
                                                                        return false;
                                                                    if (lower_1 && !node.text.toLowerCase().includes(lower_1))
                                                                        return false;
                                                                    return true;
                                                                });
                                                            }
                                                            results.push({
                                                                path: file.path,
                                                                language: indexed.language,
                                                                nodes: nodes,
                                                            });
                                                            if (input.operation === "query" && nodes.length)
                                                                matches.push({
                                                                    path: file.path,
                                                                    language: indexed.language,
                                                                    nodes: nodes,
                                                                });
                                                            return [3 /*break*/, 8];
                                                        case 7:
                                                            error_2 = _c.sent();
                                                            results.push({
                                                                path: file.path,
                                                                language: file.language,
                                                                nodes: [],
                                                                error: error_2 instanceof Error ? error_2.message : String(error_2),
                                                            });
                                                            return [3 /*break*/, 8];
                                                        case 8: return [2 /*return*/];
                                                    }
                                                });
                                            };
                                            _b.label = 1;
                                        case 1:
                                            if (!(cursor < files.length)) return [3 /*break*/, 3];
                                            return [5 /*yield**/, _loop_1()];
                                        case 2:
                                            _b.sent();
                                            return [3 /*break*/, 1];
                                        case 3: return [2 /*return*/];
                                    }
                                });
                            }); };
                            return [4 /*yield*/, Promise.all(Array.from({ length: Math.min(4, files.length) }, function () { return worker(); }))];
                        case 2:
                            _a.sent();
                            return [2 /*return*/, __assign({ operation: input.operation, files: results }, (matches.length ? { matches: matches } : {}))];
                    }
                });
            });
        },
        astRefactorPlan: function (input) {
            return __awaiter(this, void 0, void 0, function () {
                var indexed, targets, fileErrors, _i, _a, file, _b, _c, node;
                return __generator(this, function (_d) {
                    switch (_d.label) {
                        case 0: return [4 /*yield*/, ctx.ports.getReady()];
                        case 1:
                            _d.sent();
                            return [4 /*yield*/, this.astService({
                                    operation: "index",
                                    files: input.files,
                                })];
                        case 2:
                            indexed = _d.sent();
                            targets = [];
                            fileErrors = [];
                            for (_i = 0, _a = indexed.files; _i < _a.length; _i++) {
                                file = _a[_i];
                                if (file.error) {
                                    fileErrors.push({
                                        path: file.path,
                                        language: file.language,
                                        error: file.error,
                                    });
                                    continue;
                                }
                                for (_b = 0, _c = file.nodes; _b < _c.length; _b++) {
                                    node = _c[_b];
                                    if (input.rename) {
                                        if (node.text !== input.rename.from)
                                            continue;
                                        targets.push({
                                            path: file.path,
                                            language: file.language,
                                            nodeKind: node.nodeKind,
                                            text: node.text,
                                            start: node.start,
                                            end: node.end,
                                            suggestedText: input.rename.to,
                                        });
                                    }
                                    else if (input.query) {
                                        if (input.query.nodeKind && node.nodeKind !== input.query.nodeKind)
                                            continue;
                                        if (input.query.textIncludes &&
                                            !node.text
                                                .toLowerCase()
                                                .includes(input.query.textIncludes.toLowerCase()))
                                            continue;
                                        targets.push({
                                            path: file.path,
                                            language: file.language,
                                            nodeKind: node.nodeKind,
                                            text: node.text,
                                            start: node.start,
                                            end: node.end,
                                        });
                                    }
                                    else {
                                        targets.push({
                                            path: file.path,
                                            language: file.language,
                                            nodeKind: node.nodeKind,
                                            text: node.text,
                                            start: node.start,
                                            end: node.end,
                                        });
                                    }
                                }
                            }
                            return [2 /*return*/, {
                                    operation: input.operation,
                                    targets: targets.slice(0, 2000),
                                    files: fileErrors,
                                }];
                    }
                });
            });
        },
        astApplyRefactor: function (input) {
            return __awaiter(this, void 0, void 0, function () {
                var SUPPORTED_AST_LANGUAGES, supported, plan, applied, _loop_2, _i, _a, file;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0: return [4 /*yield*/, ctx.ports.getReady()];
                        case 1:
                            _b.sent();
                            return [4 /*yield*/, Promise.resolve().then(function () { return require("@natalia/diff-wasm/ast"); })];
                        case 2:
                            SUPPORTED_AST_LANGUAGES = (_b.sent()).SUPPORTED_AST_LANGUAGES;
                            supported = new Set(SUPPORTED_AST_LANGUAGES);
                            return [4 /*yield*/, this.astRefactorPlan(__assign({ operation: input.operation, files: input.files }, (input.rename ? { rename: input.rename } : {})))];
                        case 3:
                            plan = _b.sent();
                            applied = [];
                            _loop_2 = function (file) {
                                var replacements, sorted, after, _c, sorted_1, replacement, absPath;
                                return __generator(this, function (_d) {
                                    switch (_d.label) {
                                        case 0:
                                            if (!supported.has(file.language)) {
                                                applied.push({
                                                    path: file.path,
                                                    language: file.language,
                                                    replacements: [],
                                                    error: "unsupported_ast_language: ".concat(file.language),
                                                });
                                                return [2 /*return*/, "continue"];
                                            }
                                            replacements = plan.targets
                                                .filter(function (target) { return target.path === file.path; })
                                                .map(function (target) {
                                                var _a;
                                                return ({
                                                    start: byteOffsetToUtf16(file.source, target.start),
                                                    end: byteOffsetToUtf16(file.source, target.end),
                                                    from: target.text,
                                                    to: (_a = target.suggestedText) !== null && _a !== void 0 ? _a : target.text,
                                                });
                                            });
                                            if (!replacements.length) {
                                                applied.push({
                                                    path: file.path,
                                                    language: file.language,
                                                    replacements: [],
                                                    before: file.source,
                                                    after: file.source,
                                                });
                                                return [2 /*return*/, "continue"];
                                            }
                                            sorted = __spreadArray([], replacements, true).sort(function (a, b) { return b.start - a.start; });
                                            after = file.source;
                                            for (_c = 0, sorted_1 = sorted; _c < sorted_1.length; _c++) {
                                                replacement = sorted_1[_c];
                                                after =
                                                    after.slice(0, replacement.start) +
                                                        replacement.to +
                                                        after.slice(replacement.end);
                                            }
                                            if (!(!input.dryRun && file.path)) return [3 /*break*/, 2];
                                            absPath = (0, node_path_1.resolve)(ctx.ports.getWorkspaceRoot(), file.path);
                                            return [4 /*yield*/, (0, promises_1.writeFile)(absPath, after, "utf8")];
                                        case 1:
                                            _d.sent();
                                            void appendWorkspaceMutation(ctx, {
                                                id: "mut_".concat(Date.now().toString(36)),
                                                at: new Date().toISOString(),
                                                workspaceRoot: ctx.ports.getWorkspaceRoot(),
                                                sessionID: ctx.ports.getSessionID(),
                                                path: file.path,
                                                operation: "modify",
                                                origin: "refactor",
                                            });
                                            _d.label = 2;
                                        case 2:
                                            applied.push({
                                                path: file.path,
                                                language: file.language,
                                                replacements: replacements,
                                                before: file.source,
                                                after: after,
                                            });
                                            return [2 /*return*/];
                                    }
                                });
                            };
                            _i = 0, _a = input.files;
                            _b.label = 4;
                        case 4:
                            if (!(_i < _a.length)) return [3 /*break*/, 7];
                            file = _a[_i];
                            return [5 /*yield**/, _loop_2(file)];
                        case 5:
                            _b.sent();
                            _b.label = 6;
                        case 6:
                            _i++;
                            return [3 /*break*/, 4];
                        case 7: return [2 /*return*/, { operation: input.operation, applied: applied }];
                    }
                });
            });
        },
        gitRefs: function () {
            return __awaiter(this, void 0, void 0, function () {
                var workspaceRoot, _a, branches, tags, worktrees, refs, seen, currentBranchRaw, currentBranch, _i, _b, name_1, _c, _d, name_2, _e, _f, record, pathLine, path, branchLine, name_3;
                return __generator(this, function (_g) {
                    switch (_g.label) {
                        case 0: return [4 /*yield*/, ctx.ports.getReady()];
                        case 1:
                            _g.sent();
                            workspaceRoot = ctx.ports.getWorkspaceRoot();
                            return [4 /*yield*/, Promise.all([
                                    gitCapture(workspaceRoot, ["branch", "--format=%(refname:short)"]),
                                    gitCapture(workspaceRoot, ["tag", "--list"]),
                                    gitCapture(workspaceRoot, ["worktree", "list", "--porcelain"]),
                                ])];
                        case 2:
                            _a = _g.sent(), branches = _a[0], tags = _a[1], worktrees = _a[2];
                            refs = [];
                            seen = new Set();
                            return [4 /*yield*/, gitCapture(workspaceRoot, [
                                    "rev-parse",
                                    "--abbrev-ref",
                                    "HEAD",
                                ])];
                        case 3:
                            currentBranchRaw = _g.sent();
                            currentBranch = currentBranchRaw.stdout.trim();
                            for (_i = 0, _b = branches.stdout
                                .split("\n")
                                .map(function (line) { return line.trim(); })
                                .filter(Boolean); _i < _b.length; _i++) {
                                name_1 = _b[_i];
                                if (seen.has(name_1))
                                    continue;
                                seen.add(name_1);
                                refs.push({
                                    name: name_1,
                                    kind: "branch",
                                    current: name_1 === currentBranch,
                                });
                            }
                            for (_c = 0, _d = tags.stdout
                                .split("\n")
                                .map(function (line) { return line.trim(); })
                                .filter(Boolean); _c < _d.length; _c++) {
                                name_2 = _d[_c];
                                if (seen.has(name_2))
                                    continue;
                                seen.add(name_2);
                                refs.push({ name: name_2, kind: "tag" });
                            }
                            for (_e = 0, _f = worktrees.stdout.split("\n\n"); _e < _f.length; _e++) {
                                record = _f[_e];
                                pathLine = record
                                    .split("\n")
                                    .find(function (line) { return line.startsWith("worktree "); });
                                if (!pathLine)
                                    continue;
                                path = pathLine.slice("worktree ".length).trim();
                                branchLine = record
                                    .split("\n")
                                    .find(function (line) { return line.startsWith("branch "); });
                                name_3 = branchLine
                                    ? branchLine.slice("branch ".length).replace("refs/heads/", "")
                                    : path;
                                if (seen.has(name_3))
                                    continue;
                                seen.add(name_3);
                                refs.push({
                                    name: name_3,
                                    kind: "worktree",
                                    path: path,
                                    current: path === workspaceRoot,
                                });
                            }
                            return [2 /*return*/, refs];
                    }
                });
            });
        },
    };
}
var gitStructuredCache = new Map();
function patchToStructuredCached(patch) {
    var cached = gitStructuredCache.get(patch);
    if (cached)
        return cached;
    var result = patchToStructured(patch);
    gitStructuredCache.set(patch, result);
    return result;
}
function patchToStructured(patch) {
    var _a, _b;
    var hunks = [];
    var oldLine = 0;
    var newLine = 0;
    var additions = 0;
    var deletions = 0;
    var inHunk = false;
    var current;
    for (var _i = 0, _c = patch.split("\n"); _i < _c.length; _i++) {
        var raw = _c[_i];
        if (raw.startsWith("diff --git")) {
            inHunk = false;
            current = undefined;
            continue;
        }
        if (raw.startsWith("@@")) {
            var match = raw.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/u);
            if (match) {
                var oldStart = Number(match[1]);
                var oldCount = Number((_a = match[2]) !== null && _a !== void 0 ? _a : 1);
                var newStart = Number(match[3]);
                var newCount = Number((_b = match[4]) !== null && _b !== void 0 ? _b : 1);
                oldLine = oldStart;
                newLine = newStart;
                inHunk = true;
                current = {
                    oldStart: oldStart,
                    oldCount: oldCount,
                    newStart: newStart,
                    newCount: newCount,
                    lines: [],
                };
                hunks.push(current);
            }
            continue;
        }
        if (!inHunk || !current)
            continue;
        if (raw.startsWith("---") || raw.startsWith("+++") || raw.startsWith("\\"))
            continue;
        if (raw.startsWith("+")) {
            var text = raw.slice(1);
            current.lines.push({
                type: "add",
                text: text,
                oldLineNumber: null,
                newLineNumber: newLine++,
            });
            additions++;
            continue;
        }
        if (raw.startsWith("-")) {
            var text = raw.slice(1);
            current.lines.push({
                type: "delete",
                text: text,
                oldLineNumber: oldLine++,
                newLineNumber: null,
            });
            deletions++;
            continue;
        }
        if (raw.startsWith(" ")) {
            var text = raw.slice(1);
            current.lines.push({
                type: "context",
                text: text,
                oldLineNumber: oldLine++,
                newLineNumber: newLine++,
            });
            continue;
        }
    }
    return { hunks: hunks, additions: additions, deletions: deletions };
}
function byteOffsetToUtf16(source, byteOffset) {
    var encoder = new TextEncoder();
    var bytes = 0;
    var utf16 = 0;
    var index = 0;
    while (index < source.length && bytes < byteOffset) {
        var codePoint = source.codePointAt(index);
        var char = String.fromCodePoint(codePoint);
        var charBytes = encoder.encode(char).length;
        if (bytes + charBytes > byteOffset)
            break;
        bytes += charBytes;
        utf16 += char.length;
        index += char.length;
    }
    return utf16;
}
function isProbablyBinary(data) {
    var sample = data.subarray(0, 8192);
    return sample.includes(0);
}
function gitShowContentBuffer(workspaceRoot, ref, path) {
    return __awaiter(this, void 0, void 0, function () {
        var process_1, _a, stdout, stderr, exitCode, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    _c.trys.push([0, 3, , 4]);
                    process_1 = Bun.spawn(["git", "show", "".concat(ref, ":").concat(path)], {
                        cwd: workspaceRoot,
                        stdin: "ignore",
                        stdout: "pipe",
                        stderr: "pipe",
                    });
                    return [4 /*yield*/, Promise.all([
                            new Response(process_1.stdout).arrayBuffer(),
                            new Response(process_1.stderr).arrayBuffer(),
                        ])];
                case 1:
                    _a = _c.sent(), stdout = _a[0], stderr = _a[1];
                    return [4 /*yield*/, process_1.exited];
                case 2:
                    exitCode = _c.sent();
                    if (exitCode !== 0)
                        return [2 /*return*/, undefined];
                    void stderr;
                    return [2 /*return*/, Buffer.from(stdout)];
                case 3:
                    _b = _c.sent();
                    return [2 /*return*/, undefined];
                case 4: return [2 /*return*/];
            }
        });
    });
}
function gitShowContent(workspaceRoot, ref, path) {
    return __awaiter(this, void 0, void 0, function () {
        var buffer;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, gitShowContentBuffer(workspaceRoot, ref, path)];
                case 1:
                    buffer = _a.sent();
                    return [2 /*return*/, buffer === null || buffer === void 0 ? void 0 : buffer.toString("utf8")];
            }
        });
    });
}
function readWorkspaceContentBuffer(workspaceRoot, path) {
    return __awaiter(this, void 0, void 0, function () {
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, (0, promises_1.readFile)((0, node_path_1.resolve)(workspaceRoot, path))];
                case 1: return [2 /*return*/, _b.sent()];
                case 2:
                    _a = _b.sent();
                    return [2 /*return*/, undefined];
                case 3: return [2 /*return*/];
            }
        });
    });
}
function readWorkspaceContent(workspaceRoot, path) {
    return __awaiter(this, void 0, void 0, function () {
        var buffer;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, readWorkspaceContentBuffer(workspaceRoot, path)];
                case 1:
                    buffer = _a.sent();
                    return [2 /*return*/, buffer === null || buffer === void 0 ? void 0 : buffer.toString("utf8")];
            }
        });
    });
}
function structuredForPatch(patch) {
    return __awaiter(this, void 0, void 0, function () {
        var parsePatchInWorker, result, _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 3, , 4]);
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("@natalia/framework-diff/runtime/diff-parse-client"); })];
                case 1:
                    parsePatchInWorker = (_b.sent()).parsePatchInWorker;
                    return [4 /*yield*/, parsePatchInWorker(patch)];
                case 2:
                    result = _b.sent();
                    return [2 /*return*/, result];
                case 3:
                    _a = _b.sent();
                    return [2 /*return*/, {
                            counts: countPatch(patch),
                            structured: patchToStructuredCached(patch),
                        }];
                case 4: return [2 /*return*/];
            }
        });
    });
}
function collectWorkspaceGitDiff(workspaceRoot, input) {
    return __awaiter(this, void 0, void 0, function () {
        var from, to, status_1, changes_2, lines, _i, lines_1, line, parsed, path, operation, oldPath, patch, _a, _b, before, after, buffer, buffer, afterBuffer, patchResult, _c, counts, structured, rawDiff, changes, _d, changes_1, change, beforeBuffer, afterBuffer;
        var _this = this;
        var _e, _f, _g;
        return __generator(this, function (_h) {
            switch (_h.label) {
                case 0:
                    from = (_e = input === null || input === void 0 ? void 0 : input.from) !== null && _e !== void 0 ? _e : "HEAD";
                    to = (_f = input === null || input === void 0 ? void 0 : input.to) !== null && _f !== void 0 ? _f : "WORKTREE";
                    if (!(to === "WORKTREE")) return [3 /*break*/, 21];
                    return [4 /*yield*/, gitCapture(workspaceRoot, [
                            "status",
                            "--porcelain=v1",
                            "-uall",
                        ])];
                case 1:
                    status_1 = _h.sent();
                    if (status_1.exitCode !== 0)
                        return [2 /*return*/, []];
                    changes_2 = [];
                    lines = status_1.stdout.split("\n").filter(Boolean);
                    _i = 0, lines_1 = lines;
                    _h.label = 2;
                case 2:
                    if (!(_i < lines_1.length)) return [3 /*break*/, 20];
                    line = lines_1[_i];
                    parsed = parseStatusLine(line);
                    if (!parsed)
                        return [3 /*break*/, 19];
                    if ((input === null || input === void 0 ? void 0 : input.path) && parsed.path !== input.path)
                        return [3 /*break*/, 19];
                    path = parsed.path;
                    operation = parsed.operation;
                    oldPath = parsed.oldPath;
                    patch = "";
                    if (!((input === null || input === void 0 ? void 0 : input.includePatch) !== false)) return [3 /*break*/, 9];
                    _h.label = 3;
                case 3:
                    _h.trys.push([3, 8, , 9]);
                    if (!(operation === "added" && parsed.untracked)) return [3 /*break*/, 5];
                    return [4 /*yield*/, gitDiffUntracked(workspaceRoot, path, input === null || input === void 0 ? void 0 : input.ignoreWhitespace)];
                case 4:
                    _a = _h.sent();
                    return [3 /*break*/, 7];
                case 5: return [4 /*yield*/, gitDiffTracked(workspaceRoot, from, path, oldPath, input === null || input === void 0 ? void 0 : input.ignoreWhitespace)];
                case 6:
                    _a = _h.sent();
                    _h.label = 7;
                case 7:
                    patch = _a;
                    return [3 /*break*/, 9];
                case 8:
                    _b = _h.sent();
                    patch = "";
                    return [3 /*break*/, 9];
                case 9:
                    before = void 0;
                    after = void 0;
                    if (!(input === null || input === void 0 ? void 0 : input.includeContent)) return [3 /*break*/, 15];
                    if (!(operation === "deleted")) return [3 /*break*/, 11];
                    return [4 /*yield*/, gitShowContentBuffer(workspaceRoot, from, oldPath !== null && oldPath !== void 0 ? oldPath : path)];
                case 10:
                    buffer = _h.sent();
                    if (buffer && !isProbablyBinary(buffer))
                        before = buffer.toString("utf8");
                    return [3 /*break*/, 15];
                case 11:
                    if (!!(operation === "added" && parsed.untracked)) return [3 /*break*/, 13];
                    return [4 /*yield*/, gitShowContentBuffer(workspaceRoot, from, oldPath !== null && oldPath !== void 0 ? oldPath : path)];
                case 12:
                    buffer = _h.sent();
                    if (buffer && !isProbablyBinary(buffer))
                        before = buffer.toString("utf8");
                    _h.label = 13;
                case 13: return [4 /*yield*/, readWorkspaceContentBuffer(workspaceRoot, path)];
                case 14:
                    afterBuffer = _h.sent();
                    if (afterBuffer && !isProbablyBinary(afterBuffer))
                        after = afterBuffer.toString("utf8");
                    _h.label = 15;
                case 15:
                    if (!patch) return [3 /*break*/, 17];
                    return [4 /*yield*/, structuredForPatch(patch)];
                case 16:
                    _c = _h.sent();
                    return [3 /*break*/, 18];
                case 17:
                    _c = undefined;
                    _h.label = 18;
                case 18:
                    patchResult = _c;
                    counts = (_g = patchResult === null || patchResult === void 0 ? void 0 : patchResult.counts) !== null && _g !== void 0 ? _g : { additions: 0, deletions: 0 };
                    structured = patchResult === null || patchResult === void 0 ? void 0 : patchResult.structured;
                    changes_2.push(__assign(__assign(__assign(__assign(__assign(__assign({ path: path, operation: operation }, (oldPath ? { oldPath: oldPath } : {})), { additions: counts.additions, deletions: counts.deletions }), (patch ? { patch: patch } : {})), (structured ? { structured: structured } : {})), (before !== undefined ? { before: before } : {})), (after !== undefined ? { after: after } : {})));
                    _h.label = 19;
                case 19:
                    _i++;
                    return [3 /*break*/, 2];
                case 20: return [2 /*return*/, changes_2];
                case 21: return [4 /*yield*/, gitCapture(workspaceRoot, __spreadArray(__spreadArray(__spreadArray([
                        "diff",
                        "--unified=3",
                        "--no-color"
                    ], ((input === null || input === void 0 ? void 0 : input.ignoreWhitespace) ? ["-w"] : []), true), [
                        "".concat(from, "..").concat(to)
                    ], false), ((input === null || input === void 0 ? void 0 : input.path) ? ["--", input.path] : []), true))];
                case 22:
                    rawDiff = _h.sent();
                    if (rawDiff.exitCode !== 0 && !rawDiff.stdout.trim())
                        return [2 /*return*/, []];
                    return [4 /*yield*/, (function () { return __awaiter(_this, void 0, void 0, function () {
                            var diffChangesInWorker, _a;
                            return __generator(this, function (_b) {
                                switch (_b.label) {
                                    case 0:
                                        _b.trys.push([0, 3, , 4]);
                                        return [4 /*yield*/, Promise.resolve().then(function () { return require("@natalia/framework-diff/runtime/diff-parse-client"); })];
                                    case 1:
                                        diffChangesInWorker = (_b.sent()).diffChangesInWorker;
                                        return [4 /*yield*/, diffChangesInWorker(rawDiff.stdout)];
                                    case 2: return [2 /*return*/, (_b.sent())];
                                    case 3:
                                        _a = _b.sent();
                                        return [2 /*return*/, diffToChanges(rawDiff.stdout)];
                                    case 4: return [2 /*return*/];
                                }
                            });
                        }); })()];
                case 23:
                    changes = _h.sent();
                    if (!(input === null || input === void 0 ? void 0 : input.includeContent)) return [3 /*break*/, 28];
                    _d = 0, changes_1 = changes;
                    _h.label = 24;
                case 24:
                    if (!(_d < changes_1.length)) return [3 /*break*/, 28];
                    change = changes_1[_d];
                    return [4 /*yield*/, gitShowContentBuffer(workspaceRoot, from, change.path)];
                case 25:
                    beforeBuffer = _h.sent();
                    return [4 /*yield*/, gitShowContentBuffer(workspaceRoot, to, change.path)];
                case 26:
                    afterBuffer = _h.sent();
                    if (beforeBuffer && !isProbablyBinary(beforeBuffer))
                        change.before = beforeBuffer.toString("utf8");
                    if (afterBuffer && !isProbablyBinary(afterBuffer))
                        change.after = afterBuffer.toString("utf8");
                    _h.label = 27;
                case 27:
                    _d++;
                    return [3 /*break*/, 24];
                case 28: return [2 /*return*/, changes];
            }
        });
    });
}
function unquoteGitPath(value) {
    var trimmed = value.trim();
    if (!trimmed.startsWith('"') || !trimmed.endsWith('"'))
        return trimmed;
    try {
        return JSON.parse(trimmed);
    }
    catch (_a) {
        return trimmed.slice(1, -1);
    }
}
function parseStatusLine(line) {
    if (line.startsWith("?? ")) {
        return {
            path: unquoteGitPath(line.slice(3)),
            operation: "added",
            untracked: true,
        };
    }
    var code = line.slice(0, 2);
    var rest = line.slice(3);
    if (!rest)
        return undefined;
    var rename = rest.includes(" -> ");
    if (rename) {
        var _a = rest.split(" -> "), oldPath = _a[0], path = _a[1];
        return {
            path: unquoteGitPath(path),
            operation: "renamed",
            oldPath: unquoteGitPath(oldPath !== null && oldPath !== void 0 ? oldPath : ""),
            untracked: false,
        };
    }
    var operation = code.includes("D")
        ? "deleted"
        : code.includes("A") || code.includes("?")
            ? "added"
            : "modified";
    return { path: unquoteGitPath(rest), operation: operation, untracked: false };
}
function gitCapture(cwd, args) {
    return __awaiter(this, void 0, void 0, function () {
        var process_2, stdout, exitCode, _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 4, , 5]);
                    process_2 = Bun.spawn(__spreadArray(["git"], args, true), {
                        cwd: cwd,
                        stdin: "ignore",
                        stdout: "pipe",
                        stderr: "pipe",
                    });
                    return [4 /*yield*/, new Response(process_2.stdout).text()];
                case 1:
                    stdout = _b.sent();
                    return [4 /*yield*/, new Response(process_2.stderr).text()];
                case 2:
                    _b.sent();
                    return [4 /*yield*/, process_2.exited];
                case 3:
                    exitCode = _b.sent();
                    return [2 /*return*/, { stdout: stdout, exitCode: exitCode }];
                case 4:
                    _a = _b.sent();
                    return [2 /*return*/, { stdout: "", exitCode: 127 }];
                case 5: return [2 /*return*/];
            }
        });
    });
}
function gitDiffTracked(cwd, from, path, oldPath, ignoreWhitespace) {
    return __awaiter(this, void 0, void 0, function () {
        var whitespace, args, result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    whitespace = ignoreWhitespace ? ["-w"] : [];
                    args = oldPath
                        ? __spreadArray(__spreadArray([
                            "diff",
                            "--unified=3",
                            "--no-color"
                        ], whitespace, true), [
                            from,
                            "--",
                            oldPath,
                            path,
                        ], false) : __spreadArray(__spreadArray(["diff", "--unified=3", "--no-color"], whitespace, true), [from, "--", path], false);
                    return [4 /*yield*/, gitCapture(cwd, args)];
                case 1:
                    result = _a.sent();
                    return [2 /*return*/, result.stdout];
            }
        });
    });
}
function gitDiffUntracked(cwd, path, ignoreWhitespace) {
    return __awaiter(this, void 0, void 0, function () {
        var whitespace, result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    whitespace = ignoreWhitespace ? ["-w"] : [];
                    return [4 /*yield*/, gitCapture(cwd, __spreadArray(__spreadArray([
                            "diff",
                            "--no-index",
                            "--unified=3",
                            "--no-color"
                        ], whitespace, true), [
                            "--",
                            "/dev/null",
                            path,
                        ], false))];
                case 1:
                    result = _a.sent();
                    return [2 /*return*/, result.exitCode === 0 || result.exitCode === 1 ? result.stdout : ""];
            }
        });
    });
}
function diffToChanges(rawDiff) {
    var _a;
    var changes = [];
    var sections = rawDiff.split(/(?=^diff --git )/m);
    for (var _i = 0, sections_1 = sections; _i < sections_1.length; _i++) {
        var section = sections_1[_i];
        if (!section.trim())
            continue;
        var header = (_a = section.split("\n")[0]) !== null && _a !== void 0 ? _a : "";
        var match = header.match(/^diff --git a\/(.+) b\/(.+)$/u);
        if (!match)
            continue;
        var path = match[2];
        var counts = countPatch(section);
        var patch = section.trim() ? section.trimEnd() + "\n" : undefined;
        var structured = patch ? patchToStructuredCached(patch) : undefined;
        changes.push(__assign(__assign({ path: path, operation: "modified", additions: counts.additions, deletions: counts.deletions }, (patch ? { patch: patch } : {})), (structured ? { structured: structured } : {})));
    }
    return changes;
}
function countPatch(patch) {
    var additions = 0;
    var deletions = 0;
    for (var _i = 0, _a = patch.split("\n"); _i < _a.length; _i++) {
        var line = _a[_i];
        if (line.startsWith("+") && !line.startsWith("+++"))
            additions++;
        else if (line.startsWith("-") && !line.startsWith("---"))
            deletions++;
    }
    return { additions: additions, deletions: deletions };
}
