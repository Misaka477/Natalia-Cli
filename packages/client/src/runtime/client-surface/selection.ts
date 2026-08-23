import type { RuntimeServiceClient } from "@natalia/runtime-services";
import { discoverProviderModels, updateConfigAtScope } from "@natalia/config";
import type { RuntimeContext } from "../context";
import type { ClientSurfaceOptions } from "./types";
import { isRuntimeReasoningEffort } from "./helpers";
type Surface = Pick<
  RuntimeServiceClient,
  | "agents"
  | "selectAgent"
  | "modelCatalog"
  | "modelSelection"
  | "selectModel"
  | "reasoningEffort"
  | "setReasoningEffort"
  | "skills"
  | "agentCreate"
  | "agentUpdate"
  | "agentDelete"
  | "providerDiscover"
  | "providerAdd"
  | "providerRemove"
>;
export function createSelectionSurface(
  ctx: RuntimeContext,
  options: ClientSurfaceOptions,
): Surface {
  return {
    selectAgent(name) {
      const agent = ctx.ports.getAgentRegistry()?.select(name);
      if (name && !agent) {
        ctx.ports.publish({
          type: "diagnostic",
          level: "error",
          message: `agent not found: ${name}`,
        });
        // A diagnostic is not an answer to the caller: a remote UI used to be
        // told the agent was selected and then render the wrong one.
        return { outcome: "rejected", reason: `agent not found: ${name}` };
      }
      const exec = ctx.ports.getActiveExec();
      if (exec?.activeAbort) {
        ctx.ports.setPendingAgent(agent);
        exec.pendingAgent = agent;
        ctx.ports.publish({
          type: "agent.selection",
          name: agent?.name,
          pending: true,
        });
        // Deferred, not applied: switching agents mid-turn would change the rules
        // the turn started under.
        return {
          outcome: "pending",
          selected: agent?.name,
          reason: "a turn is running; the selection applies when it ends",
        };
      }
      ctx.ports.setSelectedAgent(agent);
      if (exec) exec.selectedAgent = agent;
      ctx.ports.applyAgentPolicy();
      ctx.ports.applyAgentProvider();
      ctx.ports.publish({
        type: "agent.selection",
        name: agent?.name,
        pending: false,
      });
      return { outcome: "applied", selected: agent?.name };
    },
    async agents() {
      await ctx.ports.getReady();
      return (ctx.ports.getAgentRegistry()?.list() ?? []).map((agent) => ({
        name: agent.name,
        description: agent.description,
        mode: agent.mode,
        hidden: agent.hidden,
        color: agent.color,
        model: agent.model,
        variant: agent.variant,
        maxSteps: agent.maxSteps,
        allowedTools: agent.allowedTools,
        excludedTools: agent.excludedTools,
        mcpServers: agent.mcpServers,
        permissions: agent.permissions,
      }));
    },
    async modelCatalog() {
      return await ctx.ports.clientModelCatalog();
    },
    async modelSelection() {
      await ctx.ports.getReady();
      return {
        modelID: ctx.ports.selectedModelRefKey(),
        variant:
          ctx.ports.getSelectedAgent()?.variant ??
          ctx.ports.getSelectedModel()?.variant,
      };
    },
    async selectModel(modelID, variant) {
      await ctx.ports.selectRuntimeModel(modelID, variant);
    },
    async reasoningEffort() {
      await ctx.ports.getReady();
      return ctx.ports.getActiveExec()?.reasoningEffort;
    },
    async setReasoningEffort(effort) {
      await ctx.ports.getReady();
      if (effort && !isRuntimeReasoningEffort(effort))
        throw new Error(`unsupported reasoning effort: ${effort}`);
      const exec = ctx.ports.getActiveExec();
      if (!exec) throw new Error("session execution is unavailable");
      exec.reasoningEffort = effort;
      ctx.ports.applyAgentProvider();
    },
    async skills() {
      await ctx.ports.getReady();
      return ctx.ports.skillsList().map((skill) => ({
        name: skill.name,
        qualifiedName: skill.qualifiedName,
        description: skill.description,
        source: skill.source,
        requireApproval: skill.requireApproval,
        sandboxRequired: skill.sandboxRequired,
      }));
    },
    async agentCreate(input) {
      await ctx.ports.getReady();
      const config = ctx.ports.getTsRuntimeConfig();
      if (config && config.agents[input.name])
        return {
          created: false,
          reason: `agent already exists: ${input.name}`,
        };
      await updateConfigAtScope(
        ctx.ports.getWorkspaceRoot(),
        {
          agents: { [input.name]: input.config },
        } as never,
        "project",
        { globalPath: options.globalConfigPath },
      );
      await ctx.ports.applyConfigFromDisk();
      return { created: true };
    },
    async agentUpdate(input) {
      await ctx.ports.getReady();
      const config = ctx.ports.getTsRuntimeConfig();
      if (!config || !config.agents[input.name])
        throw new Error(`agent not found: ${input.name}`);
      await updateConfigAtScope(
        ctx.ports.getWorkspaceRoot(),
        {
          agents: { [input.name]: input.config },
        } as never,
        "project",
        { globalPath: options.globalConfigPath },
      );
      await ctx.ports.applyConfigFromDisk();
      return { updated: true };
    },
    async agentDelete(name) {
      await ctx.ports.getReady();
      const config = ctx.ports.getTsRuntimeConfig();
      if (config && config.defaultAgent === name)
        return {
          deleted: false,
          reason: `agent is the default agent: ${name}`,
        };
      await updateConfigAtScope(
        ctx.ports.getWorkspaceRoot(),
        {
          agents: { [name]: undefined },
        } as never,
        "project",
        { globalPath: options.globalConfigPath },
      );
      await ctx.ports.applyConfigFromDisk();
      return { deleted: true };
    },
    async providerDiscover(input) {
      await ctx.ports.getReady();
      const models = await discoverProviderModels(
        input.type,
        input.baseURL,
        input.apiKey,
      );
      return { models };
    },
    async providerAdd(input) {
      await ctx.ports.getReady();
      await updateConfigAtScope(
        ctx.ports.getWorkspaceRoot(),
        {
          providers: {
            [input.name]: {
              name: input.name,
              driver: input.type,
              enabled: true,
              connection: {
                baseURL: input.baseURL || undefined,
                apiKey: input.apiKey,
              },
            },
          },
        } as never,
        "global",
        { globalPath: options.globalConfigPath },
      );
      await ctx.ports.applyConfigFromDisk();
      return { saved: true };
    },
    async providerRemove(name) {
      await ctx.ports.getReady();
      const config = ctx.ports.getTsRuntimeConfig();
      const referencedModel = config
        ? (Object.keys(config.catalog?.providers?.[name]?.models ?? {})[0] ??
          Object.keys(config.modelOverrides ?? {})
            .filter((key) => key.startsWith(`${name}/`))
            .map((key) => key.slice(name.length + 1))[0])
        : undefined;
      if (referencedModel)
        return {
          removed: false,
          reason: `provider is referenced by model: ${referencedModel}`,
        };
      await updateConfigAtScope(
        ctx.ports.getWorkspaceRoot(),
        {
          providers: { [name]: undefined },
        } as never,
        "global",
        { globalPath: options.globalConfigPath },
      );
      await ctx.ports.applyConfigFromDisk();
      return { removed: true };
    },
  };
}
