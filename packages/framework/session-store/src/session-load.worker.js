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
var node_worker_threads_1 = require("node:worker_threads");
var bun_sqlite_1 = require("bun:sqlite");
var session_1 = require("@anthelia/session");
var port = node_worker_threads_1.parentPort;
if (!port)
    throw new Error("session-load worker requires parentPort");
var messageStores = new Map();
function messageStore(dbPath) {
    var store = messageStores.get(dbPath);
    if (!store) {
        store = new session_1.SqliteSessionStore(dbPath);
        messageStores.set(dbPath, store);
    }
    return store;
}
port.on("message", function (request) { return __awaiter(void 0, void 0, void 0, function () {
    var store, page, response, store, response, db, afterSeq, limit, rows, events, response, response;
    var _a, _b, _c, _d;
    return __generator(this, function (_e) {
        try {
            if (request.op === "messagePage") {
                store = messageStore(request.dbPath);
                page = store.loadMessagePage(request.sessionID, request.options);
                response = {
                    id: request.id,
                    ok: true,
                    page: page,
                };
                port.postMessage(response);
                return [2 /*return*/];
            }
            if (request.op === "ensureMessageIndex") {
                store = messageStore(request.dbPath);
                store.ensureMessageIndex(request.sessionID);
                response = {
                    id: request.id,
                    ok: true,
                };
                port.postMessage(response);
                return [2 /*return*/];
            }
            db = void 0;
            try {
                db = new bun_sqlite_1.Database(request.dbPath);
                db.exec("PRAGMA query_only=ON");
                afterSeq = Math.max(0, (_a = request.afterSeq) !== null && _a !== void 0 ? _a : 0);
                limit = Math.max(1, Math.min(2000, (_b = request.limit) !== null && _b !== void 0 ? _b : 500));
                rows = db
                    .query("SELECT seq, event FROM events\n           WHERE session_id = ? AND seq > ?\n           ORDER BY seq\n           LIMIT ?")
                    .all(request.sessionID, afterSeq, limit);
                events = rows.map(function (row) {
                    return JSON.parse(row.event);
                });
                response = {
                    id: request.id,
                    ok: true,
                    events: events,
                    lastSeq: (_d = (_c = rows.at(-1)) === null || _c === void 0 ? void 0 : _c.seq) !== null && _d !== void 0 ? _d : afterSeq,
                    hasMore: rows.length >= limit,
                };
                port.postMessage(response);
            }
            finally {
                db === null || db === void 0 ? void 0 : db.close();
            }
        }
        catch (error) {
            response = {
                id: request.id,
                ok: false,
                error: error instanceof Error ? error.message : String(error),
            };
            port.postMessage(response);
        }
        return [2 /*return*/];
    });
}); });
