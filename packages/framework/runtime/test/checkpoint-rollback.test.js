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
Object.defineProperty(exports, "__esModule", { value: true });
var promises_1 = require("node:fs/promises");
var node_path_1 = require("node:path");
var node_crypto_1 = require("node:crypto");
var node_os_1 = require("node:os");
var node_fs_1 = require("node:fs");
var bun_test_1 = require("bun:test");
var session_1 = require("@anthelia/session");
var src_1 = require("../src");
/**
 * These fixtures create filesystem symlinks, which Windows refuses without
 * Developer Mode or an elevated process. The behaviour under test is the
 * ledger's handling of symlinked entries, so the tests are skipped when the
 * machine cannot create symlinks rather than failing on setup.
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
// Python is only a stand-in for "a real external program wrote and ran a file
// here", not a subject of these tests. The interpreter is named `python3` on
// most POSIX distributions and `python` on Windows, so resolve whichever
// exists rather than hard-coding one and losing the whole scenario elsewhere.
function pythonInterpreter() {
    for (var _i = 0, _a = ["python3", "python"]; _i < _a.length; _i++) {
        var candidate = _a[_i];
        try {
            // spawnSync throws ENOENT rather than reporting failure when the
            // executable is absent, so probing has to be guarded.
            var probe = Bun.spawnSync([candidate, "--version"], {
                stdout: "ignore",
                stderr: "ignore",
            });
            if (probe.success)
                return candidate;
        }
        catch (_b) {
            continue;
        }
    }
    return undefined;
}
(0, bun_test_1.test)("default baseline, user scenario rollback and session restore remain durable", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, events, ledger, store, _a, interpreter, run, _b, preview, restored, restoredRecords, safety, _c;
    return __generator(this, function (_d) {
        switch (_d.label) {
            case 0: return [4 /*yield*/, tempWorkspace()];
            case 1:
                root = _d.sent();
                events = [];
                ledger = new src_1.ContextLedger();
                ledger.add({ id: "user-1", role: "user", content: "checkpoint" });
                return [4 /*yield*/, (0, src_1.initializeDefaultCheckpointStore)({
                        sessionID: "ses_checkpoint_user",
                        workspaceRoot: root,
                        context: ledger,
                        onEvent: function (event) { return events.push(event); },
                    })];
            case 2:
                store = _d.sent();
                _a = bun_test_1.expect;
                return [4 /*yield*/, store.list()];
            case 3:
                _a.apply(void 0, [(_d.sent()).map(function (record) { return record.id; })]).toEqual([
                    "checkpoint_0",
                ]);
                ledger.add({ id: "assistant-1", role: "assistant", content: "writing file" });
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(root, "test_example.py"), "print('ok')\n")];
            case 4:
                _d.sent();
                interpreter = pythonInterpreter();
                if (interpreter) {
                    run = Bun.spawnSync([interpreter, (0, node_path_1.join)(root, "test_example.py")]);
                    (0, bun_test_1.expect)(run.exitCode).toBe(0);
                    (0, bun_test_1.expect)(run.stdout.toString().trim()).toBe("ok");
                }
                ledger.add({
                    id: "tool-call",
                    role: "tool_call",
                    content: "write_file test_example.py",
                });
                ledger.add({
                    id: "tool-result",
                    role: "tool_result",
                    content: "created test_example.py",
                });
                ledger.recordProviderUsage(20, 5);
                return [4 /*yield*/, store.createCheckpoint({
                        reason: "manual",
                        context: ledger,
                        step: 3,
                        status: "ran python",
                        name: "ran python",
                    })];
            case 5:
                _d.sent();
                _b = bun_test_1.expect;
                return [4 /*yield*/, (0, promises_1.readFile)((0, node_path_1.join)(root, "test_example.py"), "utf8")];
            case 6:
                _b.apply(void 0, [_d.sent()]).toContain("ok");
                return [4 /*yield*/, store.rollbackTo("checkpoint_0", { context: ledger })];
            case 7:
                preview = _d.sent();
                (0, bun_test_1.expect)(preview.changes.some(function (change) { return change.kind === "delete" && change.path === "test_example.py"; })).toBe(true);
                return [4 /*yield*/, (0, bun_test_1.expect)((0, promises_1.readFile)((0, node_path_1.join)(root, "test_example.py"), "utf8")).rejects.toMatchObject({ code: "ENOENT" })];
            case 8:
                _d.sent();
                (0, bun_test_1.expect)(ledger.snapshot().entries.map(function (entry) { return entry.id; })).toEqual([
                    "user-1",
                ]);
                (0, bun_test_1.expect)(ledger.journalStatus()).toMatchObject({
                    journalOffset: 1,
                    messageCount: 1,
                });
                (0, bun_test_1.expect)(events.map(function (event) { return event.type; })).toContain("checkpoint.created");
                (0, bun_test_1.expect)(events.map(function (event) { return event.type; })).toContain("rollback.end");
                return [4 /*yield*/, src_1.CheckpointStore.open({
                        sessionID: "ses_checkpoint_user",
                        workspaceRoot: root,
                    })];
            case 9:
                restored = _d.sent();
                return [4 /*yield*/, restored.list()];
            case 10:
                restoredRecords = _d.sent();
                safety = restoredRecords.find(function (record) { return record.reason === "rollback_safety"; });
                (0, bun_test_1.expect)(safety).toBeDefined();
                (0, bun_test_1.expect)(restoredRecords.map(function (record) { return record.id; })).toEqual([
                    "checkpoint_0",
                    safety.id,
                ]);
                return [4 /*yield*/, restored.rollbackTo(safety.id, { context: ledger })];
            case 11:
                _d.sent();
                _c = bun_test_1.expect;
                return [4 /*yield*/, (0, promises_1.readFile)((0, node_path_1.join)(root, "test_example.py"), "utf8")];
            case 12:
                _c.apply(void 0, [_d.sent()]).toContain("ok");
                return [2 /*return*/];
        }
    });
}); });
symlinkTest("manifest tracks modify delete rename mode symlink and reuses objects", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, ledger, store, baseline, baselineManifest, changed, changedManifest, _a, _b, _c, _d, buckets, hashes;
    var _e, _f;
    return __generator(this, function (_g) {
        switch (_g.label) {
            case 0: return [4 /*yield*/, tempWorkspace()];
            case 1:
                root = _g.sent();
                ledger = new src_1.ContextLedger();
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(root, "a.txt"), "same\n")];
            case 2:
                _g.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(root, "delete.txt"), "remove\n")];
            case 3:
                _g.sent();
                return [4 /*yield*/, (0, promises_1.mkdir)((0, node_path_1.join)(root, "dir"))];
            case 4:
                _g.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(root, "dir", "target.txt"), "target\n")];
            case 5:
                _g.sent();
                return [4 /*yield*/, (0, promises_1.symlink)("dir/target.txt", (0, node_path_1.join)(root, "link.txt"))];
            case 6:
                _g.sent();
                return [4 /*yield*/, (0, src_1.initializeDefaultCheckpointStore)({
                        sessionID: "ses_manifest",
                        workspaceRoot: root,
                        context: ledger,
                    })];
            case 7:
                store = _g.sent();
                return [4 /*yield*/, store.list()];
            case 8:
                baseline = (_g.sent())[0];
                return [4 /*yield*/, store.loadManifest(baseline)];
            case 9:
                baselineManifest = _g.sent();
                (0, bun_test_1.expect)((_e = baselineManifest.entries["link.txt"]) === null || _e === void 0 ? void 0 : _e.kind).toBe("symlink");
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(root, "a.txt"), "changed\n")];
            case 10:
                _g.sent();
                return [4 /*yield*/, (0, promises_1.rm)((0, node_path_1.join)(root, "delete.txt"))];
            case 11:
                _g.sent();
                return [4 /*yield*/, (0, promises_1.rename)((0, node_path_1.join)(root, "dir", "target.txt"), (0, node_path_1.join)(root, "renamed.txt"))];
            case 12:
                _g.sent();
                return [4 /*yield*/, (0, promises_1.chmod)((0, node_path_1.join)(root, "a.txt"), 493)];
            case 13:
                _g.sent();
                return [4 /*yield*/, store.createCheckpoint({
                        reason: "manual",
                        context: ledger,
                        step: 1,
                    })];
            case 14:
                _g.sent();
                return [4 /*yield*/, store.list()];
            case 15:
                changed = (_g.sent()).at(-1);
                (0, bun_test_1.expect)(changed.changes.map(function (change) { return change.kind; })).toEqual(bun_test_1.expect.arrayContaining(["modify", "delete", "rename", "mode"]));
                return [4 /*yield*/, store.loadManifest(changed)];
            case 16:
                changedManifest = _g.sent();
                (0, bun_test_1.expect)((_f = changedManifest.entries["link.txt"]) === null || _f === void 0 ? void 0 : _f.kind).toBe("symlink");
                return [4 /*yield*/, store.rollbackTo("checkpoint_0", { context: ledger })];
            case 17:
                _g.sent();
                _a = bun_test_1.expect;
                return [4 /*yield*/, (0, promises_1.readFile)((0, node_path_1.join)(root, "a.txt"), "utf8")];
            case 18:
                _a.apply(void 0, [_g.sent()]).toBe("same\n");
                _b = bun_test_1.expect;
                return [4 /*yield*/, (0, promises_1.lstat)((0, node_path_1.join)(root, "a.txt"))];
            case 19:
                _b.apply(void 0, [(_g.sent()).mode & 511]).toBe(420);
                _c = bun_test_1.expect;
                return [4 /*yield*/, (0, promises_1.readFile)((0, node_path_1.join)(root, "delete.txt"), "utf8")];
            case 20:
                _c.apply(void 0, [_g.sent()]).toBe("remove\n");
                _d = bun_test_1.expect;
                return [4 /*yield*/, (0, promises_1.lstat)((0, node_path_1.join)(root, "link.txt"))];
            case 21:
                _d.apply(void 0, [(_g.sent()).isSymbolicLink()]).toBe(true);
                return [4 /*yield*/, store.gcObjects(true)];
            case 22:
                _g.sent();
                return [4 /*yield*/, (0, promises_1.readdir)((0, node_path_1.join)(root, ".natalia", "objects"))];
            case 23:
                buckets = _g.sent();
                return [4 /*yield*/, Promise.all(buckets.map(function (bucket) {
                        return (0, promises_1.readdir)((0, node_path_1.join)(root, ".natalia", "objects", bucket));
                    }))];
            case 24:
                hashes = (_g.sent()).flat();
                (0, bun_test_1.expect)(new Set(hashes).size).toBe(hashes.length);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("concurrent checkpoint creation assigns unique durable sequences", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, ledger, store, records, _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, tempWorkspace()];
            case 1:
                root = _b.sent();
                ledger = new src_1.ContextLedger();
                return [4 /*yield*/, src_1.CheckpointStore.open({
                        sessionID: "ses_checkpoint_concurrent",
                        workspaceRoot: root,
                    })];
            case 2:
                store = _b.sent();
                return [4 /*yield*/, Promise.all([1, 2, 3].map(function (step) {
                        return store.createCheckpoint({ reason: "manual", context: ledger, step: step });
                    }))];
            case 3:
                records = _b.sent();
                (0, bun_test_1.expect)(records.map(function (record) { return record.sequence; })).toEqual([0, 1, 2]);
                _a = bun_test_1.expect;
                return [4 /*yield*/, store.list()];
            case 4:
                _a.apply(void 0, [(_b.sent()).map(function (record) { return record.id; })]).toEqual([
                    "checkpoint_0",
                    "checkpoint_1",
                    "checkpoint_2",
                ]);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("rollback refuses to mutate when its safety checkpoint is incomplete", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, ledger, store, _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, tempWorkspace()];
            case 1:
                root = _b.sent();
                ledger = new src_1.ContextLedger();
                return [4 /*yield*/, src_1.CheckpointStore.open({
                        sessionID: "ses_checkpoint_safety",
                        workspaceRoot: root,
                        maxFiles: 1,
                    })];
            case 2:
                store = _b.sent();
                return [4 /*yield*/, store.createCheckpoint({
                        reason: "baseline",
                        context: ledger,
                        step: 0,
                    })];
            case 3:
                _b.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(root, "first.txt"), "first\n")];
            case 4:
                _b.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(root, "second.txt"), "second\n")];
            case 5:
                _b.sent();
                return [4 /*yield*/, (0, bun_test_1.expect)(store.rollbackTo("checkpoint_0", { context: ledger })).rejects.toThrow("rollback safety checkpoint is incomplete")];
            case 6:
                _b.sent();
                _a = bun_test_1.expect;
                return [4 /*yield*/, (0, promises_1.readFile)((0, node_path_1.join)(root, "second.txt"), "utf8")];
            case 7:
                _a.apply(void 0, [_b.sent()]).toBe("second\n");
                return [2 /*return*/];
        }
    });
}); });
symlinkTest("incomplete checkpoint and ignored files are visible and guarded", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, ledger, events, store, record, recordManifest, failed;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, tempWorkspace()];
            case 1:
                root = _a.sent();
                ledger = new src_1.ContextLedger();
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(root, "tracked.txt"), "tracked\n")];
            case 2:
                _a.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(root, "ignored.log"), "ignored\n")];
            case 3:
                _a.sent();
                return [4 /*yield*/, (0, promises_1.symlink)("/tmp", (0, node_path_1.join)(root, "escape"))];
            case 4:
                _a.sent();
                events = [];
                return [4 /*yield*/, src_1.CheckpointStore.open({
                        sessionID: "ses_incomplete",
                        workspaceRoot: root,
                        ignore: ["*.log", "ignored.log"],
                        additionalDirs: ["../outside"],
                        onEvent: function (event) { return events.push(event); },
                    })];
            case 5:
                store = _a.sent();
                return [4 /*yield*/, store.createCheckpoint({
                        reason: "manual",
                        context: ledger,
                        step: 1,
                    })];
            case 6:
                record = _a.sent();
                (0, bun_test_1.expect)(record.complete).toBe(false);
                (0, bun_test_1.expect)(record.errors.join("\n")).toContain("symlink outside");
                (0, bun_test_1.expect)(record.errors.join("\n")).toContain("additional directory is outside the managed workspace");
                return [4 /*yield*/, store.loadManifest(record)];
            case 7:
                recordManifest = _a.sent();
                (0, bun_test_1.expect)(recordManifest.entries["ignored.log"]).toBeUndefined();
                (0, bun_test_1.expect)(events.map(function (event) { return event.type; })).toContain("checkpoint.failed");
                (0, bun_test_1.expect)(events.map(function (event) { return event.type; })).not.toContain("checkpoint.created");
                failed = events.find(function (event) {
                    return event.type === "checkpoint.failed";
                });
                (0, bun_test_1.expect)(failed === null || failed === void 0 ? void 0 : failed.errors).toEqual(bun_test_1.expect.arrayContaining([
                    "checkpoint contains a symlink outside the managed workspace",
                ]));
                (0, bun_test_1.expect)(JSON.stringify(failed)).not.toContain("escape");
                (0, bun_test_1.expect)(JSON.stringify(failed)).not.toContain("/tmp");
                return [4 /*yield*/, (0, bun_test_1.expect)(store.rollbackTo(record.id, { context: ledger })).rejects.toThrow("incomplete")];
            case 8:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("checkpoint structurally excludes its own stores even without .natalia/ ignore", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, ledger, store, baseline, baselineManifest, paths;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, tempWorkspace()];
            case 1:
                root = _a.sent();
                ledger = new src_1.ContextLedger();
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(root, ".nataliaignore"), "# no .natalia rule\n")];
            case 2:
                _a.sent();
                return [4 /*yield*/, (0, promises_1.mkdir)((0, node_path_1.join)(root, "src"), { recursive: true })];
            case 3:
                _a.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(root, "src", "main.ts"), "export {}\n")];
            case 4:
                _a.sent();
                return [4 /*yield*/, (0, src_1.initializeDefaultCheckpointStore)({
                        sessionID: "ses_checkpoint_self_exclusion",
                        workspaceRoot: root,
                        context: ledger,
                    })];
            case 5:
                store = _a.sent();
                return [4 /*yield*/, store.list()];
            case 6:
                baseline = (_a.sent())[0];
                return [4 /*yield*/, store.loadManifest(baseline)];
            case 7:
                baselineManifest = _a.sent();
                paths = Object.keys(baselineManifest.entries);
                (0, bun_test_1.expect)(paths).toContain("src/main.ts");
                (0, bun_test_1.expect)(paths.some(function (path) { return path.startsWith(".natalia/objects/"); })).toBe(false);
                (0, bun_test_1.expect)(paths.some(function (path) { return path.startsWith(".natalia/checkpoints/"); })).toBe(false);
                (0, bun_test_1.expect)(paths).not.toContain(".nataliaignore");
                return [2 /*return*/];
        }
    });
}); });
symlinkTest("large ignored workspace fixtures do not make a durable checkpoint incomplete", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, ledger, events, store, baseline, baselineManifest, _a, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0: return [4 /*yield*/, tempWorkspace()];
            case 1:
                root = _c.sent();
                ledger = new src_1.ContextLedger();
                events = [];
                return [4 /*yield*/, (0, promises_1.mkdir)((0, node_path_1.join)(root, "source"), { recursive: true })];
            case 2:
                _c.sent();
                return [4 /*yield*/, (0, promises_1.mkdir)((0, node_path_1.join)(root, "fixture-output"), { recursive: true })];
            case 3:
                _c.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(root, ".nataliaignore"), "/fixture-output\n")];
            case 4:
                _c.sent();
                return [4 /*yield*/, Promise.all(Array.from({ length: 750 }, function (_, index) {
                        return (0, promises_1.writeFile)((0, node_path_1.join)(root, "source", "".concat(index, ".txt")), "entry ".concat(index, "\n"));
                    }))];
            case 5:
                _c.sent();
                return [4 /*yield*/, (0, promises_1.symlink)("/not-a-managed-target", (0, node_path_1.join)(root, "fixture-output", "broken"))];
            case 6:
                _c.sent();
                return [4 /*yield*/, (0, src_1.initializeDefaultCheckpointStore)({
                        sessionID: "ses_checkpoint_large_ignored_fixture",
                        workspaceRoot: root,
                        context: ledger,
                        onEvent: function (event) {
                            if (event.type === "checkpoint.created" ||
                                event.type === "checkpoint.failed")
                                events.push(event);
                        },
                    })];
            case 7:
                store = _c.sent();
                return [4 /*yield*/, store.list()];
            case 8:
                baseline = (_c.sent())[0];
                (0, bun_test_1.expect)(baseline).toMatchObject({ complete: true });
                return [4 /*yield*/, store.loadManifest(baseline)];
            case 9:
                baselineManifest = _c.sent();
                (0, bun_test_1.expect)(Object.keys(baselineManifest.entries)).toHaveLength(751);
                (0, bun_test_1.expect)(baselineManifest.entries["fixture-output/broken"]).toBeUndefined();
                (0, bun_test_1.expect)(events).toEqual([
                    bun_test_1.expect.objectContaining({ type: "checkpoint.created", complete: true }),
                ]);
                _a = bun_test_1.expect;
                return [4 /*yield*/, store.previewRollback("checkpoint_0", ledger, [], true)];
            case 10:
                _a.apply(void 0, [_c.sent()]).toMatchObject({
                    checkpointID: "checkpoint_0",
                    complete: true,
                    dryRun: true,
                });
                _b = bun_test_1.expect;
                return [4 /*yield*/, store.rollbackTo("checkpoint_0", { context: ledger, dryRun: true })];
            case 11:
                _b.apply(void 0, [_c.sent()]).toMatchObject({ complete: true, dryRun: true });
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("rollback failure restores safety checkpoint for workspace and context", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, ledger, store, _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, tempWorkspace()];
            case 1:
                root = _b.sent();
                ledger = new src_1.ContextLedger();
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(root, "file.txt"), "before\n")];
            case 2:
                _b.sent();
                return [4 /*yield*/, (0, src_1.initializeDefaultCheckpointStore)({
                        sessionID: "ses_transaction",
                        workspaceRoot: root,
                        context: ledger,
                    })];
            case 3:
                store = _b.sent();
                ledger.add({ id: "assistant", role: "assistant", content: "after" });
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(root, "file.txt"), "after\n")];
            case 4:
                _b.sent();
                return [4 /*yield*/, store.createCheckpoint({ reason: "manual", context: ledger, step: 1 })];
            case 5:
                _b.sent();
                return [4 /*yield*/, (0, bun_test_1.expect)(store.rollbackTo("checkpoint_0", {
                        context: ledger,
                        failContextRestore: true,
                    })).rejects.toThrow("injected context rollback failure")];
            case 6:
                _b.sent();
                _a = bun_test_1.expect;
                return [4 /*yield*/, (0, promises_1.readFile)((0, node_path_1.join)(root, "file.txt"), "utf8")];
            case 7:
                _a.apply(void 0, [_b.sent()]).toBe("after\n");
                (0, bun_test_1.expect)(ledger.snapshot().entries.map(function (entry) { return entry.id; })).toEqual([
                    "assistant",
                ]);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("dry-run preview includes running PTY Sandbox workflow modal policy", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, ledger, events, store, resources, preview;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, tempWorkspace()];
            case 1:
                root = _a.sent();
                ledger = new src_1.ContextLedger();
                events = [];
                return [4 /*yield*/, (0, src_1.initializeDefaultCheckpointStore)({
                        sessionID: "ses_resources",
                        workspaceRoot: root,
                        context: ledger,
                        onEvent: function (event) { return events.push(event.type); },
                    })];
            case 2:
                store = _a.sent();
                resources = [
                    {
                        kind: "terminal",
                        id: "pty_1",
                        status: "running",
                        summary: "interactive shell",
                    },
                    {
                        kind: "sandbox",
                        id: "box_1",
                        status: "preserve_dirty",
                        summary: "dirty sandbox",
                    },
                    {
                        kind: "workflow",
                        id: "wf_1",
                        status: "pending",
                        summary: "pending workflow",
                    },
                    {
                        kind: "pending_modal",
                        id: "apr_1",
                        status: "pending",
                        summary: "approval modal",
                    },
                ];
                return [4 /*yield*/, store.previewRollback("checkpoint_0", ledger, resources, true)];
            case 3:
                preview = _a.sent();
                (0, bun_test_1.expect)(preview.dryRun).toBe(true);
                (0, bun_test_1.expect)(preview.resources.map(function (resource) { return resource.action; })).toEqual([
                    "stop",
                    "preserve_dirty",
                    "stop",
                    "invalidate",
                ]);
                (0, bun_test_1.expect)(events).toContain("rollback.previewed");
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("rollback applies resource policies and projects restored context", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, ledger, store, policies, restored;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, tempWorkspace()];
            case 1:
                root = _a.sent();
                ledger = new src_1.ContextLedger();
                ledger.add({ id: "baseline", role: "user", content: "baseline" });
                return [4 /*yield*/, (0, src_1.initializeDefaultCheckpointStore)({
                        sessionID: "ses_resource_apply",
                        workspaceRoot: root,
                        context: ledger,
                    })];
            case 2:
                store = _a.sent();
                ledger.add({ id: "later", role: "user", content: "later" });
                policies = [];
                restored = 0;
                return [4 /*yield*/, store.rollbackTo("checkpoint_0", {
                        context: ledger,
                        resources: [
                            { kind: "terminal", id: "pty_1", status: "running", summary: "shell" },
                            {
                                kind: "sandbox",
                                id: "box_1",
                                status: "preserve_dirty",
                                summary: "dirty",
                            },
                        ],
                        onResourcePolicy: function (policy) { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                policies.push("".concat(policy.kind, ":").concat(policy.action));
                                return [2 /*return*/];
                            });
                        }); },
                        onContextRestored: function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                restored++;
                                return [2 /*return*/];
                            });
                        }); },
                    })];
            case 3:
                _a.sent();
                (0, bun_test_1.expect)(policies).toEqual(["terminal:stop"]);
                (0, bun_test_1.expect)(restored).toBe(1);
                (0, bun_test_1.expect)(ledger.snapshot().entries.map(function (entry) { return entry.id; })).toEqual([
                    "baseline",
                ]);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("commands, typed events and session replay are stable", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, ledger, session, store, created, listed, dryRun, rollback, checkpointEvent;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, tempWorkspace()];
            case 1:
                root = _a.sent();
                ledger = new src_1.ContextLedger();
                session = (0, session_1.createSessionRecord)("ses_projection", "projection");
                return [4 /*yield*/, (0, src_1.initializeDefaultCheckpointStore)({
                        sessionID: "ses_projection",
                        workspaceRoot: root,
                        context: ledger,
                        onEvent: function (event) { return (0, session_1.appendSessionEvent)(session, event); },
                    })];
            case 2:
                store = _a.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(root, "file.txt"), "content\n")];
            case 3:
                _a.sent();
                return [4 /*yield*/, (0, src_1.runCheckpointCommand)(store, ledger, "/checkpoint")];
            case 4:
                created = _a.sent();
                (0, bun_test_1.expect)(created.output).toContain("checkpoint_1");
                return [4 /*yield*/, (0, src_1.runCheckpointCommand)(store, ledger, "/checkpoints --limit 5")];
            case 5:
                listed = _a.sent();
                (0, bun_test_1.expect)(listed.output).toContain("files=1");
                return [4 /*yield*/, (0, src_1.runCheckpointCommand)(store, ledger, "/rollback checkpoint_0 --dry-run")];
            case 6:
                dryRun = _a.sent();
                (0, bun_test_1.expect)(dryRun.output).toContain("dry-run");
                return [4 /*yield*/, (0, src_1.runCheckpointCommand)(store, ledger, "/rollback last")];
            case 7:
                rollback = _a.sent();
                (0, bun_test_1.expect)(rollback.output).toContain("rollback");
                checkpointEvent = session.events.find(function (event) { return event.type === "checkpoint.created"; });
                (0, bun_test_1.expect)(checkpointEvent.type).toBe("checkpoint.created");
                (0, bun_test_1.expect)(session.events.map(function (event) { return event.type; })).toEqual(bun_test_1.expect.arrayContaining([
                    "checkpoint.created",
                    "rollback.previewed",
                    "rollback.end",
                ]));
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("disabled and initialization failure emit visible diagnostics", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, disabled, failed, fileStore;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, tempWorkspace()];
            case 1:
                root = _a.sent();
                disabled = [];
                return [4 /*yield*/, src_1.CheckpointStore.open({
                        sessionID: "ses_disabled",
                        workspaceRoot: root,
                        enabled: false,
                        onEvent: function (event) { return disabled.push(event.type); },
                    })];
            case 2:
                _a.sent();
                (0, bun_test_1.expect)(disabled).toEqual(["checkpoint.unavailable"]);
                failed = [];
                fileStore = (0, node_path_1.join)(root, "not-a-dir");
                return [4 /*yield*/, (0, promises_1.writeFile)(fileStore, "x")];
            case 3:
                _a.sent();
                return [4 /*yield*/, src_1.CheckpointStore.open({
                        sessionID: "ses_failed",
                        workspaceRoot: root,
                        storeDir: fileStore,
                        onEvent: function (event) { return failed.push(event.type); },
                    })];
            case 4:
                _a.sent();
                (0, bun_test_1.expect)(failed).toEqual(["checkpoint.unavailable"]);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("checkpoint rename persists a user label in the journal", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, ledger, store, renamed, reopened, _a;
    var _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0: return [4 /*yield*/, tempWorkspace()];
            case 1:
                root = _c.sent();
                ledger = new src_1.ContextLedger();
                return [4 /*yield*/, (0, src_1.initializeDefaultCheckpointStore)({
                        sessionID: "ses_rename",
                        workspaceRoot: root,
                        context: ledger,
                    })];
            case 2:
                store = _c.sent();
                return [4 /*yield*/, store.rename("checkpoint_0", "  before tools  ")];
            case 3:
                renamed = _c.sent();
                (0, bun_test_1.expect)(renamed.name).toBe("before tools");
                return [4 /*yield*/, src_1.CheckpointStore.open({
                        sessionID: "ses_rename",
                        workspaceRoot: root,
                    })];
            case 4:
                reopened = _c.sent();
                _a = bun_test_1.expect;
                return [4 /*yield*/, reopened.list()];
            case 5:
                _a.apply(void 0, [(_b = (_c.sent())[0]) === null || _b === void 0 ? void 0 : _b.name]).toBe("before tools");
                return [2 /*return*/];
        }
    });
}); });
/**
 * The A + CDC contract in one test: an append-only session must store only the
 * new entries per checkpoint (so the journal stays tiny and does not grow
 * quadratically), yet every materialized context must be byte-identical to the
 * full snapshot it replaced, and a rollback must restore one exactly.
 */
(0, bun_test_1.test)("append-only checkpoints stay small and replay their contexts exactly", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, ledger, store, expected, N, index, records, naiveBytes, index, record, full, journalBytes, middle, live, index;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, tempWorkspace()];
            case 1:
                root = _b.sent();
                ledger = new src_1.ContextLedger();
                return [4 /*yield*/, (0, src_1.initializeDefaultCheckpointStore)({
                        sessionID: "ses_delta_replay",
                        workspaceRoot: root,
                        context: ledger,
                    })];
            case 2:
                store = _b.sent();
                expected = [[]];
                N = 60;
                index = 1;
                _b.label = 3;
            case 3:
                if (!(index <= N)) return [3 /*break*/, 6];
                ledger.add({
                    id: "m".concat(index),
                    role: "user",
                    content: "message ".concat(index, " ").repeat(40),
                });
                return [4 /*yield*/, store.createCheckpoint({
                        reason: "manual",
                        context: ledger,
                        step: index,
                        status: "manual",
                    })];
            case 4:
                _b.sent();
                expected.push(ledger.snapshot().entries.map(function (entry) { return entry.id; }));
                _b.label = 5;
            case 5:
                index++;
                return [3 /*break*/, 3];
            case 6: return [4 /*yield*/, store.list()];
            case 7:
                records = _b.sent();
                (0, bun_test_1.expect)(records.length).toBe(N + 1);
                // Listings carry only the scalar header — no ledger entries materialized.
                (0, bun_test_1.expect)(records.every(function (record) { return record.context === undefined; })).toBe(true);
                naiveBytes = 0;
                index = 0;
                _b.label = 8;
            case 8:
                if (!(index <= N)) return [3 /*break*/, 11];
                record = records[index];
                (0, bun_test_1.expect)(record.contextMeta.entryCount).toBe(expected[index].length);
                return [4 /*yield*/, store.get(record.id)];
            case 9:
                full = _b.sent();
                (0, bun_test_1.expect)((_a = full === null || full === void 0 ? void 0 : full.context) === null || _a === void 0 ? void 0 : _a.entries.map(function (entry) { return entry.id; })).toEqual(expected[index]);
                naiveBytes += Buffer.byteLength(JSON.stringify(full.context));
                _b.label = 10;
            case 10:
                index++;
                return [3 /*break*/, 8];
            case 11: return [4 /*yield*/, (0, promises_1.readFile)((0, node_path_1.join)(root, ".natalia", "checkpoints", "ses_delta_replay", "journal.jsonl"))];
            case 12:
                journalBytes = (_b.sent()).byteLength;
                // Full snapshots would be ~sum(index * entrySize); deltas should be a small
                // fraction of that, not merely "smaller".
                (0, bun_test_1.expect)(journalBytes * 5).toBeLessThan(naiveBytes);
                middle = records[Math.floor(N / 2)];
                live = new src_1.ContextLedger();
                for (index = 0; index < N * 2; index++)
                    live.add({ id: "live".concat(index), role: "user", content: "live state" });
                return [4 /*yield*/, store.rollbackTo(middle.id, { context: live })];
            case 13:
                _b.sent();
                (0, bun_test_1.expect)(live.snapshot().entries.map(function (entry) { return entry.id; })).toEqual(expected[middle.sequence]);
                return [2 /*return*/];
        }
    });
}); });
/**
 * A legacy v2 journal (inline manifest + context) must be migrated in place to
 * v3 on first open, keep its `.v2-backup`, preserve every record and replay
 * each context exactly.
 */
(0, bun_test_1.test)("a v2 journal migrates to v3 and keeps every checkpoint", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, ledger, store, expected, index, journalPath, full, reopened, migrated, index, record, rewritten;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, tempWorkspace()];
            case 1:
                root = _b.sent();
                ledger = new src_1.ContextLedger();
                return [4 /*yield*/, (0, src_1.initializeDefaultCheckpointStore)({
                        sessionID: "ses_migrate_v2",
                        workspaceRoot: root,
                        context: ledger,
                    })];
            case 2:
                store = _b.sent();
                expected = [[]];
                index = 1;
                _b.label = 3;
            case 3:
                if (!(index <= 5)) return [3 /*break*/, 6];
                ledger.add({ id: "m".concat(index), role: "user", content: "turn ".concat(index) });
                return [4 /*yield*/, store.createCheckpoint({
                        reason: "manual",
                        context: ledger,
                        step: index,
                        status: "manual",
                    })];
            case 4:
                _b.sent();
                expected.push(ledger.snapshot().entries.map(function (entry) { return entry.id; }));
                _b.label = 5;
            case 5:
                index++;
                return [3 /*break*/, 3];
            case 6:
                journalPath = (0, node_path_1.join)(root, ".natalia", "checkpoints", "ses_migrate_v2", "journal.jsonl");
                return [4 /*yield*/, store
                        .list()
                        .then(function (records) { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                        return [2 /*return*/, Promise.all(records.map(function (record) { return store.get(record.id); }))];
                    }); }); })];
            case 7:
                full = _b.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)(journalPath, "".concat(full
                        .map(function (record) {
                        return JSON.stringify(__assign(__assign({}, record), { schemaVersion: 2, context: record.context }));
                    })
                        .join("\n"), "\n"))];
            case 8:
                _b.sent();
                return [4 /*yield*/, src_1.CheckpointStore.open({
                        sessionID: "ses_migrate_v2",
                        workspaceRoot: root,
                    })];
            case 9:
                reopened = _b.sent();
                return [4 /*yield*/, reopened.list()];
            case 10:
                migrated = _b.sent();
                (0, bun_test_1.expect)(migrated.length).toBe(6);
                index = 0;
                _b.label = 11;
            case 11:
                if (!(index < migrated.length)) return [3 /*break*/, 14];
                return [4 /*yield*/, reopened.get(migrated[index].id)];
            case 12:
                record = _b.sent();
                (0, bun_test_1.expect)((_a = record === null || record === void 0 ? void 0 : record.context) === null || _a === void 0 ? void 0 : _a.entries.map(function (entry) { return entry.id; })).toEqual(expected[index]);
                _b.label = 13;
            case 13:
                index++;
                return [3 /*break*/, 11];
            case 14: return [4 /*yield*/, (0, promises_1.readFile)(journalPath, "utf8")];
            case 15:
                rewritten = _b.sent();
                (0, bun_test_1.expect)(rewritten).toContain('"schemaVersion":3');
                (0, bun_test_1.expect)(rewritten).not.toContain('"schemaVersion":2');
                return [4 /*yield*/, (0, promises_1.lstat)("".concat(journalPath, ".v2-backup"))];
            case 16:
                _b.sent();
                return [2 /*return*/];
        }
    });
}); });
/**
 * Sub-4KB payloads (the common case: a tool call adds one or two entries) are
 * inlined in the journal line instead of becoming one-block chunk files, which
 * is where most of the small-file overhead came from.
 */
(0, bun_test_1.test)("small checkpoint payloads are inlined instead of chunked", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, ledger, store, journal, chunkFiles;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, tempWorkspace()];
            case 1:
                root = _a.sent();
                ledger = new src_1.ContextLedger();
                return [4 /*yield*/, (0, src_1.initializeDefaultCheckpointStore)({
                        sessionID: "ses_inline",
                        workspaceRoot: root,
                        context: ledger,
                    })];
            case 2:
                store = _a.sent();
                ledger.add({ id: "m1", role: "user", content: "small turn" });
                return [4 /*yield*/, store.createCheckpoint({
                        reason: "manual",
                        context: ledger,
                        step: 1,
                        status: "manual",
                    })];
            case 3:
                _a.sent();
                return [4 /*yield*/, (0, promises_1.readFile)((0, node_path_1.join)(root, ".natalia", "checkpoints", "ses_inline", "journal.jsonl"), "utf8")];
            case 4:
                journal = _a.sent();
                (0, bun_test_1.expect)(journal).toContain('"inline"');
                (0, bun_test_1.expect)(journal).not.toContain('"ref"');
                return [4 /*yield*/, countFiles((0, node_path_1.join)(root, ".natalia", "chunks", "ses_inline"))];
            case 5:
                chunkFiles = _a.sent();
                (0, bun_test_1.expect)(chunkFiles).toBe(0);
                return [2 /*return*/];
        }
    });
}); });
function countFiles(root) {
    return __awaiter(this, void 0, void 0, function () {
        var entries, error_1, count, _i, entries_1, entry, _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    _c.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, (0, promises_1.readdir)(root, { withFileTypes: true })];
                case 1:
                    entries = _c.sent();
                    return [3 /*break*/, 3];
                case 2:
                    error_1 = _c.sent();
                    if (error_1.code === "ENOENT")
                        return [2 /*return*/, 0];
                    throw error_1;
                case 3:
                    count = 0;
                    _i = 0, entries_1 = entries;
                    _c.label = 4;
                case 4:
                    if (!(_i < entries_1.length)) return [3 /*break*/, 9];
                    entry = entries_1[_i];
                    _a = count;
                    if (!entry.isDirectory()) return [3 /*break*/, 6];
                    return [4 /*yield*/, countFiles((0, node_path_1.join)(root, entry.name))];
                case 5:
                    _b = _c.sent();
                    return [3 /*break*/, 7];
                case 6:
                    _b = entry.isFile()
                        ? 1
                        : 0;
                    _c.label = 7;
                case 7:
                    count = _a + _b;
                    _c.label = 8;
                case 8:
                    _i++;
                    return [3 /*break*/, 4];
                case 9: return [2 /*return*/, count];
            }
        });
    });
}
/**
 * Regression: appending one checkpoint must not read (or rewrite) the whole
 * journal. The old path called `list()` in `ensureBaseline` and again in
 * `createCheckpointLocked`, then serialized every record back out. On a long
 * session the journal reaches hundreds of MB, so each turn's
 * `createTurnCheckpoint` stalled before the provider ran — the fix reads only
 * the journal tail and appends one line. `list()` is spied on because a full
 * read is exactly what regressed; asserting on wall-clock time would be flaky.
 */
(0, bun_test_1.test)("a checkpoint appends without reading the whole journal", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, ledger, store, realList, listCalls, created, _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, tempWorkspace()];
            case 1:
                root = _b.sent();
                ledger = new src_1.ContextLedger();
                ledger.add({ id: "user-1", role: "user", content: "checkpoint" });
                return [4 /*yield*/, (0, src_1.initializeDefaultCheckpointStore)({
                        sessionID: "ses_append_only",
                        workspaceRoot: root,
                        context: ledger,
                    })];
            case 2:
                store = _b.sent();
                realList = store.list.bind(store);
                listCalls = 0;
                store.list = function () { return __awaiter(void 0, void 0, void 0, function () {
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0:
                                listCalls += 1;
                                return [4 /*yield*/, realList()];
                            case 1: return [2 /*return*/, _a.sent()];
                        }
                    });
                }); };
                // Both entry points on the turn path: the baseline existence check and the
                // turn's own checkpoint creation.
                return [4 /*yield*/, store.ensureBaseline(ledger, 0)];
            case 3:
                // Both entry points on the turn path: the baseline existence check and the
                // turn's own checkpoint creation.
                _b.sent();
                return [4 /*yield*/, store.createCheckpoint({
                        reason: "turn_begin",
                        context: ledger,
                        step: 1,
                        status: "turn_begin",
                    })];
            case 4:
                created = _b.sent();
                (0, bun_test_1.expect)(listCalls).toBe(0);
                // Correctness is unchanged: the record is appended with the next sequence
                // and stays visible to a full read.
                (0, bun_test_1.expect)(created.sequence).toBe(1);
                _a = bun_test_1.expect;
                return [4 /*yield*/, realList()];
            case 5:
                _a.apply(void 0, [(_b.sent()).map(function (record) { return record.id; })]).toEqual([
                    "checkpoint_0",
                    "checkpoint_1",
                ]);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("list() omits the manifest and loadManifest rebuilds it on demand", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, ledger, store, summary, manifest, full;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, tempWorkspace()];
            case 1:
                root = _a.sent();
                ledger = new src_1.ContextLedger();
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(root, "a.txt"), "one\n")];
            case 2:
                _a.sent();
                return [4 /*yield*/, (0, src_1.initializeDefaultCheckpointStore)({
                        sessionID: "ses_manifest_lazy",
                        workspaceRoot: root,
                        context: ledger,
                    })];
            case 3:
                store = _a.sent();
                return [4 /*yield*/, store.list()];
            case 4:
                summary = (_a.sent())[0];
                // Scalars stay available without materializing the (potentially huge) entries.
                (0, bun_test_1.expect)(summary.manifest).toBeUndefined();
                (0, bun_test_1.expect)(summary.manifestMeta.complete).toBe(true);
                (0, bun_test_1.expect)(summary.manifestMeta.entryCount).toBeGreaterThan(0);
                return [4 /*yield*/, store.loadManifest(summary)];
            case 5:
                manifest = _a.sent();
                (0, bun_test_1.expect)(Object.keys(manifest.entries)).toContain("a.txt");
                return [4 /*yield*/, store.get(summary.id)];
            case 6:
                full = _a.sent();
                (0, bun_test_1.expect)(full === null || full === void 0 ? void 0 : full.manifest).toBeDefined();
                (0, bun_test_1.expect)(Object.keys(full.manifest.entries)).toContain("a.txt");
                return [2 /*return*/];
        }
    });
}); });
function tempWorkspace() {
    return __awaiter(this, void 0, void 0, function () {
        var root;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-checkpoint-"))];
                case 1:
                    root = _a.sent();
                    return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(root, ".gitignore"), "ignored.log\n")];
                case 2:
                    _a.sent();
                    return [2 /*return*/, root];
            }
        });
    });
}
(0, bun_test_1.test)("chunk/object GC unions every session sharing the workspace stores", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, ledgerA, ledgerB, storeA, recordA, storeB, recordB, dryRun, manifestB, manifestA;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, tempWorkspace()];
            case 1:
                root = _a.sent();
                ledgerA = new src_1.ContextLedger();
                ledgerB = new src_1.ContextLedger();
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(root, "a-only.txt"), "a-only-content\n")];
            case 2:
                _a.sent();
                return [4 /*yield*/, (0, src_1.initializeDefaultCheckpointStore)({
                        sessionID: "ses_gc_shared_a",
                        workspaceRoot: root,
                        context: ledgerA,
                    })];
            case 3:
                storeA = _a.sent();
                return [4 /*yield*/, storeA.createCheckpoint({
                        reason: "manual",
                        context: ledgerA,
                        step: 1,
                    })];
            case 4:
                recordA = _a.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(root, "b-only.txt"), "b-only-content\n")];
            case 5:
                _a.sent();
                return [4 /*yield*/, (0, src_1.initializeDefaultCheckpointStore)({
                        sessionID: "ses_gc_shared_b",
                        workspaceRoot: root,
                        context: ledgerB,
                    })];
            case 6:
                storeB = _a.sent();
                return [4 /*yield*/, storeB.createCheckpoint({
                        reason: "manual",
                        context: ledgerB,
                        step: 1,
                    })];
            case 7:
                recordB = _a.sent();
                return [4 /*yield*/, storeA.gcObjects(true)];
            case 8:
                dryRun = _a.sent();
                (0, bun_test_1.expect)(dryRun.unreachableObjects).toBe(0);
                (0, bun_test_1.expect)(dryRun.unreachableChunks).toBe(0);
                // A real GC from A must not prune B's shared payloads.
                return [4 /*yield*/, storeA.gcObjects(false)];
            case 9:
                // A real GC from A must not prune B's shared payloads.
                _a.sent();
                return [4 /*yield*/, storeB.loadManifest(recordB)];
            case 10:
                manifestB = _a.sent();
                (0, bun_test_1.expect)(Object.keys(manifestB.entries)).toContain("b-only.txt");
                return [4 /*yield*/, storeA.loadManifest(recordA)];
            case 11:
                manifestA = _a.sent();
                (0, bun_test_1.expect)(Object.keys(manifestA.entries)).toContain("a-only.txt");
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("checkpoint store migrates a legacy per-session chunk root on load", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, sessionID, ledger, payload, legacyRoot, chunks, _i, _a, chunk, hash, path, ref, store, shared, _b, legacyStillThere, _c;
    return __generator(this, function (_d) {
        switch (_d.label) {
            case 0: return [4 /*yield*/, tempWorkspace()];
            case 1:
                root = _d.sent();
                sessionID = "ses_legacy_chunk_migrate";
                ledger = new src_1.ContextLedger();
                payload = Buffer.from("legacy chunk payload ".repeat(200));
                legacyRoot = (0, node_path_1.join)(root, ".natalia", "chunks", sessionID);
                chunks = [];
                _i = 0, _a = (0, src_1.contentDefinedChunks)(payload);
                _d.label = 2;
            case 2:
                if (!(_i < _a.length)) return [3 /*break*/, 6];
                chunk = _a[_i];
                hash = (0, node_crypto_1.createHash)("sha256").update(chunk).digest("hex");
                path = (0, node_path_1.join)(legacyRoot, hash.slice(0, 2), hash);
                return [4 /*yield*/, (0, promises_1.mkdir)((0, node_path_1.dirname)(path), { recursive: true })];
            case 3:
                _d.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)(path, chunk)];
            case 4:
                _d.sent();
                chunks.push(hash);
                _d.label = 5;
            case 5:
                _i++;
                return [3 /*break*/, 2];
            case 6:
                ref = { chunks: chunks, size: payload.length };
                return [4 /*yield*/, (0, src_1.initializeDefaultCheckpointStore)({
                        sessionID: sessionID,
                        workspaceRoot: root,
                        context: ledger,
                    })];
            case 7:
                store = _d.sent();
                return [4 /*yield*/, store.list()];
            case 8:
                _d.sent(); // triggers loadJournal → migrateLegacyRoots
                shared = new src_1.ChunkStore((0, node_path_1.join)(root, ".natalia", "chunks"));
                _b = bun_test_1.expect;
                return [4 /*yield*/, shared.get(ref)];
            case 9:
                _b.apply(void 0, [_d.sent()]).toEqual(payload);
                legacyStillThere = true;
                _d.label = 10;
            case 10:
                _d.trys.push([10, 12, , 13]);
                return [4 /*yield*/, (0, promises_1.readdir)(legacyRoot)];
            case 11:
                _d.sent();
                return [3 /*break*/, 13];
            case 12:
                _c = _d.sent();
                legacyStillThere = false;
                return [3 /*break*/, 13];
            case 13:
                (0, bun_test_1.expect)(legacyStillThere).toBe(false);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("pruneV2Backups removes the backup once the v3 journal reconstructs", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, ledger, store, journalPath, backupPath, pruned;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, tempWorkspace()];
            case 1:
                root = _a.sent();
                ledger = new src_1.ContextLedger();
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(root, "keep.txt"), "keep\n")];
            case 2:
                _a.sent();
                return [4 /*yield*/, (0, src_1.initializeDefaultCheckpointStore)({
                        sessionID: "ses_prune_ok",
                        workspaceRoot: root,
                        context: ledger,
                    })];
            case 3:
                store = _a.sent();
                return [4 /*yield*/, store.createCheckpoint({ reason: "manual", context: ledger, step: 1 })];
            case 4:
                _a.sent();
                journalPath = (0, node_path_1.join)(root, ".natalia", "checkpoints", "ses_prune_ok", "journal.jsonl");
                backupPath = "".concat(journalPath, ".v2-backup");
                return [4 /*yield*/, (0, promises_1.writeFile)(backupPath, "{}\n")];
            case 5:
                _a.sent();
                return [4 /*yield*/, (0, src_1.pruneV2Backups)(root)];
            case 6:
                pruned = _a.sent();
                (0, bun_test_1.expect)(pruned.pruned).toBe(1);
                (0, bun_test_1.expect)(pruned.bytes).toBeGreaterThan(0);
                (0, bun_test_1.expect)((0, node_fs_1.existsSync)(backupPath)).toBe(false);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("pruneV2Backups keeps the backup when v3 cannot reconstruct", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, ledger, index, store, journalPath, backupPath;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, tempWorkspace()];
            case 1:
                root = _a.sent();
                ledger = new src_1.ContextLedger();
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(root, "keep.txt"), "keep\n")];
            case 2:
                _a.sent();
                // Force the ledger payload past the inline threshold so it is chunked.
                for (index = 0; index < 200; index++)
                    ledger.add({
                        id: "msg_".concat(index),
                        role: "user",
                        content: "x".repeat(200),
                    });
                return [4 /*yield*/, (0, src_1.initializeDefaultCheckpointStore)({
                        sessionID: "ses_prune_keep",
                        workspaceRoot: root,
                        context: ledger,
                    })];
            case 3:
                store = _a.sent();
                return [4 /*yield*/, store.createCheckpoint({ reason: "manual", context: ledger, step: 1 })];
            case 4:
                _a.sent();
                journalPath = (0, node_path_1.join)(root, ".natalia", "checkpoints", "ses_prune_keep", "journal.jsonl");
                backupPath = "".concat(journalPath, ".v2-backup");
                return [4 /*yield*/, (0, promises_1.writeFile)(backupPath, "{}\n")];
            case 5:
                _a.sent();
                // Break the shared chunk store: the newest record can no longer reconstruct.
                return [4 /*yield*/, (0, promises_1.rm)((0, node_path_1.join)(root, ".natalia", "chunks"), { recursive: true, force: true })];
            case 6:
                // Break the shared chunk store: the newest record can no longer reconstruct.
                _a.sent();
                return [4 /*yield*/, (0, bun_test_1.expect)((0, src_1.pruneV2Backups)(root)).rejects.toThrow()];
            case 7:
                _a.sent();
                (0, bun_test_1.expect)((0, node_fs_1.existsSync)(backupPath)).toBe(true);
                return [2 /*return*/];
        }
    });
}); });
