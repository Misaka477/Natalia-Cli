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
exports.wireFeatures = wireFeatures;
var runtime_1 = require("@natalia/runtime");
var terminal_runtime_1 = require("../terminal-runtime");
var permissions_1 = require("../permissions");
var collab_1 = require("@natalia/collab");
var snapshot_1 = require("../snapshot");
var collab_2 = require("@natalia/collab");
var collab_3 = require("@natalia/collab");
var collab_4 = require("@natalia/collab");
var collab_5 = require("@natalia/collab");
var collab_6 = require("@natalia/collab");
var collab_7 = require("@natalia/collab");
var collab_8 = require("@natalia/collab");
var plugin_assembly_1 = require("../plugin-assembly");
var config_reload_1 = require("../config-reload");
var tool_publish_1 = require("../tool-publish");
function wireFeatures(ctx, options) {
    var _this = this;
    var state = ctx.state, ports = ctx.ports;
    var terminalRuntime = (0, terminal_runtime_1.createTerminalRuntime)(ctx);
    ports.setPendingHumanTerminal = terminalRuntime.setPendingHumanTerminal;
    ports.maybeContinueAfterHumanInput =
        terminalRuntime.maybeContinueAfterHumanInput;
    ports.getPermissionMode = function () { return state.permissionMode; };
    ports.setPermissionMode = function (mode) {
        state.permissionMode = mode;
    };
    ports.getSelectedPermissionProfile = function () { return state.selectedPermissionProfile; };
    ports.setSelectedPermissionProfile = function (profile) {
        state.selectedPermissionProfile = profile;
    };
    ports.getDefaultPermissionMode = function () { return state.defaultPermissionMode; };
    ports.setDefaultPermissionMode = function (mode) {
        state.defaultPermissionMode = mode;
    };
    ports.getDefaultPermissionProfile = function () { return state.defaultPermissionProfile; };
    ports.setDefaultPermissionProfile = function (profile) {
        state.defaultPermissionProfile = profile;
    };
    var permissions = (0, permissions_1.createPermissions)(ctx, options);
    ports.createToolPolicyLayer = permissions.createToolPolicyLayer;
    ports.isToolAllowed = permissions.isToolAllowed;
    ports.applyAgentPolicy = permissions.applyAgentPolicy;
    ports.extensionToolPermission = permissions.extensionToolPermission;
    ports.extensionEnabled = permissions.extensionEnabled;
    var boundary = (0, collab_1.createCollaborationBoundary)(ctx);
    ports.settleMailboxAtBoundary = boundary.settleMailboxAtBoundary;
    ports.takeLiveUserMessages = boundary.takeLiveUserMessages;
    ports.reconcileWorkspaceObservation = boundary.reconcileWorkspaceObservation;
    var snapshot = (0, snapshot_1.createSnapshot)(ctx);
    ports.setInFlightOperation = snapshot.setInFlightOperation;
    ports.toolEventTurnID = snapshot.toolEventTurnID;
    ports.isSessionSnapshotTrigger = snapshot.isSessionSnapshotTrigger;
    ports.publishSessionSnapshot = snapshot.publishSessionSnapshot;
    ports.currentSessionSnapshot = snapshot.currentSessionSnapshot;
    ports.nextCollabSequence = function () { return state.collabSequence++; };
    ports.nextPlanSequence = function () { return state.planSequence++; };
    var chatPrompt = (0, collab_2.createChatPrompt)(ctx);
    var chatTools = (0, collab_3.createChatTools)(ctx);
    var collaborationWake = (0, collab_4.createCollaborationWake)(ctx);
    ports.wakeMainForCollaboration = collaborationWake.wakeMainForCollaboration;
    ports.wakeNavi = collaborationWake.wakeNavi;
    ports.requestNaviWake = collaborationWake.requestNaviWake;
    ports.wakeNia = collaborationWake.wakeNia;
    ports.requestNiaWake = collaborationWake.requestNiaWake;
    ports.scheduleInternalWake = collaborationWake.scheduleInternalWake;
    var mailboxPlans = (0, collab_5.createMailboxPlans)(ctx);
    ports.createCollabChatTool = mailboxPlans.createCollabChatTool;
    ports.enqueueMailboxMessage = mailboxPlans.enqueueMailboxMessage;
    ports.cancelMailboxMessage = mailboxPlans.cancelMailboxMessage;
    ports.enqueueMailboxForClient = function (input) { return __awaiter(_this, void 0, void 0, function () {
        var sessionID, exec, _a, _b;
        var _c;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    sessionID = input.sessionID;
                    if (!sessionID) return [3 /*break*/, 4];
                    if (!((_c = ctx.ports
                        .getExecutionBySession()
                        .get(sessionID)) !== null && _c !== void 0)) return [3 /*break*/, 1];
                    _b = _c;
                    return [3 /*break*/, 3];
                case 1: return [4 /*yield*/, ctx.ports.ensureExecution(sessionID)];
                case 2:
                    _b = (_d.sent());
                    _d.label = 3;
                case 3:
                    _a = (_b);
                    return [3 /*break*/, 5];
                case 4:
                    _a = undefined;
                    _d.label = 5;
                case 5:
                    exec = _a;
                    return [2 /*return*/, mailboxPlans.enqueueMailboxMessage(input, exec)];
            }
        });
    }); };
    ports.planDocRuntime = (0, collab_6.createPlanDocRuntime)(ctx);
    ports.naviChatPersona = chatPrompt.naviChatPersona;
    ports.naviChatLiveContext = chatPrompt.naviChatLiveContext;
    ports.niaChatPersona = chatPrompt.niaChatPersona;
    ports.niaChatLiveContext = chatPrompt.niaChatLiveContext;
    ports.naviChatTools = chatTools.naviChatTools;
    ports.niaChatTools = chatTools.niaChatTools;
    ports.chatToolSummary = chatTools.chatToolSummary;
    ports.runNaviChatTurn = (0, collab_7.createNaviChatTurn)(ctx).runNaviChatTurn;
    ports.runNiaChatTurn = (0, collab_8.createNiaChatTurn)(ctx).runNiaChatTurn;
    ports.providerFromEnvironment = runtime_1.providerFromEnvironment;
    var pluginAssembly = (0, plugin_assembly_1.createPluginAssembly)(ctx, options);
    ports.reloadPermissionSettings = permissions.reloadPermissionSettings;
    ports.setTsRuntimeConfig = function (config) {
        state.tsRuntimeConfig = config;
    };
    ports.setMaxSteps = function (steps) {
        state.maxSteps = steps;
    };
    ports.setRetryPolicy = function (policy) {
        state.retryPolicy = policy;
    };
    ports.setProviderConcurrencyLimiter = function (limiter) {
        state.providerConcurrencyLimiter = limiter;
    };
    ports.setAgentRegistry = function (registry) {
        state.agentRegistry = registry;
    };
    var configReload = (0, config_reload_1.createConfigReload)(ctx, options);
    ports.configReloadBlockedReason = configReload.configReloadBlockedReason;
    ports.reloadConfigFromDisk = configReload.reloadConfigFromDisk;
    var toolPublish = (0, tool_publish_1.createToolPublish)(ctx, options);
    ports.publishWorkGraphToolCall = toolPublish.publishWorkGraphToolCall;
    ports.hotReloadToolFamily = toolPublish.hotReloadToolFamily;
    ports.publishToolCatalogChanges = toolPublish.publishToolCatalogChanges;
    ports.setInFlightOperationFor = snapshot.setInFlightOperationFor;
    return {
        terminalRuntime: terminalRuntime,
        permissions: permissions,
        boundary: boundary,
        snapshot: snapshot,
        chatPrompt: chatPrompt,
        toolPublish: toolPublish,
        pluginAssembly: pluginAssembly,
        configReload: configReload,
    };
}
