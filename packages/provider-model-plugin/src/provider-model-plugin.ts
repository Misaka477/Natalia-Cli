import type { Plugin, PluginManifest } from "@natalia/plugin";
import { createProviderModelController } from "./provider-model-controller";
import { RETRY_PLUGIN_ID } from "@natalia/retry-plugin";
import { ATTACHMENT_PLUGIN_ID } from "@natalia/attachment-plugin";
import { COMPACTION_PLUGIN_ID } from "@natalia/compaction-plugin";
import {
  ATTACHMENT_SERVICE,
  COMPACTION_SERVICE,
  PROVIDER_MODEL_CONTROLLER_SERVICE,
  RETRY_SERVICE,
  type ProviderModelController,
  type ProviderModelControllerInput,
} from "@natalia/runtime-services";

export const PROVIDER_MODEL_PLUGIN_ID = "natalia-provider-model";
export const PROVIDER_MODEL_PLUGIN_MANIFEST: PluginManifest = {
  apiVersion: 2,
  id: PROVIDER_MODEL_PLUGIN_ID,
  version: "1.0.0",
  name: "Provider Model",
  description:
    "Provider/model selection, the main agent loop and Live Work Chat lifecycle.",
  entry: "natalia:provider-model",
  scope: "workspace",
  provides: [PROVIDER_MODEL_CONTROLLER_SERVICE],
  requires: [RETRY_SERVICE, ATTACHMENT_SERVICE, COMPACTION_SERVICE],
  optionalRequires: [],
  conflicts: [],
  dependencies: [
    {
      id: RETRY_PLUGIN_ID,
      spec: ">=1.0.0",
      optional: false,
      peer: false,
    },
    {
      id: ATTACHMENT_PLUGIN_ID,
      spec: ">=1.0.0",
      optional: false,
      peer: false,
    },
    {
      id: COMPACTION_PLUGIN_ID,
      spec: ">=1.0.0",
      optional: false,
      peer: false,
    },
  ],
  hooks: {},
  integrationPoints: ["services", "commands"],
};
export function createProviderModelPlugin(
  input: ProviderModelControllerInput,
): Plugin {
  let controller: ProviderModelController | undefined;
  return {
    manifest: PROVIDER_MODEL_PLUGIN_MANIFEST,
    setup(api) {
      if (!api.services.get(RETRY_SERVICE))
        throw new Error("retry service unavailable (natalia-retry)");
      if (!api.services.get(ATTACHMENT_SERVICE))
        throw new Error("attachment service unavailable (natalia-attachment)");
      if (!api.services.get(COMPACTION_SERVICE))
        throw new Error("compaction service unavailable (natalia-compaction)");
      controller = createProviderModelController(input);
      api.services.provide(PROVIDER_MODEL_CONTROLLER_SERVICE, controller);
      api.commands.register({
        name: "models",
        title: "List models",
        async run() {
          const models = await input.commands.catalog();
          return models.length
            ? models
                .map(
                  (model) =>
                    `${model.id}: ${model.name} @ ${model.provider}${model.variants.length ? ` (${model.variants.join(", ")})` : ""}`,
                )
                .join("\n")
            : "no selectable models configured";
        },
      });
      api.commands.register({
        name: "model",
        title: "Select model",
        async run(invocation) {
          const [modelID, variant] = invocation?.args ?? [];
          if (!modelID) throw new Error("model ID is required");
          if (!invocation?.sessionID)
            throw new Error("model selection requires a session");
          await input.commands.select(
            invocation.sessionID as import("@natalia/contracts").SessionID,
            modelID,
            variant,
          );
          return `selected model ${modelID}${variant ? ` (${variant})` : ""}`;
        },
      });
    },
    async dispose() {
      await controller?.dispose();
      controller = undefined;
    },
  };
}
