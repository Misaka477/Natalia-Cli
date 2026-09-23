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
var bun_test_1 = require("bun:test");
var promises_1 = require("node:fs/promises");
var node_path_1 = require("node:path");
var node_os_1 = require("node:os");
var src_1 = require("../src");
function tempDir() {
    return (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-subagent-"));
}
function fakeClock(initial) {
    if (initial === void 0) { initial = 0; }
    var current = initial;
    return {
        now: function () { return current; },
        advance: function (milliseconds) { return (current += milliseconds); },
    };
}
function subscribeTo(registry) {
    var events = [];
    var unsubscribe = registry.subscribe(function (event) { return events.push(event); });
    return { events: events, unsubscribe: unsubscribe };
}
function immediateRunner(task, ctx) {
    ctx.log("starting: ".concat(task));
    ctx.log("done: ".concat(task));
    ctx.setStatus("completed");
}
function delayedRunner(task, ctx) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    ctx.log("starting: ".concat(task));
                    return [4 /*yield*/, new Promise(function (resolve, reject) {
                            var onAbort = function () {
                                ctx.setStatus("stopped");
                                reject(new DOMException("Aborted", "AbortError"));
                            };
                            if (ctx.signal.aborted) {
                                onAbort();
                                return;
                            }
                            ctx.signal.addEventListener("abort", onAbort, { once: true });
                            setTimeout(function () {
                                ctx.signal.removeEventListener("abort", onAbort);
                                ctx.log("done: ".concat(task));
                                ctx.setStatus("completed");
                                resolve();
                            }, 50);
                        })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
(0, bun_test_1.afterEach)(function () { });
(0, bun_test_1.test)("spawn creates record and runs runner", function () { return __awaiter(void 0, void 0, void 0, function () {
    var dir, reg, rec;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, tempDir()];
            case 1:
                dir = _a.sent();
                reg = new src_1.SubagentRegistry({ runner: immediateRunner, workDir: dir });
                return [4 /*yield*/, reg.spawn("test task")];
            case 2:
                rec = _a.sent();
                (0, bun_test_1.expect)(rec.id).toBe("a1");
                (0, bun_test_1.expect)(rec.task).toBe("test task");
                (0, bun_test_1.expect)(rec.status).toBe("completed");
                (0, bun_test_1.expect)(rec.outputs.length).toBe(2);
                (0, bun_test_1.expect)(rec.outputs[0].text).toBe("starting: test task");
                (0, bun_test_1.expect)(rec.outputs[1].text).toBe("done: test task");
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("a runner that sets an unknown status fails the run instead of storing it", function () { return __awaiter(void 0, void 0, void 0, function () {
    var dir, bogusStatusRunner, reg, rec;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, tempDir()];
            case 1:
                dir = _a.sent();
                bogusStatusRunner = function (_task, ctx) {
                    ctx.setStatus("not-a-real-status");
                };
                reg = new src_1.SubagentRegistry({
                    runner: bogusStatusRunner,
                    workDir: dir,
                });
                return [4 /*yield*/, reg.spawn("task")];
            case 2:
                rec = _a.sent();
                // The record's status is the closed SubagentStatus union; an unknown value is
                // rejected at the write, failing the run — never silently stored.
                (0, bun_test_1.expect)(rec.status).toBe("failed");
                (0, bun_test_1.expect)(rec.activityDetail).toContain("invalid subagent status");
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("spawn rejects empty task", function () { return __awaiter(void 0, void 0, void 0, function () {
    var reg, _a;
    var _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                _a = src_1.SubagentRegistry.bind;
                _b = {
                    runner: immediateRunner
                };
                return [4 /*yield*/, tempDir()];
            case 1:
                reg = new (_a.apply(src_1.SubagentRegistry, [void 0, (_b.workDir = _c.sent(),
                        _b)]))();
                (0, bun_test_1.expect)(reg.spawn("")).rejects.toThrow("task is required");
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("list returns spawned agents", function () { return __awaiter(void 0, void 0, void 0, function () {
    var reg, _a;
    var _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                _a = src_1.SubagentRegistry.bind;
                _b = {
                    runner: immediateRunner
                };
                return [4 /*yield*/, tempDir()];
            case 1:
                reg = new (_a.apply(src_1.SubagentRegistry, [void 0, (_b.workDir = _c.sent(),
                        _b)]))();
                (0, bun_test_1.expect)(reg.list()).toHaveLength(0);
                return [4 /*yield*/, reg.spawn("task1")];
            case 2:
                _c.sent();
                return [4 /*yield*/, reg.spawn("task2")];
            case 3:
                _c.sent();
                (0, bun_test_1.expect)(reg.list()).toHaveLength(2);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("get returns agent by id", function () { return __awaiter(void 0, void 0, void 0, function () {
    var reg, _a, rec;
    var _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                _a = src_1.SubagentRegistry.bind;
                _b = {
                    runner: immediateRunner
                };
                return [4 /*yield*/, tempDir()];
            case 1:
                reg = new (_a.apply(src_1.SubagentRegistry, [void 0, (_b.workDir = _c.sent(),
                        _b)]))();
                return [4 /*yield*/, reg.spawn("get test")];
            case 2:
                rec = _c.sent();
                (0, bun_test_1.expect)(reg.get("a1")).toBe(rec);
                (0, bun_test_1.expect)(reg.get("nonexistent")).toBeUndefined();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("status returns agent status", function () { return __awaiter(void 0, void 0, void 0, function () {
    var reg, _a, rec;
    var _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                _a = src_1.SubagentRegistry.bind;
                _b = {
                    runner: delayedRunner
                };
                return [4 /*yield*/, tempDir()];
            case 1:
                reg = new (_a.apply(src_1.SubagentRegistry, [void 0, (_b.workDir = _c.sent(),
                        _b)]))();
                return [4 /*yield*/, reg.spawn("status test")];
            case 2:
                rec = _c.sent();
                (0, bun_test_1.expect)(rec.status).toBe("running");
                (0, bun_test_1.expect)(reg.runningCount()).toBe(1);
                return [4 /*yield*/, new Promise(function (r) { return setTimeout(r, 100); })];
            case 3:
                _c.sent();
                (0, bun_test_1.expect)(rec.status).toBe("completed");
                (0, bun_test_1.expect)(reg.runningCount()).toBe(0);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("output returns agent outputs", function () { return __awaiter(void 0, void 0, void 0, function () {
    var reg, _a, outputs;
    var _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                _a = src_1.SubagentRegistry.bind;
                _b = {
                    runner: immediateRunner
                };
                return [4 /*yield*/, tempDir()];
            case 1:
                reg = new (_a.apply(src_1.SubagentRegistry, [void 0, (_b.workDir = _c.sent(),
                        _b)]))();
                return [4 /*yield*/, reg.spawn("output test")];
            case 2:
                _c.sent();
                outputs = reg.output("a1");
                (0, bun_test_1.expect)(outputs).toBeDefined();
                (0, bun_test_1.expect)(outputs).toHaveLength(2);
                (0, bun_test_1.expect)(reg.output("missing")).toBeUndefined();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("formatOutput defaults to the concise final result and keeps verbose audit opt-in", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, registry, agent, index, _a, _b, _c;
    return __generator(this, function (_d) {
        switch (_d.label) {
            case 0: return [4 /*yield*/, tempDir()];
            case 1:
                root = _d.sent();
                registry = new src_1.SubagentRegistry({
                    workDir: root,
                    runner: function (_task, context) { return __awaiter(void 0, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            context.log("thinking: internal detail");
                            context.log("final factual result");
                            return [2 /*return*/];
                        });
                    }); },
                });
                return [4 /*yield*/, registry.spawn("concise output")];
            case 2:
                agent = _d.sent();
                index = 0;
                _d.label = 3;
            case 3:
                if (!(index < 50)) return [3 /*break*/, 6];
                if (registry.status(agent.id) === "completed")
                    return [3 /*break*/, 6];
                return [4 /*yield*/, Bun.sleep(10)];
            case 4:
                _d.sent();
                _d.label = 5;
            case 5:
                index++;
                return [3 /*break*/, 3];
            case 6:
                _a = bun_test_1.expect;
                return [4 /*yield*/, registry.formatOutput(agent.id)];
            case 7:
                _a.apply(void 0, [_d.sent()]).toContain("final factual result");
                _b = bun_test_1.expect;
                return [4 /*yield*/, registry.formatOutput(agent.id)];
            case 8:
                _b.apply(void 0, [_d.sent()]).not.toContain("thinking:");
                _c = bun_test_1.expect;
                return [4 /*yield*/, registry.formatOutput(agent.id, true)];
            case 9:
                _c.apply(void 0, [_d.sent()]).toContain("thinking: internal detail");
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("stop compatibility wrapper protects an active agent", function () { return __awaiter(void 0, void 0, void 0, function () {
    var dir, reg, ok;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, tempDir()];
            case 1:
                dir = _a.sent();
                reg = new src_1.SubagentRegistry({ runner: delayedRunner, workDir: dir });
                return [4 /*yield*/, reg.spawn("stop test")];
            case 2:
                _a.sent();
                (0, bun_test_1.expect)(reg.status("a1")).toBe("running");
                ok = reg.stop("a1");
                (0, bun_test_1.expect)(ok).toBeFalse();
                (0, bun_test_1.expect)(reg.status("a1")).toBe("running");
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("force stop persists a running agent status without waiting for completion", function () { return __awaiter(void 0, void 0, void 0, function () {
    var dir, reg, _a;
    var _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0: return [4 /*yield*/, tempDir()];
            case 1:
                dir = _c.sent();
                reg = new src_1.SubagentRegistry({ runner: delayedRunner, workDir: dir });
                return [4 /*yield*/, reg.spawn("persist stop")];
            case 2:
                _c.sent();
                (0, bun_test_1.expect)(reg.requestStop("a1", "operator override", true).outcome).toBe("stopped");
                return [4 /*yield*/, Bun.sleep(20)];
            case 3:
                _c.sent();
                _a = bun_test_1.expect;
                return [4 /*yield*/, new src_1.SubagentStore(dir).load()];
            case 4:
                _a.apply(void 0, [(_b = (_c.sent())[0]) === null || _b === void 0 ? void 0 : _b.status]).toBe("stopped");
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("stop returns false for unknown agent", function () { return __awaiter(void 0, void 0, void 0, function () {
    var reg, _a;
    var _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                _a = src_1.SubagentRegistry.bind;
                _b = {
                    runner: immediateRunner
                };
                return [4 /*yield*/, tempDir()];
            case 1:
                reg = new (_a.apply(src_1.SubagentRegistry, [void 0, (_b.workDir = _c.sent(),
                        _b)]))();
                (0, bun_test_1.expect)(reg.stop("missing")).toBeFalse();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("requestStop protects an active agent", function () { return __awaiter(void 0, void 0, void 0, function () {
    var clock, reg, _a, rec;
    var _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                clock = fakeClock(1000);
                _a = src_1.SubagentRegistry.bind;
                _b = {
                    runner: delayedRunner
                };
                return [4 /*yield*/, tempDir()];
            case 1:
                reg = new (_a.apply(src_1.SubagentRegistry, [void 0, (_b.workDir = _c.sent(),
                        _b.clock = clock.now,
                        _b.stallThresholdMs = 1000,
                        _b)]))();
                return [4 /*yield*/, reg.spawn("protected stop")];
            case 2:
                rec = _c.sent();
                (0, bun_test_1.expect)(reg.requestStop(rec.id, "no longer needed")).toEqual({
                    outcome: "protected",
                    id: rec.id,
                    health: "active",
                    retryAfterMs: 1000,
                });
                (0, bun_test_1.expect)(rec.status).toBe("running");
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("requestStop with force interrupts an active agent and records why", function () { return __awaiter(void 0, void 0, void 0, function () {
    var reg, _a, events, rec, stopped;
    var _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                _a = src_1.SubagentRegistry.bind;
                _b = {
                    runner: delayedRunner
                };
                return [4 /*yield*/, tempDir()];
            case 1:
                reg = new (_a.apply(src_1.SubagentRegistry, [void 0, (_b.workDir = _c.sent(),
                        _b)]))();
                events = subscribeTo(reg).events;
                return [4 /*yield*/, reg.spawn("forced stop")];
            case 2:
                rec = _c.sent();
                (0, bun_test_1.expect)(reg.requestStop(rec.id, "operator override", true)).toEqual({
                    outcome: "stopped",
                    id: rec.id,
                });
                stopped = events.find(function (event) { return event.event === "stopped"; });
                (0, bun_test_1.expect)(stopped).toMatchObject({
                    stopReason: "operator override",
                    requestedBy: "model",
                    force: true,
                });
                (0, bun_test_1.expect)(reg.getAuditEntries()).toContainEqual(bun_test_1.expect.objectContaining({
                    action: "stop",
                    stopReason: "operator override",
                    requestedBy: "model",
                    force: true,
                }));
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("requestStop allows a stalled agent with a reason", function () { return __awaiter(void 0, void 0, void 0, function () {
    var clock, reg, _a, rec;
    var _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                clock = fakeClock(1000);
                _a = src_1.SubagentRegistry.bind;
                _b = {
                    runner: delayedRunner
                };
                return [4 /*yield*/, tempDir()];
            case 1:
                reg = new (_a.apply(src_1.SubagentRegistry, [void 0, (_b.workDir = _c.sent(),
                        _b.clock = clock.now,
                        _b.stallThresholdMs = 1000,
                        _b)]))();
                return [4 /*yield*/, reg.spawn("stalled stop")];
            case 2:
                rec = _c.sent();
                clock.advance(1000);
                (0, bun_test_1.expect)(reg.health(rec.id)).toBe("stalled");
                (0, bun_test_1.expect)(reg.requestStop(rec.id, "no activity for one second")).toEqual({
                    outcome: "stopped",
                    id: rec.id,
                });
                (0, bun_test_1.expect)(rec.activityDetail).toBe("no activity for one second");
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("requestStop is idempotent after an agent stops", function () { return __awaiter(void 0, void 0, void 0, function () {
    var reg, _a, rec;
    var _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                _a = src_1.SubagentRegistry.bind;
                _b = {
                    runner: delayedRunner
                };
                return [4 /*yield*/, tempDir()];
            case 1:
                reg = new (_a.apply(src_1.SubagentRegistry, [void 0, (_b.workDir = _c.sent(),
                        _b)]))();
                return [4 /*yield*/, reg.spawn("double stop")];
            case 2:
                rec = _c.sent();
                (0, bun_test_1.expect)(reg.requestStop(rec.id, "first stop", true).outcome).toBe("stopped");
                (0, bun_test_1.expect)(reg.requestStop(rec.id, "second stop", true)).toEqual({
                    outcome: "not_running",
                    id: rec.id,
                    status: "stopped",
                });
                (0, bun_test_1.expect)(reg.getAuditEntries().filter(function (entry) { return entry.action === "stop"; })).toHaveLength(1);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("resume restarts a paused runner", function () { return __awaiter(void 0, void 0, void 0, function () {
    var runs, reg, _a, _b, rec, _c;
    var _d;
    return __generator(this, function (_e) {
        switch (_e.label) {
            case 0:
                runs = 0;
                _a = src_1.SubagentRegistry.bind;
                _d = {
                    runner: function () { return __awaiter(void 0, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            runs++;
                            return [2 /*return*/];
                        });
                    }); }
                };
                return [4 /*yield*/, tempDir()];
            case 1:
                reg = new (_a.apply(src_1.SubagentRegistry, [void 0, (_d.workDir = _e.sent(),
                        _d)]))();
                return [4 /*yield*/, reg.spawn("resume test")];
            case 2:
                _e.sent();
                return [4 /*yield*/, Bun.sleep(10)];
            case 3:
                _e.sent();
                _b = bun_test_1.expect;
                return [4 /*yield*/, reg.resume("a1")];
            case 4:
                _b.apply(void 0, [_e.sent()]).toBeFalse();
                rec = reg.get("a1");
                rec.status = "paused";
                _c = bun_test_1.expect;
                return [4 /*yield*/, reg.resume("a1")];
            case 5:
                _c.apply(void 0, [_e.sent()]).toBeTrue();
                return [4 /*yield*/, Bun.sleep(10)];
            case 6:
                _e.sent();
                (0, bun_test_1.expect)(runs).toBe(2);
                (0, bun_test_1.expect)(rec.status).toBe("completed");
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("resume returns false for unknown agent", function () { return __awaiter(void 0, void 0, void 0, function () {
    var reg, _a, _b;
    var _c;
    return __generator(this, function (_d) {
        switch (_d.label) {
            case 0:
                _a = src_1.SubagentRegistry.bind;
                _c = {
                    runner: immediateRunner
                };
                return [4 /*yield*/, tempDir()];
            case 1:
                reg = new (_a.apply(src_1.SubagentRegistry, [void 0, (_c.workDir = _d.sent(),
                        _c)]))();
                _b = bun_test_1.expect;
                return [4 /*yield*/, reg.resume("missing")];
            case 2:
                _b.apply(void 0, [_d.sent()]).toBeFalse();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("attach/detach toggle attached flag", function () { return __awaiter(void 0, void 0, void 0, function () {
    var reg, _a, rec;
    var _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                _a = src_1.SubagentRegistry.bind;
                _b = {
                    runner: immediateRunner
                };
                return [4 /*yield*/, tempDir()];
            case 1:
                reg = new (_a.apply(src_1.SubagentRegistry, [void 0, (_b.workDir = _c.sent(),
                        _b)]))();
                return [4 /*yield*/, reg.spawn("attach test")];
            case 2:
                _c.sent();
                rec = reg.get("a1");
                (0, bun_test_1.expect)(rec.attached).toBeTrue();
                (0, bun_test_1.expect)(reg.detach("a1")).toBeTrue();
                (0, bun_test_1.expect)(rec.attached).toBeFalse();
                (0, bun_test_1.expect)(reg.attach("a1")).toBeTrue();
                (0, bun_test_1.expect)(rec.attached).toBeTrue();
                (0, bun_test_1.expect)(reg.detach("missing")).toBeFalse();
                (0, bun_test_1.expect)(reg.attach("missing")).toBeFalse();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("cleanup removes completed/failed/stopped agents", function () { return __awaiter(void 0, void 0, void 0, function () {
    var reg, _a, affected;
    var _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                _a = src_1.SubagentRegistry.bind;
                _b = {
                    runner: immediateRunner
                };
                return [4 /*yield*/, tempDir()];
            case 1:
                reg = new (_a.apply(src_1.SubagentRegistry, [void 0, (_b.workDir = _c.sent(),
                        _b)]))();
                return [4 /*yield*/, reg.spawn("c1")];
            case 2:
                _c.sent();
                return [4 /*yield*/, reg.spawn("c2")];
            case 3:
                _c.sent();
                return [4 /*yield*/, new Promise(function (r) { return setTimeout(r, 10); })];
            case 4:
                _c.sent();
                affected = reg.cleanup();
                (0, bun_test_1.expect)(affected).toHaveLength(2);
                (0, bun_test_1.expect)(reg.list()).toHaveLength(0);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("cleanup dry run does not remove agents", function () { return __awaiter(void 0, void 0, void 0, function () {
    var reg, _a, affected;
    var _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                _a = src_1.SubagentRegistry.bind;
                _b = {
                    runner: immediateRunner
                };
                return [4 /*yield*/, tempDir()];
            case 1:
                reg = new (_a.apply(src_1.SubagentRegistry, [void 0, (_b.workDir = _c.sent(),
                        _b)]))();
                return [4 /*yield*/, reg.spawn("dry")];
            case 2:
                _c.sent();
                return [4 /*yield*/, new Promise(function (r) { return setTimeout(r, 10); })];
            case 3:
                _c.sent();
                affected = reg.cleanup(true);
                (0, bun_test_1.expect)(affected).toHaveLength(1);
                (0, bun_test_1.expect)(reg.list()).toHaveLength(1);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("audit returns text format by default", function () { return __awaiter(void 0, void 0, void 0, function () {
    var reg, _a, audit;
    var _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                _a = src_1.SubagentRegistry.bind;
                _b = {
                    runner: immediateRunner
                };
                return [4 /*yield*/, tempDir()];
            case 1:
                reg = new (_a.apply(src_1.SubagentRegistry, [void 0, (_b.workDir = _c.sent(),
                        _b)]))();
                return [4 /*yield*/, reg.spawn("audit test")];
            case 2:
                _c.sent();
                audit = reg.audit();
                (0, bun_test_1.expect)(audit).not.toBe("<no agent audit entries>");
                (0, bun_test_1.expect)(audit).toContain("event_id=");
                (0, bun_test_1.expect)(audit).toContain("agent_id=");
                (0, bun_test_1.expect)(audit).toContain("action=");
                (0, bun_test_1.expect)(audit).toContain("status=");
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("audit returns json format", function () { return __awaiter(void 0, void 0, void 0, function () {
    var reg, _a, json;
    var _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                _a = src_1.SubagentRegistry.bind;
                _b = {
                    runner: immediateRunner
                };
                return [4 /*yield*/, tempDir()];
            case 1:
                reg = new (_a.apply(src_1.SubagentRegistry, [void 0, (_b.workDir = _c.sent(),
                        _b)]))();
                return [4 /*yield*/, reg.spawn("json audit")];
            case 2:
                _c.sent();
                json = reg.audit(undefined, "json");
                (0, bun_test_1.expect)(json).toStartWith("[");
                (0, bun_test_1.expect)(json).toContain("event_id");
                (0, bun_test_1.expect)(json).toContain("resource_type");
                (0, bun_test_1.expect)(json).toContain("agent_id");
                (0, bun_test_1.expect)(json).toContain("action");
                (0, bun_test_1.expect)(json).toContain("status");
                (0, bun_test_1.expect)(json).toContain("time");
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("audit tail limits entries", function () { return __awaiter(void 0, void 0, void 0, function () {
    var reg, _a, tail, lines;
    var _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                _a = src_1.SubagentRegistry.bind;
                _b = {
                    runner: immediateRunner
                };
                return [4 /*yield*/, tempDir()];
            case 1:
                reg = new (_a.apply(src_1.SubagentRegistry, [void 0, (_b.workDir = _c.sent(),
                        _b)]))();
                return [4 /*yield*/, reg.spawn("tail test")];
            case 2:
                _c.sent();
                return [4 /*yield*/, reg.spawn("tail test 2")];
            case 3:
                _c.sent();
                tail = reg.audit(1);
                lines = tail.split("\n");
                (0, bun_test_1.expect)(lines).toHaveLength(1);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("audit returns no entries message when empty", function () { return __awaiter(void 0, void 0, void 0, function () {
    var reg, _a;
    var _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                _a = src_1.SubagentRegistry.bind;
                _b = {
                    runner: immediateRunner
                };
                return [4 /*yield*/, tempDir()];
            case 1:
                reg = new (_a.apply(src_1.SubagentRegistry, [void 0, (_b.workDir = _c.sent(),
                        _b)]))();
                (0, bun_test_1.expect)(reg.audit()).toBe("<no agent audit entries>");
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("subscribe receives events", function () { return __awaiter(void 0, void 0, void 0, function () {
    var reg, _a, _b, events, unsubscribe, eventNames, done;
    var _c;
    return __generator(this, function (_d) {
        switch (_d.label) {
            case 0:
                _a = src_1.SubagentRegistry.bind;
                _c = {
                    runner: immediateRunner
                };
                return [4 /*yield*/, tempDir()];
            case 1:
                reg = new (_a.apply(src_1.SubagentRegistry, [void 0, (_c.workDir = _d.sent(),
                        _c)]))();
                _b = subscribeTo(reg), events = _b.events, unsubscribe = _b.unsubscribe;
                return [4 /*yield*/, reg.spawn("events")];
            case 2:
                _d.sent();
                return [4 /*yield*/, new Promise(function (r) { return setTimeout(r, 10); })];
            case 3:
                _d.sent();
                eventNames = events.map(function (e) { return e.event; });
                (0, bun_test_1.expect)(eventNames.length).toBeGreaterThanOrEqual(3);
                (0, bun_test_1.expect)(eventNames).toContain("created");
                done = events.find(function (e) { return e.event === "done"; });
                (0, bun_test_1.expect)(done).toBeDefined();
                unsubscribe();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("subscribe unsubscribe stops events", function () { return __awaiter(void 0, void 0, void 0, function () {
    var reg, _a, _b, events, unsubscribe;
    var _c;
    return __generator(this, function (_d) {
        switch (_d.label) {
            case 0:
                _a = src_1.SubagentRegistry.bind;
                _c = {
                    runner: immediateRunner
                };
                return [4 /*yield*/, tempDir()];
            case 1:
                reg = new (_a.apply(src_1.SubagentRegistry, [void 0, (_c.workDir = _d.sent(),
                        _c)]))();
                _b = subscribeTo(reg), events = _b.events, unsubscribe = _b.unsubscribe;
                unsubscribe();
                return [4 /*yield*/, reg.spawn("unsub")];
            case 2:
                _d.sent();
                return [4 /*yield*/, new Promise(function (r) { return setTimeout(r, 10); })];
            case 3:
                _d.sent();
                (0, bun_test_1.expect)(events).toHaveLength(0);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("fake clock advances deterministically", function () {
    var clock = fakeClock(1000);
    (0, bun_test_1.expect)(clock.now()).toBe(1000);
    clock.advance(250);
    (0, bun_test_1.expect)(clock.now()).toBe(1250);
});
(0, bun_test_1.test)("formatList returns formatted output", function () { return __awaiter(void 0, void 0, void 0, function () {
    var reg, _a, formatted, list;
    var _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                _a = src_1.SubagentRegistry.bind;
                _b = {
                    runner: immediateRunner
                };
                return [4 /*yield*/, tempDir()];
            case 1:
                reg = new (_a.apply(src_1.SubagentRegistry, [void 0, (_b.workDir = _c.sent(),
                        _b)]))();
                return [4 /*yield*/, reg.formatList()];
            case 2:
                formatted = _c.sent();
                (0, bun_test_1.expect)(formatted).toBe("no subagents");
                return [4 /*yield*/, reg.spawn("format list")];
            case 3:
                _c.sent();
                return [4 /*yield*/, reg.formatList()];
            case 4:
                list = _c.sent();
                (0, bun_test_1.expect)(list).toContain("a1");
                (0, bun_test_1.expect)(list).toContain("completed");
                (0, bun_test_1.expect)(list).toContain("format list");
                (0, bun_test_1.expect)(list).toContain("remaining_resources:");
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("formatOutput returns a concise result and can expose full agent outputs", function () { return __awaiter(void 0, void 0, void 0, function () {
    var reg, _a, out, _b;
    var _c;
    return __generator(this, function (_d) {
        switch (_d.label) {
            case 0:
                _a = src_1.SubagentRegistry.bind;
                _c = {
                    runner: immediateRunner
                };
                return [4 /*yield*/, tempDir()];
            case 1:
                reg = new (_a.apply(src_1.SubagentRegistry, [void 0, (_c.workDir = _d.sent(),
                        _c)]))();
                return [4 /*yield*/, reg.spawn("format out")];
            case 2:
                _d.sent();
                return [4 /*yield*/, reg.formatOutput("a1")];
            case 3:
                out = _d.sent();
                (0, bun_test_1.expect)(out).toContain("done: format out");
                (0, bun_test_1.expect)(out).not.toContain("starting: format out");
                _b = bun_test_1.expect;
                return [4 /*yield*/, reg.formatOutput("a1", true)];
            case 4:
                _b.apply(void 0, [_d.sent()]).toContain("starting: format out");
                (0, bun_test_1.expect)(reg.formatOutput("missing")).rejects.toThrow("not found");
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("formatStatus returns detailed agent info", function () { return __awaiter(void 0, void 0, void 0, function () {
    var reg, _a, s;
    var _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                _a = src_1.SubagentRegistry.bind;
                _b = {
                    runner: immediateRunner
                };
                return [4 /*yield*/, tempDir()];
            case 1:
                reg = new (_a.apply(src_1.SubagentRegistry, [void 0, (_b.workDir = _c.sent(),
                        _b)]))();
                return [4 /*yield*/, reg.spawn("status detail")];
            case 2:
                _c.sent();
                return [4 /*yield*/, reg.formatStatus("a1")];
            case 3:
                s = _c.sent();
                (0, bun_test_1.expect)(s).toContain("a1");
                (0, bun_test_1.expect)(s).toContain("completed");
                (0, bun_test_1.expect)(s).toContain("status detail");
                (0, bun_test_1.expect)(reg.formatStatus("missing")).rejects.toThrow("not found");
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("store saves and loads manifest", function () { return __awaiter(void 0, void 0, void 0, function () {
    var dir, store, records, now, loaded;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, tempDir()];
            case 1:
                dir = _a.sent();
                store = new src_1.SubagentStore(dir);
                return [4 /*yield*/, store.load()];
            case 2:
                records = _a.sent();
                (0, bun_test_1.expect)(records).toHaveLength(0);
                now = Date.now();
                return [4 /*yield*/, store.save([
                        {
                            id: "a1",
                            task: "persist",
                            mode: "code",
                            status: "completed",
                            attached: true,
                            modelProfile: "",
                            allowedTools: [],
                            excludeTools: [],
                            outputs: [{ step: 1, text: "ok", timestamp: now }],
                            createdAt: now,
                            updatedAt: now,
                            phase: "finalizing",
                            lastActivityAt: now,
                            activityDetail: "completed",
                            startedAt: now,
                        },
                    ])];
            case 3:
                _a.sent();
                return [4 /*yield*/, store.load()];
            case 4:
                loaded = _a.sent();
                (0, bun_test_1.expect)(loaded).toHaveLength(1);
                (0, bun_test_1.expect)(loaded[0].id).toBe("a1");
                (0, bun_test_1.expect)(loaded[0].task).toBe("persist");
                (0, bun_test_1.expect)(loaded[0].outputs[0].text).toBe("ok");
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("store handles missing directory", function () { return __awaiter(void 0, void 0, void 0, function () {
    var dir, store, records;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, tempDir()];
            case 1:
                dir = _a.sent();
                store = new src_1.SubagentStore((0, node_path_1.join)(dir, "nonexistent"));
                return [4 /*yield*/, store.load()];
            case 2:
                records = _a.sent();
                (0, bun_test_1.expect)(records).toHaveLength(0);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("store handles corrupt manifest", function () { return __awaiter(void 0, void 0, void 0, function () {
    var dir, store, records;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, tempDir()];
            case 1:
                dir = _a.sent();
                store = new src_1.SubagentStore(dir);
                return [4 /*yield*/, (0, promises_1.mkdir)(store.dir, { recursive: true })];
            case 2:
                _a.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(store.dir, "manifest.json"), "{corrupt")];
            case 3:
                _a.sent();
                return [4 /*yield*/, store.load()];
            case 4:
                records = _a.sent();
                (0, bun_test_1.expect)(records).toHaveLength(0);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("store keeps its state under .natalia and never in the workspace root", function () { return __awaiter(void 0, void 0, void 0, function () {
    var dir, store, now, _a, _b, _c;
    var _d;
    return __generator(this, function (_e) {
        switch (_e.label) {
            case 0: return [4 /*yield*/, tempDir()];
            case 1:
                dir = _e.sent();
                store = new src_1.SubagentStore(dir);
                (0, bun_test_1.expect)(store.dir).toBe((0, node_path_1.join)(dir, ".natalia", "subagents"));
                now = Date.now();
                return [4 /*yield*/, store.save([
                        {
                            id: "a1",
                            task: "placement",
                            mode: "code",
                            status: "completed",
                            attached: false,
                            modelProfile: "",
                            allowedTools: [],
                            excludeTools: [],
                            outputs: [{ step: 1, text: "done", timestamp: now }],
                            createdAt: now,
                            updatedAt: now,
                            phase: "finalizing",
                            lastActivityAt: now,
                            activityDetail: "completed",
                            startedAt: now,
                        },
                    ])];
            case 2:
                _e.sent();
                // A workspace root is the user's project directory. Writing a manifest there
                // would leave a stray file next to their own sources.
                _a = bun_test_1.expect;
                return [4 /*yield*/, (0, promises_1.readdir)(dir)];
            case 3:
                // A workspace root is the user's project directory. Writing a manifest there
                // would leave a stray file next to their own sources.
                _a.apply(void 0, [_e.sent()]).toEqual([".natalia"]);
                _b = bun_test_1.expect;
                return [4 /*yield*/, (0, promises_1.readdir)(store.dir)];
            case 4:
                _b.apply(void 0, [_e.sent()]).toEqual(["manifest.json"]);
                _c = bun_test_1.expect;
                return [4 /*yield*/, store.load()];
            case 5:
                _c.apply(void 0, [(_d = (_e.sent())[0]) === null || _d === void 0 ? void 0 : _d.task]).toBe("placement");
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("spawn respects AbortSignal from options", function () { return __awaiter(void 0, void 0, void 0, function () {
    var reg, _a, ac, spawnPromise, rec;
    var _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                _a = src_1.SubagentRegistry.bind;
                _b = {
                    runner: delayedRunner
                };
                return [4 /*yield*/, tempDir()];
            case 1:
                reg = new (_a.apply(src_1.SubagentRegistry, [void 0, (_b.workDir = _c.sent(),
                        _b)]))();
                ac = new AbortController();
                spawnPromise = reg.spawn("abortable", { signal: ac.signal });
                ac.abort();
                return [4 /*yield*/, spawnPromise];
            case 2:
                rec = _c.sent();
                (0, bun_test_1.expect)(rec.status).toBe("stopped");
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("spawn sets mode and modelProfile from options", function () { return __awaiter(void 0, void 0, void 0, function () {
    var reg, _a, rec;
    var _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                _a = src_1.SubagentRegistry.bind;
                _b = {
                    runner: immediateRunner
                };
                return [4 /*yield*/, tempDir()];
            case 1:
                reg = new (_a.apply(src_1.SubagentRegistry, [void 0, (_b.workDir = _c.sent(),
                        _b)]))();
                return [4 /*yield*/, reg.spawn("options", {
                        mode: "debug",
                        modelProfile: "strong",
                        allowedTools: ["read", "write"],
                        excludeTools: ["delete"],
                    })];
            case 2:
                rec = _c.sent();
                (0, bun_test_1.expect)(rec.mode).toBe("debug");
                (0, bun_test_1.expect)(rec.modelProfile).toBe("strong");
                (0, bun_test_1.expect)(rec.allowedTools).toEqual(["read", "write"]);
                (0, bun_test_1.expect)(rec.excludeTools).toEqual(["delete"]);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("load restores agents from store on construction", function () { return __awaiter(void 0, void 0, void 0, function () {
    var dir, store, now, reg;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, tempDir()];
            case 1:
                dir = _b.sent();
                store = new src_1.SubagentStore(dir);
                now = Date.now();
                return [4 /*yield*/, store.save([
                        {
                            id: "a1",
                            task: "pre existing",
                            mode: "code",
                            status: "completed",
                            attached: false,
                            modelProfile: "",
                            allowedTools: [],
                            excludeTools: [],
                            outputs: [{ step: 1, text: "done", timestamp: now }],
                            createdAt: now,
                            updatedAt: now,
                            phase: "finalizing",
                            lastActivityAt: now,
                            activityDetail: "completed",
                            startedAt: now,
                        },
                    ])];
            case 2:
                _b.sent();
                reg = new src_1.SubagentRegistry({ runner: immediateRunner, workDir: dir });
                return [4 /*yield*/, reg.load()];
            case 3:
                _b.sent();
                (0, bun_test_1.expect)(reg.list()).toHaveLength(1);
                (0, bun_test_1.expect)((_a = reg.get("a1")) === null || _a === void 0 ? void 0 : _a.task).toBe("pre existing");
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("load marks process-local running agents stopped after runtime restart", function () { return __awaiter(void 0, void 0, void 0, function () {
    var dir, store, now, registry, _a;
    var _b, _c, _d;
    return __generator(this, function (_e) {
        switch (_e.label) {
            case 0: return [4 /*yield*/, tempDir()];
            case 1:
                dir = _e.sent();
                store = new src_1.SubagentStore(dir);
                now = Date.now();
                return [4 /*yield*/, store.save([
                        {
                            id: "a1",
                            task: "interrupted",
                            mode: "code",
                            status: "running",
                            attached: true,
                            modelProfile: "",
                            allowedTools: [],
                            excludeTools: [],
                            outputs: [],
                            createdAt: now,
                            updatedAt: now,
                            phase: "provider",
                            lastActivityAt: now,
                            activityDetail: "running",
                            startedAt: now,
                        },
                    ])];
            case 2:
                _e.sent();
                registry = new src_1.SubagentRegistry({
                    runner: immediateRunner,
                    workDir: dir,
                });
                return [4 /*yield*/, registry.load()];
            case 3:
                _e.sent();
                (0, bun_test_1.expect)(registry.status("a1")).toBe("stopped");
                (0, bun_test_1.expect)((_c = (_b = registry.output("a1")) === null || _b === void 0 ? void 0 : _b.at(-1)) === null || _c === void 0 ? void 0 : _c.text).toContain("runtime restarted");
                _a = bun_test_1.expect;
                return [4 /*yield*/, store.load()];
            case 4:
                _a.apply(void 0, [(_d = (_e.sent())[0]) === null || _d === void 0 ? void 0 : _d.status]).toBe("stopped");
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("retry explicitly starts a new continuation for stopped subagents", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, calls, registry, record, attempt, retried, attempt;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, tempDir()];
            case 1:
                root = _a.sent();
                calls = 0;
                registry = new src_1.SubagentRegistry({
                    workDir: root,
                    runner: function (_task, context) { return __awaiter(void 0, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            calls++;
                            context.log("run ".concat(calls));
                            if (calls === 1)
                                throw new Error("first run failed");
                            return [2 /*return*/];
                        });
                    }); },
                });
                return [4 /*yield*/, registry.spawn("retry task", {
                        parentSessionID: "ses_parent",
                    })];
            case 2:
                record = _a.sent();
                attempt = 0;
                _a.label = 3;
            case 3:
                if (!(attempt < 20 && record.status !== "failed")) return [3 /*break*/, 6];
                return [4 /*yield*/, Bun.sleep(5)];
            case 4:
                _a.sent();
                _a.label = 5;
            case 5:
                attempt++;
                return [3 /*break*/, 3];
            case 6:
                (0, bun_test_1.expect)(record.status).toBe("failed");
                return [4 /*yield*/, registry.retry(record.id)];
            case 7:
                retried = _a.sent();
                attempt = 0;
                _a.label = 8;
            case 8:
                if (!(attempt < 20 && record.status !== "completed")) return [3 /*break*/, 11];
                return [4 /*yield*/, Bun.sleep(5)];
            case 9:
                _a.sent();
                _a.label = 10;
            case 10:
                attempt++;
                return [3 /*break*/, 8];
            case 11:
                (0, bun_test_1.expect)(retried === null || retried === void 0 ? void 0 : retried.continuation).toBe(1);
                (0, bun_test_1.expect)(record.status).toBe("completed");
                (0, bun_test_1.expect)(record.parentSessionID).toBe("ses_parent");
                (0, bun_test_1.expect)(record.outputs.some(function (output) {
                    return output.text.includes("retrying continuation 1");
                })).toBe(true);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("spawn enforces configured nested subagent depth", function () { return __awaiter(void 0, void 0, void 0, function () {
    var registry, _a, root, child;
    var _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                _a = src_1.SubagentRegistry.bind;
                _b = {
                    runner: immediateRunner
                };
                return [4 /*yield*/, tempDir()];
            case 1:
                registry = new (_a.apply(src_1.SubagentRegistry, [void 0, (_b.workDir = _c.sent(),
                        _b)]))();
                return [4 /*yield*/, registry.spawn("root", { maxDepth: 2 })];
            case 2:
                root = _c.sent();
                return [4 /*yield*/, registry.spawn("child", {
                        parentAgentID: root.id,
                        maxDepth: 2,
                    })];
            case 3:
                child = _c.sent();
                return [4 /*yield*/, (0, bun_test_1.expect)(registry.spawn("grandchild", { parentAgentID: child.id, maxDepth: 2 })).rejects.toThrow("depth limit reached (2)")];
            case 4:
                _c.sent();
                (0, bun_test_1.expect)(child.parentAgentID).toBe(root.id);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("save persists to store", function () { return __awaiter(void 0, void 0, void 0, function () {
    var dir, reg, store, records;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, tempDir()];
            case 1:
                dir = _a.sent();
                reg = new src_1.SubagentRegistry({ runner: immediateRunner, workDir: dir });
                return [4 /*yield*/, reg.spawn("save test")];
            case 2:
                _a.sent();
                return [4 /*yield*/, reg.save()];
            case 3:
                _a.sent();
                store = new src_1.SubagentStore(dir);
                return [4 /*yield*/, store.load()];
            case 4:
                records = _a.sent();
                (0, bun_test_1.expect)(records).toHaveLength(1);
                (0, bun_test_1.expect)(records[0].task).toBe("save test");
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("spawn auto-saves after runner completes", function () { return __awaiter(void 0, void 0, void 0, function () {
    var dir, reg, store, records, attempt;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, tempDir()];
            case 1:
                dir = _b.sent();
                reg = new src_1.SubagentRegistry({ runner: delayedRunner, workDir: dir });
                return [4 /*yield*/, reg.spawn("auto save")];
            case 2:
                _b.sent();
                store = new src_1.SubagentStore(dir);
                return [4 /*yield*/, store.load()];
            case 3:
                records = _b.sent();
                attempt = 0;
                _b.label = 4;
            case 4:
                if (!(attempt < 100)) return [3 /*break*/, 8];
                if (records.length === 1 && ((_a = records[0]) === null || _a === void 0 ? void 0 : _a.status) === "completed")
                    return [3 /*break*/, 8];
                return [4 /*yield*/, Bun.sleep(10)];
            case 5:
                _b.sent();
                return [4 /*yield*/, store.load()];
            case 6:
                records = _b.sent();
                _b.label = 7;
            case 7:
                attempt += 1;
                return [3 /*break*/, 4];
            case 8:
                (0, bun_test_1.expect)(records).toHaveLength(1);
                (0, bun_test_1.expect)(records[0].status).toBe("completed");
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("runner failure sets failed status", function () { return __awaiter(void 0, void 0, void 0, function () {
    var reg, _a, rec;
    var _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                _a = src_1.SubagentRegistry.bind;
                _b = {
                    runner: function (_task, ctx) { return __awaiter(void 0, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            ctx.setStatus("running");
                            throw new Error("runner failed");
                        });
                    }); }
                };
                return [4 /*yield*/, tempDir()];
            case 1:
                reg = new (_a.apply(src_1.SubagentRegistry, [void 0, (_b.workDir = _c.sent(),
                        _b)]))();
                return [4 /*yield*/, reg.spawn("fail test")];
            case 2:
                rec = _c.sent();
                return [4 /*yield*/, new Promise(function (r) { return setTimeout(r, 10); })];
            case 3:
                _c.sent();
                (0, bun_test_1.expect)(rec.status).toBe("failed");
                (0, bun_test_1.expect)(rec.outputs.some(function (o) { return o.text.includes("runner failed"); })).toBeTrue();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("reportActivity updates lastActivityAt and phase", function () { return __awaiter(void 0, void 0, void 0, function () {
    var reg, _a, rec;
    var _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                _a = src_1.SubagentRegistry.bind;
                _b = {
                    runner: immediateRunner
                };
                return [4 /*yield*/, tempDir()];
            case 1:
                reg = new (_a.apply(src_1.SubagentRegistry, [void 0, (_b.workDir = _c.sent(),
                        _b)]))();
                return [4 /*yield*/, reg.spawn("activity test")];
            case 2:
                rec = _c.sent();
                (0, bun_test_1.expect)(rec.phase).not.toBe("idle");
                (0, bun_test_1.expect)(rec.lastActivityAt).toBeGreaterThanOrEqual(rec.createdAt);
                (0, bun_test_1.expect)(rec.activityDetail).toBeTruthy();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("reportActivity from external caller updates the record without touching status", function () { return __awaiter(void 0, void 0, void 0, function () {
    var dir, reg, rec, prevActivity, updated;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, tempDir()];
            case 1:
                dir = _a.sent();
                reg = new src_1.SubagentRegistry({
                    runner: function (_task, ctx) { return __awaiter(void 0, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0: return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 30); })];
                                case 1:
                                    _a.sent();
                                    return [2 /*return*/];
                            }
                        });
                    }); },
                    workDir: dir,
                });
                return [4 /*yield*/, reg.spawn("external activity")];
            case 2:
                rec = _a.sent();
                prevActivity = rec.lastActivityAt;
                return [4 /*yield*/, Bun.sleep(5)];
            case 3:
                _a.sent();
                reg.reportActivity(rec.id, "tool", "read_file");
                updated = reg.get(rec.id);
                (0, bun_test_1.expect)(updated.lastActivityAt).toBeGreaterThan(prevActivity);
                (0, bun_test_1.expect)(updated.phase).toBe("tool");
                (0, bun_test_1.expect)(updated.activityDetail).toBe("read_file");
                (0, bun_test_1.expect)(updated.status).toBe("running");
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("health returns terminal for completed agents", function () { return __awaiter(void 0, void 0, void 0, function () {
    var reg, _a, rec;
    var _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                _a = src_1.SubagentRegistry.bind;
                _b = {
                    runner: immediateRunner
                };
                return [4 /*yield*/, tempDir()];
            case 1:
                reg = new (_a.apply(src_1.SubagentRegistry, [void 0, (_b.workDir = _c.sent(),
                        _b)]))();
                return [4 /*yield*/, reg.spawn("health completed")];
            case 2:
                rec = _c.sent();
                return [4 /*yield*/, Bun.sleep(10)];
            case 3:
                _c.sent();
                (0, bun_test_1.expect)(reg.health(rec.id)).toBe("terminal");
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("health returns active shortly after activity and quiet after stall threshold", function () { return __awaiter(void 0, void 0, void 0, function () {
    var aborted, reg, _a, rec;
    var _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                aborted = false;
                _a = src_1.SubagentRegistry.bind;
                _b = {
                    runner: function (_task, ctx) { return __awaiter(void 0, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0: return [4 /*yield*/, new Promise(function (resolve) {
                                        ctx.signal.addEventListener("abort", function () {
                                            aborted = true;
                                            resolve();
                                        }, { once: true });
                                    })];
                                case 1:
                                    _a.sent();
                                    return [2 /*return*/];
                            }
                        });
                    }); }
                };
                return [4 /*yield*/, tempDir()];
            case 1:
                reg = new (_a.apply(src_1.SubagentRegistry, [void 0, (_b.workDir = _c.sent(),
                        _b.stallThresholdMs = 800,
                        _b)]))();
                return [4 /*yield*/, reg.spawn("health phases")];
            case 2:
                rec = _c.sent();
                (0, bun_test_1.expect)(reg.health(rec.id)).toBe("active");
                return [4 /*yield*/, Bun.sleep(900)];
            case 3:
                _c.sent();
                (0, bun_test_1.expect)(reg.health(rec.id)).toBe("stalled");
                reg.stop(rec.id);
                return [4 /*yield*/, Bun.sleep(100)];
            case 4:
                _c.sent();
                (0, bun_test_1.expect)(aborted).toBeTrue();
                (0, bun_test_1.expect)(reg.health(rec.id)).toBe("terminal");
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("wait resolves when all agents reach terminal", function () { return __awaiter(void 0, void 0, void 0, function () {
    var callCount, reg, _a, a1, a2, results;
    var _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                callCount = 0;
                _a = src_1.SubagentRegistry.bind;
                _b = {
                    runner: function () { return __awaiter(void 0, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    callCount++;
                                    if (!(callCount === 1)) return [3 /*break*/, 2];
                                    return [4 /*yield*/, Bun.sleep(30)];
                                case 1:
                                    _a.sent();
                                    _a.label = 2;
                                case 2: return [2 /*return*/];
                            }
                        });
                    }); }
                };
                return [4 /*yield*/, tempDir()];
            case 1:
                reg = new (_a.apply(src_1.SubagentRegistry, [void 0, (_b.workDir = _c.sent(),
                        _b)]))();
                return [4 /*yield*/, reg.spawn("wait a1")];
            case 2:
                a1 = _c.sent();
                return [4 /*yield*/, reg.spawn("wait a2")];
            case 3:
                a2 = _c.sent();
                return [4 /*yield*/, reg.wait([a1.id, a2.id], "all_terminal", 5000)];
            case 4:
                results = _c.sent();
                (0, bun_test_1.expect)(results[a1.id].status).toBe("completed");
                (0, bun_test_1.expect)(results[a2.id].status).toBe("completed");
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("wait resolves when any agent reaches terminal", function () { return __awaiter(void 0, void 0, void 0, function () {
    var reg, _a, a1, a2, results, terminalIds;
    var _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                _a = src_1.SubagentRegistry.bind;
                _b = {
                    runner: function () { return __awaiter(void 0, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0: return [4 /*yield*/, Bun.sleep(100)];
                                case 1:
                                    _a.sent();
                                    return [2 /*return*/];
                            }
                        });
                    }); }
                };
                return [4 /*yield*/, tempDir()];
            case 1:
                reg = new (_a.apply(src_1.SubagentRegistry, [void 0, (_b.workDir = _c.sent(),
                        _b)]))();
                return [4 /*yield*/, reg.spawn("wait any fast")];
            case 2:
                a1 = _c.sent();
                return [4 /*yield*/, reg.spawn("wait any slow")];
            case 3:
                a2 = _c.sent();
                return [4 /*yield*/, reg.wait([a1.id, a2.id], "any_terminal", 10000)];
            case 4:
                results = _c.sent();
                terminalIds = Object.entries(results).filter(function (_a) {
                    var r = _a[1];
                    return ["completed", "failed", "stopped"].includes(r.status);
                });
                (0, bun_test_1.expect)(terminalIds.length).toBeGreaterThanOrEqual(1);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("wait returns current results on timeout", function () { return __awaiter(void 0, void 0, void 0, function () {
    var reg, _a, a1, results;
    var _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                _a = src_1.SubagentRegistry.bind;
                _b = {
                    runner: function () { return __awaiter(void 0, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0: return [4 /*yield*/, Bun.sleep(500)];
                                case 1:
                                    _a.sent();
                                    return [2 /*return*/];
                            }
                        });
                    }); }
                };
                return [4 /*yield*/, tempDir()];
            case 1:
                reg = new (_a.apply(src_1.SubagentRegistry, [void 0, (_b.workDir = _c.sent(),
                        _b)]))();
                return [4 /*yield*/, reg.spawn("wait timeout")];
            case 2:
                a1 = _c.sent();
                return [4 /*yield*/, reg.wait([a1.id], "all_terminal", 100)];
            case 3:
                results = _c.sent();
                (0, bun_test_1.expect)(results[a1.id].status).toBe("running");
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("wait respects caller abort signal", function () { return __awaiter(void 0, void 0, void 0, function () {
    var reg, _a, a1, ac, results;
    var _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                _a = src_1.SubagentRegistry.bind;
                _b = {
                    runner: function () { return __awaiter(void 0, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0: return [4 /*yield*/, Bun.sleep(500)];
                                case 1:
                                    _a.sent();
                                    return [2 /*return*/];
                            }
                        });
                    }); }
                };
                return [4 /*yield*/, tempDir()];
            case 1:
                reg = new (_a.apply(src_1.SubagentRegistry, [void 0, (_b.workDir = _c.sent(),
                        _b)]))();
                return [4 /*yield*/, reg.spawn("wait abort")];
            case 2:
                a1 = _c.sent();
                ac = new AbortController();
                setTimeout(function () { return ac.abort(); }, 50);
                return [4 /*yield*/, reg.wait([a1.id], "all_terminal", 5000, ac.signal)];
            case 3:
                results = _c.sent();
                (0, bun_test_1.expect)(results[a1.id].status).toBe("running");
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("activity events carry phase information to subscribers", function () { return __awaiter(void 0, void 0, void 0, function () {
    var reg, _a, events, activityEvents, phases;
    var _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                _a = src_1.SubagentRegistry.bind;
                _b = {
                    runner: function (_task, ctx) { return __awaiter(void 0, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    ctx.setStatus("running");
                                    return [4 /*yield*/, Bun.sleep(5)];
                                case 1:
                                    _a.sent();
                                    ctx.log("midway");
                                    return [4 /*yield*/, Bun.sleep(5)];
                                case 2:
                                    _a.sent();
                                    return [2 /*return*/];
                            }
                        });
                    }); }
                };
                return [4 /*yield*/, tempDir()];
            case 1:
                reg = new (_a.apply(src_1.SubagentRegistry, [void 0, (_b.workDir = _c.sent(),
                        _b)]))();
                events = subscribeTo(reg).events;
                return [4 /*yield*/, reg.spawn("activity events")];
            case 2:
                _c.sent();
                return [4 /*yield*/, Bun.sleep(30)];
            case 3:
                _c.sent();
                activityEvents = events.filter(function (e) { return e.event === "activity"; });
                (0, bun_test_1.expect)(activityEvents.length).toBeGreaterThanOrEqual(1);
                phases = activityEvents.map(function (e) { return e.phase; }).filter(Boolean);
                (0, bun_test_1.expect)(phases).toContain("provider");
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("registry with sessionID isolates records from other sessions", function () { return __awaiter(void 0, void 0, void 0, function () {
    var dir, regA, regB, listA, listB;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, tempDir()];
            case 1:
                dir = _a.sent();
                regA = new src_1.SubagentRegistry({
                    runner: immediateRunner,
                    workDir: dir,
                    sessionID: "session-a",
                });
                regB = new src_1.SubagentRegistry({
                    runner: immediateRunner,
                    workDir: dir,
                    sessionID: "session-b",
                });
                return [4 /*yield*/, regA.spawn("session-a task")];
            case 2:
                _a.sent();
                return [4 /*yield*/, regB.spawn("session-b task")];
            case 3:
                _a.sent();
                listA = regA.list();
                listB = regB.list();
                (0, bun_test_1.expect)(listA).toHaveLength(1);
                (0, bun_test_1.expect)(listB).toHaveLength(1);
                (0, bun_test_1.expect)(listA[0].id).toBe("a1");
                (0, bun_test_1.expect)(listB[0].id).toBe("a1");
                (0, bun_test_1.expect)(listA[0].task).toBe("session-a task");
                (0, bun_test_1.expect)(listB[0].task).toBe("session-b task");
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("same sessionID resumes id counter across registry restarts", function () { return __awaiter(void 0, void 0, void 0, function () {
    var dir, reg1, reg2, rec;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, tempDir()];
            case 1:
                dir = _a.sent();
                reg1 = new src_1.SubagentRegistry({
                    runner: immediateRunner,
                    workDir: dir,
                    sessionID: "persistent",
                });
                return [4 /*yield*/, reg1.spawn("first")];
            case 2:
                _a.sent();
                (0, bun_test_1.expect)(reg1.list()[0].id).toBe("a1");
                reg2 = new src_1.SubagentRegistry({
                    runner: immediateRunner,
                    workDir: dir,
                    sessionID: "persistent",
                });
                return [4 /*yield*/, reg2.load()];
            case 3:
                _a.sent();
                (0, bun_test_1.expect)(reg2.list()).toHaveLength(1);
                (0, bun_test_1.expect)(reg2.list()[0].id).toBe("a1");
                return [4 /*yield*/, reg2.spawn("second")];
            case 4:
                rec = _a.sent();
                (0, bun_test_1.expect)(rec.id).toBe("a2");
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("store uses session-scoped path when sessionID is provided", function () { return __awaiter(void 0, void 0, void 0, function () {
    var dir, store;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, tempDir()];
            case 1:
                dir = _a.sent();
                store = new src_1.SubagentStore(dir, "ses_abc");
                (0, bun_test_1.expect)(store.dir).toBe((0, node_path_1.join)(dir, ".natalia", "sessions", "ses_abc", "subagents"));
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("session-scoped store backfills missing parentSessionID for legacy records", function () { return __awaiter(void 0, void 0, void 0, function () {
    var dir, store, now, loaded, persisted, _a, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0: return [4 /*yield*/, tempDir()];
            case 1:
                dir = _c.sent();
                store = new src_1.SubagentStore(dir, "ses_legacy");
                now = Date.now();
                return [4 /*yield*/, store.save([
                        {
                            id: "a1",
                            task: "legacy",
                            mode: "code",
                            status: "failed",
                            attached: true,
                            modelProfile: "",
                            allowedTools: [],
                            excludeTools: [],
                            outputs: [{ step: 1, text: "old failure", timestamp: now }],
                            createdAt: now,
                            updatedAt: now,
                            phase: "finalizing",
                            lastActivityAt: now,
                            activityDetail: "old failure",
                            startedAt: now,
                        },
                    ])];
            case 2:
                _c.sent();
                return [4 /*yield*/, store.load()];
            case 3:
                loaded = _c.sent();
                (0, bun_test_1.expect)(loaded[0].parentSessionID).toBe("ses_legacy");
                _b = (_a = JSON).parse;
                return [4 /*yield*/, (0, promises_1.readFile)((0, node_path_1.join)(store.dir, "manifest.json"), "utf8")];
            case 4:
                persisted = _b.apply(_a, [_c.sent()]);
                (0, bun_test_1.expect)(persisted[0].parentSessionID).toBe("ses_legacy");
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("registry without sessionID uses the legacy shared store path", function () { return __awaiter(void 0, void 0, void 0, function () {
    var dir, reg, reg2;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, tempDir()];
            case 1:
                dir = _a.sent();
                reg = new src_1.SubagentRegistry({
                    runner: immediateRunner,
                    workDir: dir,
                });
                (0, bun_test_1.expect)(reg.list()).toHaveLength(0);
                return [4 /*yield*/, reg.spawn("shared task")];
            case 2:
                _a.sent();
                (0, bun_test_1.expect)(reg.list()).toHaveLength(1);
                reg2 = new src_1.SubagentRegistry({
                    runner: immediateRunner,
                    workDir: dir,
                });
                return [4 /*yield*/, reg2.load()];
            case 3:
                _a.sent();
                (0, bun_test_1.expect)(reg2.list()).toHaveLength(1);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("formatStatus includes phase and activity info", function () { return __awaiter(void 0, void 0, void 0, function () {
    var reg, _a, s;
    var _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                _a = src_1.SubagentRegistry.bind;
                _b = {
                    runner: immediateRunner
                };
                return [4 /*yield*/, tempDir()];
            case 1:
                reg = new (_a.apply(src_1.SubagentRegistry, [void 0, (_b.workDir = _c.sent(),
                        _b)]))();
                return [4 /*yield*/, reg.spawn("format status detail")];
            case 2:
                _c.sent();
                return [4 /*yield*/, reg.formatStatus("a1")];
            case 3:
                s = _c.sent();
                (0, bun_test_1.expect)(s).toContain("phase:");
                (0, bun_test_1.expect)(s).toContain("activity:");
                (0, bun_test_1.expect)(s).toContain("last_activity:");
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("reportActivity with throttled updates does not flood subscribers", function () { return __awaiter(void 0, void 0, void 0, function () {
    var reg, _a, events, rec, i, activityEvents;
    var _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                _a = src_1.SubagentRegistry.bind;
                _b = {
                    runner: function (_task, ctx) { return __awaiter(void 0, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0: return [4 /*yield*/, Bun.sleep(20)];
                                case 1:
                                    _a.sent();
                                    return [2 /*return*/];
                            }
                        });
                    }); }
                };
                return [4 /*yield*/, tempDir()];
            case 1:
                reg = new (_a.apply(src_1.SubagentRegistry, [void 0, (_b.workDir = _c.sent(),
                        _b)]))();
                events = subscribeTo(reg).events;
                return [4 /*yield*/, reg.spawn("throttle")];
            case 2:
                rec = _c.sent();
                for (i = 0; i < 50; i++) {
                    reg.reportActivity(rec.id, "tool", "op-".concat(i));
                }
                activityEvents = events.filter(function (e) { return e.event === "activity" && e.agentId === rec.id; });
                (0, bun_test_1.expect)(activityEvents.length).toBeLessThan(50);
                return [2 /*return*/];
        }
    });
}); });
