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
exports.createLocalSessionService = createLocalSessionService;
var node_crypto_1 = require("node:crypto");
var node_fs_1 = require("node:fs");
var node_path_1 = require("node:path");
var attachments_1 = require("@anthelia/attachments");
var platform_1 = require("@natalia/platform");
var session_1 = require("@anthelia/session");
/** Offline session operations used when no runtime plugin host is running. */
function createLocalSessionService(workspaceRoot) {
    if (workspaceRoot === void 0) { workspaceRoot = process.cwd(); }
    var root = (0, node_path_1.resolve)(workspaceRoot);
    var json = function () {
        return new session_1.JsonSessionStore((0, platform_1.resolveWorkspaceJsonSessionsDir)(root));
    };
    var sqlite = function () {
        var path = (0, platform_1.resolveWorkspaceJournalDatabasePath)(root);
        return (0, node_fs_1.existsSync)(path) ? new session_1.SqliteSessionStore(path) : undefined;
    };
    return {
        list: function () {
            return __awaiter(this, arguments, void 0, function (options) {
                var jsonSessions, database, sqliteSessions, sqliteIDs, sessions;
                if (options === void 0) { options = {}; }
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, json().list()];
                        case 1:
                            jsonSessions = _a.sent();
                            database = options.useSqliteStore === false ? undefined : sqlite();
                            sqliteSessions = database
                                ? database.list().map(function (session) {
                                    return ({
                                        id: session.id,
                                        title: session.title,
                                        createdAt: session.createdAt,
                                        lastAccessedAt: session.metadata.lastAccessedAt,
                                        pinned: session.pinned,
                                        archived: Boolean(session.metadata.archived),
                                        events: database.eventCount(session.id),
                                        pendingInputs: database.pendingInputCount(session.id),
                                    });
                                })
                                : [];
                            database === null || database === void 0 ? void 0 : database.close();
                            sqliteIDs = new Set(sqliteSessions.map(function (session) { return session.id; }));
                            sessions = jsonSessions
                                .filter(function (session) {
                                // Match runtime migration: once SQLite is populated, missing JSON
                                // IDs are treated as deleted rather than resurrected on startup.
                                return options.useSqliteStore === true && sqliteIDs.size > 0
                                    ? false
                                    : !sqliteIDs.has(session.id);
                            })
                                .map(function (session) {
                                var _a, _b, _c, _d, _e;
                                return ({
                                    id: session.id,
                                    title: session.title,
                                    createdAt: session.createdAt,
                                    lastAccessedAt: (_a = session.metadata) === null || _a === void 0 ? void 0 : _a.lastAccessedAt,
                                    pinned: Boolean((_b = session.metadata) === null || _b === void 0 ? void 0 : _b.pinned),
                                    archived: Boolean((_c = session.metadata) === null || _c === void 0 ? void 0 : _c.archived),
                                    events: session.events.length,
                                    pendingInputs: (_e = (_d = session.inbox) === null || _d === void 0 ? void 0 : _d.filter(function (input) { return !input.promotedAt; }).length) !== null && _e !== void 0 ? _e : 0,
                                });
                            });
                            return [2 /*return*/, __spreadArray(__spreadArray([], sqliteSessions, true), sessions, true).sort(function (left, right) {
                                    if (left.pinned !== right.pinned)
                                        return left.pinned ? -1 : 1;
                                    return right.createdAt.localeCompare(left.createdAt);
                                })];
                    }
                });
            });
        },
        delete: function (id) {
            return __awaiter(this, void 0, void 0, function () {
                var store, attachments, removed, _a, _b, _c, _d;
                return __generator(this, function (_e) {
                    switch (_e.label) {
                        case 0:
                            store = json();
                            return [4 /*yield*/, store.load(id)];
                        case 1:
                            if (!(_e.sent()))
                                throw new Error("session not found: ".concat(id));
                            return [4 /*yield*/, store.delete(id)];
                        case 2:
                            _e.sent();
                            attachments = (0, attachments_1.createAttachmentService)(root);
                            _b = (_a = attachments).cleanup;
                            _d = (_c = attachments).referencedForSessions;
                            return [4 /*yield*/, store.list()];
                        case 3: return [4 /*yield*/, _b.apply(_a, [_d.apply(_c, [_e.sent()])])];
                        case 4:
                            removed = _e.sent();
                            return [2 /*return*/, { id: id, deleted: true, removedAttachments: removed.length }];
                    }
                });
            });
        },
        show: function (id) {
            return __awaiter(this, void 0, void 0, function () {
                var database, sqliteSession, result, session;
                var _a, _b, _c, _d;
                return __generator(this, function (_e) {
                    switch (_e.label) {
                        case 0:
                            database = sqlite();
                            sqliteSession = database === null || database === void 0 ? void 0 : database.get(id);
                            if (database && sqliteSession) {
                                result = {
                                    id: sqliteSession.id,
                                    title: sqliteSession.title,
                                    createdAt: sqliteSession.createdAt,
                                    pinned: sqliteSession.pinned,
                                    lastAccessedAt: sqliteSession.metadata.lastAccessedAt,
                                    events: database.eventCount(sqliteSession.id),
                                    pendingInputs: database.pendingInputCount(sqliteSession.id),
                                    cancelled: sqliteSession.cancelled,
                                    resumable: sqliteSession.resumable,
                                };
                                database.close();
                                return [2 /*return*/, result];
                            }
                            database === null || database === void 0 ? void 0 : database.close();
                            return [4 /*yield*/, json().load(id)];
                        case 1:
                            session = _e.sent();
                            if (!session)
                                throw new Error("session not found: ".concat(id));
                            return [2 /*return*/, {
                                    id: session.id,
                                    title: session.title,
                                    createdAt: session.createdAt,
                                    pinned: Boolean((_a = session.metadata) === null || _a === void 0 ? void 0 : _a.pinned),
                                    lastAccessedAt: (_b = session.metadata) === null || _b === void 0 ? void 0 : _b.lastAccessedAt,
                                    events: session.events.length,
                                    pendingInputs: (_d = (_c = session.inbox) === null || _c === void 0 ? void 0 : _c.filter(function (input) { return !input.promotedAt; }).length) !== null && _d !== void 0 ? _d : 0,
                                    cancelled: session.cancelled,
                                    resumable: session.resumable,
                                }];
                    }
                });
            });
        },
        workGraph: function (sessionID) {
            return __awaiter(this, void 0, void 0, function () {
                var database, session, record, _a;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            database = sqlite();
                            session = database === null || database === void 0 ? void 0 : database.loadRecord(sessionID);
                            database === null || database === void 0 ? void 0 : database.close();
                            if (!(session !== null && session !== void 0)) return [3 /*break*/, 1];
                            _a = session;
                            return [3 /*break*/, 3];
                        case 1: return [4 /*yield*/, json().load(sessionID)];
                        case 2:
                            _a = (_b.sent());
                            _b.label = 3;
                        case 3:
                            record = _a;
                            if (!record)
                                throw new Error("session not found: ".concat(sessionID));
                            return [2 /*return*/, {
                                    sessionID: record.id,
                                    nodes: (0, session_1.projectedWorkGraphNodes)(record.events),
                                    edges: (0, session_1.projectedWorkGraphEdges)(record.events),
                                }];
                    }
                });
            });
        },
        rename: function (id, title) {
            return __awaiter(this, void 0, void 0, function () {
                var session;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, json().rename(id, title)];
                        case 1:
                            session = _a.sent();
                            return [2 /*return*/, { id: session.id, title: session.title }];
                    }
                });
            });
        },
        setPinned: function (id, pinned) {
            return __awaiter(this, void 0, void 0, function () {
                var session;
                var _a;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0: return [4 /*yield*/, json().updateMetadata(id, { pinned: pinned })];
                        case 1:
                            session = _b.sent();
                            return [2 /*return*/, { id: session.id, pinned: Boolean((_a = session.metadata) === null || _a === void 0 ? void 0 : _a.pinned) }];
                    }
                });
            });
        },
        duplicate: function (id_1) {
            return __awaiter(this, arguments, void 0, function (id, input) {
                var session;
                if (input === void 0) { input = {}; }
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, json().duplicate(id, input.newID, input.title)];
                        case 1:
                            session = _a.sent();
                            return [2 /*return*/, { id: session.id, title: session.title, duplicatedFrom: id }];
                    }
                });
            });
        },
        exportMetadata: function (id) {
            return __awaiter(this, void 0, void 0, function () {
                var session;
                var _a;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0: return [4 /*yield*/, json().load(id)];
                        case 1:
                            session = _b.sent();
                            if (!session)
                                throw new Error("session not found: ".concat(id));
                            return [2 /*return*/, {
                                    version: 1,
                                    source: { id: session.id, createdAt: session.createdAt },
                                    title: session.title,
                                    pinned: Boolean((_a = session.metadata) === null || _a === void 0 ? void 0 : _a.pinned),
                                    cancelled: session.cancelled,
                                    resumable: session.resumable,
                                }];
                    }
                });
            });
        },
        importMetadata: function (bundle_1) {
            return __awaiter(this, arguments, void 0, function (bundle, input) {
                var store, id, session;
                var _a, _b, _c;
                if (input === void 0) { input = {}; }
                return __generator(this, function (_d) {
                    switch (_d.label) {
                        case 0:
                            if (bundle.version !== 1 || !((_a = bundle.source) === null || _a === void 0 ? void 0 : _a.id) || !bundle.title)
                                throw new Error("invalid session metadata bundle");
                            store = json();
                            id = ((_b = input.id) !== null && _b !== void 0 ? _b : "ses_import_".concat((0, node_crypto_1.randomUUID)().replace(/-/gu, "").slice(0, 16)));
                            return [4 /*yield*/, store.load(id)];
                        case 1:
                            if (_d.sent())
                                throw new Error("session already exists: ".concat(id));
                            session = (0, session_1.createSessionRecord)(id, (_c = input.title) !== null && _c !== void 0 ? _c : bundle.title);
                            session.cancelled = bundle.cancelled;
                            session.resumable = bundle.resumable;
                            session.metadata = {
                                pinned: bundle.pinned,
                                importedFrom: bundle.source.id,
                            };
                            return [4 /*yield*/, store.save(session)];
                        case 2:
                            _d.sent();
                            return [2 /*return*/, {
                                    id: session.id,
                                    title: session.title,
                                    importedFrom: bundle.source.id,
                                }];
                    }
                });
            });
        },
    };
}
