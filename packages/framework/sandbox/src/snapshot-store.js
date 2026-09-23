"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
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
exports.SnapshotStore = exports.SandboxPromotionConflict = void 0;
/**
 * A git-free snapshot store — the "类 git" layer that gives every workspace
 * candidate/promotion/rollback semantics without requiring git.
 *
 * Git is a content-addressed store of snapshots with branches and merges. For
 * the sandbox we need a subset: a base snapshot to diff a candidate against,
 * a promotion that applies the candidate's changes to the host with a
 * last-known-good backup, and a rollback that restores it. That subset has no
 * reason to depend on git, and the worktree backend's `candidate/<id>`
 * branches are just one implementation of it.
 *
 * Performance: an index records content id and filesystem metadata for each
 * path, so re-capturing a tree that changed a few files hashes and stores only
 * those — untouched files reuse their object by a size/mtime/ctime match.
 *
 *   - capture/diff  → content-hash index of the candidate vs the base.
 *   - promote       → copy the changed files into the host, backing up the
 *     targets to `<id>.lkg` first (the last-known-good).
 *   - rollback      → restore the last-known-good backup.
 */
var promises_1 = require("node:fs/promises");
var node_path_1 = require("node:path");
var node_crypto_1 = require("node:crypto");
var object_store_1 = require("@natalia/object-store");
var diff_1 = require("./diff");
function walkFiles(root, ignore) {
    return __awaiter(this, void 0, void 0, function () {
        var files, stack, dir, entries, _i, entries_1, entry, path, rel;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    files = [];
                    stack = [root];
                    _a.label = 1;
                case 1:
                    if (!stack.length) return [3 /*break*/, 3];
                    dir = stack.pop();
                    return [4 /*yield*/, (0, promises_1.readdir)(dir, { withFileTypes: true })];
                case 2:
                    entries = _a.sent();
                    for (_i = 0, entries_1 = entries; _i < entries_1.length; _i++) {
                        entry = entries_1[_i];
                        path = (0, node_path_1.join)(dir, entry.name);
                        rel = (0, node_path_1.relative)(root, path).split("/").join("/");
                        if (ignore === null || ignore === void 0 ? void 0 : ignore(rel, entry.isDirectory()))
                            continue;
                        if (entry.isDirectory())
                            stack.push(path);
                        else if (entry.isFile())
                            files.push(path);
                    }
                    return [3 /*break*/, 1];
                case 3: return [2 /*return*/, files];
            }
        });
    });
}
/**
 * A promotion whose candidate was built from a snapshot the host has moved past.
 *
 * Typed rather than a message, because the caller's response differs: a conflict
 * is a state to report (`sandbox.update` with `conflicted`) and a candidate to
 * rebase, not a failed operation to retry.
 */
var SandboxPromotionConflict = /** @class */ (function (_super) {
    __extends(SandboxPromotionConflict, _super);
    function SandboxPromotionConflict(paths) {
        var _this = _super.call(this, "promotion conflicts with changes already on the host: ".concat(paths.join("; "), ". ") +
            "The candidate was built from a snapshot that no longer matches, so " +
            "promoting it would discard the newer work. Rebase the candidate onto " +
            "the current host and review it again.") || this;
        _this.name = "SandboxPromotionConflict";
        _this.paths = paths;
        return _this;
    }
    return SandboxPromotionConflict;
}(Error));
exports.SandboxPromotionConflict = SandboxPromotionConflict;
/**
 * Resolves a snapshot-relative path against a root, refusing anything that
 * escapes it.
 *
 * Shared by `materialize` and `promote`: both write at paths that came from a
 * walk, and both must fail closed if that ever stops being true.
 */
function containPath(root, path) {
    var target = (0, node_path_1.resolve)(root, path);
    var rel = (0, node_path_1.relative)((0, node_path_1.resolve)(root), target);
    if (rel.startsWith("..") || rel === "" || (0, node_path_1.isAbsolute)(rel))
        throw new Error("snapshot path escapes worktree: ".concat(path));
    return target;
}
var SnapshotStore = /** @class */ (function () {
    function SnapshotStore(objects, storeDir) {
        this.objects = objects;
        this.storeDir = storeDir;
    }
    /**
     * Indexes every file under a root, reusing the previous index's object ids
     * for files whose size, mtime and ctime are unchanged (an `ignore` rel-path
     * filter excluded). Older indices without ctime are conservatively re-hashed.
     */
    SnapshotStore.prototype.capture = function (root, previous, ignore) {
        return __awaiter(this, void 0, void 0, function () {
            var index, _i, _a, path, rel, info, prior, _b, _c, _d, _e, _f;
            var _g;
            return __generator(this, function (_h) {
                switch (_h.label) {
                    case 0:
                        index = new Map();
                        _i = 0;
                        return [4 /*yield*/, walkFiles(root, ignore)];
                    case 1:
                        _a = _h.sent();
                        _h.label = 2;
                    case 2:
                        if (!(_i < _a.length)) return [3 /*break*/, 7];
                        path = _a[_i];
                        rel = (0, node_path_1.relative)(root, path).split("/").join("/");
                        return [4 /*yield*/, (0, promises_1.stat)(path)];
                    case 3:
                        info = _h.sent();
                        prior = previous === null || previous === void 0 ? void 0 : previous.get(rel);
                        if (prior &&
                            prior.ctimeMs !== undefined &&
                            prior.size === info.size &&
                            prior.mtimeMs === info.mtimeMs &&
                            prior.ctimeMs === info.ctimeMs) {
                            index.set(rel, prior);
                            return [3 /*break*/, 6];
                        }
                        _c = (_b = index).set;
                        _d = [rel];
                        _g = {};
                        _f = (_e = this.objects).put;
                        return [4 /*yield*/, (0, promises_1.readFile)(path)];
                    case 4: return [4 /*yield*/, _f.apply(_e, [_h.sent()])];
                    case 5:
                        _c.apply(_b, _d.concat([(_g.objectID = _h.sent(),
                                _g.size = info.size,
                                _g.mtimeMs = info.mtimeMs,
                                _g.ctimeMs = info.ctimeMs,
                                _g)]));
                        _h.label = 6;
                    case 6:
                        _i++;
                        return [3 /*break*/, 2];
                    case 7: return [2 /*return*/, index];
                }
            });
        });
    };
    /** Checks out an index into an empty candidate worktree. */
    SnapshotStore.prototype.materialize = function (root, index) {
        return __awaiter(this, void 0, void 0, function () {
            var candidate, _i, index_1, _a, path, entry, target, _b, _c, info;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        candidate = new Map();
                        _i = 0, index_1 = index;
                        _d.label = 1;
                    case 1:
                        if (!(_i < index_1.length)) return [3 /*break*/, 7];
                        _a = index_1[_i], path = _a[0], entry = _a[1];
                        target = containPath(root, path);
                        return [4 /*yield*/, (0, promises_1.mkdir)((0, node_path_1.dirname)(target), { recursive: true })];
                    case 2:
                        _d.sent();
                        _b = promises_1.writeFile;
                        _c = [target];
                        return [4 /*yield*/, this.objects.get(entry.objectID)];
                    case 3: return [4 /*yield*/, _b.apply(void 0, _c.concat([_d.sent()]))];
                    case 4:
                        _d.sent();
                        return [4 /*yield*/, (0, promises_1.stat)(target)];
                    case 5:
                        info = _d.sent();
                        candidate.set(path, {
                            objectID: entry.objectID,
                            size: info.size,
                            mtimeMs: info.mtimeMs,
                            ctimeMs: info.ctimeMs,
                        });
                        _d.label = 6;
                    case 6:
                        _i++;
                        return [3 /*break*/, 1];
                    case 7: return [2 /*return*/, candidate];
                }
            });
        });
    };
    /** The candidate's changes against the base, by content hash. */
    SnapshotStore.prototype.diff = function (_candidateRoot, base, candidateIndex) {
        return __awaiter(this, void 0, void 0, function () {
            var changes, _i, candidateIndex_1, _a, path, candidateEntry, baseEntry, content, text, before, after, text, _b, _c, path, before, text;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        changes = [];
                        _i = 0, candidateIndex_1 = candidateIndex;
                        _d.label = 1;
                    case 1:
                        if (!(_i < candidateIndex_1.length)) return [3 /*break*/, 9];
                        _a = candidateIndex_1[_i], path = _a[0], candidateEntry = _a[1];
                        baseEntry = base.get(path);
                        if (!!baseEntry) return [3 /*break*/, 4];
                        return [4 /*yield*/, this.objectText(candidateEntry.objectID)];
                    case 2:
                        content = _d.sent();
                        return [4 /*yield*/, this.diffTextCached(path, undefined, content)];
                    case 3:
                        text = _d.sent();
                        changes.push(__assign(__assign(__assign(__assign({ kind: "add", path: path }, (content !== undefined ? { after: content } : {})), (text.patch ? { patch: text.patch } : {})), (text.structured ? { structured: text.structured } : {})), { additions: text.additions, deletions: text.deletions }));
                        return [3 /*break*/, 8];
                    case 4:
                        if (!(candidateEntry.objectID !== baseEntry.objectID)) return [3 /*break*/, 8];
                        return [4 /*yield*/, this.objectText(baseEntry.objectID)];
                    case 5:
                        before = _d.sent();
                        return [4 /*yield*/, this.objectText(candidateEntry.objectID)];
                    case 6:
                        after = _d.sent();
                        return [4 /*yield*/, this.diffTextCached(path, before, after)];
                    case 7:
                        text = _d.sent();
                        changes.push(__assign(__assign(__assign(__assign(__assign({ kind: "modify", path: path }, (before !== undefined ? { before: before } : {})), (after !== undefined ? { after: after } : {})), (text.patch ? { patch: text.patch } : {})), (text.structured ? { structured: text.structured } : {})), { additions: text.additions, deletions: text.deletions }));
                        _d.label = 8;
                    case 8:
                        _i++;
                        return [3 /*break*/, 1];
                    case 9:
                        _b = 0, _c = base.keys();
                        _d.label = 10;
                    case 10:
                        if (!(_b < _c.length)) return [3 /*break*/, 14];
                        path = _c[_b];
                        if (!!candidateIndex.has(path)) return [3 /*break*/, 13];
                        return [4 /*yield*/, this.objectText(base.get(path).objectID)];
                    case 11:
                        before = _d.sent();
                        return [4 /*yield*/, this.diffTextCached(path, before, undefined)];
                    case 12:
                        text = _d.sent();
                        changes.push(__assign(__assign(__assign(__assign({ kind: "delete", path: path }, (before !== undefined ? { before: before } : {})), (text.patch ? { patch: text.patch } : {})), (text.structured ? { structured: text.structured } : {})), { additions: text.additions, deletions: text.deletions }));
                        _d.label = 13;
                    case 13:
                        _b++;
                        return [3 /*break*/, 10];
                    case 14: return [2 /*return*/, changes];
                }
            });
        });
    };
    SnapshotStore.prototype.objectText = function (objectID) {
        return __awaiter(this, void 0, void 0, function () {
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, this.objects.get(objectID)];
                    case 1: return [2 /*return*/, (_b.sent()).toString("utf8")];
                    case 2:
                        _a = _b.sent();
                        return [2 /*return*/, undefined];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    SnapshotStore.prototype.diffTextCached = function (path, before, after) {
        return __awaiter(this, void 0, void 0, function () {
            var oldText, newText, cache, cached, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        oldText = before !== null && before !== void 0 ? before : "";
                        newText = after !== null && after !== void 0 ? after : "";
                        cache = new object_store_1.DiffCache(this.objects, "snapshot-diff");
                        return [4 /*yield*/, cache.get(oldText, newText)];
                    case 1:
                        cached = _a.sent();
                        if (cached)
                            return [2 /*return*/, {
                                    additions: cached.additions,
                                    deletions: cached.deletions,
                                    structured: cached.structured,
                                }];
                        return [4 /*yield*/, (0, diff_1.diffTextAsync)(path, before, after)];
                    case 2:
                        result = _a.sent();
                        if (!result.structured) return [3 /*break*/, 4];
                        return [4 /*yield*/, cache.set(oldText, newText, {
                                additions: result.additions,
                                deletions: result.deletions,
                                structured: result.structured,
                            })];
                    case 3:
                        _a.sent();
                        _a.label = 4;
                    case 4: return [2 /*return*/, result];
                }
            });
        });
    };
    SnapshotStore.prototype.saveIndex = function (id, index) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (0, promises_1.mkdir)(this.storeDir, { recursive: true })];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(this.storeDir, "".concat(id, ".base.json")), JSON.stringify(__spreadArray([], index, true)))];
                    case 2:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    SnapshotStore.prototype.loadIndex = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.load("".concat(id, ".base.json"))];
            });
        });
    };
    SnapshotStore.prototype.saveCandidateIndex = function (id, index) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (0, promises_1.mkdir)(this.storeDir, { recursive: true })];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(this.storeDir, "".concat(id, ".candidate.json")), JSON.stringify(__spreadArray([], index, true)))];
                    case 2:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    SnapshotStore.prototype.loadCandidateIndex = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.load("".concat(id, ".candidate.json"))];
            });
        });
    };
    SnapshotStore.prototype.load = function (name) {
        return __awaiter(this, void 0, void 0, function () {
            var parsed, _a, _b, error_1;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        _c.trys.push([0, 2, , 3]);
                        _b = (_a = JSON).parse;
                        return [4 /*yield*/, (0, promises_1.readFile)((0, node_path_1.join)(this.storeDir, name), "utf8")];
                    case 1:
                        parsed = _b.apply(_a, [_c.sent()]);
                        return [2 /*return*/, new Map(parsed)];
                    case 2:
                        error_1 = _c.sent();
                        if (error_1.code === "ENOENT")
                            return [2 /*return*/, undefined];
                        throw error_1;
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /** Where one sandbox's last-known-good backups and their record live. */
    SnapshotStore.prototype.lkgDir = function (id) {
        return (0, node_path_1.join)(this.storeDir, "".concat(id, ".lkg"));
    };
    SnapshotStore.prototype.lkgRecordPath = function (id) {
        // Beside the directory rather than inside it: a change path could be any
        // name, and the record must not be able to collide with a backed-up file.
        return (0, node_path_1.join)(this.storeDir, "".concat(id, ".lkg.json"));
    };
    /**
     * Promotes the candidate's changes into the host: backs each target up to
     * `<id>.lkg` (the last-known-good), applies the candidate file, and removes
     * the target for a deletion. Authorize runs on the changed paths before
     * anything is touched.
     *
     * A promote is a sequence of filesystem writes with no transaction behind it,
     * so a failure part-way is undone from the record before the error is
     * rethrown. Without that, a caller reporting "the host is unchanged" after a
     * failed promote would be describing something that is not true.
     */
    SnapshotStore.prototype.promote = function (id, candidateRoot, hostRoot, changes, authorize, base) {
        return __awaiter(this, void 0, void 0, function () {
            var paths, lkgDir, record, _i, changes_1, change, target, backupPath, existedBefore, _a, _b, _c, _d, error_2;
            return __generator(this, function (_e) {
                switch (_e.label) {
                    case 0:
                        paths = changes
                            .filter(function (change) { return change.kind !== "delete"; })
                            .map(function (change) { return change.path; });
                        return [4 /*yield*/, (authorize === null || authorize === void 0 ? void 0 : authorize(paths))];
                    case 1:
                        _e.sent();
                        if (!base) return [3 /*break*/, 3];
                        return [4 /*yield*/, this.assertNoConflict(hostRoot, changes, base)];
                    case 2:
                        _e.sent();
                        _e.label = 3;
                    case 3:
                        lkgDir = this.lkgDir(id);
                        return [4 /*yield*/, (0, promises_1.mkdir)(lkgDir, { recursive: true })];
                    case 4:
                        _e.sent();
                        record = { version: 1, applied: [] };
                        _i = 0, changes_1 = changes;
                        _e.label = 5;
                    case 5:
                        if (!(_i < changes_1.length)) return [3 /*break*/, 28];
                        change = changes_1[_i];
                        target = containPath(hostRoot, change.path);
                        backupPath = containPath(lkgDir, change.path);
                        return [4 /*yield*/, this.pathExists(target)];
                    case 6:
                        existedBefore = _e.sent();
                        _e.label = 7;
                    case 7:
                        _e.trys.push([7, 18, , 26]);
                        return [4 /*yield*/, (0, promises_1.mkdir)((0, node_path_1.dirname)(backupPath), { recursive: true })];
                    case 8:
                        _e.sent();
                        if (!existedBefore) return [3 /*break*/, 11];
                        _a = promises_1.writeFile;
                        _b = [backupPath];
                        return [4 /*yield*/, (0, promises_1.readFile)(target)];
                    case 9: return [4 /*yield*/, _a.apply(void 0, _b.concat([_e.sent()]))];
                    case 10:
                        _e.sent();
                        _e.label = 11;
                    case 11:
                        if (!(change.kind === "delete")) return [3 /*break*/, 13];
                        // A deletion is an operation, not an absence of one: the file the
                        // candidate removed must leave the host, or approving a PR that
                        // deletes a file silently does nothing.
                        return [4 /*yield*/, (0, promises_1.rm)(target, { force: true })];
                    case 12:
                        // A deletion is an operation, not an absence of one: the file the
                        // candidate removed must leave the host, or approving a PR that
                        // deletes a file silently does nothing.
                        _e.sent();
                        return [3 /*break*/, 17];
                    case 13: return [4 /*yield*/, (0, promises_1.mkdir)((0, node_path_1.dirname)(target), { recursive: true })];
                    case 14:
                        _e.sent();
                        _c = promises_1.writeFile;
                        _d = [target];
                        return [4 /*yield*/, (0, promises_1.readFile)(containPath(candidateRoot, change.path))];
                    case 15: return [4 /*yield*/, _c.apply(void 0, _d.concat([_e.sent()]))];
                    case 16:
                        _e.sent();
                        _e.label = 17;
                    case 17: return [3 /*break*/, 26];
                    case 18:
                        error_2 = _e.sent();
                        // The record covers what already landed, and this change is undone from
                        // its backup: a change that failed after removing the target would
                        // otherwise leave the host missing a file it never agreed to lose.
                        return [4 /*yield*/, this.undoPromotion(hostRoot, id, record)];
                    case 19:
                        // The record covers what already landed, and this change is undone from
                        // its backup: a change that failed after removing the target would
                        // otherwise leave the host missing a file it never agreed to lose.
                        _e.sent();
                        if (!(change.kind === "delete" && existedBefore)) return [3 /*break*/, 21];
                        return [4 /*yield*/, this.restoreFromBackup(lkgDir, hostRoot, change.path)];
                    case 20:
                        _e.sent();
                        return [3 /*break*/, 25];
                    case 21:
                        if (!(change.kind !== "delete" && existedBefore)) return [3 /*break*/, 23];
                        return [4 /*yield*/, this.restoreFromBackup(lkgDir, hostRoot, change.path)];
                    case 22:
                        _e.sent();
                        return [3 /*break*/, 25];
                    case 23:
                        if (!(change.kind !== "delete" && !existedBefore)) return [3 /*break*/, 25];
                        return [4 /*yield*/, (0, promises_1.rm)(target, { force: true })];
                    case 24:
                        _e.sent();
                        _e.label = 25;
                    case 25: throw error_2;
                    case 26:
                        record.applied.push({
                            path: change.path,
                            kind: change.kind,
                            existedBefore: existedBefore,
                        });
                        _e.label = 27;
                    case 27:
                        _i++;
                        return [3 /*break*/, 5];
                    case 28: return [4 /*yield*/, (0, promises_1.writeFile)(this.lkgRecordPath(id), JSON.stringify(record))];
                    case 29:
                        _e.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    /** Undoes everything a promotion record lists, newest first. */
    SnapshotStore.prototype.undoPromotion = function (hostRoot, id, record) {
        return __awaiter(this, void 0, void 0, function () {
            var lkgDir, _i, _a, applied, target, _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        lkgDir = this.lkgDir(id);
                        _i = 0, _a = __spreadArray([], record.applied, true).reverse();
                        _c.label = 1;
                    case 1:
                        if (!(_i < _a.length)) return [3 /*break*/, 8];
                        applied = _a[_i];
                        target = containPath(hostRoot, applied.path);
                        _c.label = 2;
                    case 2:
                        _c.trys.push([2, 6, , 7]);
                        if (!!applied.existedBefore) return [3 /*break*/, 4];
                        return [4 /*yield*/, (0, promises_1.rm)(target, { force: true })];
                    case 3:
                        _c.sent();
                        return [3 /*break*/, 7];
                    case 4: return [4 /*yield*/, this.restoreFromBackup(lkgDir, hostRoot, applied.path)];
                    case 5:
                        _c.sent();
                        return [3 /*break*/, 7];
                    case 6:
                        _b = _c.sent();
                        return [3 /*break*/, 7];
                    case 7:
                        _i++;
                        return [3 /*break*/, 1];
                    case 8: return [2 /*return*/];
                }
            });
        });
    };
    SnapshotStore.prototype.restoreFromBackup = function (lkgDir, hostRoot, path) {
        return __awaiter(this, void 0, void 0, function () {
            var backup, target, _a, _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        backup = containPath(lkgDir, path);
                        target = containPath(hostRoot, path);
                        return [4 /*yield*/, (0, promises_1.mkdir)((0, node_path_1.dirname)(target), { recursive: true })];
                    case 1:
                        _c.sent();
                        _a = promises_1.writeFile;
                        _b = [target];
                        return [4 /*yield*/, (0, promises_1.readFile)(backup)];
                    case 2: return [4 /*yield*/, _a.apply(void 0, _b.concat([_c.sent()]))];
                    case 3:
                        _c.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Refuses a promotion whose base no longer matches the host.
     *
     * A candidate is built from a snapshot, and a promotion used to assume the
     * host was still at that snapshot. Two candidates taken from the same base and
     * both editing one file break that assumption: the first lands, and the second
     * overwrites it — the first candidate's work disappearing with nothing
     * reported. This is the case the ownership map is meant to prevent, and the
     * check is here because the map is a declaration, not a guarantee.
     */
    SnapshotStore.prototype.assertNoConflict = function (hostRoot, changes, base) {
        return __awaiter(this, void 0, void 0, function () {
            var conflicts, _i, changes_2, change, expected, target, raw, actual;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        conflicts = [];
                        _i = 0, changes_2 = changes;
                        _b.label = 1;
                    case 1:
                        if (!(_i < changes_2.length)) return [3 /*break*/, 4];
                        change = changes_2[_i];
                        expected = (_a = base.get(change.path)) === null || _a === void 0 ? void 0 : _a.objectID;
                        target = containPath(hostRoot, change.path);
                        return [4 /*yield*/, (0, promises_1.readFile)(target).catch(function () { return undefined; })];
                    case 2:
                        raw = _b.sent();
                        actual = raw
                            ? (0, node_crypto_1.createHash)("sha256").update(raw).digest("hex")
                            : undefined;
                        // `add` expects nothing on the host; `modify` and `delete` expect exactly
                        // the base blob. Anything else means the host moved under the candidate.
                        if (actual !== expected)
                            conflicts.push("".concat(change.path, " (host is ").concat(actual ? "modified" : "missing", ", ") +
                                "candidate was built from ".concat(expected ? "an earlier revision" : "nothing", ")"));
                        _b.label = 3;
                    case 3:
                        _i++;
                        return [3 /*break*/, 1];
                    case 4:
                        if (conflicts.length)
                            throw new SandboxPromotionConflict(conflicts);
                        return [2 /*return*/];
                }
            });
        });
    };
    SnapshotStore.prototype.pathExists = function (path) {
        return __awaiter(this, void 0, void 0, function () {
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, (0, promises_1.stat)(path)];
                    case 1:
                        _b.sent();
                        return [2 /*return*/, true];
                    case 2:
                        _a = _b.sent();
                        return [2 /*return*/, false];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Restores the host to the last-known-good state recorded by the last
     * promote: backed-up files are written back and files the promote created are
     * removed.
     *
     * Removing the created ones is the half that a restore-only rollback misses.
     * Their backups are empty, so writing the backups back leaves zero-byte files
     * where the promote had put real content — a rollback that leaves the host
     * changed in a way nothing ever reported.
     */
    SnapshotStore.prototype.rollback = function (hostRoot, id) {
        return __awaiter(this, void 0, void 0, function () {
            var lkgDir, record, _i, _a, applied, target, _b, _c, path, rel;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        lkgDir = this.lkgDir(id);
                        return [4 /*yield*/, this.pathExists(lkgDir)];
                    case 1:
                        if (!(_d.sent()))
                            return [2 /*return*/, false];
                        return [4 /*yield*/, this.loadPromotionRecord(id)];
                    case 2:
                        record = _d.sent();
                        if (!record) return [3 /*break*/, 9];
                        _i = 0, _a = __spreadArray([], record.applied, true).reverse();
                        _d.label = 3;
                    case 3:
                        if (!(_i < _a.length)) return [3 /*break*/, 8];
                        applied = _a[_i];
                        target = containPath(hostRoot, applied.path);
                        if (!!applied.existedBefore) return [3 /*break*/, 5];
                        return [4 /*yield*/, (0, promises_1.rm)(target, { force: true })];
                    case 4:
                        _d.sent();
                        return [3 /*break*/, 7];
                    case 5: return [4 /*yield*/, this.restoreFromBackup(lkgDir, hostRoot, applied.path)];
                    case 6:
                        _d.sent();
                        _d.label = 7;
                    case 7:
                        _i++;
                        return [3 /*break*/, 3];
                    case 8: return [2 /*return*/, true];
                    case 9:
                        _b = 0;
                        return [4 /*yield*/, walkFiles(lkgDir)];
                    case 10:
                        _c = _d.sent();
                        _d.label = 11;
                    case 11:
                        if (!(_b < _c.length)) return [3 /*break*/, 14];
                        path = _c[_b];
                        rel = (0, node_path_1.relative)(lkgDir, path).split("/").join("/");
                        return [4 /*yield*/, this.restoreFromBackup(lkgDir, hostRoot, rel)];
                    case 12:
                        _d.sent();
                        _d.label = 13;
                    case 13:
                        _b++;
                        return [3 /*break*/, 11];
                    case 14: return [2 /*return*/, true];
                }
            });
        });
    };
    /** The record a promote wrote, or undefined for a pre-record last-known-good. */
    SnapshotStore.prototype.loadPromotionRecord = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            var raw, parsed, _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, (0, promises_1.readFile)(this.lkgRecordPath(id), "utf8")];
                    case 1:
                        raw = _b.sent();
                        parsed = JSON.parse(raw);
                        return [2 /*return*/, (parsed === null || parsed === void 0 ? void 0 : parsed.applied) ? parsed : undefined];
                    case 2:
                        _a = _b.sent();
                        return [2 /*return*/, undefined];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /** Whether a last-known-good exists for the sandbox. */
    SnapshotStore.prototype.hasLastKnownGood = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, (0, promises_1.stat)((0, node_path_1.join)(this.storeDir, "".concat(id, ".lkg")))];
                    case 1:
                        _b.sent();
                        return [2 /*return*/, true];
                    case 2:
                        _a = _b.sent();
                        return [2 /*return*/, false];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Every object id the snapshot indices reference — the union of every base
     * and candidate index under the store. The shared object library's GC uses
     * this so one owner never prunes another's live objects.
     */
    SnapshotStore.prototype.referencedObjectIDs = function () {
        return __awaiter(this, void 0, void 0, function () {
            var ids, _i, _a, name_1, index, _b, _c, entry;
            var _d;
            return __generator(this, function (_e) {
                switch (_e.label) {
                    case 0:
                        ids = new Set();
                        _i = 0;
                        return [4 /*yield*/, (0, promises_1.readdir)(this.storeDir).catch(function () { return []; })];
                    case 1:
                        _a = _e.sent();
                        _e.label = 2;
                    case 2:
                        if (!(_i < _a.length)) return [3 /*break*/, 5];
                        name_1 = _a[_i];
                        if (!name_1.endsWith(".json"))
                            return [3 /*break*/, 4];
                        return [4 /*yield*/, this.load(name_1)];
                    case 3:
                        index = _e.sent();
                        for (_b = 0, _c = (_d = index === null || index === void 0 ? void 0 : index.values()) !== null && _d !== void 0 ? _d : []; _b < _c.length; _b++) {
                            entry = _c[_b];
                            ids.add(entry.objectID);
                        }
                        _e.label = 4;
                    case 4:
                        _i++;
                        return [3 /*break*/, 2];
                    case 5: return [2 /*return*/, ids];
                }
            });
        });
    };
    return SnapshotStore;
}());
exports.SnapshotStore = SnapshotStore;
