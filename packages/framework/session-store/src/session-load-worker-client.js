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
exports.loadSessionEventsInWorker = loadSessionEventsInWorker;
exports.loadSessionEventPageInWorker = loadSessionEventPageInWorker;
exports.loadMessagePageInWorker = loadMessagePageInWorker;
exports.ensureMessageIndexInWorker = ensureMessageIndexInWorker;
var nextID = 1;
var pending = new Map();
var workers = [];
var nextWorker = 0;
function poolWorker() {
    var _a, _b, _c;
    var size = Math.max(2, Math.min(4, Number((_a = process.env.NATALIA_SESSION_LOAD_WORKERS) !== null && _a !== void 0 ? _a : 2)));
    while (workers.length < size) {
        var instance = new Worker(new URL("./session-load.worker.ts", import.meta.url), { type: "module" });
        instance.addEventListener("message", function (event) {
            var response = event.data;
            var entry = pending.get(response.id);
            if (!entry)
                return;
            pending.delete(response.id);
            if (response.ok) {
                if ("events" in response)
                    entry.resolve({
                        events: response.events,
                        lastSeq: response.lastSeq,
                        hasMore: response.hasMore,
                    });
                else if ("page" in response)
                    entry.resolve(response.page);
                else
                    entry.resolve(undefined);
            }
            else
                entry.reject(new Error(response.error));
        });
        instance.addEventListener("error", function () {
            for (var _i = 0, _a = pending.values(); _i < _a.length; _i++) {
                var reject = _a[_i].reject;
                reject(new Error("session-load worker failed"));
            }
            pending.clear();
        });
        // Idle workers must not pin the process; the host owns liveness.
        (_c = (_b = instance).unref) === null || _c === void 0 ? void 0 : _c.call(_b);
        workers.push(instance);
    }
    return workers[nextWorker++ % workers.length];
}
function run(request) {
    return __awaiter(this, void 0, void 0, function () {
        var id, instance;
        return __generator(this, function (_a) {
            id = nextID++;
            instance = poolWorker();
            return [2 /*return*/, new Promise(function (resolve, reject) {
                    pending.set(id, {
                        resolve: function (value) { return resolve(value); },
                        reject: reject,
                    });
                    instance.postMessage(__assign(__assign({}, request), { id: id }));
                })];
        });
    });
}
function loadSessionEventsInWorker(dbPath, sessionID) {
    return __awaiter(this, void 0, void 0, function () {
        var events, afterSeq, page;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    events = [];
                    afterSeq = 0;
                    _a.label = 1;
                case 1:
                    if (!true) return [3 /*break*/, 3];
                    return [4 /*yield*/, loadSessionEventPageInWorker(dbPath, sessionID, afterSeq, 500)];
                case 2:
                    page = _a.sent();
                    events.push.apply(events, page.events);
                    if (!page.hasMore)
                        return [2 /*return*/, events];
                    afterSeq = page.lastSeq;
                    return [3 /*break*/, 1];
                case 3: return [2 /*return*/];
            }
        });
    });
}
function loadSessionEventPageInWorker(dbPath, sessionID, afterSeq, limit) {
    return run({
        op: "events",
        dbPath: dbPath,
        sessionID: sessionID,
        afterSeq: afterSeq,
        limit: limit,
    });
}
function loadMessagePageInWorker(dbPath, sessionID, options) {
    return run({
        op: "messagePage",
        dbPath: dbPath,
        sessionID: sessionID,
        options: options,
    });
}
function ensureMessageIndexInWorker(dbPath, sessionID) {
    return run({ op: "ensureMessageIndex", dbPath: dbPath, sessionID: sessionID });
}
