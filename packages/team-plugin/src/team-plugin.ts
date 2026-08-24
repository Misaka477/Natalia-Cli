/**
 * The team built-in plugin: the fan-out + review collaboration lane.
 *
 * The team tools are the only built-in tools that combine two other plugin
 * services — `subagents.service` (spawn per task) and `sandbox.service`
 * (one isolated worktree per candidate) — so this plugin declares both as
 * required services and the capability kernel holds it pending until they are
 * provided. A disabled team plugin registers no team tools at all.
 */
import type { Plugin, PluginManifest } from "@natalia/plugin";
import {
  SANDBOX_SERVICE,
  SUBAGENTS_SERVICE,
  TEAM_BEHAVIOR_SERVICE,
  type SandboxService,
  type SubagentsService,
} from "@natalia/runtime-services";
import { createTeamFanoutTool, createTeamReviewTool } from "./team-tools";
import {
  sandboxedSubagentSystemPrompt,
  TEAM_MODE_DIRECTIVE,
} from "./agent-team-prompts";

export const TEAM_PLUGIN_ID = "natalia-team";

export const TEAM_PLUGIN_MANIFEST: PluginManifest = {
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
  dependencies: [],
  hooks: {},
  integrationPoints: ["tools", "services"],
};

export function createTeamPlugin(): Plugin {
  return {
    manifest: TEAM_PLUGIN_MANIFEST,
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
