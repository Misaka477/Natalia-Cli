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
exports.createSubagentsController = createSubagentsController;
var registry_1 = require("./registry");
function createSubagentsController(input) {
    var _this = this;
    var registry;
    function init(runner) {
        return __awaiter(this, void 0, void 0, function () {
            var next;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        next = new registry_1.SubagentRegistry({
                            workDir: input.workDir,
                            runner: runner,
                            sessionID: (_a = input.sessionID) === null || _a === void 0 ? void 0 : _a.call(input),
                            wallClockBudgetMs: input.wallClockBudgetMs,
                        });
                        return [4 /*yield*/, next.load()];
                    case 1:
                        _b.sent();
                        registry = next;
                        return [2 /*return*/];
                }
            });
        });
    }
    /**
     * Install or clear the live-delivery hook for one subagent.
     *
     * The runtime that owns the child's ledger is the only thing that can reach
     * it, so it installs the hook for the duration of the child's run and clears
     * it when the run ends — after which a message queues instead of vanishing.
     */
    function setSteerHook(id, hook) {
        requireRegistry().setSteerHook(id, hook);
    }
    function enabled() {
        return registry !== undefined;
    }
    function requireRegistry() {
        if (!registry)
            throw new Error("subagent registry is not initialized");
        return registry;
    }
    function runningCount() {
        var _a;
        return (_a = registry === null || registry === void 0 ? void 0 : registry.runningCount()) !== null && _a !== void 0 ? _a : 0;
    }
    return {
        init: init,
        enabled: enabled,
        spawn: function (task, options) { return __awaiter(_this, void 0, void 0, function () { return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, requireRegistry().spawn(task, options)];
                case 1: return [2 /*return*/, _a.sent()];
            }
        }); }); },
        list: function () { return requireRegistry().list(); },
        runningCount: runningCount,
        get: function (id) { return requireRegistry().get(id); },
        status: function (id) { return requireRegistry().status(id); },
        health: function (id) { return requireRegistry().health(id); },
        requestStop: function (id, reason, force) {
            return requireRegistry().requestStop(id, reason, force);
        },
        stop: function (id) { return requireRegistry().stop(id); },
        resume: function (id) { return __awaiter(_this, void 0, void 0, function () { return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, requireRegistry().resume(id)];
                case 1: return [2 /*return*/, _a.sent()];
            }
        }); }); },
        setPendingMessages: function (id, messages) {
            return requireRegistry().setPendingMessages(id, messages);
        },
        setSteerHook: setSteerHook,
        // Authority, live routing and the queueing fallback all live on the registry
        // now, so both a bare registry and this composition answer a steer the same
        // way instead of the composition being the only one that can.
        sendMessage: function (id, message, callerSession) { return __awaiter(_this, void 0, void 0, function () { return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, requireRegistry().sendMessage(id, message, callerSession)];
                case 1: return [2 /*return*/, _a.sent()];
            }
        }); }); },
        retry: function (id) { return __awaiter(_this, void 0, void 0, function () { return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, requireRegistry().retry(id)];
                case 1: return [2 /*return*/, _a.sent()];
            }
        }); }); },
        attach: function (id) { return requireRegistry().attach(id); },
        detach: function (id) { return requireRegistry().detach(id); },
        cleanup: function (dryRun) { return requireRegistry().cleanup(dryRun); },
        audit: function (tail, format) { return requireRegistry().audit(tail, format); },
        subscribe: function (fn) { return requireRegistry().subscribe(fn); },
        formatList: function () { return __awaiter(_this, void 0, void 0, function () { return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, requireRegistry().formatList()];
                case 1: return [2 /*return*/, _a.sent()];
            }
        }); }); },
        formatOutput: function (id, verbose) { return __awaiter(_this, void 0, void 0, function () { return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, requireRegistry().formatOutput(id, verbose)];
                case 1: return [2 /*return*/, _a.sent()];
            }
        }); }); },
        formatStatus: function (id) { return __awaiter(_this, void 0, void 0, function () { return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, requireRegistry().formatStatus(id)];
                case 1: return [2 /*return*/, _a.sent()];
            }
        }); }); },
        wait: function (ids, until, timeoutMs, signal) { return __awaiter(_this, void 0, void 0, function () { return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, requireRegistry().wait(ids, until, timeoutMs, signal)];
                case 1: return [2 /*return*/, _a.sent()];
            }
        }); }); },
    };
}
