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
var object_store_1 = require("@natalia/object-store");
var snapshot_sandbox_1 = require("../src/snapshot-sandbox");
var snapshot_store_1 = require("../src/snapshot-store");
(0, bun_test_1.test)("SnapshotStore captures, diffs and promotes by content hash", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, store, host, base, candidate, changes, _a, _b, _c, _d, _e, _f;
    var _g, _h;
    return __generator(this, function (_j) {
        switch (_j.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-snapshot-store-"))];
            case 1:
                root = _j.sent();
                store = new snapshot_store_1.SnapshotStore(new object_store_1.ObjectStore((0, node_path_1.join)(root, ".natalia", "objects")), (0, node_path_1.join)(root, ".natalia", "snapshots"));
                host = (0, node_path_1.join)(root, "host");
                return [4 /*yield*/, (0, promises_1.mkdir)(host, { recursive: true })];
            case 2:
                _j.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(host, "a.txt"), "base content")];
            case 3:
                _j.sent();
                return [4 /*yield*/, store.capture(host)];
            case 4:
                base = _j.sent();
                return [4 /*yield*/, store.saveIndex("s1", base)];
            case 5:
                _j.sent();
                candidate = (0, node_path_1.join)(root, "candidate");
                return [4 /*yield*/, (0, promises_1.mkdir)(candidate, { recursive: true })];
            case 6:
                _j.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(candidate, "a.txt"), "changed content")];
            case 7:
                _j.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(candidate, "b.txt"), "new")];
            case 8:
                _j.sent();
                _b = (_a = store).diff;
                _c = [candidate,
                    base];
                return [4 /*yield*/, store.capture(candidate)];
            case 9: return [4 /*yield*/, _b.apply(_a, _c.concat([_j.sent()]))];
            case 10:
                changes = _j.sent();
                (0, bun_test_1.expect)(changes.map(function (change) { return change.path; }).sort()).toEqual([
                    "a.txt",
                    "b.txt",
                ]);
                (0, bun_test_1.expect)((_g = changes.find(function (change) { return change.path === "a.txt"; })) === null || _g === void 0 ? void 0 : _g.kind).toBe("modify");
                (0, bun_test_1.expect)((_h = changes.find(function (change) { return change.path === "b.txt"; })) === null || _h === void 0 ? void 0 : _h.kind).toBe("add");
                // Promote applies to the host; rollback restores the last-known-good.
                return [4 /*yield*/, store.promote("s1", candidate, host, changes)];
            case 11:
                // Promote applies to the host; rollback restores the last-known-good.
                _j.sent();
                _d = bun_test_1.expect;
                return [4 /*yield*/, (0, promises_1.readFile)((0, node_path_1.join)(host, "a.txt"), "utf8")];
            case 12:
                _d.apply(void 0, [_j.sent()]).toBe("changed content");
                _e = bun_test_1.expect;
                return [4 /*yield*/, (0, promises_1.readFile)((0, node_path_1.join)(host, "b.txt"), "utf8")];
            case 13:
                _e.apply(void 0, [_j.sent()]).toBe("new");
                return [4 /*yield*/, store.rollback(host, "s1")];
            case 14:
                _j.sent();
                _f = bun_test_1.expect;
                return [4 /*yield*/, (0, promises_1.readFile)((0, node_path_1.join)(host, "a.txt"), "utf8")];
            case 15:
                _f.apply(void 0, [_j.sent()]).toBe("base content");
                // `b.txt` did not exist before the promote, so rolling back removes it. This
                // assertion previously expected an empty string — which is what a
                // restore-only rollback leaves, and it pinned the leak as correct behaviour.
                return [4 /*yield*/, (0, bun_test_1.expect)((0, promises_1.readFile)((0, node_path_1.join)(host, "b.txt"))).rejects.toThrow()];
            case 16:
                // `b.txt` did not exist before the promote, so rolling back removes it. This
                // assertion previously expected an empty string — which is what a
                // restore-only rollback leaves, and it pinned the leak as correct behaviour.
                _j.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("SnapshotSandboxManager checks the base out into each candidate worktree", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, manager, candidate, _a, _b, _c, _d;
    return __generator(this, function (_e) {
        switch (_e.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-snapshot-checkout-"))];
            case 1:
                root = _e.sent();
                return [4 /*yield*/, (0, promises_1.mkdir)((0, node_path_1.join)(root, "src"), { recursive: true })];
            case 2:
                _e.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(root, "CONTRACT.md"), "shared contract\n")];
            case 3:
                _e.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(root, "src", "index.ts"), "export const base = true;\n")];
            case 4:
                _e.sent();
                manager = new snapshot_sandbox_1.SnapshotSandboxManager(root);
                return [4 /*yield*/, manager.initialize()];
            case 5:
                _e.sent();
                return [4 /*yield*/, manager.create("agent.1")];
            case 6:
                candidate = _e.sent();
                _a = bun_test_1.expect;
                return [4 /*yield*/, (0, promises_1.readFile)((0, node_path_1.join)(candidate.root, "CONTRACT.md"), "utf8")];
            case 7:
                _a.apply(void 0, [_e.sent()]).toBe("shared contract\n");
                _b = bun_test_1.expect;
                return [4 /*yield*/, (0, promises_1.readFile)((0, node_path_1.join)(candidate.root, "src", "index.ts"), "utf8")];
            case 8:
                _b.apply(void 0, [_e.sent()]).toBe("export const base = true;\n");
                _c = bun_test_1.expect;
                return [4 /*yield*/, manager.previewMerge("agent.1")];
            case 9:
                _c.apply(void 0, [_e.sent()]).toEqual([]);
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(candidate.root, "src", "index.ts"), "export const base = false;\n")];
            case 10:
                _e.sent();
                _d = bun_test_1.expect;
                return [4 /*yield*/, manager.previewMerge("agent.1")];
            case 11:
                _d.apply(void 0, [_e.sent()]).toEqual([
                    bun_test_1.expect.objectContaining({ kind: "modify", path: "src/index.ts" }),
                ]);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("diff after a small change hashes only the changed file, not the whole tree", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, index, puts, store, countingManager, candidateIndex, _a, _b, _c, before, _d, _e, _f;
    return __generator(this, function (_g) {
        switch (_g.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-snapshot-perf-"))];
            case 1:
                root = _g.sent();
                index = 0;
                _g.label = 2;
            case 2:
                if (!(index < 40)) return [3 /*break*/, 5];
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(root, "file-".concat(index, ".txt")), "content ".concat(index))];
            case 3:
                _g.sent();
                _g.label = 4;
            case 4:
                index++;
                return [3 /*break*/, 2];
            case 5: return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(root, "file.txt"), "base\n")];
            case 6:
                _g.sent();
                puts = 0;
                store = new snapshot_store_1.SnapshotStore(new (/** @class */ (function (_super) {
                    __extends(class_1, _super);
                    function class_1() {
                        return _super !== null && _super.apply(this, arguments) || this;
                    }
                    class_1.prototype.put = function (content) {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        puts++;
                                        return [4 /*yield*/, _super.prototype.put.call(this, content)];
                                    case 1: return [2 /*return*/, _a.sent()];
                                }
                            });
                        });
                    };
                    return class_1;
                }(object_store_1.ObjectStore)))((0, node_path_1.join)(root, ".natalia", "objects")), (0, node_path_1.join)(root, ".natalia", "snapshots"));
                countingManager = new snapshot_sandbox_1.SnapshotSandboxManager(root);
                return [4 /*yield*/, countingManager.initialize()];
            case 7:
                _g.sent();
                // create hashes the whole tree once (the base capture).
                return [4 /*yield*/, countingManager.create("perf.1")];
            case 8:
                // create hashes the whole tree once (the base capture).
                _g.sent();
                // The agent changes one file.
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(root, ".natalia", "sandboxes", "perf.1", "file.txt"), "edited\n")];
            case 9:
                // The agent changes one file.
                _g.sent();
                _b = (_a = store).capture;
                _c = [(0, node_path_1.join)(root, ".natalia", "sandboxes", "perf.1")];
                return [4 /*yield*/, store.loadCandidateIndex("perf.1")];
            case 10: return [4 /*yield*/, _b.apply(_a, _c.concat([_g.sent(), function (path) { return path === ".natalia-manifest.json"; }]))];
            case 11:
                candidateIndex = _g.sent();
                before = puts;
                _e = (_d = store).diff;
                _f = [(0, node_path_1.join)(root, ".natalia", "sandboxes", "perf.1")];
                return [4 /*yield*/, store.loadIndex("perf.1")];
            case 12: return [4 /*yield*/, _e.apply(_d, _f.concat([(_g.sent()),
                    candidateIndex]))];
            case 13:
                _g.sent();
                // At most a couple of files were hashed, not the whole 41-file tree.
                (0, bun_test_1.expect)(puts - before).toBeLessThanOrEqual(2);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("promoting a delete removes the file from the host", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, host, store, base, candidate, candidateIndex, afterDelete, changes;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-sb-del-"))];
            case 1:
                root = _a.sent();
                host = (0, node_path_1.join)(root, "host");
                return [4 /*yield*/, (0, promises_1.mkdir)(host, { recursive: true })];
            case 2:
                _a.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(host, "keep.txt"), "keep")];
            case 3:
                _a.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(host, "gone.txt"), "delete me")];
            case 4:
                _a.sent();
                store = new snapshot_store_1.SnapshotStore(new object_store_1.ObjectStore((0, node_path_1.join)(root, ".natalia", "objects")), (0, node_path_1.join)(root, ".natalia", "store"));
                return [4 /*yield*/, store.capture(host)];
            case 5:
                base = _a.sent();
                candidate = (0, node_path_1.join)(root, "candidate");
                return [4 /*yield*/, (0, promises_1.mkdir)(candidate, { recursive: true })];
            case 6:
                _a.sent();
                return [4 /*yield*/, store.materialize(candidate, base)];
            case 7:
                candidateIndex = _a.sent();
                return [4 /*yield*/, (0, promises_1.rm)((0, node_path_1.join)(candidate, "gone.txt"))];
            case 8:
                _a.sent();
                return [4 /*yield*/, store.capture(candidate, candidateIndex)];
            case 9:
                afterDelete = _a.sent();
                return [4 /*yield*/, store.diff(candidate, base, afterDelete)];
            case 10:
                changes = _a.sent();
                (0, bun_test_1.expect)(changes.map(function (change) { return change.kind; })).toEqual(["delete"]);
                return [4 /*yield*/, store.promote("sb_del", candidate, host, changes)];
            case 11:
                _a.sent();
                return [4 /*yield*/, (0, bun_test_1.expect)((0, promises_1.readFile)((0, node_path_1.join)(host, "gone.txt"))).rejects.toThrow()];
            case 12:
                _a.sent();
                return [4 /*yield*/, (0, bun_test_1.expect)((0, promises_1.readFile)((0, node_path_1.join)(host, "keep.txt"), "utf8")).resolves.toBe("keep")];
            case 13:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("rollback removes a file the promote added, rather than leaving a 0-byte stub", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, host, store, base, candidate, candidateIndex, afterAdd, changes, _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-sb-add-"))];
            case 1:
                root = _b.sent();
                host = (0, node_path_1.join)(root, "host");
                return [4 /*yield*/, (0, promises_1.mkdir)(host, { recursive: true })];
            case 2:
                _b.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(host, "keep.txt"), "keep")];
            case 3:
                _b.sent();
                store = new snapshot_store_1.SnapshotStore(new object_store_1.ObjectStore((0, node_path_1.join)(root, ".natalia", "objects")), (0, node_path_1.join)(root, ".natalia", "store"));
                return [4 /*yield*/, store.capture(host)];
            case 4:
                base = _b.sent();
                candidate = (0, node_path_1.join)(root, "candidate");
                return [4 /*yield*/, (0, promises_1.mkdir)(candidate, { recursive: true })];
            case 5:
                _b.sent();
                return [4 /*yield*/, store.materialize(candidate, base)];
            case 6:
                candidateIndex = _b.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(candidate, "added.txt"), "brand new")];
            case 7:
                _b.sent();
                return [4 /*yield*/, store.capture(candidate, candidateIndex)];
            case 8:
                afterAdd = _b.sent();
                return [4 /*yield*/, store.diff(candidate, base, afterAdd)];
            case 9:
                changes = _b.sent();
                (0, bun_test_1.expect)(changes.map(function (change) { return change.kind; })).toEqual(["add"]);
                return [4 /*yield*/, store.promote("sb_add", candidate, host, changes)];
            case 10:
                _b.sent();
                return [4 /*yield*/, (0, bun_test_1.expect)((0, promises_1.readFile)((0, node_path_1.join)(host, "added.txt"), "utf8")).resolves.toBe("brand new")];
            case 11:
                _b.sent();
                _a = bun_test_1.expect;
                return [4 /*yield*/, store.rollback(host, "sb_add")];
            case 12:
                _a.apply(void 0, [_b.sent()]).toBe(true);
                // Rolling back an addition must undo it, not leave an empty file behind.
                return [4 /*yield*/, (0, bun_test_1.expect)((0, promises_1.readFile)((0, node_path_1.join)(host, "added.txt"))).rejects.toThrow()];
            case 13:
                // Rolling back an addition must undo it, not leave an empty file behind.
                _b.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("a second candidate from the same base cannot overwrite the first", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, host, store, base, candidateFor, a, b, _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-sb-conflict-"))];
            case 1:
                root = _b.sent();
                host = (0, node_path_1.join)(root, "host");
                return [4 /*yield*/, (0, promises_1.mkdir)(host, { recursive: true })];
            case 2:
                _b.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(host, "shared.ts"), "BASE\n")];
            case 3:
                _b.sent();
                store = new snapshot_store_1.SnapshotStore(new object_store_1.ObjectStore((0, node_path_1.join)(root, ".natalia", "objects")), (0, node_path_1.join)(root, ".natalia", "store"));
                return [4 /*yield*/, store.capture(host)];
            case 4:
                base = _b.sent();
                candidateFor = function (name, body) { return __awaiter(void 0, void 0, void 0, function () {
                    var dir, index, captured;
                    var _a;
                    return __generator(this, function (_b) {
                        switch (_b.label) {
                            case 0:
                                dir = (0, node_path_1.join)(root, name);
                                return [4 /*yield*/, (0, promises_1.mkdir)(dir, { recursive: true })];
                            case 1:
                                _b.sent();
                                return [4 /*yield*/, store.materialize(dir, base)];
                            case 2:
                                index = _b.sent();
                                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(dir, "shared.ts"), body)];
                            case 3:
                                _b.sent();
                                return [4 /*yield*/, store.capture(dir, index)];
                            case 4:
                                captured = _b.sent();
                                _a = { dir: dir };
                                return [4 /*yield*/, store.diff(dir, base, captured)];
                            case 5: return [2 /*return*/, (_a.changes = _b.sent(), _a)];
                        }
                    });
                }); };
                return [4 /*yield*/, candidateFor("candA", "A's version\n")];
            case 5:
                a = _b.sent();
                return [4 /*yield*/, candidateFor("candB", "B's version\n")];
            case 6:
                b = _b.sent();
                return [4 /*yield*/, store.promote("sb_a", a.dir, host, a.changes, undefined, base)];
            case 7:
                _b.sent();
                return [4 /*yield*/, (0, bun_test_1.expect)(store.promote("sb_b", b.dir, host, b.changes, undefined, base)).rejects.toThrow(/conflicts with changes already on the host/)];
            case 8:
                _b.sent();
                // The refusal is the point: the first candidate's work survives.
                _a = bun_test_1.expect;
                return [4 /*yield*/, (0, promises_1.readFile)((0, node_path_1.join)(host, "shared.ts"), "utf8")];
            case 9:
                // The refusal is the point: the first candidate's work survives.
                _a.apply(void 0, [_b.sent()]).toBe("A's version\n");
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("a candidate whose base still matches promotes without complaint", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, host, store, base, dir, index, changes, _a, _b, _c, _d, _e;
    return __generator(this, function (_f) {
        switch (_f.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-sb-noconflict-"))];
            case 1:
                root = _f.sent();
                host = (0, node_path_1.join)(root, "host");
                return [4 /*yield*/, (0, promises_1.mkdir)(host, { recursive: true })];
            case 2:
                _f.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(host, "a.ts"), "one\n")];
            case 3:
                _f.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(host, "b.ts"), "two\n")];
            case 4:
                _f.sent();
                store = new snapshot_store_1.SnapshotStore(new object_store_1.ObjectStore((0, node_path_1.join)(root, ".natalia", "objects")), (0, node_path_1.join)(root, ".natalia", "store"));
                return [4 /*yield*/, store.capture(host)];
            case 5:
                base = _f.sent();
                dir = (0, node_path_1.join)(root, "cand");
                return [4 /*yield*/, (0, promises_1.mkdir)(dir, { recursive: true })];
            case 6:
                _f.sent();
                return [4 /*yield*/, store.materialize(dir, base)];
            case 7:
                index = _f.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(dir, "a.ts"), "one changed\n")];
            case 8:
                _f.sent();
                _b = (_a = store).diff;
                _c = [dir, base];
                return [4 /*yield*/, store.capture(dir, index)];
            case 9: return [4 /*yield*/, _b.apply(_a, _c.concat([_f.sent()]))];
            case 10:
                changes = _f.sent();
                return [4 /*yield*/, store.promote("sb_ok", dir, host, changes, undefined, base)];
            case 11:
                _f.sent();
                _d = bun_test_1.expect;
                return [4 /*yield*/, (0, promises_1.readFile)((0, node_path_1.join)(host, "a.ts"), "utf8")];
            case 12:
                _d.apply(void 0, [_f.sent()]).toBe("one changed\n");
                _e = bun_test_1.expect;
                return [4 /*yield*/, (0, promises_1.readFile)((0, node_path_1.join)(host, "b.ts"), "utf8")];
            case 13:
                _e.apply(void 0, [_f.sent()]).toBe("two\n");
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("an add whose path appeared on the host meanwhile is a conflict", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, host, store, base, dir, index, changes, _a, _b, _c, _d;
    return __generator(this, function (_e) {
        switch (_e.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-sb-addconflict-"))];
            case 1:
                root = _e.sent();
                host = (0, node_path_1.join)(root, "host");
                return [4 /*yield*/, (0, promises_1.mkdir)(host, { recursive: true })];
            case 2:
                _e.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(host, "seed.txt"), "seed\n")];
            case 3:
                _e.sent();
                store = new snapshot_store_1.SnapshotStore(new object_store_1.ObjectStore((0, node_path_1.join)(root, ".natalia", "objects")), (0, node_path_1.join)(root, ".natalia", "store"));
                return [4 /*yield*/, store.capture(host)];
            case 4:
                base = _e.sent();
                dir = (0, node_path_1.join)(root, "cand");
                return [4 /*yield*/, (0, promises_1.mkdir)(dir, { recursive: true })];
            case 5:
                _e.sent();
                return [4 /*yield*/, store.materialize(dir, base)];
            case 6:
                index = _e.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(dir, "new.txt"), "from the candidate\n")];
            case 7:
                _e.sent();
                _b = (_a = store).diff;
                _c = [dir, base];
                return [4 /*yield*/, store.capture(dir, index)];
            case 8: return [4 /*yield*/, _b.apply(_a, _c.concat([_e.sent()]))];
            case 9:
                changes = _e.sent();
                (0, bun_test_1.expect)(changes.map(function (change) { return change.kind; })).toEqual(["add"]);
                // Someone else created the same path after the snapshot was taken.
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(host, "new.txt"), "someone else's\n")];
            case 10:
                // Someone else created the same path after the snapshot was taken.
                _e.sent();
                return [4 /*yield*/, (0, bun_test_1.expect)(store.promote("sb_add", dir, host, changes, undefined, base)).rejects.toThrow(/conflicts with changes already on the host/)];
            case 11:
                _e.sent();
                _d = bun_test_1.expect;
                return [4 /*yield*/, (0, promises_1.readFile)((0, node_path_1.join)(host, "new.txt"), "utf8")];
            case 12:
                _d.apply(void 0, [_e.sent()]).toBe("someone else's\n");
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("a rollback reports false when there is no rollback point for that sandbox", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, host, store, manager, _a, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-sb-nolkg-"))];
            case 1:
                root = _c.sent();
                host = (0, node_path_1.join)(root, "host");
                return [4 /*yield*/, (0, promises_1.mkdir)(host, { recursive: true })];
            case 2:
                _c.sent();
                store = new snapshot_store_1.SnapshotStore(new object_store_1.ObjectStore((0, node_path_1.join)(root, ".natalia", "objects")), (0, node_path_1.join)(root, ".natalia", "store"));
                manager = new snapshot_sandbox_1.SnapshotSandboxManager(root);
                return [4 /*yield*/, manager.initialize()];
            case 3:
                _c.sent();
                _a = bun_test_1.expect;
                return [4 /*yield*/, store.rollback(host, "never_promoted")];
            case 4:
                _a.apply(void 0, [_c.sent()]).toBe(false);
                _b = bun_test_1.expect;
                return [4 /*yield*/, store.rollback(host, "never_promoted")];
            case 5:
                _b.apply(void 0, [_c.sent()]).toBe(false);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("a promotion is undoable by sandbox id through the manager", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, manager, sandbox, _a, result, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-sb-mgr-rollback-"))];
            case 1:
                root = _c.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(root, "file.txt"), "before\n")];
            case 2:
                _c.sent();
                manager = new snapshot_sandbox_1.SnapshotSandboxManager(root);
                return [4 /*yield*/, manager.initialize()];
            case 3:
                _c.sent();
                return [4 /*yield*/, manager.create("sb_undo")];
            case 4:
                sandbox = _c.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(sandbox.root, "file.txt"), "promoted\n")];
            case 5:
                _c.sent();
                return [4 /*yield*/, manager.promoteWithValidation("sb_undo", {
                        command: "true",
                        hostRoot: root,
                    })];
            case 6:
                _c.sent();
                _a = bun_test_1.expect;
                return [4 /*yield*/, (0, promises_1.readFile)((0, node_path_1.join)(root, "file.txt"), "utf8")];
            case 7:
                _a.apply(void 0, [_c.sent()]).toBe("promoted\n");
                return [4 /*yield*/, manager.rollback("sb_undo")];
            case 8:
                result = _c.sent();
                (0, bun_test_1.expect)(result.restored).toBe(true);
                _b = bun_test_1.expect;
                return [4 /*yield*/, (0, promises_1.readFile)((0, node_path_1.join)(root, "file.txt"), "utf8")];
            case 9:
                _b.apply(void 0, [_c.sent()]).toBe("before\n");
                return [2 /*return*/];
        }
    });
}); });
