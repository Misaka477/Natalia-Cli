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
exports.createTerminalController = createTerminalController;
var node_crypto_1 = require("node:crypto");
var promises_1 = require("node:fs/promises");
var node_path_1 = require("node:path");
var native_terminal_1 = require("./native-terminal");
/**
 * The native terminal resource controller — cut of the resource controllers
 * split (mainline plan §15). It owns an internally created
 * `NativeTerminalRegistry` and input broker, including the WezTerm host
 * bootstrap, one-shot recovery when the mux server or runtime dirs disappear,
 * and teardown. An externally provided registry (the host's own
 * `options.nativeTerminal`) is borrowed as-is and never rebuilt or disposed.
 *
 * Multi-session shape (plan §41.9): the registry is reached by accessor;
 * when sessions become per-session panes (TERM-M I3), only this module's
 * init changes.
 */
function createTerminalController(input) {
    var nativeTerminal = input.external;
    var nativeInputBroker;
    var closed = false;
    function broker() {
        var runtimeHome = input.userRuntimeHome();
        var nativeRuntimeDir = runtimeHome
            ? (0, node_path_1.join)(runtimeHome, "natalia")
            : (0, node_path_1.join)(input.workspaceRoot, ".natalia", "native-input");
        var nativeMuxRuntimeDir = (0, node_path_1.join)(nativeRuntimeDir, "wezterm-runtime", input.runtimeID());
        var nativeMuxSocket = (0, node_path_1.join)(nativeMuxRuntimeDir, "wezterm", "sock");
        return { nativeRuntimeDir: nativeRuntimeDir, nativeMuxRuntimeDir: nativeMuxRuntimeDir, nativeMuxSocket: nativeMuxSocket };
    }
    function installRegistry(nativeRuntimeDir, nativeMuxRuntimeDir, nativeMuxSocket, nativeDomain) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        nativeTerminal = new native_terminal_1.NativeTerminalRegistry((0, native_terminal_1.createWezTermHost)({
                            // The GUI, CLI, and mux server must share this socket. Otherwise
                            // Open terminal can attach a real window to the user's unrelated
                            // default mux while Natalia controls a different pane.
                            environment: { WEZTERM_UNIX_SOCKET: nativeMuxSocket },
                            // Every `wezterm cli` invocation then runs with --no-auto-start
                            // --prefer-mux --class <className>: a cli spawn must never auto-start
                            // its own GUI (which would show a first window that later empties
                            // when the pane is moved, i.e. duplicate windows), and every command
                            // must target the private mux rather than whatever instance is last.
                            className: "natalia-".concat(input.runtimeID()),
                            muxRuntimeDir: nativeMuxRuntimeDir,
                            nativeDomain: nativeDomain,
                            onPerformance: input.onPerformance,
                        }), {
                            onAudit: function (event) {
                                var _a;
                                input.publish(__assign(__assign({ type: "terminal.action", id: event.id }, (event.sessionID
                                    ? { sessionID: event.sessionID }
                                    : {})), { action: event.action, redacted: event.redacted, target: { kind: "host", cwd: event.cwd } }));
                                input.publish(__assign(__assign({ type: "terminal.timeline", id: event.id }, (event.sessionID
                                    ? { sessionID: event.sessionID }
                                    : {})), { actor: event.actor === "human" ? "user" : event.actor, action: event.action, status: "executed", summary: event.action === "request_human"
                                        ? ((_a = event.detail) !== null && _a !== void 0 ? _a : "native terminal requests human attention")
                                        : event.action === "started"
                                            ? "native terminal started in the background; open it with Open terminal"
                                            : event.action === "write"
                                                ? "native terminal input accepted"
                                                : event.action === "secure_input"
                                                    ? "native terminal secure input state changed"
                                                    : "native terminal ".concat(event.action, " executed"), at: event.at }));
                            },
                            windowMode: input.windowMode(),
                            persistPath: (0, node_path_1.join)(nativeMuxRuntimeDir, "native-terminal-sessions.json"),
                        });
                        return [4 /*yield*/, (0, native_terminal_1.startNativeInputBroker)({
                                registry: nativeTerminal,
                                runtimeDir: nativeRuntimeDir,
                                daemonID: (0, node_crypto_1.randomUUID)(),
                                onInput: function (_a) {
                                    var terminalID = _a.terminalID, paneID = _a.paneID, kind = _a.kind, byteLength = _a.byteLength;
                                    var sessionID = nativeTerminal === null || nativeTerminal === void 0 ? void 0 : nativeTerminal.session(terminalID).sessionID;
                                    var summary = "native human input claim accepted: terminal=".concat(terminalID, " pane=").concat(paneID, " kind=").concat(kind, " bytes=").concat(byteLength);
                                    input.publish(__assign(__assign({ type: "diagnostic" }, (sessionID
                                        ? { sessionID: sessionID }
                                        : {})), { level: "info", message: summary }));
                                    input.publish(__assign(__assign({ type: "terminal.timeline", id: terminalID }, (sessionID
                                        ? { sessionID: sessionID }
                                        : {})), { actor: "user", action: "write", status: "executed", summary: summary, at: new Date().toISOString() }));
                                },
                                onDenied: function (_a) {
                                    var terminalID = _a.terminalID, paneID = _a.paneID, tokenAccepted = _a.tokenAccepted, paneAccepted = _a.paneAccepted;
                                    var sessionID = nativeTerminal === null || nativeTerminal === void 0 ? void 0 : nativeTerminal.session(terminalID).sessionID;
                                    input.publish(__assign(__assign({ type: "diagnostic" }, (sessionID
                                        ? { sessionID: sessionID }
                                        : {})), { level: "warning", message: "native input claim denied: terminal=".concat(terminalID, " pane=").concat(paneID, " token=").concat(tokenAccepted, " paneKnown=").concat(paneAccepted) }));
                                },
                            })];
                    case 1:
                        nativeInputBroker = _a.sent();
                        nativeTerminal.setHumanInputBridge(nativeInputBroker);
                        return [2 /*return*/];
                }
            });
        });
    }
    function init() {
        return __awaiter(this, void 0, void 0, function () {
            var _a, nativeRuntimeDir, nativeMuxRuntimeDir, nativeMuxSocket, nativeDomain, _b, _c;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        if (closed)
                            throw new Error("terminal controller is closed");
                        if (nativeTerminal)
                            return [2 /*return*/];
                        _a = broker(), nativeRuntimeDir = _a.nativeRuntimeDir, nativeMuxRuntimeDir = _a.nativeMuxRuntimeDir, nativeMuxSocket = _a.nativeMuxSocket;
                        _d.label = 1;
                    case 1:
                        _d.trys.push([1, 6, , 14]);
                        return [4 /*yield*/, (0, promises_1.mkdir)(nativeRuntimeDir, { recursive: true, mode: 448 })];
                    case 2:
                        _d.sent();
                        return [4 /*yield*/, (0, promises_1.mkdir)(nativeMuxRuntimeDir, { recursive: true, mode: 448 })];
                    case 3:
                        _d.sent();
                        // Each runtime owns one of these directories and removes it on dispose,
                        // so anything left from a runtime that was killed accumulates for as
                        // long as the host stays up. Reclaiming is best effort and must not
                        // delay or fail startup.
                        void (0, native_terminal_1.reclaimStaleMuxRuntimeDirs)({
                            root: (0, node_path_1.join)(nativeRuntimeDir, "wezterm-runtime"),
                            keep: input.runtimeID(),
                        }).catch(function () { return undefined; });
                        return [4 /*yield*/, (0, native_terminal_1.writeWezTermNativeDomainConfig)({
                                directory: nativeMuxRuntimeDir,
                                socketPath: nativeMuxSocket,
                            })];
                    case 4:
                        nativeDomain = _d.sent();
                        return [4 /*yield*/, installRegistry(nativeRuntimeDir, nativeMuxRuntimeDir, nativeMuxSocket, nativeDomain)];
                    case 5:
                        _d.sent();
                        return [3 /*break*/, 14];
                    case 6:
                        _b = _d.sent();
                        // Native Terminal recovery: if the mux server was killed or runtime
                        // dirs were deleted (e.g. by rm -rf), recreate dirs and retry once.
                        input.publish({
                            type: "diagnostic",
                            level: "info",
                            message: "native terminal first init failed; attempting recovery",
                        });
                        _d.label = 7;
                    case 7:
                        _d.trys.push([7, 12, , 13]);
                        return [4 /*yield*/, (0, promises_1.mkdir)(nativeRuntimeDir, { recursive: true, mode: 448 })];
                    case 8:
                        _d.sent();
                        return [4 /*yield*/, (0, promises_1.mkdir)(nativeMuxRuntimeDir, { recursive: true, mode: 448 })];
                    case 9:
                        _d.sent();
                        return [4 /*yield*/, (0, native_terminal_1.writeWezTermNativeDomainConfig)({
                                directory: nativeMuxRuntimeDir,
                                socketPath: nativeMuxSocket,
                            })];
                    case 10:
                        nativeDomain = _d.sent();
                        return [4 /*yield*/, installRegistry(nativeRuntimeDir, nativeMuxRuntimeDir, nativeMuxSocket, nativeDomain)];
                    case 11:
                        _d.sent();
                        return [3 /*break*/, 13];
                    case 12:
                        _c = _d.sent();
                        return [3 /*break*/, 13];
                    case 13: return [3 /*break*/, 14];
                    case 14: return [2 /*return*/];
                }
            });
        });
    }
    function requireTerminal() {
        if (!nativeTerminal)
            throw new Error("Native Terminal Host is unavailable");
        return nativeTerminal;
    }
    function publicSession(session) {
        return __assign(__assign({ id: session.id, host: session.host, paneID: session.paneID, windowID: session.windowID, muxWindowID: session.muxWindowID, tabID: session.tabID, command: session.command, cwd: session.cwd, status: session.status, inputOwner: session.inputOwner, geometryOwner: session.geometryOwner, secureInput: session.secureInput, rows: session.rows, cols: session.cols, startedAt: session.startedAt, attached: session.attached, mayWaitForHuman: session.mayWaitForHuman }, (session.sessionID ? { sessionID: session.sessionID } : {})), (session.agentID ? { agentID: session.agentID } : {}));
    }
    function reconcile() {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, requireTerminal().reconcile()];
                    case 1: return [2 /*return*/, (_a.sent()).map(publicSession)];
                }
            });
        });
    }
    function list(_sessionID) {
        return __awaiter(this, void 0, void 0, function () {
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (!nativeTerminal) return [3 /*break*/, 2];
                        return [4 /*yield*/, reconcile()];
                    case 1:
                        _a = _b.sent();
                        return [3 /*break*/, 3];
                    case 2:
                        _a = [];
                        _b.label = 3;
                    case 3: return [2 /*return*/, _a];
                }
            });
        });
    }
    function read(id, options) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, requireTerminal().read(id, options)];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    }
    function openHub() {
        return __awaiter(this, void 0, void 0, function () {
            var hub;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, requireTerminal().openHub()];
                    case 1:
                        hub = _a.sent();
                        return [2 /*return*/, { muxWindowID: hub.muxWindowID }];
                }
            });
        });
    }
    function releaseHumanControl(id, sessionID) {
        return publicSession(requireTerminal().releaseHumanControl(id, sessionID));
    }
    function claimHumanInput(id, sessionID) {
        return __awaiter(this, void 0, void 0, function () {
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = publicSession;
                        return [4 /*yield*/, requireTerminal().claimHumanInput(id, sessionID)];
                    case 1: return [2 /*return*/, _a.apply(void 0, [_b.sent()])];
                }
            });
        });
    }
    function beginSecureInput(id, sessionID) {
        return publicSession(requireTerminal().beginSecureInput(id, sessionID));
    }
    function endSecureInput(id, sessionID) {
        return publicSession(requireTerminal().endSecureInput(id, sessionID));
    }
    function stop(id, actor, sessionID) {
        return __awaiter(this, void 0, void 0, function () {
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = publicSession;
                        return [4 /*yield*/, requireTerminal().stop(id, actor, sessionID)];
                    case 1: return [2 /*return*/, _a.apply(void 0, [_b.sent()])];
                }
            });
        });
    }
    function start(input) {
        return __awaiter(this, void 0, void 0, function () {
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = publicSession;
                        return [4 /*yield*/, requireTerminal().start(input)];
                    case 1: return [2 /*return*/, _a.apply(void 0, [_b.sent()])];
                }
            });
        });
    }
    function write(id, value, options) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, requireTerminal().write(id, value, options)];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    }
    function resize(id, rows, cols, actor, sessionID) {
        return __awaiter(this, void 0, void 0, function () {
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = publicSession;
                        return [4 /*yield*/, requireTerminal().resize(id, rows, cols, actor, sessionID)];
                    case 1: return [2 /*return*/, _a.apply(void 0, [_b.sent()])];
                }
            });
        });
    }
    function ttyName(id) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (nativeTerminal === null || nativeTerminal === void 0 ? void 0 : nativeTerminal.ttyName(id))];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    }
    function snapshot(id) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, requireTerminal().snapshot(id)];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    }
    function observe(id, afterRevision, options) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, requireTerminal().observe(id, afterRevision, options)];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    }
    function session(id) {
        var lastObservedText = requireTerminal().session(id).lastObservedText;
        return { lastObservedText: lastObservedText };
    }
    function markObserved(id, text, revision) {
        requireTerminal().markObserved(id, text, revision);
    }
    function requestHuman(id, reason, sessionID) {
        return __awaiter(this, void 0, void 0, function () {
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = publicSession;
                        return [4 /*yield*/, requireTerminal().requestHuman(id, reason, sessionID)];
                    case 1: return [2 /*return*/, _a.apply(void 0, [_b.sent()])];
                }
            });
        });
    }
    /**
     * I3: the registry's model-visible surface addresses only the active
     * session's panes. Called when a session is established and again on attach.
     */
    function setActiveSession(sessionID) {
        nativeTerminal === null || nativeTerminal === void 0 ? void 0 : nativeTerminal.setActiveSession(sessionID);
    }
    function stopForSession(sessionID) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (nativeTerminal === null || nativeTerminal === void 0 ? void 0 : nativeTerminal.stopForSession(sessionID))];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    }
    function close() {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (closed)
                            return [2 /*return*/];
                        closed = true;
                        return [4 /*yield*/, (nativeInputBroker === null || nativeInputBroker === void 0 ? void 0 : nativeInputBroker.stop())];
                    case 1:
                        _a.sent();
                        nativeInputBroker = undefined;
                        if (!!input.external) return [3 /*break*/, 3];
                        return [4 /*yield*/, (nativeTerminal === null || nativeTerminal === void 0 ? void 0 : nativeTerminal.dispose())];
                    case 2:
                        _a.sent();
                        _a.label = 3;
                    case 3:
                        nativeTerminal = undefined;
                        return [2 /*return*/];
                }
            });
        });
    }
    return {
        init: init,
        list: list,
        reconcile: reconcile,
        read: read,
        openHub: openHub,
        claimHumanInput: claimHumanInput,
        releaseHumanControl: releaseHumanControl,
        beginSecureInput: beginSecureInput,
        endSecureInput: endSecureInput,
        stop: stop,
        start: start,
        write: write,
        resize: resize,
        snapshot: snapshot,
        observe: observe,
        session: session,
        markObserved: markObserved,
        requestHuman: requestHuman,
        ttyName: ttyName,
        setActiveSession: setActiveSession,
        stopForSession: stopForSession,
        close: close,
    };
}
