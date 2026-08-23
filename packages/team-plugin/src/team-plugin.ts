/**
 * The team built-in plugin: the fan-out + review collaboration lane.
 *
 * The team tools are the only built-in tools that combine two other plugin
 * services — `subagents.service` (spawn per task) and `sandbox.service`
 * (one isolated worktree per candidate) — so this plugin declares both as
 * required services and the capability kernel holds it pending until they are
 * provided. A disabled team plugin registers no team tools at all.
 */
import type { Plugin } from "@natalia/plugin";
import {
  SANDBOX_SERVICE,
  SANDBOX_PLUGIN_ID,
  type SandboxService,
} from "@natalia/sandbox-plugin";
import {
  SUBAGENTS_SERVICE,
  SUBAGENTS_PLUGIN_ID,
  type SubagentsService,
} from "@natalia/subagents-plugin";
import { createTeamFanoutTool, createTeamReviewTool } from "./team-tools";

export const TEAM_PLUGIN_ID = "natalia-team";

export function createTeamPlugin(): Plugin {
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
      requires: [SUBAGENTS_SERVICE, SANDBOX_SERVICE],
      optionalRequires: [],
      conflicts: [],
      dependencies: [
        {
          id: SUBAGENTS_PLUGIN_ID,
          spec: "workspace:*",
          optional: false,
          peer: false,
        },
        {
          id: SANDBOX_PLUGIN_ID,
          spec: "workspace:*",
          optional: false,
          peer: false,
        },
      ],
      hooks: {},
      integrationPoints: ["tools"],
    },
    setup(api) {
      api.tools.register(
        createTeamFanoutTool({
          subagents: () => {
            const service =
              api.services.get<SubagentsService>(SUBAGENTS_SERVICE);
            return service?.enabled() ? service : undefined;
          },
          sandboxes: () => api.services.get<SandboxService>(SANDBOX_SERVICE),
        }),
      );
      api.tools.register(
        createTeamReviewTool({
          sandboxes: () => api.services.get<SandboxService>(SANDBOX_SERVICE),
        }),
      );
    },
  };
}
