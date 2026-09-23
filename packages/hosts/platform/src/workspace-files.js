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
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
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
exports.findWorkspaceFiles = findWorkspaceFiles;
exports.invalidateWorkspaceFiles = invalidateWorkspaceFiles;
exports.listWorkspaceFiles = listWorkspaceFiles;
exports.readWorkspaceFile = readWorkspaceFile;
exports.globWorkspaceFiles = globWorkspaceFiles;
exports.globWorkspaceFilesBounded = globWorkspaceFilesBounded;
exports.watchWorkspaceFiles = watchWorkspaceFiles;
exports.grepWorkspaceFilesBounded = grepWorkspaceFilesBounded;
exports.searchWorkspaceFiles = searchWorkspaceFiles;
exports.writeWorkspaceFile = writeWorkspaceFile;
exports.createWorkspaceFile = createWorkspaceFile;
exports.renameWorkspaceFile = renameWorkspaceFile;
exports.deleteWorkspaceFile = deleteWorkspaceFile;
var promises_1 = require("node:fs/promises");
var node_fs_1 = require("node:fs");
var node_path_1 = require("node:path");
var fuzzysort_1 = require("fuzzysort");
var contracts_1 = require("@natalia/contracts");
var natalia_ignore_1 = require("./natalia-ignore");
var ignoredDirectories = new Set([
    ".git",
    ".hg",
    ".svn",
    ".natalia",
    ".next",
    ".turbo",
    "__pycache__",
    "build",
    "coverage",
    "dist",
    "node_modules",
    "target",
]);
var catalogs = new Map();
var maxSearchFileBytes = 1024 * 1024;
var maxReadFileBytes = 1024 * 1024;
var maxMediaIngestBytes = 20 * 1024 * 1024;
var maxReadPageBytes = 50 * 1024;
/**
 * Content search is user-initiated and should reach past the first page of the
 * workspace catalog. The cap only protects against pathological trees; normal
 * repositories are fully walked before the result limit is reached.
 */
var maxSearchFiles = 50000;
var maxReadLines = 2000;
var maxReadLineChars = 2000;
function findWorkspaceFiles(input) {
    return __awaiter(this, void 0, void 0, function () {
        var root, cached, catalog, _a, query, entries, results;
        var _b, _c, _d, _e;
        return __generator(this, function (_f) {
            switch (_f.label) {
                case 0: return [4 /*yield*/, (0, promises_1.realpath)(input.workspaceRoot)];
                case 1:
                    root = _f.sent();
                    cached = catalogs.get(root);
                    if (!(cached && cached.expiresAt > Date.now())) return [3 /*break*/, 2];
                    _a = cached;
                    return [3 /*break*/, 4];
                case 2: return [4 /*yield*/, refreshWorkspaceFiles(root)];
                case 3:
                    _a = _f.sent();
                    _f.label = 4;
                case 4:
                    catalog = _a;
                    query = (_c = (_b = input.query) === null || _b === void 0 ? void 0 : _b.trim().toLowerCase()) !== null && _c !== void 0 ? _c : "";
                    entries = input.type
                        ? catalog.entries.filter(function (entry) { return entry.type === input.type; })
                        : catalog.entries;
                    if (!query)
                        return [2 /*return*/, __spreadArray([], entries, true).sort(function (left, right) {
                                return left.path.length - right.path.length ||
                                    left.path.localeCompare(right.path);
                            })
                                .slice(0, Math.min(200, Math.max(1, (_d = input.limit) !== null && _d !== void 0 ? _d : 50)))];
                    results = fuzzysort_1.default.go(query, entries, {
                        key: "path",
                        limit: Math.min(200, Math.max(1, (_e = input.limit) !== null && _e !== void 0 ? _e : 50)),
                    });
                    return [2 /*return*/, results.map(function (result) { return result.obj; })];
            }
        });
    });
}
function invalidateWorkspaceFiles(workspaceRoot) {
    catalogs.delete((0, node_path_1.resolve)(workspaceRoot));
}
function listWorkspaceFiles(input) {
    return __awaiter(this, void 0, void 0, function () {
        var root, directory, children, entries, offset, limit, selected, truncated;
        var _this = this;
        var _a, _b, _c, _d;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0: return [4 /*yield*/, (0, promises_1.realpath)(input.workspaceRoot)];
                case 1:
                    root = _e.sent();
                    return [4 /*yield*/, resolveWorkspacePath(root, (_a = input.path) !== null && _a !== void 0 ? _a : ".")];
                case 2:
                    directory = _e.sent();
                    return [4 /*yield*/, (0, promises_1.stat)(directory)];
                case 3:
                    if (!(_e.sent()).isDirectory())
                        throw new contracts_1.RuntimeInvalidParams("workspace path is not a directory: ".concat((_b = input.path) !== null && _b !== void 0 ? _b : "."));
                    return [4 /*yield*/, (0, promises_1.readdir)(directory, { withFileTypes: true })];
                case 4:
                    children = _e.sent();
                    return [4 /*yield*/, Promise.all(children.map(function (child) { return __awaiter(_this, void 0, void 0, function () {
                            var path, real, relativePath;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        path = (0, node_path_1.resolve)(directory, child.name);
                                        return [4 /*yield*/, (0, promises_1.realpath)(path).catch(function () { return undefined; })];
                                    case 1:
                                        real = _a.sent();
                                        if (!real || !contains(root, real))
                                            return [2 /*return*/];
                                        relativePath = (0, node_path_1.relative)(root, path).split(node_path_1.sep).join("/");
                                        if (child.isDirectory())
                                            return [2 /*return*/, { path: "".concat(relativePath, "/"), type: "directory" }];
                                        if (child.isFile())
                                            return [2 /*return*/, { path: relativePath, type: "file" }];
                                        return [2 /*return*/];
                                }
                            });
                        }); }))];
                case 5:
                    entries = (_e.sent())
                        .filter(function (entry) { return entry !== undefined; })
                        .sort(function (left, right) {
                        return left.type === right.type
                            ? left.path.localeCompare(right.path)
                            : left.type === "directory"
                                ? -1
                                : 1;
                    });
                    offset = Math.max(1, (_c = input.offset) !== null && _c !== void 0 ? _c : 1);
                    limit = Math.min(200, Math.max(1, (_d = input.limit) !== null && _d !== void 0 ? _d : 50));
                    selected = entries.slice(offset - 1, offset - 1 + limit);
                    truncated = offset - 1 + selected.length < entries.length;
                    return [2 /*return*/, __assign({ entries: selected, truncated: truncated }, (truncated ? { next: offset + selected.length } : {}))];
            }
        });
    });
}
function readWorkspaceFile(input) {
    return __awaiter(this, void 0, void 0, function () {
        var root, path, info, header, _a, media, bytes, _b, text, offset, limit, lines, selected, usedBytes, next, index, line, lineBytes;
        var _c, _d;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0: return [4 /*yield*/, (0, promises_1.realpath)(input.workspaceRoot)];
                case 1:
                    root = _e.sent();
                    return [4 /*yield*/, resolveWorkspacePath(root, input.path)];
                case 2:
                    path = _e.sent();
                    return [4 /*yield*/, (0, promises_1.stat)(path)];
                case 3:
                    info = _e.sent();
                    if (!info.isFile())
                        throw new contracts_1.RuntimeInvalidParams("workspace path is not a file: ".concat(input.path));
                    _a = Uint8Array.bind;
                    return [4 /*yield*/, Bun.file(path).slice(0, 12).arrayBuffer()];
                case 4:
                    header = new (_a.apply(Uint8Array, [void 0, _e.sent()]))();
                    media = imageMime(header);
                    if (media && info.size > maxMediaIngestBytes)
                        throw new contracts_1.RuntimeRefusal("workspace media exceeds ".concat(maxMediaIngestBytes, " bytes: ").concat(input.path));
                    if (!media && info.size > maxReadFileBytes)
                        throw new contracts_1.RuntimeRefusal("workspace file exceeds ".concat(maxReadFileBytes, " bytes: ").concat(input.path));
                    _b = Uint8Array.bind;
                    return [4 /*yield*/, Bun.file(path).arrayBuffer()];
                case 5:
                    bytes = new (_b.apply(Uint8Array, [void 0, _e.sent()]))();
                    if (media)
                        return [2 /*return*/, {
                                path: (0, node_path_1.relative)(root, path).split(node_path_1.sep).join("/"),
                                content: Buffer.from(bytes).toString("base64"),
                                encoding: "base64",
                                mime: media,
                            }];
                    text = decodeUtf8(bytes);
                    if (text !== undefined &&
                        (bytes.length > maxReadPageBytes || input.offset || input.limit)) {
                        offset = Math.max(1, (_c = input.offset) !== null && _c !== void 0 ? _c : 1);
                        limit = Math.min(maxReadLines, Math.max(1, (_d = input.limit) !== null && _d !== void 0 ? _d : maxReadLines));
                        lines = text.endsWith("\n")
                            ? text.slice(0, -1).replace(/\r$/u, "").split(/\r?\n/u)
                            : text.split(/\r?\n/u);
                        selected = [];
                        usedBytes = 0;
                        next = void 0;
                        for (index = offset - 1; index < lines.length; index++) {
                            if (selected.length >= limit) {
                                next = index + 1;
                                break;
                            }
                            line = lines[index].slice(0, maxReadLineChars);
                            lineBytes = Buffer.byteLength(line, "utf8") + (selected.length ? 1 : 0);
                            if (usedBytes + lineBytes > maxReadPageBytes) {
                                next = index + 1;
                                break;
                            }
                            selected.push(line);
                            usedBytes += lineBytes;
                        }
                        if (!selected.length && offset > lines.length)
                            throw new contracts_1.RuntimeInvalidParams("workspace read offset is out of range: ".concat(offset));
                        return [2 /*return*/, __assign({ path: (0, node_path_1.relative)(root, path).split(node_path_1.sep).join("/"), content: selected.join("\n"), encoding: "utf8", mime: mimeType(path), offset: offset, truncated: next !== undefined }, (next === undefined ? {} : { next: next }))];
                    }
                    return [2 /*return*/, {
                            path: (0, node_path_1.relative)(root, path).split(node_path_1.sep).join("/"),
                            content: text !== null && text !== void 0 ? text : Buffer.from(bytes).toString("base64"),
                            encoding: text === undefined ? "base64" : "utf8",
                            mime: mimeType(path),
                        }];
            }
        });
    });
}
function globWorkspaceFiles(input) {
    return __awaiter(this, void 0, void 0, function () {
        var root, directory, limit, entries, _a, _b, _c, relativePath, path, real, e_1_1;
        var _d, e_1, _e, _f;
        var _g, _h, _j;
        return __generator(this, function (_k) {
            switch (_k.label) {
                case 0:
                    if (!input.pattern ||
                        input.pattern.includes("..") ||
                        input.pattern.startsWith("/"))
                        throw new contracts_1.RuntimeRefusal("workspace glob pattern must remain inside workspace");
                    return [4 /*yield*/, (0, promises_1.realpath)(input.workspaceRoot)];
                case 1:
                    root = _k.sent();
                    return [4 /*yield*/, resolveWorkspacePath(root, (_g = input.path) !== null && _g !== void 0 ? _g : ".")];
                case 2:
                    directory = _k.sent();
                    return [4 /*yield*/, (0, promises_1.stat)(directory)];
                case 3:
                    if (!(_k.sent()).isDirectory())
                        throw new contracts_1.RuntimeInvalidParams("workspace path is not a directory: ".concat((_h = input.path) !== null && _h !== void 0 ? _h : "."));
                    limit = Math.min(200, Math.max(1, (_j = input.limit) !== null && _j !== void 0 ? _j : 50));
                    entries = [];
                    _k.label = 4;
                case 4:
                    _k.trys.push([4, 10, 11, 16]);
                    _a = true, _b = __asyncValues(new Bun.Glob(input.pattern).scan({
                        cwd: directory,
                        onlyFiles: true,
                    }));
                    _k.label = 5;
                case 5: return [4 /*yield*/, _b.next()];
                case 6:
                    if (!(_c = _k.sent(), _d = _c.done, !_d)) return [3 /*break*/, 9];
                    _f = _c.value;
                    _a = false;
                    relativePath = _f;
                    if (entries.length >= limit)
                        return [3 /*break*/, 9];
                    path = (0, node_path_1.resolve)(directory, relativePath);
                    return [4 /*yield*/, (0, promises_1.realpath)(path).catch(function () { return undefined; })];
                case 7:
                    real = _k.sent();
                    if (!real || !contains(root, real))
                        return [3 /*break*/, 8];
                    entries.push({
                        path: (0, node_path_1.relative)(root, path).split(node_path_1.sep).join("/"),
                        type: "file",
                    });
                    _k.label = 8;
                case 8:
                    _a = true;
                    return [3 /*break*/, 5];
                case 9: return [3 /*break*/, 16];
                case 10:
                    e_1_1 = _k.sent();
                    e_1 = { error: e_1_1 };
                    return [3 /*break*/, 16];
                case 11:
                    _k.trys.push([11, , 14, 15]);
                    if (!(!_a && !_d && (_e = _b.return))) return [3 /*break*/, 13];
                    return [4 /*yield*/, _e.call(_b)];
                case 12:
                    _k.sent();
                    _k.label = 13;
                case 13: return [3 /*break*/, 15];
                case 14:
                    if (e_1) throw e_1.error;
                    return [7 /*endfinally*/];
                case 15: return [7 /*endfinally*/];
                case 16: return [2 /*return*/, entries.sort(function (left, right) { return left.path.localeCompare(right.path); })];
            }
        });
    });
}
var maxGlobScannedFiles = 500;
var maxGlobScannedBytes = 4 * 1024 * 1024;
var maxGlobDeadlineMs = 8000;
function globCursorQueryMatches(state, input) {
    return (state.v === 1 &&
        state.root === input.root &&
        state.pattern === input.pattern &&
        state.scope === input.scope);
}
function encodeGlobCursor(state) {
    return Buffer.from(JSON.stringify(state), "utf8").toString("base64url");
}
function decodeGlobCursor(cursor) {
    try {
        return JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
    }
    catch (_a) {
        throw new contracts_1.RuntimeInvalidParams("glob cursor is invalid");
    }
}
function throwIfGlobAborted(signal) {
    if (!(signal === null || signal === void 0 ? void 0 : signal.aborted))
        return;
    throw signal.reason instanceof Error
        ? signal.reason
        : new Error("glob aborted");
}
/**
 * Bounded, cursor-paginated glob.
 *
 * Uses the same deterministic DFS and default heavy-directory skips as grep.
 * Unlike grep there is no file content to read, so the byte budget is based on
 * stat sizes and only matching paths consume the result limit.
 */
function globWorkspaceFilesBounded(input) {
    return __awaiter(this, void 0, void 0, function () {
        var root, scopeArg, scopeAbs, scope, limit, matcher, maxScannedFiles, maxScannedBytes, deadline, state, paths, timedOut, result, budgetReached, authorizeResults, stopWithCursor, frame, directory, children, child, childRelative, childAbsolute, real, info;
        var _this = this;
        var _a, _b, _c, _d, _e;
        return __generator(this, function (_f) {
            switch (_f.label) {
                case 0:
                    if (!input.pattern ||
                        input.pattern.includes("..") ||
                        input.pattern.startsWith("/"))
                        throw new contracts_1.RuntimeRefusal("workspace glob pattern must remain inside workspace");
                    return [4 /*yield*/, (0, promises_1.realpath)(input.workspaceRoot)];
                case 1:
                    root = _f.sent();
                    scopeArg = ((_a = input.path) === null || _a === void 0 ? void 0 : _a.trim()) || ".";
                    return [4 /*yield*/, (0, promises_1.realpath)((0, node_path_1.resolve)(root, scopeArg)).catch(function () {
                            throw new contracts_1.RuntimeInvalidParams("glob path does not exist: ".concat(scopeArg));
                        })];
                case 2:
                    scopeAbs = _f.sent();
                    if (!contains(root, scopeAbs))
                        throw new contracts_1.RuntimeInvalidParams("glob path must remain inside workspace");
                    return [4 /*yield*/, (0, promises_1.stat)(scopeAbs)];
                case 3:
                    if (!(_f.sent()).isDirectory())
                        throw new contracts_1.RuntimeInvalidParams("glob path is not a directory: ".concat(scopeArg));
                    scope = (0, node_path_1.relative)(root, scopeAbs).split(node_path_1.sep).join("/");
                    limit = Math.min(1000, Math.max(1, (_b = input.limit) !== null && _b !== void 0 ? _b : 200));
                    matcher = new Bun.Glob(input.pattern);
                    maxScannedFiles = Math.max(1, (_c = input.maxScannedFiles) !== null && _c !== void 0 ? _c : maxGlobScannedFiles);
                    maxScannedBytes = Math.max(1, (_d = input.maxScannedBytes) !== null && _d !== void 0 ? _d : maxGlobScannedBytes);
                    deadline = Date.now() + Math.max(1, (_e = input.deadlineMs) !== null && _e !== void 0 ? _e : maxGlobDeadlineMs);
                    if (input.cursor) {
                        state = decodeGlobCursor(input.cursor);
                        if (!globCursorQueryMatches(state, {
                            root: root,
                            pattern: input.pattern,
                            scope: scope,
                        }))
                            throw new contracts_1.RuntimeInvalidParams("glob cursor does not match the query");
                    }
                    else {
                        state = {
                            v: 1,
                            root: root,
                            pattern: input.pattern,
                            scope: scope,
                            stack: [{ path: scope, index: 0 }],
                            scannedFiles: 0,
                            scannedBytes: 0,
                        };
                    }
                    paths = [];
                    timedOut = false;
                    result = function (truncated, nextState) { return (__assign(__assign(__assign({ paths: paths, truncated: truncated }, (truncated && nextState
                        ? { nextCursor: encodeGlobCursor(nextState) }
                        : {})), { scannedFiles: state.scannedFiles, scannedBytes: state.scannedBytes }), (timedOut ? { timedOut: timedOut } : {}))); };
                    budgetReached = function () {
                        return paths.length >= limit ||
                            state.scannedFiles >= maxScannedFiles ||
                            state.scannedBytes >= maxScannedBytes;
                    };
                    authorizeResults = function () {
                        var _a, _b;
                        return (_b = (_a = input.authorize) === null || _a === void 0 ? void 0 : _a.call(input, { toolName: "glob", paths: __spreadArray([], paths, true) })) !== null && _b !== void 0 ? _b : Promise.resolve();
                    };
                    stopWithCursor = function () { return __awaiter(_this, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0: return [4 /*yield*/, authorizeResults()];
                                case 1:
                                    _a.sent();
                                    return [2 /*return*/, result(true, __assign(__assign({}, state), { stack: state.stack.map(function (frame) { return (__assign({}, frame)); }) }))];
                            }
                        });
                    }); };
                    _f.label = 4;
                case 4:
                    if (!(state.stack.length > 0)) return [3 /*break*/, 9];
                    throwIfGlobAborted(input.signal);
                    if (Date.now() >= deadline) {
                        timedOut = true;
                        return [2 /*return*/, stopWithCursor()];
                    }
                    frame = state.stack[state.stack.length - 1];
                    directory = (0, node_path_1.resolve)(root, frame.path || ".");
                    return [4 /*yield*/, (0, promises_1.readdir)(directory, { withFileTypes: true }).catch(function () { return []; })];
                case 5:
                    children = _f.sent();
                    children.sort(function (left, right) { return left.name.localeCompare(right.name); });
                    if (frame.index >= children.length) {
                        state.stack.pop();
                        return [3 /*break*/, 4];
                    }
                    if (budgetReached())
                        return [2 /*return*/, stopWithCursor()];
                    child = children[frame.index];
                    frame.index += 1;
                    childRelative = frame.path
                        ? "".concat(frame.path, "/").concat(child.name)
                        : child.name;
                    childAbsolute = (0, node_path_1.resolve)(directory, child.name);
                    if (!child.isDirectory()) return [3 /*break*/, 7];
                    if (DEFAULT_GREP_IGNORED_DIRECTORIES.has(child.name) &&
                        childRelative !== scope &&
                        !includeMayEnterDirectory(childRelative, input.pattern))
                        return [3 /*break*/, 4];
                    return [4 /*yield*/, (0, promises_1.realpath)(childAbsolute).catch(function () { return undefined; })];
                case 6:
                    real = _f.sent();
                    if (!real || !contains(root, real))
                        return [3 /*break*/, 4];
                    state.stack.push({ path: childRelative, index: 0 });
                    return [3 /*break*/, 4];
                case 7:
                    if (!child.isFile())
                        return [3 /*break*/, 4];
                    if (!matcher.match(childRelative))
                        return [3 /*break*/, 4];
                    return [4 /*yield*/, (0, promises_1.stat)(childAbsolute).catch(function () { return undefined; })];
                case 8:
                    info = _f.sent();
                    throwIfGlobAborted(input.signal);
                    if (!(info === null || info === void 0 ? void 0 : info.isFile()))
                        return [3 /*break*/, 4];
                    state.scannedFiles += 1;
                    state.scannedBytes += info.size;
                    paths.push(childRelative);
                    return [3 /*break*/, 4];
                case 9: return [4 /*yield*/, authorizeResults()];
                case 10:
                    _f.sent();
                    return [2 /*return*/, result(false)];
            }
        });
    });
}
function watchWorkspaceFiles(workspaceRoot, onChange) {
    return __awaiter(this, void 0, void 0, function () {
        var root, watchers, closed, watchedDirectories, ignoreRules, trigger, attachNewDirectory;
        var _this = this;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, promises_1.realpath)(workspaceRoot)];
                case 1:
                    root = _a.sent();
                    watchers = [];
                    closed = false;
                    watchedDirectories = new Set([root]);
                    ignoreRules = [];
                    trigger = function (directory, eventType, filename) {
                        if (closed)
                            return;
                        var changedPath = filename
                            ? (0, node_path_1.resolve)(directory, filename.toString())
                            : directory;
                        var relativePath = (0, node_path_1.relative)(root, changedPath).split(node_path_1.sep).join("/");
                        if (relativePath === natalia_ignore_1.NATALIA_IGNORE_FILE)
                            return;
                        if (relativePath && isIgnored(relativePath, false, ignoreRules))
                            return;
                        invalidateWorkspaceFiles(root);
                        // The change detail is a hint: the auditor reconciles it into a confirmed
                        // change (§56.9). `rename` is mapped to the coarse operation the watcher
                        // can prove; a full path/operation determination belongs to reconciliation.
                        onChange({
                            path: relativePath || ".",
                            operation: eventType === "rename" ? "renamed" : "modified",
                        });
                        // Existing directory watchers observe ordinary file writes. Rebuilding the
                        // full recursive watcher tree after every event self-scans large devref
                        // trees forever. Attach only genuinely new directories incrementally.
                        if (eventType === "rename" && filename)
                            void attachNewDirectory(changedPath);
                    };
                    attachNewDirectory = function (path) { return __awaiter(_this, void 0, void 0, function () {
                        var info, real, relativePath, _a, _b, _c;
                        return __generator(this, function (_d) {
                            switch (_d.label) {
                                case 0: return [4 /*yield*/, (0, promises_1.stat)(path).catch(function () { return undefined; })];
                                case 1:
                                    info = _d.sent();
                                    if (closed || !(info === null || info === void 0 ? void 0 : info.isDirectory()))
                                        return [2 /*return*/];
                                    return [4 /*yield*/, (0, promises_1.realpath)(path).catch(function () { return undefined; })];
                                case 2:
                                    real = _d.sent();
                                    relativePath = real ? (0, node_path_1.relative)(root, real).split(node_path_1.sep).join("/") : "";
                                    if (!real ||
                                        !contains(root, real) ||
                                        isIgnored(relativePath, true, ignoreRules))
                                        return [2 /*return*/];
                                    if (watchedDirectories.has(real))
                                        return [2 /*return*/];
                                    watchedDirectories.add(real);
                                    _b = (_a = watchers.push).apply;
                                    _c = [watchers];
                                    return [4 /*yield*/, watchDirectories(root, real, trigger, ignoreRules, watchedDirectories)];
                                case 3:
                                    _b.apply(_a, _c.concat([(_d.sent())]));
                                    return [2 /*return*/];
                            }
                        });
                    }); };
                    return [4 /*yield*/, watchDirectories(root, root, trigger, ignoreRules, watchedDirectories)];
                case 2:
                    watchers = _a.sent();
                    return [2 /*return*/, function () {
                            closed = true;
                            watchers.forEach(function (watcher) { return watcher.close(); });
                            watchers = [];
                        }];
            }
        });
    });
}
var DEFAULT_GREP_IGNORED_DIRECTORIES = new Set([
    ".git",
    ".hg",
    ".svn",
    ".natalia",
    ".next",
    ".turbo",
    "__pycache__",
    "build",
    "coverage",
    "devref",
    "dist",
    "node_modules",
    "target",
]);
var maxGrepScannedFiles = 500;
var maxGrepScannedBytes = 4 * 1024 * 1024;
var maxGrepDeadlineMs = 8000;
function grepCursorQueryMatches(state, input) {
    return (state.v === 1 &&
        state.root === input.root &&
        state.pattern === input.pattern &&
        state.scope === input.scope &&
        state.include === input.include);
}
function encodeGrepCursor(state) {
    return Buffer.from(JSON.stringify(state), "utf8").toString("base64url");
}
function decodeGrepCursor(cursor) {
    try {
        return JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
    }
    catch (_a) {
        throw new contracts_1.RuntimeInvalidParams("grep cursor is invalid");
    }
}
function throwIfGrepAborted(signal) {
    if (!(signal === null || signal === void 0 ? void 0 : signal.aborted))
        return;
    throw signal.reason instanceof Error
        ? signal.reason
        : new Error("grep aborted");
}
/**
 * Bounded, cursor-paginated grep.
 *
 * Traversal is deterministic DFS: each directory's children are sorted by
 * name before walking, and the cursor stores that frame's next child index
 * plus an optional in-file line offset. Heavy/derived directories are skipped
 * by default; pointing `path` at the workspace root cannot be skipped away.
 */
function grepWorkspaceFilesBounded(input) {
    return __awaiter(this, void 0, void 0, function () {
        var expression, root, scopeArg, scopeAbs, scope, include, limit, maxScannedFiles, maxScannedBytes, deadline, state, matches, timedOut, result, budgetReached, saveCursorAfterStop, processFile, file, outcome_1, frame, directory, children, child, childRelative, childAbsolute, real, outcome;
        var _this = this;
        var _a, _b, _c, _d, _e, _f;
        return __generator(this, function (_g) {
            switch (_g.label) {
                case 0:
                    if (!input.pattern)
                        throw new contracts_1.RuntimeInvalidParams("grep pattern is required");
                    try {
                        expression = new RegExp(input.pattern, "u");
                    }
                    catch (_h) {
                        throw new contracts_1.RuntimeInvalidParams("grep pattern must be a valid regular expression");
                    }
                    return [4 /*yield*/, (0, promises_1.realpath)(input.workspaceRoot)];
                case 1:
                    root = _g.sent();
                    scopeArg = ((_a = input.path) === null || _a === void 0 ? void 0 : _a.trim()) || ".";
                    return [4 /*yield*/, (0, promises_1.realpath)((0, node_path_1.resolve)(root, scopeArg)).catch(function () {
                            throw new contracts_1.RuntimeInvalidParams("grep path does not exist: ".concat(scopeArg));
                        })];
                case 2:
                    scopeAbs = _g.sent();
                    if (!contains(root, scopeAbs))
                        throw new contracts_1.RuntimeInvalidParams("grep path must remain inside workspace");
                    return [4 /*yield*/, (0, promises_1.stat)(scopeAbs)];
                case 3:
                    if (!(_g.sent()).isDirectory())
                        throw new contracts_1.RuntimeInvalidParams("grep path is not a directory: ".concat(scopeArg));
                    scope = (0, node_path_1.relative)(root, scopeAbs).split(node_path_1.sep).join("/");
                    include = ((_b = input.include) === null || _b === void 0 ? void 0 : _b.trim()) || "**/*";
                    limit = Math.min(1000, Math.max(1, (_c = input.limit) !== null && _c !== void 0 ? _c : 200));
                    maxScannedFiles = Math.max(1, (_d = input.maxScannedFiles) !== null && _d !== void 0 ? _d : maxGrepScannedFiles);
                    maxScannedBytes = Math.max(1, (_e = input.maxScannedBytes) !== null && _e !== void 0 ? _e : maxGrepScannedBytes);
                    deadline = Date.now() + Math.max(1, (_f = input.deadlineMs) !== null && _f !== void 0 ? _f : maxGrepDeadlineMs);
                    if (input.cursor) {
                        state = decodeGrepCursor(input.cursor);
                        if (!grepCursorQueryMatches(state, {
                            root: root,
                            pattern: input.pattern,
                            scope: scope,
                            include: include,
                        }))
                            throw new contracts_1.RuntimeInvalidParams("grep cursor does not match the query");
                    }
                    else {
                        state = {
                            v: 1,
                            root: root,
                            pattern: input.pattern,
                            scope: scope,
                            include: include,
                            stack: [{ path: scope, index: 0 }],
                            scannedFiles: 0,
                            scannedBytes: 0,
                        };
                    }
                    matches = [];
                    timedOut = false;
                    result = function (truncated, nextState) { return (__assign(__assign(__assign({ matches: matches, truncated: truncated }, (truncated && nextState
                        ? { nextCursor: encodeGrepCursor(nextState) }
                        : {})), { scannedFiles: state.scannedFiles, scannedBytes: state.scannedBytes }), (timedOut ? { timedOut: timedOut } : {}))); };
                    budgetReached = function () {
                        return matches.length >= limit ||
                            state.scannedFiles >= maxScannedFiles ||
                            state.scannedBytes >= maxScannedBytes;
                    };
                    saveCursorAfterStop = function () {
                        return result(true, __assign(__assign(__assign({}, state), { stack: state.stack.map(function (frame) { return (__assign({}, frame)); }) }), (state.file ? { file: __assign({}, state.file) } : {})));
                    };
                    processFile = function (displayPath, startLine, countBytes) { return __awaiter(_this, void 0, void 0, function () {
                        var absolutePath, info, bytes, _a, text, lines, index, line;
                        var _b, _c;
                        return __generator(this, function (_d) {
                            switch (_d.label) {
                                case 0:
                                    absolutePath = (0, node_path_1.resolve)(root, displayPath);
                                    return [4 /*yield*/, (0, promises_1.stat)(absolutePath).catch(function () { return undefined; })];
                                case 1:
                                    info = _d.sent();
                                    if (!(info === null || info === void 0 ? void 0 : info.isFile()) || info.size > maxSearchFileBytes)
                                        return [2 /*return*/, { done: true, nextLine: startLine }];
                                    return [4 /*yield*/, ((_b = input.authorize) === null || _b === void 0 ? void 0 : _b.call(input, { toolName: "grep", paths: [displayPath] }))];
                                case 2:
                                    _d.sent();
                                    throwIfGrepAborted(input.signal);
                                    _a = Uint8Array.bind;
                                    return [4 /*yield*/, (0, promises_1.readFile)(absolutePath)];
                                case 3:
                                    bytes = new (_a.apply(Uint8Array, [void 0, _d.sent()]))();
                                    if (countBytes)
                                        state.scannedBytes += bytes.byteLength;
                                    if (bytes.includes(0))
                                        return [2 /*return*/, { done: true, nextLine: startLine }];
                                    try {
                                        text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
                                    }
                                    catch (_e) {
                                        return [2 /*return*/, { done: true, nextLine: startLine }];
                                    }
                                    lines = text.split(/\r?\n/u);
                                    if (text.endsWith("\n") && lines.at(-1) === "")
                                        lines.pop();
                                    for (index = startLine; index < lines.length; index += 1) {
                                        throwIfGrepAborted(input.signal);
                                        if (Date.now() >= deadline) {
                                            timedOut = true;
                                            state.file = { path: displayPath, line: index };
                                            return [2 /*return*/, { done: false, nextLine: index }];
                                        }
                                        if (budgetReached()) {
                                            state.file = { path: displayPath, line: index };
                                            return [2 /*return*/, { done: false, nextLine: index }];
                                        }
                                        line = (_c = lines[index]) !== null && _c !== void 0 ? _c : "";
                                        expression.lastIndex = 0;
                                        if (expression.test(line)) {
                                            matches.push({
                                                path: displayPath,
                                                line: index + 1,
                                                text: line.length > 2000 ? "".concat(line.slice(0, 2000), "...") : line,
                                            });
                                            if (matches.length >= limit) {
                                                if (index + 1 < lines.length) {
                                                    state.file = { path: displayPath, line: index + 1 };
                                                    return [2 /*return*/, { done: false, nextLine: index + 1 }];
                                                }
                                                return [2 /*return*/, { done: true, nextLine: lines.length }];
                                            }
                                        }
                                    }
                                    return [2 /*return*/, { done: true, nextLine: lines.length }];
                            }
                        });
                    }); };
                    _g.label = 4;
                case 4:
                    if (!(state.stack.length > 0)) return [3 /*break*/, 11];
                    throwIfGrepAborted(input.signal);
                    if (Date.now() >= deadline) {
                        timedOut = true;
                        return [2 /*return*/, saveCursorAfterStop()];
                    }
                    if (!state.file) return [3 /*break*/, 6];
                    file = state.file;
                    return [4 /*yield*/, processFile(file.path, file.line, false)];
                case 5:
                    outcome_1 = _g.sent();
                    if (!outcome_1.done)
                        return [2 /*return*/, saveCursorAfterStop()];
                    state.file = undefined;
                    return [3 /*break*/, 4];
                case 6:
                    frame = state.stack[state.stack.length - 1];
                    directory = (0, node_path_1.resolve)(root, frame.path || ".");
                    return [4 /*yield*/, (0, promises_1.readdir)(directory, { withFileTypes: true }).catch(function () { return []; })];
                case 7:
                    children = _g.sent();
                    children.sort(function (left, right) { return left.name.localeCompare(right.name); });
                    if (frame.index >= children.length) {
                        state.stack.pop();
                        return [3 /*break*/, 4];
                    }
                    if (budgetReached())
                        return [2 /*return*/, saveCursorAfterStop()];
                    child = children[frame.index];
                    frame.index += 1;
                    childRelative = frame.path
                        ? "".concat(frame.path, "/").concat(child.name)
                        : child.name;
                    childAbsolute = (0, node_path_1.resolve)(directory, child.name);
                    if (!child.isDirectory()) return [3 /*break*/, 9];
                    if (DEFAULT_GREP_IGNORED_DIRECTORIES.has(child.name) &&
                        childRelative !== scope &&
                        !includeMayEnterDirectory(childRelative, include))
                        return [3 /*break*/, 4];
                    return [4 /*yield*/, (0, promises_1.realpath)(childAbsolute).catch(function () { return undefined; })];
                case 8:
                    real = _g.sent();
                    if (!real || !contains(root, real))
                        return [3 /*break*/, 4];
                    state.stack.push({ path: childRelative, index: 0 });
                    return [3 /*break*/, 4];
                case 9:
                    if (!child.isFile())
                        return [3 /*break*/, 4];
                    if (!matchesInclude(childRelative, include))
                        return [3 /*break*/, 4];
                    state.scannedFiles += 1;
                    return [4 /*yield*/, processFile(childRelative, 0, true)];
                case 10:
                    outcome = _g.sent();
                    if (!outcome.done)
                        return [2 /*return*/, saveCursorAfterStop()];
                    return [3 /*break*/, 4];
                case 11: return [2 /*return*/, result(false)];
            }
        });
    });
}
function searchWorkspaceFiles(input) {
    return __awaiter(this, void 0, void 0, function () {
        var expression, root, limit, ignoreRules, entries, files, matches, _i, files_1, file, content, _a, _b, _c, index, line;
        var _d;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    if (!input.query.trim())
                        throw new contracts_1.RuntimeInvalidParams("workspace search query is required");
                    try {
                        expression = new RegExp(input.query, "u");
                    }
                    catch (_f) {
                        throw new contracts_1.RuntimeInvalidParams("workspace search query must be a valid regular expression");
                    }
                    return [4 /*yield*/, (0, promises_1.realpath)(input.workspaceRoot)];
                case 1:
                    root = _e.sent();
                    limit = Math.min(200, Math.max(1, (_d = input.limit) !== null && _d !== void 0 ? _d : 50));
                    ignoreRules = [];
                    entries = [];
                    return [4 /*yield*/, collectSearchFiles(root, root, entries, maxSearchFiles, ignoreRules, new Set([root]))];
                case 2:
                    _e.sent();
                    files = entries
                        .filter(function (entry) { return matchesInclude(entry.path, input.include); })
                        .sort(function (left, right) {
                        return left.path.length - right.path.length ||
                            left.path.localeCompare(right.path);
                    });
                    matches = [];
                    _i = 0, files_1 = files;
                    _e.label = 3;
                case 3:
                    if (!(_i < files_1.length)) return [3 /*break*/, 6];
                    file = files_1[_i];
                    if (matches.length >= limit)
                        return [3 /*break*/, 6];
                    return [4 /*yield*/, readSearchText((0, node_path_1.resolve)(root, file.path))];
                case 4:
                    content = _e.sent();
                    if (content === undefined)
                        return [3 /*break*/, 5];
                    for (_a = 0, _b = content.split(/\r?\n/u).entries(); _a < _b.length; _a++) {
                        _c = _b[_a], index = _c[0], line = _c[1];
                        expression.lastIndex = 0;
                        if (!expression.test(line))
                            continue;
                        matches.push({
                            path: file.path,
                            line: index + 1,
                            text: line.length > 2000 ? "".concat(line.slice(0, 2000), "...") : line,
                        });
                        if (matches.length >= limit)
                            break;
                    }
                    _e.label = 5;
                case 5:
                    _i++;
                    return [3 /*break*/, 3];
                case 6: return [2 /*return*/, matches];
            }
        });
    });
}
function collectSearchFiles(root, directory, output, maxFiles, ignoreRules, visited) {
    return __awaiter(this, void 0, void 0, function () {
        var children, _i, children_1, child, path, real, relativePath;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (output.length >= maxFiles)
                        return [2 /*return*/];
                    return [4 /*yield*/, (0, promises_1.readdir)(directory, { withFileTypes: true }).catch(function () { return []; })];
                case 1:
                    children = _a.sent();
                    _i = 0, children_1 = children;
                    _a.label = 2;
                case 2:
                    if (!(_i < children_1.length)) return [3 /*break*/, 7];
                    child = children_1[_i];
                    if (output.length >= maxFiles)
                        return [2 /*return*/];
                    path = (0, node_path_1.resolve)(directory, child.name);
                    return [4 /*yield*/, (0, promises_1.realpath)(path).catch(function () { return undefined; })];
                case 3:
                    real = _a.sent();
                    if (!real || !contains(root, real))
                        return [3 /*break*/, 6];
                    relativePath = (0, node_path_1.relative)(root, path).split(node_path_1.sep).join("/");
                    if (!relativePath)
                        return [3 /*break*/, 6];
                    if (!child.isDirectory()) return [3 /*break*/, 5];
                    if (visited.has(real))
                        return [3 /*break*/, 6];
                    visited.add(real);
                    return [4 /*yield*/, collectSearchFiles(root, real, output, maxFiles, ignoreRules, visited)];
                case 4:
                    _a.sent();
                    return [3 /*break*/, 6];
                case 5:
                    if (child.isFile())
                        output.push({ path: relativePath, type: "file" });
                    _a.label = 6;
                case 6:
                    _i++;
                    return [3 /*break*/, 2];
                case 7: return [2 /*return*/];
            }
        });
    });
}
function refreshWorkspaceFiles(root) {
    return __awaiter(this, void 0, void 0, function () {
        var entries, catalog;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    entries = [];
                    return [4 /*yield*/, collect(root, root, entries, 10000, [], new Set([root]))];
                case 1:
                    _a.sent();
                    catalog = { entries: entries, expiresAt: Date.now() + 1000, ignoreRules: [] };
                    catalogs.set(root, catalog);
                    return [2 /*return*/, catalog];
            }
        });
    });
}
function workspaceCatalog(root) {
    return __awaiter(this, void 0, void 0, function () {
        var cached;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    cached = catalogs.get(root);
                    if (cached && cached.expiresAt > Date.now())
                        return [2 /*return*/, cached];
                    return [4 /*yield*/, refreshWorkspaceFiles(root)];
                case 1: return [2 /*return*/, _a.sent()];
            }
        });
    });
}
function collect(root, directory, output, maxEntries, ignoreRules, visited) {
    return __awaiter(this, void 0, void 0, function () {
        var children, _i, children_2, child, path, real, relativePath;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (output.length >= maxEntries)
                        return [2 /*return*/];
                    return [4 /*yield*/, (0, promises_1.readdir)(directory, { withFileTypes: true }).catch(function () { return []; })];
                case 1:
                    children = _a.sent();
                    _i = 0, children_2 = children;
                    _a.label = 2;
                case 2:
                    if (!(_i < children_2.length)) return [3 /*break*/, 8];
                    child = children_2[_i];
                    if (output.length >= maxEntries)
                        return [2 /*return*/];
                    path = (0, node_path_1.resolve)(directory, child.name);
                    return [4 /*yield*/, (0, promises_1.realpath)(path).catch(function () { return undefined; })];
                case 3:
                    real = _a.sent();
                    if (!real || !contains(root, real))
                        return [3 /*break*/, 7];
                    relativePath = (0, node_path_1.relative)(root, path).split(node_path_1.sep).join("/");
                    if (!relativePath)
                        return [3 /*break*/, 7];
                    if (!child.isDirectory()) return [3 /*break*/, 6];
                    output.push({ path: "".concat(relativePath, "/"), type: "directory" });
                    if (!!visited.has(real)) return [3 /*break*/, 5];
                    visited.add(real);
                    return [4 /*yield*/, collect(root, real, output, maxEntries, ignoreRules, visited)];
                case 4:
                    _a.sent();
                    _a.label = 5;
                case 5: return [3 /*break*/, 7];
                case 6:
                    if (child.isFile())
                        output.push({ path: relativePath, type: "file" });
                    _a.label = 7;
                case 7:
                    _i++;
                    return [3 /*break*/, 2];
                case 8: return [2 /*return*/];
            }
        });
    });
}
function watchDirectories(root, directory, onChange, ignoreRules, visited) {
    return __awaiter(this, void 0, void 0, function () {
        var watchers, children, _i, children_3, child, path, real, relativePath, _a, _b, _c;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    watchers = [];
                    return [4 /*yield*/, (0, promises_1.readdir)(directory, { withFileTypes: true }).catch(function () { return []; })];
                case 1:
                    children = _d.sent();
                    // A watcher that cannot be established must not come back looking healthy:
                    // the caller relies on `onChange` for catalog invalidation, and a silently
                    // missing watcher turns stale data into a silent lie. `watch` fails with
                    // ENOSPC when the system's inotify budget is exhausted (per-user
                    // fs.inotify.max_user_watches), which is exactly the situation that must
                    // surface. The runtime caller tolerates the failure explicitly with its own
                    // `.catch`; it does not rely on this one.
                    watchers.push((0, node_fs_1.watch)(directory, { persistent: false }, function (eventType, filename) {
                        return onChange(directory, eventType, filename === null || filename === void 0 ? void 0 : filename.toString());
                    }));
                    _i = 0, children_3 = children;
                    _d.label = 2;
                case 2:
                    if (!(_i < children_3.length)) return [3 /*break*/, 6];
                    child = children_3[_i];
                    if (!child.isDirectory())
                        return [3 /*break*/, 5];
                    path = (0, node_path_1.resolve)(directory, child.name);
                    return [4 /*yield*/, (0, promises_1.realpath)(path).catch(function () { return undefined; })];
                case 3:
                    real = _d.sent();
                    if (!real || !contains(root, real) || visited.has(real))
                        return [3 /*break*/, 5];
                    relativePath = (0, node_path_1.relative)(root, path).split(node_path_1.sep).join("/");
                    // Pruned purely by the collected rules. A negated rule never disables
                    // this pruning: isIgnored evaluates negations with their base scope, and
                    // git semantics forbid re-including anything under an excluded
                    // directory anyway. Without this, one vendored subtree whose own
                    // .gitignore contains a `!` pattern disables pruning for the whole
                    // workspace and the watcher lands on every devref directory.
                    if (isIgnored(relativePath, true, ignoreRules))
                        return [3 /*break*/, 5];
                    visited.add(real);
                    _b = (_a = watchers.push).apply;
                    _c = [watchers];
                    return [4 /*yield*/, watchDirectories(root, real, onChange, ignoreRules, visited)];
                case 4:
                    _b.apply(_a, _c.concat([(_d.sent())]));
                    _d.label = 5;
                case 5:
                    _i++;
                    return [3 /*break*/, 2];
                case 6: return [2 /*return*/, watchers];
            }
        });
    });
}
function contains(root, target) {
    return target === root || target.startsWith("".concat(root).concat(node_path_1.sep));
}
function writeWorkspaceFile(input) {
    return __awaiter(this, void 0, void 0, function () {
        var root, path, bytes;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, promises_1.realpath)(input.workspaceRoot)];
                case 1:
                    root = _a.sent();
                    return [4 /*yield*/, resolveWorkspacePath(root, input.path)];
                case 2:
                    path = _a.sent();
                    bytes = input.encoding === "base64"
                        ? Buffer.from(input.content, "base64")
                        : Buffer.from(input.content, "utf8");
                    return [4 /*yield*/, (0, promises_1.writeFile)(path, bytes, { mode: 384 })];
                case 3:
                    _a.sent();
                    invalidateWorkspaceFiles(root);
                    return [2 /*return*/, { written: true }];
            }
        });
    });
}
function createWorkspaceFile(input) {
    return __awaiter(this, void 0, void 0, function () {
        var root, path, bytes;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, (0, promises_1.realpath)(input.workspaceRoot)];
                case 1:
                    root = _c.sent();
                    return [4 /*yield*/, resolveWorkspacePath(root, input.path)];
                case 2:
                    path = _c.sent();
                    if (!input.directory) return [3 /*break*/, 4];
                    return [4 /*yield*/, (0, promises_1.mkdir)(path, { recursive: true })];
                case 3:
                    _c.sent();
                    invalidateWorkspaceFiles(root);
                    return [2 /*return*/, { created: true }];
                case 4: return [4 /*yield*/, (0, promises_1.mkdir)((0, node_path_1.dirname)(path), { recursive: true })];
                case 5:
                    _c.sent();
                    bytes = input.encoding === "base64"
                        ? Buffer.from((_a = input.content) !== null && _a !== void 0 ? _a : "", "base64")
                        : Buffer.from((_b = input.content) !== null && _b !== void 0 ? _b : "", "utf8");
                    return [4 /*yield*/, (0, promises_1.writeFile)(path, bytes, { mode: 384 })];
                case 6:
                    _c.sent();
                    invalidateWorkspaceFiles(root);
                    return [2 /*return*/, { created: true }];
            }
        });
    });
}
function renameWorkspaceFile(input) {
    return __awaiter(this, void 0, void 0, function () {
        var root, source, destination;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, promises_1.realpath)(input.workspaceRoot)];
                case 1:
                    root = _a.sent();
                    return [4 /*yield*/, resolveWorkspacePath(root, input.path)];
                case 2:
                    source = _a.sent();
                    return [4 /*yield*/, resolveWorkspacePath(root, input.newPath)];
                case 3:
                    destination = _a.sent();
                    if (source === destination)
                        throw new contracts_1.RuntimeRefusal("workspace rename source and destination are identical");
                    return [4 /*yield*/, (0, promises_1.mkdir)((0, node_path_1.dirname)(destination), { recursive: true })];
                case 4:
                    _a.sent();
                    return [4 /*yield*/, (0, promises_1.rename)(source, destination)];
                case 5:
                    _a.sent();
                    invalidateWorkspaceFiles(root);
                    return [2 /*return*/, { renamed: true }];
            }
        });
    });
}
function deleteWorkspaceFile(input) {
    return __awaiter(this, void 0, void 0, function () {
        var root, path;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, promises_1.realpath)(input.workspaceRoot)];
                case 1:
                    root = _a.sent();
                    return [4 /*yield*/, resolveWorkspacePath(root, input.path)];
                case 2:
                    path = _a.sent();
                    return [4 /*yield*/, moveToTrash(path)];
                case 3:
                    _a.sent();
                    invalidateWorkspaceFiles(root);
                    return [2 /*return*/, { deleted: true, trash: true }];
            }
        });
    });
}
function moveToTrash(path) {
    return __awaiter(this, void 0, void 0, function () {
        var quoted, script, quoted, script, _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    if (!(process.platform === "win32")) return [3 /*break*/, 2];
                    quoted = path.replace(/'/gu, "''");
                    script = "Add-Type -AssemblyName Microsoft.VisualBasic; [Microsoft.VisualBasic.FileIO.FileSystem]::DeleteFile('".concat(quoted, "','OnlyErrorDialogs','SendToRecycleBin')");
                    return [4 /*yield*/, runTrashCommand("powershell.exe", ["-NoProfile", "-Command", script])];
                case 1:
                    _b.sent();
                    return [2 /*return*/];
                case 2:
                    if (!(process.platform === "darwin")) return [3 /*break*/, 4];
                    quoted = path.replace(/'/gu, "'\''");
                    script = "tell application \"Finder\" to delete POSIX file '".concat(quoted, "'");
                    return [4 /*yield*/, runTrashCommand("osascript", ["-e", script])];
                case 3:
                    _b.sent();
                    return [2 /*return*/];
                case 4:
                    _b.trys.push([4, 6, , 8]);
                    return [4 /*yield*/, runTrashCommand("gio", ["trash", path])];
                case 5:
                    _b.sent();
                    return [3 /*break*/, 8];
                case 6:
                    _a = _b.sent();
                    return [4 /*yield*/, runTrashCommand("trash-put", [path])];
                case 7:
                    _b.sent();
                    return [3 /*break*/, 8];
                case 8: return [2 /*return*/];
            }
        });
    });
}
function runTrashCommand(command, args) {
    return __awaiter(this, void 0, void 0, function () {
        var child, code;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    child = Bun.spawn(__spreadArray([command], args, true), {
                        stdout: "ignore",
                        stderr: "ignore",
                    });
                    return [4 /*yield*/, child.exited];
                case 1:
                    code = _a.sent();
                    if (code !== 0)
                        throw new contracts_1.RuntimeRefusal("failed to move to trash: ".concat(command));
                    return [2 /*return*/];
            }
        });
    });
}
function resolveWorkspacePath(root, input) {
    return __awaiter(this, void 0, void 0, function () {
        var path, segments, resolved, index, real, finalPath;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    // Refusals, not failures: the caller asked for something policy does not allow,
                    // which a remote consumer must be able to tell apart from a broken runtime. The
                    // reason names the rule and never the resolved path — the absolute path is the
                    // one thing that must not travel back out of here.
                    if (!input || input.startsWith("/") || input.split(/[\\/]/u).includes(".."))
                        throw new contracts_1.RuntimeRefusal("workspace path must remain inside workspace");
                    path = (0, node_path_1.resolve)(root, input);
                    if (!contains(root, path))
                        throw new contracts_1.RuntimeRefusal("workspace path must remain inside workspace");
                    segments = (0, node_path_1.relative)(root, path).split(node_path_1.sep);
                    resolved = root;
                    index = 0;
                    _a.label = 1;
                case 1:
                    if (!(index < segments.length)) return [3 /*break*/, 4];
                    return [4 /*yield*/, (0, promises_1.realpath)((0, node_path_1.join)(resolved, segments[index])).catch(function () { return undefined; })];
                case 2:
                    real = _a.sent();
                    if (real === undefined)
                        return [3 /*break*/, 4];
                    resolved = real;
                    _a.label = 3;
                case 3:
                    index += 1;
                    return [3 /*break*/, 1];
                case 4:
                    finalPath = node_path_1.join.apply(void 0, __spreadArray([resolved], segments.slice(index), false));
                    if (!contains(root, finalPath))
                        throw new contracts_1.RuntimeRefusal("workspace path must remain inside workspace");
                    return [2 /*return*/, finalPath];
            }
        });
    });
}
function normalizeWorkspacePathForPolicy(path) {
    return path.split(/[\\/]/u).join("/");
}
function isIgnored(path, directory, rules) {
    var normalized = normalizeWorkspacePathForPolicy(path);
    if (normalized === ".natalia/plans" ||
        normalized.startsWith(".natalia/plans/"))
        return false;
    if (normalized.split("/").some(function (part) { return ignoredDirectories.has(part); }))
        return true;
    return rules.reduce(function (ignored, rule) {
        if (rule.base &&
            normalized !== rule.base &&
            !normalized.startsWith("".concat(rule.base, "/")))
            return ignored;
        var relativePath = normalized.slice(rule.base.length).replace(/^\//u, "");
        if (!relativePath ||
            (rule.directoryOnly && !directory && !relativePath.includes("/")))
            return ignored;
        if (!rule.pattern.test(relativePath))
            return ignored;
        return !rule.negated;
    }, false);
}
function decodeUtf8(bytes) {
    if (bytes.includes(0))
        return undefined;
    try {
        return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    }
    catch (_a) {
        return undefined;
    }
}
function mimeType(path) {
    var _a;
    var extension = (_a = path.split(".").at(-1)) === null || _a === void 0 ? void 0 : _a.toLowerCase();
    if (extension === "json")
        return "application/json";
    if (extension === "ts" || extension === "tsx")
        return "text/typescript";
    if (extension === "js" || extension === "jsx")
        return "text/javascript";
    if (extension === "md")
        return "text/markdown";
    if (extension === "html")
        return "text/html";
    if (extension === "css")
        return "text/css";
    if (extension === "png")
        return "image/png";
    if (extension === "jpg" || extension === "jpeg")
        return "image/jpeg";
    if (extension === "gif")
        return "image/gif";
    if (extension === "webp")
        return "image/webp";
    return "text/plain";
}
function imageMime(bytes) {
    if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
        return "image/png";
    if (startsWith(bytes, [0xff, 0xd8, 0xff]))
        return "image/jpeg";
    if (startsWith(bytes, [0x47, 0x49, 0x46, 0x38]))
        return "image/gif";
    if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) &&
        startsWith(bytes.slice(8), [0x57, 0x45, 0x42, 0x50]))
        return "image/webp";
}
function startsWith(bytes, prefix) {
    return prefix.every(function (value, index) { return bytes[index] === value; });
}
function readSearchText(path) {
    return __awaiter(this, void 0, void 0, function () {
        var file, bytes, _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    _c.trys.push([0, 3, , 4]);
                    file = Bun.file(path);
                    return [4 /*yield*/, file.size];
                case 1:
                    if ((_c.sent()) > maxSearchFileBytes)
                        return [2 /*return*/, undefined];
                    _a = Uint8Array.bind;
                    return [4 /*yield*/, file.arrayBuffer()];
                case 2:
                    bytes = new (_a.apply(Uint8Array, [void 0, _c.sent()]))();
                    if (bytes.includes(0))
                        return [2 /*return*/, undefined];
                    return [2 /*return*/, new TextDecoder("utf-8", { fatal: true }).decode(bytes)];
                case 3:
                    _b = _c.sent();
                    // Binary/invalid-UTF-8 files and files removed during the walk are simply
                    // not searchable; one bad entry must not abort the whole query.
                    return [2 /*return*/, undefined];
                case 4: return [2 /*return*/];
            }
        });
    });
}
function globExpression(pattern) {
    var expression = "";
    for (var index = 0; index < pattern.length; index++) {
        var character = pattern[index];
        var next = pattern[index + 1];
        if (character === "*" && next === "*") {
            index++;
            if (pattern[index + 1] === "/") {
                index++;
                expression += "(?:.*/)?";
                continue;
            }
            expression += ".*";
            continue;
        }
        if (character === "*") {
            expression += "[^/]*";
            continue;
        }
        if (character === "?") {
            expression += "[^/]";
            continue;
        }
        expression += character.replace(/[|\\{}()[\]^$+?.]/gu, "\\$&");
    }
    return expression;
}
function matchesInclude(path, include) {
    if (!include)
        return true;
    var prefix = include.includes("/") ? "" : "(?:.*/)?";
    return new RegExp("^".concat(prefix).concat(globExpression(include), "$"), "u").test(path);
}
/**
 * Returns true when a default-ignored directory is explicitly addressed by a
 * glob include prefix such as `devref/...` or `**\/devref/...`.
 * `**\/*` alone intentionally does not make every heavy directory walkable.
 */
function includeMayEnterDirectory(directory, include) {
    if (!include)
        return false;
    var normalized = include.replace(/\\/gu, "/").replace(/^\.\//u, "");
    var withoutLeadingGlob = normalized.startsWith("**/")
        ? normalized.slice(3)
        : normalized;
    return withoutLeadingGlob.startsWith("".concat(directory, "/"));
}
