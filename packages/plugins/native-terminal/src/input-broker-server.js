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
exports.startNativeInputBroker = startNativeInputBroker;
var node_crypto_1 = require("node:crypto");
var promises_1 = require("node:fs/promises");
var node_net_1 = require("node:net");
var input_broker_1 = require("./input-broker");
/**
 * Serves a private, line-delimited claim/decision exchange. The native host
 * retains the input bytes and writes them through its original pane path.
 */
function startNativeInputBroker(input) {
    return __awaiter(this, void 0, void 0, function () {
        var platform, endpoint, token, server, serverEvents;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    platform = (_a = input.platform) !== null && _a !== void 0 ? _a : process.platform;
                    endpoint = (0, input_broker_1.nativeInputBrokerEndpoint)({
                        runtimeDir: input.runtimeDir,
                        daemonID: input.daemonID,
                        platform: platform,
                    });
                    token = (_b = input.token) !== null && _b !== void 0 ? _b : (0, node_crypto_1.randomBytes)(32).toString("base64url");
                    if (!(platform !== "win32")) return [3 /*break*/, 2];
                    return [4 /*yield*/, (0, promises_1.rm)(endpoint, { force: true })];
                case 1:
                    _c.sent();
                    _c.label = 2;
                case 2:
                    server = (0, node_net_1.createServer)({ allowHalfOpen: true }, function (socket) {
                        return handleConnection(socket, input.registry, token, input.onInput, input.onDenied);
                    });
                    serverEvents = server;
                    return [4 /*yield*/, new Promise(function (resolve, reject) {
                            serverEvents.once("error", reject);
                            server.listen(endpoint, function () {
                                serverEvents.off("error", reject);
                                resolve();
                            });
                        })];
                case 3:
                    _c.sent();
                    if (!(platform !== "win32")) return [3 /*break*/, 5];
                    return [4 /*yield*/, (0, promises_1.chmod)(endpoint, 384)];
                case 4:
                    _c.sent();
                    _c.label = 5;
                case 5: return [2 /*return*/, { endpoint: endpoint, token: token, stop: function () { return stop(server, endpoint, platform); } }];
            }
        });
    });
}
function stop(server, endpoint, platform) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, new Promise(function (resolve, reject) {
                        return server.close(function (error) { return (error ? reject(error) : resolve()); });
                    })];
                case 1:
                    _a.sent();
                    if (!(platform !== "win32")) return [3 /*break*/, 3];
                    return [4 /*yield*/, (0, promises_1.rm)(endpoint, { force: true })];
                case 2:
                    _a.sent();
                    _a.label = 3;
                case 3: return [2 /*return*/];
            }
        });
    });
}
function handleConnection(socket, registry, token, onInput, onDenied) {
    var _this = this;
    var buffer = "";
    socket.setTimeout(1000, function () { return socket.destroy(); });
    socket.on("data", function (chunk) { return __awaiter(_this, void 0, void 0, function () {
        var newline, frame, event_1, knownPanes, decision, terminalID, ownershipChanged, _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    buffer += chunk.toString("utf8");
                    newline = buffer.indexOf("\n");
                    if (newline < 0)
                        return [2 /*return*/];
                    frame = buffer.slice(0, newline);
                    buffer = "";
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 4, , 5]);
                    event_1 = decodeNativeEvent(frame);
                    knownPanes = new Map(registry
                        .list()
                        .filter(function (session) { return session.status === "running"; })
                        .map(function (session) { return [session.paneID, session.id]; }));
                    decision = (0, input_broker_1.nativeInputBrokerDecision)({
                        event: event_1,
                        expectedToken: token,
                        knownPanes: knownPanes,
                    });
                    terminalID = knownPanes.get(event_1.paneID);
                    if (!decision.permit)
                        onDenied === null || onDenied === void 0 ? void 0 : onDenied({
                            terminalID: terminalID !== null && terminalID !== void 0 ? terminalID : event_1.terminalID,
                            paneID: event_1.paneID,
                            tokenAccepted: event_1.token === token,
                            paneAccepted: terminalID !== undefined,
                        });
                    if (!decision.permit) return [3 /*break*/, 3];
                    ownershipChanged = !registry.isHumanInputOwner(terminalID);
                    return [4 /*yield*/, registry.claimHumanInput(terminalID)];
                case 2:
                    _b.sent();
                    if (ownershipChanged)
                        onInput === null || onInput === void 0 ? void 0 : onInput({
                            terminalID: terminalID,
                            paneID: event_1.paneID,
                            kind: event_1.kind,
                            byteLength: event_1.byteLength,
                        });
                    _b.label = 3;
                case 3:
                    socket.end((0, input_broker_1.encodeNativeInputDecision)(decision));
                    return [3 /*break*/, 5];
                case 4:
                    _a = _b.sent();
                    socket.destroy();
                    return [3 /*break*/, 5];
                case 5: return [2 /*return*/];
            }
        });
    }); });
}
function decodeNativeEvent(frame) {
    return (0, input_broker_1.decodeNativeInputClaim)(frame);
}
