import type { Plugin } from "@natalia/plugin";
import {
  createProviderModelController,
  type ProviderModelControllerInput,
} from "../provider-model-controller";
import { RETRY_PLUGIN_ID, RETRY_SERVICE } from "./retry-plugin";
import { ATTACHMENT_PLUGIN_ID, ATTACHMENT_SERVICE } from "./attachment-plugin";

export const PROVIDER_MODEL_PLUGIN_ID = "natalia-provider-model";
export const PROVIDER_MODEL_CONTROLLER_SERVICE = "provider-model.controller";

export function createProviderModelPlugin(
  input: ProviderModelControllerInput,
): Plugin {
  let controller: ReturnType<typeof createProviderModelController> | undefined;
  return {
    manifest: {
      apiVersion: 2,
      id: PROVIDER_MODEL_PLUGIN_ID,
      version: "1.0.0",
      name: "Provider Model",
      description:
        "Provider/model selection, the main agent loop and Live Work Chat lifecycle.",
      entry: "natalia:provider-model",
      scope: "workspace",
      provides: [PROVIDER_MODEL_CONTROLLER_SERVICE],
      requires: [RETRY_SERVICE, ATTACHMENT_SERVICE],
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
      ],
      hooks: {},
      integrationPoints: ["services"],
    },
    setup(api) {
      if (!api.services.get(RETRY_SERVICE))
        throw new Error("retry service unavailable (natalia-retry)");
      if (!api.services.get(ATTACHMENT_SERVICE))
        throw new Error("attachment service unavailable (natalia-attachment)");
      controller = createProviderModelController(input);
      api.services.provide(PROVIDER_MODEL_CONTROLLER_SERVICE, controller);
    },
    async dispose() {
      await controller?.dispose();
      controller = undefined;
    },
  };
}
