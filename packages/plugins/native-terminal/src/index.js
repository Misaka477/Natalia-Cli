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
exports.TERMINAL_PLUGIN_MANIFEST = exports.TERMINAL_PLUGIN_ID = exports.createTerminalPlugin = exports.terminalTools = exports.terminalToolFamily = exports.createPtyTerminalController = exports.createTerminalController = exports.writeWezTermNativeDomainConfig = exports.startNativeInputBroker = exports.resolveWezTermExecutable = exports.resolveNataliaWezTermForkExecutable = exports.reclaimStaleMuxRuntimeDirs = exports.nativeTerminalPaneCommand = exports.nativeTerminalForkBuildDir = exports.nativeInputBrokerEndpoint = exports.nativeInputBrokerDecision = exports.monospaceFontFallback = exports.encodeNativeInputDecision = exports.decodeNativeInputDecision = exports.decodeNativeInputClaim = exports.createWezTermHost = exports.NativeTerminalRegistry = exports.NATIVE_INPUT_BROKER_VERSION = void 0;
exports.default = terminalPlugin;
var native_terminal_1 = require("./native-terminal");
Object.defineProperty(exports, "NATIVE_INPUT_BROKER_VERSION", { enumerable: true, get: function () { return native_terminal_1.NATIVE_INPUT_BROKER_VERSION; } });
Object.defineProperty(exports, "NativeTerminalRegistry", { enumerable: true, get: function () { return native_terminal_1.NativeTerminalRegistry; } });
Object.defineProperty(exports, "createWezTermHost", { enumerable: true, get: function () { return native_terminal_1.createWezTermHost; } });
Object.defineProperty(exports, "decodeNativeInputClaim", { enumerable: true, get: function () { return native_terminal_1.decodeNativeInputClaim; } });
Object.defineProperty(exports, "decodeNativeInputDecision", { enumerable: true, get: function () { return native_terminal_1.decodeNativeInputDecision; } });
Object.defineProperty(exports, "encodeNativeInputDecision", { enumerable: true, get: function () { return native_terminal_1.encodeNativeInputDecision; } });
Object.defineProperty(exports, "monospaceFontFallback", { enumerable: true, get: function () { return native_terminal_1.monospaceFontFallback; } });
Object.defineProperty(exports, "nativeInputBrokerDecision", { enumerable: true, get: function () { return native_terminal_1.nativeInputBrokerDecision; } });
Object.defineProperty(exports, "nativeInputBrokerEndpoint", { enumerable: true, get: function () { return native_terminal_1.nativeInputBrokerEndpoint; } });
Object.defineProperty(exports, "nativeTerminalForkBuildDir", { enumerable: true, get: function () { return native_terminal_1.nativeTerminalForkBuildDir; } });
Object.defineProperty(exports, "nativeTerminalPaneCommand", { enumerable: true, get: function () { return native_terminal_1.nativeTerminalPaneCommand; } });
Object.defineProperty(exports, "reclaimStaleMuxRuntimeDirs", { enumerable: true, get: function () { return native_terminal_1.reclaimStaleMuxRuntimeDirs; } });
Object.defineProperty(exports, "resolveNataliaWezTermForkExecutable", { enumerable: true, get: function () { return native_terminal_1.resolveNataliaWezTermForkExecutable; } });
Object.defineProperty(exports, "resolveWezTermExecutable", { enumerable: true, get: function () { return native_terminal_1.resolveWezTermExecutable; } });
Object.defineProperty(exports, "startNativeInputBroker", { enumerable: true, get: function () { return native_terminal_1.startNativeInputBroker; } });
Object.defineProperty(exports, "writeWezTermNativeDomainConfig", { enumerable: true, get: function () { return native_terminal_1.writeWezTermNativeDomainConfig; } });
var terminal_controller_1 = require("./terminal-controller");
Object.defineProperty(exports, "createTerminalController", { enumerable: true, get: function () { return terminal_controller_1.createTerminalController; } });
var pty_terminal_controller_1 = require("./pty-terminal-controller");
Object.defineProperty(exports, "createPtyTerminalController", { enumerable: true, get: function () { return pty_terminal_controller_1.createPtyTerminalController; } });
var terminal_tools_1 = require("./terminal-tools");
Object.defineProperty(exports, "terminalToolFamily", { enumerable: true, get: function () { return terminal_tools_1.terminalToolFamily; } });
Object.defineProperty(exports, "terminalTools", { enumerable: true, get: function () { return terminal_tools_1.terminalTools; } });
var terminal_plugin_1 = require("./terminal-plugin");
Object.defineProperty(exports, "createTerminalPlugin", { enumerable: true, get: function () { return terminal_plugin_1.createTerminalPlugin; } });
Object.defineProperty(exports, "TERMINAL_PLUGIN_ID", { enumerable: true, get: function () { return terminal_plugin_1.TERMINAL_PLUGIN_ID; } });
Object.defineProperty(exports, "TERMINAL_PLUGIN_MANIFEST", { enumerable: true, get: function () { return terminal_plugin_1.TERMINAL_PLUGIN_MANIFEST; } });
var runtime_services_1 = require("@natalia/runtime-services");
var terminal_plugin_2 = require("./terminal-plugin");
function terminalPlugin() {
    var instance;
    return {
        manifest: __assign(__assign({}, terminal_plugin_2.TERMINAL_PLUGIN_MANIFEST), { entry: "index.js", requires: [runtime_services_1.terminalInput.id] }),
        setup: function (api) {
            return __awaiter(this, void 0, void 0, function () {
                var input;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            input = api.services.get(runtime_services_1.terminalInput.id);
                            if (!input)
                                throw new Error("missing runtime service: ".concat(runtime_services_1.terminalInput.id));
                            instance = (0, terminal_plugin_2.createTerminalPlugin)(input);
                            return [4 /*yield*/, instance.setup(api)];
                        case 1:
                            _a.sent();
                            return [2 /*return*/];
                    }
                });
            });
        },
        dispose: function () {
            return __awaiter(this, void 0, void 0, function () {
                var _a;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0: return [4 /*yield*/, ((_a = instance === null || instance === void 0 ? void 0 : instance.dispose) === null || _a === void 0 ? void 0 : _a.call(instance))];
                        case 1:
                            _b.sent();
                            instance = undefined;
                            return [2 /*return*/];
                    }
                });
            });
        },
    };
}
