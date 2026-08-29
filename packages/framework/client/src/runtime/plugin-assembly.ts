/**
 * Default plugin input assembly — runtime/plugin-assembly.ts.
 *
 * Builds the input objects for runtime default plugins from resolved config:
 * skills, terminal, workspace, provider-model, compaction, MCP and local-tools
 * inputs. Reads host state through `RuntimeContext` at call time.
 */
import { resolve } from "node:path";
import { verifyTrust } from "@natalia/config";
import { toolFamilyCapabilityID } from "../capabilities/tool-family-capabilities";
import type { ConfigV3, RuntimeEvent, SessionID } from "@natalia/contracts";
import type { RuntimeContext } from "./context";
import type { RealRuntimeClientOptions } from "./options";
import type { SkillMetadata } from "@natalia/runtime-services";

export function createPluginAssembly(
  ctx: RuntimeContext,
  options: RealRuntimeClientOptions,
) {
  const pluginEnabled = (config: ConfigV3, id: string) =>
    config.plugins.enabled[id] !== false;
  return {
    skillsPluginInput,
    providerModelPluginInput,
    mcpPluginInput,
    localToolsPluginInput,
  };

  function skillsPluginInput(config: ConfigV3) {
    const {
      getWorkspaceRoot,
      getUserSkillRoot,
      getExecutionBySession,
      getActiveExec,
      setActiveSkill,
      extensionEnabled,
    } = ctx.ports;
    const workspaceRoot = getWorkspaceRoot();
    if (!pluginEnabled(config, "natalia-skills") || !extensionEnabled("skills"))
      return undefined;
    return {
      workspaceRoot,
      userRoot: getUserSkillRoot(),
      remoteURLs: config.skills.urls,
      commandSession: {
        active: (sessionID: SessionID) =>
          getExecutionBySession().get(sessionID)?.activeSkill,
        activate: (sessionID: SessionID, skill: SkillMetadata) => {
          const owner = getExecutionBySession().get(sessionID);
          if (!owner) throw new Error(`session not found: ${sessionID}`);
          owner.activeSkill = skill;
          if (owner === getActiveExec()) setActiveSkill(skill);
          owner.context.add({
            id: `skill:${skill.qualifiedName}:${owner.context.journalStatus().journalOffset}`,
            role: "system",
            content: `Active skill ${skill.name}: ${skill.description}\n${skill.body}`,
          });
        },
      },
      onLoad: (
        skill: SkillMetadata,
        output: string,
        context: { sessionID?: string },
      ) => {
        const owner = context.sessionID
          ? getExecutionBySession().get(context.sessionID as SessionID)
          : undefined;
        if (!owner) return;
        owner.activeSkill = skill;
        if (owner === getActiveExec()) setActiveSkill(skill);
        owner.context.add({
          id: `skill:${skill.qualifiedName}:${owner.context.journalStatus().journalOffset}`,
          role: "system",
          content: output,
        });
      },
    };
  }

  function providerModelPluginInput(
    config?: ConfigV3,
  ): import("@natalia/runtime-services").ProviderModelControllerInput {
    const {
      getProvider,
      setProvider,
      getProviderSource,
      setProviderSource,
      providerFromEnvironment,
      getExecutionBySession,
      publishForSession,
      runChatTurnBody,
      wakeNavi,
      providerRunnerInput,
      clientModelCatalog,
      selectRuntimeModel,
    } = ctx.ports;
    return {
      initialize: () => {
        if (!getProvider() && !options.provider) {
          const provider = providerFromEnvironment();
          if (provider) {
            setProvider(provider);
            setProviderSource("environment");
          }
        }
      },
      runnerInput: providerRunnerInput,
      commands: {
        catalog: clientModelCatalog,
        select: async (sessionID, modelID, variant) => {
          const exec = getExecutionBySession().get(sessionID);
          if (!exec) throw new Error(`session not found: ${sessionID}`);
          await selectRuntimeModel(modelID, variant, exec);
        },
      },
      chat: {
        available: (id) =>
          getExecutionBySession().get(id)?.provider !== undefined,
        publish: (id, event) =>
          publishForSession(getExecutionBySession().get(id), event),
        runBody: async (input, signal) => {
          const exec = getExecutionBySession().get(input.sessionID);
          if (!exec)
            throw new Error(
              `no execution state for session ${input.sessionID}`,
            );
          await runChatTurnBody({ ...input, exec }, signal);
        },
        wake: async (id) => {
          const exec = getExecutionBySession().get(id);
          if (exec) await wakeNavi(exec);
        },
      },
    };
  }

  function mcpPluginInput(config: ConfigV3) {
    const { getTsRuntimeConfig, extensionEnabled, publish } = ctx.ports;
    if (!pluginEnabled(config, "natalia-mcp") || !extensionEnabled("mcp"))
      return undefined;
    return {
      servers: () => {
        const runtimeConfig = getTsRuntimeConfig();
        const mode = runtimeConfig?.agentModes?.[runtimeConfig?.defaultAgentMode ?? ""];
        const selected = mode?.mcpServers;
        // An agent mode controls MCP exactly as a whitelist: no selected MCP
        // means this mode exposes none, even if servers are globally enabled.
        if (!selected || !selected.length) return {};
        const all = runtimeConfig?.mcpServers ?? {};
        return Object.fromEntries(
          Object.entries(all).filter(([name]) => selected.includes(name)),
        );
      },
      workspaceRoot: ctx.ports.getWorkspaceRoot(),
      enabled: () => extensionEnabled("mcp"),
      publish,
      identity: config.mcpServers,
    };
  }

  function localToolsPluginInput(config: ConfigV3) {
    const { getWorkspaceRoot, publish, hotReloadToolFamily } = ctx.ports;
    const workspaceRoot = getWorkspaceRoot();
    if (
      options.tools ||
      !config.tools.paths.length ||
      !pluginEnabled(config, "natalia-local-tools")
    )
      return undefined;
    return {
      roots: config.tools.paths.map((path) => resolve(workspaceRoot, path)),
      onError: (id: string, error: unknown) =>
        publish({
          type: "diagnostic",
          level: "warning",
          owner: "natalia-tools",
          message: `tool family ${id} failed to load: ${
            error instanceof Error ? error.message : String(error)
          }`,
        }),
      trust: {
        workspaceRoot,
        verify: (key: string, entryPath: string) =>
          verifyTrust(workspaceRoot, key, entryPath),
      },
      onChange: async (familyID: string, entryPath: string) => {
        const verified = await verifyTrust(
          workspaceRoot,
          resolve(entryPath, ".."),
          entryPath,
        );
        if (verified.expected && !verified.verified) {
          publish({
            type: "diagnostic",
            level: "warning",
            owner: toolFamilyCapabilityID(familyID),
            message: `tool family ${familyID} changed on disk without a promotion — refusing to hot reload`,
          });
          return;
        }
        try {
          await hotReloadToolFamily(familyID);
          publish({
            type: "diagnostic",
            level: "info",
            owner: toolFamilyCapabilityID(familyID),
            message: `tool family ${familyID} hot-reloaded`,
          });
        } catch (error) {
          publish({
            type: "diagnostic",
            level: "warning",
            owner: toolFamilyCapabilityID(familyID),
            message: `tool family ${familyID} hot reload failed: ${
              error instanceof Error ? error.message : String(error)
            }`,
          });
        }
      },
    };
  }
}
