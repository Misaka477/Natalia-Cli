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
exports.SubagentRegistry = void 0;
var format_output_1 = require("./format-output");
var store_1 = require("./store");
var format_1 = require("./format");
var DEFAULT_STALL_MS = 30000;
/**
 * Every status a subagent record may carry. A `Record<SubagentStatus, true>`
 * (not a hand-written list) so adding a union member without listing it here
 * fails typecheck — the completeness the audit mechanizes elsewhere.
 */
var SUBAGENT_STATUS_MEMBER = {
    idle: true,
    running: true,
    paused: true,
    stopped: true,
    completed: true,
    failed: true,
};
/**
 * `RunnerContext.setStatus` takes a plain string (it is the shared tool/host
 * surface), but a record's status is the closed `SubagentStatus` union. Narrow
 * with a runtime check instead of an `as any` cast: an unknown status is a bug
 * to surface, not a value to silently store into the record.
 */
function isSubagentStatus(value) {
    return Object.hasOwn(SUBAGENT_STATUS_MEMBER, value);
}
var SubagentRegistry = /** @class */ (function () {
    function SubagentRegistry(opts) {
        var _a, _b, _c;
        /** One deadline timer per running subagent, cleared when its run settles. */
        this.budgetTimers = new Map();
        this.records = new Map();
        this.steerHooks = new Map();
        this.running = new Map();
        this.subscribers = new Set();
        this.auditEntries = [];
        this.auditSeq = 0;
        this.nextID = 1;
        this.maxAudit = 1000;
        this.activityThrottle = new Map();
        this.runner = opts.runner;
        this.clock = (_a = opts.clock) !== null && _a !== void 0 ? _a : (function () { return Date.now(); });
        this.stallThresholdMs = (_b = opts.stallThresholdMs) !== null && _b !== void 0 ? _b : DEFAULT_STALL_MS;
        this.wallClockBudgetMs = (_c = opts.wallClockBudgetMs) !== null && _c !== void 0 ? _c : 0;
        this.store = new store_1.SubagentStore(opts.workDir, opts.sessionID);
    }
    SubagentRegistry.prototype.load = function () {
        return __awaiter(this, void 0, void 0, function () {
            var records, recovered, now, _i, records_1, rec, n;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.store.load()];
                    case 1:
                        records = _a.sent();
                        recovered = false;
                        now = this.clock();
                        for (_i = 0, records_1 = records; _i < records_1.length; _i++) {
                            rec = records_1[_i];
                            if (rec.status === "running" || rec.status === "paused") {
                                rec.status = "stopped";
                                rec.updatedAt = now;
                                rec.endedAt = now;
                                rec.phase = "finalizing";
                                rec.lastActivityAt = now;
                                rec.activityDetail = "runtime restarted";
                                rec.outputs.push({
                                    step: rec.outputs.length + 1,
                                    text: "subagent stopped because the owning runtime restarted; resubmit the task to continue",
                                    timestamp: now,
                                });
                                recovered = true;
                            }
                            if (!rec.phase)
                                rec.phase = derivePhase(rec);
                            if (rec.lastActivityAt === undefined)
                                rec.lastActivityAt = rec.updatedAt;
                            if (!rec.startedAt)
                                rec.startedAt = rec.createdAt;
                            this.records.set(rec.id, rec);
                            n = parseInt(rec.id.slice(1), 10);
                            if (n >= this.nextID)
                                this.nextID = n + 1;
                        }
                        if (!recovered) return [3 /*break*/, 3];
                        return [4 /*yield*/, this.save()];
                    case 2:
                        _a.sent();
                        _a.label = 3;
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    SubagentRegistry.prototype.save = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.store.save(__spreadArray([], this.records.values(), true))];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    SubagentRegistry.prototype.spawn = function (task_1) {
        return __awaiter(this, arguments, void 0, function (task, options) {
            var id, now, record;
            var _a, _b, _c, _d, _e;
            if (options === void 0) { options = {}; }
            return __generator(this, function (_f) {
                switch (_f.label) {
                    case 0:
                        if (!task)
                            throw new Error("task is required");
                        this.assertDepth(options.parentAgentID, options.maxDepth);
                        id = "a".concat(this.nextID++);
                        now = this.clock();
                        record = __assign(__assign(__assign(__assign({ id: id, task: task, mode: (_a = options.mode) !== null && _a !== void 0 ? _a : "code" }, (options.agentType ? { agentType: options.agentType } : {})), (options.context ? { context: options.context } : {})), (((_b = options.pendingMessages) === null || _b === void 0 ? void 0 : _b.length)
                            ? { pendingMessages: __spreadArray([], options.pendingMessages, true) }
                            : {})), { status: "idle", attached: true, modelProfile: (_c = options.modelProfile) !== null && _c !== void 0 ? _c : "", allowedTools: (_d = options.allowedTools) !== null && _d !== void 0 ? _d : [], excludeTools: (_e = options.excludeTools) !== null && _e !== void 0 ? _e : [], writePaths: options.writePaths, outputs: [], createdAt: now, updatedAt: now, parentSessionID: options.parentSessionID, parentAgentID: options.parentAgentID, continuation: 0, phase: "queued", lastActivityAt: now, activityDetail: "spawned", startedAt: now });
                        this.records.set(id, record);
                        return [4 /*yield*/, this.save()];
                    case 1:
                        _f.sent();
                        return [4 /*yield*/, this.start(record, options.signal)];
                    case 2:
                        _f.sent();
                        return [2 /*return*/, record];
                }
            });
        });
    };
    SubagentRegistry.prototype.health = function (id) {
        var record = this.records.get(id);
        if (!record)
            return "terminal";
        if (["completed", "failed", "stopped"].includes(record.status))
            return "terminal";
        if (record.phase === "waiting")
            return "active";
        var elapsed = this.clock() - record.lastActivityAt;
        var quietGrace = Math.min(5000, this.stallThresholdMs * 0.5);
        if (elapsed < quietGrace)
            return "active";
        if (elapsed < this.stallThresholdMs)
            return "quiet";
        return "stalled";
    };
    SubagentRegistry.prototype.reportActivity = function (id, phase, detail) {
        var _a;
        var record = this.records.get(id);
        if (!record)
            return;
        var now = this.clock();
        var prevThrottle = (_a = this.activityThrottle.get(id)) !== null && _a !== void 0 ? _a : 0;
        if (now - prevThrottle < 500 && phase !== record.phase) {
            this.activityThrottle.set(id, now);
        }
        else if (now - prevThrottle < 5000) {
            return;
        }
        else {
            this.activityThrottle.set(id, now);
        }
        record.lastActivityAt = now;
        record.phase = phase;
        record.activityDetail = detail;
        if (phase !== "queued" && record.status === "idle") {
            record.status = "running";
            record.startedAt = now;
        }
        this.emit({
            agentId: id,
            event: "activity",
            status: record.status,
            attached: record.attached,
            timestamp: now,
            phase: phase,
            activityDetail: detail,
        });
    };
    SubagentRegistry.prototype.requestStop = function (id, reason, force, requestedBy) {
        if (force === void 0) { force = false; }
        if (requestedBy === void 0) { requestedBy = "model"; }
        var record = this.records.get(id);
        if (!record)
            return { outcome: "not_found", id: id };
        if (!["running", "paused"].includes(record.status))
            return { outcome: "not_running", id: id, status: record.status };
        var h = this.health(id);
        if (h === "terminal")
            return { outcome: "not_running", id: id, status: record.status };
        if (h !== "stalled" && !force) {
            var retryAfterMs = Math.max(0, this.stallThresholdMs - (this.clock() - record.lastActivityAt));
            return { outcome: "protected", id: id, health: h, retryAfterMs: retryAfterMs };
        }
        this.doStop(id, reason, force, requestedBy);
        return { outcome: "stopped", id: id };
    };
    /**
     * Replace the messages queued for a subagent.
     *
     * Reads the record fresh rather than taking one from the caller: a stale view
     * would drop messages queued in between, and the whole point of the queue is
     * that nothing is lost.
     */
    /**
     * Registers where a live run of this subagent accepts a mid-flight message.
     * Absent a hook, `sendMessage` queues instead, so a parent is never told it
     * steered when it did not.
     */
    SubagentRegistry.prototype.setSteerHook = function (id, hook) {
        if (hook)
            this.steerHooks.set(id, hook);
        else
            this.steerHooks.delete(id);
    };
    /**
     * Delivers a steer to one subagent, or queues it when the run has no live
     * ledger to route through.
     *
     * Lives here rather than in the controller because this class owns the
     * records, and a service surface that only the composition can satisfy makes
     * every consumer depend on the composition.
     */
    SubagentRegistry.prototype.sendMessage = function (id, message, callerSession) {
        return __awaiter(this, void 0, void 0, function () {
            var record, routed;
            var _a, _b;
            return __generator(this, function (_c) {
                record = this.records.get(id);
                if (!record)
                    return [2 /*return*/, { route: "not_found" }];
                // Only the parent may steer: anything else is a stranger that has no
                // business redirecting this child.
                if (record.parentSessionID !== undefined &&
                    callerSession !== undefined &&
                    record.parentSessionID !== callerSession)
                    throw new Error("subagent ".concat(id, " belongs to another session; only its parent may steer it"));
                routed = (_a = this.steerHooks.get(id)) === null || _a === void 0 ? void 0 : _a(message);
                if (routed)
                    return [2 /*return*/, { route: routed }];
                this.setPendingMessages(id, __spreadArray(__spreadArray([], ((_b = record.pendingMessages) !== null && _b !== void 0 ? _b : []), true), [message], false));
                return [2 /*return*/, { route: "queued" }];
            });
        });
    };
    SubagentRegistry.prototype.setPendingMessages = function (id, messages) {
        var record = this.records.get(id);
        if (!record)
            return false;
        record.pendingMessages = messages.length ? __spreadArray([], messages, true) : undefined;
        record.updatedAt = this.clock();
        this.save().catch(function () { });
        return true;
    };
    SubagentRegistry.prototype.retry = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            var record;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        record = this.records.get(id);
                        if (!record || !["stopped", "failed"].includes(record.status))
                            return [2 /*return*/, undefined];
                        record.continuation = ((_a = record.continuation) !== null && _a !== void 0 ? _a : 0) + 1;
                        record.updatedAt = this.clock();
                        record.lastActivityAt = this.clock();
                        record.activityDetail = "retry";
                        record.phase = "queued";
                        record.outputs.push({
                            step: record.outputs.length + 1,
                            text: "retrying continuation ".concat(record.continuation),
                            timestamp: record.updatedAt,
                        });
                        return [4 /*yield*/, this.save()];
                    case 1:
                        _b.sent();
                        return [4 /*yield*/, this.start(record)];
                    case 2:
                        _b.sent();
                        return [2 /*return*/, record];
                }
            });
        });
    };
    SubagentRegistry.prototype.start = function (record, signal) {
        return __awaiter(this, void 0, void 0, function () {
            var id, abortController, now, ctx, runPromise;
            var _this = this;
            return __generator(this, function (_a) {
                id = record.id;
                abortController = new AbortController();
                this.running.set(id, abortController);
                now = this.clock();
                record.status = "running";
                record.updatedAt = now;
                record.startedAt = now;
                record.lastActivityAt = now;
                record.phase = "provider";
                record.activityDetail = "starting";
                this.emit({
                    agentId: id,
                    event: "activity",
                    status: record.status,
                    attached: record.attached,
                    timestamp: now,
                    phase: "provider",
                    activityDetail: "starting",
                });
                this.armWallClockBudget(id, abortController);
                ctx = {
                    agentId: id,
                    log: function (text) {
                        var entry = {
                            step: record.outputs.length + 1,
                            text: text,
                            timestamp: _this.clock(),
                        };
                        record.outputs.push(entry);
                        record.updatedAt = _this.clock();
                        record.lastActivityAt = _this.clock();
                        _this.emit({
                            agentId: id,
                            event: "log",
                            text: text,
                            status: record.status,
                            attached: record.attached,
                            timestamp: _this.clock(),
                        });
                    },
                    setStatus: function (s) {
                        if (!isSubagentStatus(s))
                            throw new Error("invalid subagent status: ".concat(s));
                        record.status = s;
                        record.updatedAt = _this.clock();
                        record.lastActivityAt = _this.clock();
                        _this.addAudit({
                            agentId: id,
                            action: "status",
                            status: s,
                            attached: record.attached,
                            timestamp: _this.clock(),
                        });
                        _this.emit({
                            agentId: id,
                            event: "status",
                            status: s,
                            attached: record.attached,
                            timestamp: _this.clock(),
                        });
                    },
                    signal: anySignal(abortController.signal, signal),
                    reportActivity: function (phase, detail) {
                        _this.reportActivity(id, phase, detail);
                    },
                };
                this.addAudit({
                    agentId: id,
                    action: "created",
                    status: record.status,
                    attached: record.attached,
                    timestamp: this.clock(),
                });
                this.emit({
                    agentId: id,
                    event: "created",
                    status: record.status,
                    attached: record.attached,
                    timestamp: this.clock(),
                });
                runPromise = Promise.resolve().then(function () { return __awaiter(_this, void 0, void 0, function () {
                    var finalStatus, err_1, finalStatus;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0:
                                _a.trys.push([0, 2, 3, 5]);
                                return [4 /*yield*/, this.runner(record.task, ctx)];
                            case 1:
                                _a.sent();
                                finalStatus = abortController.signal.aborted
                                    ? "stopped"
                                    : "completed";
                                record.status = finalStatus;
                                record.phase = "finalizing";
                                record.activityDetail = finalStatus;
                                record.endedAt = this.clock();
                                record.lastActivityAt = this.clock();
                                this.emit({
                                    agentId: id,
                                    event: finalStatus === "completed" ? "done" : "stopped",
                                    status: finalStatus,
                                    attached: record.attached,
                                    timestamp: this.clock(),
                                    phase: "finalizing",
                                    activityDetail: finalStatus,
                                });
                                return [3 /*break*/, 5];
                            case 2:
                                err_1 = _a.sent();
                                finalStatus = (err_1 === null || err_1 === void 0 ? void 0 : err_1.name) === "AbortError" ||
                                    abortController.signal.aborted
                                    ? "stopped"
                                    : "failed";
                                record.status = finalStatus;
                                record.phase = "finalizing";
                                record.activityDetail =
                                    finalStatus === "stopped" ? "aborted" : String(err_1);
                                record.endedAt = this.clock();
                                record.lastActivityAt = this.clock();
                                if (finalStatus === "failed") {
                                    record.outputs.push({
                                        step: record.outputs.length + 1,
                                        text: String(err_1),
                                        timestamp: this.clock(),
                                    });
                                }
                                this.emit({
                                    agentId: id,
                                    event: finalStatus === "stopped" ? "stopped" : "done",
                                    status: finalStatus,
                                    attached: record.attached,
                                    timestamp: this.clock(),
                                    phase: "finalizing",
                                    activityDetail: record.activityDetail,
                                });
                                return [3 /*break*/, 5];
                            case 3:
                                record.updatedAt = this.clock();
                                this.running.delete(id);
                                this.activityThrottle.delete(id);
                                this.clearWallClockBudget(id);
                                this.addAudit({
                                    agentId: id,
                                    action: "done",
                                    status: record.status,
                                    attached: record.attached,
                                    timestamp: this.clock(),
                                });
                                return [4 /*yield*/, this.save()];
                            case 4:
                                _a.sent();
                                return [7 /*endfinally*/];
                            case 5: return [2 /*return*/];
                        }
                    });
                }); });
                runPromise.catch(function () { });
                return [2 /*return*/];
            });
        });
    };
    SubagentRegistry.prototype.list = function () {
        return __spreadArray([], this.records.values(), true);
    };
    SubagentRegistry.prototype.runningCount = function () {
        return this.running.size;
    };
    SubagentRegistry.prototype.get = function (id) {
        return this.records.get(id);
    };
    SubagentRegistry.prototype.status = function (id) {
        var _a;
        return (_a = this.records.get(id)) === null || _a === void 0 ? void 0 : _a.status;
    };
    SubagentRegistry.prototype.output = function (id) {
        var _a;
        return (_a = this.records.get(id)) === null || _a === void 0 ? void 0 : _a.outputs;
    };
    /**
     * Arm this run's wall-clock deadline.
     *
     * The stop on expiry is forced: the run is by definition not making progress
     * anyone would want to pay for, so the stall protection that shields a healthy
     * run does not apply to it. A disabled budget arms nothing.
     *
     * The timer is unref'd so a deadline never holds the process open after its
     * run has settled.
     */
    SubagentRegistry.prototype.armWallClockBudget = function (id, ctrl) {
        var _this = this;
        var _a;
        if (this.wallClockBudgetMs <= 0)
            return;
        this.clearWallClockBudget(id);
        var timer = setTimeout(function () {
            _this.budgetTimers.delete(id);
            if (!_this.records.has(id))
                return;
            _this.requestStop(id, "wall-clock budget of ".concat(_this.wallClockBudgetMs, "ms exceeded"), true, "runtime");
        }, this.wallClockBudgetMs);
        (_a = timer.unref) === null || _a === void 0 ? void 0 : _a.call(timer);
        this.budgetTimers.set(id, timer);
        // The controller is read by the callback above only through the record
        // lookup, so keep the reference explicit for readers of this method.
        void ctrl;
    };
    SubagentRegistry.prototype.clearWallClockBudget = function (id) {
        var timer = this.budgetTimers.get(id);
        if (timer === undefined)
            return;
        clearTimeout(timer);
        this.budgetTimers.delete(id);
    };
    SubagentRegistry.prototype.doStop = function (id, reason, force, requestedBy) {
        if (requestedBy === void 0) { requestedBy = "model"; }
        var record = this.records.get(id);
        if (!record)
            return;
        var ctrl = this.running.get(id);
        if (ctrl) {
            ctrl.abort();
            record.status = "stopped";
            record.updatedAt = this.clock();
            record.phase = "finalizing";
            record.activityDetail = reason;
            record.endedAt = this.clock();
            record.lastActivityAt = this.clock();
            this.addAudit({
                agentId: id,
                action: "stop",
                status: "stopped",
                attached: record.attached,
                timestamp: this.clock(),
                stopReason: reason,
                requestedBy: requestedBy,
                force: force,
            });
            this.emit({
                agentId: id,
                event: "stopped",
                status: "stopped",
                attached: record.attached,
                timestamp: this.clock(),
                phase: "finalizing",
                activityDetail: reason,
                stopReason: reason,
                requestedBy: requestedBy,
                force: force,
            });
            void this.save();
        }
    };
    SubagentRegistry.prototype.stop = function (id) {
        return (this.requestStop(id, "model requested stop", false).outcome === "stopped");
    };
    SubagentRegistry.prototype.resume = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            var record;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        record = this.records.get(id);
                        if (!record)
                            return [2 /*return*/, false];
                        if (record.status !== "paused")
                            return [2 /*return*/, false];
                        if (this.running.has(id))
                            return [2 /*return*/, false];
                        record.status = "running";
                        record.updatedAt = this.clock();
                        record.lastActivityAt = this.clock();
                        record.phase = "queued";
                        record.activityDetail = "resume";
                        this.addAudit({
                            agentId: id,
                            action: "resume",
                            status: "running",
                            attached: record.attached,
                            timestamp: this.clock(),
                        });
                        this.emit({
                            agentId: id,
                            event: "resumed",
                            status: "running",
                            attached: record.attached,
                            timestamp: this.clock(),
                        });
                        return [4 /*yield*/, this.save()];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, this.start(record)];
                    case 2:
                        _a.sent();
                        return [2 /*return*/, true];
                }
            });
        });
    };
    SubagentRegistry.prototype.attach = function (id) {
        var record = this.records.get(id);
        if (!record)
            return false;
        record.attached = true;
        record.updatedAt = this.clock();
        this.addAudit({
            agentId: id,
            action: "attach",
            status: record.status,
            attached: true,
            timestamp: this.clock(),
        });
        this.emit({
            agentId: id,
            event: "attached",
            status: record.status,
            attached: true,
            timestamp: this.clock(),
        });
        return true;
    };
    SubagentRegistry.prototype.detach = function (id) {
        var record = this.records.get(id);
        if (!record)
            return false;
        record.attached = false;
        record.updatedAt = this.clock();
        this.addAudit({
            agentId: id,
            action: "detach",
            status: record.status,
            attached: false,
            timestamp: this.clock(),
        });
        this.emit({
            agentId: id,
            event: "detached",
            status: record.status,
            attached: false,
            timestamp: this.clock(),
        });
        return true;
    };
    SubagentRegistry.prototype.cleanup = function (dryRun) {
        if (dryRun === void 0) { dryRun = false; }
        var affected = [];
        for (var _i = 0, _a = this.records; _i < _a.length; _i++) {
            var _b = _a[_i], id = _b[0], rec = _b[1];
            if (rec.status === "completed" ||
                rec.status === "failed" ||
                rec.status === "stopped") {
                affected.push(id);
            }
        }
        if (!dryRun) {
            for (var _c = 0, affected_1 = affected; _c < affected_1.length; _c++) {
                var id = affected_1[_c];
                this.records.delete(id);
                this.addAudit({
                    agentId: id,
                    action: "cleanup",
                    status: "completed",
                    attached: false,
                    timestamp: this.clock(),
                });
            }
            this.save();
        }
        return affected;
    };
    SubagentRegistry.prototype.audit = function (tail, format) {
        var entries = this.auditEntries;
        if (tail && tail > 0 && tail < entries.length) {
            entries = entries.slice(entries.length - tail);
        }
        if (entries.length === 0)
            return "<no agent audit entries>";
        if (format === "json") {
            return JSON.stringify(entries.map(function (e) { return ({
                event_id: e.eventId,
                resource_type: "subagent",
                resource_id: e.agentId,
                agent_id: e.agentId,
                action: e.action,
                status: e.status,
                stop_reason: e.stopReason,
                requested_by: e.requestedBy,
                force: e.force,
                time: new Date(e.timestamp).toISOString(),
            }); }), null, 2);
        }
        return entries
            .map(function (e) {
            return "".concat(new Date(e.timestamp).toISOString(), " event_id=").concat(e.eventId, " agent_id=").concat(e.agentId, " action=").concat(e.action, " status=").concat(e.status, " attached=").concat(e.attached).concat(e.stopReason ? " stop_reason=".concat(JSON.stringify(e.stopReason), " requested_by=").concat(e.requestedBy, " force=").concat(e.force) : "");
        })
            .join("\n");
    };
    SubagentRegistry.prototype.subscribe = function (fn) {
        var _this = this;
        this.subscribers.add(fn);
        return function () { return _this.subscribers.delete(fn); };
    };
    SubagentRegistry.prototype.formatList = function () {
        return __awaiter(this, void 0, void 0, function () {
            var all, lines;
            return __generator(this, function (_a) {
                all = this.list();
                if (all.length === 0)
                    return [2 /*return*/, "no subagents"];
                lines = all.map(function (rec) {
                    var parts = ["".concat(rec.id, " [").concat(rec.status, "] attached=").concat(rec.attached)];
                    if (rec.modelProfile)
                        parts.push("model_profile=".concat(rec.modelProfile));
                    parts.push(rec.task);
                    var last = rec.outputs.length > 0
                        ? (0, format_1.truncate)(rec.outputs[rec.outputs.length - 1].text, 40)
                        : "";
                    if (last)
                        parts.push("\u2192 ".concat(last));
                    parts.push("(".concat(rec.outputs.length, " steps)"));
                    return parts.join(" ");
                });
                return [2 /*return*/, "".concat(lines.join("\n"), "\n").concat((0, format_1.formatStatusCounts)(all))];
            });
        });
    };
    SubagentRegistry.prototype.formatOutput = function (id_1) {
        return __awaiter(this, arguments, void 0, function (id, verbose) {
            var rec, last;
            if (verbose === void 0) { verbose = false; }
            return __generator(this, function (_a) {
                rec = this.records.get(id);
                if (!rec)
                    throw new Error("subagent ".concat(id, " not found"));
                if (rec.outputs.length === 0)
                    return [2 /*return*/, "no output"];
                if (!verbose) {
                    last = rec.outputs[rec.outputs.length - 1];
                    return [2 /*return*/, "".concat(rec.id, " [").concat(rec.status, "]\n").concat((0, format_1.truncate)(last.text, 1200))];
                }
                // Bounded: the whole audit trail would spend the parent's context on a
                // history it rarely needs whole, and the tail is the part it acts on.
                return [2 /*return*/, (0, format_output_1.boundVerboseOutput)(rec.outputs.map(function (o) { return "[".concat(rec.id, "] step=").concat(o.step, " ").concat(o.text); }))];
            });
        });
    };
    SubagentRegistry.prototype.formatStatus = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            var rec, lines, _i, _a, o;
            return __generator(this, function (_b) {
                rec = this.records.get(id);
                if (!rec)
                    throw new Error("subagent ".concat(id, " not found"));
                lines = [
                    "".concat(rec.id, " [").concat(rec.status, "] attached=").concat(rec.attached, " ").concat(rec.task),
                ];
                if (rec.modelProfile)
                    lines.push("  model_profile: ".concat(rec.modelProfile));
                lines.push("  mode: ".concat(rec.mode));
                lines.push("  phase: ".concat(rec.phase));
                lines.push("  last_activity: ".concat(new Date(rec.lastActivityAt).toISOString()));
                lines.push("  activity: ".concat(rec.activityDetail));
                lines.push("  created: ".concat(new Date(rec.createdAt).toISOString()));
                lines.push("  updated: ".concat(new Date(rec.updatedAt).toISOString()));
                lines.push("  started: ".concat(new Date(rec.startedAt).toISOString()));
                if (rec.endedAt)
                    lines.push("  ended: ".concat(new Date(rec.endedAt).toISOString()));
                for (_i = 0, _a = rec.outputs; _i < _a.length; _i++) {
                    o = _a[_i];
                    lines.push("  [step ".concat(o.step, "] ").concat((0, format_1.truncate)(o.text, 200)));
                }
                return [2 /*return*/, lines.join("\n")];
            });
        });
    };
    SubagentRegistry.prototype.wait = function (ids, until, timeoutMs, signal) {
        var _this = this;
        return new Promise(function (resolve) {
            var deadline = _this.clock() + timeoutMs;
            var terminalStatuses = new Set(["completed", "failed", "stopped"]);
            var check = function () {
                var _a, _b;
                var results = {};
                var terminalCount = 0;
                for (var _i = 0, ids_1 = ids; _i < ids_1.length; _i++) {
                    var id = ids_1[_i];
                    var rec = _this.records.get(id);
                    var status_1 = (_a = rec === null || rec === void 0 ? void 0 : rec.status) !== null && _a !== void 0 ? _a : "idle";
                    var phase = (_b = rec === null || rec === void 0 ? void 0 : rec.phase) !== null && _b !== void 0 ? _b : "idle";
                    results[id] = { status: status_1, phase: phase };
                    if (terminalStatuses.has(status_1))
                        terminalCount++;
                }
                if (until === "all_terminal"
                    ? terminalCount === ids.length
                    : terminalCount > 0) {
                    resolve(results);
                    return true;
                }
                return false;
            };
            if (check())
                return;
            var unsub = _this.subscribe(function (event) {
                if (!ids.includes(event.agentId))
                    return;
                if (check())
                    unsub();
            });
            var timer = setInterval(function () {
                var _a, _b;
                if (_this.clock() >= deadline) {
                    clearInterval(timer);
                    unsub();
                    var results = {};
                    for (var _i = 0, ids_2 = ids; _i < ids_2.length; _i++) {
                        var id = ids_2[_i];
                        var rec = _this.records.get(id);
                        results[id] = {
                            status: (_a = rec === null || rec === void 0 ? void 0 : rec.status) !== null && _a !== void 0 ? _a : "idle",
                            phase: (_b = rec === null || rec === void 0 ? void 0 : rec.phase) !== null && _b !== void 0 ? _b : "idle",
                        };
                    }
                    resolve(results);
                }
            }, 200);
            signal === null || signal === void 0 ? void 0 : signal.addEventListener("abort", function () {
                var _a, _b;
                clearInterval(timer);
                unsub();
                var results = {};
                for (var _i = 0, ids_3 = ids; _i < ids_3.length; _i++) {
                    var id = ids_3[_i];
                    var rec = _this.records.get(id);
                    results[id] = {
                        status: (_a = rec === null || rec === void 0 ? void 0 : rec.status) !== null && _a !== void 0 ? _a : "idle",
                        phase: (_b = rec === null || rec === void 0 ? void 0 : rec.phase) !== null && _b !== void 0 ? _b : "idle",
                    };
                }
                resolve(results);
            }, { once: true });
        });
    };
    SubagentRegistry.prototype.getAuditEntries = function () {
        return this.auditEntries;
    };
    SubagentRegistry.prototype.emit = function (event) {
        var _a, _b;
        var record = this.records.get(event.agentId);
        if (record) {
            event.parentSessionID = record.parentSessionID;
            event.parentAgentID = record.parentAgentID;
            event.continuation = record.continuation;
            event.phase = (_a = event.phase) !== null && _a !== void 0 ? _a : record.phase;
            event.activityDetail = (_b = event.activityDetail) !== null && _b !== void 0 ? _b : record.activityDetail;
        }
        for (var _i = 0, _c = this.subscribers; _i < _c.length; _i++) {
            var fn = _c[_i];
            try {
                fn(event);
            }
            catch (_d) {
                // subscriber error ignored
            }
        }
    };
    SubagentRegistry.prototype.assertDepth = function (parentID, maxDepth) {
        if (maxDepth === void 0) { maxDepth = 1; }
        var depth = 1;
        var parent = parentID ? this.records.get(parentID) : undefined;
        while (parent) {
            depth++;
            parent = parent.parentAgentID
                ? this.records.get(parent.parentAgentID)
                : undefined;
        }
        if (depth > maxDepth)
            throw new Error("subagent depth limit reached (".concat(maxDepth, "); increase runtime.subagentDepth to allow nested subagents"));
    };
    SubagentRegistry.prototype.addAudit = function (entry) {
        this.auditSeq++;
        var auditEntry = {
            eventId: "aevt_".concat(this.auditSeq),
            agentId: entry.agentId,
            action: entry.action,
            status: entry.status,
            attached: entry.attached,
            timestamp: entry.timestamp,
            stopReason: entry.stopReason,
            requestedBy: entry.requestedBy,
            force: entry.force,
        };
        this.auditEntries.push(auditEntry);
        if (this.auditEntries.length > this.maxAudit) {
            this.auditEntries = this.auditEntries.slice(this.auditEntries.length - this.maxAudit);
        }
    };
    return SubagentRegistry;
}());
exports.SubagentRegistry = SubagentRegistry;
function derivePhase(rec) {
    var s = rec.status;
    if (s === "idle")
        return "idle";
    if (s === "paused")
        return "waiting";
    if (s === "completed" || s === "failed" || s === "stopped")
        return "finalizing";
    return "provider";
}
function anySignal() {
    var signals = [];
    for (var _i = 0; _i < arguments.length; _i++) {
        signals[_i] = arguments[_i];
    }
    var cleanSignals = signals.filter(Boolean);
    if (cleanSignals.length === 0)
        return new AbortController().signal;
    if (cleanSignals.length === 1)
        return cleanSignals[0];
    var ctrl = new AbortController();
    var _loop_1 = function (sig) {
        if (sig.aborted) {
            ctrl.abort(sig.reason);
            return { value: ctrl.signal };
        }
        sig.addEventListener("abort", function () { return ctrl.abort(sig.reason); }, { once: true });
    };
    for (var _a = 0, cleanSignals_1 = cleanSignals; _a < cleanSignals_1.length; _a++) {
        var sig = cleanSignals_1[_a];
        var state_1 = _loop_1(sig);
        if (typeof state_1 === "object")
            return state_1.value;
    }
    return ctrl.signal;
}
