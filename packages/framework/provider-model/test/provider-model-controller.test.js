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
function controllerInput(onInitialize) {
    var _this = this;
    return {
        initialize: onInitialize,
        runnerInput: function () {
            throw new Error("runner input should remain lazy");
        },
        commands: {
            catalog: function () { return __awaiter(_this, void 0, void 0, function () { return __generator(this, function (_a) {
                return [2 /*return*/, []];
            }); }); },
            select: function () { return __awaiter(_this, void 0, void 0, function () { return __generator(this, function (_a) {
                return [2 /*return*/, undefined];
            }); }); },
        },
        navi: {
            available: function () { return false; },
            publish: function () { },
            runBody: function () { return __awaiter(_this, void 0, void 0, function () { return __generator(this, function (_a) {
                return [2 /*return*/, undefined];
            }); }); },
            wake: function () { return __awaiter(_this, void 0, void 0, function () { return __generator(this, function (_a) {
                return [2 /*return*/, undefined];
            }); }); },
        },
        nia: {
            available: function () { return false; },
            publish: function () { },
            runBody: function () { return __awaiter(_this, void 0, void 0, function () { return __generator(this, function (_a) {
                return [2 /*return*/, undefined];
            }); }); },
            wake: function () { return __awaiter(_this, void 0, void 0, function () { return __generator(this, function (_a) {
                return [2 /*return*/, undefined];
            }); }); },
        },
    };
}
(0, bun_test_1.test)("provider model controller initializes and disposes chat work", function () { return __awaiter(void 0, void 0, void 0, function () {
    var initialized, controller;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                initialized = 0;
                controller = (0, src_1.createProviderModelController)(controllerInput(function () {
                    initialized += 1;
                }));
                (0, bun_test_1.expect)(initialized).toBe(1);
                return [4 /*yield*/, controller.dispose()];
            case 1:
                _a.sent();
                return [4 /*yield*/, (0, bun_test_1.expect)(controller.runNaviChatTurn({
                        sessionID: "ses_test",
                        text: "hello",
                        responseMessageID: "msg_1",
                    })).rejects.toThrow("provider/model controller disposed")];
            case 2:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
bun_test_1.test.each(["navi", "nia"])("aborting %s leaves the other stream busy", function (stream) { return __awaiter(void 0, void 0, void 0, function () {
    var input, events, signals, finishNavi, finishNia, naviDone, niaDone, controller, sessionID, turn, naviTask, niaTask, settled, outcomes;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                input = controllerInput(function () { });
                events = [];
                signals = new Map();
                naviDone = new Promise(function (resolve) {
                    finishNavi = resolve;
                });
                niaDone = new Promise(function (resolve) {
                    finishNia = resolve;
                });
                input.navi = {
                    available: function () { return true; },
                    publish: function (_, event) {
                        events.push(event.type);
                    },
                    runBody: function (_, signal) { return __awaiter(void 0, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    signals.set("navi", signal);
                                    return [4 /*yield*/, naviDone];
                                case 1:
                                    _a.sent();
                                    signal.throwIfAborted();
                                    return [2 /*return*/];
                            }
                        });
                    }); },
                    wake: function () { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                        return [2 /*return*/];
                    }); }); },
                };
                input.nia = {
                    available: function () { return true; },
                    publish: function (_, event) {
                        events.push(event.type);
                    },
                    runBody: function (_, signal) { return __awaiter(void 0, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    signals.set("nia", signal);
                                    return [4 /*yield*/, niaDone];
                                case 1:
                                    _a.sent();
                                    signal.throwIfAborted();
                                    return [2 /*return*/];
                            }
                        });
                    }); },
                    wake: function () { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                        return [2 /*return*/];
                    }); }); },
                };
                controller = (0, src_1.createProviderModelController)(input);
                sessionID = "ses_parallel";
                turn = { sessionID: sessionID, responseMessageID: "same-id", text: "hello" };
                naviTask = controller.runNaviChatTurn(turn);
                niaTask = controller.runNiaChatTurn(turn);
                settled = Promise.allSettled([naviTask, niaTask]);
                return [4 /*yield*/, Promise.resolve()];
            case 1:
                _a.sent();
                (0, bun_test_1.expect)(controller.naviBusy(sessionID)).toBe(true);
                (0, bun_test_1.expect)(controller.niaBusy(sessionID)).toBe(true);
                (0, bun_test_1.expect)(stream === "nia"
                    ? controller.abortNia(sessionID)
                    : controller.abortNavi(sessionID)).toBe(true);
                (0, bun_test_1.expect)(signals.get(stream).aborted).toBe(true);
                (0, bun_test_1.expect)(signals.get(stream === "navi" ? "nia" : "navi").aborted).toBe(false);
                finishNavi();
                finishNia();
                return [4 /*yield*/, settled];
            case 2:
                outcomes = _a.sent();
                (0, bun_test_1.expect)(outcomes[stream === "navi" ? 0 : 1].status).toBe("rejected");
                (0, bun_test_1.expect)(outcomes[stream === "navi" ? 1 : 0].status).toBe("fulfilled");
                (0, bun_test_1.expect)(events).toContain("navi.chat.turn.started");
                (0, bun_test_1.expect)(events).toContain("nia.chat.turn.started");
                (0, bun_test_1.expect)(events).toContain("navi.chat.turn.finished");
                (0, bun_test_1.expect)(events).toContain("nia.chat.turn.finished");
                (0, bun_test_1.expect)(controller.naviBusy(sessionID)).toBe(false);
                (0, bun_test_1.expect)(controller.niaBusy(sessionID)).toBe(false);
                return [4 /*yield*/, controller.dispose()];
            case 3:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("each wake waits only for its own stream and calls its own callback", function () { return __awaiter(void 0, void 0, void 0, function () {
    var input, finish, busy, niaWoke, niaWake, naviWoke, naviWake, naviWakeCount, controller, sessionID, task;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                input = controllerInput(function () { });
                busy = new Promise(function (resolve) {
                    finish = resolve;
                });
                niaWake = new Promise(function (resolve) {
                    niaWoke = resolve;
                });
                naviWake = new Promise(function (resolve) {
                    naviWoke = resolve;
                });
                naviWakeCount = 0;
                input.navi.available = input.nia.available = function () { return true; };
                input.navi.runBody = function () { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                    return [2 /*return*/, busy];
                }); }); };
                input.navi.wake = function () { return __awaiter(void 0, void 0, void 0, function () {
                    return __generator(this, function (_a) {
                        naviWakeCount++;
                        naviWoke();
                        return [2 /*return*/];
                    });
                }); };
                input.nia.wake = function () { return __awaiter(void 0, void 0, void 0, function () {
                    return __generator(this, function (_a) {
                        niaWoke();
                        return [2 /*return*/];
                    });
                }); };
                controller = (0, src_1.createProviderModelController)(input);
                sessionID = "ses_wake";
                task = controller.runNaviChatTurn({
                    sessionID: sessionID,
                    text: "hello",
                    responseMessageID: "navi",
                });
                controller.requestNaviWake(sessionID);
                controller.requestNiaWake(sessionID);
                return [4 /*yield*/, niaWake];
            case 1:
                _a.sent();
                (0, bun_test_1.expect)(naviWakeCount).toBe(0);
                (0, bun_test_1.expect)(controller.naviBusy(sessionID)).toBe(true);
                finish();
                return [4 /*yield*/, task];
            case 2:
                _a.sent();
                return [4 /*yield*/, naviWake];
            case 3:
                _a.sent();
                (0, bun_test_1.expect)(naviWakeCount).toBe(1);
                return [4 /*yield*/, controller.dispose()];
            case 4:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
bun_test_1.test.each(["navi", "nia"])("abort %s cancels its queued wake without discarding peer wake", function (stream) { return __awaiter(void 0, void 0, void 0, function () {
    var input, release, blocked, wakes, _loop_1, _i, _a, name_1, controller, sessionID, task, settled;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                input = controllerInput(function () { });
                blocked = new Promise(function (resolve) {
                    release = resolve;
                });
                wakes = [];
                _loop_1 = function (name_1) {
                    input[name_1].available = function () { return true; };
                    input[name_1].runBody = function (_, signal) { return __awaiter(void 0, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0: return [4 /*yield*/, blocked];
                                case 1:
                                    _a.sent();
                                    signal.throwIfAborted();
                                    return [2 /*return*/];
                            }
                        });
                    }); };
                    input[name_1].wake = function () { return __awaiter(void 0, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            wakes.push(name_1);
                            return [2 /*return*/];
                        });
                    }); };
                };
                for (_i = 0, _a = ["navi", "nia"]; _i < _a.length; _i++) {
                    name_1 = _a[_i];
                    _loop_1(name_1);
                }
                controller = (0, src_1.createProviderModelController)(input);
                sessionID = "ses_abort_wake";
                task = stream === "nia"
                    ? controller.runNiaChatTurn({
                        sessionID: sessionID,
                        responseMessageID: stream,
                        text: "work",
                    })
                    : controller.runNaviChatTurn({
                        sessionID: sessionID,
                        responseMessageID: stream,
                        text: "work",
                    });
                settled = Promise.allSettled([task]);
                controller.requestNaviWake(sessionID);
                controller.requestNiaWake(sessionID);
                // Let the wake coordinator start waiting on the in-flight task.
                return [4 /*yield*/, Promise.resolve()];
            case 1:
                // Let the wake coordinator start waiting on the in-flight task.
                _b.sent();
                return [4 /*yield*/, Promise.resolve()];
            case 2:
                _b.sent();
                stream === "nia"
                    ? controller.abortNia(sessionID)
                    : controller.abortNavi(sessionID);
                release();
                return [4 /*yield*/, settled];
            case 3:
                _b.sent();
                return [4 /*yield*/, Promise.resolve()];
            case 4:
                _b.sent();
                (0, bun_test_1.expect)(wakes).toEqual([stream === "navi" ? "nia" : "navi"]);
                return [4 /*yield*/, controller.dispose()];
            case 5:
                _b.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("synchronous stream failures release busy ownership", function () { return __awaiter(void 0, void 0, void 0, function () {
    var input, controller, sessionID;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                input = controllerInput(function () { });
                input.nia.available = function () { return true; };
                input.nia.runBody = function () {
                    throw new Error("synchronous failure");
                };
                controller = (0, src_1.createProviderModelController)(input);
                sessionID = "ses_sync_failure";
                return [4 /*yield*/, (0, bun_test_1.expect)(controller.runNiaChatTurn({
                        sessionID: sessionID,
                        responseMessageID: "nia",
                        text: "work",
                    })).rejects.toThrow("synchronous failure")];
            case 1:
                _a.sent();
                (0, bun_test_1.expect)(controller.niaBusy(sessionID)).toBe(false);
                return [4 /*yield*/, controller.dispose()];
            case 2:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("same-stream ownership remains isolated across sessions", function () { return __awaiter(void 0, void 0, void 0, function () {
    var input, signals, release, blocked, controller, a, b, tasks, settled, _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                input = controllerInput(function () { });
                signals = new Map();
                blocked = new Promise(function (resolve) {
                    release = resolve;
                });
                input.nia.available = function () { return true; };
                input.nia.runBody = function (turn, signal) { return __awaiter(void 0, void 0, void 0, function () {
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0:
                                signals.set(turn.sessionID, signal);
                                return [4 /*yield*/, blocked];
                            case 1:
                                _a.sent();
                                signal.throwIfAborted();
                                return [2 /*return*/];
                        }
                    });
                }); };
                controller = (0, src_1.createProviderModelController)(input);
                a = "ses_nia_a";
                b = "ses_nia_b";
                tasks = [a, b].map(function (sessionID) {
                    return controller.runNiaChatTurn({
                        sessionID: sessionID,
                        text: "audit",
                        responseMessageID: "same-id",
                    });
                });
                settled = Promise.allSettled(tasks);
                return [4 /*yield*/, Promise.resolve()];
            case 1:
                _b.sent();
                (0, bun_test_1.expect)(controller.niaBusy(a)).toBe(true);
                (0, bun_test_1.expect)(controller.niaBusy(b)).toBe(true);
                controller.abortNia(a);
                (0, bun_test_1.expect)(signals.get(a).aborted).toBe(true);
                (0, bun_test_1.expect)(signals.get(b).aborted).toBe(false);
                release();
                _a = bun_test_1.expect;
                return [4 /*yield*/, settled];
            case 2:
                _a.apply(void 0, [(_b.sent()).map(function (result) { return result.status; })]).toEqual([
                    "rejected",
                    "fulfilled",
                ]);
                return [4 /*yield*/, controller.dispose()];
            case 3:
                _b.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("dispose aborts both streams and discards their pending wakes", function () { return __awaiter(void 0, void 0, void 0, function () {
    var input, signals, wakes, _i, _a, stream, controller, turn, outcomes, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                input = controllerInput(function () { });
                signals = [];
                wakes = 0;
                for (_i = 0, _a = [input.navi, input.nia]; _i < _a.length; _i++) {
                    stream = _a[_i];
                    stream.available = function () { return true; };
                    stream.runBody = function (_, signal) { return __awaiter(void 0, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    signals.push(signal);
                                    return [4 /*yield*/, new Promise(function (_, reject) {
                                            signal.addEventListener("abort", function () { return reject(signal.reason); }, {
                                                once: true,
                                            });
                                        })];
                                case 1:
                                    _a.sent();
                                    return [2 /*return*/];
                            }
                        });
                    }); };
                    stream.wake = function () { return __awaiter(void 0, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            wakes++;
                            return [2 /*return*/];
                        });
                    }); };
                }
                controller = (0, src_1.createProviderModelController)(input);
                turn = {
                    sessionID: "ses_dispose",
                    text: "work",
                    responseMessageID: "same",
                };
                outcomes = Promise.allSettled([
                    controller.runNaviChatTurn(turn),
                    controller.runNiaChatTurn(turn),
                ]);
                controller.requestNaviWake(turn.sessionID);
                controller.requestNiaWake(turn.sessionID);
                return [4 /*yield*/, Promise.resolve()];
            case 1:
                _c.sent();
                return [4 /*yield*/, controller.dispose()];
            case 2:
                _c.sent();
                (0, bun_test_1.expect)(signals).toHaveLength(2);
                (0, bun_test_1.expect)(signals.every(function (signal) { return signal.aborted; })).toBe(true);
                _b = bun_test_1.expect;
                return [4 /*yield*/, outcomes];
            case 3:
                _b.apply(void 0, [(_c.sent()).every(function (result) { return result.status === "rejected"; })]).toBe(true);
                (0, bun_test_1.expect)(wakes).toBe(0);
                (0, bun_test_1.expect)(controller.naviBusy(turn.sessionID)).toBe(false);
                (0, bun_test_1.expect)(controller.niaBusy(turn.sessionID)).toBe(false);
                return [2 /*return*/];
        }
    });
}); });
bun_test_1.test.each(["navi", "nia"])("failed %s start publication does not orphan its provider body", function (stream) { return __awaiter(void 0, void 0, void 0, function () {
    var input, bodies, controller, sessionID;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                input = controllerInput(function () { });
                bodies = 0;
                input[stream].available = function () { return true; };
                input[stream].runBody = function () { return __awaiter(void 0, void 0, void 0, function () {
                    return __generator(this, function (_a) {
                        bodies++;
                        return [2 /*return*/];
                    });
                }); };
                input[stream].publish = function (_, event) {
                    if (event.type.endsWith(".turn.started"))
                        throw new Error("publish failed");
                };
                controller = (0, src_1.createProviderModelController)(input);
                sessionID = "ses_publish_fail";
                return [4 /*yield*/, (0, bun_test_1.expect)(stream === "nia"
                        ? controller.runNiaChatTurn({
                            sessionID: sessionID,
                            text: "work",
                            responseMessageID: "test",
                        })
                        : controller.runNaviChatTurn({
                            sessionID: sessionID,
                            text: "work",
                            responseMessageID: "test",
                        })).rejects.toThrow("publish failed")];
            case 1:
                _a.sent();
                (0, bun_test_1.expect)(bodies).toBe(0);
                (0, bun_test_1.expect)(stream === "nia"
                    ? controller.niaBusy(sessionID)
                    : controller.naviBusy(sessionID)).toBe(false);
                input[stream].publish = function () { };
                return [4 /*yield*/, (stream === "nia"
                        ? controller.runNiaChatTurn({
                            sessionID: sessionID,
                            text: "retry",
                            responseMessageID: "next",
                        })
                        : controller.runNaviChatTurn({
                            sessionID: sessionID,
                            text: "retry",
                            responseMessageID: "next",
                        }))];
            case 2:
                _a.sent();
                (0, bun_test_1.expect)(bodies).toBe(1);
                return [4 /*yield*/, controller.dispose()];
            case 3:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
