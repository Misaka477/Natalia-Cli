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
exports.createNativeTerminalSurface = createNativeTerminalSurface;
var runtime_services_1 = require("@natalia/runtime-services");
var contracts_1 = require("@natalia/contracts");
var substrate_1 = require("@anthelia/substrate");
function refusalFromRegistry(error) {
    return new contracts_1.RuntimeRefusal(error instanceof Error ? error.message : String(error));
}
function sessionExec(ctx, sessionID) {
    return sessionID
        ? ctx.ports
            .getExecutionBySession()
            .get(sessionID)
        : ctx.ports.getActiveExec();
}
function terminalIDsFor(ctx, exec) {
    return __awaiter(this, void 0, void 0, function () {
        var window, events;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!(exec === null || exec === void 0 ? void 0 : exec.session))
                        return [2 /*return*/, new Set()];
                    return [4 /*yield*/, (0, substrate_1.ensureSessionEventWindow)(ctx, exec)];
                case 1:
                    window = _a.sent();
                    events = window
                        ? (0, substrate_1.sessionWindowEvents)(exec, window)
                        : exec.session.events;
                    return [2 /*return*/, new Set(events
                            .filter(function (event) { return event.type === "terminal.timeline"; })
                            .map(function (event) { return event.id; }))];
            }
        });
    });
}
function assertTerminalOwned(ctx, exec, id) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, terminalIDsFor(ctx, exec)];
                case 1:
                    if (!(_a.sent()).has(id))
                        throw new Error("terminal ".concat(id, " does not belong to session ").concat(exec.session.id));
                    return [2 /*return*/];
            }
        });
    });
}
function createNativeTerminalSurface(ctx, options) {
    return {
        nativeTerminalList: function (sessionID) {
            return __awaiter(this, void 0, void 0, function () {
                var terminal;
                var _a;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0: return [4 /*yield*/, ctx.ports.getReady()];
                        case 1:
                            _b.sent();
                            terminal = ctx.state.serviceDirectory.getOptional(runtime_services_1.terminalController);
                            return [4 /*yield*/, (terminal === null || terminal === void 0 ? void 0 : terminal.list(sessionID))];
                        case 2: return [2 /*return*/, (_a = (_b.sent())) !== null && _a !== void 0 ? _a : []];
                    }
                });
            });
        },
        nativeTerminalRead: function (id, sessionID) {
            return __awaiter(this, void 0, void 0, function () {
                var exec, terminal, text;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, ctx.ports.getReady()];
                        case 1:
                            _a.sent();
                            exec = sessionExec(ctx, sessionID);
                            if (!(sessionID && exec)) return [3 /*break*/, 3];
                            return [4 /*yield*/, assertTerminalOwned(ctx, exec, id)];
                        case 2:
                            _a.sent();
                            _a.label = 3;
                        case 3:
                            terminal = ctx.state.serviceDirectory.get(runtime_services_1.terminalController);
                            return [4 /*yield*/, terminal.read(id, __assign({ maxLines: 200 }, (sessionID ? { sessionID: sessionID } : {})))];
                        case 4:
                            text = (_a.sent()).text;
                            return [2 /*return*/, { id: id, text: text }];
                    }
                });
            });
        },
        nativeTerminalOpenHub: function () {
            return __awaiter(this, void 0, void 0, function () {
                var terminal;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, ctx.ports.getReady()];
                        case 1:
                            _a.sent();
                            terminal = ctx.state.serviceDirectory.get(runtime_services_1.terminalController);
                            return [4 /*yield*/, terminal.openHub()];
                        case 2: return [2 /*return*/, _a.sent()];
                    }
                });
            });
        },
        nativeTerminalRevokeApprovalScope: function (id, _sessionID) {
            return __awaiter(this, void 0, void 0, function () {
                var terminal;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, ctx.ports.getReady()];
                        case 1:
                            _a.sent();
                            terminal = ctx.state.serviceDirectory.get(runtime_services_1.terminalController);
                            return [2 /*return*/, ctx.ports.getInteractive().revokeTerminalApprovalScope(id)];
                    }
                });
            });
        },
        nativeTerminalClaimHumanInput: function (id, sessionID) {
            return __awaiter(this, void 0, void 0, function () {
                var exec, terminal;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, ctx.ports.getReady()];
                        case 1:
                            _a.sent();
                            exec = sessionExec(ctx, sessionID);
                            if (!(sessionID && exec)) return [3 /*break*/, 3];
                            return [4 /*yield*/, assertTerminalOwned(ctx, exec, id)];
                        case 2:
                            _a.sent();
                            _a.label = 3;
                        case 3:
                            terminal = ctx.state.serviceDirectory.getOptional(runtime_services_1.terminalController);
                            if (!(terminal === null || terminal === void 0 ? void 0 : terminal.claimHumanInput))
                                throw new Error("Native Terminal Host is unavailable");
                            return [4 /*yield*/, terminal.claimHumanInput(id, sessionID)];
                        case 4: return [2 /*return*/, _a.sent()];
                    }
                });
            });
        },
        nativeTerminalReleaseHumanControl: function (id, sessionID) {
            return __awaiter(this, void 0, void 0, function () {
                var exec, terminal, sessionView;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, ctx.ports.getReady()];
                        case 1:
                            _a.sent();
                            exec = sessionExec(ctx, sessionID);
                            if (!(sessionID && exec)) return [3 /*break*/, 3];
                            return [4 /*yield*/, assertTerminalOwned(ctx, exec, id)];
                        case 2:
                            _a.sent();
                            _a.label = 3;
                        case 3:
                            terminal = ctx.state.serviceDirectory.get(runtime_services_1.terminalController);
                            sessionView = terminal.releaseHumanControl(id, sessionID);
                            // TERM-M.3 (c): the remote release path triggers the same continuation
                            // as the local timeline-detach path. Pass the owning session so a
                            // background session's terminal release does not fall back to active.
                            void ctx.ports.maybeContinueAfterHumanInput(id, sessionID);
                            return [2 /*return*/, sessionView];
                    }
                });
            });
        },
        nativeTerminalBeginSecureInput: function (id, sessionID) {
            return __awaiter(this, void 0, void 0, function () {
                var exec, terminal;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, ctx.ports.getReady()];
                        case 1:
                            _a.sent();
                            exec = sessionExec(ctx, sessionID);
                            if (!(sessionID && exec)) return [3 /*break*/, 3];
                            return [4 /*yield*/, assertTerminalOwned(ctx, exec, id)];
                        case 2:
                            _a.sent();
                            _a.label = 3;
                        case 3:
                            terminal = ctx.state.serviceDirectory.get(runtime_services_1.terminalController);
                            return [2 /*return*/, terminal.beginSecureInput(id, sessionID)];
                    }
                });
            });
        },
        nativeTerminalEndSecureInput: function (id, sessionID) {
            return __awaiter(this, void 0, void 0, function () {
                var exec, terminal;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, ctx.ports.getReady()];
                        case 1:
                            _a.sent();
                            exec = sessionExec(ctx, sessionID);
                            if (!(sessionID && exec)) return [3 /*break*/, 3];
                            return [4 /*yield*/, assertTerminalOwned(ctx, exec, id)];
                        case 2:
                            _a.sent();
                            _a.label = 3;
                        case 3:
                            terminal = ctx.state.serviceDirectory.get(runtime_services_1.terminalController);
                            return [2 /*return*/, terminal.endSecureInput(id, sessionID)];
                    }
                });
            });
        },
        nativeTerminalStop: function (id, sessionID) {
            return __awaiter(this, void 0, void 0, function () {
                var exec, terminal, _a;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0: return [4 /*yield*/, ctx.ports.getReady()];
                        case 1:
                            _b.sent();
                            exec = sessionExec(ctx, sessionID);
                            if (!(sessionID && exec)) return [3 /*break*/, 3];
                            return [4 /*yield*/, assertTerminalOwned(ctx, exec, id)];
                        case 2:
                            _b.sent();
                            _b.label = 3;
                        case 3:
                            terminal = ctx.state.serviceDirectory.get(runtime_services_1.terminalController);
                            _a = [{}];
                            return [4 /*yield*/, terminal.stop(id, "human", sessionID)];
                        case 4: return [2 /*return*/, __assign.apply(void 0, [__assign.apply(void 0, _a.concat([(_b.sent())])), { status: "exited" }])];
                    }
                });
            });
        },
        // --- P0-H: the terminal write surface, host-gated at the transport ---
        // Remote callers are treated as model-side actors: ownership, secure-input
        // and geometry arbitration are the same ones the model tools go through.
        nativeTerminalStart: function (input) {
            return __awaiter(this, void 0, void 0, function () {
                var owner, sessionID, terminal, error_1;
                var _a, _b;
                return __generator(this, function (_c) {
                    switch (_c.label) {
                        case 0: return [4 /*yield*/, ctx.ports.getReady()];
                        case 1:
                            _c.sent();
                            owner = ctx.ports.getActiveExec();
                            sessionID = (_a = input.sessionID) !== null && _a !== void 0 ? _a : owner === null || owner === void 0 ? void 0 : owner.session.id;
                            if (!sessionID)
                                throw new contracts_1.RuntimeRefusal("session is not initialized");
                            if (input.sessionID &&
                                !ctx.ports
                                    .getExecutionBySession()
                                    .get(input.sessionID))
                                throw new contracts_1.RuntimeRefusal("session not found: ".concat(input.sessionID));
                            terminal = ctx.state.serviceDirectory.get(runtime_services_1.terminalController);
                            _c.label = 2;
                        case 2:
                            _c.trys.push([2, 4, , 5]);
                            return [4 /*yield*/, terminal.start(__assign({ command: input.command, cwd: (_b = input.cwd) !== null && _b !== void 0 ? _b : ctx.ports.getWorkspaceRoot(), id: input.id, sessionID: sessionID }, (input.agentID ? { agentID: input.agentID } : {})))];
                        case 3: return [2 /*return*/, _c.sent()];
                        case 4:
                            error_1 = _c.sent();
                            throw refusalFromRegistry(error_1);
                        case 5: return [2 /*return*/];
                    }
                });
            });
        },
        nativeTerminalWrite: function (input) {
            return __awaiter(this, void 0, void 0, function () {
                var exec, terminal, result, error_2;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, ctx.ports.getReady()];
                        case 1:
                            _a.sent();
                            exec = sessionExec(ctx, input.sessionID);
                            if (!(input.sessionID && exec)) return [3 /*break*/, 3];
                            return [4 /*yield*/, assertTerminalOwned(ctx, exec, input.id)];
                        case 2:
                            _a.sent();
                            _a.label = 3;
                        case 3:
                            terminal = ctx.state.serviceDirectory.get(runtime_services_1.terminalController);
                            _a.label = 4;
                        case 4:
                            _a.trys.push([4, 6, , 7]);
                            return [4 /*yield*/, terminal.write(input.id, input.input, __assign({ idempotencyKey: input.idempotencyKey }, (input.sessionID ? { sessionID: input.sessionID } : {})))];
                        case 5:
                            result = _a.sent();
                            return [2 /*return*/, __assign({ id: input.id }, result)];
                        case 6:
                            error_2 = _a.sent();
                            throw refusalFromRegistry(error_2);
                        case 7: return [2 /*return*/];
                    }
                });
            });
        },
        nativeTerminalResize: function (input) {
            return __awaiter(this, void 0, void 0, function () {
                var exec, terminal, error_3;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, ctx.ports.getReady()];
                        case 1:
                            _a.sent();
                            exec = sessionExec(ctx, input.sessionID);
                            if (!(input.sessionID && exec)) return [3 /*break*/, 3];
                            return [4 /*yield*/, assertTerminalOwned(ctx, exec, input.id)];
                        case 2:
                            _a.sent();
                            _a.label = 3;
                        case 3:
                            terminal = ctx.state.serviceDirectory.get(runtime_services_1.terminalController);
                            _a.label = 4;
                        case 4:
                            _a.trys.push([4, 6, , 7]);
                            return [4 /*yield*/, terminal.resize(input.id, input.rows, input.cols, "model", input.sessionID)];
                        case 5: return [2 /*return*/, _a.sent()];
                        case 6:
                            error_3 = _a.sent();
                            throw refusalFromRegistry(error_3);
                        case 7: return [2 /*return*/];
                    }
                });
            });
        },
        subscribeTerminalOutput: function (id, listener) {
            var terminal = ctx.state.serviceDirectory.getOptional(runtime_services_1.terminalController);
            if (!(terminal === null || terminal === void 0 ? void 0 : terminal.subscribeOutput))
                throw new contracts_1.RuntimeRefusal("Native Terminal Host is unavailable");
            return terminal.subscribeOutput(id, listener);
        },
    };
}
