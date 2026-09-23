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
var node_os_1 = require("node:os");
var node_path_1 = require("node:path");
var node_net_1 = require("node:net");
var src_1 = require("../src");
(0, bun_test_1.test)("local input broker atomically claims without relaying input bytes", function () { return __awaiter(void 0, void 0, void 0, function () {
    var writes, registry, session, broker, _a, response;
    var _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                writes = [];
                registry = new src_1.NativeTerminalRegistry({
                    kind: "wezterm",
                    executable: "wezterm",
                    spawn: function () {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                return [2 /*return*/, { pane_id: 91, window_id: 2, tab_id: 3 }];
                            });
                        });
                    },
                    list: function () {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                return [2 /*return*/, [{ pane_id: 91, window_id: 2, tab_id: 3, rows: 24, cols: 80 }]];
                            });
                        });
                    },
                    read: function () {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                return [2 /*return*/, ""];
                            });
                        });
                    },
                    write: function (_paneID, data) {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                writes.push(data);
                                return [2 /*return*/];
                            });
                        });
                    },
                    focus: function () {
                        return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/];
                        }); });
                    },
                    resize: function () {
                        return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/];
                        }); });
                    },
                    stop: function () {
                        return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/];
                        }); });
                    },
                });
                return [4 /*yield*/, registry.start({ cwd: "/repo", command: "cat" })];
            case 1:
                session = _c.sent();
                _a = src_1.startNativeInputBroker;
                _b = {
                    registry: registry
                };
                return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-input-broker-"))];
            case 2: return [4 /*yield*/, _a.apply(void 0, [(_b.runtimeDir = _c.sent(),
                        _b.daemonID = "daemon_1",
                        _b.token = "token_1",
                        _b)])];
            case 3:
                broker = _c.sent();
                _c.label = 4;
            case 4:
                _c.trys.push([4, , 6, 8]);
                return [4 /*yield*/, send(broker.endpoint, "".concat(JSON.stringify({
                        version: src_1.NATIVE_INPUT_BROKER_VERSION,
                        type: "claim",
                        nonce: "nonce_1",
                        token: broker.token,
                        terminalID: "pane_".concat(session.paneID),
                        paneID: session.paneID,
                        kind: "paste",
                        byteLength: 16,
                    }), "\n"))];
            case 5:
                response = _c.sent();
                (0, bun_test_1.expect)((0, src_1.decodeNativeInputDecision)(response)).toMatchObject({ permit: true });
                (0, bun_test_1.expect)(registry.list()).toMatchObject([{ inputOwner: "human" }]);
                (0, bun_test_1.expect)(writes).toEqual([]);
                return [3 /*break*/, 8];
            case 6: return [4 /*yield*/, broker.stop()];
            case 7:
                _c.sent();
                return [7 /*endfinally*/];
            case 8: return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("local input broker records only the first human ownership claim", function () { return __awaiter(void 0, void 0, void 0, function () {
    var inputs, registry, session, broker, _a, _i, _b, nonce, response;
    var _c;
    return __generator(this, function (_d) {
        switch (_d.label) {
            case 0:
                inputs = [];
                registry = new src_1.NativeTerminalRegistry({
                    kind: "wezterm",
                    executable: "wezterm",
                    spawn: function () {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                return [2 /*return*/, { pane_id: 94, window_id: 2, tab_id: 3 }];
                            });
                        });
                    },
                    list: function () {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                return [2 /*return*/, [{ pane_id: 94, window_id: 2, tab_id: 3, rows: 24, cols: 80 }]];
                            });
                        });
                    },
                    read: function () {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                return [2 /*return*/, ""];
                            });
                        });
                    },
                    write: function () {
                        return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/];
                        }); });
                    },
                    focus: function () {
                        return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/];
                        }); });
                    },
                    resize: function () {
                        return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/];
                        }); });
                    },
                    stop: function () {
                        return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/];
                        }); });
                    },
                });
                return [4 /*yield*/, registry.start({ cwd: "/repo", command: "cat" })];
            case 1:
                session = _d.sent();
                _a = src_1.startNativeInputBroker;
                _c = {
                    registry: registry
                };
                return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-input-broker-"))];
            case 2: return [4 /*yield*/, _a.apply(void 0, [(_c.runtimeDir = _d.sent(),
                        _c.daemonID = "claim_once",
                        _c.token = "token_claim_once",
                        _c.onInput = function (input) { return inputs.push(input); },
                        _c)])];
            case 3:
                broker = _d.sent();
                _d.label = 4;
            case 4:
                _d.trys.push([4, , 9, 12]);
                _i = 0, _b = ["nonce_first", "nonce_second"];
                _d.label = 5;
            case 5:
                if (!(_i < _b.length)) return [3 /*break*/, 8];
                nonce = _b[_i];
                return [4 /*yield*/, send(broker.endpoint, "".concat(JSON.stringify({
                        version: src_1.NATIVE_INPUT_BROKER_VERSION,
                        type: "claim",
                        nonce: nonce,
                        token: broker.token,
                        terminalID: "pane_".concat(session.paneID),
                        paneID: session.paneID,
                        kind: "keyboard",
                        byteLength: 1,
                    }), "\n"))];
            case 6:
                response = _d.sent();
                (0, bun_test_1.expect)((0, src_1.decodeNativeInputDecision)(response).permit).toBe(true);
                _d.label = 7;
            case 7:
                _i++;
                return [3 /*break*/, 5];
            case 8:
                (0, bun_test_1.expect)(inputs).toHaveLength(1);
                (0, bun_test_1.expect)(inputs[0]).toMatchObject({
                    terminalID: session.id,
                    kind: "keyboard",
                });
                (0, bun_test_1.expect)(registry.list()[0]).toMatchObject({ inputOwner: "human" });
                return [3 /*break*/, 12];
            case 9: return [4 /*yield*/, broker.stop()];
            case 10:
                _d.sent();
                return [4 /*yield*/, registry.dispose()];
            case 11:
                _d.sent();
                return [7 /*endfinally*/];
            case 12: return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("local input broker denies an unknown pane without changing ownership", function () { return __awaiter(void 0, void 0, void 0, function () {
    var registry, session, broker, _a, response;
    var _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                registry = new src_1.NativeTerminalRegistry({
                    kind: "wezterm",
                    executable: "wezterm",
                    spawn: function () {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                return [2 /*return*/, { pane_id: 92, window_id: 2, tab_id: 3 }];
                            });
                        });
                    },
                    list: function () {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                return [2 /*return*/, [{ pane_id: 92, window_id: 2, tab_id: 3, rows: 24, cols: 80 }]];
                            });
                        });
                    },
                    read: function () {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                return [2 /*return*/, ""];
                            });
                        });
                    },
                    write: function () {
                        return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/];
                        }); });
                    },
                    focus: function () {
                        return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/];
                        }); });
                    },
                    resize: function () {
                        return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/];
                        }); });
                    },
                    stop: function () {
                        return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/];
                        }); });
                    },
                });
                return [4 /*yield*/, registry.start({ cwd: "/repo", command: "cat" })];
            case 1:
                session = _c.sent();
                _a = src_1.startNativeInputBroker;
                _b = {
                    registry: registry
                };
                return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-input-broker-"))];
            case 2: return [4 /*yield*/, _a.apply(void 0, [(_b.runtimeDir = _c.sent(),
                        _b.daemonID = "daemon_2",
                        _b.token = "token_2",
                        _b)])];
            case 3:
                broker = _c.sent();
                _c.label = 4;
            case 4:
                _c.trys.push([4, , 6, 8]);
                return [4 /*yield*/, send(broker.endpoint, "".concat(JSON.stringify({
                        version: src_1.NATIVE_INPUT_BROKER_VERSION,
                        type: "claim",
                        nonce: "nonce_2",
                        token: broker.token,
                        terminalID: "pane_".concat(session.paneID + 1),
                        paneID: session.paneID + 1,
                        kind: "keyboard",
                        byteLength: 1,
                    }), "\n"))];
            case 5:
                response = _c.sent();
                (0, bun_test_1.expect)((0, src_1.decodeNativeInputDecision)(response)).toMatchObject({
                    permit: false,
                });
                (0, bun_test_1.expect)(registry.list()).toMatchObject([{ inputOwner: "model" }]);
                return [3 /*break*/, 8];
            case 6: return [4 /*yield*/, broker.stop()];
            case 7:
                _c.sent();
                return [7 /*endfinally*/];
            case 8: return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("metadata-only native claim switches ownership without relaying bytes", function () { return __awaiter(void 0, void 0, void 0, function () {
    var writes, registry, session, broker, _a, response;
    var _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                writes = [];
                registry = new src_1.NativeTerminalRegistry({
                    kind: "wezterm",
                    executable: "wezterm",
                    spawn: function () {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                return [2 /*return*/, { pane_id: 93, window_id: 2, tab_id: 3 }];
                            });
                        });
                    },
                    list: function () {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                return [2 /*return*/, [{ pane_id: 93, window_id: 2, tab_id: 3, rows: 24, cols: 80 }]];
                            });
                        });
                    },
                    read: function () {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                return [2 /*return*/, ""];
                            });
                        });
                    },
                    write: function (_paneID, data) {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                writes.push(data);
                                return [2 /*return*/];
                            });
                        });
                    },
                    focus: function () {
                        return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/];
                        }); });
                    },
                    resize: function () {
                        return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/];
                        }); });
                    },
                    stop: function () {
                        return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/];
                        }); });
                    },
                });
                return [4 /*yield*/, registry.start({ cwd: "/repo", command: "cat" })];
            case 1:
                session = _c.sent();
                _a = src_1.startNativeInputBroker;
                _b = {
                    registry: registry
                };
                return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-input-broker-"))];
            case 2: return [4 /*yield*/, _a.apply(void 0, [(_b.runtimeDir = _c.sent(),
                        _b.daemonID = "daemon_3",
                        _b.token = "token_3",
                        _b)])];
            case 3:
                broker = _c.sent();
                _c.label = 4;
            case 4:
                _c.trys.push([4, , 6, 8]);
                return [4 /*yield*/, send(broker.endpoint, "".concat(JSON.stringify({
                        version: src_1.NATIVE_INPUT_BROKER_VERSION,
                        type: "claim",
                        nonce: "nonce_3",
                        token: broker.token,
                        terminalID: "pane_".concat(session.paneID),
                        paneID: session.paneID,
                        kind: "ime_commit",
                        byteLength: 6,
                    }), "\n"))];
            case 5:
                response = _c.sent();
                (0, bun_test_1.expect)((0, src_1.decodeNativeInputDecision)(response)).toMatchObject({ permit: true });
                (0, bun_test_1.expect)(registry.list()).toMatchObject([{ inputOwner: "human" }]);
                (0, bun_test_1.expect)(writes).toEqual([]);
                return [3 /*break*/, 8];
            case 6: return [4 /*yield*/, broker.stop()];
            case 7:
                _c.sent();
                return [7 /*endfinally*/];
            case 8: return [2 /*return*/];
        }
    });
}); });
function send(endpoint, frame) {
    return new Promise(function (resolve, reject) {
        var socket = (0, node_net_1.createConnection)(endpoint);
        var response = "";
        socket.on("connect", function () { return socket.write(frame); });
        socket.on("data", function (chunk) { return (response += chunk.toString("utf8")); });
        socket.on("end", function () { return resolve(response); });
        socket.on("error", reject);
    });
}
