"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.wireServices = wireServices;
var plugin_lifecycle_1 = require("../plugin-lifecycle");
var ensure_ready_1 = require("../ensure-ready");
var session_execution_1 = require("../session-execution");
var session_attach_1 = require("../session-attach");
var policy_1 = require("../tool-execution/policy");
var tools_1 = require("@anthelia/tools");
var tool_arguments_1 = require("../../tool-arguments");
var helpers_1 = require("./helpers");
var collaboration_1 = require("@natalia/collaboration");
function wireServices(ctx, options) {
    var state = ctx.state, ports = ctx.ports;
    var runtimeContext;
    ports.runPluginLifecyclePostReconcile =
        (0, plugin_lifecycle_1.createPluginLifecycle)(ctx).runPluginLifecyclePostReconcile;
    ports.setReady = function (value) {
        state.ready = value;
    };
    var ensureReady = (0, ensure_ready_1.createEnsureReady)(ctx).ensureReady;
    var sessionExecution = (0, session_execution_1.createSessionExecution)(ctx, options);
    ports.ensureExecution = sessionExecution.ensureExecution;
    ports.persistInboxPromotion = sessionExecution.persistInboxPromotion;
    ports.drainSessionFor = sessionExecution.drainSessionFor;
    ports.setLastSubmitted = function (value) {
        state.lastSubmitted = value;
    };
    ports.setSessionID = function (value) {
        state.sessionID = value;
    };
    ports.setSession = function (value) {
        state.session = value;
    };
    ports.setRuntimeContext = function (value) {
        runtimeContext = value;
    };
    ports.getRuntimeContext = function () {
        var _a, _b;
        var context = (_b = (_a = state.activeExec) === null || _a === void 0 ? void 0 : _a.context) !== null && _b !== void 0 ? _b : runtimeContext;
        if (!context)
            throw new Error("runtime context is not initialized");
        return context;
    };
    ports.setActiveExec = function (value) {
        state.activeExec = value;
    };
    ports.setAttachmentReferences = function (value) {
        state.attachmentReferences = value;
    };
    ports.setToolCalls = function (value) {
        state.toolCalls = value;
    };
    ports.setPauseWaiters = function (value) {
        state.pauseWaiters = value;
    };
    ports.setActiveSkill = function (value) {
        state.activeSkill = value;
    };
    ports.setLastProviderUsage = function (value) {
        state.lastProviderUsage = value;
    };
    ports.clearRuntimeDiagnostics = function () {
        state.runtimeDiagnostics.splice(0);
    };
    ports.getRuntimeDiagnosticsBySession = function () {
        return state.runtimeDiagnosticsBySession;
    };
    ports.getRuntimeDiagnostics = function () { return state.runtimeDiagnostics; };
    ports.attachSession = (0, session_attach_1.createSessionAttach)(ctx).attachSession;
    ports.setActiveAbort = function (value) {
        state.activeAbort = value;
    };
    ports.setActiveTurnID = function (value) {
        state.activeTurnID = value;
    };
    ports.setSelectedAgent = function (value) {
        state.selectedAgent = value;
    };
    ports.setPendingAgent = function (value) {
        state.pendingAgent = value;
    };
    var policy = (0, policy_1.createToolPolicySurface)(ctx);
    ports.waitIfPaused = policy.waitIfPaused;
    ports.toolSettings = policy.toolSettings;
    ports.authorizeWorkspaceRead = policy.authorizeWorkspaceRead;
    ports.authorizeSandboxMerge = policy.authorizeSandboxMerge;
    ports.authorizeSandboxManagement = policy.authorizeSandboxManagement;
    ports.getInteractive = function () {
        return ctx.state.serviceDirectory.get(collaboration_1.collaborationWaiter);
    };
    ports.getTerminalCommandBuffer = function () { return state.terminalCommandBuffer; };
    ports.getSandboxResourcesByID = function () { return state.sandboxResourcesByID; };
    ports.getEndTurnWaitingHuman = function () { return state.endTurnWaitingHuman; };
    ports.setEndTurnWaitingHuman = function (value) {
        state.endTurnWaitingHuman = value;
    };
    ports.waitForToolExecution = helpers_1.waitForToolExecution;
    ports.boundToolOutput = tools_1.boundToolOutput;
    ports.isManagedResourceTool = helpers_1.isManagedResourceTool;
    ports.tryParseToolArguments = function (input) {
        var parsed = (0, tool_arguments_1.tryParseToolArguments)(input);
        return typeof parsed === "object" &&
            parsed !== null &&
            !Array.isArray(parsed)
            ? parsed
            : {};
    };
    ports.parseToolArguments = tool_arguments_1.parseToolArguments;
    ports.validateToolParameters = tools_1.validateToolParameters;
    return { ensureReady: ensureReady, sessionExecution: sessionExecution };
}
