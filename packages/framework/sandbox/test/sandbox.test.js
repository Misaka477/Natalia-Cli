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
var bun_test_1 = require("bun:test");
var promises_1 = require("node:fs/promises");
var node_path_1 = require("node:path");
var node_os_1 = require("node:os");
var src_1 = require("../src");
/**
 * The symlink fixtures are skipped when the machine cannot create symlinks
 * (Windows without Developer Mode); the containment rule is unexercisable
 * without one.
 */
var symlinkSupported = await probeSymlinkSupport();
var symlinkTest = symlinkSupported ? bun_test_1.test : bun_test_1.test.skip;
function probeSymlinkSupport() {
    return __awaiter(this, void 0, void 0, function () {
        var root, _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-symlink-probe-"))];
                case 1:
                    root = _b.sent();
                    _b.label = 2;
                case 2:
                    _b.trys.push([2, 4, 5, 7]);
                    return [4 /*yield*/, (0, promises_1.symlink)("target", (0, node_path_1.join)(root, "link"))];
                case 3:
                    _b.sent();
                    return [2 /*return*/, true];
                case 4:
                    _a = _b.sent();
                    return [2 /*return*/, false];
                case 5: return [4 /*yield*/, (0, promises_1.rm)(root, { recursive: true, force: true }).catch(function () { return undefined; })];
                case 6:
                    _b.sent();
                    return [7 /*endfinally*/];
                case 7: return [2 /*return*/];
            }
        });
    });
}
(0, bun_test_1.test)("sandbox containment blocks absolute and parent escape", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-sandbox-"))];
            case 1:
                root = _a.sent();
                return [4 /*yield*/, (0, bun_test_1.expect)((0, src_1.containPath)(root, "/etc/passwd")).rejects.toThrow("absolute")];
            case 2:
                _a.sent();
                return [4 /*yield*/, (0, bun_test_1.expect)((0, src_1.containPath)(root, "../escape")).rejects.toThrow("escape")];
            case 3:
                _a.sent();
                return [4 /*yield*/, (0, bun_test_1.expect)((0, src_1.containPath)(root, "safe/file.txt")).resolves.toContain(root)];
            case 4:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
symlinkTest("sandbox containment blocks symlink escape", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-sandbox-"))];
            case 1:
                root = _a.sent();
                return [4 /*yield*/, (0, promises_1.symlink)("/tmp", (0, node_path_1.join)(root, "out"))];
            case 2:
                _a.sent();
                return [4 /*yield*/, (0, bun_test_1.expect)((0, src_1.containPath)(root, "out/file.txt")).rejects.toThrow("symlink escape")];
            case 3:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("sandbox diff covers delete rename mode and env allowlist redacts secrets", function () { return __awaiter(void 0, void 0, void 0, function () {
    var base, manager, changes;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-sandbox-base-"))];
            case 1:
                base = _a.sent();
                manager = new src_1.WorkspaceSandboxManager(base);
                return [4 /*yield*/, manager.create("box")];
            case 2:
                _a.sent();
                return [4 /*yield*/, manager.write("box", "new.ts", "new")];
            case 3:
                _a.sent();
                return [4 /*yield*/, manager.write("box", "old.ts", "old")];
            case 4:
                _a.sent();
                return [4 /*yield*/, manager.renamePath("box", "old.ts", "renamed.ts")];
            case 5:
                _a.sent();
                return [4 /*yield*/, manager.modePath("box", "script.sh", "100755")];
            case 6:
                _a.sent();
                return [4 /*yield*/, manager.deletePath("box", "gone.ts")];
            case 7:
                _a.sent();
                return [4 /*yield*/, manager.previewMerge("box")];
            case 8:
                changes = _a.sent();
                (0, bun_test_1.expect)(changes.map(function (change) { return change.kind; })).toEqual([
                    "modify",
                    "rename",
                    "mode",
                    "delete",
                ]);
                (0, bun_test_1.expect)(manager.environment(["PATH", "API_KEY"], {
                    PATH: "/bin",
                    API_KEY: "secret",
                })).toEqual({ PATH: "/bin" });
                (0, bun_test_1.expect)((0, src_1.isSecretEnvKey)("GITHUB_TOKEN")).toBe(true);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("sandbox manager lists durable manifests without exposing mutable state", function () { return __awaiter(void 0, void 0, void 0, function () {
    var base, manager, listed, _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-sandbox-list-"))];
            case 1:
                base = _b.sent();
                manager = new src_1.WorkspaceSandboxManager(base);
                return [4 /*yield*/, manager.create("box")];
            case 2:
                _b.sent();
                return [4 /*yield*/, manager.write("box", "draft.txt", "draft")];
            case 3:
                _b.sent();
                return [4 /*yield*/, manager.list()];
            case 4:
                listed = _b.sent();
                (0, bun_test_1.expect)(listed).toMatchObject([
                    { id: "box", changedFiles: [{ path: "draft.txt" }] },
                ]);
                listed[0].changedFiles.length = 0;
                _a = bun_test_1.expect;
                return [4 /*yield*/, manager.previewMerge("box")];
            case 5:
                _a.apply(void 0, [_b.sent()]).toHaveLength(1);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("sandbox merge is atomic on failure", function () { return __awaiter(void 0, void 0, void 0, function () {
    var base, host, manager, _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-sandbox-base-"))];
            case 1:
                base = _b.sent();
                return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-host-"))];
            case 2:
                host = _b.sent();
                manager = new src_1.WorkspaceSandboxManager(base);
                return [4 /*yield*/, manager.create("box")];
            case 3:
                _b.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(host, "keep.txt"), "original")];
            case 4:
                _b.sent();
                return [4 /*yield*/, manager.write("box", "keep.txt", "changed")];
            case 5:
                _b.sent();
                return [4 /*yield*/, manager.write("box", "bad/child.txt", "bad")];
            case 6:
                _b.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(host, "bad"), "not a dir")];
            case 7:
                _b.sent();
                return [4 /*yield*/, (0, bun_test_1.expect)(manager.merge("box", host)).rejects.toThrow()];
            case 8:
                _b.sent();
                _a = bun_test_1.expect;
                return [4 /*yield*/, (0, promises_1.readFile)((0, node_path_1.join)(host, "keep.txt"), "utf8")];
            case 9:
                _a.apply(void 0, [_b.sent()]).toBe("original");
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("promoteWithValidation refuses an empty command and a failed check", function () { return __awaiter(void 0, void 0, void 0, function () {
    var base, host, manager, promotion, _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-sandbox-promote-base-"))];
            case 1:
                base = _b.sent();
                return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-sandbox-promote-host-"))];
            case 2:
                host = _b.sent();
                manager = new src_1.WorkspaceSandboxManager(base);
                return [4 /*yield*/, manager.create("box")];
            case 3:
                _b.sent();
                return [4 /*yield*/, manager.write("box", "file.txt", "candidate")];
            case 4:
                _b.sent();
                return [4 /*yield*/, (0, bun_test_1.expect)(manager.promoteWithValidation("box", { command: "   ", hostRoot: host })).rejects.toThrow(/must not be empty/u)];
            case 5:
                _b.sent();
                return [4 /*yield*/, (0, bun_test_1.expect)(manager.promoteWithValidation("box", { command: "exit 1", hostRoot: host })).rejects.toThrow(/failed validation/u)];
            case 6:
                _b.sent();
                return [4 /*yield*/, (0, bun_test_1.expect)((0, promises_1.readFile)((0, node_path_1.join)(host, "file.txt"), "utf8")).rejects.toMatchObject({
                        code: "ENOENT",
                    })];
            case 7:
                _b.sent();
                return [4 /*yield*/, manager.promoteWithValidation("box", {
                        command: "true",
                        hostRoot: host,
                    })];
            case 8:
                promotion = _b.sent();
                (0, bun_test_1.expect)(promotion.changedFiles).toContainEqual(bun_test_1.expect.objectContaining({ path: "file.txt" }));
                _a = bun_test_1.expect;
                return [4 /*yield*/, (0, promises_1.readFile)((0, node_path_1.join)(host, "file.txt"), "utf8")];
            case 9:
                _a.apply(void 0, [_b.sent()]).toBe("candidate");
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("sandbox merge authorizes every host mutation before writing", function () { return __awaiter(void 0, void 0, void 0, function () {
    var base, host, manager, checked, _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-sandbox-policy-base-"))];
            case 1:
                base = _b.sent();
                return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-sandbox-policy-host-"))];
            case 2:
                host = _b.sent();
                manager = new src_1.WorkspaceSandboxManager(base);
                return [4 /*yield*/, manager.create("box")];
            case 3:
                _b.sent();
                return [4 /*yield*/, manager.write("box", "allowed.txt", "allowed")];
            case 4:
                _b.sent();
                return [4 /*yield*/, manager.write("box", "protected.txt", "blocked")];
            case 5:
                _b.sent();
                checked = [];
                return [4 /*yield*/, (0, bun_test_1.expect)(manager.merge("box", host, function (paths) { return __awaiter(void 0, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            checked.push(paths);
                            if (paths.includes("protected.txt"))
                                throw new Error("protected path");
                            return [2 /*return*/];
                        });
                    }); })).rejects.toThrow("protected path")];
            case 6:
                _b.sent();
                (0, bun_test_1.expect)(checked).toEqual([["allowed.txt", "protected.txt"]]);
                return [4 /*yield*/, (0, bun_test_1.expect)((0, promises_1.readFile)((0, node_path_1.join)(host, "allowed.txt"), "utf8")).rejects.toMatchObject({
                        code: "ENOENT",
                    })];
            case 7:
                _b.sent();
                return [4 /*yield*/, (0, bun_test_1.expect)((0, promises_1.readFile)((0, node_path_1.join)(host, "protected.txt"), "utf8")).rejects.toMatchObject({
                        code: "ENOENT",
                    })];
            case 8:
                _b.sent();
                _a = bun_test_1.expect;
                return [4 /*yield*/, manager.previewMerge("box")];
            case 9:
                _a.apply(void 0, [_b.sent()]).toHaveLength(2);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("sandbox merge rejects manifest changes during asynchronous authorization", function () { return __awaiter(void 0, void 0, void 0, function () {
    var base, host, manager, _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-sandbox-race-base-"))];
            case 1:
                base = _b.sent();
                return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-sandbox-race-host-"))];
            case 2:
                host = _b.sent();
                manager = new src_1.WorkspaceSandboxManager(base);
                return [4 /*yield*/, manager.create("box")];
            case 3:
                _b.sent();
                return [4 /*yield*/, manager.write("box", "initial.txt", "initial")];
            case 4:
                _b.sent();
                return [4 /*yield*/, (0, bun_test_1.expect)(manager.merge("box", host, function () { return __awaiter(void 0, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0: return [4 /*yield*/, manager.write("box", "later.txt", "later")];
                                case 1:
                                    _a.sent();
                                    return [2 /*return*/];
                            }
                        });
                    }); })).rejects.toThrow("manifest changed during merge authorization")];
            case 5:
                _b.sent();
                return [4 /*yield*/, (0, bun_test_1.expect)((0, promises_1.readFile)((0, node_path_1.join)(host, "initial.txt"), "utf8")).rejects.toMatchObject({
                        code: "ENOENT",
                    })];
            case 6:
                _b.sent();
                _a = bun_test_1.expect;
                return [4 /*yield*/, manager.previewMerge("box")];
            case 7:
                _a.apply(void 0, [(_b.sent()).map(function (change) { return change.path; })]).toEqual(["initial.txt", "later.txt"]);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("sandbox merge applies rename content and mode without orphaning host files", function () { return __awaiter(void 0, void 0, void 0, function () {
    var base, host, manager, _a, _b, _c;
    return __generator(this, function (_d) {
        switch (_d.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-sandbox-merge-base-"))];
            case 1:
                base = _d.sent();
                return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-sandbox-merge-host-"))];
            case 2:
                host = _d.sent();
                manager = new src_1.WorkspaceSandboxManager(base);
                return [4 /*yield*/, manager.create("box")];
            case 3:
                _d.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(host, "old.ts"), "old host\n")];
            case 4:
                _d.sent();
                return [4 /*yield*/, manager.write("box", "old.ts", "sandbox content\n")];
            case 5:
                _d.sent();
                return [4 /*yield*/, manager.renamePath("box", "old.ts", "new.ts")];
            case 6:
                _d.sent();
                return [4 /*yield*/, manager.write("box", "script.sh", "#!/bin/sh\n")];
            case 7:
                _d.sent();
                return [4 /*yield*/, manager.modePath("box", "script.sh", "100755")];
            case 8:
                _d.sent();
                return [4 /*yield*/, manager.merge("box", host)];
            case 9:
                _d.sent();
                return [4 /*yield*/, (0, bun_test_1.expect)((0, promises_1.readFile)((0, node_path_1.join)(host, "old.ts"), "utf8")).rejects.toMatchObject({
                        code: "ENOENT",
                    })];
            case 10:
                _d.sent();
                _a = bun_test_1.expect;
                return [4 /*yield*/, (0, promises_1.readFile)((0, node_path_1.join)(host, "new.ts"), "utf8")];
            case 11:
                _a.apply(void 0, [_d.sent()]).toBe("sandbox content\n");
                if (!(process.platform !== "win32")) return [3 /*break*/, 13];
                _b = bun_test_1.expect;
                return [4 /*yield*/, (0, promises_1.stat)((0, node_path_1.join)(host, "script.sh"))];
            case 12:
                _b.apply(void 0, [(_d.sent()).mode & 73]).not.toBe(0);
                _d.label = 13;
            case 13:
                _c = bun_test_1.expect;
                return [4 /*yield*/, (0, promises_1.readFile)((0, node_path_1.join)(host, "script.sh"), "utf8")];
            case 14:
                _c.apply(void 0, [_d.sent()]).toBe("#!/bin/sh\n");
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("sandbox target/audit/checkpoint contract exposes isolation level", function () { return __awaiter(void 0, void 0, void 0, function () {
    var base, manager, _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-sandbox-base-"))];
            case 1:
                base = _b.sent();
                manager = new src_1.WorkspaceSandboxManager(base);
                return [4 /*yield*/, manager.create("box")];
            case 2:
                _b.sent();
                (0, bun_test_1.expect)(manager.target("box")).toMatchObject({
                    kind: "sandbox",
                    isolationLevel: "workspace",
                });
                (0, bun_test_1.expect)(manager.updateEvent("box")).toMatchObject({
                    type: "sandbox.update",
                    isolationLevel: "workspace",
                });
                (0, bun_test_1.expect)(manager.auditEvent("box", "workflow")).toMatchObject({
                    type: "sandbox.audit",
                    approvalRequired: true,
                    checkpointPolicy: "sandbox_manifest",
                });
                _a = bun_test_1.expect;
                return [4 /*yield*/, manager.delete("box")];
            case 3:
                _a.apply(void 0, [_b.sent()]).toMatchObject({
                    pendingChanges: [],
                    runningResources: [],
                });
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("sandbox executes a real command inside its workspace target", function () { return __awaiter(void 0, void 0, void 0, function () {
    var base, manager, result;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-sandbox-base-"))];
            case 1:
                base = _a.sent();
                manager = new src_1.WorkspaceSandboxManager(base);
                return [4 /*yield*/, manager.create("box")];
            case 2:
                _a.sent();
                return [4 /*yield*/, manager.execute("box", "pwd; printf sandbox-ok")];
            case 3:
                result = _a.sent();
                (0, bun_test_1.expect)(result.exitCode).toBe(0);
                (0, bun_test_1.expect)(result.output).toContain("sandbox-ok");
                // Git Bash reports the MSYS-translated path on Windows (/tmp/...), so the
                // assertion checks for the sandbox directory segments instead of the exact
                // host spelling there.
                if (process.platform === "win32")
                    (0, bun_test_1.expect)(result.output).toContain("natalia-sandbox-base");
                else
                    (0, bun_test_1.expect)(result.output).toContain((0, node_path_1.join)(base, "box"));
                (0, bun_test_1.expect)(result.target).toMatchObject({ kind: "sandbox", sandboxID: "box" });
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("sandbox tracks running resources with output and stop lifecycle", function () { return __awaiter(void 0, void 0, void 0, function () {
    var base, manager, resource, _a, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-sandbox-resource-"))];
            case 1:
                base = _c.sent();
                manager = new src_1.WorkspaceSandboxManager(base);
                return [4 /*yield*/, manager.create("box")];
            case 2:
                _c.sent();
                return [4 /*yield*/, manager.startResource("box", "printf resource-ok; sleep 30", "res_1")];
            case 3:
                resource = _c.sent();
                (0, bun_test_1.expect)(resource).toMatchObject({ id: "res_1", status: "running" });
                (0, bun_test_1.expect)(manager.runningResourceCount()).toBe(1);
                (0, bun_test_1.expect)(manager.updateEvent("box")).toMatchObject({ runningResources: 1 });
                return [4 /*yield*/, waitFor(function () { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0: return [4 /*yield*/, manager.resourceOutput("box", "res_1")];
                            case 1: return [2 /*return*/, _a.sent()];
                        }
                    }); }); })];
            case 4:
                _c.sent();
                _a = bun_test_1.expect;
                return [4 /*yield*/, manager.resourceOutput("box", "res_1")];
            case 5:
                _a.apply(void 0, [_c.sent()]).toContain("resource-ok");
                _b = bun_test_1.expect;
                return [4 /*yield*/, manager.stopResource("box", "res_1")];
            case 6:
                _b.apply(void 0, [_c.sent()]).toMatchObject({
                    status: "stopped",
                });
                (0, bun_test_1.expect)(manager.runningResourceCount()).toBe(0);
                (0, bun_test_1.expect)(manager.updateEvent("box")).toMatchObject({ runningResources: 0 });
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("sandbox manager close stops every running resource", function () { return __awaiter(void 0, void 0, void 0, function () {
    var base, manager, first, second;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-sandbox-close-"))];
            case 1:
                base = _a.sent();
                manager = new src_1.WorkspaceSandboxManager(base);
                return [4 /*yield*/, manager.create("first")];
            case 2:
                _a.sent();
                return [4 /*yield*/, manager.create("second")];
            case 3:
                _a.sent();
                return [4 /*yield*/, manager.startResource("first", "sleep 30", "res_first")];
            case 4:
                first = _a.sent();
                return [4 /*yield*/, manager.startResource("second", "sleep 30", "res_second")];
            case 5:
                second = _a.sent();
                return [4 /*yield*/, manager.close()];
            case 6:
                _a.sent();
                (0, bun_test_1.expect)(manager.runningResourceCount()).toBe(0);
                (0, bun_test_1.expect)(manager.resourcesFor("first")).toEqual([]);
                (0, bun_test_1.expect)(manager.resourcesFor("second")).toEqual([]);
                return [4 /*yield*/, waitForProcessExit(first.pid)];
            case 7:
                _a.sent();
                return [4 /*yield*/, waitForProcessExit(second.pid)];
            case 8:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); }, 15000);
(0, bun_test_1.test)("sandbox manifests restore changes but never falsely recover processes", function () { return __awaiter(void 0, void 0, void 0, function () {
    var base, first, reopened, _a, result;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-sandbox-restart-"))];
            case 1:
                base = _b.sent();
                first = new src_1.WorkspaceSandboxManager(base);
                return [4 /*yield*/, first.create("box")];
            case 2:
                _b.sent();
                return [4 /*yield*/, first.write("box", "draft.txt", "persisted")];
            case 3:
                _b.sent();
                return [4 /*yield*/, first.startResource("box", "sleep 0.1", "custom_resource")];
            case 4:
                _b.sent();
                return [4 /*yield*/, Bun.sleep(150)];
            case 5:
                _b.sent();
                reopened = new src_1.WorkspaceSandboxManager(base);
                return [4 /*yield*/, reopened.initialize()];
            case 6:
                _b.sent();
                _a = bun_test_1.expect;
                return [4 /*yield*/, reopened.previewMerge("box")];
            case 7:
                _a.apply(void 0, [_b.sent()]).toMatchObject([
                    { path: "draft.txt", content: "persisted" },
                ]);
                (0, bun_test_1.expect)(reopened.resourcesFor("box")).toEqual([]);
                return [4 /*yield*/, reopened.delete("box")];
            case 8:
                result = _b.sent();
                (0, bun_test_1.expect)(result.runningResources).toEqual([]);
                return [2 /*return*/];
        }
    });
}); });
function waitFor(read) {
    return __awaiter(this, void 0, void 0, function () {
        var index;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    index = 0;
                    _a.label = 1;
                case 1:
                    if (!(index < 100)) return [3 /*break*/, 5];
                    return [4 /*yield*/, read()];
                case 2:
                    if ((_a.sent()).includes("resource-ok"))
                        return [2 /*return*/];
                    return [4 /*yield*/, Bun.sleep(20)];
                case 3:
                    _a.sent();
                    _a.label = 4;
                case 4:
                    index++;
                    return [3 /*break*/, 1];
                case 5: throw new Error("timed out waiting for sandbox resource output");
            }
        });
    });
}
(0, bun_test_1.test)("sandbox resource preserves a command containing single quotes", function () { return __awaiter(void 0, void 0, void 0, function () {
    var base, manager, resource, _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-sandbox-quote-"))];
            case 1:
                base = _b.sent();
                manager = new src_1.WorkspaceSandboxManager(base);
                return [4 /*yield*/, manager.create("box")];
            case 2:
                _b.sent();
                return [4 /*yield*/, manager.startResource("box", "echo 'a b c'", "r1")];
            case 3:
                resource = _b.sent();
                (0, bun_test_1.expect)(resource.pid).toBeGreaterThan(0);
                _a = bun_test_1.expect;
                return [4 /*yield*/, waitForResourceOutput(resource.outputPath)];
            case 4:
                _a.apply(void 0, [_b.sent()]).toBe("a b c");
                return [2 /*return*/];
        }
    });
}); });
function waitForResourceOutput(path_1) {
    return __awaiter(this, arguments, void 0, function (path, timeoutMs) {
        var deadline, content;
        if (timeoutMs === void 0) { timeoutMs = 20000; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    deadline = Date.now() + timeoutMs;
                    _a.label = 1;
                case 1:
                    if (!(Date.now() < deadline)) return [3 /*break*/, 4];
                    return [4 /*yield*/, (0, promises_1.readFile)(path, "utf8").catch(function () { return ""; })];
                case 2:
                    content = _a.sent();
                    if (content.trim())
                        return [2 /*return*/, content.trim()];
                    return [4 /*yield*/, Bun.sleep(100)];
                case 3:
                    _a.sent();
                    return [3 /*break*/, 1];
                case 4: return [2 /*return*/, ""];
            }
        });
    });
}
function waitForProcessExit(pid_1) {
    return __awaiter(this, arguments, void 0, function (pid, timeoutMs) {
        var deadline;
        if (timeoutMs === void 0) { timeoutMs = 5000; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    deadline = Date.now() + timeoutMs;
                    _a.label = 1;
                case 1:
                    if (!(Date.now() < deadline)) return [3 /*break*/, 3];
                    try {
                        process.kill(pid, 0);
                    }
                    catch (_b) {
                        return [2 /*return*/];
                    }
                    return [4 /*yield*/, Bun.sleep(20)];
                case 2:
                    _a.sent();
                    return [3 /*break*/, 1];
                case 3: throw new Error("timed out waiting for process ".concat(pid, " to exit"));
            }
        });
    });
}
