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
var node_fs_1 = require("node:fs");
var node_os_1 = require("node:os");
var node_path_1 = require("node:path");
var store_paths_1 = require("../src/store-paths");
/**
 * §1.6's path layer: the rescue ring lives outside the drowning pool, its id
 * reconnects by canonical path, and the legacy move never destroys content.
 *
 * Every test owns its workspace and fake home under a fresh temp base —
 * order-independent, and the developer's real store is never touched.
 */
var base = "";
(0, bun_test_1.beforeAll)(function () {
    base = (0, node_fs_1.mkdtempSync)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "store-paths-"));
});
(0, bun_test_1.afterAll)(function () {
    (0, node_fs_1.rmSync)(base, { recursive: true, force: true });
});
function sandbox() {
    var id = (0, node_fs_1.mkdtempSync)((0, node_path_1.join)(base, "case-"));
    var home = (0, node_path_1.join)(id, "home");
    var workspace = (0, node_path_1.join)(id, "workspace");
    (0, node_fs_1.mkdirSync)(home, { recursive: true });
    (0, node_fs_1.mkdirSync)(workspace, { recursive: true });
    return { home: home, workspace: workspace };
}
function plantLegacy(workspace) {
    (0, node_fs_1.mkdirSync)((0, node_path_1.join)(workspace, ".natalia", "checkpoints", "ses_a"), {
        recursive: true,
    });
    (0, node_fs_1.mkdirSync)((0, node_path_1.join)(workspace, ".natalia", "checkpoints", "ses_b"), {
        recursive: true,
    });
    (0, node_fs_1.mkdirSync)((0, node_path_1.join)(workspace, ".natalia", "objects"), { recursive: true });
    (0, node_fs_1.mkdirSync)((0, node_path_1.join)(workspace, ".natalia", "chunks"), { recursive: true });
    (0, node_fs_1.writeFileSync)((0, node_path_1.join)(workspace, ".natalia", "checkpoints", "ses_a", "journal.jsonl"), "a");
    (0, node_fs_1.writeFileSync)((0, node_path_1.join)(workspace, ".natalia", "checkpoints", "ses_b", "journal.jsonl"), "b");
    (0, node_fs_1.writeFileSync)((0, node_path_1.join)(workspace, ".natalia", "objects", "obj1"), "o");
    (0, node_fs_1.writeFileSync)((0, node_path_1.join)(workspace, ".natalia", "chunks", "ch1"), "c");
}
function legacy(workspace) {
    var segments = [];
    for (var _i = 1; _i < arguments.length; _i++) {
        segments[_i - 1] = arguments[_i];
    }
    return node_path_1.join.apply(void 0, __spreadArray([workspace, ".natalia"], segments, false));
}
(0, bun_test_1.test)("the store id is stable and reconnects by canonical path", function () {
    var workspace = sandbox().workspace;
    var id = (0, store_paths_1.workspaceStoreID)(workspace);
    (0, bun_test_1.expect)(id).toMatch(/^[0-9a-f]{64}$/u);
    (0, bun_test_1.expect)((0, store_paths_1.workspaceStoreID)(workspace)).toBe(id);
    (0, bun_test_1.expect)((0, store_paths_1.workspaceStoreID)((0, node_path_1.join)(base, "other"))).not.toBe(id);
    // The reconnection property: a symlink spelling of the same directory
    // resolves to the same id — restore the workspace to the same path and
    // the store finds it without anyone remembering an id.
    var link = (0, node_path_1.join)(workspace, "..", "link");
    (0, node_fs_1.symlinkSync)(workspace, link);
    (0, bun_test_1.expect)((0, store_paths_1.workspaceStoreID)(link)).toBe(id);
});
(0, bun_test_1.test)("the store root lives under the injected home, not the workspace", function () {
    var _a = sandbox(), home = _a.home, workspace = _a.workspace;
    var id = (0, store_paths_1.workspaceStoreID)(workspace);
    var root = (0, store_paths_1.workspaceStoreRoot)(workspace, home);
    (0, bun_test_1.expect)(root).toBe((0, node_path_1.join)(home, ".natalia", "stores", id));
    (0, bun_test_1.expect)(root.startsWith(workspace)).toBe(false);
    (0, bun_test_1.expect)((0, store_paths_1.workspaceObjectsRoot)(workspace, home)).toBe((0, node_path_1.join)(root, "objects"));
    (0, bun_test_1.expect)((0, store_paths_1.workspaceCheckpointSessionsRoot)(workspace, home)).toBe((0, node_path_1.join)(root, "sessions"));
    (0, bun_test_1.expect)((0, store_paths_1.workspaceChunksRoot)(workspace, home)).toBe((0, node_path_1.join)(root, "chunks"));
    (0, bun_test_1.expect)((0, store_paths_1.defaultCheckpointStoreDir)(workspace, "ses_a", home)).toBe((0, node_path_1.join)(root, "sessions", "ses_a"));
});
(0, bun_test_1.test)("store directories are created 0700", function () { return __awaiter(void 0, void 0, void 0, function () {
    var home, dir;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                home = sandbox().home;
                dir = (0, node_path_1.join)(home, ".natalia", "stores", "perm-probe");
                return [4 /*yield*/, (0, store_paths_1.ensureStoreDir)(dir)];
            case 1:
                _a.sent();
                (0, bun_test_1.expect)((0, node_fs_1.statSync)(dir).mode & 511).toBe(448);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("the legacy move relocates checkpoints, objects and chunks", function () { return __awaiter(void 0, void 0, void 0, function () {
    var _a, home, workspace, moved, root;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _a = sandbox(), home = _a.home, workspace = _a.workspace;
                plantLegacy(workspace);
                return [4 /*yield*/, (0, store_paths_1.migrateLegacyWorkspaceStore)(workspace, home)];
            case 1:
                moved = _b.sent();
                root = (0, store_paths_1.workspaceStoreRoot)(workspace, home);
                // Counting the moves is implementation-shaped (a whole-directory rename is
                // one move, entry-by-entry is many); the outcome is the contract.
                (0, bun_test_1.expect)(moved).toBeGreaterThan(0);
                (0, bun_test_1.expect)((0, node_fs_1.existsSync)((0, node_path_1.join)(root, "sessions", "ses_a", "journal.jsonl"))).toBe(true);
                (0, bun_test_1.expect)((0, node_fs_1.existsSync)((0, node_path_1.join)(root, "sessions", "ses_b", "journal.jsonl"))).toBe(true);
                (0, bun_test_1.expect)((0, node_fs_1.existsSync)((0, node_path_1.join)(root, "objects", "obj1"))).toBe(true);
                (0, bun_test_1.expect)((0, node_fs_1.existsSync)((0, node_path_1.join)(root, "chunks", "ch1"))).toBe(true);
                (0, bun_test_1.expect)((0, node_fs_1.existsSync)(legacy(workspace, "checkpoints"))).toBe(false);
                (0, bun_test_1.expect)((0, node_fs_1.existsSync)(legacy(workspace, "objects"))).toBe(false);
                (0, bun_test_1.expect)((0, node_fs_1.existsSync)(legacy(workspace, "chunks"))).toBe(false);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("the move is idempotent", function () { return __awaiter(void 0, void 0, void 0, function () {
    var _a, home, workspace, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                _a = sandbox(), home = _a.home, workspace = _a.workspace;
                plantLegacy(workspace);
                return [4 /*yield*/, (0, store_paths_1.migrateLegacyWorkspaceStore)(workspace, home)];
            case 1:
                _c.sent();
                _b = bun_test_1.expect;
                return [4 /*yield*/, (0, store_paths_1.migrateLegacyWorkspaceStore)(workspace, home)];
            case 2:
                _b.apply(void 0, [_c.sent()]).toBe(0);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("an existing store entry is never overwritten by legacy data", function () { return __awaiter(void 0, void 0, void 0, function () {
    var _a, home, workspace, root;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _a = sandbox(), home = _a.home, workspace = _a.workspace;
                plantLegacy(workspace);
                root = (0, store_paths_1.workspaceStoreRoot)(workspace, home);
                // The external objects store already has a NEWER obj1; the legacy copy of
                // the same name must stay in place (visible for a human), not clobber it —
                // rename would silently replace a file, which is the loss this rules out.
                (0, node_fs_1.mkdirSync)((0, node_path_1.join)(root, "objects"), { recursive: true });
                (0, node_fs_1.writeFileSync)((0, node_path_1.join)(root, "objects", "obj1"), "newer");
                return [4 /*yield*/, (0, store_paths_1.migrateLegacyWorkspaceStore)(workspace, home)];
            case 1:
                _b.sent();
                (0, bun_test_1.expect)((0, node_fs_1.readFileSync)((0, node_path_1.join)(root, "objects", "obj1"), "utf8")).toBe("newer");
                (0, bun_test_1.expect)((0, node_fs_1.existsSync)(legacy(workspace, "objects", "obj1"))).toBe(true);
                (0, bun_test_1.expect)((0, node_fs_1.existsSync)(legacy(workspace, "objects"))).toBe(true);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("resolution reads legacy before migration and external after", function () { return __awaiter(void 0, void 0, void 0, function () {
    var _a, home, workspace, fresh;
    return __generator(this, function (_b) {
        _a = sandbox(), home = _a.home, workspace = _a.workspace;
        // Pre-migration: legacy exists, external does not -> read the legacy dir.
        (0, node_fs_1.mkdirSync)(legacy(workspace, "objects"), { recursive: true });
        (0, bun_test_1.expect)((0, store_paths_1.resolveWorkspaceObjectsRoot)(workspace, home)).toBe(legacy(workspace, "objects"));
        // Post-migration: external exists -> external wins even if a conflict kept
        // a fragment of the legacy dir around.
        (0, node_fs_1.mkdirSync)((0, store_paths_1.workspaceObjectsRoot)(workspace, home), { recursive: true });
        (0, bun_test_1.expect)((0, store_paths_1.resolveWorkspaceObjectsRoot)(workspace, home)).toBe((0, store_paths_1.workspaceObjectsRoot)(workspace, home));
        fresh = sandbox();
        (0, bun_test_1.expect)((0, store_paths_1.resolveWorkspaceChunksRoot)(fresh.workspace, fresh.home)).toBe((0, store_paths_1.workspaceChunksRoot)(fresh.workspace, fresh.home));
        (0, bun_test_1.expect)((0, store_paths_1.resolveWorkspaceCheckpointSessionsRoot)(fresh.workspace, fresh.home)).toBe((0, store_paths_1.workspaceCheckpointSessionsRoot)(fresh.workspace, fresh.home));
        return [2 /*return*/];
    });
}); });
(0, bun_test_1.test)("the journal db reads legacy before migration and external after", function () {
    var _a = sandbox(), home = _a.home, workspace = _a.workspace;
    // Pre-migration: the workspace-local sqlite is read in place (the startup
    // migration has not run yet — never look at an empty external path).
    (0, node_fs_1.mkdirSync)((0, node_path_1.join)(workspace, ".natalia"), { recursive: true });
    (0, node_fs_1.writeFileSync)((0, node_path_1.join)(workspace, ".natalia", "sessions.db"), "journal");
    (0, bun_test_1.expect)((0, store_paths_1.resolveWorkspaceJournalDatabasePath)(workspace, home)).toBe((0, node_path_1.join)(workspace, ".natalia", "sessions.db"));
    // Post-migration: the external db exists -> external wins.
    (0, node_fs_1.mkdirSync)((0, store_paths_1.workspaceStoreRoot)(workspace, home), { recursive: true });
    (0, node_fs_1.writeFileSync)((0, node_path_1.join)((0, store_paths_1.workspaceStoreRoot)(workspace, home), "sessions.db"), "moved");
    (0, bun_test_1.expect)((0, store_paths_1.resolveWorkspaceJournalDatabasePath)(workspace, home)).toBe((0, node_path_1.join)((0, store_paths_1.workspaceStoreRoot)(workspace, home), "sessions.db"));
    // A fresh workspace claims the external location.
    var fresh = sandbox();
    (0, bun_test_1.expect)((0, store_paths_1.resolveWorkspaceJournalDatabasePath)(fresh.workspace, fresh.home)).toBe((0, node_path_1.join)((0, store_paths_1.workspaceStoreRoot)(fresh.workspace, fresh.home), "sessions.db"));
});
(0, bun_test_1.test)("the json journal directory follows the same read rule", function () {
    var _a = sandbox(), home = _a.home, workspace = _a.workspace;
    (0, node_fs_1.mkdirSync)((0, node_path_1.join)(workspace, ".natalia", "sessions"), { recursive: true });
    (0, bun_test_1.expect)((0, store_paths_1.resolveWorkspaceJsonSessionsDir)(workspace, home)).toBe((0, node_path_1.join)(workspace, ".natalia", "sessions"));
    var external = (0, node_path_1.join)((0, store_paths_1.workspaceStoreRoot)(workspace, home), "json-sessions");
    (0, node_fs_1.mkdirSync)(external, { recursive: true });
    (0, bun_test_1.expect)((0, store_paths_1.resolveWorkspaceJsonSessionsDir)(workspace, home)).toBe(external);
});
(0, bun_test_1.test)("the journal migration moves the db and the json dir", function () { return __awaiter(void 0, void 0, void 0, function () {
    var _a, home, workspace, moved, root;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _a = sandbox(), home = _a.home, workspace = _a.workspace;
                (0, node_fs_1.mkdirSync)((0, node_path_1.join)(workspace, ".natalia"), { recursive: true });
                (0, node_fs_1.writeFileSync)((0, node_path_1.join)(workspace, ".natalia", "sessions.db"), "journal");
                (0, node_fs_1.mkdirSync)((0, node_path_1.join)(workspace, ".natalia", "sessions"), { recursive: true });
                (0, node_fs_1.writeFileSync)((0, node_path_1.join)(workspace, ".natalia", "sessions", "a.json"), "{}");
                return [4 /*yield*/, (0, store_paths_1.migrateLegacyWorkspaceStore)(workspace, home)];
            case 1:
                moved = _b.sent();
                (0, bun_test_1.expect)(moved).toBe(2);
                root = (0, store_paths_1.workspaceStoreRoot)(workspace, home);
                (0, bun_test_1.expect)((0, node_fs_1.readFileSync)((0, node_path_1.join)(root, "sessions.db"), "utf8")).toBe("journal");
                (0, bun_test_1.expect)((0, node_fs_1.readFileSync)((0, node_path_1.join)(root, "json-sessions", "a.json"), "utf8")).toBe("{}");
                (0, bun_test_1.expect)((0, node_fs_1.existsSync)((0, node_path_1.join)(workspace, ".natalia", "sessions.db"))).toBe(false);
                (0, bun_test_1.expect)((0, node_fs_1.existsSync)((0, node_path_1.join)(workspace, ".natalia", "sessions"))).toBe(false);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("the json journal never splits across two roots", function () { return __awaiter(void 0, void 0, void 0, function () {
    var _a, home, workspace, root;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _a = sandbox(), home = _a.home, workspace = _a.workspace;
                (0, node_fs_1.mkdirSync)((0, node_path_1.join)(workspace, ".natalia", "sessions"), { recursive: true });
                (0, node_fs_1.writeFileSync)((0, node_path_1.join)(workspace, ".natalia", "sessions", "a.json"), "legacy");
                root = (0, store_paths_1.workspaceStoreRoot)(workspace, home);
                // The external dir already exists with a CONFLICTING session file: a
                // merge would leave sessions readable in only one of the two roots, so
                // the legacy journal stays whole where it is.
                (0, node_fs_1.mkdirSync)((0, node_path_1.join)(root, "json-sessions"), { recursive: true });
                (0, node_fs_1.writeFileSync)((0, node_path_1.join)(root, "json-sessions", "a.json"), "external");
                return [4 /*yield*/, (0, store_paths_1.migrateLegacyWorkspaceStore)(workspace, home)];
            case 1:
                _b.sent();
                (0, bun_test_1.expect)((0, node_fs_1.readFileSync)((0, node_path_1.join)(workspace, ".natalia", "sessions", "a.json"), "utf8")).toBe("legacy");
                (0, bun_test_1.expect)((0, node_fs_1.readFileSync)((0, node_path_1.join)(root, "json-sessions", "a.json"), "utf8")).toBe("external");
                // The all-or-nothing move means no split can come from migration; when
                // BOTH roots exist the external one wins, because the resurrected legacy
                // dir is by definition the STALE copy (a workspace restored from backup
                // must not shadow the journal that kept being written).
                (0, bun_test_1.expect)((0, store_paths_1.resolveWorkspaceJsonSessionsDir)(workspace, home)).toBe((0, node_path_1.join)(root, "json-sessions"));
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("an unwritable home degrades the journal to workspace-local", function () {
    var _a = sandbox(), home = _a.home, workspace = _a.workspace;
    // A home that refuses writes (read-only mounts, restricted containers —
    // and this harness's own /home): the journal must fall back, not vanish.
    (0, node_fs_1.chmodSync)(home, 365);
    try {
        var fresh = sandbox(); // creates dirs — use the chmod'd home directly
        void fresh;
        (0, bun_test_1.expect)((0, store_paths_1.resolveWorkspaceJournalDatabasePath)(workspace, home)).toBe((0, node_path_1.join)(workspace, ".natalia", "sessions.db"));
        (0, bun_test_1.expect)((0, store_paths_1.resolveWorkspaceJsonSessionsDir)(workspace, home)).toBe((0, node_path_1.join)(workspace, ".natalia", "sessions"));
    }
    finally {
        (0, node_fs_1.chmodSync)(home, 493);
    }
});
