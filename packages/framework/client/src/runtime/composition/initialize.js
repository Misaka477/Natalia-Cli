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
exports.wireInitialize = wireInitialize;
var node_crypto_1 = require("node:crypto");
var agent_1 = require("@anthelia/agent");
var config_1 = require("@natalia/config");
var runtime_1 = require("@natalia/runtime");
var session_1 = require("@anthelia/session");
var runtime_services_1 = require("@natalia/runtime-services");
var turn_orchestration_1 = require("@anthelia/turn-orchestration");
var tools_1 = require("@anthelia/tools");
var substrate_1 = require("@anthelia/substrate");
var framework_services_1 = require("../initialize/framework-services");
var initialize_1 = require("../initialize");
var helpers_1 = require("./helpers");
var WAITING_TOOLS = new Set(["terminal_observe"]);
var MAX_PROTOCOL_CORRECTIONS = 2;
function sessionSeed(workspaceRoot) {
    return (0, node_crypto_1.createHash)("sha256").update(workspaceRoot).digest("hex").slice(0, 12);
}
function wireInitialize(ctx, options, features, createRuntimeClient) {
    var _this = this;
    var state = ctx.state, ports = ctx.ports;
    var drainSession = function (signal) { return __awaiter(_this, void 0, void 0, function () {
        var controller;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    controller = state.serviceDirectory.get(turn_orchestration_1.turnController);
                    return [4 /*yield*/, controller.drain(signal, state.sessionID)];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); };
    state.initialize = {
        resolveConfig: config_1.resolveConfig,
        reloadPermissionSettings: features.permissions.reloadPermissionSettings,
        skillsPluginInput: features.pluginAssembly.skillsPluginInput,
        localToolsPluginInput: features.pluginAssembly.localToolsPluginInput,
        mcpPluginInput: features.pluginAssembly.mcpPluginInput,
        providerModelPluginInput: features.pluginAssembly.providerModelPluginInput,
        wireFrameworkServices: framework_services_1.wireFrameworkServices,
        capabilityRegistry: state.capabilityRegistry,
        serviceDirectory: state.serviceDirectory,
        workspaceCapabilityView: state.workspaceCapabilityView,
        waiterDeps: state.waiterDeps,
        handleCommand: features.commands.handleCommand,
        scheduleTitleGeneration: features.title.scheduleTitleGeneration,
        deliverQueuedMailboxAtBoundary: features.boundary.deliverQueuedMailboxAtBoundary,
        createRealRuntimeClient: function (nestedOptions) {
            return createRuntimeClient(__assign(__assign({}, nestedOptions), { pluginStoreRoot: options.pluginStoreRoot }));
        },
        mountPlugins: substrate_1.mountPlugins,
        agentPolicyLayer: features.permissions.agentPolicyLayer,
        permissionProfileLayer: features.permissions.permissionProfileLayer,
        terminalCommandBuffer: state.terminalCommandBuffer,
        evaluatePermissionProfileCommandRules: tools_1.evaluatePermissionProfileCommandRules,
        ensureBashCommandParser: tools_1.ensureBashCommandParser,
        agentsFromConfig: agent_1.agentsFromConfig,
        providerForModel: runtime_1.providerForModel,
        sessionSeed: sessionSeed,
        createHash: node_crypto_1.createHash,
        lineCount: helpers_1.lineCount,
        contextEntriesToProviderMessages: runtime_1.contextEntriesToProviderMessages,
        withProviderConcurrency: runtime_1.withProviderConcurrency,
        requireNativeToolCallProtocol: runtime_1.requireNativeToolCallProtocol,
        normalizeRawToolCallProtocol: runtime_1.normalizeRawToolCallProtocol,
        nativeToolCallCorrection: runtime_1.nativeToolCallCorrection,
        MAX_PROTOCOL_CORRECTIONS: MAX_PROTOCOL_CORRECTIONS,
        WAITING_TOOLS: WAITING_TOOLS,
        readOnlyToolMessage: runtime_services_1.readOnlyToolMessage,
        MAX_STEPS_PROMPT: runtime_1.MAX_STEPS_PROMPT,
        MISSING_FINAL_RESPONSE_FALLBACK: runtime_1.MISSING_FINAL_RESPONSE_FALLBACK,
        cleanupToolOutput: tools_1.cleanupToolOutput,
        settleInterruptedTurnIDs: session_1.settleInterruptedTurnIDs,
        settleInterruptedTurns: session_1.settleInterruptedTurns,
        projectSession: session_1.projectSession,
        modelVisibleEvents: session_1.modelVisibleEvents,
        turnCoordinator: function () { return (0, session_1.sessionRunCoordinator)(state.sessionID); },
        drainSession: drainSession,
        projectInteractiveRequests: session_1.projectInteractiveRequests,
        contextStatusEvent: runtime_1.contextStatusEvent,
        publishRuntimeCapabilities: features.toolPublish.publishRuntimeCapabilities,
        publishRegisteredTools: features.toolPublish.publishRegisteredTools,
        ProviderConcurrencyLimiter: runtime_1.ProviderConcurrencyLimiter,
    };
    ports.initialize = (0, initialize_1.createInitialize)(ctx, options).initialize;
    ports.applyConfigFromDisk = features.configReload.applyConfigFromDisk;
}
