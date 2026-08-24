/**
 * Read-only slash command handlers — runtime/slash-read.ts.
 *
 * These answer the `/…` commands that only publish text/status and never mutate
 * session or runtime state. They receive a `SlashDeps` bundle from the commands
 * router and return true when they handled the input.
 */
import { runtimeSlashCommands } from "@natalia/contracts";
import { EGRESS_ADVISORY, type SlashDeps } from "./index";

export async function tryReadSlashCommand(deps: SlashDeps): Promise<boolean> {
  const trimmed = deps.text.trim();
  if (trimmed === "/help") {
    deps.publish({
      type: "content.delta",
      id: deps.id,
      text: [
        "Natalia TS7 agent shell commands:",
        ...runtimeSlashCommands.map(
          (command) =>
            `/${command.name}${command.acceptsArguments ? " <args>" : ""} - ${command.description}`,
        ),
        "Use Ctrl-C to cancel an active turn and Ctrl-D on an empty composer to exit.",
      ].join("\n"),
    });
    deps.publish({ type: "content.done", id: deps.id });
    deps.publish({ type: "turn.finished", id: deps.id, stopReason: "done" });
    return true;
  }
  if (trimmed === "/doctor") {
    const configured = deps.provider
      ? `${deps.provider.provider}/${deps.provider.model} (${deps.providerSource})`
      : "not configured";
    deps.publish({
      type: "content.delta",
      id: deps.id,
      text: [
        "Natalia TS7 runtime doctor",
        `provider: ${configured}`,
        `workspace: ${deps.workspaceRoot}`,
        `session: ${deps.session.id}`,
        `native tools: ${deps.toolsSize}`,
        `agent: ${deps.selectedAgent?.name ?? "default"}`,
        `skills: ${deps.skillsList().length}`,
        deps.provider
          ? "provider check: configured; submit a short prompt to verify live streaming"
          : "provider check: set NATALIA_OPENAI_API_KEY (or OPENAI_API_KEY), or configure a provider in .natalia/config.json, then restart the TUI",
        "safety: write/shell/process actions require approval unless permissionMode=auto is explicitly configured by a caller",
        EGRESS_ADVISORY,
      ].join("\n"),
    });
    deps.publish({ type: "content.done", id: deps.id });
    deps.publish({ type: "turn.finished", id: deps.id, stopReason: "done" });
    deps.publish(await deps.runtimeStatusSnapshot());
    return true;
  }
  if (trimmed === "/status") {
    const snapshot = await deps.runtimeStatusSnapshot();
    deps.publish(snapshot);
    deps.publish({
      type: "content.delta",
      id: deps.id,
      text: [
        `provider: ${snapshot.provider}/${snapshot.model} (${deps.providerSource})`,
        `context: ${snapshot.context}`,
        `steps: ${snapshot.step}`,
        `workspace: ${snapshot.cwd}`,
        `background: ${snapshot.background}`,
      ].join("\n"),
    });
    deps.publish({ type: "content.done", id: deps.id });
    deps.publish({ type: "turn.finished", id: deps.id, stopReason: "done" });
    return true;
  }
  if (trimmed === "/diagnostics" || trimmed.startsWith("/diagnostics ")) {
    const value = trimmed.slice("/diagnostics".length).trim();
    const limit = value ? Number(value) : 20;
    if (!Number.isInteger(limit) || limit < 1 || limit > 500)
      throw new Error("diagnostics limit must be an integer between 1 and 500");
    const entries = [
      ...deps.runtimeDiagnostics,
      ...deps.runtimeDiagnosticsForSession,
    ].slice(-limit);
    deps.publish({
      type: "content.delta",
      id: deps.id,
      text: entries.length
        ? entries
            .map(
              (entry) =>
                `${entry.at}${entry.owner ? ` [${entry.owner}]` : ""} ${entry.level}: ${entry.message}`,
            )
            .join("\n")
        : "no diagnostics recorded",
    });
    deps.publish({ type: "content.done", id: deps.id });
    deps.publish({ type: "turn.finished", id: deps.id, stopReason: "done" });
    return true;
  }
  return false;
}
