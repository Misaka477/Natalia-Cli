/**
 * The sandbox controller built-in plugin.
 *
 * Previously a visibility-only record; the controller now lives on the unified
 * plugin lifecycle. The plugin constructs it in `setup()` and provides it as the
 * `sandbox.controller` service, so a disabled or absent plugin constructs no
 * sandbox manager at all.
 */
import type { Plugin } from "@natalia/plugin";
import { createSandboxController } from "./sandbox-controller";
import type { SandboxBackend } from "@natalia/contracts";

export type { SandboxController } from "./sandbox-controller";

export const SANDBOX_PLUGIN_ID = "natalia-sandbox";
export const SANDBOX_CONTROLLER_SERVICE = "sandbox.controller";

export function createSandboxControllerPlugin(input: {
  workspaceRoot: string;
  backend?(): SandboxBackend | undefined;
}): Plugin {
  let controller: ReturnType<typeof createSandboxController> | undefined;
  return {
    manifest: {
      apiVersion: 2,
      id: SANDBOX_PLUGIN_ID,
      version: "1.0.0",
      name: "Sandbox",
      description: "Isolated workspaces for subagents and experiments.",
      entry: "natalia:sandbox",
      scope: "workspace",
      provides: [SANDBOX_CONTROLLER_SERVICE],
      requires: [],
      optionalRequires: [],
      conflicts: [],
      dependencies: [],
      hooks: {},
      integrationPoints: ["services"],
    },
    setup(api) {
      controller = createSandboxController({
        workspaceRoot: input.workspaceRoot,
        backend: input.backend,
      });
      api.services.provide(SANDBOX_CONTROLLER_SERVICE, controller);
    },
    dispose() {
      controller = undefined;
    },
  };
}
