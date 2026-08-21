import type { Plugin } from "@natalia/plugin";
import {
  createProviderModelController,
  type ProviderModelControllerInput,
} from "../provider-model-controller";

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
      requires: [],
      optionalRequires: [],
      conflicts: [],
      dependencies: [],
      hooks: {},
      integrationPoints: ["services"],
    },
    setup(api) {
      controller = createProviderModelController(input);
      api.services.provide(PROVIDER_MODEL_CONTROLLER_SERVICE, controller);
    },
    async dispose() {
      await controller?.dispose();
      controller = undefined;
    },
  };
}
