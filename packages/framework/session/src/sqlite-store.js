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
exports.SqliteSessionStore = void 0;
var bun_sqlite_1 = require("bun:sqlite");
var inbox_1 = require("./inbox");
var projector_1 = require("./projector");
var SCHEMA = "\nCREATE TABLE IF NOT EXISTS sessions (\n  id TEXT PRIMARY KEY,\n  title TEXT NOT NULL DEFAULT '',\n  created_at TEXT NOT NULL,\n  cancelled INTEGER NOT NULL DEFAULT 0,\n  resumable INTEGER NOT NULL DEFAULT 1,\n  pinned INTEGER NOT NULL DEFAULT 0,\n  metadata TEXT NOT NULL DEFAULT '{}'\n);\n\nCREATE TABLE IF NOT EXISTS events (\n  seq INTEGER PRIMARY KEY AUTOINCREMENT,\n  session_id TEXT NOT NULL REFERENCES sessions(id),\n  event TEXT NOT NULL,\n  created_at TEXT NOT NULL DEFAULT (datetime('now'))\n);\n\nCREATE INDEX IF NOT EXISTS idx_events_session ON events(session_id, seq);\n\nCREATE TABLE IF NOT EXISTS message_turns (\n  session_id TEXT NOT NULL REFERENCES sessions(id),\n  turn_id TEXT NOT NULL,\n  start_seq INTEGER NOT NULL,\n  PRIMARY KEY(session_id, turn_id)\n);\n\nCREATE INDEX IF NOT EXISTS idx_message_turns_session_seq\n  ON message_turns(session_id, start_seq);\n\nCREATE TABLE IF NOT EXISTS message_index_state (\n  session_id TEXT PRIMARY KEY REFERENCES sessions(id),\n  last_seq INTEGER NOT NULL DEFAULT 0\n);\n\nCREATE TABLE IF NOT EXISTS session_inputs (\n  session_id TEXT NOT NULL REFERENCES sessions(id),\n  id TEXT NOT NULL,\n  text TEXT NOT NULL,\n  attachments TEXT,\n  resources TEXT,\n  agents TEXT,\n  delivery TEXT NOT NULL,\n  admitted_at TEXT NOT NULL,\n  admitted_seq INTEGER NOT NULL,\n  promoted_at TEXT,\n  promoted_seq INTEGER,\n  PRIMARY KEY(session_id, id)\n);\n\nCREATE INDEX IF NOT EXISTS idx_session_inputs_pending\n  ON session_inputs(session_id, promoted_at, admitted_seq);\n\nCREATE TABLE IF NOT EXISTS recovery_turns (\n  session_id TEXT NOT NULL REFERENCES sessions(id),\n  turn_id TEXT NOT NULL,\n  active INTEGER NOT NULL,\n  PRIMARY KEY(session_id, turn_id)\n);\n\nCREATE INDEX IF NOT EXISTS idx_recovery_turns_active\n  ON recovery_turns(session_id, active);\n\nCREATE TABLE IF NOT EXISTS recovery_interactive (\n  session_id TEXT NOT NULL REFERENCES sessions(id),\n  request_id TEXT NOT NULL,\n  kind TEXT NOT NULL,\n  event TEXT NOT NULL,\n  PRIMARY KEY(session_id, request_id)\n);\n\nCREATE TABLE IF NOT EXISTS recovery_selection (\n  session_id TEXT PRIMARY KEY REFERENCES sessions(id),\n  agent_name TEXT,\n  model_id TEXT,\n  model_variant TEXT,\n  reasoning_effort TEXT,\n  chat_model_profile TEXT,\n  permission_mode TEXT,\n  permission_profile TEXT\n);\n\nCREATE TABLE IF NOT EXISTS recovery_attachments (\n  session_id TEXT NOT NULL REFERENCES sessions(id),\n  turn_id TEXT NOT NULL,\n  attachments TEXT NOT NULL,\n  PRIMARY KEY(session_id, turn_id)\n);\n\nCREATE TABLE IF NOT EXISTS recovery_diagnostics (\n  session_id TEXT NOT NULL REFERENCES sessions(id),\n  seq INTEGER PRIMARY KEY AUTOINCREMENT,\n  event TEXT NOT NULL\n);\n\nCREATE INDEX IF NOT EXISTS idx_recovery_diagnostics_session_seq\n  ON recovery_diagnostics(session_id, seq);\n\nCREATE TABLE IF NOT EXISTS recovery_state (\n  session_id TEXT PRIMARY KEY REFERENCES sessions(id),\n  indexed_events INTEGER NOT NULL\n);\n\nCREATE TABLE IF NOT EXISTS recovery_goal (\n  session_id TEXT PRIMARY KEY REFERENCES sessions(id),\n  snapshot TEXT NOT NULL,\n  rounds_started INTEGER NOT NULL,\n  created_at TEXT NOT NULL,\n  updated_at TEXT NOT NULL\n);\n\nCREATE TABLE IF NOT EXISTS context_epochs (\n  session_id TEXT PRIMARY KEY REFERENCES sessions(id),\n  baseline_seq INTEGER NOT NULL,\n  snapshot TEXT NOT NULL\n);\n\nCREATE TABLE IF NOT EXISTS projection_checkpoints (\n  session_id TEXT PRIMARY KEY REFERENCES sessions(id),\n  state_version INTEGER NOT NULL,\n  last_seq INTEGER NOT NULL,\n  state TEXT NOT NULL\n);\n\nCREATE TABLE IF NOT EXISTS deleted_sessions (\n  id TEXT PRIMARY KEY,\n  deleted_at TEXT NOT NULL\n);\n";
function isDurableFlushBarrier(event) {
    return (event.type === "approval.response" ||
        event.type === "question.response" ||
        event.type === "turn.finished" ||
        event.type === "turn.cancelled" ||
        event.type === "context.checkpoint" ||
        event.type === "session.created" ||
        event.type === "session.ready");
}
var SqliteSessionStore = /** @class */ (function () {
    function SqliteSessionStore(path) {
        this.writeQueue = Promise.resolve();
        this.pendingAsyncEvents = new Map();
        this.pendingFlushes = new Map();
        this.scheduledFlushes = new Set();
        this.flushTimers = new Map();
        this.closed = false;
        /**
         * Live per-session projection fold, advanced on every append and persisted as
         * a checkpoint on durable flush barriers. Cleared on rollback/delete/close so
         * a stale fold is never replayed.
         */
        this.projectionStates = new Map();
        this.db = new bun_sqlite_1.Database(path);
        this.db.exec("PRAGMA foreign_keys=ON");
        this.db.exec("PRAGMA journal_mode=WAL");
        this.db.exec("PRAGMA synchronous=NORMAL");
        this.db.exec("PRAGMA busy_timeout=5000");
        this.db.exec(SCHEMA);
        this.ensureNewRecoveryColumns();
        this.insertEventStatement = this.db.prepare("INSERT INTO events(session_id, event) VALUES (?, ?)");
    }
    SqliteSessionStore.prototype.ensureNewRecoveryColumns = function () {
        var columns = new Set(this.db.query("PRAGMA table_info(recovery_selection)").all().map(function (column) { return column.name; }));
        var additions = [
            ["reasoning_effort", "TEXT"],
            ["chat_model_profile", "TEXT"],
            ["permission_mode", "TEXT"],
            ["permission_profile", "TEXT"],
        ];
        for (var _i = 0, additions_1 = additions; _i < additions_1.length; _i++) {
            var _a = additions_1[_i], name_1 = _a[0], type = _a[1];
            if (!columns.has(name_1))
                this.db.exec("ALTER TABLE recovery_selection ADD COLUMN ".concat(name_1, " ").concat(type));
        }
    };
    SqliteSessionStore.prototype.close = function () {
        if (this.closed)
            return;
        // close() is synchronous by contract, so drain buffered async appends
        // before SQLite closes its WAL handle.
        for (var _i = 0, _a = this.pendingAsyncEvents; _i < _a.length; _i++) {
            var _b = _a[_i], sessionID = _b[0], events = _b[1];
            if (events.length)
                this.writeBufferedBatch(sessionID, events.splice(0));
        }
        this.pendingAsyncEvents.clear();
        this.scheduledFlushes.clear();
        for (var _c = 0, _d = this.flushTimers.values(); _c < _d.length; _c++) {
            var timer = _d[_c];
            clearTimeout(timer);
        }
        this.flushTimers.clear();
        this.projectionStates.clear();
        this.checkpoint();
        this.closed = true;
        // `db.close()` calls sqlite3_close_v2, which only *defers* deallocation
        // when a prepared statement is still alive: the connection becomes a
        // zombie and keeps its OS handles on the db, -wal, and -shm files. This
        // statement is owned here and never finalized elsewhere, so releasing it
        // first is what makes the close actually release those handles. POSIX
        // hides the difference because an open file can be unlinked; Windows
        // refuses to delete the database until the handles are gone.
        this.insertEventStatement.finalize();
        this.db.close();
    };
    /** Runs passive WAL maintenance without forcing active readers to stop. */
    SqliteSessionStore.prototype.checkpoint = function () {
        var _a, _b, _c;
        var row = this.db.query("PRAGMA wal_checkpoint(PASSIVE)").get();
        return {
            busy: (_a = row === null || row === void 0 ? void 0 : row.busy) !== null && _a !== void 0 ? _a : 0,
            logPages: (_b = row === null || row === void 0 ? void 0 : row.log) !== null && _b !== void 0 ? _b : 0,
            checkpointedPages: (_c = row === null || row === void 0 ? void 0 : row.checkpointed) !== null && _c !== void 0 ? _c : 0,
        };
    };
    SqliteSessionStore.prototype.create = function (id, title, now) {
        if (now === void 0) { now = new Date(); }
        this.clearDeleted(id);
        this.run("INSERT OR IGNORE INTO sessions(id, title, created_at) VALUES (?, ?, ?)", [id, title, now.toISOString()]);
        return this.get(id);
    };
    SqliteSessionStore.prototype.get = function (id) {
        var row = this.db
            .query("SELECT id, title, created_at, cancelled, resumable, pinned, metadata FROM sessions WHERE id = ?")
            .get(id);
        if (!row)
            return undefined;
        return rowToSession(row);
    };
    SqliteSessionStore.prototype.loadOrCreate = function (id, title) {
        var _a;
        return (_a = this.get(id)) !== null && _a !== void 0 ? _a : this.create(id, title);
    };
    SqliteSessionStore.prototype.list = function () {
        var rows = this.db
            .query("SELECT id, title, created_at, cancelled, resumable, pinned, metadata\n         FROM sessions\n         ORDER BY pinned DESC, json_extract(metadata, '$.lastAccessedAt') DESC, created_at DESC")
            .all();
        return rows.map(rowToSession);
    };
    SqliteSessionStore.prototype.rename = function (id, title) {
        var trimmed = title.trim();
        if (!trimmed)
            throw new Error("session title cannot be empty");
        if (!this.get(id))
            throw new Error("session not found: ".concat(id));
        this.run("UPDATE sessions\n       SET title = ?,\n           metadata = json_set(COALESCE(metadata, '{}'), '$.titleSource', 'manual')\n       WHERE id = ?", [trimmed, id]);
        return this.get(id);
    };
    SqliteSessionStore.prototype.setAutoTitle = function (id, title, source) {
        if (!this.get(id))
            throw new Error("session not found: ".concat(id));
        this.run("UPDATE sessions\n       SET title = ?,\n           metadata = json_set(COALESCE(metadata, '{}'), '$.titleSource', ?)\n       WHERE id = ?\n         AND COALESCE(json_extract(metadata, '$.titleSource'), '') <> 'manual'", [title, source, id]);
        return this.get(id);
    };
    SqliteSessionStore.prototype.touch = function (id, at) {
        if (at === void 0) { at = new Date().toISOString(); }
        this.updateMetadata(id, { lastAccessedAt: at });
        return this.get(id);
    };
    SqliteSessionStore.prototype.pin = function (id, pinned) {
        this.updateMetadata(id, { pinned: pinned });
        return this.get(id);
    };
    SqliteSessionStore.prototype.duplicate = function (id, newID, newTitle) {
        var _a;
        var source = this.loadRecord(id);
        if (!source)
            throw new Error("session not found: ".concat(id));
        var targetID = newID !== null && newID !== void 0 ? newID : "ses_".concat(crypto.randomUUID().replace(/-/gu, "").slice(0, 16));
        var copy = __assign(__assign({}, source), { id: targetID, title: newTitle !== null && newTitle !== void 0 ? newTitle : "".concat(source.title, " (copy)"), metadata: __assign(__assign({}, source.metadata), { lastAccessedAt: new Date().toISOString() }), inbox: (_a = source.inbox) === null || _a === void 0 ? void 0 : _a.map(function (input) { return (__assign(__assign({}, input), { sessionID: targetID })); }) });
        this.replace(copy);
        return copy;
    };
    SqliteSessionStore.prototype.fork = function (id, turnID, newID, newTitle) {
        var _a;
        var source = this.loadRecord(id);
        if (!source)
            throw new Error("session not found: ".concat(id));
        var boundary = source.events.findIndex(function (event) { return event.type === "turn.submitted" && event.id === turnID; });
        if (boundary < 0)
            throw new Error("turn not found: ".concat(turnID));
        var targetID = newID !== null && newID !== void 0 ? newID : "ses_".concat(crypto.randomUUID().replace(/-/gu, "").slice(0, 16));
        var includedTurns = new Set(source.events
            .slice(0, boundary)
            .flatMap(function (event) {
            return event.type === "turn.submitted" ? [event.id] : [];
        }));
        var fork = __assign(__assign({}, source), { id: targetID, title: newTitle !== null && newTitle !== void 0 ? newTitle : "".concat(source.title, " (fork)"), events: structuredClone(source.events.slice(0, boundary)), metadata: __assign(__assign({}, source.metadata), { lastAccessedAt: new Date().toISOString() }), inbox: (_a = source.inbox) === null || _a === void 0 ? void 0 : _a.filter(function (input) { return includedTurns.has(input.id); }).map(function (input) { return (__assign(__assign({}, input), { sessionID: targetID })); }) });
        this.replace(fork);
        return fork;
    };
    SqliteSessionStore.prototype.seqForTurnStart = function (sessionID, turnID) {
        var row = this.db
            .query("SELECT start_seq FROM message_turns WHERE session_id = ? AND turn_id = ? LIMIT 1")
            .get(sessionID, turnID);
        return row === null || row === void 0 ? void 0 : row.start_seq;
    };
    SqliteSessionStore.prototype.seqForTurnEnd = function (sessionID, turnID) {
        var start = this.db
            .query("SELECT seq FROM events\n         WHERE session_id = ? AND json_extract(event, '$.type') = 'turn.submitted'\n           AND json_extract(event, '$.id') = ?\n         ORDER BY seq LIMIT 1")
            .get(sessionID, turnID);
        if (!start)
            throw new Error("turn not found: ".concat(turnID));
        var next = this.db
            .query("SELECT seq FROM events\n         WHERE session_id = ? AND seq > ? AND json_extract(event, '$.type') = 'turn.submitted'\n         ORDER BY seq LIMIT 1")
            .get(sessionID, start.seq);
        if (next)
            return next.seq - 1;
        var max = this.db
            .query("SELECT COALESCE(MAX(seq), 0) AS max_seq FROM events WHERE session_id = ?")
            .get(sessionID);
        return max.max_seq;
    };
    SqliteSessionStore.prototype.truncateAfter = function (sessionID, afterSeq) {
        var _this = this;
        this.db.transaction(function () {
            _this.run("DELETE FROM events WHERE session_id = ? AND seq > ?", [
                sessionID,
                afterSeq,
            ]);
            _this.run("DELETE FROM message_turns WHERE session_id = ? AND start_seq > ?", [sessionID, afterSeq]);
            _this.run("DELETE FROM message_index_state WHERE session_id = ?", [
                sessionID,
            ]);
            _this.run("DELETE FROM context_epochs WHERE session_id = ? AND baseline_seq > ?", [sessionID, afterSeq]);
            _this.run("DELETE FROM recovery_turns WHERE session_id = ?", [sessionID]);
            _this.run("INSERT INTO recovery_state(session_id, indexed_events) VALUES (?, ?)\n         ON CONFLICT(session_id) DO UPDATE SET indexed_events = excluded.indexed_events", [sessionID, afterSeq]);
            // A rollback rewrites the durable log; drop the live fold and the
            // checkpoint so the next append re-folds and no stale cache is replayed.
            _this.projectionStates.delete(sessionID);
            _this.run("DELETE FROM projection_checkpoints WHERE session_id = ?", [
                sessionID,
            ]);
        })();
    };
    SqliteSessionStore.prototype.delete = function (id) {
        var _this = this;
        this.db.transaction(function () {
            _this.deleteRecoveryProjection(id);
            _this.run("DELETE FROM context_epochs WHERE session_id = ?", [id]);
            _this.run("DELETE FROM message_turns WHERE session_id = ?", [id]);
            _this.run("DELETE FROM message_index_state WHERE session_id = ?", [id]);
            _this.run("DELETE FROM session_inputs WHERE session_id = ?", [id]);
            _this.run("DELETE FROM events WHERE session_id = ?", [id]);
            _this.run("DELETE FROM projection_checkpoints WHERE session_id = ?", [id]);
            _this.run("DELETE FROM sessions WHERE id = ?", [id]);
            _this.markDeleted(id);
        })();
        this.projectionStates.delete(id);
    };
    SqliteSessionStore.prototype.wasDeleted = function (id) {
        var row = this.db
            .query("SELECT 1 AS present FROM deleted_sessions WHERE id = ?")
            .get(id);
        return Boolean(row);
    };
    SqliteSessionStore.prototype.markDeleted = function (id, now) {
        if (now === void 0) { now = new Date(); }
        this.run("INSERT INTO deleted_sessions(id, deleted_at) VALUES (?, ?)\n       ON CONFLICT(id) DO UPDATE SET deleted_at = excluded.deleted_at", [id, now.toISOString()]);
    };
    SqliteSessionStore.prototype.clearDeleted = function (id) {
        this.run("DELETE FROM deleted_sessions WHERE id = ?", [id]);
    };
    SqliteSessionStore.prototype.updateMetadata = function (id, partial) {
        var session = this.get(id);
        if (!session)
            throw new Error("session not found: ".concat(id));
        var next = __assign(__assign({}, session.metadata), partial);
        this.run("UPDATE sessions SET metadata = ?, pinned = ? WHERE id = ?", [
            JSON.stringify(next),
            next.pinned === true ? 1 : 0,
            id,
        ]);
    };
    SqliteSessionStore.prototype.replace = function (session) {
        var _this = this;
        var write = this.db.transaction(function () {
            var _a, _b, _c;
            _this.clearDeleted(session.id);
            _this.run("DELETE FROM context_epochs WHERE session_id = ?", [session.id]);
            _this.run("DELETE FROM message_turns WHERE session_id = ?", [session.id]);
            _this.run("DELETE FROM message_index_state WHERE session_id = ?", [
                session.id,
            ]);
            _this.run("DELETE FROM session_inputs WHERE session_id = ?", [session.id]);
            _this.deleteRecoveryProjection(session.id);
            _this.run("DELETE FROM events WHERE session_id = ?", [session.id]);
            _this.run("DELETE FROM sessions WHERE id = ?", [session.id]);
            _this.run("INSERT INTO sessions(id, title, created_at, cancelled, resumable, pinned, metadata)\n         VALUES (?, ?, ?, ?, ?, ?, ?)", [
                session.id,
                session.title,
                session.createdAt,
                session.cancelled ? 1 : 0,
                session.resumable ? 1 : 0,
                ((_a = session.metadata) === null || _a === void 0 ? void 0 : _a.pinned) === true ? 1 : 0,
                JSON.stringify((_b = session.metadata) !== null && _b !== void 0 ? _b : {}),
            ]);
            for (var _i = 0, _d = session.events; _i < _d.length; _i++) {
                var event_1 = _d[_i];
                _this.appendEvent(session.id, event_1);
            }
            _this.replaceInbox(session.id, (_c = session.inbox) !== null && _c !== void 0 ? _c : []);
        });
        write();
    };
    SqliteSessionStore.prototype.appendEvent = function (sessionID, event) {
        var _this = this;
        this.db.transaction(function () {
            _this.appendEventInTransaction(sessionID, event);
            _this.bumpRecoveryState(sessionID);
        })();
    };
    SqliteSessionStore.prototype.appendEvents = function (sessionID, events) {
        var _this = this;
        var txn = this.db.transaction(function () {
            // This synchronous recovery-settlement helper deliberately retains its
            // established narrow semantics. New streaming batches use the complete
            // writeBufferedBatch path below.
            for (var _i = 0, events_1 = events; _i < events_1.length; _i++) {
                var event_2 = events_1[_i];
                _this.insertEvent(sessionID, event_2);
                _this.applyRecoveryEvent(sessionID, event_2);
            }
            _this.bumpRecoveryState(sessionID, events.length);
        });
        txn();
    };
    /**
     * Removes historical event payloads that are live-only or already covered by
     * the context epoch table. This is an idempotent storage-size migration:
     * every removed event is either reconstructible (`session.snapshot`,
     * `rollback.previewed`) or superseded by `context_epochs`
     * (`context.checkpoint`). It does not touch task/control events used by
     * recovery, transcript paging, or work-graph projections.
     */
    SqliteSessionStore.prototype.compactHistoricalEvents = function () {
        var _this = this;
        var affected = new Set();
        var live = this.db
            .query("SELECT DISTINCT session_id FROM events\n         WHERE json_extract(event, '$.type') IN ('session.snapshot','rollback.previewed')")
            .all();
        for (var _i = 0, live_1 = live; _i < live_1.length; _i++) {
            var row = live_1[_i];
            affected.add(row.session_id);
        }
        var checkpoints = this.db
            .query("SELECT session_id, MAX(seq) AS max_seq\n         FROM events\n         WHERE json_extract(event, '$.type') = 'context.checkpoint'\n         GROUP BY session_id")
            .all();
        var epochs = new Map();
        for (var _a = 0, _b = this.db
            .query("SELECT session_id, baseline_seq FROM context_epochs")
            .all(); _a < _b.length; _a++) {
            var row = _b[_a];
            epochs.set(row.session_id, row.baseline_seq);
        }
        for (var _c = 0, checkpoints_1 = checkpoints; _c < checkpoints_1.length; _c++) {
            var row = checkpoints_1[_c];
            if (epochs.has(row.session_id))
                affected.add(row.session_id);
        }
        if (affected.size === 0)
            return [];
        console.warn("[session-store] compacting live-only historical events", {
            sessions: affected.size,
        });
        this.db.transaction(function () {
            _this.run("DELETE FROM events\n         WHERE json_extract(event, '$.type') IN ('session.snapshot','rollback.previewed')");
            for (var _i = 0, checkpoints_2 = checkpoints; _i < checkpoints_2.length; _i++) {
                var row = checkpoints_2[_i];
                var baseline = epochs.get(row.session_id);
                if (baseline !== undefined) {
                    _this.run("DELETE FROM events\n             WHERE session_id = ?\n               AND json_extract(event, '$.type') = 'context.checkpoint'\n               AND seq <= ?", [row.session_id, baseline]);
                }
                else {
                    _this.run("DELETE FROM events\n             WHERE session_id = ?\n               AND json_extract(event, '$.type') = 'context.checkpoint'\n               AND seq <> ?", [row.session_id, row.max_seq]);
                }
            }
            for (var _a = 0, affected_1 = affected; _a < affected_1.length; _a++) {
                var sessionID = affected_1[_a];
                _this.run("DELETE FROM recovery_state WHERE session_id = ?", [
                    sessionID,
                ]);
                _this.run("DELETE FROM message_index_state WHERE session_id = ?", [
                    sessionID,
                ]);
            }
        })();
        return __spreadArray([], affected, true);
    };
    SqliteSessionStore.prototype.loadEvents = function (sessionID) {
        var rows = this.db
            .query("SELECT event FROM events WHERE session_id = ? ORDER BY seq")
            .all(sessionID);
        return rows.map(function (r) { return JSON.parse(r.event); });
    };
    /**
     * Loads only events that the live execution projection still needs. The
     * heavy live-only payloads (`session.snapshot`, `rollback.previewed`) and,
     * when a SQLite context epoch exists, `context.checkpoint` are filtered in
     * SQLite before JSON parsing, so a 60MB historical journal does not become a
     * 250MB JS object graph merely to attach the session.
     */
    SqliteSessionStore.prototype.runtimeEventExclusion = function (options) {
        return __spreadArray([
            "session.snapshot",
            "rollback.previewed"
        ], (options.excludeContextCheckpoint ? ["context.checkpoint"] : []), true);
    };
    SqliteSessionStore.prototype.loadRuntimeEvents = function (sessionID, options) {
        var _a;
        if (options === void 0) { options = {}; }
        var excluded = this.runtimeEventExclusion(options);
        var placeholders = excluded.map(function () { return "?"; }).join(", ");
        var rows = (_a = this.db
            .query("SELECT event FROM events\n         WHERE session_id = ?\n           AND json_extract(event, '$.type') NOT IN (".concat(placeholders, ")\n         ORDER BY seq")))
            .all.apply(_a, __spreadArray([sessionID], excluded, false));
        return rows.map(function (row) { return JSON.parse(row.event); });
    };
    SqliteSessionStore.prototype.loadRuntimeEventsAsync = function (sessionID_1) {
        return __awaiter(this, arguments, void 0, function (sessionID, options) {
            var excluded, placeholders, events, afterSeq, batchSize, rows, _i, rows_1, row;
            var _a;
            if (options === void 0) { options = {}; }
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        excluded = this.runtimeEventExclusion(options);
                        placeholders = excluded.map(function () { return "?"; }).join(", ");
                        events = [];
                        afterSeq = 0;
                        batchSize = 500;
                        _b.label = 1;
                    case 1:
                        if (!true) return [3 /*break*/, 3];
                        rows = (_a = this.db
                            .query("SELECT seq, event FROM events\n           WHERE session_id = ?\n             AND seq > ?\n             AND json_extract(event, '$.type') NOT IN (".concat(placeholders, ")\n           ORDER BY seq\n           LIMIT ?")))
                            .all.apply(_a, __spreadArray(__spreadArray([sessionID, afterSeq], excluded, false), [batchSize], false));
                        if (rows.length === 0)
                            return [3 /*break*/, 3];
                        for (_i = 0, rows_1 = rows; _i < rows_1.length; _i++) {
                            row = rows_1[_i];
                            events.push(JSON.parse(row.event));
                        }
                        afterSeq = rows[rows.length - 1].seq;
                        if (rows.length < batchSize)
                            return [3 /*break*/, 3];
                        return [4 /*yield*/, new Promise(function (resolve) { return setImmediate(resolve); })];
                    case 2:
                        _b.sent();
                        return [3 /*break*/, 1];
                    case 3: return [2 /*return*/, events];
                }
            });
        });
    };
    SqliteSessionStore.prototype.loadEventsAsync = function (sessionID) {
        return __awaiter(this, void 0, void 0, function () {
            var events, afterSeq, batchSize, rows, _i, rows_2, row;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        events = [];
                        afterSeq = 0;
                        batchSize = 500;
                        _a.label = 1;
                    case 1:
                        if (!true) return [3 /*break*/, 3];
                        rows = this.db
                            .query("SELECT seq, event FROM events\n           WHERE session_id = ? AND seq > ?\n           ORDER BY seq\n           LIMIT ?")
                            .all(sessionID, afterSeq, batchSize);
                        if (rows.length === 0)
                            return [3 /*break*/, 3];
                        for (_i = 0, rows_2 = rows; _i < rows_2.length; _i++) {
                            row = rows_2[_i];
                            events.push(JSON.parse(row.event));
                        }
                        afterSeq = rows[rows.length - 1].seq;
                        if (rows.length < batchSize)
                            return [3 /*break*/, 3];
                        return [4 /*yield*/, new Promise(function (resolve) { return setImmediate(resolve); })];
                    case 2:
                        _a.sent();
                        return [3 /*break*/, 1];
                    case 3: return [2 /*return*/, events];
                }
            });
        });
    };
    SqliteSessionStore.prototype.loadEventsAfterAsync = function (sessionID, after) {
        return __awaiter(this, void 0, void 0, function () {
            var rows, events, index;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        rows = this.db
                            .query("SELECT event FROM events WHERE session_id = ? AND seq > ? ORDER BY seq")
                            .all(sessionID, after);
                        events = [];
                        index = 0;
                        _a.label = 1;
                    case 1:
                        if (!(index < rows.length)) return [3 /*break*/, 4];
                        events.push(JSON.parse(rows[index].event));
                        if (!(index % 100 === 99)) return [3 /*break*/, 3];
                        return [4 /*yield*/, new Promise(function (resolve) { return setImmediate(resolve); })];
                    case 2:
                        _a.sent();
                        _a.label = 3;
                    case 3:
                        index++;
                        return [3 /*break*/, 1];
                    case 4: return [2 /*return*/, events];
                }
            });
        });
    };
    SqliteSessionStore.prototype.loadRecoveryProjection = function (sessionID) {
        var _a, _b, _c;
        this.ensureRecoveryProjection(sessionID);
        var active = this.db
            .query("SELECT turn_id FROM recovery_turns WHERE session_id = ? AND active = 1")
            .all(sessionID);
        var interactive = this.db
            .query("SELECT kind, event FROM recovery_interactive WHERE session_id = ?")
            .all(sessionID);
        var selection = this.db
            .query("SELECT agent_name, model_id, model_variant, reasoning_effort, chat_model_profile, permission_mode, permission_profile FROM recovery_selection WHERE session_id = ?")
            .get(sessionID);
        var goalRow = this.db
            .query("SELECT snapshot, rounds_started, created_at, updated_at FROM recovery_goal WHERE session_id = ?")
            .get(sessionID);
        var attachments = new Map();
        var attachmentRows = this.db
            .query("SELECT turn_id, attachments FROM recovery_attachments WHERE session_id = ?")
            .all(sessionID);
        for (var _i = 0, attachmentRows_1 = attachmentRows; _i < attachmentRows_1.length; _i++) {
            var row = attachmentRows_1[_i];
            attachments.set(row.turn_id, JSON.parse(row.attachments));
        }
        var diagnostics = this.db
            .query("SELECT event FROM recovery_diagnostics WHERE session_id = ? ORDER BY seq")
            .all(sessionID);
        return {
            activeTurnIDs: active.map(function (row) { return row.turn_id; }),
            goal: goalRow
                ? __assign(__assign({}, JSON.parse(goalRow.snapshot)), { roundsStarted: goalRow.rounds_started, createdAt: goalRow.created_at, updatedAt: goalRow.updated_at, activation: "disarmed" }) : undefined,
            approvals: interactive
                .filter(function (row) { return row.kind === "approval"; })
                .map(function (row) {
                return JSON.parse(row.event);
            }),
            questions: interactive
                .filter(function (row) { return row.kind === "question"; })
                .map(function (row) {
                return JSON.parse(row.event);
            }),
            interactives: interactive
                .filter(function (row) { return row.kind.startsWith("interactive:"); })
                .map(function (row) {
                return JSON.parse(row.event);
            }),
            selectedAgent: selection === null || selection === void 0 ? void 0 : selection.agent_name,
            selectedModel: (selection === null || selection === void 0 ? void 0 : selection.model_id) || (selection === null || selection === void 0 ? void 0 : selection.model_variant)
                ? { modelID: selection.model_id, variant: selection.model_variant }
                : undefined,
            reasoningEffort: (_a = selection === null || selection === void 0 ? void 0 : selection.reasoning_effort) !== null && _a !== void 0 ? _a : undefined,
            chatModelProfile: (selection === null || selection === void 0 ? void 0 : selection.chat_model_profile)
                ? JSON.parse(selection.chat_model_profile)
                : undefined,
            permissionMode: (_b = selection === null || selection === void 0 ? void 0 : selection.permission_mode) !== null && _b !== void 0 ? _b : undefined,
            permissionProfile: (_c = selection === null || selection === void 0 ? void 0 : selection.permission_profile) !== null && _c !== void 0 ? _c : undefined,
            attachments: attachments,
            diagnostics: diagnostics.map(function (row) {
                return JSON.parse(row.event);
            }),
        };
    };
    SqliteSessionStore.prototype.loadRecord = function (id) {
        var row = this.get(id);
        if (!row)
            return undefined;
        return {
            id: row.id,
            title: row.title,
            createdAt: row.createdAt,
            cancelled: row.cancelled,
            resumable: row.resumable,
            metadata: row.metadata,
            events: this.loadEvents(id),
            inbox: this.loadInbox(id),
        };
    };
    SqliteSessionStore.prototype.loadInbox = function (sessionID) {
        var rows = this.db
            .query("SELECT id, text, attachments, resources, agents, delivery, admitted_at, admitted_seq, promoted_at, promoted_seq\n         FROM session_inputs WHERE session_id = ? ORDER BY admitted_seq")
            .all(sessionID);
        return rows.map(function (row) {
            var _a, _b;
            return ({
                id: row.id,
                sessionID: sessionID,
                text: row.text,
                attachments: parseOptionalJSON(row.attachments),
                resources: parseOptionalJSON(row.resources),
                agents: parseOptionalJSON(row.agents),
                delivery: (0, inbox_1.normalizeDelivery)(row.delivery),
                admittedAt: row.admitted_at,
                admittedSeq: row.admitted_seq,
                promotedAt: (_a = row.promoted_at) !== null && _a !== void 0 ? _a : undefined,
                promotedSeq: (_b = row.promoted_seq) !== null && _b !== void 0 ? _b : undefined,
            });
        });
    };
    SqliteSessionStore.prototype.replaceInbox = function (sessionID, inputs) {
        var _this = this;
        var insert = this.db.prepare("INSERT INTO session_inputs(session_id, id, text, attachments, resources, agents, delivery, admitted_at, admitted_seq, promoted_at, promoted_seq)\n       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
        try {
            this.db.transaction(function () {
                var _a, _b;
                _this.run("DELETE FROM session_inputs WHERE session_id = ?", [
                    sessionID,
                ]);
                for (var _i = 0, inputs_1 = inputs; _i < inputs_1.length; _i++) {
                    var input = inputs_1[_i];
                    insert.run(sessionID, input.id, input.text, optionalJSON(input.attachments), optionalJSON(input.resources), optionalJSON(input.agents), input.delivery, input.admittedAt, input.admittedSeq, (_a = input.promotedAt) !== null && _a !== void 0 ? _a : null, (_b = input.promotedSeq) !== null && _b !== void 0 ? _b : null);
                }
            })();
        }
        finally {
            insert.finalize();
        }
    };
    SqliteSessionStore.prototype.pendingInputCount = function (sessionID) {
        var _a;
        var row = this.db
            .query("SELECT COUNT(*) AS count FROM session_inputs WHERE session_id = ? AND promoted_at IS NULL")
            .get(sessionID);
        return (_a = row === null || row === void 0 ? void 0 : row.count) !== null && _a !== void 0 ? _a : 0;
    };
    SqliteSessionStore.prototype.referencedAttachments = function () {
        var sessions = this.db.query("SELECT id FROM sessions").all();
        for (var _i = 0, sessions_1 = sessions; _i < sessions_1.length; _i++) {
            var session = sessions_1[_i];
            this.ensureRecoveryProjection(session.id);
        }
        var attachments = [];
        var eventRows = this.db
            .query("SELECT attachments FROM recovery_attachments")
            .all();
        for (var _a = 0, eventRows_1 = eventRows; _a < eventRows_1.length; _a++) {
            var row = eventRows_1[_a];
            attachments.push.apply(attachments, JSON.parse(row.attachments));
        }
        var inputRows = this.db
            .query("SELECT attachments FROM session_inputs WHERE attachments IS NOT NULL")
            .all();
        for (var _b = 0, inputRows_1 = inputRows; _b < inputRows_1.length; _b++) {
            var row = inputRows_1[_b];
            var input = parseOptionalJSON(row.attachments);
            if (Array.isArray(input))
                attachments.push.apply(attachments, input);
        }
        return attachments;
    };
    SqliteSessionStore.prototype.loadEventsAfter = function (sessionID, after) {
        var rows = this.db
            .query("SELECT event FROM events WHERE session_id = ? AND seq > ? ORDER BY seq")
            .all(sessionID, after);
        return rows.map(function (row) { return JSON.parse(row.event); });
    };
    /**
     * Persists a per-session projection checkpoint stamped with the current max
     * event sequence, so a later attach can resume by folding only the tail.
     */
    SqliteSessionStore.prototype.saveProjectionCheckpoint = function (sessionID, state) {
        var _a;
        var row = this.db
            .query("SELECT MAX(seq) AS m FROM events WHERE session_id = ?")
            .get(sessionID);
        var lastSeq = (_a = row === null || row === void 0 ? void 0 : row.m) !== null && _a !== void 0 ? _a : 0;
        this.run("INSERT INTO projection_checkpoints(session_id, state_version, last_seq, state)\n       VALUES (?, ?, ?, ?)\n       ON CONFLICT(session_id) DO UPDATE SET\n         state_version = excluded.state_version,\n         last_seq = excluded.last_seq,\n         state = excluded.state", [sessionID, state.version, lastSeq, (0, projector_1.serializeProjectionState)(state)]);
        return lastSeq;
    };
    /**
     * Loads a persisted projection checkpoint. A row written by an older
     * `PROJECTION_STATE_VERSION` (or a corrupt payload) is discarded (returns
     * undefined) so the caller fails soft to a full projection.
     */
    SqliteSessionStore.prototype.loadProjectionCheckpoint = function (sessionID) {
        var row = this.db
            .query("SELECT state_version, last_seq, state FROM projection_checkpoints WHERE session_id = ?")
            .get(sessionID);
        if (!row)
            return undefined;
        if (row.state_version !== projector_1.PROJECTION_STATE_VERSION)
            return undefined;
        var state = (0, projector_1.deserializeProjectionState)(row.state);
        if (!state)
            return undefined;
        return { state: state, lastSeq: row.last_seq };
    };
    SqliteSessionStore.prototype.loadEventPage = function (sessionID, options) {
        var _a, _b, _c;
        if (options === void 0) { options = {}; }
        var after = Math.max(0, (_a = options.after) !== null && _a !== void 0 ? _a : 0);
        var offset = Math.max(0, (_b = options.offset) !== null && _b !== void 0 ? _b : 0);
        var limit = Math.min(2000, Math.max(1, (_c = options.limit) !== null && _c !== void 0 ? _c : 100));
        var rows = (options.offset === undefined
            ? this.db
                .query("SELECT seq, event, session_seq FROM (\n                 SELECT seq, event,\n                   ROW_NUMBER() OVER (PARTITION BY session_id ORDER BY seq) AS session_seq\n                 FROM events WHERE session_id = ?\n               ) WHERE seq > ? ORDER BY seq LIMIT ?")
                .all(sessionID, after, limit + 1)
            : this.db
                .query("SELECT seq, event, session_seq FROM (\n                 SELECT seq, event,\n                   ROW_NUMBER() OVER (PARTITION BY session_id ORDER BY seq) AS session_seq\n                 FROM events WHERE session_id = ?\n               ) ORDER BY seq LIMIT ? OFFSET ?")
                .all(sessionID, limit + 1, offset));
        var hasMore = rows.length > limit;
        return {
            events: rows.slice(0, limit).map(function (row) { return ({
                seq: row.seq,
                sessionSeq: row.session_seq,
                event: JSON.parse(row.event),
            }); }),
            hasMore: hasMore,
        };
    };
    SqliteSessionStore.prototype.loadEventWindow = function (sessionID, options) {
        var _a;
        if (options === void 0) { options = {}; }
        var limit = Math.min(2000, Math.max(1, (_a = options.limit) !== null && _a !== void 0 ? _a : 100));
        var before = options.beforeSeq === undefined
            ? Number.MAX_SAFE_INTEGER
            : Math.max(1, options.beforeSeq);
        var rows = this.db
            .query("SELECT seq, event, session_seq FROM (\n           SELECT seq, event,\n             ROW_NUMBER() OVER (PARTITION BY session_id ORDER BY seq) AS session_seq\n           FROM events WHERE session_id = ?\n         ) WHERE session_seq < ? ORDER BY session_seq DESC LIMIT ?")
            .all(sessionID, before, limit + 1);
        var hasMore = rows.length > limit;
        return {
            events: rows
                .slice(0, limit)
                .reverse()
                .map(function (row) { return ({
                seq: row.seq,
                sessionSeq: row.session_seq,
                event: JSON.parse(row.event),
            }); }),
            hasMore: hasMore,
        };
    };
    SqliteSessionStore.prototype.loadMessagePage = function (sessionID, options) {
        var _a;
        var _b, _c, _d, _e;
        if (options === void 0) { options = {}; }
        var cursor = options.cursor
            ? (0, projector_1.decodeMessageCursor)(options.cursor)
            : undefined;
        if (cursor && options.order)
            throw new Error("message cursor cannot be combined with order");
        var order = (_c = (_b = cursor === null || cursor === void 0 ? void 0 : cursor.order) !== null && _b !== void 0 ? _b : options.order) !== null && _c !== void 0 ? _c : "desc";
        var limit = Math.min(200, Math.max(1, (_d = options.limit) !== null && _d !== void 0 ? _d : 100));
        if (!this.messageIndexIsCurrent(sessionID)) {
            try {
                this.buildMessageIndex(sessionID);
            }
            catch (error) {
                // A read-only workspace must still be able to page through an existing
                // session. Fall back to projecting the journal in memory.
                if (isReadonlyError(error))
                    return this.projectFromEvents(sessionID, options);
                throw error;
            }
        }
        var anchor = cursor
            ? this.messageTurn(sessionID, cursor.anchor)
            : undefined;
        if (cursor && !anchor)
            throw new Error("message cursor anchor is no longer available");
        var direction = (_e = cursor === null || cursor === void 0 ? void 0 : cursor.direction) !== null && _e !== void 0 ? _e : "next";
        var query = messageTurnQuery(order, direction, anchor === null || anchor === void 0 ? void 0 : anchor.startSeq);
        var turns = (_a = this.db
            .query(query.sql))
            .all.apply(_a, __spreadArray(__spreadArray([sessionID], query.params, false), [limit + 1], false));
        var pageTurns = turns.slice(0, limit);
        if (query.reverse)
            pageTurns.reverse();
        var data = this.projectMessageTurns(sessionID, pageTurns);
        var first = pageTurns[0];
        var last = pageTurns.at(-1);
        var hasPrevious = first
            ? this.hasMessageTurn(sessionID, first.start_seq, order === "asc" ? "before" : "after")
            : false;
        var hasNext = last
            ? this.hasMessageTurn(sessionID, last.start_seq, order === "asc" ? "after" : "before")
            : false;
        return {
            data: data,
            cursor: {
                previous: hasPrevious && first
                    ? (0, projector_1.encodeMessageCursor)({
                        order: order,
                        direction: "previous",
                        anchor: first.turn_id,
                    })
                    : undefined,
                next: hasNext && last
                    ? (0, projector_1.encodeMessageCursor)({
                        order: order,
                        direction: "next",
                        anchor: last.turn_id,
                    })
                    : undefined,
            },
        };
    };
    SqliteSessionStore.prototype.loadContextEpoch = function (sessionID) {
        var row = this.db
            .query("SELECT baseline_seq, snapshot FROM context_epochs WHERE session_id = ?")
            .get(sessionID);
        if (!row)
            return undefined;
        return {
            baselineSeq: row.baseline_seq,
            snapshot: JSON.parse(row.snapshot),
        };
    };
    SqliteSessionStore.prototype.eventCount = function (sessionID) {
        var _a;
        var row = this.db
            .query("SELECT COUNT(*) as cnt FROM events WHERE session_id = ?")
            .get(sessionID);
        return (_a = row === null || row === void 0 ? void 0 : row.cnt) !== null && _a !== void 0 ? _a : 0;
    };
    SqliteSessionStore.prototype.writeContextEpoch = function (sessionID, snapshot) {
        var _a;
        var row = this.db
            .query("SELECT COALESCE(MAX(seq), 0) AS max_seq FROM events WHERE session_id = ?")
            .get(sessionID);
        var baselineSeq = Number((_a = row === null || row === void 0 ? void 0 : row.max_seq) !== null && _a !== void 0 ? _a : 0);
        this.run("INSERT INTO context_epochs(session_id, baseline_seq, snapshot) VALUES (?, ?, ?)\n       ON CONFLICT(session_id) DO UPDATE SET baseline_seq = excluded.baseline_seq, snapshot = excluded.snapshot", [sessionID, baselineSeq, JSON.stringify(snapshot)]);
    };
    SqliteSessionStore.prototype.appendEventAsync = function (sessionID, event) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        this.enqueueEvent(sessionID, event);
                        return [4 /*yield*/, this.flushPendingWrites(sessionID)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    /** Queues a non-barrier durable event for the next microtask/count/barrier flush. */
    SqliteSessionStore.prototype.enqueueEvent = function (sessionID, event) {
        var _a;
        if (this.closed)
            throw new Error("SQLite session store is closed");
        var events = (_a = this.pendingAsyncEvents.get(sessionID)) !== null && _a !== void 0 ? _a : [];
        events.push(event);
        this.pendingAsyncEvents.set(sessionID, events);
        if (events.length >= 100 || isDurableFlushBarrier(event)) {
            void this.flushPendingWrites(sessionID);
            return;
        }
        this.scheduleFlush(sessionID);
    };
    /** Flushes queued non-barrier appends before dispose or an explicit audit boundary. */
    SqliteSessionStore.prototype.flushPendingWrites = function (sessionID) {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!sessionID) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.flushSession(sessionID)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                    case 2: return [4 /*yield*/, Promise.all(__spreadArray([], this.pendingAsyncEvents.keys(), true).map(function (id) { return _this.flushSession(id); }))];
                    case 3:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    SqliteSessionStore.prototype.run = function (sql, params) {
        if (params === void 0) { params = []; }
        // `prepare()` is not cached by Bun: the caller owns the statement. Leaving
        // it unfinalized keeps it alive until GC, and any live statement makes
        // sqlite3_close_v2 defer releasing the database file handles.
        var statement = this.db.prepare(sql);
        try {
            statement.run.apply(statement, params);
        }
        finally {
            statement.finalize();
        }
    };
    SqliteSessionStore.prototype.insertEvent = function (sessionID, event) {
        var inserted = this.insertEventStatement.run(sessionID, JSON.stringify(event));
        if (event.type === "turn.submitted")
            this.run("INSERT OR IGNORE INTO message_turns(session_id, turn_id, start_seq) VALUES (?, ?, ?)", [sessionID, event.id, Number(inserted.lastInsertRowid)]);
        return inserted;
    };
    SqliteSessionStore.prototype.projectionStateFor = function (sessionID) {
        var state = this.projectionStates.get(sessionID);
        if (state === undefined) {
            state = (0, projector_1.initProjection)();
            for (var _i = 0, _a = this.loadEvents(sessionID); _i < _a.length; _i++) {
                var event_3 = _a[_i];
                (0, projector_1.applyProjection)(state, event_3);
            }
            this.projectionStates.set(sessionID, state);
        }
        return state;
    };
    SqliteSessionStore.prototype.appendEventInTransaction = function (sessionID, event) {
        // Advance the live projection fold before inserting so the lazy init reads
        // only the prior events; then fold this event and persist a checkpoint on
        // durable flush barriers so a later attach can resume from the tail.
        var projection = this.projectionStateFor(sessionID);
        var inserted = this.insertEvent(sessionID, event);
        (0, projector_1.applyProjection)(projection, event);
        this.applyRecoveryEvent(sessionID, event);
        if (event.type === "context.checkpoint")
            this.run("INSERT INTO context_epochs(session_id, baseline_seq, snapshot) VALUES (?, ?, ?)\n         ON CONFLICT(session_id) DO UPDATE SET baseline_seq = excluded.baseline_seq, snapshot = excluded.snapshot", [
                sessionID,
                Number(inserted.lastInsertRowid),
                JSON.stringify(event.snapshot),
            ]);
        if (event.type === "session.created")
            this.run("UPDATE sessions SET title = ? WHERE id = ?", [
                event.title,
                sessionID,
            ]);
        if (event.type === "turn.cancelled")
            this.run("UPDATE sessions SET cancelled = 1 WHERE id = ?", [sessionID]);
        if (isDurableFlushBarrier(event))
            this.persistProjectionCheckpoint(sessionID);
    };
    /** Writes the live projection fold for a session as a durable checkpoint. */
    SqliteSessionStore.prototype.persistProjectionCheckpoint = function (sessionID) {
        var projection = this.projectionStates.get(sessionID);
        if (!projection)
            return;
        this.saveProjectionCheckpoint(sessionID, projection);
    };
    SqliteSessionStore.prototype.scheduleFlush = function (sessionID) {
        var _this = this;
        if (this.scheduledFlushes.has(sessionID))
            return;
        this.scheduledFlushes.add(sessionID);
        this.flushTimers.set(sessionID, setTimeout(function () {
            _this.scheduledFlushes.delete(sessionID);
            _this.flushTimers.delete(sessionID);
            if (!_this.closed)
                void _this.flushSession(sessionID);
        }, 20));
    };
    SqliteSessionStore.prototype.flushSession = function (sessionID) {
        return __awaiter(this, void 0, void 0, function () {
            var timer, existing, events, batch, run, queued, flush;
            var _this = this;
            var _a, _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        timer = this.flushTimers.get(sessionID);
                        if (timer)
                            clearTimeout(timer);
                        this.flushTimers.delete(sessionID);
                        this.scheduledFlushes.delete(sessionID);
                        existing = this.pendingFlushes.get(sessionID);
                        if (!existing) return [3 /*break*/, 4];
                        return [4 /*yield*/, existing];
                    case 1:
                        _c.sent();
                        if (!((_a = this.pendingAsyncEvents.get(sessionID)) === null || _a === void 0 ? void 0 : _a.length)) return [3 /*break*/, 3];
                        return [4 /*yield*/, this.flushSession(sessionID)];
                    case 2:
                        _c.sent();
                        _c.label = 3;
                    case 3: return [2 /*return*/];
                    case 4:
                        events = this.pendingAsyncEvents.get(sessionID);
                        if (!(events === null || events === void 0 ? void 0 : events.length))
                            return [2 /*return*/];
                        batch = events.splice(0);
                        run = function () { return _this.writeBufferedBatch(sessionID, batch); };
                        queued = this.writeQueue.then(run, run);
                        this.writeQueue = queued.catch(function () { return undefined; });
                        flush = queued.finally(function () { return _this.pendingFlushes.delete(sessionID); });
                        this.pendingFlushes.set(sessionID, flush);
                        return [4 /*yield*/, flush];
                    case 5:
                        _c.sent();
                        if (!((_b = this.pendingAsyncEvents.get(sessionID)) === null || _b === void 0 ? void 0 : _b.length)) return [3 /*break*/, 7];
                        return [4 /*yield*/, this.flushSession(sessionID)];
                    case 6:
                        _c.sent();
                        _c.label = 7;
                    case 7: return [2 /*return*/];
                }
            });
        });
    };
    SqliteSessionStore.prototype.writeBufferedBatch = function (sessionID, events) {
        var _this = this;
        if (!events.length)
            return;
        this.db.transaction(function () {
            for (var _i = 0, events_2 = events; _i < events_2.length; _i++) {
                var event_4 = events_2[_i];
                _this.appendEventInTransaction(sessionID, event_4);
            }
            _this.bumpRecoveryState(sessionID, events.length);
        })();
    };
    SqliteSessionStore.prototype.ensureRecoveryProjection = function (sessionID) {
        var _this = this;
        var indexed = this.db
            .query("SELECT indexed_events FROM recovery_state WHERE session_id = ?")
            .get(sessionID);
        var total = this.eventCount(sessionID);
        if ((indexed === null || indexed === void 0 ? void 0 : indexed.indexed_events) === total)
            return;
        var events = this.loadEvents(sessionID);
        this.db.transaction(function () {
            _this.deleteRecoveryProjection(sessionID);
            for (var _i = 0, events_3 = events; _i < events_3.length; _i++) {
                var event_5 = events_3[_i];
                _this.applyRecoveryEvent(sessionID, event_5);
            }
            _this.run("INSERT INTO recovery_state(session_id, indexed_events) VALUES (?, ?)\n         ON CONFLICT(session_id) DO UPDATE SET indexed_events = excluded.indexed_events", [sessionID, events.length]);
        })();
    };
    SqliteSessionStore.prototype.applyRecoveryEvent = function (sessionID, event) {
        var _a, _b, _c, _d, _e, _f;
        if (event.type === "goal.changed") {
            // Recovery keeps only the current goal as a fast-restore cache; the
            // journal remains the source of truth (see the goal subsystem plan).
            if (event.operation === "clear") {
                this.run("DELETE FROM recovery_goal WHERE session_id = ?", [sessionID]);
                return;
            }
            var snapshot = event.snapshot;
            if (snapshot === undefined)
                return;
            var existing = this.db
                .query("SELECT created_at FROM recovery_goal WHERE session_id = ?")
                .get(sessionID);
            this.run("INSERT INTO recovery_goal(session_id, snapshot, rounds_started, created_at, updated_at)\n         VALUES (?, ?, ?, ?, ?)\n         ON CONFLICT(session_id) DO UPDATE SET\n           snapshot = excluded.snapshot,\n           rounds_started = excluded.rounds_started,\n           updated_at = excluded.updated_at", [
                sessionID,
                JSON.stringify(snapshot),
                event.roundsStarted,
                (_a = existing === null || existing === void 0 ? void 0 : existing.created_at) !== null && _a !== void 0 ? _a : event.at,
                event.at,
            ]);
            return;
        }
        if (event.type === "goal.round") {
            var row = this.db
                .query("SELECT snapshot, rounds_started FROM recovery_goal WHERE session_id = ?")
                .get(sessionID);
            if (row !== undefined) {
                var snapshot = JSON.parse(row.snapshot);
                if (snapshot.goalID === event.goalID &&
                    snapshot.revision === event.revision &&
                    event.round > row.rounds_started)
                    this.run("UPDATE recovery_goal SET rounds_started = ? WHERE session_id = ?", [event.round, sessionID]);
            }
            return;
        }
        if (event.type === "turn.submitted") {
            this.run("INSERT INTO recovery_turns(session_id, turn_id, active) VALUES (?, ?, 1)\n         ON CONFLICT(session_id, turn_id) DO UPDATE SET active = 1", [sessionID, event.id]);
            if ((_b = event.attachments) === null || _b === void 0 ? void 0 : _b.length)
                this.run("INSERT INTO recovery_attachments(session_id, turn_id, attachments) VALUES (?, ?, ?)\n           ON CONFLICT(session_id, turn_id) DO UPDATE SET attachments = excluded.attachments", [sessionID, event.id, JSON.stringify(event.attachments)]);
            return;
        }
        if (event.type === "turn.finished" || event.type === "turn.cancelled") {
            this.run("UPDATE recovery_turns SET active = 0 WHERE session_id = ? AND turn_id = ?", [sessionID, event.id]);
            return;
        }
        if (event.type === "approval.request" ||
            event.type === "question.request" ||
            event.type === "interactive.request") {
            var kind = event.type === "approval.request"
                ? "approval"
                : event.type === "question.request"
                    ? "question"
                    : "interactive:".concat(event.kind);
            this.run("INSERT INTO recovery_interactive(session_id, request_id, kind, event) VALUES (?, ?, ?, ?)\n         ON CONFLICT(session_id, request_id) DO UPDATE SET kind = excluded.kind, event = excluded.event", [sessionID, event.id, kind, JSON.stringify(event)]);
            return;
        }
        if (event.type === "approval.response" ||
            event.type === "question.response" ||
            event.type === "interactive.response") {
            this.run("DELETE FROM recovery_interactive WHERE session_id = ? AND request_id = ?", [sessionID, event.id]);
            return;
        }
        if (event.type === "agent.selection" && !event.pending) {
            this.run("INSERT INTO recovery_selection(session_id, agent_name) VALUES (?, ?)\n         ON CONFLICT(session_id) DO UPDATE SET agent_name = excluded.agent_name", [sessionID, event.name]);
            return;
        }
        if (event.type === "model.selection")
            this.run("INSERT INTO recovery_selection(session_id, model_id, model_variant) VALUES (?, ?, ?)\n         ON CONFLICT(session_id) DO UPDATE SET model_id = excluded.model_id, model_variant = excluded.model_variant", [sessionID, (_c = event.modelID) !== null && _c !== void 0 ? _c : null, (_d = event.variant) !== null && _d !== void 0 ? _d : null]);
        if (event.type === "model.reasoning.set")
            this.run("INSERT INTO recovery_selection(session_id, reasoning_effort) VALUES (?, ?)\n         ON CONFLICT(session_id) DO UPDATE SET reasoning_effort = excluded.reasoning_effort", [sessionID, (_e = event.reasoningEffort) !== null && _e !== void 0 ? _e : null]);
        if (event.type === "navi.chat.model.profile" ||
            event.type === "nia.chat.model.profile" ||
            event.type === "chat.model.profile") {
            var existing = this.db
                .query("SELECT chat_model_profile FROM recovery_selection WHERE session_id = ?")
                .get(sessionID);
            var profiles = (existing === null || existing === void 0 ? void 0 : existing.chat_model_profile)
                ? JSON.parse(existing.chat_model_profile)
                : {};
            var chatProfileChannel = event.type === "navi.chat.model.profile"
                ? "navi"
                : event.type === "nia.chat.model.profile"
                    ? "nia"
                    : event.channel;
            profiles[chatProfileChannel] = event.profile;
            this.run("INSERT INTO recovery_selection(session_id, chat_model_profile) VALUES (?, ?)\n         ON CONFLICT(session_id) DO UPDATE SET chat_model_profile = excluded.chat_model_profile", [sessionID, JSON.stringify(profiles)]);
        }
        if (event.type === "session.permission.mode")
            this.run("INSERT INTO recovery_selection(session_id, permission_mode, permission_profile) VALUES (?, ?, ?)\n         ON CONFLICT(session_id) DO UPDATE SET permission_mode = excluded.permission_mode, permission_profile = excluded.permission_profile", [sessionID, event.mode, (_f = event.profile) !== null && _f !== void 0 ? _f : null]);
        if (event.type === "diagnostic") {
            this.run("INSERT INTO recovery_diagnostics(session_id, event) VALUES (?, ?)", [sessionID, JSON.stringify(event)]);
            this.run("DELETE FROM recovery_diagnostics\n         WHERE session_id = ? AND seq NOT IN (\n           SELECT seq FROM recovery_diagnostics\n           WHERE session_id = ? ORDER BY seq DESC LIMIT 500\n         )", [sessionID, sessionID]);
        }
    };
    SqliteSessionStore.prototype.bumpRecoveryState = function (sessionID, count) {
        if (count === void 0) { count = 1; }
        this.run("INSERT INTO recovery_state(session_id, indexed_events) VALUES (?, ?)\n       ON CONFLICT(session_id) DO UPDATE SET indexed_events = indexed_events + ?", [sessionID, count, count]);
    };
    SqliteSessionStore.prototype.deleteRecoveryProjection = function (sessionID) {
        this.run("DELETE FROM recovery_turns WHERE session_id = ?", [sessionID]);
        this.run("DELETE FROM recovery_interactive WHERE session_id = ?", [
            sessionID,
        ]);
        this.run("DELETE FROM recovery_selection WHERE session_id = ?", [
            sessionID,
        ]);
        this.run("DELETE FROM recovery_attachments WHERE session_id = ?", [
            sessionID,
        ]);
        this.run("DELETE FROM recovery_diagnostics WHERE session_id = ?", [
            sessionID,
        ]);
        this.run("DELETE FROM recovery_state WHERE session_id = ?", [sessionID]);
        this.run("DELETE FROM recovery_goal WHERE session_id = ?", [sessionID]);
    };
    SqliteSessionStore.prototype.ensureMessageIndex = function (sessionID) {
        this.buildMessageIndex(sessionID);
    };
    SqliteSessionStore.prototype.buildMessageIndex = function (sessionID) {
        var _a;
        var state = this.db
            .query("SELECT last_seq FROM message_index_state WHERE session_id = ?")
            .get(sessionID);
        var lastSeq = (_a = state === null || state === void 0 ? void 0 : state.last_seq) !== null && _a !== void 0 ? _a : 0;
        this.run("INSERT OR IGNORE INTO message_turns(session_id, turn_id, start_seq)\n       SELECT session_id, json_extract(event, '$.id'), seq\n       FROM events\n         WHERE session_id = ? AND seq > ? AND json_extract(event, '$.type') = 'turn.submitted'", [sessionID, lastSeq]);
        var max = this.db
            .query("SELECT COALESCE(MAX(seq), 0) AS max_seq FROM events WHERE session_id = ?")
            .get(sessionID);
        this.run("INSERT INTO message_index_state(session_id, last_seq) VALUES (?, ?)\n       ON CONFLICT(session_id) DO UPDATE SET last_seq = excluded.last_seq", [sessionID, max.max_seq]);
    };
    SqliteSessionStore.prototype.messageIndexIsCurrent = function (sessionID) {
        var _a;
        var state = this.db
            .query("SELECT last_seq FROM message_index_state WHERE session_id = ?")
            .get(sessionID);
        if (!state)
            return false;
        var turnCount = this.db
            .query("SELECT COUNT(*) AS count FROM message_turns WHERE session_id = ?")
            .get(sessionID);
        return (state.last_seq === this.eventCount(sessionID) &&
            ((_a = turnCount === null || turnCount === void 0 ? void 0 : turnCount.count) !== null && _a !== void 0 ? _a : 0) > 0);
    };
    SqliteSessionStore.prototype.projectFromEvents = function (sessionID, options) {
        if (options === void 0) { options = {}; }
        var events = this.loadEvents(sessionID);
        return (0, projector_1.projectSessionMessages)({ id: sessionID, title: "", createdAt: "", events: events }, options);
    };
    SqliteSessionStore.prototype.messageTurn = function (sessionID, turnID) {
        var row = this.db
            .query("SELECT turn_id, start_seq FROM message_turns WHERE session_id = ? AND turn_id = ?")
            .get(sessionID, turnID);
        return row ? { turnID: row.turn_id, startSeq: row.start_seq } : undefined;
    };
    SqliteSessionStore.prototype.hasMessageTurn = function (sessionID, sequence, direction) {
        var comparison = direction === "before" ? "<" : ">";
        return Boolean(this.db
            .query("SELECT 1 FROM message_turns WHERE session_id = ? AND start_seq ".concat(comparison, " ? LIMIT 1"))
            .get(sessionID, sequence));
    };
    SqliteSessionStore.prototype.projectMessageTurns = function (sessionID, turns) {
        var _a;
        if (!turns.length)
            return [];
        var firstSequence = Math.min.apply(Math, turns.map(function (turn) { return turn.start_seq; }));
        var lastSequence = Math.max.apply(Math, turns.map(function (turn) { return turn.start_seq; }));
        var next = this.db
            .query("SELECT start_seq FROM message_turns WHERE session_id = ? AND start_seq > ? ORDER BY start_seq LIMIT 1")
            .get(sessionID, lastSequence);
        var rows = (_a = this.db
            .query("SELECT seq, event FROM events WHERE session_id = ? AND seq >= ? ".concat(next ? "AND seq < ?" : "", " ORDER BY seq")))
            .all.apply(_a, (next
            ? [sessionID, firstSequence, next.start_seq]
            : [sessionID, firstSequence]));
        var parsed = rows.map(function (row) { return ({
            seq: row.seq,
            event: JSON.parse(row.event),
        }); });
        // Reuse the event-stream projector instead of rebuilding each turn from its
        // seq slice with `projectTurnMessage`. The slice form attaches
        // `turn.input` to the wrong enclosing turn and lets a collaboration row
        // belong to the previous turn even when the stream opened a newer turn,
        // which surfaced as duplicate / out-of-order rows in the SQLite-backed
        // message page. `projectTurnMessages` is the same algorithm the non-SQLite
        // path already uses, so both stores now return identical turn semantics.
        var projected = new Map((0, projector_1.projectTurnMessages)(parsed.map(function (row) { return row.event; })).map(function (message) { return [
            message.turnID,
            message,
        ]; }));
        return turns.flatMap(function (turn) {
            var message = projected.get(turn.turn_id);
            return message === undefined ? [] : [message];
        });
    };
    return SqliteSessionStore;
}());
exports.SqliteSessionStore = SqliteSessionStore;
function messageTurnQuery(order, direction, anchor) {
    var forward = direction === "next";
    var descending = order === "desc" ? forward : !forward;
    var comparison = anchor === undefined ? "" : "AND start_seq ".concat(descending ? "<" : ">", " ?");
    return {
        sql: "SELECT message_turns.turn_id, message_turns.start_seq, events.event\n      FROM message_turns JOIN events\n        ON events.session_id = message_turns.session_id AND events.seq = message_turns.start_seq\n      WHERE message_turns.session_id = ? ".concat(comparison, "\n      ORDER BY message_turns.start_seq ").concat(descending ? "DESC" : "ASC", "\n      LIMIT ?"),
        params: anchor === undefined ? [] : [anchor],
        reverse: descending !== (order === "desc"),
    };
}
function rowToSession(row) {
    var metadata = {};
    try {
        var parsed = JSON.parse(row.metadata);
        if (parsed && typeof parsed === "object")
            metadata = parsed;
    }
    catch (_a) {
        // Corrupt metadata is silently discarded; the active session remains usable.
    }
    return {
        id: row.id,
        title: row.title,
        createdAt: row.created_at,
        cancelled: row.cancelled === 1,
        resumable: row.resumable === 1,
        pinned: row.pinned === 1,
        metadata: metadata,
    };
}
function optionalJSON(value) {
    return value === undefined ? null : JSON.stringify(value);
}
function parseOptionalJSON(value) {
    if (typeof value !== "string")
        return undefined;
    try {
        return JSON.parse(value);
    }
    catch (_a) {
        return undefined;
    }
}
function isReadonlyError(error) {
    return (error instanceof Error &&
        "code" in error &&
        error.code === "SQLITE_READONLY");
}
