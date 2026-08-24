import type { Plugin, PluginCommandInvocation } from "@natalia/plugin";
import type { SessionID } from "@natalia/contracts";
import {
  createStatusSnapshotController,
  type RuntimeUiPluginInput,
} from "./status-controller";
import {
  STATUS_SNAPSHOT_CONTROLLER_SERVICE,
  type StatusSnapshotController,
} from "@natalia/runtime-services";

export const RUNTIME_UI_PLUGIN_ID = "natalia-runtime-ui";
export function createRuntimeUiPlugin(input: RuntimeUiPluginInput): Plugin {
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
      integrationPoints: ["services", "commands"],
    },
    setup(api) {
      controller = createStatusSnapshotController(input);
      api.services.provide(STATUS_SNAPSHOT_CONTROLLER_SERVICE, controller);
      if (input.commands) {
        const session = async (invocation?: PluginCommandInvocation) => {
          if (!invocation?.sessionID)
            throw new Error("runtime UI command requires a session");
          return await input.commands!.session(
            invocation.sessionID as SessionID,
          );
        };
        api.commands.register({
          name: "help",
          title: "Help",
          run: () =>
            [
              "Natalia TS7 agent shell commands:",
              ...input
                .commands!.list()
                .map(
                  (command) =>
                    `/${command.name}${command.acceptsArguments ? " <args>" : ""} - ${command.description ?? command.title}`,
                ),
              "Use Ctrl-C to cancel an active turn and Ctrl-D on an empty composer to exit.",
            ].join("\n"),
        });
        api.commands.register({
          name: "doctor",
          title: "Doctor",
          async run(invocation) {
            const state = await session(invocation);
            input.commands!.publish(state.sessionID, state.snapshot);
            const configured = state.provider
              ? `${state.provider.provider}/${state.provider.model} (${state.providerSource})`
              : "not configured";
            return [
              "Natalia TS7 runtime doctor",
              `provider: ${configured}`,
              `workspace: ${state.workspaceRoot}`,
              `session: ${state.sessionID}`,
              `native tools: ${state.toolsSize}`,
              `agent: ${state.selectedAgentName ?? "default"}`,
              `skills: ${state.skillsCount}`,
              state.provider
                ? "provider check: configured; submit a short prompt to verify live streaming"
                : "provider check: set NATALIA_OPENAI_API_KEY (or OPENAI_API_KEY), or configure a provider in .natalia/config.json, then restart the TUI",
              "safety: write/shell/process actions require approval unless permissionMode=auto is explicitly configured by a caller",
              input.commands!.egressAdvisory,
            ].join("\n");
          },
        });
        api.commands.register({
          name: "status",
          title: "Status",
          async run(invocation) {
            const state = await session(invocation);
            input.commands!.publish(state.sessionID, state.snapshot);
            return [
              `provider: ${state.snapshot.provider}/${state.snapshot.model} (${state.providerSource})`,
              `context: ${state.snapshot.context}`,
              `steps: ${state.snapshot.step}`,
              `workspace: ${state.snapshot.cwd}`,
              `background: ${state.snapshot.background}`,
            ].join("\n");
          },
        });
        api.commands.register({
          name: "diagnostics",
          title: "Diagnostics",
          async run(invocation) {
            const state = await session(invocation);
            const value = invocation?.args.join(" ").trim() ?? "";
            const limit = value ? Number(value) : 20;
            if (!Number.isInteger(limit) || limit < 1 || limit > 500)
              throw new Error(
                "diagnostics limit must be an integer between 1 and 500",
              );
            const entries = state.diagnostics.slice(-limit);
            return entries.length
              ? entries
                  .map(
                    (entry) =>
                      `${entry.at}${entry.owner ? ` [${entry.owner}]` : ""} ${entry.level}: ${entry.message}`,
                  )
                  .join("\n")
              : "no diagnostics recorded";
          },
        });
      }
    },
    dispose() {
      controller?.dispose();
      controller = undefined;
    },
  };
}
