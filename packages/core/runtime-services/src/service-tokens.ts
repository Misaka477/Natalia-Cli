/**
 * Service tokens for the contracts that cross the plugin boundary.
 *
 * These services are provided by official plugins and consumed by the runtime
 * tool pipeline (terminal controller, skills registry, MCP service, …). Their
 * tokens live here, beside the contract types in `./services`, because the
 * engine must stay free of static imports into concrete plugin packages: a
 * token is the shared vocabulary both sides already import, and the wire name
 * a plugin's manifest `provides` and `api.services.provide` speak is
 * `token.id` — one spelling, no mapping table. Engine-internal services keep
 * their tokens in their owning mechanism packages instead (see
 * `collaborationWaiter`).
 *
 * When a contract type relocates to its owning package, its token moves with
 * it; until then this file is the single home for the boundary wires.
 */
import type { ToolFamily } from "@natalia/tools";
import type {
  McpService,
  SkillService,
  TeamBehaviorService,
  TerminalController,
} from "./services";
import { defineService } from "./service-token";

/** Swaps one local tool family; resolved as the `localTools.reload` service. */
export type LocalToolsReload = (familyID: string) => Promise<ToolFamily>;

/** The skills registry the runtime reads discovered skills through. */
export const skillService = defineService<SkillService>("skills.service", {
  scope: "workspace",
  capability: "services",
});

/** The team behavior surface collaboration tools consult. */
export const teamBehavior = defineService<TeamBehaviorService>(
  "team.behavior",
  { scope: "workspace", capability: "services" },
);

/** The reload hook the local-tools plugin exposes for config changes. */
export const localToolsReload = defineService<LocalToolsReload>(
  "localTools.reload",
  { scope: "workspace", capability: "services" },
);

/** The MCP hub: server registry, connection lifecycle, tool surface. */
export const mcpService = defineService<McpService>("mcp.service", {
  scope: "workspace",
  capability: "services",
});

/** The native terminal controller the tool pipeline drives panes through. */
export const terminalController = defineService<TerminalController>(
  "terminal.controller",
  { scope: "workspace", capability: "services" },
);
