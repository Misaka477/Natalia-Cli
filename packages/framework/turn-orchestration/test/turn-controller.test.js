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
function sessionWithInbox(inbox) {
    return {
        id: "ses_turn",
        title: "t",
        createdAt: new Date().toISOString(),
        events: [],
        inbox: inbox,
    };
}
function makeController(session) {
    var _this = this;
    var turns = [];
    var commands = [];
    var persisted = [];
    var controller = (0, src_1.createTurnController)({
        session: function () { return session; },
        activeAbort: function () { return undefined; },
        sessionFor: function (sessionID) {
            return sessionID === session.id ? session : undefined;
        },
        activeAbortFor: function () { return undefined; },
        persist: function (fn) { return __awaiter(_this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, fn()];
                    case 1:
                        _a.sent();
                        persisted.push(persisted.length);
                        return [2 /*return*/];
                }
            });
        }); },
        saveInbox: function () { return __awaiter(_this, void 0, void 0, function () { return __generator(this, function (_a) {
            return [2 /*return*/, undefined];
        }); }); },
        flush: function () { return __awaiter(_this, void 0, void 0, function () { return __generator(this, function (_a) {
            return [2 /*return*/, undefined];
        }); }); },
        runCommand: function (id, text) { return __awaiter(_this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                if (text.startsWith("/")) {
                    commands.push(id);
                    return [2 /*return*/, true];
                }
                return [2 /*return*/, false];
            });
        }); },
        runTurn: function (input) { return __awaiter(_this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                turns.push(input.id);
                return [2 /*return*/];
            });
        }); },
    });
    return { controller: controller, turns: turns, commands: commands, persisted: persisted };
}
(0, bun_test_1.test)("steer inputs drain in admission order, queued only after steers", function () { return __awaiter(void 0, void 0, void 0, function () {
    var session, _a, controller, turns;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                session = sessionWithInbox([
                    { id: "s1", text: "first", delivery: "next-step" },
                    { id: "q1", text: "queued", delivery: "next-turn" },
                    { id: "s2", text: "second", delivery: "next-step" },
                ]);
                _a = makeController(session), controller = _a.controller, turns = _a.turns;
                return [4 /*yield*/, controller.drain(new AbortController().signal, session.id)];
            case 1:
                _b.sent();
                (0, bun_test_1.expect)(turns).toEqual(["s1", "s2", "q1"]);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("one drain promotes every queued input in FIFO order", function () { return __awaiter(void 0, void 0, void 0, function () {
    var session, _a, controller, turns;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                session = sessionWithInbox([
                    { id: "q1", text: "first", delivery: "next-turn" },
                    { id: "q2", text: "second", delivery: "next-turn" },
                    { id: "q3", text: "third", delivery: "next-turn" },
                ]);
                _a = makeController(session), controller = _a.controller, turns = _a.turns;
                return [4 /*yield*/, controller.drain(new AbortController().signal, session.id)];
            case 1:
                _b.sent();
                (0, bun_test_1.expect)(turns).toEqual(["q1", "q2", "q3"]);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("commands short-circuit turns and flush persistence", function () { return __awaiter(void 0, void 0, void 0, function () {
    var session, _a, controller, turns, commands, persisted;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                session = sessionWithInbox([
                    { id: "c1", text: "/help", delivery: "next-step" },
                    { id: "s1", text: "real", delivery: "next-step" },
                ]);
                _a = makeController(session), controller = _a.controller, turns = _a.turns, commands = _a.commands, persisted = _a.persisted;
                return [4 /*yield*/, controller.drain(new AbortController().signal, session.id)];
            case 1:
                _b.sent();
                (0, bun_test_1.expect)(commands).toEqual(["c1"]);
                (0, bun_test_1.expect)(turns).toEqual(["s1"]);
                (0, bun_test_1.expect)(persisted.length).toBeGreaterThan(0);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("an aborted drain stops admitting further inputs", function () { return __awaiter(void 0, void 0, void 0, function () {
    var session, turns, controller;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                session = sessionWithInbox([
                    { id: "s1", text: "first", delivery: "next-step" },
                    { id: "s2", text: "second", delivery: "next-step" },
                    { id: "s3", text: "third", delivery: "next-step" },
                ]);
                turns = [];
                controller = (0, src_1.createTurnController)({
                    session: function () { return session; },
                    activeAbort: function () { return undefined; },
                    sessionFor: function (sessionID) {
                        return sessionID === session.id ? session : undefined;
                    },
                    activeAbortFor: function () { return undefined; },
                    persist: function () { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                        return [2 /*return*/, undefined];
                    }); }); },
                    saveInbox: function () { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                        return [2 /*return*/, undefined];
                    }); }); },
                    flush: function () { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                        return [2 /*return*/, undefined];
                    }); }); },
                    runCommand: function () { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                        return [2 /*return*/, false];
                    }); }); },
                    runTurn: function () { return __awaiter(void 0, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            turns.push("ran");
                            throw new Error("turn aborted");
                        });
                    }); },
                });
                return [4 /*yield*/, (0, bun_test_1.expect)(controller.drain(new AbortController().signal, session.id)).rejects.toThrow("turn aborted")];
            case 1:
                _a.sent();
                (0, bun_test_1.expect)(turns).toEqual(["ran"]);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("input mutations only touch inputs that have not been claimed", function () { return __awaiter(void 0, void 0, void 0, function () {
    var session, controller, sessionID, replaced, promoted, _a, removed;
    var _b, _c, _d;
    return __generator(this, function (_e) {
        switch (_e.label) {
            case 0:
                session = sessionWithInbox([
                    { id: "q1", text: "queued", delivery: "next-turn" },
                    { id: "s1", text: "steer", delivery: "next-step" },
                ]);
                controller = makeController(session).controller;
                sessionID = session.id;
                return [4 /*yield*/, controller.replaceInput(sessionID, "q1", "edited")];
            case 1:
                replaced = _e.sent();
                (0, bun_test_1.expect)(replaced === null || replaced === void 0 ? void 0 : replaced.text).toBe("edited");
                (0, bun_test_1.expect)((_c = (_b = session.inbox) === null || _b === void 0 ? void 0 : _b.find(function (item) { return item.id === "q1"; })) === null || _c === void 0 ? void 0 : _c.text).toBe("edited");
                return [4 /*yield*/, controller.promoteInput(sessionID, "q1")];
            case 2:
                promoted = _e.sent();
                (0, bun_test_1.expect)(promoted === null || promoted === void 0 ? void 0 : promoted.delivery).toBe("next-step");
                _a = bun_test_1.expect;
                return [4 /*yield*/, controller.removeInput(sessionID, "q1")];
            case 3:
                _a.apply(void 0, [_e.sent()]).toMatchObject({
                    id: "q1",
                });
                return [4 /*yield*/, controller.removeInput(sessionID, "s1")];
            case 4:
                removed = _e.sent();
                (0, bun_test_1.expect)(removed === null || removed === void 0 ? void 0 : removed.id).toBe("s1");
                (0, bun_test_1.expect)((_d = session.inbox) === null || _d === void 0 ? void 0 : _d.some(function (item) { return item.id === "s1"; })).toBe(false);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("claimed inputs are no longer editable, removable or promotable", function () { return __awaiter(void 0, void 0, void 0, function () {
    var session, controller, sessionID, _a, _b, _c;
    return __generator(this, function (_d) {
        switch (_d.label) {
            case 0:
                session = sessionWithInbox([
                    {
                        id: "claimed",
                        text: "already in",
                        delivery: "next-step",
                        promotedAt: new Date().toISOString(),
                    },
                ]);
                controller = makeController(session).controller;
                sessionID = session.id;
                _a = bun_test_1.expect;
                return [4 /*yield*/, controller.removeInput(sessionID, "claimed")];
            case 1:
                _a.apply(void 0, [_d.sent()]).toBeUndefined();
                _b = bun_test_1.expect;
                return [4 /*yield*/, controller.replaceInput(sessionID, "claimed", "late")];
            case 2:
                _b.apply(void 0, [_d.sent()]).toBeUndefined();
                _c = bun_test_1.expect;
                return [4 /*yield*/, controller.promoteInput(sessionID, "claimed")];
            case 3:
                _c.apply(void 0, [_d.sent()]).toBeUndefined();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("input mutations against an unknown session are refused", function () { return __awaiter(void 0, void 0, void 0, function () {
    var session, controller, _a, _b, _c;
    return __generator(this, function (_d) {
        switch (_d.label) {
            case 0:
                session = sessionWithInbox([
                    { id: "q1", text: "queued", delivery: "next-turn" },
                ]);
                controller = makeController(session).controller;
                _a = bun_test_1.expect;
                return [4 /*yield*/, controller.removeInput("ses_missing", "q1")];
            case 1:
                _a.apply(void 0, [_d.sent()]).toBeUndefined();
                _b = bun_test_1.expect;
                return [4 /*yield*/, controller.replaceInput("ses_missing", "q1", "x")];
            case 2:
                _b.apply(void 0, [_d.sent()]).toBeUndefined();
                _c = bun_test_1.expect;
                return [4 /*yield*/, controller.promoteInput("ses_missing", "q1")];
            case 3:
                _c.apply(void 0, [_d.sent()]).toBeUndefined();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("disposed turn orchestration refuses new work", function () { return __awaiter(void 0, void 0, void 0, function () {
    var session, controller;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                session = sessionWithInbox([
                    { id: "s1", text: "first", delivery: "next-step" },
                ]);
                controller = makeController(session).controller;
                controller.dispose();
                return [4 /*yield*/, (0, bun_test_1.expect)(controller.drain(new AbortController().signal, session.id)).rejects.toThrow("turn orchestration controller disposed")];
            case 1:
                _a.sent();
                return [4 /*yield*/, (0, bun_test_1.expect)(controller.admit(session.id, "s2", "second")).rejects.toThrow("turn orchestration controller disposed")];
            case 2:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
