/**
 * The team built-in plugin: the fan-out + review collaboration lane.
 *
 * The team tools are the only built-in tools that combine two other plugin
 * services — `subagents.controller` (spawn per task) and `sandbox.controller`
 * (one isolated worktree per candidate) — so this plugin declares both as
 * required services and the capability kernel holds it pending until they are
 * provided. A disabled team plugin registers no team tools at all.
 */
import type { Plugin } from "@natalia/plugin";
import type { SubagentsController } from "@natalia/subagents-plugin";
import type { SandboxController } from "@natalia/sandbox-plugin";
import { SUBAGENTS_CONTROLLER_SERVICE } from "@natalia/subagents-plugin";
import { SANDBOX_CONTROLLER_SERVICE } from "@natalia/sandbox-plugin";
import { createTeamFanoutTool, createTeamReviewTool } from "../team-tools";

export const TEAM_PLUGIN_ID = "natalia-team";

export function createTeamPlugin(input: {
  /** The host's extension gate: plugins or skills enabled. */
  enabled: boolean;
}): Plugin {
  return {
    manifest: {
      apiVersion: 2,
      id: TEAM_PLUGIN_ID,
      version: "1.0.0",
      name: "Team",
      description:
        "Parallel fan-out of sandboxed subagents and the lead reviewer's merge.",
      entry: "natalia:team",
      scope: "workspace",
      provides: [],
      requires: [SUBAGENTS_CONTROLLER_SERVICE, SANDBOX_CONTROLLER_SERVICE],
      optionalRequires: [],
      conflicts: [],
      dependencies: [],
      hooks: {},
      integrationPoints: ["tools"],
    },
    setup(api) {
      api.tools.register(
        createTeamFanoutTool({
          subagents: () => {
            const controller = api.services.get<SubagentsController>(
              SUBAGENTS_CONTROLLER_SERVICE,
            );
            return controller?.enabled() ? controller.get() : undefined;
          },
          sandboxes: () =>
            api.services
              .get<SandboxController>(SANDBOX_CONTROLLER_SERVICE)
              ?.get(),
        }),
      );
      api.tools.register(
        createTeamReviewTool({
          sandboxes: () =>
            api.services
              .get<SandboxController>(SANDBOX_CONTROLLER_SERVICE)
              ?.get(),
        }),
      );
    },
  };
}
