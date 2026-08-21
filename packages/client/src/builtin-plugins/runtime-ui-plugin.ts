import type { Plugin } from "@natalia/plugin";
import {
  createStatusSnapshotController,
  type StatusSnapshotController,
} from "../status-controller";

export const RUNTIME_UI_PLUGIN_ID = "natalia-runtime-ui";
export const STATUS_SNAPSHOT_CONTROLLER_SERVICE = "status.snapshot.controller";

export function createRuntimeUiPlugin(
  input: Parameters<typeof createStatusSnapshotController>[0],
): Plugin {
  let controller: StatusSnapshotController | undefined;
  return {
    manifest: {
      apiVersion: 2,
      id: RUNTIME_UI_PLUGIN_ID,
      version: "1.0.0",
      name: "Runtime UI",
      description: "Shared runtime status projection for interface adapters.",
      entry: "natalia:runtime-ui",
      scope: "workspace",
      provides: [STATUS_SNAPSHOT_CONTROLLER_SERVICE],
      requires: [],
      optionalRequires: [],
      conflicts: [],
      dependencies: [],
      hooks: {},
      integrationPoints: ["services"],
    },
    setup(api) {
      controller = createStatusSnapshotController(input);
      api.services.provide(STATUS_SNAPSHOT_CONTROLLER_SERVICE, controller);
    },
    dispose() {
      controller?.dispose();
      controller = undefined;
    },
  };
}
