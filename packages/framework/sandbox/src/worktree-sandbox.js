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
exports.WorktreeSandboxManager = void 0;
/**
 * The Advanced Sandbox production backend (P9): a worktree-based sandbox.
 *
 * This manager extends `WorkspaceSandboxManager`, so it is a drop-in for the
 * full operational surface the sandbox tools use (execute, resources, file
 * ops, persistence) — and adds real git semantics on top: a sandbox is a
 * worktree on a candidate branch (`candidate/<id>`) off the system head, so
 * the agent's changes are commits the host can diff, preview and promote, and
 * the system slot keeps a last-known-good commit to roll back to. That is the
 * mechanism 半自迭代 requires: agent edits in the candidate worktree, a human
 * approves the preview, promotion lands them in the system branch atomically,
 * and a failed activation rolls back to last-known-good.
 *
 * The manager runs `git` in the host repo. Workspaces that are not git repos
 * fall back to the directory-copy manager; container/VM isolation is a later,
 * threat-model-driven step.
 */
var promises_1 = require("node:fs/promises");
var node_path_1 = require("node:path");
var platform_1 = require("@natalia/platform");
var workspace_manager_1 = require("./workspace-manager");
var governance_1 = require("./governance");
var diff_1 = require("./diff");
/** Runs `git` and returns stdout trimmed; throws with stderr on failure. */
function git(cwd, args) {
    return __awaiter(this, void 0, void 0, function () {
        var process, _a, stdout, stderr, exitCode;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    process = Bun.spawn(__spreadArray(["git"], args, true), {
                        cwd: cwd,
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
                    if (exitCode !== 0)
                        throw new Error("git ".concat(args.join(" "), " failed: ").concat(stderr.trim() || stdout.trim()));
                    return [2 /*return*/, stdout.trim()];
            }
        });
    });
}
/** Like `git`, but returns the raw output untrimmed (for `-z` porcelain). */
function gitRaw(cwd, args) {
    return __awaiter(this, void 0, void 0, function () {
        var process, _a, stdout, stderr, exitCode;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    process = Bun.spawn(__spreadArray(["git"], args, true), {
                        cwd: cwd,
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
                    if (exitCode !== 0)
                        throw new Error("git ".concat(args.join(" "), " failed: ").concat(stderr.trim() || stdout.trim()));
                    return [2 /*return*/, stdout];
            }
        });
    });
}
function extractPatchForPath(rawDiff, path) {
    var sections = rawDiff.split(/(?=^diff --git )/m);
    for (var _i = 0, sections_1 = sections; _i < sections_1.length; _i++) {
        var section = sections_1[_i];
        if (section.includes("b/".concat(path)) || section.includes("a/".concat(path)))
            return section.trimEnd() + "\n";
    }
    return undefined;
}
function patchCounts(patch) {
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
var WorktreeSandboxManager = /** @class */ (function (_super) {
    __extends(WorktreeSandboxManager, _super);
    function WorktreeSandboxManager(hostRoot) {
        var _this = _super.call(this, (0, node_path_1.resolve)(hostRoot, ".natalia", "sandboxes")) || this;
        _this.hostRoot = hostRoot;
        return _this;
    }
    /** The commit the host system branch is on. */
    WorktreeSandboxManager.prototype.systemHead = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, git(this.hostRoot, ["rev-parse", "HEAD"])];
            });
        });
    };
    /** The name of the host system branch. */
    WorktreeSandboxManager.prototype.systemBranch = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, git(this.hostRoot, ["rev-parse", "--abbrev-ref", "HEAD"])];
            });
        });
    };
    WorktreeSandboxManager.prototype.snapshotIgnoreRules = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (0, platform_1.ensureNataliaIgnoreFile)(this.hostRoot)];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, (0, platform_1.loadNataliaIgnore)(this.hostRoot)];
                    case 2: return [2 /*return*/, (_a.sent()).rules];
                }
            });
        });
    };
    WorktreeSandboxManager.prototype.isInternalCandidatePath = function (rel) {
        return (rel === platform_1.NATALIA_IGNORE_FILE ||
            rel === ".gitignore" ||
            rel === ".natalia-manifest.json" ||
            rel === ".git" ||
            rel.startsWith(".git/") ||
            rel === ".natalia" ||
            rel.startsWith(".natalia/"));
    };
    /**
     * Git normally hides ignored untracked files from `status`. The sandbox's
     * ignore contract is .nataliaignore, not .gitignore, so forced-add every
     * changed path that .nataliaignore did not exclude.
     */
    WorktreeSandboxManager.prototype.commitPendingChanges = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            var root, rules, paths, status, _i, _a, record, path, ignored, _b, _c, path, changed;
            var _this = this;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        root = (0, node_path_1.resolve)(this["baseRoot"], id);
                        return [4 /*yield*/, this.snapshotIgnoreRules()];
                    case 1:
                        rules = _d.sent();
                        paths = new Set();
                        return [4 /*yield*/, gitRaw(root, [
                                "status",
                                "--porcelain",
                                "-z",
                                "--untracked-files=all",
                                "--",
                                ".",
                                ":(exclude).gitignore",
                                ":(exclude).natalia-manifest.json",
                            ]).catch(function () { return ""; })];
                    case 2:
                        status = _d.sent();
                        for (_i = 0, _a = status.split("\0").filter(Boolean); _i < _a.length; _i++) {
                            record = _a[_i];
                            path = record.slice(3);
                            if (path)
                                paths.add(path);
                        }
                        return [4 /*yield*/, gitRaw(root, [
                                "ls-files",
                                "--others",
                                "--ignored",
                                "--exclude-standard",
                                "-z",
                                "--",
                                ".",
                                ":(exclude).gitignore",
                                ":(exclude).natalia-manifest.json",
                            ]).catch(function () { return ""; })];
                    case 3:
                        ignored = _d.sent();
                        for (_b = 0, _c = ignored.split("\0").filter(Boolean); _b < _c.length; _b++) {
                            path = _c[_b];
                            paths.add(path);
                        }
                        changed = __spreadArray([], paths, true).filter(function (path) {
                            return path &&
                                !_this.isInternalCandidatePath(path) &&
                                !(0, platform_1.isSnapshotIgnored)(path, false, rules);
                        });
                        if (!changed.length)
                            return [2 /*return*/];
                        return [4 /*yield*/, git(root, __spreadArray(["add", "-f", "--"], changed, true))];
                    case 4:
                        _d.sent();
                        return [4 /*yield*/, git(root, ["commit", "-m", "sandbox ".concat(id, " changes")])];
                    case 5:
                        _d.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    /** Creates a sandbox as a worktree on a candidate branch off the system head. */
    WorktreeSandboxManager.prototype.create = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            var branch, root, base;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        branch = "candidate/".concat(id);
                        root = (0, node_path_1.resolve)(this["baseRoot"], id);
                        return [4 /*yield*/, this.systemHead()];
                    case 1:
                        base = _a.sent();
                        return [4 /*yield*/, git(this.hostRoot, ["worktree", "add", "-b", branch, root, base])];
                    case 2:
                        _a.sent();
                        // The manifest record must never enter a candidate diff, even when the
                        // agent runs `git add .` in the worktree.
                        return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.resolve)(root, ".gitignore"), ".natalia-manifest.json\n", {
                                flag: "a",
                            })];
                    case 3:
                        // The manifest record must never enter a candidate diff, even when the
                        // agent runs `git add .` in the worktree.
                        _a.sent();
                        return [4 /*yield*/, _super.prototype.create.call(this, id)];
                    case 4: 
                    // The base records the manifest (resources, env allowlist, changed files)
                    // at the worktree root; the record is ignored, so it never enters a diff.
                    return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    WorktreeSandboxManager.prototype.delete = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            var branch, root;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        branch = "candidate/".concat(id);
                        root = (0, node_path_1.resolve)(this["baseRoot"], id);
                        return [4 /*yield*/, git(this.hostRoot, ["worktree", "remove", "--force", root]).catch(function () { return undefined; })];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, git(this.hostRoot, ["branch", "-D", branch]).catch(function () { return undefined; })];
                    case 2:
                        _a.sent();
                        return [4 /*yield*/, _super.prototype.delete.call(this, id)];
                    case 3: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    /** Whether a candidate branch exists for the sandbox. */
    WorktreeSandboxManager.prototype.exists = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, git(this.hostRoot, ["rev-parse", "--verify", "candidate/".concat(id)])];
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
     * The changes the candidate made against its base, as a diff summary. This is
     * the preview a human approves before promotion — the real worktree diff, not
     * the manifest's change list.
     */
    WorktreeSandboxManager.prototype.previewMerge = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            var base, root, names, rawDiff, changes, readBase, readWorktree, _i, _a, line, _b, kind, path, oldPath, patch, before_1, before_2, _c, after_1, before, _d, after;
            var _this = this;
            return __generator(this, function (_e) {
                switch (_e.label) {
                    case 0: return [4 /*yield*/, this.baseFor(id)];
                    case 1:
                        base = _e.sent();
                        root = (0, node_path_1.resolve)(this["baseRoot"], id);
                        return [4 /*yield*/, this.commitPendingChanges(id)];
                    case 2:
                        _e.sent();
                        return [4 /*yield*/, git(root, ["diff", "--name-status", base])];
                    case 3:
                        names = _e.sent();
                        return [4 /*yield*/, gitRaw(root, [
                                "diff",
                                "--unified=3",
                                "--no-color",
                                base,
                            ]).catch(function () { return ""; })];
                    case 4:
                        rawDiff = _e.sent();
                        changes = [];
                        readBase = function (path) { return __awaiter(_this, void 0, void 0, function () {
                            var _a;
                            return __generator(this, function (_b) {
                                switch (_b.label) {
                                    case 0:
                                        _b.trys.push([0, 2, , 3]);
                                        return [4 /*yield*/, gitRaw(root, ["show", "".concat(base, ":").concat(path)])];
                                    case 1: return [2 /*return*/, _b.sent()];
                                    case 2:
                                        _a = _b.sent();
                                        return [2 /*return*/, undefined];
                                    case 3: return [2 /*return*/];
                                }
                            });
                        }); };
                        readWorktree = function (path) { return __awaiter(_this, void 0, void 0, function () {
                            var _a;
                            return __generator(this, function (_b) {
                                switch (_b.label) {
                                    case 0:
                                        _b.trys.push([0, 2, , 3]);
                                        return [4 /*yield*/, (0, promises_1.readFile)((0, node_path_1.resolve)(root, path), "utf8")];
                                    case 1: return [2 /*return*/, _b.sent()];
                                    case 2:
                                        _a = _b.sent();
                                        return [2 /*return*/, undefined];
                                    case 3: return [2 /*return*/];
                                }
                            });
                        }); };
                        _i = 0, _a = names.split("\n").filter(Boolean);
                        _e.label = 5;
                    case 5:
                        if (!(_i < _a.length)) return [3 /*break*/, 19];
                        line = _a[_i];
                        _b = line.split("\t"), kind = _b[0], path = _b[1], oldPath = _b[2];
                        patch = extractPatchForPath(rawDiff, path);
                        if (!(kind === "D")) return [3 /*break*/, 7];
                        return [4 /*yield*/, readBase(path)];
                    case 6:
                        before_1 = _e.sent();
                        changes.push(__assign(__assign(__assign(__assign({ kind: "delete", path: path }, (before_1 ? { before: before_1 } : {})), (patch ? { patch: patch } : {})), (patch ? { structured: (0, diff_1.unifiedPatchToStructured)(patch) } : {})), patchCounts(patch !== null && patch !== void 0 ? patch : "")));
                        return [3 /*break*/, 18];
                    case 7:
                        if (!(kind === "R")) return [3 /*break*/, 13];
                        if (!oldPath) return [3 /*break*/, 9];
                        return [4 /*yield*/, readBase(oldPath)];
                    case 8:
                        _c = _e.sent();
                        return [3 /*break*/, 11];
                    case 9: return [4 /*yield*/, readBase(path)];
                    case 10:
                        _c = _e.sent();
                        _e.label = 11;
                    case 11:
                        before_2 = _c;
                        return [4 /*yield*/, readWorktree(path)];
                    case 12:
                        after_1 = _e.sent();
                        changes.push(__assign(__assign(__assign(__assign(__assign({ kind: "rename", path: path, oldPath: oldPath }, (before_2 ? { before: before_2 } : {})), (after_1 ? { after: after_1 } : {})), (patch ? { patch: patch } : {})), (patch ? { structured: (0, diff_1.unifiedPatchToStructured)(patch) } : {})), patchCounts(patch !== null && patch !== void 0 ? patch : "")));
                        return [3 /*break*/, 18];
                    case 13:
                        if (!(kind === "A")) return [3 /*break*/, 14];
                        _d = undefined;
                        return [3 /*break*/, 16];
                    case 14: return [4 /*yield*/, readBase(path)];
                    case 15:
                        _d = _e.sent();
                        _e.label = 16;
                    case 16:
                        before = _d;
                        return [4 /*yield*/, readWorktree(path)];
                    case 17:
                        after = _e.sent();
                        changes.push(__assign(__assign(__assign(__assign(__assign({ kind: (kind === "M" ? "modify" : "add"), path: path }, (before ? { before: before } : {})), (after ? { after: after } : {})), (patch ? { patch: patch } : {})), (patch ? { structured: (0, diff_1.unifiedPatchToStructured)(patch) } : {})), patchCounts(patch !== null && patch !== void 0 ? patch : "")));
                        _e.label = 18;
                    case 18:
                        _i++;
                        return [3 /*break*/, 5];
                    case 19: return [2 /*return*/, changes];
                }
            });
        });
    };
    /**
     * Promotes a candidate into the system slot: the candidate branch is merged
     * into the system branch after the changed paths are authorized. The commit
     * before the merge is recorded as last-known-good, so a failed activation can
     * roll back. Base-compatible return: the changed files, as the copy-based
     * merge reports them.
     */
    WorktreeSandboxManager.prototype.merge = function (id, _hostRoot, authorize) {
        return __awaiter(this, void 0, void 0, function () {
            var branch, root, base, lastKnownGood, ahead, changedFiles, paths, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        branch = "candidate/".concat(id);
                        root = (0, node_path_1.resolve)(this["baseRoot"], id);
                        return [4 /*yield*/, this.baseFor(id)];
                    case 1:
                        base = _a.sent();
                        return [4 /*yield*/, this.systemHead()];
                    case 2:
                        lastKnownGood = _a.sent();
                        // Promotion works on commits. Commit pending worktree changes first,
                        // forcing in files .gitignore hides but .nataliaignore allows.
                        return [4 /*yield*/, this.commitPendingChanges(id)];
                    case 3:
                        // Promotion works on commits. Commit pending worktree changes first,
                        // forcing in files .gitignore hides but .nataliaignore allows.
                        _a.sent();
                        return [4 /*yield*/, git(this.hostRoot, [
                                "rev-list",
                                "--count",
                                "".concat(base, "..").concat(branch),
                            ])];
                    case 4:
                        ahead = _a.sent();
                        if (Number(ahead) === 0)
                            throw new Error("candidate ".concat(id, " has no changes to promote"));
                        return [4 /*yield*/, this.previewMerge(id)];
                    case 5:
                        changedFiles = _a.sent();
                        paths = changedFiles.map(function (change) { return change.path; });
                        if (!paths.length) return [3 /*break*/, 7];
                        return [4 /*yield*/, (authorize === null || authorize === void 0 ? void 0 : authorize(paths))];
                    case 6:
                        _a.sent();
                        _a.label = 7;
                    case 7: 
                    // Recorded before the merge is attempted, not after: a merge that conflicts
                    // never reaches an assignment placed after the `await`, and the commit it
                    // was about to build on is exactly what a rollback needs.
                    return [4 /*yield*/, this.setLastKnownGood({ commit: lastKnownGood, sandboxID: id })];
                    case 8:
                        // Recorded before the merge is attempted, not after: a merge that conflicts
                        // never reaches an assignment placed after the `await`, and the commit it
                        // was about to build on is exactly what a rollback needs.
                        _a.sent();
                        _a.label = 9;
                    case 9:
                        _a.trys.push([9, 11, , 13]);
                        return [4 /*yield*/, git(this.hostRoot, ["merge", "--no-ff", "--no-edit", branch])];
                    case 10:
                        _a.sent();
                        return [3 /*break*/, 13];
                    case 11:
                        error_1 = _a.sent();
                        // A conflicted merge leaves the host mid-merge with conflict markers and
                        // MERGE_HEAD set. Aborting is what returns it to a usable state; without
                        // it the next git command runs against a half-applied merge.
                        return [4 /*yield*/, git(this.hostRoot, ["merge", "--abort"]).catch(function () { return undefined; })];
                    case 12:
                        // A conflicted merge leaves the host mid-merge with conflict markers and
                        // MERGE_HEAD set. Aborting is what returns it to a usable state; without
                        // it the next git command runs against a half-applied merge.
                        _a.sent();
                        throw error_1;
                    case 13: return [2 /*return*/, changedFiles];
                }
            });
        });
    };
    /** Promotes and reports the full promotion record, including the commits. */
    WorktreeSandboxManager.prototype.promote = function (id, authorize) {
        return __awaiter(this, void 0, void 0, function () {
            var base, lastKnownGood, changedFiles;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, this.baseFor(id)];
                    case 1:
                        base = _b.sent();
                        return [4 /*yield*/, this.systemHead()];
                    case 2:
                        lastKnownGood = _b.sent();
                        return [4 /*yield*/, this.merge(id, this.hostRoot, authorize)];
                    case 3:
                        changedFiles = _b.sent();
                        _a = {
                            sandboxID: id,
                            base: base
                        };
                        return [4 /*yield*/, this.systemHead()];
                    case 4: return [2 /*return*/, (_a.promoted = _b.sent(),
                            _a.lastKnownGood = lastKnownGood,
                            _a.changedFiles = changedFiles,
                            _a)];
                }
            });
        });
    };
    /**
     * Validates the candidate and, when it passes, promotes it. When
     * `requireApprovalTier` is set, the human-approval hook runs only when the
     * candidate's governance risk tier clears the gate.
     */
    WorktreeSandboxManager.prototype.promoteWithValidation = function (id, input) {
        return __awaiter(this, void 0, void 0, function () {
            var command, evidence, authorize;
            var _this = this;
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
                        authorize = input.authorize && input.requireApprovalTier
                            ? function (paths) { return __awaiter(_this, void 0, void 0, function () {
                                var tier, _a;
                                return __generator(this, function (_b) {
                                    switch (_b.label) {
                                        case 0:
                                            _a = governance_1.riskTierForChanges;
                                            return [4 /*yield*/, this.previewMerge(id)];
                                        case 1:
                                            tier = _a.apply(void 0, [_b.sent()]);
                                            if (!(0, governance_1.requiresApproval)(tier, input.requireApprovalTier)) return [3 /*break*/, 3];
                                            return [4 /*yield*/, input.authorize(paths)];
                                        case 2:
                                            _b.sent();
                                            _b.label = 3;
                                        case 3: return [2 /*return*/];
                                    }
                                });
                            }); }
                            : input.authorize;
                        return [4 /*yield*/, this.promote(id, authorize)];
                    case 2: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    /** The recorded last-known-good commit, if any. */
    WorktreeSandboxManager.prototype.lastKnownGoodCommit = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _a;
            var _b, _c;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        if (!((_b = this.lastKnownGood) !== null && _b !== void 0)) return [3 /*break*/, 1];
                        _a = _b;
                        return [3 /*break*/, 3];
                    case 1: return [4 /*yield*/, this.loadLastKnownGood()];
                    case 2:
                        _a = (_d.sent());
                        _d.label = 3;
                    case 3: return [2 /*return*/, (_c = (_a)) === null || _c === void 0 ? void 0 : _c.commit];
                }
            });
        });
    };
    /**
     * Rolls the system slot back to the last-known-good commit — the rollback a
     * failed activation after promotion triggers.
     */
    WorktreeSandboxManager.prototype.rollback = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            var recorded, _a, lastKnownGood, dirty;
            var _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        if (!((_b = this.lastKnownGood) !== null && _b !== void 0)) return [3 /*break*/, 1];
                        _a = _b;
                        return [3 /*break*/, 3];
                    case 1: return [4 /*yield*/, this.loadLastKnownGood()];
                    case 2:
                        _a = (_c.sent());
                        _c.label = 3;
                    case 3:
                        recorded = _a;
                        if (!recorded)
                            return [2 /*return*/, { restored: false }];
                        // The recorded commit belongs to the last promotion, so undoing any other
                        // sandbox would revert work this rollback was never asked about.
                        if (recorded.sandboxID !== id)
                            return [2 /*return*/, { restored: false }];
                        lastKnownGood = recorded.commit;
                        return [4 /*yield*/, this.mergeInProgress()];
                    case 4:
                        if (!_c.sent()) return [3 /*break*/, 6];
                        // A merge left half-applied is the state a rollback exists to clear, so
                        // everything dirty belongs to it and aborting is safe.
                        return [4 /*yield*/, git(this.hostRoot, ["merge", "--abort"]).catch(function () { return undefined; })];
                    case 5:
                        // A merge left half-applied is the state a rollback exists to clear, so
                        // everything dirty belongs to it and aborting is safe.
                        _c.sent();
                        return [3 /*break*/, 8];
                    case 6: return [4 /*yield*/, this.uncommittedPaths()];
                    case 7:
                        dirty = _c.sent();
                        if (dirty.length)
                            // `reset --hard` would destroy work that predates the promotion. A
                            // rollback that loses the user's uncommitted edits is worse than one
                            // that refuses, so it refuses and names what is in the way.
                            throw new Error("cannot roll back to ".concat(lastKnownGood, ": the host has ").concat(dirty.length, " ") +
                                "uncommitted path(s) that a hard reset would discard " +
                                "(".concat(dirty.slice(0, 5).join(", ")).concat(dirty.length > 5 ? ", …" : "", ")"));
                        _c.label = 8;
                    case 8: return [4 /*yield*/, git(this.hostRoot, ["reset", "--hard", lastKnownGood])];
                    case 9:
                        _c.sent();
                        return [4 /*yield*/, this.setLastKnownGood(undefined)];
                    case 10:
                        _c.sent();
                        return [2 /*return*/, { restored: true }];
                }
            });
        });
    };
    /** Whether a merge is half-applied in the host tree. */
    WorktreeSandboxManager.prototype.mergeInProgress = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, git(this.hostRoot, ["rev-parse", "--verify", "MERGE_HEAD"])
                            .then(function () { return true; })
                            .catch(function () { return false; })];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    /** Host paths with uncommitted changes. */
    WorktreeSandboxManager.prototype.uncommittedPaths = function () {
        return __awaiter(this, void 0, void 0, function () {
            var output;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, git(this.hostRoot, [
                            "status",
                            "--porcelain",
                            "--untracked-files=no",
                        ]).catch(function () { return ""; })];
                    case 1:
                        output = _a.sent();
                        return [2 /*return*/, output
                                .split("\n")
                                .map(function (line) { return line.slice(3).trim(); })
                                .filter(Boolean)];
                }
            });
        });
    };
    /** Where the last-known-good commit is written, so it survives a restart. */
    WorktreeSandboxManager.prototype.lastKnownGoodPath = function () {
        return (0, node_path_1.join)(this["baseRoot"], "worktree-last-known-good.json");
    };
    WorktreeSandboxManager.prototype.setLastKnownGood = function (point) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        this.lastKnownGood = point;
                        if (!!point) return [3 /*break*/, 2];
                        return [4 /*yield*/, (0, promises_1.rm)(this.lastKnownGoodPath(), { force: true }).catch(function () { return undefined; })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                    case 2: return [4 /*yield*/, (0, promises_1.mkdir)((0, node_path_1.dirname)(this.lastKnownGoodPath()), { recursive: true })];
                    case 3:
                        _a.sent();
                        return [4 /*yield*/, (0, promises_1.writeFile)(this.lastKnownGoodPath(), JSON.stringify(point)).catch(function () { return undefined; })];
                    case 4:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    WorktreeSandboxManager.prototype.loadLastKnownGood = function () {
        return __awaiter(this, void 0, void 0, function () {
            var raw, parsed, _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, (0, promises_1.readFile)(this.lastKnownGoodPath(), "utf8")];
                    case 1:
                        raw = _b.sent();
                        parsed = JSON.parse(raw);
                        return [2 /*return*/, (parsed === null || parsed === void 0 ? void 0 : parsed.commit) && parsed.sandboxID
                                ? { commit: parsed.commit, sandboxID: parsed.sandboxID }
                                : undefined];
                    case 2:
                        _a = _b.sent();
                        return [2 /*return*/, undefined];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    WorktreeSandboxManager.prototype.baseFor = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, git(this.hostRoot, ["merge-base", "candidate/".concat(id), "HEAD"])];
            });
        });
    };
    return WorktreeSandboxManager;
}(workspace_manager_1.WorkspaceSandboxManager));
exports.WorktreeSandboxManager = WorktreeSandboxManager;
