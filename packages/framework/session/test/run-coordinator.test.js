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
var src_1 = require("../src");
(0, bun_test_1.test)("joins concurrent runs for one session", function () { return __awaiter(void 0, void 0, void 0, function () {
    var coordinator, release, runs, drain, first, second;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                coordinator = new src_1.SessionRunCoordinator();
                runs = 0;
                drain = function () { return __awaiter(void 0, void 0, void 0, function () {
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0:
                                runs++;
                                return [4 /*yield*/, new Promise(function (resolve) { return (release = resolve); })];
                            case 1:
                                _a.sent();
                                return [2 /*return*/];
                        }
                    });
                }); };
                first = coordinator.run(drain);
                _a.label = 1;
            case 1:
                if (!!release) return [3 /*break*/, 3];
                return [4 /*yield*/, Bun.sleep(1)];
            case 2:
                _a.sent();
                return [3 /*break*/, 1];
            case 3:
                second = coordinator.run(drain);
                (0, bun_test_1.expect)(runs).toBe(1);
                release === null || release === void 0 ? void 0 : release();
                return [4 /*yield*/, Promise.all([first, second])];
            case 4:
                _a.sent();
                (0, bun_test_1.expect)(runs).toBe(1);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("coalesces repeated wakes into one successor drain", function () { return __awaiter(void 0, void 0, void 0, function () {
    var coordinator, release, runs, drain, first;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                coordinator = new src_1.SessionRunCoordinator();
                runs = 0;
                drain = function () { return __awaiter(void 0, void 0, void 0, function () {
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0:
                                runs++;
                                if (!(runs === 1)) return [3 /*break*/, 2];
                                return [4 /*yield*/, new Promise(function (resolve) { return (release = resolve); })];
                            case 1:
                                _a.sent();
                                _a.label = 2;
                            case 2: return [2 /*return*/];
                        }
                    });
                }); };
                first = coordinator.run(drain);
                _a.label = 1;
            case 1:
                if (!!release) return [3 /*break*/, 3];
                return [4 /*yield*/, Bun.sleep(1)];
            case 2:
                _a.sent();
                return [3 /*break*/, 1];
            case 3: return [4 /*yield*/, Promise.all([
                    coordinator.wake(drain),
                    coordinator.wake(drain),
                    coordinator.wake(drain),
                ])];
            case 4:
                _a.sent();
                release === null || release === void 0 ? void 0 : release();
                return [4 /*yield*/, first];
            case 5:
                _a.sent();
                return [4 /*yield*/, coordinator.idle()];
            case 6:
                _a.sent();
                (0, bun_test_1.expect)(runs).toBe(2);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("waking while idle starts a non-blocking drain", function () { return __awaiter(void 0, void 0, void 0, function () {
    var coordinator, runs;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                coordinator = new src_1.SessionRunCoordinator();
                runs = 0;
                return [4 /*yield*/, coordinator.wake(function () { return __awaiter(void 0, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            runs++;
                            return [2 /*return*/];
                        });
                    }); })];
            case 1:
                _a.sent();
                return [4 /*yield*/, coordinator.idle()];
            case 2:
                _a.sent();
                (0, bun_test_1.expect)(runs).toBe(1);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("wake during interruption cleanup starts one successor", function () { return __awaiter(void 0, void 0, void 0, function () {
    var coordinator, cleanup, second, first, successor, interrupt;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                coordinator = new src_1.SessionRunCoordinator();
                second = false;
                first = function (signal) { return __awaiter(void 0, void 0, void 0, function () {
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0: return [4 /*yield*/, new Promise(function (resolve) {
                                    signal.addEventListener("abort", function () { return (cleanup = resolve); }, {
                                        once: true,
                                    });
                                })];
                            case 1:
                                _a.sent();
                                return [2 /*return*/];
                        }
                    });
                }); };
                successor = function () { return __awaiter(void 0, void 0, void 0, function () {
                    return __generator(this, function (_a) {
                        second = true;
                        return [2 /*return*/];
                    });
                }); };
                return [4 /*yield*/, coordinator.wake(first)];
            case 1:
                _a.sent();
                _a.label = 2;
            case 2:
                if (!!coordinator.active) return [3 /*break*/, 4];
                return [4 /*yield*/, Bun.sleep(1)];
            case 3:
                _a.sent();
                return [3 /*break*/, 2];
            case 4:
                interrupt = coordinator.interrupt();
                _a.label = 5;
            case 5:
                if (!!cleanup) return [3 /*break*/, 7];
                return [4 /*yield*/, Bun.sleep(1)];
            case 6:
                _a.sent();
                return [3 /*break*/, 5];
            case 7: return [4 /*yield*/, coordinator.wake(successor)];
            case 8:
                _a.sent();
                cleanup === null || cleanup === void 0 ? void 0 : cleanup();
                return [4 /*yield*/, interrupt];
            case 9:
                _a.sent();
                return [4 /*yield*/, coordinator.idle()];
            case 10:
                _a.sent();
                (0, bun_test_1.expect)(second).toBe(true);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("same durable session ID shares a process-local coordinator", function () { return __awaiter(void 0, void 0, void 0, function () {
    var first, second;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                first = (0, src_1.sessionRunCoordinator)("ses_shared");
                second = (0, src_1.sessionRunCoordinator)("ses_shared");
                (0, bun_test_1.expect)(second).toBe(first);
                return [4 /*yield*/, first.run(function () { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                        return [2 /*return*/, undefined];
                    }); }); })];
            case 1:
                _a.sent();
                (0, bun_test_1.expect)((0, src_1.releaseSessionRunCoordinator)("ses_shared")).toBe(true);
                return [2 /*return*/];
        }
    });
}); });
