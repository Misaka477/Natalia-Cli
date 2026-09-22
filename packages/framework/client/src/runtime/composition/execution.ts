import { createEventSink } from "../event-sink";
import { createProviderSelection } from "../provider-selection";
import { createTurnRunner } from "../turn-runner";
import { createExecuteCalls } from "../tool-execution/execute-calls";
import { createExecuteOne } from "../tool-execution/execute-one";
import { createCheckpointRuntime } from "../checkpoint-runtime";
import { createTitleGeneration } from "../title-generation";
import { createSessionAdmission } from "../session-admission";
import { createCommands } from "../commands";
import type { RuntimeContext } from "@anthelia/substrate";
import type { RealRuntimeClientOptions } from "@anthelia/substrate";

export function wireExecution(
  ctx: RuntimeContext,
  options: RealRuntimeClientOptions,
) {
  const { state, ports } = ctx;
  const eventSink = createEventSink(ctx, options);
  ports.publish = eventSink.publish;
  ports.publishForSession = eventSink.publishForSession;
  const providerSelection = createProviderSelection(ctx, options);
  ports.clientModelCatalog = providerSelection.clientModelCatalog;
  ports.effectiveMaxSteps = providerSelection.effectiveMaxSteps;
  ports.modelCapabilitiesForExecution =
    providerSelection.modelCapabilitiesForExecution;
  ports.providerRunnerInput = createTurnRunner(
    ctx,
    options,
  ).providerRunnerInput;
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

  const executeCalls = createExecuteCalls(ctx, options);
  ports.executeToolCalls = executeCalls.executeToolCalls;
  ports.toolResultContent = executeCalls.toolResultContent;
  ports.checkConstitutionForTool = executeCalls.checkConstitutionForTool;
  ports.executeOneTool = createExecuteOne(ctx, options).executeOneTool;
  const checkpoint = createCheckpointRuntime(ctx);
  ports.getCheckpointRuntime = () => checkpoint;
  ports.initializeCheckpointController =
    checkpoint.initializeCheckpointController;
  const title = createTitleGeneration(ctx);
  ports.cancelTitleGeneration = title.cancelTitleGeneration;
  ports.rememberTitleInput = title.rememberTitleInput;
  ports.submitInput = createSessionAdmission(ctx, options).submitInput;
  const commands = createCommands(ctx);
  ports.commandCatalogEntries = commands.commandCatalogEntries;
  ports.isPendingInteractiveRequest = commands.isPendingInteractiveRequest;
  return { providerSelection, checkpoint, title, commands };
}
