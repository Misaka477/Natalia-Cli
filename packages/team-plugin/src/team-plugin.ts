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
  SUBAGENTS_SERVICE,
  TEAM_BEHAVIOR_SERVICE,
  type SandboxService,
  type SubagentsService,
} from "@natalia/runtime-services";
import { SANDBOX_PLUGIN_ID } from "@natalia/sandbox-plugin";
import { SUBAGENTS_PLUGIN_ID } from "@natalia/subagents-plugin";
import { createTeamFanoutTool, createTeamReviewTool } from "./team-tools";
import {
  sandboxedSubagentSystemPrompt,
  TEAM_MODE_DIRECTIVE,
} from "./agent-team-prompts";

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
      provides: [TEAM_BEHAVIOR_SERVICE],
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
      integrationPoints: ["tools", "services"],
    },
    setup(api) {
      api.services.provide(TEAM_BEHAVIOR_SERVICE, {
        directive: () => TEAM_MODE_DIRECTIVE,
        sandboxedSubagentSystemPrompt,
      });
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
