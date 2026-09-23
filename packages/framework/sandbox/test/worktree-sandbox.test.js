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
var bun_test_1 = require("bun:test");
var promises_1 = require("node:fs/promises");
var node_path_1 = require("node:path");
var node_os_1 = require("node:os");
var worktree_sandbox_1 = require("../src/worktree-sandbox");
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
                        throw new Error(stderr.trim() || stdout.trim());
                    return [2 /*return*/, stdout.trim()];
            }
        });
    });
}
/** A scratch git repo with one committed file, ready to branch candidates from. */
function scratchRepo() {
    return __awaiter(this, void 0, void 0, function () {
        var root;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-sandbox-advanced-"))];
                case 1:
                    root = _a.sent();
                    return [4 /*yield*/, git(root, ["init", "-b", "main"])];
                case 2:
                    _a.sent();
                    return [4 /*yield*/, git(root, ["config", "user.email", "test@natalia"])];
                case 3:
                    _a.sent();
                    return [4 /*yield*/, git(root, ["config", "user.name", "Natalia Test"])];
                case 4:
                    _a.sent();
                    return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(root, "file.txt"), "base\n")];
                case 5:
                    _a.sent();
                    return [4 /*yield*/, git(root, ["add", "."])];
                case 6:
                    _a.sent();
                    return [4 /*yield*/, git(root, ["commit", "-m", "base"])];
                case 7:
                    _a.sent();
                    return [2 /*return*/, root];
            }
        });
    });
}
(0, bun_test_1.test)("a sandbox is a worktree on a candidate branch off the system head", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, manager, sandbox, _a, _b, _c, _d;
    return __generator(this, function (_e) {
        switch (_e.label) {
            case 0: return [4 /*yield*/, scratchRepo()];
            case 1:
                root = _e.sent();
                manager = new worktree_sandbox_1.WorktreeSandboxManager(root);
                return [4 /*yield*/, manager.create("sbx.1")];
            case 2:
                sandbox = _e.sent();
                _a = bun_test_1.expect;
                return [4 /*yield*/, manager.exists("sbx.1")];
            case 3:
                _a.apply(void 0, [_e.sent()]).toBe(true);
                // The worktree branched off the system head, so it starts identical.
                _b = bun_test_1.expect;
                return [4 /*yield*/, manager.systemHead()];
            case 4:
                // The worktree branched off the system head, so it starts identical.
                _b.apply(void 0, [_e.sent()]).toBeDefined();
                // The worktree starts identical to the system.
                _c = bun_test_1.expect;
                return [4 /*yield*/, (0, promises_1.readFile)((0, node_path_1.join)(sandbox.root, "file.txt"), "utf8")];
            case 5:
                // The worktree starts identical to the system.
                _c.apply(void 0, [_e.sent()]).toBe("base\n");
                return [4 /*yield*/, manager.delete("sbx.1")];
            case 6:
                _e.sent();
                _d = bun_test_1.expect;
                return [4 /*yield*/, manager.exists("sbx.1")];
            case 7:
                _d.apply(void 0, [_e.sent()]).toBe(false);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("previewMerge reports the candidate's changes against its base", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, manager, sandbox, changes;
    var _a, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0: return [4 /*yield*/, scratchRepo()];
            case 1:
                root = _c.sent();
                manager = new worktree_sandbox_1.WorktreeSandboxManager(root);
                return [4 /*yield*/, manager.create("sbx.2")];
            case 2:
                sandbox = _c.sent();
                // The agent edits in the candidate worktree and commits there.
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(sandbox.root, "file.txt"), "changed\n")];
            case 3:
                // The agent edits in the candidate worktree and commits there.
                _c.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(sandbox.root, "new.txt"), "added\n")];
            case 4:
                _c.sent();
                return [4 /*yield*/, git(sandbox.root, ["add", "file.txt", "new.txt"])];
            case 5:
                _c.sent();
                return [4 /*yield*/, git(sandbox.root, ["commit", "-m", "agent change"])];
            case 6:
                _c.sent();
                return [4 /*yield*/, manager.previewMerge("sbx.2")];
            case 7:
                changes = _c.sent();
                (0, bun_test_1.expect)(changes.map(function (change) { return change.path; }).sort()).toEqual([
                    "file.txt",
                    "new.txt",
                ]);
                (0, bun_test_1.expect)((_a = changes.find(function (change) { return change.path === "file.txt"; })) === null || _a === void 0 ? void 0 : _a.kind).toBe("modify");
                (0, bun_test_1.expect)((_b = changes.find(function (change) { return change.path === "new.txt"; })) === null || _b === void 0 ? void 0 : _b.kind).toBe("add");
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("promote merges the candidate into the system slot and records last-known-good", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, manager, sandbox, base, authorized, promotion, _a, _b, _c, _d;
    return __generator(this, function (_e) {
        switch (_e.label) {
            case 0: return [4 /*yield*/, scratchRepo()];
            case 1:
                root = _e.sent();
                manager = new worktree_sandbox_1.WorktreeSandboxManager(root);
                return [4 /*yield*/, manager.create("sbx.3")];
            case 2:
                sandbox = _e.sent();
                return [4 /*yield*/, manager.systemHead()];
            case 3:
                base = _e.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(sandbox.root, "file.txt"), "promoted\n")];
            case 4:
                _e.sent();
                return [4 /*yield*/, git(sandbox.root, ["add", "."])];
            case 5:
                _e.sent();
                return [4 /*yield*/, git(sandbox.root, ["commit", "-m", "promote me"])];
            case 6:
                _e.sent();
                authorized = [];
                return [4 /*yield*/, manager.promote("sbx.3", function (paths) { return __awaiter(void 0, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            authorized.push(paths);
                            return [2 /*return*/];
                        });
                    }); })];
            case 7:
                promotion = _e.sent();
                (0, bun_test_1.expect)(promotion.lastKnownGood).toBe(base);
                _b = (_a = (0, bun_test_1.expect)(promotion.promoted)).toBe;
                return [4 /*yield*/, manager.systemHead()];
            case 8:
                _b.apply(_a, [_e.sent()]);
                (0, bun_test_1.expect)(promotion.promoted).not.toBe(base);
                // The system slot now has the candidate's change.
                _c = bun_test_1.expect;
                return [4 /*yield*/, (0, promises_1.readFile)((0, node_path_1.join)(root, "file.txt"), "utf8")];
            case 9:
                // The system slot now has the candidate's change.
                _c.apply(void 0, [_e.sent()]).toBe("promoted\n");
                // The human approval step saw the changed paths.
                (0, bun_test_1.expect)(authorized[0]).toContain("file.txt");
                _d = bun_test_1.expect;
                return [4 /*yield*/, manager.lastKnownGoodCommit()];
            case 10:
                _d.apply(void 0, [_e.sent()]).toBe(base);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("rollback returns the system slot to last-known-good", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, manager, sandbox, _a, rollback, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0: return [4 /*yield*/, scratchRepo()];
            case 1:
                root = _c.sent();
                manager = new worktree_sandbox_1.WorktreeSandboxManager(root);
                return [4 /*yield*/, manager.create("sbx.4")];
            case 2:
                sandbox = _c.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(sandbox.root, "file.txt"), "promoted\n")];
            case 3:
                _c.sent();
                return [4 /*yield*/, git(sandbox.root, ["add", "."])];
            case 4:
                _c.sent();
                return [4 /*yield*/, git(sandbox.root, ["commit", "-m", "promote me"])];
            case 5:
                _c.sent();
                return [4 /*yield*/, manager.merge("sbx.4", root)];
            case 6:
                _c.sent();
                _a = bun_test_1.expect;
                return [4 /*yield*/, (0, promises_1.readFile)((0, node_path_1.join)(root, "file.txt"), "utf8")];
            case 7:
                _a.apply(void 0, [_c.sent()]).toBe("promoted\n");
                return [4 /*yield*/, manager.rollback("sbx.4")];
            case 8:
                rollback = _c.sent();
                (0, bun_test_1.expect)(rollback.restored).toBe(true);
                _b = bun_test_1.expect;
                return [4 /*yield*/, (0, promises_1.readFile)((0, node_path_1.join)(root, "file.txt"), "utf8")];
            case 9:
                _b.apply(void 0, [_c.sent()]).toBe("base\n");
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("promoting a candidate with no changes refuses", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, manager;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, scratchRepo()];
            case 1:
                root = _a.sent();
                manager = new worktree_sandbox_1.WorktreeSandboxManager(root);
                return [4 /*yield*/, manager.create("sbx.5")];
            case 2:
                _a.sent();
                return [4 /*yield*/, (0, bun_test_1.expect)(manager.merge("sbx.5", root)).rejects.toThrow(/has no changes to promote/u)];
            case 3:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("a candidate that fails validation is refused promotion with its build output", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, manager, sandbox, _a, good, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0: return [4 /*yield*/, scratchRepo()];
            case 1:
                root = _c.sent();
                manager = new worktree_sandbox_1.WorktreeSandboxManager(root);
                return [4 /*yield*/, manager.create("sbx.6")];
            case 2:
                sandbox = _c.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(sandbox.root, "file.txt"), "broken\n")];
            case 3:
                _c.sent();
                return [4 /*yield*/, git(sandbox.root, ["add", "."])];
            case 4:
                _c.sent();
                return [4 /*yield*/, git(sandbox.root, ["commit", "-m", "broken candidate"])];
            case 5:
                _c.sent();
                // The build evidence gate: a candidate that does not pass validation must
                // not reach the system slot.
                return [4 /*yield*/, (0, bun_test_1.expect)(manager.promoteWithValidation("sbx.6", {
                        command: "test -f build-pass-marker",
                    })).rejects.toThrow(/failed validation/u)];
            case 6:
                // The build evidence gate: a candidate that does not pass validation must
                // not reach the system slot.
                _c.sent();
                // The system slot is untouched.
                _a = bun_test_1.expect;
                return [4 /*yield*/, (0, promises_1.readFile)((0, node_path_1.join)(root, "file.txt"), "utf8")];
            case 7:
                // The system slot is untouched.
                _a.apply(void 0, [_c.sent()]).toBe("base\n");
                return [4 /*yield*/, manager.create("sbx.7")];
            case 8:
                good = _c.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(good.root, "file.txt"), "good\n")];
            case 9:
                _c.sent();
                return [4 /*yield*/, git(good.root, ["add", "."])];
            case 10:
                _c.sent();
                return [4 /*yield*/, git(good.root, ["commit", "-m", "good candidate"])];
            case 11:
                _c.sent();
                return [4 /*yield*/, manager.promoteWithValidation("sbx.7", { command: "true" })];
            case 12:
                _c.sent();
                _b = bun_test_1.expect;
                return [4 /*yield*/, (0, promises_1.readFile)((0, node_path_1.join)(root, "file.txt"), "utf8")];
            case 13:
                _b.apply(void 0, [_c.sent()]).toBe("good\n");
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("worktree sandbox sees files .gitignore hides but .nataliaignore allows", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, manager, sandbox, changes;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, scratchRepo()];
            case 1:
                root = _b.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(root, ".gitignore"), "/plan/\n")];
            case 2:
                _b.sent();
                return [4 /*yield*/, git(root, ["add", ".gitignore"])];
            case 3:
                _b.sent();
                return [4 /*yield*/, git(root, ["commit", "-m", "ignore plan"])];
            case 4:
                _b.sent();
                manager = new worktree_sandbox_1.WorktreeSandboxManager(root);
                return [4 /*yield*/, manager.create("sbx.ignored")];
            case 5:
                sandbox = _b.sent();
                return [4 /*yield*/, (0, promises_1.mkdir)((0, node_path_1.join)(sandbox.root, "plan"), { recursive: true })];
            case 6:
                _b.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(sandbox.root, "plan", "note.md"), "planned\n")];
            case 7:
                _b.sent();
                return [4 /*yield*/, manager.previewMerge("sbx.ignored")];
            case 8:
                changes = _b.sent();
                (0, bun_test_1.expect)(changes.map(function (change) { return change.path; })).toContain("plan/note.md");
                (0, bun_test_1.expect)((_a = changes.find(function (change) { return change.path === "plan/note.md"; })) === null || _a === void 0 ? void 0 : _a.kind).toBe("add");
                return [4 /*yield*/, manager.delete("sbx.ignored")];
            case 9:
                _b.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("worktree sandbox still excludes paths ignored by .nataliaignore", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, manager, sandbox, changes;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, scratchRepo()];
            case 1:
                root = _a.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(root, ".nataliaignore"), "ignored-output/\n")];
            case 2:
                _a.sent();
                manager = new worktree_sandbox_1.WorktreeSandboxManager(root);
                return [4 /*yield*/, manager.create("sbx.nataliaignore")];
            case 3:
                sandbox = _a.sent();
                return [4 /*yield*/, (0, promises_1.mkdir)((0, node_path_1.join)(sandbox.root, "ignored-output"), { recursive: true })];
            case 4:
                _a.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(sandbox.root, "ignored-output", "data.txt"), "skip\n")];
            case 5:
                _a.sent();
                return [4 /*yield*/, manager.previewMerge("sbx.nataliaignore")];
            case 6:
                changes = _a.sent();
                (0, bun_test_1.expect)(changes.map(function (change) { return change.path; })).not.toContain("ignored-output/data.txt");
                return [4 /*yield*/, manager.delete("sbx.nataliaignore")];
            case 7:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("governance skips the human approval for a low-risk promotion", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, manager, sandbox, authorized;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, scratchRepo()];
            case 1:
                root = _a.sent();
                manager = new worktree_sandbox_1.WorktreeSandboxManager(root);
                return [4 /*yield*/, manager.create("sbx.8")];
            case 2:
                sandbox = _a.sent();
                return [4 /*yield*/, (0, promises_1.mkdir)((0, node_path_1.join)(sandbox.root, "docs"), { recursive: true })];
            case 3:
                _a.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(sandbox.root, "docs/note.md"), "low risk\n")];
            case 4:
                _a.sent();
                return [4 /*yield*/, git(sandbox.root, ["add", "."])];
            case 5:
                _a.sent();
                return [4 /*yield*/, git(sandbox.root, ["commit", "-m", "low risk edit"])];
            case 6:
                _a.sent();
                authorized = [];
                return [4 /*yield*/, manager.promoteWithValidation("sbx.8", {
                        command: "true",
                        requireApprovalTier: "medium",
                        authorize: function (paths) { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                authorized.push(paths);
                                return [2 /*return*/];
                            });
                        }); },
                    })];
            case 7:
                _a.sent();
                // A low-risk config/doc edit clears the medium gate without a human.
                (0, bun_test_1.expect)(authorized).toEqual([]);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("governance requires the human approval for a high-risk promotion", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, manager, sandbox, authorized;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, scratchRepo()];
            case 1:
                root = _a.sent();
                manager = new worktree_sandbox_1.WorktreeSandboxManager(root);
                return [4 /*yield*/, manager.create("sbx.9")];
            case 2:
                sandbox = _a.sent();
                return [4 /*yield*/, (0, promises_1.mkdir)((0, node_path_1.join)(sandbox.root, "packages/core/tools/src"), {
                        recursive: true,
                    })];
            case 3:
                _a.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(sandbox.root, "packages/core/tools/src/types.ts"), "contract\n")];
            case 4:
                _a.sent();
                return [4 /*yield*/, git(sandbox.root, ["add", "."])];
            case 5:
                _a.sent();
                return [4 /*yield*/, git(sandbox.root, ["commit", "-m", "contract edit"])];
            case 6:
                _a.sent();
                authorized = [];
                return [4 /*yield*/, manager.promoteWithValidation("sbx.9", {
                        command: "true",
                        requireApprovalTier: "medium",
                        authorize: function (paths) { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                authorized.push(paths);
                                return [2 /*return*/];
                            });
                        }); },
                    })];
            case 7:
                _a.sent();
                // A contract change is high risk: the human approval ran.
                (0, bun_test_1.expect)(authorized.length).toBe(1);
                return [2 /*return*/];
        }
    });
}); });
