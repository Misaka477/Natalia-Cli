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
exports.createTurnController = createTurnController;
var session_1 = require("@anthelia/session");
function createTurnController(input) {
    var disposed = false;
    function assertActive() {
        if (disposed)
            throw new Error("turn orchestration controller disposed");
    }
    function persistInboxPromotion(sessionID) {
        return __awaiter(this, void 0, void 0, function () {
            var session, snapshot;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        assertActive();
                        session = input.sessionFor(sessionID);
                        if (!session)
                            return [2 /*return*/];
                        snapshot = structuredClone(session);
                        return [4 /*yield*/, input.persist(function () { return input.saveInbox(snapshot); })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    }
    function drain(signal, sessionID) {
        return __awaiter(this, void 0, void 0, function () {
            var session, abort, inputs, _i, inputs_1, item;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        assertActive();
                        session = input.sessionFor(sessionID);
                        if (!session)
                            return [2 /*return*/];
                        abort = function () { var _a; return (_a = input.activeAbortFor(sessionID)) === null || _a === void 0 ? void 0 : _a.abort(signal.reason); };
                        signal.addEventListener("abort", abort, { once: true });
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, , 10, 11]);
                        if (signal.aborted)
                            throw signal.reason;
                        inputs = (0, session_1.promoteNextSteps)(session, (0, session_1.admissionCutoff)(session));
                        if (!inputs.length) return [3 /*break*/, 3];
                        return [4 /*yield*/, persistInboxPromotion(sessionID)];
                    case 2:
                        _a.sent();
                        _a.label = 3;
                    case 3:
                        _i = 0, inputs_1 = inputs;
                        _a.label = 4;
                    case 4:
                        if (!(_i < inputs_1.length)) return [3 /*break*/, 7];
                        item = inputs_1[_i];
                        if (signal.aborted)
                            throw signal.reason;
                        return [4 /*yield*/, admit(sessionID, item.id, item.text, item.attachments, item.resources, item.agents, item.internal, signal)];
                    case 5:
                        _a.sent();
                        _a.label = 6;
                    case 6:
                        _i++;
                        return [3 /*break*/, 4];
                    case 7:
                        if (!!(0, session_1.admittedInputs)(session).some(function (entry) { return !entry.promotedAt && entry.delivery === "next-step"; })) return [3 /*break*/, 9];
                        return [4 /*yield*/, drainQueue(signal, sessionID)];
                    case 8:
                        _a.sent();
                        _a.label = 9;
                    case 9: return [3 /*break*/, 11];
                    case 10:
                        signal.removeEventListener("abort", abort);
                        return [7 /*endfinally*/];
                    case 11: return [2 /*return*/];
                }
            });
        });
    }
    function drainQueue(signal, sessionID) {
        return __awaiter(this, void 0, void 0, function () {
            var session, next;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        assertActive();
                        session = input.sessionFor(sessionID);
                        if (!session)
                            return [2 /*return*/];
                        _a.label = 1;
                    case 1:
                        if (!true) return [3 /*break*/, 4];
                        if (signal === null || signal === void 0 ? void 0 : signal.aborted)
                            throw signal.reason;
                        if ((0, session_1.admittedInputs)(session).some(function (entry) { return !entry.promotedAt && entry.delivery === "next-step"; }))
                            return [2 /*return*/];
                        next = (0, session_1.promoteNextTurn)(session)[0];
                        if (!next)
                            return [2 /*return*/];
                        return [4 /*yield*/, persistInboxPromotion(sessionID)];
                    case 2:
                        _a.sent();
                        if (signal === null || signal === void 0 ? void 0 : signal.aborted)
                            throw signal.reason;
                        return [4 /*yield*/, admit(sessionID, next.id, next.text, next.attachments, next.resources, next.agents, next.internal, signal)];
                    case 3:
                        _a.sent();
                        return [3 /*break*/, 1];
                    case 4: return [2 /*return*/];
                }
            });
        });
    }
    function admit(sessionID_1, id_1, text_1) {
        return __awaiter(this, arguments, void 0, function (sessionID, id, text, attachments, resources, agents, internal, signal) {
            if (attachments === void 0) { attachments = []; }
            if (resources === void 0) { resources = []; }
            if (agents === void 0) { agents = []; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        assertActive();
                        return [4 /*yield*/, input.runCommand(id, text, signal, sessionID)];
                    case 1:
                        if (!_a.sent()) return [3 /*break*/, 3];
                        return [4 /*yield*/, input.flush()];
                    case 2:
                        _a.sent();
                        return [2 /*return*/];
                    case 3: return [4 /*yield*/, input.runTurn({
                            id: id,
                            text: text,
                            sessionID: sessionID,
                            attachments: attachments,
                            resources: resources,
                            agents: agents,
                            internal: internal,
                        })];
                    case 4:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    }
    function persistPromotion() {
        return __awaiter(this, arguments, void 0, function (sessionID) {
            var _a, _b;
            if (sessionID === void 0) { sessionID = (_b = (_a = input.session()) === null || _a === void 0 ? void 0 : _a.id) !== null && _b !== void 0 ? _b : ""; }
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0: return [4 /*yield*/, persistInboxPromotion(sessionID)];
                    case 1:
                        _c.sent();
                        return [2 /*return*/];
                }
            });
        });
    }
    function removeInput(sessionID, id) {
        return __awaiter(this, void 0, void 0, function () {
            var session, removed;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        assertActive();
                        session = input.sessionFor(sessionID);
                        if (!session)
                            return [2 /*return*/, undefined];
                        removed = (0, session_1.removeAdmittedInput)(session, id);
                        if (!removed)
                            return [2 /*return*/, undefined];
                        return [4 /*yield*/, persistInboxPromotion(sessionID)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/, removed];
                }
            });
        });
    }
    function replaceInput(sessionID, id, text) {
        return __awaiter(this, void 0, void 0, function () {
            var session, replaced;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        assertActive();
                        session = input.sessionFor(sessionID);
                        if (!session)
                            return [2 /*return*/, undefined];
                        replaced = (0, session_1.replaceAdmittedInput)(session, id, text);
                        if (!replaced)
                            return [2 /*return*/, undefined];
                        return [4 /*yield*/, persistInboxPromotion(sessionID)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/, replaced];
                }
            });
        });
    }
    function promoteInput(sessionID, id) {
        return __awaiter(this, void 0, void 0, function () {
            var session, promoted;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        assertActive();
                        session = input.sessionFor(sessionID);
                        if (!session)
                            return [2 /*return*/, undefined];
                        promoted = (0, session_1.promoteInputToStep)(session, id);
                        if (!promoted)
                            return [2 /*return*/, undefined];
                        return [4 /*yield*/, persistInboxPromotion(sessionID)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/, promoted];
                }
            });
        });
    }
    function dispose() {
        disposed = true;
    }
    return {
        drain: drain,
        drainQueue: drainQueue,
        admit: admit,
        persistPromotion: persistPromotion,
        removeInput: removeInput,
        replaceInput: replaceInput,
        promoteInput: promoteInput,
        dispose: dispose,
    };
}
