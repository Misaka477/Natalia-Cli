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
exports.workspaceStoreID = workspaceStoreID;
exports.workspaceStoreRoot = workspaceStoreRoot;
exports.workspaceObjectsRoot = workspaceObjectsRoot;
exports.workspaceCheckpointSessionsRoot = workspaceCheckpointSessionsRoot;
exports.defaultCheckpointStoreDir = defaultCheckpointStoreDir;
exports.workspaceChunksRoot = workspaceChunksRoot;
exports.resolveWorkspaceObjectsRoot = resolveWorkspaceObjectsRoot;
exports.resolveWorkspaceChunksRoot = resolveWorkspaceChunksRoot;
exports.resolveWorkspaceCheckpointSessionsRoot = resolveWorkspaceCheckpointSessionsRoot;
exports.ensureStoreDir = ensureStoreDir;
exports.migrateLegacyWorkspaceStore = migrateLegacyWorkspaceStore;
exports.resolveWorkspaceJournalDatabasePath = resolveWorkspaceJournalDatabasePath;
exports.resolveWorkspaceJsonSessionsDir = resolveWorkspaceJsonSessionsDir;
exports.operationLogsDir = operationLogsDir;
var node_crypto_1 = require("node:crypto");
var node_os_1 = require("node:os");
var node_path_1 = require("node:path");
var node_fs_1 = require("node:fs");
var promises_1 = require("node:fs/promises");
var node_fs_2 = require("node:fs");
/**
 * The life-preserving store's path layer (architecture decisions §1.6).
 *
 * The rescue ring may not be tied to the drowning pool: by default the
 * checkpoint/journal store lives OUTSIDE the workspace at
 * `~/.natalia/stores/<workspace-id>/` (0700), and a workspace-local store is
 * only an explicit opt-in (`checkpointDir`). The workspace id is a hash of
 * the canonical absolute path, so deleting the workspace and restoring it to
 * the same path reconnects the store automatically — disaster recovery never
 * depends on remembering an id.
 *
 * The canonicalization rule follows the roots lesson already recorded in the
 * sandbox work: the native realpath follows the component-by-component
 * lookup a spawn performs (the JS one lexically collapses `..` before a
 * preceding symlink), and a missing root stays as spelled — inventing a
 * fallback would grant a path the caller never named.
 */
/** Canonical absolute spelling of a workspace root (missing paths as-spelled). */
function canonicalRoot(workspaceRoot) {
    try {
        return node_fs_1.realpathSync.native((0, node_path_1.resolve)(workspaceRoot));
    }
    catch (_a) {
        return (0, node_path_1.resolve)(workspaceRoot);
    }
}
/** The stable id for a workspace's store: sha256 of its canonical path. */
function workspaceStoreID(workspaceRoot) {
    return (0, node_crypto_1.createHash)("sha256")
        .update(canonicalRoot(workspaceRoot))
        .digest("hex");
}
/** `~/.natalia/stores/<id>` — the store root, outside the workspace. */
function workspaceStoreRoot(workspaceRoot, home) {
    if (home === void 0) { home = (0, node_os_1.homedir)(); }
    return (0, node_path_1.join)(home, ".natalia", "stores", workspaceStoreID(workspaceRoot));
}
/** The shared content-addressed object library for a workspace's store. */
function workspaceObjectsRoot(workspaceRoot, home) {
    if (home === void 0) { home = (0, node_os_1.homedir)(); }
    return (0, node_path_1.join)(workspaceStoreRoot(workspaceRoot, home), "objects");
}
/** The session tier root: per-session checkpoint/journal live beneath it. */
function workspaceCheckpointSessionsRoot(workspaceRoot, home) {
    if (home === void 0) { home = (0, node_os_1.homedir)(); }
    return (0, node_path_1.join)(workspaceStoreRoot(workspaceRoot, home), "sessions");
}
/** The default per-session checkpoint dir (§1.6's `sessions/<id>` level). */
function defaultCheckpointStoreDir(workspaceRoot, sessionID, home) {
    if (home === void 0) { home = (0, node_os_1.homedir)(); }
    var external = (0, node_path_1.join)(workspaceCheckpointSessionsRoot(workspaceRoot, home), sessionID);
    var workspaceLocal = (0, node_path_1.join)((0, node_path_1.resolve)(workspaceRoot), ".natalia", "checkpoints", sessionID);
    // Offline consistency: a legacy session dir still on disk reads there
    // until the startup migration moves it; otherwise create the external
    // dir or degrade to workspace-local when the home is unwritable.
    if ((0, node_fs_1.existsSync)(workspaceLocal) && !(0, node_fs_1.existsSync)(external))
        return workspaceLocal;
    return externalDirOrLocal(external, workspaceLocal);
}
/** The shared per-session chunk library (kept outside storeDir's footprint). */
function workspaceChunksRoot(workspaceRoot, home) {
    if (home === void 0) { home = (0, node_os_1.homedir)(); }
    return (0, node_path_1.join)(workspaceStoreRoot(workspaceRoot, home), "chunks");
}
/**
 * Create a store directory with the §1.6 permissions (0700 — the store is a
 * safety facility, not a shared scratch area). Returns the path so callers
 * can chain.
 */
/**
 * The external-or-degrade rule: an unwritable home (read-only mounts,
 * restricted containers — and the harness's own /home) must not disable the
 * safety facility silently and must not kill the runtime either. Try to
 * create the external path; when the filesystem refuses, fall back to the
 * workspace-local path — the caller reports that degradation, so the state
 * "the rescue ring is tied to this workspace" is always visible.
 */
function externalDirOrLocal(external, workspaceLocal) {
    try {
        (0, node_fs_2.mkdirSync)(external, { recursive: true, mode: 448 });
        return external;
    }
    catch (_a) {
        return workspaceLocal;
    }
}
/**
 * The migration-aware object/chunk root: read the legacy workspace-local
 * directory while it still exists and nothing external has been created
 * (pre-migration), otherwise the external store. This one rule serves the
 * startup path (migration has run) and the offline path (it has not), and a
 * fresh workspace simply lands external. Import only `existsSync`-style state
 * through this function so no consumer re-invents the ordering.
 */
function externalIfLegacyMoved(workspaceRoot, external, legacy) {
    var hasLegacy = (0, node_fs_1.existsSync)(legacy);
    var hasExternal = (0, node_fs_1.existsSync)(external);
    // Pre-migration: read the legacy dir without even creating the external
    // one — the startup migration moves it, offline readers find it here.
    if (hasLegacy && !hasExternal)
        return legacy;
    return externalDirOrLocal(external, legacy);
}
function resolveWorkspaceObjectsRoot(workspaceRoot, home) {
    if (home === void 0) { home = (0, node_os_1.homedir)(); }
    return externalIfLegacyMoved(workspaceRoot, workspaceObjectsRoot(workspaceRoot, home), (0, node_path_1.join)((0, node_path_1.resolve)(workspaceRoot), ".natalia", "objects"));
}
function resolveWorkspaceChunksRoot(workspaceRoot, home) {
    if (home === void 0) { home = (0, node_os_1.homedir)(); }
    return externalIfLegacyMoved(workspaceRoot, workspaceChunksRoot(workspaceRoot, home), (0, node_path_1.join)((0, node_path_1.resolve)(workspaceRoot), ".natalia", "chunks"));
}
function resolveWorkspaceCheckpointSessionsRoot(workspaceRoot, home) {
    if (home === void 0) { home = (0, node_os_1.homedir)(); }
    return externalIfLegacyMoved(workspaceRoot, workspaceCheckpointSessionsRoot(workspaceRoot, home), (0, node_path_1.join)((0, node_path_1.resolve)(workspaceRoot), ".natalia", "checkpoints"));
}
function ensureStoreDir(path) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, promises_1.mkdir)(path, { recursive: true, mode: 448 })];
                case 1:
                    _a.sent();
                    return [2 /*return*/, path];
            }
        });
    });
}
function isDirectory(path) {
    return __awaiter(this, void 0, void 0, function () {
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, (0, promises_1.stat)(path)];
                case 1: return [2 /*return*/, (_b.sent()).isDirectory()];
                case 2:
                    _a = _b.sent();
                    return [2 /*return*/, false];
                case 3: return [2 /*return*/];
            }
        });
    });
}
function isFile(path) {
    return __awaiter(this, void 0, void 0, function () {
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, (0, promises_1.stat)(path)];
                case 1: return [2 /*return*/, (_b.sent()).isFile()];
                case 2:
                    _a = _b.sent();
                    return [2 /*return*/, false];
                case 3: return [2 /*return*/];
            }
        });
    });
}
/**
 * Move one legacy directory into the store without ever destroying content.
 *
 * Whole-directory `rename` when the target is free (atomic on one
 * filesystem); an existing target or an EXDEV boundary falls back to moving
 * entry-by-entry — every entry the target does not already have. An entry
 * the target HAS is left in place: store data is never overwritten with
 * possibly-older workspace data, and nothing is deleted unless it was
 * actually moved (the conservative rule, same reasoning as canonicalPath's).
 * Returns how many entries landed.
 */
function moveLegacyEntries(from, to) {
    return __awaiter(this, void 0, void 0, function () {
        var moved, _i, _a, entry, source, target, error_1, error_2;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, isDirectory(from)];
                case 1:
                    if (!(_b.sent()))
                        return [2 /*return*/, 0];
                    return [4 /*yield*/, isDirectory(to)];
                case 2:
                    if (!_b.sent()) return [3 /*break*/, 15];
                    moved = 0;
                    _i = 0;
                    return [4 /*yield*/, (0, promises_1.readdir)(from)];
                case 3:
                    _a = _b.sent();
                    _b.label = 4;
                case 4:
                    if (!(_i < _a.length)) return [3 /*break*/, 11];
                    entry = _a[_i];
                    source = (0, node_path_1.join)(from, entry);
                    target = (0, node_path_1.join)(to, entry);
                    // Any existing target — file OR directory — wins: rename would
                    // silently replace a file, which is exactly the overwrite the rule
                    // forbids.
                    if ((0, node_fs_1.existsSync)(target))
                        return [3 /*break*/, 10];
                    _b.label = 5;
                case 5:
                    _b.trys.push([5, 7, , 10]);
                    return [4 /*yield*/, (0, promises_1.rename)(source, target)];
                case 6:
                    _b.sent();
                    moved += 1;
                    return [3 /*break*/, 10];
                case 7:
                    error_1 = _b.sent();
                    if (error_1.code !== "EXDEV")
                        throw error_1;
                    return [4 /*yield*/, (0, promises_1.cp)(source, target, { recursive: true })];
                case 8:
                    _b.sent();
                    return [4 /*yield*/, (0, promises_1.rm)(source, { recursive: true, force: true })];
                case 9:
                    _b.sent();
                    moved += 1;
                    return [3 /*break*/, 10];
                case 10:
                    _i++;
                    return [3 /*break*/, 4];
                case 11: return [4 /*yield*/, (0, promises_1.readdir)(from)];
                case 12:
                    if (!((_b.sent()).length === 0)) return [3 /*break*/, 14];
                    return [4 /*yield*/, (0, promises_1.rm)(from, { recursive: true })];
                case 13:
                    _b.sent();
                    _b.label = 14;
                case 14: return [2 /*return*/, moved];
                case 15: return [4 /*yield*/, ensureStoreDir((0, node_path_1.join)(to, ".."))];
                case 16:
                    _b.sent();
                    _b.label = 17;
                case 17:
                    _b.trys.push([17, 19, , 22]);
                    return [4 /*yield*/, (0, promises_1.rename)(from, to)];
                case 18:
                    _b.sent();
                    return [2 /*return*/, 1];
                case 19:
                    error_2 = _b.sent();
                    if (error_2.code !== "EXDEV")
                        throw error_2;
                    return [4 /*yield*/, (0, promises_1.cp)(from, to, { recursive: true })];
                case 20:
                    _b.sent();
                    return [4 /*yield*/, (0, promises_1.rm)(from, { recursive: true, force: true })];
                case 21:
                    _b.sent();
                    return [2 /*return*/, 1];
                case 22: return [2 /*return*/];
            }
        });
    });
}
/** Move a legacy FILE into the store; an existing target wins (never overwrite). */
function moveLegacyFile(from, to) {
    return __awaiter(this, void 0, void 0, function () {
        var error_3;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, isFile(from)];
                case 1:
                    if (!(_a.sent()) || (0, node_fs_1.existsSync)(to))
                        return [2 /*return*/, false];
                    return [4 /*yield*/, ensureStoreDir((0, node_path_1.join)(to, ".."))];
                case 2:
                    _a.sent();
                    _a.label = 3;
                case 3:
                    _a.trys.push([3, 5, , 8]);
                    return [4 /*yield*/, (0, promises_1.rename)(from, to)];
                case 4:
                    _a.sent();
                    return [2 /*return*/, true];
                case 5:
                    error_3 = _a.sent();
                    if (error_3.code !== "EXDEV")
                        throw error_3;
                    return [4 /*yield*/, (0, promises_1.copyFile)(from, to)];
                case 6:
                    _a.sent();
                    return [4 /*yield*/, (0, promises_1.rm)(from, { force: true })];
                case 7:
                    _a.sent();
                    return [2 /*return*/, true];
                case 8: return [2 /*return*/];
            }
        });
    });
}
/**
 * Move a legacy directory as a whole or not at all.
 *
 * A journal directory is read from ONE place: merging it entry-by-entry
 * would split sessions across two roots and make the other half invisible —
 * a conflict therefore keeps the legacy directory exactly where it is for a
 * human, rather than producing a half-moved journal.
 */
function moveLegacyDirAtomic(from, to) {
    return __awaiter(this, void 0, void 0, function () {
        var error_4, error_5;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, isDirectory(from)];
                case 1:
                    if (!(_a.sent()) || (0, node_fs_1.existsSync)(to))
                        return [2 /*return*/, 0];
                    return [4 /*yield*/, ensureStoreDir((0, node_path_1.join)(to, ".."))];
                case 2:
                    _a.sent();
                    _a.label = 3;
                case 3:
                    _a.trys.push([3, 5, , 12]);
                    return [4 /*yield*/, (0, promises_1.rename)(from, to)];
                case 4:
                    _a.sent();
                    return [2 /*return*/, 1];
                case 5:
                    error_4 = _a.sent();
                    if (error_4.code !== "EXDEV")
                        throw error_4;
                    _a.label = 6;
                case 6:
                    _a.trys.push([6, 8, , 10]);
                    return [4 /*yield*/, (0, promises_1.cp)(from, to, { recursive: true })];
                case 7:
                    _a.sent();
                    return [3 /*break*/, 10];
                case 8:
                    error_5 = _a.sent();
                    return [4 /*yield*/, (0, promises_1.rm)(to, { recursive: true, force: true })];
                case 9:
                    _a.sent();
                    throw error_5;
                case 10: return [4 /*yield*/, (0, promises_1.rm)(from, { recursive: true, force: true })];
                case 11:
                    _a.sent();
                    return [2 /*return*/, 1];
                case 12: return [2 /*return*/];
            }
        });
    });
}
/**
 * Move a workspace's legacy in-workspace store (checkpoints / objects /
 * chunks) to the external store root. Idempotent: with no legacy left it is
 * a no-op, so it may run at every runtime start. Returns a count of what
 * moved, so the caller can record the event honestly.
 */
function migrateLegacyWorkspaceStore(workspaceRoot_1) {
    return __awaiter(this, arguments, void 0, function (workspaceRoot, home) {
        var legacyBase, storeRoot, dirMapping, atomicDirMapping, fileMapping, moved, _i, dirMapping_1, _a, name_1, target, _b, _c, atomicDirMapping_1, _d, name_2, target, _e, _f, fileMapping_1, _g, name_3, target;
        if (home === void 0) { home = (0, node_os_1.homedir)(); }
        return __generator(this, function (_h) {
            switch (_h.label) {
                case 0:
                    legacyBase = (0, node_path_1.join)((0, node_path_1.resolve)(workspaceRoot), ".natalia");
                    storeRoot = workspaceStoreRoot(workspaceRoot, home);
                    dirMapping = [
                        ["checkpoints", workspaceCheckpointSessionsRoot(workspaceRoot, home)],
                        ["objects", workspaceObjectsRoot(workspaceRoot, home)],
                        ["chunks", workspaceChunksRoot(workspaceRoot, home)],
                    ];
                    atomicDirMapping = [
                        // The JSON session journal moves whole or stays (split journals read
                        // half their sessions).
                        ["sessions", (0, node_path_1.join)(storeRoot, "json-sessions")],
                    ];
                    fileMapping = [
                        ["sessions.db", (0, node_path_1.join)(storeRoot, "sessions.db")],
                    ];
                    moved = 0;
                    return [4 /*yield*/, ensureStoreDir(storeRoot)];
                case 1:
                    _h.sent();
                    _i = 0, dirMapping_1 = dirMapping;
                    _h.label = 2;
                case 2:
                    if (!(_i < dirMapping_1.length)) return [3 /*break*/, 5];
                    _a = dirMapping_1[_i], name_1 = _a[0], target = _a[1];
                    _b = moved;
                    return [4 /*yield*/, moveLegacyEntries((0, node_path_1.join)(legacyBase, name_1), target)];
                case 3:
                    moved = _b + _h.sent();
                    _h.label = 4;
                case 4:
                    _i++;
                    return [3 /*break*/, 2];
                case 5:
                    _c = 0, atomicDirMapping_1 = atomicDirMapping;
                    _h.label = 6;
                case 6:
                    if (!(_c < atomicDirMapping_1.length)) return [3 /*break*/, 9];
                    _d = atomicDirMapping_1[_c], name_2 = _d[0], target = _d[1];
                    _e = moved;
                    return [4 /*yield*/, moveLegacyDirAtomic((0, node_path_1.join)(legacyBase, name_2), target)];
                case 7:
                    moved = _e + _h.sent();
                    _h.label = 8;
                case 8:
                    _c++;
                    return [3 /*break*/, 6];
                case 9:
                    _f = 0, fileMapping_1 = fileMapping;
                    _h.label = 10;
                case 10:
                    if (!(_f < fileMapping_1.length)) return [3 /*break*/, 13];
                    _g = fileMapping_1[_f], name_3 = _g[0], target = _g[1];
                    return [4 /*yield*/, moveLegacyFile((0, node_path_1.join)(legacyBase, name_3), target)];
                case 11:
                    if (_h.sent())
                        moved += 1;
                    _h.label = 12;
                case 12:
                    _f++;
                    return [3 /*break*/, 10];
                case 13: return [2 /*return*/, moved];
            }
        });
    });
}
/**
 * The session journal database path (§1.6 item 4: SQLite external and
 * exportable). Pure read: before the startup migration has run, a legacy
 * workspace-local db is read in place; a fresh workspace claims the external
 * location or degrades to workspace-local when the home refuses writes.
 */
function resolveWorkspaceJournalDatabasePath(workspaceRoot, home) {
    if (home === void 0) { home = (0, node_os_1.homedir)(); }
    var external = (0, node_path_1.join)(workspaceStoreRoot(workspaceRoot, home), "sessions.db");
    var legacy = (0, node_path_1.join)((0, node_path_1.resolve)(workspaceRoot), ".natalia", "sessions.db");
    if ((0, node_fs_1.existsSync)(external))
        return external;
    if ((0, node_fs_1.existsSync)(legacy))
        return legacy;
    try {
        (0, node_fs_2.mkdirSync)((0, node_path_1.join)(external, ".."), { recursive: true, mode: 448 });
        return external;
    }
    catch (_a) {
        return legacy;
    }
}
/** The JSON session store directory, same read rule as the object library. */
function resolveWorkspaceJsonSessionsDir(workspaceRoot, home) {
    if (home === void 0) { home = (0, node_os_1.homedir)(); }
    return externalIfLegacyMoved(workspaceRoot, (0, node_path_1.join)(workspaceStoreRoot(workspaceRoot, home), "json-sessions"), (0, node_path_1.join)((0, node_path_1.resolve)(workspaceRoot), ".natalia", "sessions"));
}
/**
 * The runtime operation log's directory (install study layout: the global
 * `~/.natalia/logs/`, next to stores/ — telemetry is home-level, not
 * workspace-level; purge treats it as data, uninstall leaves it).
 */
function operationLogsDir(osHome) {
    if (osHome === void 0) { osHome = (0, node_os_1.homedir)(); }
    return (0, node_path_1.join)(osHome, ".natalia", "logs");
}
