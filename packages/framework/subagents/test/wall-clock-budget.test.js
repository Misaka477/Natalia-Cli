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
var registry_1 = require("../src/registry");
/** A registry whose runner blocks until its signal aborts, like a stuck call. */
function registryWithStuckRunner(budgetMs) {
    var _this = this;
    var aborted = [];
    var registry = new registry_1.SubagentRegistry({
        workDir: "/tmp/natalia-wallclock",
        runner: function (_task, ctx) { return __awaiter(_this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, new Promise(function (resolve) {
                            if (ctx.signal.aborted) {
                                aborted.push("already-aborted");
                                resolve();
                                return;
                            }
                            ctx.signal.addEventListener("abort", function () {
                                aborted.push("aborted");
                                resolve();
                            });
                        })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); },
        sessionID: "s1",
        wallClockBudgetMs: budgetMs,
    });
    return { registry: registry, aborted: aborted };
}
(0, bun_test_1.test)("a run that outlives its budget is stopped", function () { return __awaiter(void 0, void 0, void 0, function () {
    var _a, registry, aborted, record;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _a = registryWithStuckRunner(30), registry = _a.registry, aborted = _a.aborted;
                return [4 /*yield*/, registry.spawn("stuck forever")];
            case 1:
                _b.sent();
                // Give the deadline room to fire.
                return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 120); })];
            case 2:
                // Give the deadline room to fire.
                _b.sent();
                record = registry.get("a1");
                (0, bun_test_1.expect)(record.status).toBe("stopped");
                // The run's own completion path overwrites the detail with its status, so the
                // reason lives in the audit trail.
                (0, bun_test_1.expect)(registry.audit()).toContain("wall-clock budget");
                (0, bun_test_1.expect)(aborted).toContain("aborted");
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("a budget stop is attributed to the runtime, not the model", function () { return __awaiter(void 0, void 0, void 0, function () {
    var registry;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                registry = registryWithStuckRunner(20).registry;
                return [4 /*yield*/, registry.spawn("stuck forever")];
            case 1:
                _a.sent();
                return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 120); })];
            case 2:
                _a.sent();
                // Attributed to the runtime rather than the model: nothing asked for this
                // stop, the deadline did.
                (0, bun_test_1.expect)(registry.audit()).toContain("requested_by=runtime");
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("a healthy run is never stopped by its budget", function () { return __awaiter(void 0, void 0, void 0, function () {
    var registry, record;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                registry = new registry_1.SubagentRegistry({
                    workDir: "/tmp/natalia-wallclock",
                    runner: function (_task, ctx) { return __awaiter(void 0, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            ctx.log("working");
                            return [2 /*return*/];
                        });
                    }); },
                    sessionID: "s1",
                    wallClockBudgetMs: 5000,
                });
                return [4 /*yield*/, registry.spawn("quick work")];
            case 1:
                _a.sent();
                return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 60); })];
            case 2:
                _a.sent();
                record = registry.get("a1");
                (0, bun_test_1.expect)(record.status).toBe("completed");
                (0, bun_test_1.expect)(registry.audit()).not.toContain("action=stop");
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("a disabled budget leaves a stuck run alone", function () { return __awaiter(void 0, void 0, void 0, function () {
    var registry;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                registry = registryWithStuckRunner(0).registry;
                return [4 /*yield*/, registry.spawn("stuck forever")];
            case 1:
                _a.sent();
                return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 120); })];
            case 2:
                _a.sent();
                (0, bun_test_1.expect)(registry.get("a1").status).toBe("running");
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("each retry gets a fresh budget", function () { return __awaiter(void 0, void 0, void 0, function () {
    var runs, registry;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                runs = 0;
                registry = new registry_1.SubagentRegistry({
                    workDir: "/tmp/natalia-wallclock",
                    runner: function (_task, ctx) { return __awaiter(void 0, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    runs += 1;
                                    if (!(runs === 1)) return [3 /*break*/, 2];
                                    return [4 /*yield*/, new Promise(function (resolve) {
                                            ctx.signal.addEventListener("abort", function () { return resolve(); });
                                        })];
                                case 1:
                                    _a.sent();
                                    return [2 /*return*/];
                                case 2:
                                    ctx.log("second run finished");
                                    return [2 /*return*/];
                            }
                        });
                    }); },
                    sessionID: "s1",
                    wallClockBudgetMs: 40,
                });
                return [4 /*yield*/, registry.spawn("retry me")];
            case 1:
                _a.sent();
                return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 120); })];
            case 2:
                _a.sent();
                (0, bun_test_1.expect)(registry.get("a1").status).toBe("stopped");
                return [4 /*yield*/, registry.retry("a1")];
            case 3:
                _a.sent();
                return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 20); })];
            case 4:
                _a.sent();
                // The retry was given its own budget and finished inside it.
                (0, bun_test_1.expect)(registry.get("a1").status).toBe("completed");
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("a budget stop carries the configured duration in its reason", function () { return __awaiter(void 0, void 0, void 0, function () {
    var registry;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                registry = registryWithStuckRunner(25).registry;
                return [4 /*yield*/, registry.spawn("stuck forever")];
            case 1:
                _a.sent();
                return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 120); })];
            case 2:
                _a.sent();
                (0, bun_test_1.expect)(registry.audit()).toContain("25ms");
                return [2 /*return*/];
        }
    });
}); });
