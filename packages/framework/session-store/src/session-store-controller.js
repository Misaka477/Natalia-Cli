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
exports.createSessionStoreController = createSessionStoreController;
var node_crypto_1 = require("node:crypto");
var promises_1 = require("node:fs/promises");
var node_path_1 = require("node:path");
var session_1 = require("@anthelia/session");
var session_load_worker_client_1 = require("./session-load-worker-client");
var runtime_services_1 = require("@natalia/runtime-services");
var platform_1 = require("@natalia/platform");
/**
 * Shared SQLite handles are refcounted by database path: several runtimes in
 * one process (TUI worker, CLI, tests) may open the same `.natalia/sessions.db`,
 * and the last one to close releases the handle.
 */
var sqliteStores = new Map();
var sqliteStoreUsers = new Map();
function retainSqliteStore(path, store) {
    var _a;
    sqliteStores.set(path, store);
    sqliteStoreUsers.set(path, ((_a = sqliteStoreUsers.get(path)) !== null && _a !== void 0 ? _a : 0) + 1);
}
function releaseSqliteStore(path) {
    var _a;
    var remaining = ((_a = sqliteStoreUsers.get(path)) !== null && _a !== void 0 ? _a : 1) - 1;
    if (remaining > 0) {
        sqliteStoreUsers.set(path, remaining);
        return;
    }
    sqliteStoreUsers.delete(path);
    var store = sqliteStores.get(path);
    sqliteStores.delete(path);
    if (store)
        void store.close();
}
/**
 * The pending-human-terminal metadata as a typed value, or undefined. SQLite
 * rows carry metadata as a loose record, so the shape is checked before it is
 * projected into the public summary.
 */
function pendingHumanTerminalOf(metadata) {
    var pending = metadata.pendingHumanTerminal;
    if (!pending ||
        typeof pending !== "object" ||
        typeof pending.terminalID !== "string" ||
        typeof pending.reason !== "string" ||
        typeof pending.since !== "string")
        return undefined;
    return pending;
}
/**
 * The session store resource controller — the first cut of the session /
 * recovery split (mainline plan §15, knife 5). It owns the store selection
 * (JSON files vs the shared SQLite handle), the session-management surface
 * (list/touch/rename/pin/duplicate/fork/delete/new/archive/export) and the
 * summary projections. The journal-recovery flow (inbox promotion, context
 * rebuild, publish) stays in the runtime — it is coupled to the turn
 * machinery, not to the store.
 *
 * Multi-session shape (plan §41.9): `sessionID()` is an accessor, and every
 * read here is by id; nothing captures "the current session".
 */
function createSessionStoreController(input) {
    var sessionStore;
    var sqliteStore;
    var sqliteStorePath;
    var initialized = false;
    var messagePageCache = new Map();
    var messagePagePromises = new Map();
    var messagePageVersions = new Map();
    function invalidateMessagePage(id) {
        var _a;
        messagePageVersions.set(id, ((_a = messagePageVersions.get(id)) !== null && _a !== void 0 ? _a : 0) + 1);
        messagePageCache.delete(id);
        messagePagePromises.delete(id);
    }
    function init() {
        return __awaiter(this, void 0, void 0, function () {
            var databasePath, sqliteHasSessions, _i, _a, legacy, startup, _b, _c, sessionID;
            var _d, _e, _f;
            return __generator(this, function (_g) {
                switch (_g.label) {
                    case 0:
                        // §1.6: the journal lives outside the workspace like the checkpoint
                        // store does; an explicit sessionDir is the portable opt-in. The
                        // resolvers read a legacy workspace-local journal until the startup
                        // migration has moved it, and degrade to workspace-local when the home
                        // is unwritable — same rules as every other store root.
                        sessionStore = new session_1.JsonSessionStore((_d = input.sessionDir) !== null && _d !== void 0 ? _d : (0, platform_1.resolveWorkspaceJsonSessionsDir)(input.workspaceRoot));
                        if (!input.useSqliteStore) return [3 /*break*/, 12];
                        databasePath = (0, platform_1.resolveWorkspaceJournalDatabasePath)(input.workspaceRoot);
                        return [4 /*yield*/, (0, promises_1.mkdir)((0, node_path_1.dirname)(databasePath), { recursive: true })];
                    case 1:
                        _g.sent();
                        sqliteStore = sqliteStores.get(databasePath);
                        if (!sqliteStore)
                            sqliteStore = new session_1.SqliteSessionStore(databasePath);
                        retainSqliteStore(databasePath, sqliteStore);
                        sqliteStorePath = databasePath;
                        sqliteHasSessions = sqliteStore.list().length > 0;
                        _i = 0;
                        return [4 /*yield*/, sessionStore.list()];
                    case 2:
                        _a = _g.sent();
                        _g.label = 3;
                    case 3:
                        if (!(_i < _a.length)) return [3 /*break*/, 11];
                        legacy = _a[_i];
                        if (!sqliteStore.wasDeleted(legacy.id)) return [3 /*break*/, 5];
                        return [4 /*yield*/, sessionStore.delete(legacy.id)];
                    case 4:
                        _g.sent();
                        return [3 /*break*/, 10];
                    case 5:
                        if (!!sqliteStore.get(legacy.id)) return [3 /*break*/, 8];
                        if (!sqliteHasSessions) return [3 /*break*/, 7];
                        sqliteStore.markDeleted(legacy.id);
                        return [4 /*yield*/, sessionStore.delete(legacy.id)];
                    case 6:
                        _g.sent();
                        return [3 /*break*/, 10];
                    case 7:
                        sqliteStore.replace(legacy);
                        _g.label = 8;
                    case 8: return [4 /*yield*/, sessionStore.delete(legacy.id)];
                    case 9:
                        _g.sent();
                        _g.label = 10;
                    case 10:
                        _i++;
                        return [3 /*break*/, 3];
                    case 11:
                        startup = (_e = sqliteStore.get(input.sessionID())) !== null && _e !== void 0 ? _e : sqliteStore.create(input.sessionID(), (_f = input.title) !== null && _f !== void 0 ? _f : "New session");
                        if (input.title && !startup.metadata.titleSource)
                            sqliteStore.updateMetadata(input.sessionID(), {
                                titleSource: "manual",
                            });
                        if (process.env.NATALIA_DISABLE_EVENT_COMPACTION !== "1") {
                            for (_b = 0, _c = sqliteStore.compactHistoricalEvents(); _b < _c.length; _b++) {
                                sessionID = _c[_b];
                                invalidateMessagePage(sessionID);
                            }
                            sqliteStore.checkpoint();
                        }
                        _g.label = 12;
                    case 12:
                        initialized = true;
                        return [2 /*return*/];
                }
            });
        });
    }
    function status() {
        return {
            initialized: initialized,
            mode: input.useSqliteStore ? "sqlite" : "json",
        };
    }
    function summary(record) {
        var _a, _b, _c, _d, _e, _f, _g, _h;
        return __assign(__assign({ id: record.id, title: record.title, createdAt: record.createdAt, lastAccessedAt: (_a = record.metadata) === null || _a === void 0 ? void 0 : _a.lastAccessedAt, pinned: Boolean((_b = record.metadata) === null || _b === void 0 ? void 0 : _b.pinned), archived: Boolean((_c = record.metadata) === null || _c === void 0 ? void 0 : _c.archived), events: record.events.length, pendingInputs: (_e = (_d = record.inbox) === null || _d === void 0 ? void 0 : _d.filter(function (input) { return !input.promotedAt; }).length) !== null && _e !== void 0 ? _e : 0, cancelled: record.cancelled, resumable: record.resumable }, (typeof ((_f = record.metadata) === null || _f === void 0 ? void 0 : _f.activePlanID) === "string"
            ? { activePlanID: record.metadata.activePlanID }
            : {})), (pendingHumanTerminalOf((_g = record.metadata) !== null && _g !== void 0 ? _g : {})
            ? {
                pendingHumanTerminal: pendingHumanTerminalOf((_h = record.metadata) !== null && _h !== void 0 ? _h : {}),
            }
            : {}));
    }
    function sqliteSummary(record, store) {
        return __assign(__assign({ id: record.id, title: record.title, createdAt: record.createdAt, lastAccessedAt: record.metadata.lastAccessedAt, pinned: record.pinned, archived: Boolean(record.metadata.archived), events: store.eventCount(record.id), pendingInputs: 0, cancelled: record.cancelled, resumable: record.resumable }, (typeof record.metadata.activePlanID === "string"
            ? { activePlanID: record.metadata.activePlanID }
            : {})), (pendingHumanTerminalOf(record.metadata)
            ? { pendingHumanTerminal: pendingHumanTerminalOf(record.metadata) }
            : {}));
    }
    function byID(id) {
        return __awaiter(this, void 0, void 0, function () {
            var record;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, sessionStore.load(id)];
                    case 1:
                        record = _a.sent();
                        if (!record)
                            throw new Error("session not found: ".concat(id));
                        return [2 /*return*/, record];
                }
            });
        });
    }
    function byIDOptional(id) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, sessionStore.load(id)];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    }
    function load(id_1) {
        return __awaiter(this, arguments, void 0, function (id, options) {
            var loadStart, mark, store, legacy, _a, durable, contextEpoch, indexedRecovery, events, inbox, recovery;
            var _b, _c, _d;
            if (options === void 0) { options = {}; }
            return __generator(this, function (_e) {
                switch (_e.label) {
                    case 0:
                        loadStart = performance.now();
                        mark = function (name) {
                            return (0, runtime_services_1.perfLog)("[perf] sessionStore.load.".concat(name, " id=").concat(id, " +").concat((performance.now() - loadStart).toFixed(1), "ms"));
                        };
                        (0, runtime_services_1.perfLog)("[perf] sessionStore.load start id=".concat(id));
                        store = sqliteStore;
                        if (!(options.create && !store)) return [3 /*break*/, 2];
                        return [4 /*yield*/, sessionStore.loadOrCreate(id, (_b = options.title) !== null && _b !== void 0 ? _b : "New session")];
                    case 1:
                        _a = _e.sent();
                        return [3 /*break*/, 4];
                    case 2: return [4 /*yield*/, sessionStore.load(id)];
                    case 3:
                        _a = _e.sent();
                        _e.label = 4;
                    case 4:
                        legacy = _a;
                        if (!store) {
                            if (!legacy)
                                throw new Error("session not found: ".concat(id));
                            mark("jsonStore");
                            return [2 /*return*/, { session: legacy }];
                        }
                        durable = store.get(id);
                        if (!durable && legacy) {
                            store.replace(legacy);
                            durable = store.get(id);
                        }
                        if (!durable)
                            throw new Error("session not found: ".concat(id));
                        mark("get");
                        contextEpoch = store.loadContextEpoch(id);
                        mark("contextEpoch");
                        indexedRecovery = options.indexedRecovery && Boolean(contextEpoch);
                        events = indexedRecovery
                            ? []
                            : options.runtimeEvents
                                ? store.loadRuntimeEvents(id, {
                                    excludeContextCheckpoint: Boolean(contextEpoch),
                                })
                                : store.loadEvents(id);
                        mark("events");
                        if (!events.length &&
                            !indexedRecovery &&
                            !options.runtimeEvents &&
                            (legacy === null || legacy === void 0 ? void 0 : legacy.events.length)) {
                            store.replace(legacy);
                            durable = store.get(id);
                            events = store.loadEvents(id);
                            mark("eventsReplace");
                        }
                        inbox = store.loadInbox(id);
                        mark("inbox");
                        recovery = indexedRecovery
                            ? store.loadRecoveryProjection(id)
                            : undefined;
                        if (recovery)
                            mark("recoveryProjection");
                        return [2 /*return*/, __assign({ session: __assign(__assign({}, (legacy !== null && legacy !== void 0 ? legacy : (0, session_1.createSessionRecord)(id, (_c = options.title) !== null && _c !== void 0 ? _c : "New session"))), { title: durable.title, createdAt: durable.createdAt, cancelled: durable.cancelled, resumable: durable.resumable, metadata: durable.metadata, events: events.length ? events : ((_d = legacy === null || legacy === void 0 ? void 0 : legacy.events) !== null && _d !== void 0 ? _d : []), inbox: inbox.length ? inbox : legacy === null || legacy === void 0 ? void 0 : legacy.inbox }), contextEpoch: contextEpoch }, (recovery ? { recovery: recovery } : {}))];
                }
            });
        });
    }
    function saveInbox(session) {
        return __awaiter(this, void 0, void 0, function () {
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (!sqliteStore) return [3 /*break*/, 1];
                        sqliteStore.replaceInbox(session.id, (_a = session.inbox) !== null && _a !== void 0 ? _a : []);
                        return [3 /*break*/, 3];
                    case 1: return [4 /*yield*/, sessionStore.save(session)];
                    case 2:
                        _b.sent();
                        _b.label = 3;
                    case 3: return [2 /*return*/];
                }
            });
        });
    }
    function loadRecoveryProjection(id) {
        return sqliteStore === null || sqliteStore === void 0 ? void 0 : sqliteStore.loadRecoveryProjection(id);
    }
    function appendEvent(session, event) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        invalidateMessagePage(session.id);
                        if (!sqliteStore) return [3 /*break*/, 1];
                        // Queue the event and let the SQLite store flush in batches (20ms or
                        // 100 events). Awaiting a flush per event makes initialization spend
                        // seconds writing hundreds of synthetic capability/tool events one by
                        // one; batching is safe because the store still flushes before dispose
                        // and on durable barriers.
                        sqliteStore.enqueueEvent(session.id, event);
                        return [3 /*break*/, 3];
                    case 1: return [4 /*yield*/, sessionStore.save(session)];
                    case 2:
                        _a.sent();
                        _a.label = 3;
                    case 3: return [2 /*return*/];
                }
            });
        });
    }
    function appendEvents(session, events) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        invalidateMessagePage(session.id);
                        if (!sqliteStore) return [3 /*break*/, 1];
                        sqliteStore.appendEvents(session.id, events);
                        return [3 /*break*/, 3];
                    case 1: return [4 /*yield*/, sessionStore.save(session)];
                    case 2:
                        _a.sent();
                        _a.label = 3;
                    case 3: return [2 /*return*/];
                }
            });
        });
    }
    function updateMetadata(session, partial) {
        return __awaiter(this, void 0, void 0, function () {
            var id;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        id = typeof session === "string" ? session : session.id;
                        if (!sqliteStore) return [3 /*break*/, 1];
                        sqliteStore.updateMetadata(id, partial);
                        return [3 /*break*/, 3];
                    case 1: return [4 /*yield*/, sessionStore.updateMetadata(id, partial)];
                    case 2:
                        _a.sent();
                        _a.label = 3;
                    case 3: return [2 /*return*/];
                }
            });
        });
    }
    function contextEventsAfter(id, epoch) {
        return epoch && sqliteStore
            ? sqliteStore.loadEventsAfter(id, epoch.baselineSeq)
            : undefined;
    }
    function eventsAfter(id, after) {
        return sqliteStore ? sqliteStore.loadEventsAfter(id, after) : [];
    }
    function saveProjectionCheckpoint(id, serializedState) {
        if (!sqliteStore)
            return 0;
        var state = (0, session_1.deserializeProjectionState)(serializedState);
        if (!state)
            return 0;
        return sqliteStore.saveProjectionCheckpoint(id, state);
    }
    function loadProjectionCheckpoint(id) {
        if (!sqliteStore)
            return undefined;
        var loaded = sqliteStore.loadProjectionCheckpoint(id);
        if (!loaded)
            return undefined;
        return {
            serializedState: (0, session_1.serializeProjectionState)(loaded.state),
            lastSeq: loaded.lastSeq,
        };
    }
    function writeContextEpoch(id, snapshot) {
        if (sqliteStore)
            sqliteStore.writeContextEpoch(id, snapshot);
    }
    function ensureMessageIndex(id) {
        if (sqliteStore)
            sqliteStore.ensureMessageIndex(id);
    }
    function ensureMessageIndexAsync(id) {
        return __awaiter(this, void 0, void 0, function () {
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (!sqliteStore)
                            return [2 /*return*/];
                        if (!sqliteStorePath) return [3 /*break*/, 4];
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, (0, session_load_worker_client_1.ensureMessageIndexInWorker)(sqliteStorePath, id)];
                    case 2:
                        _b.sent();
                        return [2 /*return*/];
                    case 3:
                        _a = _b.sent();
                        return [3 /*break*/, 4];
                    case 4:
                        sqliteStore.ensureMessageIndex(id);
                        return [2 /*return*/];
                }
            });
        });
    }
    function prewarmMessagePage(id) {
        var _this = this;
        var _a;
        if (!sqliteStore)
            return Promise.resolve();
        var existing = messagePagePromises.get(id);
        if (existing)
            return existing;
        var version = (_a = messagePageVersions.get(id)) !== null && _a !== void 0 ? _a : 0;
        var promise = (function () { return __awaiter(_this, void 0, void 0, function () {
            var page, _a, _b;
            var _c;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        _d.trys.push([0, 4, , 5]);
                        if (!sqliteStorePath) return [3 /*break*/, 2];
                        return [4 /*yield*/, (0, session_load_worker_client_1.loadMessagePageInWorker)(sqliteStorePath, id, {
                                limit: 100,
                                order: "desc",
                            })];
                    case 1:
                        _a = _d.sent();
                        return [3 /*break*/, 3];
                    case 2:
                        _a = sqliteStore.loadMessagePage(id, { limit: 100, order: "desc" });
                        _d.label = 3;
                    case 3:
                        page = _a;
                        // Only store the result if no rollback/append invalidated this
                        // session while the background prewarm was in flight.
                        if (((_c = messagePageVersions.get(id)) !== null && _c !== void 0 ? _c : 0) === version) {
                            messagePageCache.set(id, page);
                        }
                        return [3 /*break*/, 5];
                    case 4:
                        _b = _d.sent();
                        return [3 /*break*/, 5];
                    case 5: return [2 /*return*/];
                }
            });
        }); })().finally(function () {
            var _a;
            if (((_a = messagePageVersions.get(id)) !== null && _a !== void 0 ? _a : 0) === version) {
                messagePagePromises.delete(id);
            }
        });
        messagePagePromises.set(id, promise);
        return promise;
    }
    function loadFullAsync(id_1) {
        return __awaiter(this, arguments, void 0, function (id, loadOptions) {
            var record, durable, events, _a, inbox;
            if (loadOptions === void 0) { loadOptions = {}; }
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (!!sqliteStore) return [3 /*break*/, 2];
                        return [4 /*yield*/, sessionStore.load(id)];
                    case 1:
                        record = _b.sent();
                        if (!record)
                            throw new Error("session not found: ".concat(id));
                        return [2 /*return*/, record];
                    case 2:
                        durable = sqliteStore.get(id);
                        if (!durable)
                            throw new Error("session not found: ".concat(id));
                        if (!loadOptions.runtimeEvents) return [3 /*break*/, 4];
                        return [4 /*yield*/, sqliteStore.loadRuntimeEventsAsync(id, {
                                excludeContextCheckpoint: Boolean(sqliteStore.loadContextEpoch(id)),
                            })];
                    case 3:
                        events = _b.sent();
                        return [3 /*break*/, 12];
                    case 4:
                        if (!sqliteStorePath) return [3 /*break*/, 10];
                        _b.label = 5;
                    case 5:
                        _b.trys.push([5, 7, , 9]);
                        return [4 /*yield*/, (0, session_load_worker_client_1.loadSessionEventsInWorker)(sqliteStorePath, id)];
                    case 6:
                        events = _b.sent();
                        return [3 /*break*/, 9];
                    case 7:
                        _a = _b.sent();
                        return [4 /*yield*/, sqliteStore.loadEventsAsync(id)];
                    case 8:
                        events = _b.sent();
                        return [3 /*break*/, 9];
                    case 9: return [3 /*break*/, 12];
                    case 10: return [4 /*yield*/, sqliteStore.loadEventsAsync(id)];
                    case 11:
                        events = _b.sent();
                        _b.label = 12;
                    case 12:
                        inbox = sqliteStore.loadInbox(id);
                        return [2 /*return*/, __assign({ id: id, title: durable.title, createdAt: durable.createdAt, cancelled: durable.cancelled, resumable: durable.resumable, metadata: durable.metadata, events: events }, (inbox.length ? { inbox: inbox } : {}))];
                }
            });
        });
    }
    function referencedAttachments() {
        return __awaiter(this, void 0, void 0, function () {
            var _a, _b, _c;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        if (!sqliteStore) return [3 /*break*/, 1];
                        _a = sqliteStore.referencedAttachments();
                        return [3 /*break*/, 3];
                    case 1:
                        _c = (_b = input.attachments).referencedForSessions;
                        return [4 /*yield*/, sessionStore.list()];
                    case 2:
                        _a = _c.apply(_b, [_d.sent()]);
                        _d.label = 3;
                    case 3: return [2 /*return*/, _a];
                }
            });
        });
    }
    function eventCount(id) {
        return __awaiter(this, void 0, void 0, function () {
            var record;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (sqliteStore)
                            return [2 /*return*/, sqliteStore.eventCount(id)];
                        return [4 /*yield*/, sessionStore.load(id)];
                    case 1:
                        record = _b.sent();
                        return [2 /*return*/, (_a = record === null || record === void 0 ? void 0 : record.events.length) !== null && _a !== void 0 ? _a : 0];
                }
            });
        });
    }
    function history(id_1, fallback_1) {
        return __awaiter(this, arguments, void 0, function (id, fallback, options) {
            var record, source, after, offset, start, limit, page;
            var _a, _b, _c, _d;
            if (options === void 0) { options = {}; }
            return __generator(this, function (_e) {
                switch (_e.label) {
                    case 0:
                        if (sqliteStore)
                            return [2 /*return*/, sqliteStore.loadEventPage(id, options)];
                        return [4 /*yield*/, sessionStore.load(id)];
                    case 1:
                        record = _e.sent();
                        source = (_a = record === null || record === void 0 ? void 0 : record.events) !== null && _a !== void 0 ? _a : fallback;
                        after = Math.max(0, (_b = options.after) !== null && _b !== void 0 ? _b : 0);
                        offset = Math.max(0, (_c = options.offset) !== null && _c !== void 0 ? _c : 0);
                        start = options.offset === undefined ? after : offset;
                        limit = Math.min(2000, Math.max(1, (_d = options.limit) !== null && _d !== void 0 ? _d : 100));
                        page = source.slice(start, start + limit + 1);
                        return [2 /*return*/, {
                                events: page.slice(0, limit).map(function (event, index) { return ({
                                    seq: start + index + 1,
                                    sessionSeq: start + index + 1,
                                    event: event,
                                }); }),
                                hasMore: page.length > limit,
                            }];
                }
            });
        });
    }
    function eventWindow(id_1, fallback_1) {
        return __awaiter(this, arguments, void 0, function (id, fallback, options) {
            var record, source, limit, end, start, events;
            var _a, _b;
            if (options === void 0) { options = {}; }
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        if (sqliteStore)
                            return [2 /*return*/, sqliteStore.loadEventWindow(id, options)];
                        return [4 /*yield*/, sessionStore.load(id)];
                    case 1:
                        record = _c.sent();
                        source = (_a = record === null || record === void 0 ? void 0 : record.events) !== null && _a !== void 0 ? _a : fallback;
                        limit = Math.min(2000, Math.max(1, (_b = options.limit) !== null && _b !== void 0 ? _b : 100));
                        end = options.beforeSeq === undefined
                            ? source.length
                            : Math.min(source.length, Math.max(0, options.beforeSeq - 1));
                        start = Math.max(0, end - limit);
                        events = source.slice(start, end).map(function (event, index) { return ({
                            seq: start + index + 1,
                            sessionSeq: start + index + 1,
                            event: event,
                        }); });
                        return [2 /*return*/, { events: events, hasMore: start > 0 }];
                }
            });
        });
    }
    function messages(id_1, fallback_1) {
        return __awaiter(this, arguments, void 0, function (id, fallback, options) {
            var cached, pending, warmed, _a, projectSessionMessagesInWorker, _b;
            if (options === void 0) { options = {}; }
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        if (!sqliteStore) return [3 /*break*/, 7];
                        if (!(!options.cursor && !options.order && options.limit === 100)) return [3 /*break*/, 2];
                        cached = messagePageCache.get(id);
                        if (cached)
                            return [2 /*return*/, cached];
                        pending = messagePagePromises.get(id);
                        if (!pending) return [3 /*break*/, 2];
                        return [4 /*yield*/, pending];
                    case 1:
                        _c.sent();
                        warmed = messagePageCache.get(id);
                        if (warmed)
                            return [2 /*return*/, warmed];
                        _c.label = 2;
                    case 2:
                        if (!sqliteStorePath) return [3 /*break*/, 6];
                        _c.label = 3;
                    case 3:
                        _c.trys.push([3, 5, , 6]);
                        return [4 /*yield*/, (0, session_load_worker_client_1.loadMessagePageInWorker)(sqliteStorePath, id, options)];
                    case 4: return [2 /*return*/, _c.sent()];
                    case 5:
                        _a = _c.sent();
                        return [3 /*break*/, 6];
                    case 6: return [2 /*return*/, sqliteStore.loadMessagePage(id, options)];
                    case 7:
                        _c.trys.push([7, 10, , 11]);
                        return [4 /*yield*/, Promise.resolve().then(function () { return require("./session-messages-worker-client"); })];
                    case 8:
                        projectSessionMessagesInWorker = (_c.sent()).projectSessionMessagesInWorker;
                        return [4 /*yield*/, projectSessionMessagesInWorker(fallback, options)];
                    case 9: return [2 /*return*/, _c.sent()];
                    case 10:
                        _b = _c.sent();
                        return [2 /*return*/, (0, session_1.projectSessionMessages)(fallback, options)];
                    case 11: return [2 /*return*/];
                }
            });
        });
    }
    function flush(id) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (sqliteStore === null || sqliteStore === void 0 ? void 0 : sqliteStore.flushPendingWrites(id))];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    }
    // --- session management surface ---
    function list() {
        return __awaiter(this, void 0, void 0, function () {
            var store;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        store = sqliteStore;
                        if (store)
                            return [2 /*return*/, store.list().map(function (record) { return (__assign(__assign({ id: record.id, title: record.title, createdAt: record.createdAt, lastAccessedAt: record.metadata.lastAccessedAt, pinned: record.pinned, events: store.eventCount(record.id), pendingInputs: store.pendingInputCount(record.id), cancelled: record.cancelled, resumable: record.resumable, archived: Boolean(record.metadata.archived) }, (typeof record.metadata.activePlanID === "string"
                                    ? { activePlanID: record.metadata.activePlanID }
                                    : {})), (pendingHumanTerminalOf(record.metadata)
                                    ? { pendingHumanTerminal: pendingHumanTerminalOf(record.metadata) }
                                    : {}))); })];
                        return [4 /*yield*/, sessionStore.list()];
                    case 1: return [2 /*return*/, (_a.sent()).map(summary)];
                }
            });
        });
    }
    function touch(id) {
        return __awaiter(this, void 0, void 0, function () {
            var store;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        store = sqliteStore;
                        if (store) {
                            store.touch(id);
                            return [2 /*return*/];
                        }
                        return [4 /*yield*/, sessionStore.updateMetadata(id, {
                                lastAccessedAt: new Date().toISOString(),
                            })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    }
    function rename(id, title) {
        return __awaiter(this, void 0, void 0, function () {
            var store, session;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        store = sqliteStore;
                        if (store)
                            return [2 /*return*/, sqliteSummary(store.rename(id, title), store)];
                        return [4 /*yield*/, sessionStore.rename(id, title)];
                    case 1:
                        session = _a.sent();
                        return [2 /*return*/, summary(session)];
                }
            });
        });
    }
    function pin(id, pinned) {
        return __awaiter(this, void 0, void 0, function () {
            var store, session;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        store = sqliteStore;
                        if (store)
                            return [2 /*return*/, sqliteSummary(store.pin(id, pinned), store)];
                        return [4 /*yield*/, sessionStore.updateMetadata(id, {
                                pinned: pinned,
                            })];
                    case 1:
                        session = _a.sent();
                        return [2 /*return*/, summary(session)];
                }
            });
        });
    }
    function duplicate(id, title) {
        return __awaiter(this, void 0, void 0, function () {
            var store, session;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        store = sqliteStore;
                        if (store)
                            return [2 /*return*/, summary(store.duplicate(id, undefined, title))];
                        return [4 /*yield*/, sessionStore.duplicate(id, undefined, title)];
                    case 1:
                        session = _a.sent();
                        return [2 /*return*/, summary(session)];
                }
            });
        });
    }
    function fork(id, turnID, title) {
        return __awaiter(this, void 0, void 0, function () {
            var store, session;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        store = sqliteStore;
                        if (store)
                            return [2 /*return*/, summary(store.fork(id, turnID, undefined, title))];
                        return [4 /*yield*/, sessionStore.fork(id, turnID, undefined, title)];
                    case 1:
                        session = _a.sent();
                        return [2 /*return*/, summary(session)];
                }
            });
        });
    }
    function del(id) {
        return __awaiter(this, void 0, void 0, function () {
            var store, durable, legacy, removedAttachments_1, _a, _b, _c, _d, _e, removedAttachments, _f, _g, _h, _j;
            return __generator(this, function (_k) {
                switch (_k.label) {
                    case 0:
                        if (id === input.sessionID())
                            throw new Error("cannot delete the active runtime session");
                        store = sqliteStore;
                        if (!store) return [3 /*break*/, 7];
                        durable = store.get(id);
                        return [4 /*yield*/, sessionStore.load(id)];
                    case 1:
                        legacy = _k.sent();
                        if (!durable && !legacy)
                            throw new Error("session not found: ".concat(id));
                        if (durable)
                            store.delete(id);
                        return [4 /*yield*/, sessionStore.delete(id)];
                    case 2:
                        _k.sent();
                        _b = (_a = input.attachments).cleanup;
                        if (!durable) return [3 /*break*/, 3];
                        _c = store.referencedAttachments();
                        return [3 /*break*/, 5];
                    case 3:
                        _e = (_d = input.attachments).referencedForSessions;
                        return [4 /*yield*/, sessionStore.list()];
                    case 4:
                        _c = _e.apply(_d, [_k.sent()]);
                        _k.label = 5;
                    case 5: return [4 /*yield*/, _b.apply(_a, [_c])];
                    case 6:
                        removedAttachments_1 = _k.sent();
                        return [2 /*return*/, { id: id, removedAttachments: removedAttachments_1.length }];
                    case 7: return [4 /*yield*/, byID(id)];
                    case 8:
                        _k.sent();
                        return [4 /*yield*/, sessionStore.delete(id)];
                    case 9:
                        _k.sent();
                        _g = (_f = input.attachments).cleanup;
                        _j = (_h = input.attachments).referencedForSessions;
                        return [4 /*yield*/, sessionStore.list()];
                    case 10: return [4 /*yield*/, _g.apply(_f, [_j.apply(_h, [_k.sent()])])];
                    case 11:
                        removedAttachments = _k.sent();
                        return [2 /*return*/, { id: id, removedAttachments: removedAttachments.length }];
                }
            });
        });
    }
    function messageRollback(id, turnID) {
        return __awaiter(this, void 0, void 0, function () {
            var sessionID, store, startSeq, record, start;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        sessionID = id;
                        // The cached latest-100 message page is now stale after truncation.
                        invalidateMessagePage(sessionID);
                        store = sqliteStore;
                        if (store) {
                            startSeq = store.seqForTurnStart(id, turnID);
                            if (startSeq === undefined)
                                throw new Error("turn not found: ".concat(turnID));
                            // Removing this turn and everything after it. The new user submission
                            // becomes the new version of the selected turn.
                            store.truncateAfter(id, startSeq - 1);
                            return [2 /*return*/, { id: id, rolledBackTo: turnID }];
                        }
                        return [4 /*yield*/, byID(id)];
                    case 1:
                        record = _a.sent();
                        start = record.events.findIndex(function (event) { return event.type === "turn.submitted" && event.id === turnID; });
                        if (start < 0)
                            throw new Error("turn not found: ".concat(turnID));
                        // Keep only events before the selected turn.
                        record.events = record.events.slice(0, start);
                        return [4 /*yield*/, sessionStore.save(record)];
                    case 2:
                        _a.sent();
                        return [2 /*return*/, { id: id, rolledBackTo: turnID }];
                }
            });
        });
    }
    function create(input_) {
        return __awaiter(this, void 0, void 0, function () {
            var id, store, _a, record;
            var _b, _c;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        id = (_b = input_.id) !== null && _b !== void 0 ? _b : "ses_".concat((0, node_crypto_1.randomUUID)().replace(/-/gu, "").slice(0, 16));
                        store = sqliteStore;
                        if (store === null || store === void 0 ? void 0 : store.get(id))
                            return [2 /*return*/, { sessionID: id, created: false }];
                        _a = input_.id;
                        if (!_a) return [3 /*break*/, 2];
                        return [4 /*yield*/, byIDOptional(id)];
                    case 1:
                        _a = (_d.sent());
                        _d.label = 2;
                    case 2:
                        if (_a)
                            return [2 /*return*/, { sessionID: id, created: false }];
                        record = (0, session_1.createSessionRecord)(id, (_c = input_.title) !== null && _c !== void 0 ? _c : "New session");
                        record.metadata = { titleSource: input_.title ? "manual" : "fallback" };
                        if (store) {
                            store.create(record.id, record.title);
                            store.updateMetadata(record.id, record.metadata);
                            return [2 /*return*/, { sessionID: id, created: true }];
                        }
                        return [4 /*yield*/, sessionStore.save(record)];
                    case 3:
                        _d.sent();
                        return [2 /*return*/, { sessionID: id, created: true }];
                }
            });
        });
    }
    function setAutoTitle(id, title, source) {
        return __awaiter(this, void 0, void 0, function () {
            var store, _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        store = sqliteStore;
                        if (store)
                            return [2 /*return*/, sqliteSummary(store.setAutoTitle(id, title, source), store)];
                        _a = summary;
                        return [4 /*yield*/, sessionStore.setAutoTitle(id, title, source)];
                    case 1: return [2 /*return*/, _a.apply(void 0, [_b.sent()])];
                }
            });
        });
    }
    function archive(id) {
        return __awaiter(this, void 0, void 0, function () {
            var record;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, load(id)];
                    case 1:
                        record = (_b.sent()).session;
                        if ((_a = record.metadata) === null || _a === void 0 ? void 0 : _a.archived)
                            return [2 /*return*/, { id: id, archived: true }];
                        record.metadata = __assign(__assign({}, record.metadata), { archived: true });
                        return [4 /*yield*/, updateMetadata(record, { archived: true })];
                    case 2:
                        _b.sent();
                        return [2 /*return*/, { id: id, archived: true }];
                }
            });
        });
    }
    function restore(id) {
        return __awaiter(this, void 0, void 0, function () {
            var record;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, load(id)];
                    case 1:
                        record = (_b.sent()).session;
                        if (!((_a = record.metadata) === null || _a === void 0 ? void 0 : _a.archived))
                            return [2 /*return*/, { id: id, archived: false }];
                        record.metadata = __assign(__assign({}, record.metadata), { archived: false });
                        return [4 /*yield*/, updateMetadata(record, { archived: false })];
                    case 2:
                        _b.sent();
                        return [2 /*return*/, { id: id, archived: false }];
                }
            });
        });
    }
    function export_(id) {
        return __awaiter(this, void 0, void 0, function () {
            var record;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, load(id)];
                    case 1:
                        record = (_b.sent()).session;
                        return [2 /*return*/, {
                                sessionID: record.id,
                                title: record.title,
                                createdAt: record.createdAt,
                                archived: Boolean((_a = record.metadata) === null || _a === void 0 ? void 0 : _a.archived),
                                events: record.events.map(function (event, index) { return ({
                                    seq: index + 1,
                                    event: event,
                                }); }),
                            }];
                }
            });
        });
    }
    function close() {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                if (sqliteStorePath)
                    releaseSqliteStore(sqliteStorePath);
                sqliteStore = undefined;
                sqliteStorePath = undefined;
                initialized = false;
                return [2 /*return*/];
            });
        });
    }
    return {
        init: init,
        status: status,
        load: load,
        saveInbox: saveInbox,
        loadRecoveryProjection: loadRecoveryProjection,
        appendEvent: appendEvent,
        appendEvents: appendEvents,
        updateMetadata: updateMetadata,
        contextEventsAfter: contextEventsAfter,
        eventsAfter: eventsAfter,
        saveProjectionCheckpoint: saveProjectionCheckpoint,
        loadProjectionCheckpoint: loadProjectionCheckpoint,
        writeContextEpoch: writeContextEpoch,
        ensureMessageIndex: ensureMessageIndex,
        ensureMessageIndexAsync: ensureMessageIndexAsync,
        prewarmMessagePage: prewarmMessagePage,
        loadFullAsync: loadFullAsync,
        referencedAttachments: referencedAttachments,
        eventCount: eventCount,
        history: history,
        eventWindow: eventWindow,
        messages: messages,
        flush: flush,
        list: list,
        touch: touch,
        rename: rename,
        pin: pin,
        duplicate: duplicate,
        fork: fork,
        delete: del,
        create: create,
        messageRollback: messageRollback,
        setAutoTitle: setAutoTitle,
        archive: archive,
        restore: restore,
        export: export_,
        close: close,
    };
}
