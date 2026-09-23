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
var src_1 = require("../src");
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
(0, bun_test_1.test)("the sandbox family describes the tools it ships", function () {
    var family = (0, src_1.sandboxToolFamily)();
    (0, bun_test_1.expect)(family.id).toBe("sandbox");
    (0, bun_test_1.expect)(family.scope).toBe("workspace");
    (0, bun_test_1.expect)(family.tools.map(function (tool) { return tool.name; })).toEqual((0, src_1.sandboxTools)().map(function (tool) { return tool.name; }));
});
(0, bun_test_1.test)("sandbox tools refuse without a sandbox manager", function () { return __awaiter(void 0, void 0, void 0, function () {
    var tool;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                tool = (0, src_1.sandboxToolFamily)().tools.find(function (candidate) { return candidate.name === "sandbox_create"; });
                // sandbox_create validates its arguments before it reaches the manager, so
                // the refusal is "no sandbox manager" only once the input is well-formed.
                return [4 /*yield*/, (0, bun_test_1.expect)(tool.execute({ id: "probe", path: "probe" }, {
                        workspaceRoot: "/tmp",
                    })).rejects.toThrow(/sandbox manager is unavailable|requires a sandbox manager|sandbox/u)];
            case 1:
                // sandbox_create validates its arguments before it reaches the manager, so
                // the refusal is "no sandbox manager" only once the input is well-formed.
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("sandbox tools run through the worktree backend (create/write/merge)", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, manager, context, tools, _a, merged, _b, _c;
    return __generator(this, function (_d) {
        switch (_d.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-tool-sandbox-wt-"))];
            case 1:
                root = _d.sent();
                return [4 /*yield*/, git(root, ["init", "-b", "main"])];
            case 2:
                _d.sent();
                return [4 /*yield*/, git(root, ["config", "user.email", "test@natalia"])];
            case 3:
                _d.sent();
                return [4 /*yield*/, git(root, ["config", "user.name", "Natalia Test"])];
            case 4:
                _d.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(root, "file.txt"), "base\n")];
            case 5:
                _d.sent();
                return [4 /*yield*/, git(root, ["add", "."])];
            case 6:
                _d.sent();
                return [4 /*yield*/, git(root, ["commit", "-m", "base"])];
            case 7:
                _d.sent();
                manager = new src_1.WorktreeSandboxManager(root);
                return [4 /*yield*/, manager.initialize()];
            case 8:
                _d.sent();
                context = {
                    workspaceRoot: root,
                    sandboxes: manager,
                    runtimeConfig: function () { return ({ sandbox: { promoteCommand: "true" } }); },
                    onSandboxEvent: function () { return undefined; },
                    onWorkspaceChange: function () { return undefined; },
                    sandboxMergeAuthorize: function () { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                        return [2 /*return*/, undefined];
                    }); }); },
                };
                tools = new Map((0, src_1.sandboxToolFamily)().tools.map(function (tool) { return [tool.name, tool]; }));
                return [4 /*yield*/, tools.get("sandbox_create").execute({ id: "wt.1" }, context)];
            case 9:
                _d.sent();
                // The sandbox is a real worktree on a candidate branch.
                _a = bun_test_1.expect;
                return [4 /*yield*/, manager.exists("wt.1")];
            case 10:
                // The sandbox is a real worktree on a candidate branch.
                _a.apply(void 0, [_d.sent()]).toBe(true);
                return [4 /*yield*/, tools
                        .get("sandbox_write")
                        .execute({ id: "wt.1", path: "file.txt", content: "edited\n" }, context)];
            case 11:
                _d.sent();
                return [4 /*yield*/, tools
                        .get("sandbox_merge")
                        .execute({ id: "wt.1" }, context)];
            case 12:
                merged = _d.sent();
                (0, bun_test_1.expect)(JSON.parse(merged)).toContainEqual(bun_test_1.expect.objectContaining({ path: "file.txt", kind: "modify" }));
                // The write was promoted into the system branch: the workspace file changed.
                _b = bun_test_1.expect;
                return [4 /*yield*/, (0, promises_1.readFile)((0, node_path_1.join)(root, "file.txt"), "utf8")];
            case 13:
                // The write was promoted into the system branch: the workspace file changed.
                _b.apply(void 0, [_d.sent()]).toBe("edited\n");
                _c = bun_test_1.expect;
                return [4 /*yield*/, manager.lastKnownGoodCommit()];
            case 14:
                _c.apply(void 0, [_d.sent()]).toBeDefined();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("sandbox tools run through the git-free snapshot backend (no git needed)", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, manager, context, tools, merged, _a, _b, _c;
    return __generator(this, function (_d) {
        switch (_d.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-tool-sandbox-snap-"))];
            case 1:
                root = _d.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(root, "file.txt"), "base\n")];
            case 2:
                _d.sent();
                manager = new src_1.SnapshotSandboxManager(root);
                return [4 /*yield*/, manager.initialize()];
            case 3:
                _d.sent();
                context = {
                    workspaceRoot: root,
                    sandboxes: manager,
                    runtimeConfig: function () { return ({ sandbox: { promoteCommand: "true" } }); },
                    onSandboxEvent: function () { return undefined; },
                    onWorkspaceChange: function () { return undefined; },
                    sandboxMergeAuthorize: function () { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                        return [2 /*return*/, undefined];
                    }); }); },
                };
                tools = new Map((0, src_1.sandboxToolFamily)().tools.map(function (tool) { return [tool.name, tool]; }));
                return [4 /*yield*/, tools.get("sandbox_create").execute({ id: "snap.1" }, context)];
            case 4:
                _d.sent();
                return [4 /*yield*/, tools
                        .get("sandbox_write")
                        .execute({ id: "snap.1", path: "file.txt", content: "edited\n" }, context)];
            case 5:
                _d.sent();
                return [4 /*yield*/, tools
                        .get("sandbox_merge")
                        .execute({ id: "snap.1" }, context)];
            case 6:
                merged = _d.sent();
                (0, bun_test_1.expect)(JSON.parse(merged)).toContainEqual(bun_test_1.expect.objectContaining({ path: "file.txt", kind: "modify" }));
                // Promoted into the host — no git anywhere in the workspace.
                _a = bun_test_1.expect;
                return [4 /*yield*/, (0, promises_1.readFile)((0, node_path_1.join)(root, "file.txt"), "utf8")];
            case 7:
                // Promoted into the host — no git anywhere in the workspace.
                _a.apply(void 0, [_d.sent()]).toBe("edited\n");
                _b = bun_test_1.expect;
                return [4 /*yield*/, manager.hasLastKnownGood("snap.1")];
            case 8:
                _b.apply(void 0, [_d.sent()]).toBe(true);
                // Rollback restores the host to the pre-promotion state.
                return [4 /*yield*/, manager.rollback("snap.1")];
            case 9:
                // Rollback restores the host to the pre-promotion state.
                _d.sent();
                _c = bun_test_1.expect;
                return [4 /*yield*/, (0, promises_1.readFile)((0, node_path_1.join)(root, "file.txt"), "utf8")];
            case 10:
                _c.apply(void 0, [_d.sent()]).toBe("base\n");
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("sandbox_create reads the resolved config service (runtimeConfig) to name its backend", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, manager, tool, created, parsed;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-tool-sandbox-backend-"))];
            case 1:
                root = _a.sent();
                manager = new src_1.SnapshotSandboxManager(root);
                return [4 /*yield*/, manager.initialize()];
            case 2:
                _a.sent();
                tool = (0, src_1.sandboxToolFamily)().tools.find(function (candidate) { return candidate.name === "sandbox_create"; });
                return [4 /*yield*/, tool.execute({ id: "cfg.1" }, {
                        workspaceRoot: root,
                        sandboxes: manager,
                        // The resolved config service: sandbox.backend=worktree was configured.
                        runtimeConfig: function () { return ({ sandbox: { backend: "worktree" } }); },
                        onSandboxEvent: function () { return undefined; },
                        onWorkspaceChange: function () { return undefined; },
                    })];
            case 3:
                created = _a.sent();
                parsed = JSON.parse(created);
                // The tool family consumed the runtime.config service by name — the D2
                // service is genuinely used by a real production tool, not just plugins.
                (0, bun_test_1.expect)(parsed.backend).toBe("worktree");
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("sandbox tools create execute diff and merge through the registry", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, events, context, tools, _a, _b, _c, resource, _d, _e, _f;
    return __generator(this, function (_g) {
        switch (_g.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-tools-sandbox-"))];
            case 1:
                root = _g.sent();
                events = [];
                context = {
                    workspaceRoot: root,
                    sandboxes: new src_1.WorkspaceSandboxManager((0, node_path_1.join)(root, ".natalia", "sandboxes")),
                    runtimeConfig: function () { return ({ sandbox: { promoteCommand: "true" } }); },
                    onSandboxEvent: function (event) { return events.push(event.type); },
                };
                tools = new Map((0, src_1.sandboxTools)().map(function (tool) { return [tool.name, tool]; }));
                return [4 /*yield*/, tools.get("sandbox_create").execute({ id: "box" }, context)];
            case 2:
                _g.sent();
                _a = bun_test_1.expect;
                return [4 /*yield*/, tools
                        .get("sandbox_execute")
                        .execute({ id: "box", command: "printf sandbox-tool-ok" }, context)];
            case 3:
                _a.apply(void 0, [_g.sent()]).toContain("sandbox-tool-ok");
                return [4 /*yield*/, tools
                        .get("sandbox_write")
                        .execute({ id: "box", path: "nested/note.txt", content: "sandbox content" }, context)];
            case 4:
                _g.sent();
                _b = bun_test_1.expect;
                return [4 /*yield*/, tools.get("sandbox_diff").execute({ id: "box" }, context)];
            case 5:
                _b.apply(void 0, [_g.sent()]).toContain("nested/note.txt");
                return [4 /*yield*/, tools.get("sandbox_merge").execute({ id: "box" }, context)];
            case 6:
                _g.sent();
                _c = bun_test_1.expect;
                return [4 /*yield*/, (0, promises_1.readFile)((0, node_path_1.join)(root, "nested", "note.txt"), "utf8")];
            case 7:
                _c.apply(void 0, [_g.sent()]).toBe("sandbox content");
                (0, bun_test_1.expect)(events).toContain("sandbox.update");
                _e = (_d = JSON).parse;
                return [4 /*yield*/, tools.get("sandbox_resource_start").execute({
                        id: "box",
                        resourceID: "resource_tool",
                        command: "printf tool-resource; sleep 30",
                    }, context)];
            case 8:
                resource = _e.apply(_d, [_g.sent()]);
                return [4 /*yield*/, waitForOutput(function () { return __awaiter(void 0, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            return [2 /*return*/, tools
                                    .get("sandbox_resource_output")
                                    .execute({ id: "box", resourceID: resource.id }, context)];
                        });
                    }); }, "tool-resource")];
            case 9:
                _g.sent();
                _f = bun_test_1.expect;
                return [4 /*yield*/, tools.get("sandbox_resource_list").execute({ id: "box" }, context)];
            case 10:
                _f.apply(void 0, [_g.sent()]).toContain("resource_tool");
                return [4 /*yield*/, tools
                        .get("sandbox_resource_stop")
                        .execute({ id: "box", resourceID: resource.id }, context)];
            case 11:
                _g.sent();
                return [4 /*yield*/, tools.get("sandbox_delete").execute({ id: "box" }, context)];
            case 12:
                _g.sent();
                (0, bun_test_1.expect)(events).toContain("sandbox.audit");
                return [2 /*return*/];
        }
    });
}); });
function waitForOutput(read_1) {
    return __awaiter(this, arguments, void 0, function (read, expected) {
        var index;
        if (expected === void 0) { expected = "ready"; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    index = 0;
                    _a.label = 1;
                case 1:
                    if (!(index < 50)) return [3 /*break*/, 5];
                    return [4 /*yield*/, read()];
                case 2:
                    if ((_a.sent()).includes(expected))
                        return [2 /*return*/];
                    return [4 /*yield*/, Bun.sleep(20)];
                case 3:
                    _a.sent();
                    _a.label = 4;
                case 4:
                    index++;
                    return [3 /*break*/, 1];
                case 5: return [2 /*return*/];
            }
        });
    });
}
(0, bun_test_1.test)("sandbox_rollback undoes a promotion and clears the same gate as the merge", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, manager, sandbox, events, authorized, context, tool, output, _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-tool-rollback-"))];
            case 1:
                root = _b.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(root, "file.txt"), "before\n")];
            case 2:
                _b.sent();
                manager = new src_1.SnapshotSandboxManager(root);
                return [4 /*yield*/, manager.initialize()];
            case 3:
                _b.sent();
                return [4 /*yield*/, manager.create("sb_tool")];
            case 4:
                sandbox = _b.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(sandbox.root, "file.txt"), "promoted\n")];
            case 5:
                _b.sent();
                return [4 /*yield*/, manager.promoteWithValidation("sb_tool", {
                        command: "true",
                        hostRoot: root,
                    })];
            case 6:
                _b.sent();
                events = [];
                authorized = [];
                context = {
                    workspaceRoot: root,
                    sandboxes: manager,
                    sandboxMergeAuthorize: function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
                        var paths = _b.paths;
                        return __generator(this, function (_c) {
                            authorized.push(paths);
                            return [2 /*return*/];
                        });
                    }); },
                    onSandboxEvent: function (event) { return events.push(event); },
                    onWorkspaceChange: function () { },
                };
                tool = (0, src_1.sandboxTools)().find(function (t) { return t.name === "sandbox_rollback"; });
                return [4 /*yield*/, tool.execute({ id: "sb_tool" }, context)];
            case 7:
                output = _b.sent();
                (0, bun_test_1.expect)(authorized).toHaveLength(1);
                (0, bun_test_1.expect)(JSON.parse(output).restored).toBe(true);
                _a = bun_test_1.expect;
                return [4 /*yield*/, (0, promises_1.readFile)((0, node_path_1.join)(root, "file.txt"), "utf8")];
            case 8:
                _a.apply(void 0, [_b.sent()]).toBe("before\n");
                // The transition is reported as an audit fact, not left as a silent rewrite.
                (0, bun_test_1.expect)(events.some(function (event) {
                    return event.type === "sandbox.audit" &&
                        event.action === "rollback";
                })).toBe(true);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("a second candidate from the same base is refused and the first survives", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, manager, first, other, _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-conflicted-"))];
            case 1:
                root = _b.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(root, "shared.ts"), "BASE\n")];
            case 2:
                _b.sent();
                manager = new src_1.SnapshotSandboxManager(root);
                return [4 /*yield*/, manager.initialize()];
            case 3:
                _b.sent();
                return [4 /*yield*/, manager.create("sb_one")];
            case 4:
                first = _b.sent();
                return [4 /*yield*/, manager.create("sb_two")];
            case 5:
                other = _b.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(first.root, "shared.ts"), "ONE\n")];
            case 6:
                _b.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(other.root, "shared.ts"), "TWO\n")];
            case 7:
                _b.sent();
                return [4 /*yield*/, manager.promoteWithValidation("sb_one", {
                        command: "true",
                        hostRoot: root,
                    })];
            case 8:
                _b.sent();
                return [4 /*yield*/, (0, bun_test_1.expect)(manager.promoteWithValidation("sb_two", {
                        command: "true",
                        hostRoot: root,
                    })).rejects.toThrow(/conflicts with changes already on the host/)];
            case 9:
                _b.sent();
                // The first candidate's work survived the refusal.
                _a = bun_test_1.expect;
                return [4 /*yield*/, (0, promises_1.readFile)((0, node_path_1.join)(root, "shared.ts"), "utf8")];
            case 10:
                // The first candidate's work survived the refusal.
                _a.apply(void 0, [_b.sent()]).toBe("ONE\n");
                return [2 /*return*/];
        }
    });
}); });
