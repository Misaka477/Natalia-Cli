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
exports.createWorkspaceManager = createWorkspaceManager;
exports.createWorkspaceRuntimeClient = createWorkspaceRuntimeClient;
var node_path_1 = require("node:path");
var node_os_1 = require("node:os");
var promises_1 = require("node:fs/promises");
var node_crypto_1 = require("node:crypto");
var session_store_1 = require("@anthelia/session-store");
var contracts_1 = require("@natalia/contracts");
var main_1 = require("./runtime/main");
function workspaceSettingsPath(root) {
    return (0, node_path_1.join)(root, ".natalia", "workspace-settings.json");
}
function readSettings(root) {
    return __awaiter(this, void 0, void 0, function () {
        var raw, _a, _b, _c;
        var _d, _e;
        return __generator(this, function (_f) {
            switch (_f.label) {
                case 0:
                    _f.trys.push([0, 2, , 3]);
                    _b = (_a = JSON).parse;
                    return [4 /*yield*/, (0, promises_1.readFile)(workspaceSettingsPath(root), "utf8")];
                case 1:
                    raw = _b.apply(_a, [_f.sent()]);
                    return [2 /*return*/, {
                            permissionSettings: (_d = raw.permissionSettings) !== null && _d !== void 0 ? _d : {
                                permissionProfile: "default",
                                approval: "ask",
                            },
                            toolSettings: (_e = raw.toolSettings) !== null && _e !== void 0 ? _e : {
                                enabledTools: [],
                                disabledTools: [],
                            },
                            activeSessionID: typeof raw.activeSessionID === "string" && raw.activeSessionID.trim()
                                ? raw.activeSessionID
                                : undefined,
                        }];
                case 2:
                    _c = _f.sent();
                    return [2 /*return*/, {
                            permissionSettings: {
                                permissionProfile: "default",
                                approval: "ask",
                            },
                            toolSettings: {
                                enabledTools: [],
                                disabledTools: [],
                            },
                            activeSessionID: undefined,
                        }];
                case 3: return [2 /*return*/];
            }
        });
    });
}
var settingsWrites = new Map();
function writeSettings(root, update) {
    var _a;
    // Attach and settings edits may finish together; serialize read/modify/write.
    var write = ((_a = settingsWrites.get(root)) !== null && _a !== void 0 ? _a : Promise.resolve())
        .catch(function () { return undefined; })
        .then(function () { return saveSettings(root, update); });
    settingsWrites.set(root, write);
    void write
        .finally(function () {
        if (settingsWrites.get(root) === write)
            settingsWrites.delete(root);
    })
        .catch(function () { return undefined; });
    return write;
}
function saveSettings(root, update) {
    return __awaiter(this, void 0, void 0, function () {
        var path, current, next;
        var _a, _b, _c, _d;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    path = workspaceSettingsPath(root);
                    return [4 /*yield*/, readSettings(root)];
                case 1:
                    current = _e.sent();
                    next = __assign({ permissionSettings: (_a = update.permissionSettings) !== null && _a !== void 0 ? _a : current.permissionSettings, toolSettings: (_b = update.toolSettings) !== null && _b !== void 0 ? _b : current.toolSettings }, (((_c = update.activeSessionID) !== null && _c !== void 0 ? _c : current.activeSessionID) !== undefined
                        ? { activeSessionID: (_d = update.activeSessionID) !== null && _d !== void 0 ? _d : current.activeSessionID }
                        : {}));
                    return [4 /*yield*/, (0, promises_1.mkdir)((0, node_path_1.join)(root, ".natalia"), { recursive: true, mode: 448 })];
                case 2:
                    _e.sent();
                    return [4 /*yield*/, (0, promises_1.writeFile)(path, "".concat(JSON.stringify(next, null, 2), "\n"), { mode: 384 })];
                case 3:
                    _e.sent();
                    return [2 /*return*/, next];
            }
        });
    });
}
function workspaceRegistryPath() {
    var _a;
    return ((_a = process.env.NATALIA_WORKSPACES_FILE) !== null && _a !== void 0 ? _a : (0, node_path_1.join)((0, node_os_1.homedir)(), ".config", "natalia-cli", "workspaces.json"));
}
function readWorkspaceRegistry() {
    return __awaiter(this, void 0, void 0, function () {
        var raw, _a, _b, _c;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    _d.trys.push([0, 2, , 3]);
                    _b = (_a = JSON).parse;
                    return [4 /*yield*/, (0, promises_1.readFile)(workspaceRegistryPath(), "utf8")];
                case 1:
                    raw = _b.apply(_a, [_d.sent()]);
                    if (!Array.isArray(raw))
                        return [2 /*return*/, []];
                    return [2 /*return*/, raw.filter(function (entry) {
                            return typeof entry === "object" && entry !== null;
                        })];
                case 2:
                    _c = _d.sent();
                    return [2 /*return*/, []];
                case 3: return [2 /*return*/];
            }
        });
    });
}
function writeWorkspaceRegistry(entries) {
    return __awaiter(this, void 0, void 0, function () {
        var path;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    path = workspaceRegistryPath();
                    return [4 /*yield*/, (0, promises_1.mkdir)((0, node_path_1.join)((0, node_os_1.homedir)(), ".config", "natalia-cli"), {
                            recursive: true,
                            mode: 448,
                        })];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, (0, promises_1.writeFile)(path, "".concat(JSON.stringify(entries, null, 2), "\n"), {
                            mode: 384,
                        })];
                case 2:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function workspaceSessionDir(root, base) {
    if (!base)
        return undefined;
    var safe = root.replace(/[^a-zA-Z0-9_-]+/gu, "_").slice(-80);
    return (0, node_path_1.join)(base, safe);
}
function workspaceCheckpointDir(root, base) {
    if (!base)
        return undefined;
    var safe = root.replace(/[^a-zA-Z0-9_-]+/gu, "_").slice(-80);
    return (0, node_path_1.join)(base, safe);
}
/**
 * Host-level multi-workspace manager. Each workspace owns its own real runtime
 * client and runtime state; all workspaces share the same global config path
 * and plugin store (no per-workspace global config/plugins).
 */
function migrateLegacyWorkspaceSessions(root, legacyBase) {
    return __awaiter(this, void 0, void 0, function () {
        var legacyDir, targetDir, entries, files, migrated, _i, files_1, name_1, source, target, _a, error_1;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    if (!legacyBase)
                        return [2 /*return*/];
                    legacyDir = workspaceSessionDir(root, legacyBase);
                    targetDir = (0, node_path_1.join)(root, ".natalia", "sessions");
                    if (legacyDir === targetDir)
                        return [2 /*return*/];
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 12, , 13]);
                    return [4 /*yield*/, (0, promises_1.readdir)(legacyDir).catch(function () { return []; })];
                case 2:
                    entries = (_b.sent());
                    files = entries.filter(function (name) { return name.endsWith(".json"); });
                    if (!files.length)
                        return [2 /*return*/];
                    return [4 /*yield*/, (0, promises_1.mkdir)(targetDir, { recursive: true, mode: 448 })];
                case 3:
                    _b.sent();
                    migrated = 0;
                    _i = 0, files_1 = files;
                    _b.label = 4;
                case 4:
                    if (!(_i < files_1.length)) return [3 /*break*/, 10];
                    name_1 = files_1[_i];
                    source = (0, node_path_1.join)(legacyDir, name_1);
                    target = (0, node_path_1.join)(targetDir, name_1);
                    _b.label = 5;
                case 5:
                    _b.trys.push([5, 7, , 8]);
                    return [4 /*yield*/, (0, promises_1.rename)(source, target)];
                case 6:
                    _b.sent();
                    return [3 /*break*/, 8];
                case 7:
                    _a = _b.sent();
                    return [3 /*break*/, 9];
                case 8:
                    migrated++;
                    _b.label = 9;
                case 9:
                    _i++;
                    return [3 /*break*/, 4];
                case 10: return [4 /*yield*/, (0, promises_1.rm)(legacyDir, { recursive: true, force: true }).catch(function () { return undefined; })];
                case 11:
                    _b.sent();
                    // Host-facade boundary (decisions §6): this manager runs BEFORE any
                    // runtime exists, so there is no service directory to log through —
                    // console stays until the host-face data plane (T4) lands, and the
                    // console guard allowlists this file with that reason.
                    console.warn("[workspace-session] migrated", migrated, "session files to", targetDir);
                    return [3 /*break*/, 13];
                case 12:
                    error_1 = _b.sent();
                    console.warn("[workspace-session] legacy migration failed", error_1);
                    return [3 /*break*/, 13];
                case 13: return [2 /*return*/];
            }
        });
    });
}
function createWorkspaceManager(options) {
    if (options === void 0) { options = {}; }
    var runtimes = new Map();
    var activeWorkspaceID;
    function registryEntries() {
        return __spreadArray([], runtimes.values(), true).map(function (runtime) { return ({
            path: runtime.root,
            title: runtime.title,
            active: runtime.workspaceID === activeWorkspaceID,
        }); });
    }
    var SESSION_CACHE_TTL_MS = 1000;
    var sessionCache = new Map();
    /** session id -> owning workspace id, the manager-level membership index. */
    var sessionWorkspaceIndex = new Map();
    function replaceSessionIndex(workspaceID, sessions) {
        for (var _i = 0, sessionWorkspaceIndex_1 = sessionWorkspaceIndex; _i < sessionWorkspaceIndex_1.length; _i++) {
            var _a = sessionWorkspaceIndex_1[_i], sessionID = _a[0], owner = _a[1];
            if (owner === workspaceID)
                sessionWorkspaceIndex.delete(sessionID);
        }
        for (var _b = 0, sessions_1 = sessions; _b < sessions_1.length; _b++) {
            var session = sessions_1[_b];
            sessionWorkspaceIndex.set(session.id, workspaceID);
        }
    }
    function invalidateSessionCache(workspaceID) {
        if (!workspaceID) {
            sessionCache.clear();
            sessionWorkspaceIndex.clear();
            return;
        }
        sessionCache.delete(workspaceID);
        for (var _i = 0, sessionWorkspaceIndex_2 = sessionWorkspaceIndex; _i < sessionWorkspaceIndex_2.length; _i++) {
            var _a = sessionWorkspaceIndex_2[_i], sessionID = _a[0], owner = _a[1];
            if (owner === workspaceID)
                sessionWorkspaceIndex.delete(sessionID);
        }
    }
    function readLocalSessions(runtime) {
        return __awaiter(this, void 0, void 0, function () {
            var rows;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, (0, session_store_1.createLocalSessionService)(runtime.root).list({
                            useSqliteStore: (_a = options.useSqliteStore) !== null && _a !== void 0 ? _a : false,
                        })];
                    case 1:
                        rows = _b.sent();
                        return [2 /*return*/, rows.map(function (row) { return (__assign(__assign(__assign(__assign({ id: row.id, workspaceID: runtime.workspaceID, title: row.title, createdAt: row.createdAt }, (row.lastAccessedAt ? { lastAccessedAt: row.lastAccessedAt } : {})), { pinned: row.pinned }), (row.archived !== undefined ? { archived: row.archived } : {})), { events: row.events, pendingInputs: row.pendingInputs, cancelled: false, resumable: true, status: row.pendingInputs > 0 ? "running" : "idle" })); })];
                }
            });
        });
    }
    function listRuntimeSessions(runtime, options) {
        return __awaiter(this, void 0, void 0, function () {
            var cached, rows, sessions, _a, sessions, _b;
            var _c;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        cached = sessionCache.get(runtime.workspaceID);
                        if (!(runtime.started && runtime.client.sessionList)) return [3 /*break*/, 4];
                        _d.label = 1;
                    case 1:
                        _d.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, runtime.client.sessionList()];
                    case 2:
                        rows = _d.sent();
                        sessions = rows.map(function (session) { return (__assign(__assign({}, session), { workspaceID: runtime.workspaceID })); });
                        sessionCache.set(runtime.workspaceID, {
                            sessions: sessions,
                            loadedAt: Date.now(),
                        });
                        replaceSessionIndex(runtime.workspaceID, sessions);
                        return [2 /*return*/, sessions];
                    case 3:
                        _a = _d.sent();
                        return [3 /*break*/, 4];
                    case 4:
                        if (!(options === null || options === void 0 ? void 0 : options.force) &&
                            cached &&
                            Date.now() - cached.loadedAt < SESSION_CACHE_TTL_MS) {
                            return [2 /*return*/, cached.sessions];
                        }
                        _d.label = 5;
                    case 5:
                        _d.trys.push([5, 7, , 8]);
                        return [4 /*yield*/, readLocalSessions(runtime)];
                    case 6:
                        sessions = _d.sent();
                        sessionCache.set(runtime.workspaceID, {
                            sessions: sessions,
                            loadedAt: Date.now(),
                        });
                        replaceSessionIndex(runtime.workspaceID, sessions);
                        return [2 /*return*/, sessions];
                    case 7:
                        _b = _d.sent();
                        return [2 /*return*/, (_c = cached === null || cached === void 0 ? void 0 : cached.sessions) !== null && _c !== void 0 ? _c : []];
                    case 8: return [2 /*return*/];
                }
            });
        });
    }
    function listSessions() {
        return __awaiter(this, void 0, void 0, function () {
            var groups;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.all(__spreadArray([], runtimes.values(), true).map(function (runtime) { return listRuntimeSessions(runtime); }))];
                    case 1:
                        groups = _a.sent();
                        return [2 /*return*/, groups.flat()];
                }
            });
        });
    }
    function findWorkspaceForSession(sessionID) {
        return __awaiter(this, void 0, void 0, function () {
            var indexed, runtime, _i, _a, runtime, sessions;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        indexed = sessionWorkspaceIndex.get(sessionID);
                        if (indexed) {
                            runtime = runtimes.get(indexed);
                            if (runtime)
                                return [2 /*return*/, runtime];
                        }
                        _i = 0, _a = runtimes.values();
                        _b.label = 1;
                    case 1:
                        if (!(_i < _a.length)) return [3 /*break*/, 4];
                        runtime = _a[_i];
                        return [4 /*yield*/, listRuntimeSessions(runtime, { force: true })];
                    case 2:
                        sessions = _b.sent();
                        if (sessions.some(function (session) { return session.id === sessionID; }))
                            return [2 /*return*/, runtime];
                        _b.label = 3;
                    case 3:
                        _i++;
                        return [3 /*break*/, 1];
                    case 4: return [2 /*return*/, undefined];
                }
            });
        });
    }
    function activeSessionRecency(ws) {
        return __awaiter(this, void 0, void 0, function () {
            var settings_1, rows, active, value, _a;
            var _b, _c, _d, _e;
            return __generator(this, function (_f) {
                switch (_f.label) {
                    case 0:
                        _f.trys.push([0, 3, , 4]);
                        return [4 /*yield*/, readSettings(ws.root)];
                    case 1:
                        settings_1 = _f.sent();
                        return [4 /*yield*/, (0, session_store_1.createLocalSessionService)(ws.root).list({
                                useSqliteStore: (_b = options.useSqliteStore) !== null && _b !== void 0 ? _b : false,
                            })];
                    case 2:
                        rows = _f.sent();
                        active = (_c = rows.find(function (row) { return row.id === settings_1.activeSessionID; })) !== null && _c !== void 0 ? _c : __spreadArray([], rows, true).sort(function (left, right) {
                            var _a, _b;
                            return ((_a = right.lastAccessedAt) !== null && _a !== void 0 ? _a : right.createdAt).localeCompare((_b = left.lastAccessedAt) !== null && _b !== void 0 ? _b : left.createdAt);
                        })[0];
                        value = Date.parse((_e = (_d = active === null || active === void 0 ? void 0 : active.lastAccessedAt) !== null && _d !== void 0 ? _d : active === null || active === void 0 ? void 0 : active.createdAt) !== null && _e !== void 0 ? _e : "");
                        return [2 /*return*/, Number.isFinite(value) ? value : 0];
                    case 3:
                        _a = _f.sent();
                        return [2 /*return*/, 0];
                    case 4: return [2 /*return*/];
                }
            });
        });
    }
    function summary(ws) {
        return __awaiter(this, void 0, void 0, function () {
            var sessions;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, listRuntimeSessions(ws)];
                    case 1:
                        sessions = _a.sent();
                        return [2 /*return*/, {
                                workspaceID: ws.workspaceID,
                                root: ws.root,
                                title: ws.title,
                                status: ws.status,
                                sessionCount: sessions.length,
                                runningSessionCount: sessions.filter(function (session) { return session.pendingInputs > 0 || session.status === "running"; }).length,
                            }];
                }
            });
        });
    }
    function activate(workspaceID) {
        return __awaiter(this, void 0, void 0, function () {
            var ws, _i, _a, other;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        ws = runtimes.get(workspaceID);
                        if (!ws)
                            throw new Error("workspace not found: ".concat(workspaceID));
                        activeWorkspaceID = workspaceID;
                        ws.status = "active";
                        for (_i = 0, _a = runtimes.values(); _i < _a.length; _i++) {
                            other = _a[_i];
                            if (other.workspaceID !== workspaceID && other.status === "active")
                                other.status = "idle";
                        }
                        return [4 /*yield*/, writeWorkspaceRegistry(registryEntries())];
                    case 1:
                        _b.sent();
                        return [4 /*yield*/, summary(ws)];
                    case 2: return [2 /*return*/, _b.sent()];
                }
            });
        });
    }
    function addWorkspace(input) {
        return __awaiter(this, void 0, void 0, function () {
            var root, existing, nextTitle, settings, sessions, activeSessionID, client, ws;
            var _a, _b, _c, _d, _e, _f, _g;
            return __generator(this, function (_h) {
                switch (_h.label) {
                    case 0:
                        root = (0, node_path_1.resolve)(input.path);
                        existing = __spreadArray([], runtimes.values(), true).find(function (ws) { return ws.root === root; });
                        if (!existing) return [3 /*break*/, 4];
                        nextTitle = (_a = input.title) === null || _a === void 0 ? void 0 : _a.trim();
                        if (!(nextTitle && nextTitle !== existing.title)) return [3 /*break*/, 2];
                        existing.title = nextTitle;
                        return [4 /*yield*/, writeWorkspaceRegistry(registryEntries())];
                    case 1:
                        _h.sent();
                        _h.label = 2;
                    case 2: return [4 /*yield*/, summary(existing)];
                    case 3: return [2 /*return*/, _h.sent()];
                    case 4: return [4 /*yield*/, migrateLegacyWorkspaceSessions(root, options.sessionDir)];
                    case 5:
                        _h.sent();
                        return [4 /*yield*/, readSettings(root)];
                    case 6:
                        settings = _h.sent();
                        return [4 /*yield*/, (0, session_store_1.createLocalSessionService)(root).list({
                                useSqliteStore: (_b = options.useSqliteStore) !== null && _b !== void 0 ? _b : false,
                            })];
                    case 7:
                        sessions = (_h.sent()).filter(function (session) { return !session.archived; });
                        activeSessionID = (_d = (_c = sessions.find(function (session) { return session.id === settings.activeSessionID; })) === null || _c === void 0 ? void 0 : _c.id) !== null && _d !== void 0 ? _d : (_e = sessions.sort(function (left, right) {
                            var _a, _b;
                            return ((_a = right.lastAccessedAt) !== null && _a !== void 0 ? _a : right.createdAt).localeCompare((_b = left.lastAccessedAt) !== null && _b !== void 0 ? _b : left.createdAt);
                        })[0]) === null || _e === void 0 ? void 0 : _e.id;
                        client = (0, main_1.createRealRuntimeClient)(__assign({ workspaceRoot: root, pluginStoreRoot: options.pluginStoreRoot, globalConfigPath: options.globalConfigPath, useSqliteStore: options.useSqliteStore, contextWindowCachePath: options.contextWindowCachePath }, (activeSessionID ? { sessionID: activeSessionID } : {})));
                        ws = {
                            workspaceID: "ws_".concat((0, node_crypto_1.randomUUID)().replace(/-/gu, "").slice(0, 12)),
                            root: root,
                            title: (_g = (_f = input.title) !== null && _f !== void 0 ? _f : root.split("/").pop()) !== null && _g !== void 0 ? _g : root,
                            client: client,
                            status: "idle",
                            permissionSettings: settings.permissionSettings,
                            toolSettings: settings.toolSettings,
                        };
                        runtimes.set(ws.workspaceID, ws);
                        if (!!activeWorkspaceID) return [3 /*break*/, 9];
                        return [4 /*yield*/, activate(ws.workspaceID)];
                    case 8:
                        _h.sent();
                        _h.label = 9;
                    case 9: return [4 /*yield*/, writeWorkspaceRegistry(registryEntries())];
                    case 10:
                        _h.sent();
                        return [4 /*yield*/, summary(ws)];
                    case 11: return [2 /*return*/, _h.sent()];
                }
            });
        });
    }
    function removeWorkspace(workspaceID) {
        return __awaiter(this, void 0, void 0, function () {
            var ws, next;
            var _a, _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        ws = runtimes.get(workspaceID);
                        if (!ws)
                            return [2 /*return*/, { removed: true }];
                        return [4 /*yield*/, ((_b = (_a = ws.client).dispose) === null || _b === void 0 ? void 0 : _b.call(_a))];
                    case 1:
                        _c.sent();
                        runtimes.delete(workspaceID);
                        invalidateSessionCache(workspaceID);
                        if (activeWorkspaceID === workspaceID) {
                            next = runtimes.values().next().value;
                            activeWorkspaceID = next === null || next === void 0 ? void 0 : next.workspaceID;
                            if (next)
                                next.status = "active";
                        }
                        return [4 /*yield*/, writeWorkspaceRegistry(registryEntries())];
                    case 2:
                        _c.sent();
                        return [2 /*return*/, { removed: true }];
                }
            });
        });
    }
    return {
        load: function () {
            return __awaiter(this, void 0, void 0, function () {
                var entries, _loop_1, _i, entries_1, entry, preferredEntry, preferredWorkspace, newest, _a, _b, workspace, timestamp;
                return __generator(this, function (_c) {
                    switch (_c.label) {
                        case 0: return [4 /*yield*/, readWorkspaceRegistry()];
                        case 1:
                            entries = _c.sent();
                            _loop_1 = function (entry) {
                                return __generator(this, function (_d) {
                                    switch (_d.label) {
                                        case 0:
                                            if (!(entry.path &&
                                                !__spreadArray([], runtimes.values(), true).some(function (ws) { return ws.root === (0, node_path_1.resolve)(entry.path); }))) return [3 /*break*/, 2];
                                            return [4 /*yield*/, addWorkspace({ path: entry.path, title: entry.title })];
                                        case 1:
                                            _d.sent();
                                            _d.label = 2;
                                        case 2: return [2 /*return*/];
                                    }
                                });
                            };
                            _i = 0, entries_1 = entries;
                            _c.label = 2;
                        case 2:
                            if (!(_i < entries_1.length)) return [3 /*break*/, 5];
                            entry = entries_1[_i];
                            return [5 /*yield**/, _loop_1(entry)];
                        case 3:
                            _c.sent();
                            _c.label = 4;
                        case 4:
                            _i++;
                            return [3 /*break*/, 2];
                        case 5:
                            preferredEntry = entries.find(function (entry) { return entry.active; });
                            preferredWorkspace = preferredEntry
                                ? __spreadArray([], runtimes.values(), true).find(function (runtime) { return runtime.root === (0, node_path_1.resolve)(preferredEntry.path); })
                                : undefined;
                            if (!preferredWorkspace) return [3 /*break*/, 7];
                            return [4 /*yield*/, activate(preferredWorkspace.workspaceID)];
                        case 6:
                            _c.sent();
                            return [2 /*return*/];
                        case 7:
                            if (runtimes.size <= 1)
                                return [2 /*return*/];
                            _a = 0, _b = runtimes.values();
                            _c.label = 8;
                        case 8:
                            if (!(_a < _b.length)) return [3 /*break*/, 11];
                            workspace = _b[_a];
                            return [4 /*yield*/, activeSessionRecency(workspace)];
                        case 9:
                            timestamp = _c.sent();
                            if (!newest || timestamp > newest.timestamp)
                                newest = { workspace: workspace, timestamp: timestamp };
                            _c.label = 10;
                        case 10:
                            _a++;
                            return [3 /*break*/, 8];
                        case 11:
                            if (!newest) return [3 /*break*/, 13];
                            return [4 /*yield*/, activate(newest.workspace.workspaceID)];
                        case 12:
                            _c.sent();
                            _c.label = 13;
                        case 13: return [2 /*return*/];
                    }
                });
            });
        },
        listSessions: listSessions,
        findWorkspaceForSession: findWorkspaceForSession,
        invalidateSessionCache: invalidateSessionCache,
        list: function () {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, Promise.all(__spreadArray([], runtimes.values(), true).map(summary))];
                });
            });
        },
        workspaceRoots: function () {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, Promise.all(__spreadArray([], runtimes.values(), true).map(summary))];
                });
            });
        },
        workspaceAdd: addWorkspace,
        workspaceRemove: removeWorkspace,
        workspaceActivate: activate,
        workspacePermissionGet: function (workspaceID) {
            return __awaiter(this, void 0, void 0, function () {
                var ws;
                return __generator(this, function (_a) {
                    ws = runtimes.get(workspaceID);
                    if (!ws)
                        throw new Error("workspace not found: ".concat(workspaceID));
                    return [2 /*return*/, ws.permissionSettings];
                });
            });
        },
        workspacePermissionSet: function (workspaceID, settings) {
            return __awaiter(this, void 0, void 0, function () {
                var ws, saved;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            ws = runtimes.get(workspaceID);
                            if (!ws)
                                throw new Error("workspace not found: ".concat(workspaceID));
                            return [4 /*yield*/, writeSettings(ws.root, {
                                    permissionSettings: settings,
                                })];
                        case 1:
                            saved = _a.sent();
                            ws.permissionSettings = saved.permissionSettings;
                            return [2 /*return*/, ws.permissionSettings];
                    }
                });
            });
        },
        workspaceSessionGet: function (workspaceID) {
            return __awaiter(this, void 0, void 0, function () {
                var ws;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            ws = runtimes.get(workspaceID);
                            if (!ws)
                                throw new Error("workspace not found: ".concat(workspaceID));
                            return [4 /*yield*/, readSettings(ws.root)];
                        case 1: return [2 /*return*/, (_a.sent()).activeSessionID];
                    }
                });
            });
        },
        workspaceSessionSet: function (workspaceID, sessionID) {
            return __awaiter(this, void 0, void 0, function () {
                var ws;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            ws = runtimes.get(workspaceID);
                            if (!ws)
                                throw new Error("workspace not found: ".concat(workspaceID));
                            return [4 /*yield*/, writeSettings(ws.root, { activeSessionID: sessionID })];
                        case 1:
                            _a.sent();
                            return [2 /*return*/];
                    }
                });
            });
        },
        workspaceToolGet: function (workspaceID) {
            return __awaiter(this, void 0, void 0, function () {
                var ws;
                return __generator(this, function (_a) {
                    ws = runtimes.get(workspaceID);
                    if (!ws)
                        throw new Error("workspace not found: ".concat(workspaceID));
                    return [2 /*return*/, ws.toolSettings];
                });
            });
        },
        workspaceToolSet: function (workspaceID, settings) {
            return __awaiter(this, void 0, void 0, function () {
                var ws, saved;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            ws = runtimes.get(workspaceID);
                            if (!ws)
                                throw new Error("workspace not found: ".concat(workspaceID));
                            return [4 /*yield*/, writeSettings(ws.root, { toolSettings: settings })];
                        case 1:
                            saved = _a.sent();
                            ws.toolSettings = saved.toolSettings;
                            return [2 /*return*/, ws.toolSettings];
                    }
                });
            });
        },
        add: addWorkspace,
        remove: removeWorkspace,
        activate: activate,
        get: function (workspaceID) {
            return runtimes.get(workspaceID);
        },
        getActive: function () {
            return activeWorkspaceID ? runtimes.get(activeWorkspaceID) : undefined;
        },
        summaryFor: function (workspace) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, summary(workspace)];
                });
            });
        },
        dispose: function () {
            return __awaiter(this, void 0, void 0, function () {
                var _i, _a, ws;
                var _b, _c;
                return __generator(this, function (_d) {
                    switch (_d.label) {
                        case 0:
                            _i = 0, _a = runtimes.values();
                            _d.label = 1;
                        case 1:
                            if (!(_i < _a.length)) return [3 /*break*/, 4];
                            ws = _a[_i];
                            return [4 /*yield*/, ((_c = (_b = ws.client).dispose) === null || _c === void 0 ? void 0 : _c.call(_b))];
                        case 2:
                            _d.sent();
                            _d.label = 3;
                        case 3:
                            _i++;
                            return [3 /*break*/, 1];
                        case 4:
                            runtimes.clear();
                            activeWorkspaceID = undefined;
                            return [2 /*return*/];
                    }
                });
            });
        },
    };
}
/**
 * A RuntimeClient facade that delegates all active-workspace methods to the
 * currently active real runtime and exposes workspace management on the same
 * object. Host shells can pass this as `UiPluginContext.runtime`.
 */
function createWorkspaceRuntimeClient(manager) {
    var listeners = new Set();
    var startedClients = new Set();
    var started = false;
    function emit(event) {
        for (var _i = 0, listeners_1 = listeners; _i < listeners_1.length; _i++) {
            var listener = listeners_1[_i];
            listener(event);
        }
    }
    function decorateSession(session, workspace) {
        var _a;
        var summarySession = session;
        var status = (_a = summarySession.status) !== null && _a !== void 0 ? _a : (summarySession.cancelled
            ? "error"
            : summarySession.pendingInputs > 0
                ? "running"
                : summarySession.resumable
                    ? "idle"
                    : "stopped");
        return __assign(__assign({}, session), { workspaceID: workspace.workspaceID, status: status });
    }
    function startWorkspaceClient(workspace) {
        workspace.started = true;
        if (startedClients.has(workspace.workspaceID))
            return;
        startedClients.add(workspace.workspaceID);
        workspace.client.start(function (event) {
            if (event.type.startsWith("session.")) {
                manager.invalidateSessionCache(workspace.workspaceID);
            }
            emit(__assign(__assign({}, event), { workspaceID: workspace.workspaceID }));
        });
    }
    function startActiveClient() {
        var active = manager.getActive();
        if (active)
            startWorkspaceClient(active);
    }
    function isActiveSessionDeleteRefusal(error) {
        return (error instanceof Error &&
            error.message.includes("cannot delete the active runtime session"));
    }
    /**
     * The runtime refuses to delete the session it is currently attached to.
     * When a workspace-scoped call targets that active session, attach another
     * session in the same workspace before retrying the delete. If the workspace
     * has only the doomed session, create one replacement so the runtime still
     * has a live attachment to serve when the workspace is opened again.
     */
    function replaceActiveSessionForDelete(owner, sessionID) {
        return __awaiter(this, void 0, void 0, function () {
            var client, sessions, replacement, created;
            var _a, _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        client = owner.client;
                        return [4 /*yield*/, ((_a = client.sessionList) === null || _a === void 0 ? void 0 : _a.call(client))];
                    case 1:
                        sessions = (_b = (_c.sent())) !== null && _b !== void 0 ? _b : [];
                        replacement = sessions.find(function (session) { return session.id !== sessionID && !session.archived; });
                        if (!replacement) return [3 /*break*/, 4];
                        if (typeof client.sessionAttach !== "function")
                            throw new Error("cannot delete the active session: runtime does not support session attach");
                        return [4 /*yield*/, client.sessionAttach(replacement.id)];
                    case 2:
                        _c.sent();
                        return [4 /*yield*/, manager.workspaceSessionSet(owner.workspaceID, replacement.id)];
                    case 3:
                        _c.sent();
                        return [2 /*return*/];
                    case 4:
                        if (typeof client.sessionNew !== "function")
                            throw new Error("cannot delete the active session: runtime does not support creating a replacement session");
                        return [4 /*yield*/, client.sessionNew()];
                    case 5:
                        created = _c.sent();
                        if (!(created === null || created === void 0 ? void 0 : created.sessionID))
                            throw new Error("cannot delete the active session: runtime did not create a replacement session");
                        if (typeof client.sessionAttach !== "function")
                            throw new Error("cannot delete the active session: runtime does not support session attach");
                        return [4 /*yield*/, client.sessionAttach(created.sessionID)];
                    case 6:
                        _c.sent();
                        return [4 /*yield*/, manager.workspaceSessionSet(owner.workspaceID, created.sessionID)];
                    case 7:
                        _c.sent();
                        return [2 /*return*/];
                }
            });
        });
    }
    function emitWorkspace(event) {
        emit(event);
    }
    var sessionIDFirstArg = new Set([
        "confirmedWorkspaceChanges",
        "teamPRList",
        "resume",
        "modelSelection",
        "reasoningEffort",
        "nativeTerminalList",
        "checkpointList",
        "sandboxList",
        "runtimeStatus",
        "constitutionRules",
        "constitutionDocRules",
        "decisionRecords",
        "mailboxList",
        "planDocList",
        "planDocActive",
        "planDocDeactivate",
        "evidenceRecords",
        "completions",
        "sessionSnapshot",
        "driftFindings",
        "registeredTools",
        "subagents",
        "subagentHistory",
    ]);
    var sessionIDSecondArg = new Set([
        "submit",
        "cancel",
        "pause",
        "selectAgent",
        "setReasoningEffort",
        "diagnostics",
        "recordDecision",
        "recordValidation",
        "recordCompletion",
        "evaluateDrift",
        "acknowledgeDriftFinding",
        "reopenDriftFinding",
        "promoteConstitutionDocRule",
        "updateConstitutionDocRule",
        "planTaskStates",
        "workGraphIntegrity",
        "unattributedChanges",
        "requestOverride",
        "nativeTerminalRead",
        "nativeTerminalClaimHumanInput",
        "nativeTerminalRevokeApprovalScope",
        "nativeTerminalReleaseHumanControl",
        "nativeTerminalBeginSecureInput",
        "nativeTerminalEndSecureInput",
        "nativeTerminalStop",
        "checkpointListByKind",
        "checkpointPreview",
        "sandboxDiff",
        "sandboxResources",
        "sandboxMerge",
        "sandboxDelete",
        "mailboxDeliver",
        "mailboxAcknowledge",
        "planDocDelete",
        "planDocStatus",
        "planDocActivate",
    ]);
    var sessionIDThirdArg = new Set([
        "selectModel",
        "mailboxDefer",
        "mailboxSupersede",
    ]);
    var objectSessionArg = new Set([
        "submitAndWait",
        "submitInput",
        "history",
        "messages",
        "nativeTerminalStart",
        "nativeTerminalWrite",
        "nativeTerminalResize",
        "checkpointRollback",
        "checkpointRename",
        "sandboxResourceOutput",
        "sandboxResourceStop",
        "mailboxSend",
        "planDocRead",
        "planDocWrite",
        "planDocMark",
        "planDocUpdateStatus",
        "subagentHistoryPage",
        "pendingInteractive",
        "commandExecute",
        "snapshot",
        "lastSubmission",
        "workGraphNodes",
        "workGraphEdges",
        "respondApproval",
        "respondQuestion",
        "respondInteractive",
    ]);
    var workspaceScopedMethods = new Set([
        "workspaceFiles",
        "workspaceSearch",
        "workspaceList",
        "workspaceRead",
        "resourceRead",
        "workspaceWrite",
        "workspaceCreate",
        "workspaceRename",
        "workspaceDelete",
        "workspaceGlob",
        "workspaceDiff",
        "workspaceGitDiff",
        "gitRefs",
        "roundDiff",
        "workspaceWriteConflicts",
        "astDiff",
        "astDiffBatch",
        "astRefactorPreview",
        "astService",
        "astRefactorPlan",
        "astApplyRefactor",
        "mcpCatalog",
        "mcpServerAdd",
        "agents",
        "modelCatalog",
        "skills",
        "agentCreate",
        "agentUpdate",
        "commandCatalog",
        "uploadAttachment",
        "attachmentDataUrl",
        "capabilities",
        "projectionContributions",
    ]);
    var workspaceIDSecondArg = new Set([
        "auditRounds",
        "mcpServerRemove",
        "agentDelete",
    ]);
    var workspaceIDThirdArg = new Set(["readMcpResource"]);
    var workspaceIDFourthArg = new Set(["getMcpPrompt"]);
    var sessionScopedMethods = new Set(__spreadArray(__spreadArray(__spreadArray(__spreadArray([], sessionIDFirstArg, true), sessionIDSecondArg, true), sessionIDThirdArg, true), objectSessionArg, true));
    var routableMethods = new Set(__spreadArray(__spreadArray(__spreadArray(__spreadArray(__spreadArray([], sessionScopedMethods, true), workspaceScopedMethods, true), workspaceIDSecondArg, true), workspaceIDThirdArg, true), workspaceIDFourthArg, true));
    function workspaceIDFromArgs(prop, args) {
        if (workspaceIDSecondArg.has(prop) && typeof args[1] === "string")
            return args[1];
        if (workspaceIDThirdArg.has(prop) && typeof args[2] === "string")
            return args[2];
        if (workspaceIDFourthArg.has(prop) && typeof args[3] === "string")
            return args[3];
        var first = args[0];
        if (first && typeof first === "object" && !Array.isArray(first)) {
            var value = first.workspaceID;
            if (typeof value === "string")
                return value;
        }
        return undefined;
    }
    function sessionIDFromArgs(prop, args) {
        var stringAt = function (index) {
            return typeof args[index] === "string" ? args[index] : undefined;
        };
        if (sessionIDFirstArg.has(prop))
            return stringAt(0);
        if (sessionIDSecondArg.has(prop))
            return stringAt(1);
        if (sessionIDThirdArg.has(prop))
            return stringAt(2);
        var first = args[0];
        if (first && typeof first === "object" && !Array.isArray(first)) {
            var value = first.sessionID;
            if (typeof value === "string")
                return value;
        }
        return undefined;
    }
    function resolveRoutedWorkspace(prop, args) {
        return __awaiter(this, void 0, void 0, function () {
            var explicitWorkspaceID, requestedSessionID, owner, sessionOwner;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        explicitWorkspaceID = workspaceIDFromArgs(prop, args);
                        requestedSessionID = sessionIDFromArgs(prop, args);
                        if (!explicitWorkspaceID) return [3 /*break*/, 3];
                        owner = manager.get(explicitWorkspaceID);
                        if (!owner)
                            return [2 /*return*/, undefined];
                        if (!requestedSessionID) return [3 /*break*/, 2];
                        return [4 /*yield*/, manager.findWorkspaceForSession(requestedSessionID)];
                    case 1:
                        sessionOwner = _b.sent();
                        if (!sessionOwner || sessionOwner.workspaceID !== owner.workspaceID) {
                            throw new contracts_1.RuntimeRefusal("session ".concat(requestedSessionID, " does not belong to workspace ").concat(explicitWorkspaceID));
                        }
                        _b.label = 2;
                    case 2: return [2 /*return*/, owner];
                    case 3:
                        if (!requestedSessionID) return [3 /*break*/, 5];
                        return [4 /*yield*/, manager.findWorkspaceForSession(requestedSessionID)];
                    case 4: return [2 /*return*/, ((_a = (_b.sent())) !== null && _a !== void 0 ? _a : manager.getActive())];
                    case 5: return [2 /*return*/, manager.getActive()];
                }
            });
        });
    }
    var handler = {
        get: function (_target, prop, _receiver) {
            var _this = this;
            if (prop === "start") {
                return function (onEvent) {
                    if (onEvent)
                        listeners.add(onEvent);
                    started = true;
                    startActiveClient();
                };
            }
            if (prop === "workspaceAdd") {
                return function (input) { return __awaiter(_this, void 0, void 0, function () {
                    var wasEmpty, result;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0:
                                wasEmpty = !manager.getActive();
                                return [4 /*yield*/, manager.workspaceAdd(input)];
                            case 1:
                                result = _a.sent();
                                if (started && (wasEmpty || result.status === "active"))
                                    startActiveClient();
                                if (started)
                                    emitWorkspace({
                                        type: "workspace.added",
                                        workspace: result,
                                        workspaceID: result.workspaceID,
                                    });
                                return [2 /*return*/, result];
                        }
                    });
                }); };
            }
            if (prop === "workspaceActivate") {
                return function (workspaceID) { return __awaiter(_this, void 0, void 0, function () {
                    var result;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0: return [4 /*yield*/, manager.workspaceActivate(workspaceID)];
                            case 1:
                                result = _a.sent();
                                if (started)
                                    startActiveClient();
                                if (started)
                                    emitWorkspace({
                                        type: "workspace.activated",
                                        workspace: result,
                                        workspaceID: result.workspaceID,
                                    });
                                return [2 /*return*/, result];
                        }
                    });
                }); };
            }
            if (prop === "workspaceRemove") {
                return function (workspaceID) { return __awaiter(_this, void 0, void 0, function () {
                    var result, next, _a;
                    var _b;
                    return __generator(this, function (_c) {
                        switch (_c.label) {
                            case 0: return [4 /*yield*/, manager.workspaceRemove(workspaceID)];
                            case 1:
                                result = _c.sent();
                                if (!started) return [3 /*break*/, 3];
                                emitWorkspace({
                                    type: "workspace.removed",
                                    workspaceID: workspaceID,
                                });
                                next = manager.getActive();
                                if (!next) return [3 /*break*/, 3];
                                _a = emitWorkspace;
                                _b = {
                                    type: "workspace.activated"
                                };
                                return [4 /*yield*/, manager.summaryFor(next)];
                            case 2:
                                _a.apply(void 0, [(_b.workspace = _c.sent(),
                                        _b.workspaceID = next.workspaceID,
                                        _b)]);
                                _c.label = 3;
                            case 3: return [2 /*return*/, result];
                        }
                    });
                }); };
            }
            if (prop === "sessionList") {
                return function () { return __awaiter(_this, void 0, void 0, function () {
                    var sessions;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0: return [4 /*yield*/, manager.listSessions()];
                            case 1:
                                sessions = _a.sent();
                                return [2 /*return*/, sessions.map(function (session) {
                                        var owner = session.workspaceID
                                            ? manager.get(session.workspaceID)
                                            : undefined;
                                        return owner ? decorateSession(session, owner) : session;
                                    })];
                        }
                    });
                }); };
            }
            if (prop === "sessionRename" ||
                prop === "sessionPin" ||
                prop === "sessionDuplicate" ||
                prop === "sessionFork" ||
                prop === "sessionRollbackMessages" ||
                prop === "sessionDelete" ||
                prop === "sessionArchive" ||
                prop === "sessionRestore" ||
                prop === "sessionExport" ||
                prop === "sessionAttach" ||
                prop === "sessionTouch") {
                return function () {
                    var args = [];
                    for (var _i = 0; _i < arguments.length; _i++) {
                        args[_i] = arguments[_i];
                    }
                    return __awaiter(_this, void 0, void 0, function () {
                        var sessionID, owner, fn, _a, result, error_2;
                        var _b;
                        var _c;
                        return __generator(this, function (_d) {
                            switch (_d.label) {
                                case 0:
                                    sessionID = args[0];
                                    if (typeof sessionID !== "string")
                                        return [2 /*return*/, undefined];
                                    return [4 /*yield*/, manager.findWorkspaceForSession(sessionID)];
                                case 1:
                                    owner = (_c = (_d.sent())) !== null && _c !== void 0 ? _c : manager.getActive();
                                    if (!owner)
                                        return [2 /*return*/, undefined];
                                    fn = owner.client[prop];
                                    if (typeof fn !== "function")
                                        return [2 /*return*/, undefined];
                                    if (!(prop === "sessionAttach")) return [3 /*break*/, 5];
                                    return [4 /*yield*/, manager.workspaceActivate(owner.workspaceID)];
                                case 2:
                                    _d.sent();
                                    startWorkspaceClient(owner);
                                    if (!started) return [3 /*break*/, 4];
                                    _a = emitWorkspace;
                                    _b = {
                                        type: "workspace.activated"
                                    };
                                    return [4 /*yield*/, manager.summaryFor(owner)];
                                case 3:
                                    _a.apply(void 0, [(_b.workspace = _d.sent(),
                                            _b.workspaceID = owner.workspaceID,
                                            _b)]);
                                    _d.label = 4;
                                case 4: return [3 /*break*/, 6];
                                case 5:
                                    startWorkspaceClient(owner);
                                    _d.label = 6;
                                case 6:
                                    _d.trys.push([6, 8, , 11]);
                                    return [4 /*yield*/, fn.apply(owner.client, args)];
                                case 7:
                                    result = _d.sent();
                                    return [3 /*break*/, 11];
                                case 8:
                                    error_2 = _d.sent();
                                    if (prop !== "sessionDelete" ||
                                        !isActiveSessionDeleteRefusal(error_2))
                                        throw error_2;
                                    return [4 /*yield*/, replaceActiveSessionForDelete(owner, sessionID)];
                                case 9:
                                    _d.sent();
                                    return [4 /*yield*/, fn.apply(owner.client, args)];
                                case 10:
                                    result = _d.sent();
                                    return [3 /*break*/, 11];
                                case 11:
                                    manager.invalidateSessionCache(owner.workspaceID);
                                    if (!(prop === "sessionAttach" &&
                                        result &&
                                        typeof result === "object" &&
                                        "sessionID" in result &&
                                        typeof result.sessionID === "string")) return [3 /*break*/, 13];
                                    return [4 /*yield*/, manager.workspaceSessionSet(owner.workspaceID, result.sessionID)];
                                case 12:
                                    _d.sent();
                                    _d.label = 13;
                                case 13:
                                    if (result &&
                                        typeof result === "object" &&
                                        "id" in result &&
                                        "title" in result &&
                                        !("workspaceID" in result)) {
                                        return [2 /*return*/, decorateSession(result, owner)];
                                    }
                                    return [2 /*return*/, result];
                            }
                        });
                    });
                };
            }
            if (prop === "sessionNew") {
                return function (input) { return __awaiter(_this, void 0, void 0, function () {
                    var workspaceID, owner, fn, result;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0:
                                workspaceID = input === null || input === void 0 ? void 0 : input.workspaceID;
                                owner = workspaceID
                                    ? manager.get(workspaceID)
                                    : manager.getActive();
                                if (!owner)
                                    return [2 /*return*/, undefined];
                                fn = owner.client[prop];
                                if (typeof fn !== "function")
                                    return [2 /*return*/, undefined];
                                startWorkspaceClient(owner);
                                return [4 /*yield*/, fn.apply(owner.client, [input])];
                            case 1:
                                result = _a.sent();
                                manager.invalidateSessionCache(owner.workspaceID);
                                return [2 /*return*/, result];
                        }
                    });
                }); };
            }
            if (prop === "naviChat" || prop === "niaChat") {
                var stream_1 = prop;
                var sessionForMethod_1 = function (method, args) {
                    if (method === "submit" || method === "messagesPage") {
                        var first = args[0];
                        return first && typeof first === "object"
                            ? first.sessionID
                            : undefined;
                    }
                    if (method === "rollback" || method === "setModelProfile")
                        return typeof args[1] === "string" ? args[1] : undefined;
                    return typeof args[0] === "string" ? args[0] : undefined;
                };
                var surface = {};
                var _loop_2 = function (method) {
                    surface[method] = function () {
                        var args = [];
                        for (var _i = 0; _i < arguments.length; _i++) {
                            args[_i] = arguments[_i];
                        }
                        return __awaiter(_this, void 0, void 0, function () {
                            var sessionID, owner, _a, target, fn, _b;
                            var _c;
                            return __generator(this, function (_d) {
                                switch (_d.label) {
                                    case 0:
                                        sessionID = sessionForMethod_1(method, args);
                                        if (!sessionID) return [3 /*break*/, 2];
                                        return [4 /*yield*/, manager.findWorkspaceForSession(sessionID)];
                                    case 1:
                                        _a = ((_c = (_d.sent())) !== null && _c !== void 0 ? _c : manager.getActive());
                                        return [3 /*break*/, 3];
                                    case 2:
                                        _a = manager.getActive();
                                        _d.label = 3;
                                    case 3:
                                        owner = _a;
                                        if (!owner)
                                            return [2 /*return*/, undefined];
                                        startWorkspaceClient(owner);
                                        target = owner.client[stream_1];
                                        fn = target === null || target === void 0 ? void 0 : target[method];
                                        if (!(typeof fn === "function")) return [3 /*break*/, 5];
                                        return [4 /*yield*/, fn.apply(target, args)];
                                    case 4:
                                        _b = _d.sent();
                                        return [3 /*break*/, 6];
                                    case 5:
                                        _b = undefined;
                                        _d.label = 6;
                                    case 6: return [2 /*return*/, _b];
                                }
                            });
                        });
                    };
                };
                for (var _i = 0, _a = [
                    "submit",
                    "abort",
                    "messages",
                    "messagesPage",
                    "rollback",
                    "modelProfile",
                    "setModelProfile",
                ]; _i < _a.length; _i++) {
                    var method = _a[_i];
                    _loop_2(method);
                }
                return surface;
            }
            if (typeof prop === "string" && routableMethods.has(prop)) {
                return function () {
                    var args = [];
                    for (var _i = 0; _i < arguments.length; _i++) {
                        args[_i] = arguments[_i];
                    }
                    return __awaiter(_this, void 0, void 0, function () {
                        var owner, fn, result;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0: return [4 /*yield*/, resolveRoutedWorkspace(prop, args)];
                                case 1:
                                    owner = _a.sent();
                                    if (!owner) {
                                        if (prop.startsWith("nativeTerminal"))
                                            throw new Error("no active workspace: open or activate a workspace before using the terminal");
                                        return [2 /*return*/, undefined];
                                    }
                                    fn = owner.client[prop];
                                    if (typeof fn !== "function")
                                        return [2 /*return*/, undefined];
                                    startWorkspaceClient(owner);
                                    return [4 /*yield*/, fn.apply(owner.client, args)];
                                case 2:
                                    result = _a.sent();
                                    if (prop === "planDocActivate" || prop === "planDocDeactivate")
                                        manager.invalidateSessionCache(owner.workspaceID);
                                    return [2 /*return*/, result];
                            }
                        });
                    });
                };
            }
            if (prop in manager) {
                var value_1 = manager[prop];
                return typeof value_1 === "function" ? value_1.bind(manager) : value_1;
            }
            var active = manager.getActive();
            if (!active) {
                if (typeof prop === "string" &&
                    (prop.startsWith("nativeTerminal") ||
                        prop === "subscribeTerminalOutput")) {
                    var unavailable_1 = function () {
                        throw new Error("no active workspace: open or activate a workspace before using the terminal");
                    };
                    return prop === "subscribeTerminalOutput"
                        ? unavailable_1
                        : function () { return __awaiter(_this, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/, unavailable_1()];
                        }); }); };
                }
                return undefined;
            }
            var value = active.client[prop];
            return typeof value === "function" ? value.bind(active.client) : value;
        },
    };
    return new Proxy({}, handler);
}
