/**
 * Default plugin input assembly — runtime/plugin-assembly.ts.
 *
 * Builds the input objects for runtime default plugins from resolved config:
 * skills, checkpoint, sandbox, terminal, workspace, provider-model, compaction,
 * MCP and local-tools inputs. Reads host state through `RuntimeContext` at call
 * time.
 */
import { resolve } from "node:path";
import { findWorkspaceFiles } from "@natalia/platform";
import { verifyTrust } from "@natalia/config";
import { toolFamilyCapabilityID } from "../capabilities/tool-family-capabilities";
import {
  ATTACHMENT_PLUGIN_ID,
  CHECKPOINT_PLUGIN_ID,
  COMPACTION_PLUGIN_ID,
  CONTEXT_LEDGER_PLUGIN_ID,
  LOCAL_TOOLS_PLUGIN_ID,
  MCP_PLUGIN_ID,
  PROVIDER_MODEL_PLUGIN_ID,
  RETRY_PLUGIN_ID,
  SANDBOX_CONTROLLER_PLUGIN_ID,
  SKILLS_PLUGIN_ID,
  TERMINAL_CONTROLLER_PLUGIN_ID,
  WORKSPACE_PLUGIN_ID,
} from "@natalia/builtin-plugins";
import type { ConfigV3, RuntimeEvent, SessionID } from "@natalia/contracts";
import type { RuntimeContext } from "./context";
import type { RealRuntimeClientOptions } from "./options";
import type { SkillMetadata } from "@natalia/runtime-services";

export function createPluginAssembly(
  ctx: RuntimeContext,
  options: RealRuntimeClientOptions,
) {
  return {
    skillsPluginInput,
    checkpointPluginInput,
    sandboxPluginInput,
    terminalPluginInput,
    workspacePluginInput,
    providerModelPluginInput,
    compactionPluginInput,
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
    if (
      config.plugins.enabled[SKILLS_PLUGIN_ID] === false ||
      !extensionEnabled("skills")
    )
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

  function checkpointPluginInput(config: ConfigV3) {
    return config.plugins.enabled[CHECKPOINT_PLUGIN_ID] === false
      ? undefined
      : { workspaceRoot: ctx.ports.getWorkspaceRoot() };
  }

  function sandboxPluginInput(config: ConfigV3) {
    return config.plugins.enabled[SANDBOX_CONTROLLER_PLUGIN_ID] === false
      ? undefined
      : {
          workspaceRoot: ctx.ports.getWorkspaceRoot(),
          backend: () => ctx.ports.getTsRuntimeConfig()?.sandbox.backend,
          identity: config.sandbox,
        };
  }

  function terminalPluginInput(config: ConfigV3) {
    const {
      getWorkspaceRoot,
      getExecutionBySession,
      publishForSession,
      getPerformanceTrace,
      getNativeRuntimeID,
      getUserRuntimeHome,
      getTsRuntimeConfig,
    } = ctx.ports;
    return config.plugins.enabled[TERMINAL_CONTROLLER_PLUGIN_ID] === false
      ? undefined
      : {
          workspaceRoot: getWorkspaceRoot(),
          publish: (event: RuntimeEvent) =>
            publishForSession(
              event.sessionID
                ? getExecutionBySession().get(event.sessionID as SessionID)
                : undefined,
              event,
            ),
          onPerformance: (name: string, durationMs: number) =>
            getPerformanceTrace().mark(name, durationMs),
          runtimeID: () => getNativeRuntimeID(),
          userRuntimeHome: () => getUserRuntimeHome(),
          windowMode: () =>
            getTsRuntimeConfig()?.runtime.terminal.windowMode ?? "auto",
          external: options.nativeTerminal,
          identity: config.runtime.terminal.windowMode,
        };
  }

  function workspacePluginInput(config: ConfigV3) {
    const { getWorkspaceRoot } = ctx.ports;
    const workspaceRoot = getWorkspaceRoot();
    return config.plugins.enabled[WORKSPACE_PLUGIN_ID] === false
      ? undefined
      : {
          workspaceRoot,
          listPaths: async () =>
            (
              await findWorkspaceFiles({
                workspaceRoot,
                limit: 1000,
              })
            )
              .filter((entry) => entry.type === "file")
              .map((entry) => entry.path),
        };
  }

  function providerModelPluginInput(config: ConfigV3): {
    enabled: boolean;
    controller: import("@natalia/runtime-services").ProviderModelControllerInput;
  } {
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
    const enabled =
      config.plugins.enabled[ATTACHMENT_PLUGIN_ID] !== false &&
      config.plugins.enabled[RETRY_PLUGIN_ID] !== false &&
      config.plugins.enabled[COMPACTION_PLUGIN_ID] !== false &&
      config.plugins.enabled[PROVIDER_MODEL_PLUGIN_ID] !== false;
    return {
      enabled,
      controller: {
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
      },
    };
  }

  function compactionPluginInput(config: ConfigV3) {
    return {
      enabled:
        config.plugins.enabled[RETRY_PLUGIN_ID] !== false &&
        config.plugins.enabled[CONTEXT_LEDGER_PLUGIN_ID] !== false &&
        config.plugins.enabled[COMPACTION_PLUGIN_ID] !== false,
    };
  }

  function mcpPluginInput(config: ConfigV3) {
    const { getTsRuntimeConfig, extensionEnabled, publish } = ctx.ports;
    if (
      config.plugins.enabled[MCP_PLUGIN_ID] === false ||
      !extensionEnabled("mcp")
    )
      return undefined;
    return {
      servers: () => getTsRuntimeConfig()?.mcpServers ?? {},
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
      config.plugins.enabled[LOCAL_TOOLS_PLUGIN_ID] === false
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
