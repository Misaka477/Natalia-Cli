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
exports.noopOperationLog = exports.operationLog = void 0;
exports.createOperationLog = createOperationLog;
exports.logOf = logOf;
exports.readOperationRecords = readOperationRecords;
var service_token_1 = require("./service-token");
Object.defineProperty(exports, "operationLog", { enumerable: true, get: function () { return service_token_1.operationLog; } });
var node_async_hooks_1 = require("node:async_hooks");
var service_token_2 = require("./service-token");
var node_fs_1 = require("node:fs");
var node_path_1 = require("node:path");
var LEVEL_ORDER = {
    error: 0,
    warn: 1,
    info: 2,
    debug: 3,
    trace: 4,
};
var DEFAULT_MAX_BYTES = 8 * 1024 * 1024;
var DEFAULT_KEEP = 3;
var DEFAULT_MAX_QUEUED = 4096;
function serialize(record) {
    var shaped = __assign(__assign({ at: record.at, level: record.level, component: record.component, message: record.message }, (record.corr && Object.keys(record.corr).length > 0
        ? { corr: record.corr }
        : {})), (record.fields ? { fields: record.fields } : {}));
    return JSON.stringify(shaped);
}
function describeDisabled(error) {
    var code = error === null || error === void 0 ? void 0 : error.code;
    var message = error instanceof Error ? error.message : String(error);
    return code ? "".concat(code, ": ").concat(message) : message;
}
function createOperationLog(options) {
    var _this = this;
    var _a, _b, _c, _d;
    if (options === void 0) { options = {}; }
    var level = (_a = options.level) !== null && _a !== void 0 ? _a : "info";
    var maxBytes = (_b = options.maxBytes) !== null && _b !== void 0 ? _b : DEFAULT_MAX_BYTES;
    var keep = (_c = options.keep) !== null && _c !== void 0 ? _c : DEFAULT_KEEP;
    var maxQueued = (_d = options.maxQueued) !== null && _d !== void 0 ? _d : DEFAULT_MAX_QUEUED;
    var redact = options.redact;
    var als = new node_async_hooks_1.AsyncLocalStorage();
    var stats = __assign({ path: options.dir ? (0, node_path_1.join)(options.dir, "operations.jsonl") : undefined, written: 0, dropped: 0, rotated: 0, queued: 0 }, (options.dir ? {} : { disabledReason: "no log directory configured" }));
    var fd;
    var bytes = 0;
    var chain = Promise.resolve();
    function disable(error) {
        var _a;
        (_a = stats.disabledReason) !== null && _a !== void 0 ? _a : (stats.disabledReason = describeDisabled(error));
        if (fd !== undefined) {
            try {
                (0, node_fs_1.closeSync)(fd);
            }
            catch (_b) {
                /* already gone */
            }
            fd = undefined;
        }
    }
    function ensureOpen() {
        if (stats.disabledReason)
            return false;
        if (fd !== undefined)
            return true;
        try {
            (0, node_fs_1.mkdirSync)(options.dir, { recursive: true, mode: 448 });
            fd = (0, node_fs_1.openSync)(stats.path, "a", 384);
            try {
                bytes = (0, node_fs_1.statSync)(stats.path).size;
            }
            catch (_a) {
                bytes = 0;
            }
            return true;
        }
        catch (error) {
            disable(error);
            return false;
        }
    }
    function rotateIfNeeded() {
        if (fd === undefined || bytes < maxBytes)
            return;
        try {
            (0, node_fs_1.closeSync)(fd);
        }
        catch (_a) {
            /* closing before the rename either way */
        }
        fd = undefined;
        try {
            var target = "".concat(stats.path, ".").concat(keep);
            (0, node_fs_1.rmSync)(target, { force: true });
            for (var index = keep - 1; index >= 1; index -= 1) {
                var from = "".concat(stats.path, ".").concat(index);
                try {
                    (0, node_fs_1.renameSync)(from, "".concat(stats.path, ".").concat(index + 1));
                }
                catch (_b) {
                    /* missing generations are fine */
                }
            }
            (0, node_fs_1.renameSync)(stats.path, "".concat(stats.path, ".1"));
            stats.rotated += 1;
            bytes = 0;
            // Reopen immediately: the active file must exist after ANY write —
            // a reader (the query primitives, the debug bundle) looks for
            // `operations.jsonl`, not for "whatever the next record creates".
            ensureOpen();
        }
        catch (error) {
            disable(error);
        }
    }
    function writeRecord(record) {
        if (stats.disabledReason) {
            stats.dropped += 1;
            return;
        }
        if (LEVEL_ORDER[record.level] > LEVEL_ORDER[level])
            return;
        var line = "".concat(redact ? redact(serialize(record)) : serialize(record), "\n");
        if (!ensureOpen()) {
            stats.dropped += 1;
            return;
        }
        try {
            (0, node_fs_1.writeSync)(fd, line);
            bytes += Buffer.byteLength(line);
            stats.written += 1;
            rotateIfNeeded();
        }
        catch (error) {
            disable(error);
            stats.dropped += 1;
        }
    }
    function enqueue(record) {
        if (stats.queued >= maxQueued) {
            stats.dropped += 1;
            return;
        }
        stats.queued += 1;
        // The chain IS the serialization: one writer, order preserved, the
        // caller returns immediately (logs never enter the hot path).
        chain = chain.then(function () {
            stats.queued -= 1;
            writeRecord(record);
        });
    }
    function makeLogger(component, bound) {
        var emit = function (recordLevel) {
            return function (message, fields) {
                var corr = __assign(__assign({}, als.getStore()), bound);
                enqueue(__assign(__assign({ at: new Date().toISOString(), level: recordLevel, component: component, message: message }, (Object.keys(corr).length > 0 ? { corr: corr } : {})), (fields && Object.keys(fields).length > 0 ? { fields: fields } : {})));
            };
        };
        return {
            error: emit("error"),
            warn: emit("warn"),
            info: emit("info"),
            debug: emit("debug"),
            trace: emit("trace"),
            withCorrelation: function (corr) { return makeLogger(component, __assign(__assign({}, bound), corr)); },
        };
    }
    var direct = function (recordLevel) {
        return function (component, message, fields) {
            return makeLogger(component)[recordLevel](message, fields);
        };
    };
    return {
        error: direct("error"),
        warn: direct("warn"),
        info: direct("info"),
        debug: direct("debug"),
        trace: direct("trace"),
        component: function (name) { return makeLogger(name); },
        runWithCorrelation: function (corr, fn) {
            return als.run(__assign(__assign({}, als.getStore()), corr), fn);
        },
        currentCorrelation: function () { return als.getStore(); },
        stats: function () { return (__assign(__assign({}, stats), { queued: stats.queued })); },
        flush: function () { return __awaiter(_this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, chain];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); },
        close: function () { return __awaiter(_this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, chain];
                    case 1:
                        _a.sent();
                        if (fd !== undefined) {
                            try {
                                (0, node_fs_1.closeSync)(fd);
                            }
                            catch (_b) {
                                /* closing twice is fine */
                            }
                            fd = undefined;
                        }
                        return [2 /*return*/];
                }
            });
        }); },
    };
}
/** A logger that records nothing — telemetry degrades, never crashes. */
exports.noopOperationLog = {
    error: function () { },
    warn: function () { },
    info: function () { },
    debug: function () { },
    trace: function () { },
    component: function () { return ({
        error: function () { },
        warn: function () { },
        info: function () { },
        debug: function () { },
        trace: function () { },
        withCorrelation: function () { return noOpLogger; },
    }); },
    runWithCorrelation: function (_corr, fn) { return fn(); },
    currentCorrelation: function () { return undefined; },
    stats: function () { return ({
        path: undefined,
        written: 0,
        dropped: 0,
        rotated: 0,
        queued: 0,
        disabledReason: "no operation log provided",
    }); },
    flush: function () { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
        return [2 /*return*/];
    }); }); },
    close: function () { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
        return [2 /*return*/];
    }); }); },
};
var noOpLogger = exports.noopOperationLog.component("noop");
/**
 * The call-site helper: the provided log when the runtime has one, the
 * no-op otherwise — converted telemetry never grows optional-chaining
 * and never throws in a bare context.
 */
function logOf(directory) {
    var _a;
    return (_a = directory.getOptional(service_token_2.operationLog)) !== null && _a !== void 0 ? _a : exports.noopOperationLog;
}
/**
 * Reads a log directory's records (active + rotated), filtered by the one
 * query shape. Malformed lines are skipped — a half-written line at a crash
 * must not hide the lines around it.
 */
function readOperationRecords(dir, filter) {
    if (filter === void 0) { filter = {}; }
    var paths = [
        (0, node_path_1.join)(dir, "operations.jsonl.5"),
        (0, node_path_1.join)(dir, "operations.jsonl.4"),
        (0, node_path_1.join)(dir, "operations.jsonl.3"),
        (0, node_path_1.join)(dir, "operations.jsonl.2"),
        (0, node_path_1.join)(dir, "operations.jsonl.1"),
        (0, node_path_1.join)(dir, "operations.jsonl"),
    ];
    var records = [];
    for (var _i = 0, paths_1 = paths; _i < paths_1.length; _i++) {
        var path = paths_1[_i];
        var text = void 0;
        try {
            text = (0, node_fs_1.readFileSync)(path, "utf8");
        }
        catch (_a) {
            continue; // absent generation
        }
        for (var _b = 0, _c = text.split("\n"); _b < _c.length; _b++) {
            var line = _c[_b];
            if (!line)
                continue;
            var record = void 0;
            try {
                record = JSON.parse(line);
            }
            catch (_d) {
                continue;
            }
            if (filter.level && LEVEL_ORDER[record.level] > LEVEL_ORDER[filter.level])
                continue;
            if (filter.component && record.component !== filter.component)
                continue;
            if (filter.since && (!record.at || record.at < filter.since))
                continue;
            if (filter.contains &&
                !JSON.stringify(record)
                    .toLowerCase()
                    .includes(filter.contains.toLowerCase()))
                continue;
            records.push(record);
        }
    }
    // keep = read oldest generation first ... newest last; limit keeps the tail.
    return filter.limit ? records.slice(-filter.limit) : records;
}
