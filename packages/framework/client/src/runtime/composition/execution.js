"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.wireExecution = wireExecution;
var event_sink_1 = require("../event-sink");
var provider_selection_1 = require("../provider-selection");
var turn_runner_1 = require("../turn-runner");
var execute_calls_1 = require("../tool-execution/execute-calls");
var execute_one_1 = require("../tool-execution/execute-one");
var checkpoint_runtime_1 = require("../checkpoint-runtime");
var title_generation_1 = require("../title-generation");
var session_admission_1 = require("../session-admission");
var commands_1 = require("../commands");
function wireExecution(ctx, options) {
    var state = ctx.state, ports = ctx.ports;
    var eventSink = (0, event_sink_1.createEventSink)(ctx, options);
    ports.publish = eventSink.publish;
    ports.publishForSession = eventSink.publishForSession;
    var providerSelection = (0, provider_selection_1.createProviderSelection)(ctx, options);
    ports.clientModelCatalog = providerSelection.clientModelCatalog;
    ports.effectiveMaxSteps = providerSelection.effectiveMaxSteps;
    ports.modelCapabilitiesForExecution =
        providerSelection.modelCapabilitiesForExecution;
    ports.providerRunnerInput = (0, turn_runner_1.createTurnRunner)(ctx, options).providerRunnerInput;
    ports.selectRuntimeModel = providerSelection.selectRuntimeModel;
    ports.applyAgentProvider = providerSelection.applyAgentProvider;
    ports.refreshExecutionContextConfig =
        providerSelection.refreshExecutionContextConfig;
    ports.currentModelImageInput = providerSelection.currentModelImageInput;
    ports.mediaTypeForImage = providerSelection.mediaTypeForImage;
    ports.redactToolOutputEnabled = providerSelection.redactToolOutputEnabled;
    ports.resolveContextStatusConfig =
        providerSelection.resolveContextStatusConfig;
    ports.modelRefKeyForSelection = providerSelection.modelRefKeyForSelection;
    ports.selectedModelRefKey = providerSelection.selectedModelRefKey;
    var executeCalls = (0, execute_calls_1.createExecuteCalls)(ctx, options);
    ports.executeToolCalls = executeCalls.executeToolCalls;
    ports.toolResultContent = executeCalls.toolResultContent;
    ports.checkConstitutionForTool = executeCalls.checkConstitutionForTool;
    ports.executeOneTool = (0, execute_one_1.createExecuteOne)(ctx, options).executeOneTool;
    var checkpoint = (0, checkpoint_runtime_1.createCheckpointRuntime)(ctx);
    ports.getCheckpointRuntime = function () { return checkpoint; };
    ports.initializeCheckpointController =
        checkpoint.initializeCheckpointController;
    var title = (0, title_generation_1.createTitleGeneration)(ctx);
    ports.cancelTitleGeneration = title.cancelTitleGeneration;
    ports.rememberTitleInput = title.rememberTitleInput;
    ports.submitInput = (0, session_admission_1.createSessionAdmission)(ctx, options).submitInput;
    var commands = (0, commands_1.createCommands)(ctx);
    ports.commandCatalogEntries = commands.commandCatalogEntries;
    ports.isPendingInteractiveRequest = commands.isPendingInteractiveRequest;
    return { providerSelection: providerSelection, checkpoint: checkpoint, title: title, commands: commands };
}
