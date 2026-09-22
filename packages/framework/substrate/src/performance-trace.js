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
exports.RuntimePerformanceTrace = void 0;
var promises_1 = require("node:fs/promises");
var node_path_1 = require("node:path");
var node_crypto_1 = require("node:crypto");
var node_v8_1 = require("node:v8");
/**
 * Opt-in, bounded runtime telemetry for diagnosing UI starvation. It emits one
 * aggregate JSON line per interval rather than retaining or logging terminal
 * payloads, so enabling it cannot copy interactive process output into
 * diagnostics.
 */
var RuntimePerformanceTrace = /** @class */ (function () {
    function RuntimePerformanceTrace(input) {
        if (input === void 0) { input = {}; }
        var _this = this;
        var _a;
        this.startedAt = performance.now();
        this.runID = (0, node_crypto_1.randomUUID)();
        this.heapSnapshotDirectory = process.env.NATALIA_HEAP_SNAPSHOT_DIR;
        this.heapSnapshots = 0;
        this.expectedAt = performance.now() + 1000;
        this.writes = Promise.resolve();
        this.events = new Map();
        this.publishCount = 0;
        this.publishTotalMs = 0;
        this.publishMaxMs = 0;
        this.phaseTotalMs = 0;
        this.phaseMaxMs = 0;
        this.sinkTotalMs = 0;
        this.sinkMaxMs = 0;
        this.pluginTotalMs = 0;
        this.pluginMaxMs = 0;
        this.destination = (_a = input.destination) !== null && _a !== void 0 ? _a : process.env.NATALIA_PERF_TRACE_FILE;
        this.enabled = Boolean(this.destination);
        if (this.enabled)
            this.timer = setInterval(function () { return _this.flush(); }, 1000);
    }
    RuntimePerformanceTrace.prototype.record = function (event, timings) {
        var _a;
        if (!this.enabled)
            return;
        this.events.set(event.type, ((_a = this.events.get(event.type)) !== null && _a !== void 0 ? _a : 0) + 1);
        this.publishCount += 1;
        this.publishTotalMs += timings.publishMs;
        this.publishMaxMs = Math.max(this.publishMaxMs, timings.publishMs);
        this.sinkTotalMs += timings.sinkMs;
        this.sinkMaxMs = Math.max(this.sinkMaxMs, timings.sinkMs);
        this.pluginTotalMs += timings.pluginMs;
        this.pluginMaxMs = Math.max(this.pluginMaxMs, timings.pluginMs);
    };
    RuntimePerformanceTrace.prototype.mark = function (name, durationMs) {
        var _a;
        if (!this.enabled)
            return;
        this.events.set("phase:".concat(name), ((_a = this.events.get("phase:".concat(name))) !== null && _a !== void 0 ? _a : 0) + 1);
        this.phaseTotalMs += durationMs;
        this.phaseMaxMs = Math.max(this.phaseMaxMs, durationMs);
    };
    RuntimePerformanceTrace.prototype.stop = function () {
        if (!this.enabled)
            return Promise.resolve();
        if (this.timer)
            clearInterval(this.timer);
        this.timer = undefined;
        this.flush();
        return this.writes;
    };
    RuntimePerformanceTrace.prototype.flush = function () {
        var _this = this;
        if (!this.enabled || !this.destination) {
            this.expectedAt += 1000;
            return;
        }
        var now = performance.now();
        var memory = process.memoryUsage();
        var sample = {
            at: new Date().toISOString(),
            processID: process.pid,
            runID: this.runID,
            elapsedMs: Math.round(now - this.startedAt),
            eventLoopLagMs: Math.max(0, Math.round((now - this.expectedAt) * 100) / 100),
            events: Object.fromEntries(this.events),
            publishCount: this.publishCount,
            publishTotalMs: round(this.publishTotalMs),
            publishMaxMs: round(this.publishMaxMs),
            phaseTotalMs: round(this.phaseTotalMs),
            phaseMaxMs: round(this.phaseMaxMs),
            sinkTotalMs: round(this.sinkTotalMs),
            sinkMaxMs: round(this.sinkMaxMs),
            pluginTotalMs: round(this.pluginTotalMs),
            pluginMaxMs: round(this.pluginMaxMs),
            memory: memory,
            activeResources: activeResourceCounts(),
        };
        if (this.heapSnapshotDirectory &&
            this.heapSnapshots < 3 &&
            memory.heapUsed >= 256 * 1024 * 1024) {
            try {
                sample.heapSnapshot = (0, node_v8_1.writeHeapSnapshot)((0, node_path_1.join)(this.heapSnapshotDirectory, "natalia-".concat(process.pid, "-").concat(this.runID, "-").concat(++this.heapSnapshots, ".heapsnapshot")));
            }
            catch (_a) {
                // Heap evidence is opt-in diagnostics; trace collection must continue
                // even where the runtime cannot write a snapshot.
            }
        }
        // Rebase after recording a late tick. Otherwise one long synchronous task
        // makes every later sample look progressively later than it really is.
        this.expectedAt = now + 1000;
        this.events.clear();
        this.publishCount = 0;
        this.publishTotalMs = 0;
        this.publishMaxMs = 0;
        this.phaseTotalMs = 0;
        this.phaseMaxMs = 0;
        this.sinkTotalMs = 0;
        this.sinkMaxMs = 0;
        this.pluginTotalMs = 0;
        this.pluginMaxMs = 0;
        this.writes = this.writes
            .then(function () { return __awaiter(_this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (0, promises_1.mkdir)((0, node_path_1.dirname)(this.destination), {
                            recursive: true,
                            mode: 448,
                        })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); })
            .then(function () { return (0, promises_1.appendFile)(_this.destination, "".concat(JSON.stringify(sample), "\n")); })
            .catch(function () { return undefined; });
    };
    return RuntimePerformanceTrace;
}());
exports.RuntimePerformanceTrace = RuntimePerformanceTrace;
function round(value) {
    return Math.round(value * 100) / 100;
}
function activeResourceCounts() {
    var _a, _b, _c;
    var counts = {};
    for (var _i = 0, _d = (_b = (_a = process.getActiveResourcesInfo) === null || _a === void 0 ? void 0 : _a.call(process)) !== null && _b !== void 0 ? _b : []; _i < _d.length; _i++) {
        var resource = _d[_i];
        counts[resource] = ((_c = counts[resource]) !== null && _c !== void 0 ? _c : 0) + 1;
    }
    return counts;
}
