import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { chmod, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { SubagentRegistry } from "@natalia/subagent";
import {
  detachedShellPrefix,
  isWindows,
  processTreeKillCommand,
  profileShellCommand,
  shellQuote,
  startDetachedProcess,
} from "@natalia/platform";
import {
  NativeTerminalRegistry,
  type NativeTerminalSession,
} from "@natalia/native-terminal";
import { WorkspaceSandboxManager } from "@natalia/sandbox";

export { validateToolParameters, assertValidToolParameters } from "./validate";
export {
  boundToolOutput,
  cleanupToolOutput,
  MAX_TOOL_OUTPUT_BYTES,
  MAX_TOOL_OUTPUT_LINES,
  TOOL_OUTPUT_RETENTION_MS,
} from "./output";
import {
  numberOr,
  optionalInteger,
  optionalString,
  positiveNumberOr,
  positiveNumberOrUndefined,
  requireObject,
  requireString,
  workspacePath,
} from "./arguments";
import {
  isProcessRunning,
  ownsProcess,
  processFingerprint,
  readOptionalFile,
  safeToolEnv,
  sendProcessSignal,
  stopProcessTree,
  terminateChildProcessTree,
  truncateProcessOutput,
} from "./child-process";
import { ManagedProcessRegistry, managedProcessTools } from "./managed-process";
import type { RuntimeTool, ToolExecutionContext } from "./types";

export type {
  RuntimeTool,
  ToolExecutionBoundary,
  ToolExecutionContext,
  ToolSchema,
} from "./types";

export {
  ManagedProcessRegistry,
  type ManagedProcessInfo,
  type ManagedProcessStatus,
} from "./managed-process";
import {
  encodeTerminalKey,
  nativeTerminalReadPage,
  nativeTerminalSearchPage,
} from "./terminal-io";

export {
  encodeTerminalKey,
  nativeTerminalReadPage,
  nativeTerminalSearchPage,
} from "./terminal-io";

export { materializeTools } from "./invocation";
export type {
  ToolInvocation,
  ToolMaterialization,
  ToolSettlement,
} from "./invocation";
export class ToolRegistry extends Map<string, RuntimeTool> {
  private readonly aliases = new Map<string, string>();

  addAlias(alias: string, target: string) {
    if (!super.has(target))
      throw new Error(`cannot alias unknown tool: ${target}`);
    this.aliases.set(alias, target);
  }

  override get(name: string) {
    return super.get(this.aliases.get(name) ?? name);
  }

  override has(name: string) {
    return super.has(this.aliases.get(name) ?? name);
  }
}

export function createToolRegistry(
  tools?: RuntimeTool[],
  processRegistry?: ManagedProcessRegistry,
): ToolRegistry {
  const registry = new ToolRegistry(
    (tools ?? defaultTools(processRegistry)).map((tool) => [tool.name, tool]),
  );
  if (!tools)
    for (const [alias, target] of Object.entries(
      interactiveTerminalToolAliases,
    ))
      registry.addAlias(alias, target);
  return registry;
}

const interactiveTerminalToolAliases = {
  interactive_start: "interactive_terminal_start",
  interactive_read: "interactive_terminal_read",
  interactive_search: "interactive_terminal_search",
  interactive_write: "interactive_terminal_write",
  interactive_send_line: "interactive_terminal_send_line",
  interactive_keys: "interactive_terminal_keys",
  interactive_input: "interactive_terminal_input",
  interactive_snapshot: "interactive_terminal_snapshot",
  interactive_resize: "interactive_terminal_resize",
  interactive_stop: "interactive_terminal_stop",
  interactive_list: "interactive_terminal_list",
} as const;

export function defaultTools(
  processRegistry = new ManagedProcessRegistry(),
): RuntimeTool[] {
  const tools: RuntimeTool[] = [
    readFileTool(),
    writeFileTool(),
    editFileTool(),
    globTool(),
    grepTool(),
    todoReadTool(),
    todoWriteTool(),
    planTool(),
    askUserTool(),
    agentSpawnTool(),
    agentListTool(),
    agentStatusTool(),
    agentOutputTool(),
    agentStopTool(),
    agentResumeTool(),
    agentRetryTool(),
    agentAttachTool(),
    agentDetachTool(),
    agentCleanupTool(),
    agentAuditTool(),
    interactiveStartTool(),
    terminalObserveTool(),
    interactiveReadTool(),
    interactiveSearchTool(),
    interactiveWriteTool(),
    interactiveSendLineTool(),
    interactiveKeyTool(),
    interactiveInputTool(),
    interactiveSnapshotTool(),
    interactiveResizeTool(),
    interactiveStopTool(),
    interactiveListTool(),
    sandboxCreateTool(),
    sandboxExecuteTool(),
    sandboxWriteTool(),
    sandboxDiffTool(),
    sandboxMergeTool(),
    sandboxDeleteTool(),
    sandboxResourceStartTool(),
    sandboxResourceListTool(),
    sandboxResourceOutputTool(),
    sandboxResourceStopTool(),
    runShellTool(),
    ...managedProcessTools(processRegistry),
    webFetchTool(),
    webSearchTool(),
    readMediaFileTool(),
    browserVisitTool(),
    browserScreenshotTool(),
  ];

  return tools;
}

function planTool(): RuntimeTool {
  return {
    name: "plan",
    description: "Create or update the durable workspace execution plan.",
    requiresApproval: true,
    parameters: {
      type: "object",
      properties: { items: { type: "array" } },
      required: ["items"],
      additionalProperties: false,
    },
    async execute(input, context) {
      return await todoWriteTool().execute(input, context);
    },
  };
}

function requireSandboxes(context: ToolExecutionContext) {
  if (!context.sandboxes) throw new Error("sandbox runtime unavailable");
  return context.sandboxes;
}

function sandboxCreateTool(): RuntimeTool {
  return {
    name: "sandbox_create",
    description: "Create a TS workspace-isolated sandbox.",
    requiresApproval: true,
    parameters: {
      type: "object",
      properties: { id: { type: "string" }, maxLines: { type: "number" } },
      required: ["id"],
      additionalProperties: false,
    },
    async execute(input, context) {
      const args = requireObject(input);
      const id = requireString(args.id, "id");
      const sandbox = await requireSandboxes(context).create(id);
      context.onSandboxEvent?.(requireSandboxes(context).updateEvent(id));
      context.onSandboxEvent?.(
        requireSandboxes(context).auditEvent(id, "create"),
      );
      return JSON.stringify(sandbox, null, 2);
    },
  };
}

function sandboxExecuteTool(): RuntimeTool {
  return {
    name: "sandbox_execute",
    description: "Execute a shell command inside a TS workspace sandbox.",
    requiresApproval: true,
    parameters: {
      type: "object",
      properties: { id: { type: "string" }, command: { type: "string" } },
      required: ["id", "command"],
      additionalProperties: false,
    },
    async execute(input, context) {
      const args = requireObject(input);
      const manager = requireSandboxes(context);
      const id = requireString(args.id, "id");
      const result = await manager.execute(
        id,
        requireString(args.command, "command"),
        {
          signal: context.signal,
        },
      );
      context.onSandboxEvent?.(manager.updateEvent(id));
      context.onSandboxEvent?.(manager.auditEvent(id, "execute"));
      return [`exit=${result.exitCode}`, result.output].join("\n");
    },
  };
}

function sandboxWriteTool(): RuntimeTool {
  return {
    name: "sandbox_write",
    description: "Write a file inside a TS workspace sandbox manifest.",
    requiresApproval: true,
    parameters: {
      type: "object",
      properties: {
        id: { type: "string" },
        path: { type: "string" },
        content: { type: "string" },
      },
      required: ["id", "path", "content"],
      additionalProperties: false,
    },
    async execute(input, context) {
      const args = requireObject(input);
      const manager = requireSandboxes(context);
      const id = requireString(args.id, "id");
      await manager.write(
        id,
        requireString(args.path, "path"),
        requireString(args.content, "content"),
      );
      context.onSandboxEvent?.(manager.updateEvent(id));
      context.onSandboxEvent?.(manager.diffEvent(id));
      return `wrote ${requireString(args.path, "path")} in sandbox ${id}`;
    },
  };
}

function sandboxDiffTool(): RuntimeTool {
  return sandboxReadTool(
    "sandbox_diff",
    "Show pending sandbox changes.",
    async (manager, id) => {
      const changes = await manager.previewMerge(id);
      return JSON.stringify(changes, null, 2);
    },
  );
}

function sandboxMergeTool(): RuntimeTool {
  return {
    name: "sandbox_merge",
    description: "Merge a sandbox manifest into the current workspace.",
    requiresApproval: true,
    parameters: {
      type: "object",
      properties: { id: { type: "string" }, maxLines: { type: "number" } },
      required: ["id"],
      additionalProperties: false,
    },
    async execute(input, context) {
      const args = requireObject(input);
      const id = requireString(args.id, "id");
      const manager = requireSandboxes(context);
      const changes = await manager.merge(
        id,
        context.workspaceRoot,
        async (paths) =>
          await context.sandboxMergeAuthorize?.({
            id,
            paths,
          }),
      );
      context.onSandboxEvent?.(manager.updateEvent(id));
      context.onSandboxEvent?.(manager.auditEvent(id, "merge"));
      return JSON.stringify(changes, null, 2);
    },
  };
}

function sandboxDeleteTool(): RuntimeTool {
  return {
    name: "sandbox_delete",
    description: "Delete a TS workspace sandbox.",
    requiresApproval: true,
    parameters: {
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"],
      additionalProperties: false,
    },
    async execute(input, context) {
      const id = requireString(requireObject(input).id, "id");
      const manager = requireSandboxes(context);
      const result = await manager.delete(id);
      context.onSandboxEvent?.({
        type: "sandbox.update",
        id,
        status: "deleted",
        root: "",
        isolationLevel: "workspace",
        changedFiles: result.pendingChanges.length,
        runningResources: result.runningResources.length,
        target: { kind: "host", cwd: context.workspaceRoot },
        resourcePolicy: "sandbox deleted after resource cleanup",
      });
      context.onSandboxEvent?.({
        type: "sandbox.audit",
        id,
        action: "delete",
        target: { kind: "host", cwd: context.workspaceRoot },
        approvalRequired: true,
        checkpointPolicy: "sandbox_manifest",
        message: "Sandbox workspace directory deleted after resource cleanup.",
      });
      return JSON.stringify(result, null, 2);
    },
  };
}

function sandboxResourceStartTool(): RuntimeTool {
  return {
    name: "sandbox_resource_start",
    description:
      "Start a managed background process inside a TS workspace sandbox.",
    requiresApproval: true,
    parameters: {
      type: "object",
      properties: {
        id: { type: "string" },
        command: { type: "string" },
        resourceID: { type: "string" },
      },
      required: ["id", "command"],
      additionalProperties: false,
    },
    async execute(input, context) {
      const args = requireObject(input);
      const manager = requireSandboxes(context);
      const id = requireString(args.id, "id");
      const resource = await manager.startResource(
        id,
        requireString(args.command, "command"),
        optionalString(args.resourceID),
      );
      context.onSandboxEvent?.(manager.updateEvent(id));
      context.onSandboxEvent?.(manager.auditEvent(id, "resource_start"));
      return JSON.stringify(resource, null, 2);
    },
  };
}

function sandboxResourceListTool(): RuntimeTool {
  return sandboxResourceReadTool(
    "sandbox_resource_list",
    "List managed processes running inside a TS workspace sandbox.",
    (manager, id) => JSON.stringify(manager.resourcesFor(id), null, 2),
  );
}

function sandboxResourceOutputTool(): RuntimeTool {
  return {
    name: "sandbox_resource_output",
    description: "Read retained output from a managed sandbox process.",
    requiresApproval: false,
    parameters: {
      type: "object",
      properties: { id: { type: "string" }, resourceID: { type: "string" } },
      required: ["id", "resourceID"],
      additionalProperties: false,
    },
    async execute(input, context) {
      const args = requireObject(input);
      return await requireSandboxes(context).resourceOutput(
        requireString(args.id, "id"),
        requireString(args.resourceID, "resourceID"),
      );
    },
  };
}

function sandboxResourceStopTool(): RuntimeTool {
  return {
    name: "sandbox_resource_stop",
    description:
      "Stop a managed process running inside a TS workspace sandbox.",
    requiresApproval: true,
    parameters: {
      type: "object",
      properties: { id: { type: "string" }, resourceID: { type: "string" } },
      required: ["id", "resourceID"],
      additionalProperties: false,
    },
    async execute(input, context) {
      const args = requireObject(input);
      const manager = requireSandboxes(context);
      const id = requireString(args.id, "id");
      const resource = await manager.stopResource(
        id,
        requireString(args.resourceID, "resourceID"),
      );
      context.onSandboxEvent?.(manager.updateEvent(id));
      context.onSandboxEvent?.(manager.auditEvent(id, "resource_stop"));
      return JSON.stringify(resource, null, 2);
    },
  };
}

function sandboxResourceReadTool(
  name: string,
  description: string,
  action: (manager: WorkspaceSandboxManager, id: string) => string,
): RuntimeTool {
  return {
    name,
    description,
    requiresApproval: false,
    parameters: {
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"],
      additionalProperties: false,
    },
    async execute(input, context) {
      return action(
        requireSandboxes(context),
        requireString(requireObject(input).id, "id"),
      );
    },
  };
}

function sandboxReadTool(
  name: string,
  description: string,
  action: (manager: WorkspaceSandboxManager, id: string) => Promise<string>,
  requiresApproval = false,
): RuntimeTool {
  return {
    name,
    description,
    requiresApproval,
    parameters: {
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"],
      additionalProperties: false,
    },
    async execute(input, context) {
      return await action(
        requireSandboxes(context),
        requireString(requireObject(input).id, "id"),
      );
    },
  };
}

function requireNativeTerminal(context: ToolExecutionContext) {
  if (!context.nativeTerminal)
    throw new Error(
      "Native Terminal Host is unavailable. Install the Natalia WezTerm distribution to start an interactive terminal.",
    );
  return context.nativeTerminal;
}

function modelNativeTerminalInfo(session: NativeTerminalSession) {
  return {
    id: session.id,
    host: session.host,
    paneID: session.paneID,
    windowID: session.windowID,
    muxWindowID: session.muxWindowID,
    tabID: session.tabID,
    command: session.command,
    cwd: session.cwd,
    status: session.status,
    startedAt: session.startedAt,
  };
}

function interactiveStartTool(): RuntimeTool {
  return {
    name: "interactive_terminal_start",
    description:
      "Start a real interactive Terminal session inside the workspace. On Windows the pane shell is Git Bash, not cmd.exe — use POSIX shell syntax.",
    requiresApproval: true,
    parameters: {
      type: "object",
      properties: {
        command: { type: "string" },
        id: { type: "string" },
      },
      required: ["command"],
      additionalProperties: false,
    },
    async execute(input, context) {
      const args = requireObject(input);
      const registry = requireNativeTerminal(context);
      const session = await registry.start({
        command: requireString(args.command, "command"),
        cwd: context.workspaceRoot,
        id: optionalString(args.id),
      });
      return JSON.stringify(modelNativeTerminalInfo(session), null, 2);
    },
  };
}

function interactiveReadTool(): RuntimeTool {
  return {
    name: "interactive_terminal_read",
    description:
      "Read a bounded line range from the same native Terminal pane used by the human. Returns text plus cursor position. Use startLine/endLine to page through complete scrollback without copying it all at once.",
    requiresApproval: false,
    parameters: {
      type: "object",
      properties: {
        id: { type: "string" },
        maxLines: { type: "number" },
        startLine: { type: "number" },
        endLine: { type: "number" },
        cursor: { type: "number" },
      },
      required: ["id"],
      additionalProperties: false,
    },
    async execute(input, context) {
      const args = requireObject(input);
      const id = requireString(args.id, "id");
      const startLine = optionalInteger(args.startLine, "startLine");
      const cursor = optionalInteger(args.cursor, "cursor");
      const endLine = optionalInteger(args.endLine, "endLine");
      if (startLine !== undefined && cursor !== undefined)
        throw new Error("startLine and cursor cannot be used together");
      const pageStartLine = startLine ?? cursor;
      const { text, cursorX, cursorY, rows, cols } =
        await requireNativeTerminal(context).read(id, {
          maxLines: Math.max(1, Math.min(numberOr(args.maxLines, 60), 200)),
          startLine: pageStartLine,
          endLine,
        });
      const page = nativeTerminalReadPage(text, {
        startLine: pageStartLine,
        endLine,
      });
      return JSON.stringify(
        {
          id,
          cursorX,
          cursorY,
          rows,
          cols,
          range:
            pageStartLine === undefined
              ? {
                  kind: "tail",
                  maxLines: Math.max(
                    1,
                    Math.min(numberOr(args.maxLines, 60), 200),
                  ),
                }
              : {
                  kind: "lines",
                  startLine: pageStartLine,
                  endLine,
                },
          deliveredRange:
            pageStartLine === undefined
              ? { kind: "tail", deliveredLines: page.deliveredLines }
              : {
                  kind: "lines",
                  startLine: pageStartLine,
                  endLine: page.endLine,
                  deliveredLines: page.deliveredLines,
                },
          nextCursor: page.nextStartLine
            ? {
                startLine: page.nextStartLine,
                ...(endLine === undefined ? {} : { endLine }),
              }
            : undefined,
          text: page.text,
          truncated: page.truncated,
          totalBytes: page.totalBytes,
          rangeDiscovery: "native_scrollback_unbounded",
        },
        null,
        2,
      );
    },
  };
}

function interactiveSearchTool(): RuntimeTool {
  return {
    name: "interactive_terminal_search",
    description:
      "Search a bounded native Terminal scrollback line range for literal UTF-8 text. Continue with nextCursor; it never transports the full terminal screen.",
    requiresApproval: false,
    parameters: {
      type: "object",
      properties: {
        id: { type: "string" },
        query: { type: "string" },
        startLine: { type: "number" },
        endLine: { type: "number" },
        cursor: { type: "number" },
        maxMatches: { type: "number" },
      },
      required: ["id", "query"],
      additionalProperties: false,
    },
    async execute(input, context) {
      const args = requireObject(input);
      const id = requireString(args.id, "id");
      const query = requireString(args.query, "query");
      if (!query) throw new Error("query must not be empty");
      if (new TextEncoder().encode(query).byteLength > 256)
        throw new Error("query must be at most 256 UTF-8 bytes");
      const startLine = optionalInteger(args.startLine, "startLine");
      const cursor = optionalInteger(args.cursor, "cursor");
      const endLine = optionalInteger(args.endLine, "endLine");
      if (startLine !== undefined && cursor !== undefined)
        throw new Error("startLine and cursor cannot be used together");
      const pageStartLine = startLine ?? cursor;
      if (pageStartLine === undefined)
        throw new Error(
          "startLine or cursor is required for scrollback search",
        );
      if (endLine !== undefined && endLine < pageStartLine)
        throw new Error("endLine must not be before startLine");
      const pageEndLine = Math.min(
        endLine ?? pageStartLine + 199,
        pageStartLine + 199,
      );
      const { text } = await requireNativeTerminal(context).read(id, {
        startLine: pageStartLine,
        endLine: pageEndLine,
      });
      const result = nativeTerminalSearchPage(text, {
        query,
        startLine: pageStartLine,
        endLine: pageEndLine,
        requestedEndLine: endLine,
        maxMatches: Math.max(1, Math.min(numberOr(args.maxMatches, 20), 20)),
      });
      return JSON.stringify({ id, ...result }, null, 2);
    },
  };
}

function terminalObserveTool(): RuntimeTool {
  return {
    name: "terminal_observe",
    description:
      "Wait for a terminal screen revision or process exit, then return the current styled framebuffer. Timeout is a normal observation result. afterRevision is optional; omit it to get current state. Use mode='latest' for current state without waiting; mode='tail' for recent lines; mode='new_only' for only new output since last observation; mode='cursor' for lines around the cursor.",
    requiresApproval: false,
    timeoutSec: 35,
    parameters: {
      type: "object",
      properties: {
        id: { type: "string" },
        afterRevision: { type: "number" },
        timeoutMs: { type: "number" },
        scrollbackRows: { type: "number" },
        mode: {
          type: "string",
          enum: ["full", "tail", "new_only", "cursor", "latest"],
        },
      },
      required: ["id"],
      additionalProperties: false,
    },
    async execute(input, context) {
      const args = requireObject(input);
      const id = requireString(args.id, "id");
      const mode = args.mode || "full";
      const afterRevision = numberOr(args.afterRevision, 0);
      if (mode === "latest") {
        const snapshot = await requireNativeTerminal(context).snapshot(id);
        return JSON.stringify({
          id,
          host: "wezterm",
          revision: snapshot.revision,
          currentRevision: snapshot.revision,
          afterRevision,
          changed: snapshot.revision > afterRevision,
          // This mode reads the screen as it is and never waits, so it cannot
          // report a wait outcome. Saying "timeout" claimed the deadline passed
          // with no output, which reads as a stale frame even though the screen
          // was just reconciled, and "changed" was not one of the outcomes the
          // waiting modes report either.
          reason: "latest",
          cursorX: snapshot.cursorX,
          cursorY: snapshot.cursorY,
          rows: snapshot.rows,
          cols: snapshot.cols,
          mode,
          text: truncateProcessOutput(snapshot.text, 16_384),
        });
      }
      const nativeTerminal = requireNativeTerminal(context);
      await nativeTerminal.reconcile();
      const observation = await nativeTerminal.observe(id, afterRevision, {
        maxLines: Math.max(1, Math.min(numberOr(args.scrollbackRows, 60), 200)),
        timeoutMs: Math.max(
          1_000,
          Math.min(numberOr(args.timeoutMs, 5_000), 30_000),
        ),
      });
      let text = observation.text;
      const session = nativeTerminal.session(id);
      const previousText = session.lastObservedText;
      if (mode === "tail") {
        const lines = text.split("\n");
        if (lines.at(-1) === "") lines.pop();
        const tailLines = Math.max(
          1,
          Math.min(numberOr(args.scrollbackRows, 60), 200),
        );
        text = lines.slice(-tailLines).join("\n");
      } else if (mode === "cursor") {
        const lines = text.split("\n");
        if (lines.at(-1) === "") lines.pop();
        const cursorY = observation.cursorY ?? 0;
        const contextLines = 10;
        const startLine = Math.max(0, cursorY - contextLines);
        const endLine = Math.min(lines.length, cursorY + contextLines + 1);
        text = lines.slice(startLine, endLine).join("\n");
      } else if (mode === "new_only") {
        if (previousText && text.startsWith(previousText)) {
          text = text.slice(previousText.length);
        }
      }
      nativeTerminal.markObserved(
        id,
        observation.text,
        observation.session.revision,
      );
      return JSON.stringify(
        {
          id,
          host: "wezterm",
          revision: observation.session.revision,
          currentRevision: observation.session.revision,
          afterRevision: observation.afterRevision,
          changed: observation.changed,
          reason: observation.reason,
          cursorX: observation.cursorX,
          cursorY: observation.cursorY,
          rows: observation.rows,
          cols: observation.cols,
          mode,
          text: truncateProcessOutput(text, 16_384),
        },
        null,
        2,
      );
    },
  };
}

function interactiveWriteTool(): RuntimeTool {
  return {
    name: "interactive_terminal_write",
    description:
      "Write literal input to the native terminal pane without appending a newline. Prefer interactive_terminal_input with submit=false for new code.",
    requiresApproval: true,
    parameters: {
      type: "object",
      properties: {
        id: { type: "string" },
        input: { type: "string" },
        idempotencyKey: { type: "string" },
      },
      required: ["id", "input"],
      additionalProperties: false,
    },
    async execute(input, context) {
      const args = requireObject(input);
      const id = requireString(args.id, "id");
      const data = requireString(args.input, "input");
      const result = await requireNativeTerminal(context).write(id, data, {
        idempotencyKey: optionalString(args.idempotencyKey),
      });
      return JSON.stringify({
        id,
        ...result,
      });
    },
  };
}

function interactiveSendLineTool(): RuntimeTool {
  return {
    name: "interactive_terminal_send_line",
    description:
      "Atomically write text and submit it with Enter to the native terminal pane. Prefer interactive_terminal_input with default submit=true for new code.",
    requiresApproval: true,
    parameters: {
      type: "object",
      properties: {
        id: { type: "string" },
        text: { type: "string" },
        idempotencyKey: { type: "string" },
      },
      required: ["id", "text"],
      additionalProperties: false,
    },
    async execute(input, context) {
      const args = requireObject(input);
      const id = requireString(args.id, "id");
      const text = requireString(args.text, "text");
      const result = await requireNativeTerminal(context).write(
        id,
        `${text}\r`,
        {
          idempotencyKey: optionalString(args.idempotencyKey),
        },
      );
      return JSON.stringify({ id, ...result, submitted: true });
    },
  };
}

function interactiveKeyTool(): RuntimeTool {
  return {
    name: "interactive_terminal_keys",
    description:
      "Send normalized key sequences to the native terminal pane. Prefer interactive_terminal_input with the keys array for new code.",
    requiresApproval: true,
    parameters: {
      type: "object",
      properties: {
        id: { type: "string" },
        key: { type: "string" },
        keys: {
          type: "array",
          items: {
            type: "object",
            properties: {
              key: { type: "string" },
              text: { type: "string" },
              modifiers: { type: "array", items: { type: "string" } },
              repeat: { type: "number" },
            },
            additionalProperties: false,
          },
        },
      },
      required: ["id"],
      additionalProperties: false,
    },
    async execute(input, context) {
      const args = requireObject(input);
      const id = requireString(args.id, "id");
      const sequence = Array.isArray(args.keys)
        ? args.keys.map((item) => requireObject(item))
        : [requireObject({ key: requireString(args.key, "key") })];
      if (!sequence.length) throw new Error("keys must not be empty");
      const bytes = sequence.map(encodeTerminalKey).join("");
      const result = await requireNativeTerminal(context).write(id, bytes);
      return JSON.stringify({ id, keys: sequence, ...result });
    },
  };
}

function interactiveInputTool(): RuntimeTool {
  return {
    name: "interactive_terminal_input",
    description:
      "Unified input for the native terminal pane. Prefer this over interactive_terminal_write, interactive_terminal_send_line, and interactive_terminal_keys. Use `text` alone for a shell command: text='ls -la' sends it and presses Enter (submit=true by default; submit=false suppresses it). Use `keys` when order matters: it is an ordered sequence sent one entry at a time, where each entry is either a key ({key:'Escape'}) or literal text ({text:'hello'}). Entering insert mode and typing is keys=[{key:'i'},{text:'hello'},{key:'Escape'}]; saving is keys=[{key:'Escape'},{text:':wq'},{key:'Enter'}]. Add Enter explicitly as {key:'Enter'} inside a sequence. Do not pass `text` and `keys` in the same call, because their relative order is not expressible that way; put the text inside the sequence instead. Use paste=true with `text` for large blocks in editors like vim (wraps it in bracketed paste escape sequences).",
    requiresApproval: true,
    parameters: {
      type: "object",
      properties: {
        id: { type: "string" },
        text: { type: "string" },
        keys: {
          type: "array",
          items: {
            type: "object",
            properties: {
              key: { type: "string" },
              text: { type: "string" },
              modifiers: { type: "array", items: { type: "string" } },
              repeat: { type: "number" },
            },
            additionalProperties: false,
          },
        },
        submit: { type: "boolean" },
        paste: { type: "boolean" },
        idempotencyKey: { type: "string" },
      },
      required: ["id"],
      additionalProperties: false,
    },
    async execute(input, context) {
      const args = requireObject(input);
      const id = requireString(args.id, "id");
      if (args.text === undefined && !Array.isArray(args.keys))
        throw new Error("either text or keys is required");
      // Two parallel fields cannot express interleaving, so the old behaviour
      // silently sent all text before all keys. In an editor that reverses the
      // intent: text meant for insert mode arrives while still in normal mode.
      // Ordering is expressible inside `keys`, so ask for it there.
      if (args.text !== undefined && Array.isArray(args.keys))
        throw new Error(
          "text and keys cannot be combined because their order is ambiguous; put the text inside the keys sequence instead, for example keys=[{key:'i'},{text:'hello'},{key:'Escape'}]",
        );
      let bytes = "";
      let pasted = false;
      if (args.text !== undefined) {
        const text = requireString(args.text, "text");
        if (args.paste && text) {
          bytes = `\x1b[?2004h${text}\x1b[?2004l`;
          pasted = true;
        } else {
          bytes = text;
        }
      }
      if (Array.isArray(args.keys))
        bytes += args.keys
          .map((item) => encodeTerminalKey(requireObject(item)))
          .join("");
      if (!pasted && args.text !== undefined && args.submit !== false)
        bytes += "\r";
      if (!bytes) throw new Error("input must not be empty");
      const result = await requireNativeTerminal(context).write(id, bytes, {
        idempotencyKey: optionalString(args.idempotencyKey),
      });
      return JSON.stringify({
        id,
        ...result,
        submitted: args.submit !== false && !pasted,
      });
    },
  };
}

function interactiveSnapshotTool(): RuntimeTool {
  return {
    name: "interactive_terminal_snapshot",
    description:
      "Return the current terminal screen text with cursor position and revision. Use this to check where you are without specifying afterRevision.",
    requiresApproval: false,
    parameters: {
      type: "object",
      properties: {
        id: { type: "string" },
      },
      required: ["id"],
      additionalProperties: false,
    },
    async execute(input, context) {
      const args = requireObject(input);
      const id = requireString(args.id, "id");
      const snapshot = await requireNativeTerminal(context).snapshot(id);
      return JSON.stringify({
        id,
        host: "wezterm",
        ...snapshot,
      });
    },
  };
}

function interactiveResizeTool(): RuntimeTool {
  return {
    name: "interactive_terminal_resize",
    description: "Resize an interactive Terminal session.",
    requiresApproval: false,
    parameters: {
      type: "object",
      properties: {
        id: { type: "string" },
        rows: { type: "number" },
        cols: { type: "number" },
      },
      required: ["id", "rows", "cols"],
      additionalProperties: false,
    },
    async execute(input, context) {
      const args = requireObject(input);
      const id = requireString(args.id, "id");
      const rows = numberOr(args.rows, 36);
      const cols = numberOr(args.cols, 120);
      return JSON.stringify(
        modelNativeTerminalInfo(
          await requireNativeTerminal(context).resize(id, rows, cols),
        ),
        null,
        2,
      );
    },
  };
}

function interactiveStopTool(): RuntimeTool {
  return {
    name: "interactive_terminal_stop",
    description: "Stop the native Terminal pane.",
    requiresApproval: true,
    parameters: {
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"],
      additionalProperties: false,
    },
    async execute(input, context) {
      const session = await requireNativeTerminal(context).stop(
        requireString(requireObject(input).id, "id"),
      );
      return JSON.stringify({
        ...modelNativeTerminalInfo(session),
        status: "exited",
      });
    },
  };
}

function interactiveListTool(): RuntimeTool {
  return {
    name: "interactive_terminal_list",
    description: "List real interactive Terminal sessions.",
    requiresApproval: false,
    parameters: { type: "object", properties: {}, additionalProperties: false },
    async execute(_input, context) {
      return JSON.stringify(
        requireNativeTerminal(context).list().map(modelNativeTerminalInfo),
        null,
        2,
      );
    },
  };
}

function requireSubagents(context: ToolExecutionContext) {
  if (!context.subagents) throw new Error("subagent runtime unavailable");
  return context.subagents;
}

function agentSpawnTool(): RuntimeTool {
  return {
    name: "agent_spawn",
    description: "Spawn an isolated TS/Bun subagent task.",
    requiresApproval: true,
    parameters: {
      type: "object",
      properties: {
        task: { type: "string" },
        mode: { type: "string" },
        modelProfile: { type: "string" },
        allowedTools: { type: "array" },
        excludeTools: { type: "array" },
      },
      required: ["task"],
      additionalProperties: false,
    },
    async execute(input, context) {
      const args = requireObject(input);
      const array = (value: unknown) =>
        Array.isArray(value) ? value.map((item) => String(item)) : undefined;
      const record = await requireSubagents(context).spawn(
        requireString(args.task, "task"),
        {
          mode: optionalString(args.mode),
          modelProfile: optionalString(args.modelProfile),
          allowedTools: array(args.allowedTools),
          excludeTools: array(args.excludeTools),
          signal: context.signal,
          parentSessionID: context.parentSessionID,
          parentAgentID: context.parentAgentID,
          maxDepth: context.maxSubagentDepth,
        },
      );
      return JSON.stringify(record, null, 2);
    },
  };
}

function agentListTool(): RuntimeTool {
  return agentRegistryTool(
    "agent_list",
    "List TS/Bun subagents.",
    false,
    async (registry) => await registry.formatList(),
  );
}

function agentStatusTool(): RuntimeTool {
  return agentRegistryTool(
    "agent_status",
    "Show TS/Bun subagent status.",
    false,
    async (registry, args) =>
      await registry.formatStatus(requireString(args.id, "id")),
    true,
  );
}

function agentOutputTool(): RuntimeTool {
  return agentRegistryTool(
    "agent_output",
    "Show the concise final result of a TS/Bun subagent. Set verbose=true only when the full audit log is required.",
    false,
    async (registry, args) =>
      await registry.formatOutput(
        requireString(args.id, "id"),
        args.verbose === true,
      ),
    true,
    { verbose: { type: "boolean" } },
  );
}

function agentStopTool(): RuntimeTool {
  return agentRegistryTool(
    "agent_stop",
    "Stop a running TS/Bun subagent.",
    true,
    async (registry, args) =>
      registry.stop(requireString(args.id, "id"))
        ? "stopped"
        : "subagent is not running",
    true,
  );
}

function agentResumeTool(): RuntimeTool {
  return agentRegistryTool(
    "agent_resume",
    "Resume a paused subagent only while its owning runtime remains active.",
    false,
    async (registry, args) =>
      (await registry.resume(requireString(args.id, "id")))
        ? "resumed"
        : "subagent is not paused",
    true,
  );
}

function agentRetryTool(): RuntimeTool {
  return agentRegistryTool(
    "agent_retry",
    "Retry a stopped or failed subagent as an explicit new continuation.",
    true,
    async (registry, args) => {
      const record = await registry.retry(requireString(args.id, "id"));
      return record
        ? `started continuation ${record.continuation}`
        : "subagent is not stopped or failed";
    },
    true,
  );
}

function agentAttachTool(): RuntimeTool {
  return agentRegistryTool(
    "agent_attach",
    "Attach subagent output to the current session.",
    false,
    async (registry, args) =>
      registry.attach(requireString(args.id, "id"))
        ? "attached"
        : "subagent not found",
    true,
  );
}

function agentDetachTool(): RuntimeTool {
  return agentRegistryTool(
    "agent_detach",
    "Detach subagent output from the current session.",
    false,
    async (registry, args) =>
      registry.detach(requireString(args.id, "id"))
        ? "detached"
        : "subagent not found",
    true,
  );
}

function agentCleanupTool(): RuntimeTool {
  return agentRegistryTool(
    "agent_cleanup",
    "Remove stopped, failed, and completed subagent records.",
    true,
    async (registry, args) =>
      JSON.stringify({ removed: registry.cleanup(args.dryRun === true) }),
  );
}

function agentAuditTool(): RuntimeTool {
  return agentRegistryTool(
    "agent_audit",
    "Return the TS/Bun subagent audit trail.",
    false,
    async (registry, args) =>
      registry.audit(
        numberOr(args.tail, 0) || undefined,
        optionalString(args.format),
      ),
  );
}

function agentRegistryTool(
  name: string,
  description: string,
  requiresApproval: boolean,
  action: (
    registry: SubagentRegistry,
    args: Record<string, unknown>,
  ) => Promise<string>,
  requiresID = false,
  extraProperties: Record<string, unknown> = {},
): RuntimeTool {
  return {
    name,
    description,
    requiresApproval,
    parameters: {
      type: "object",
      properties: {
        id: { type: "string" },
        dryRun: { type: "boolean" },
        tail: { type: "number" },
        format: { type: "string" },
        ...extraProperties,
      },
      required: requiresID ? ["id"] : undefined,
      additionalProperties: false,
    },
    async execute(input, context) {
      const args = requireObject(input);
      return await action(requireSubagents(context), args);
    },
  };
}

function globTool(): RuntimeTool {
  return {
    name: "glob",
    description: "List workspace files matching a Bun glob pattern.",
    requiresApproval: false,
    parameters: {
      type: "object",
      properties: {
        pattern: { type: "string" },
        limit: { type: "number" },
        offset: { type: "number" },
      },
      required: ["pattern"],
      additionalProperties: false,
    },
    async execute(input, context) {
      const args = requireObject(input);
      const pattern = requireString(args.pattern, "pattern");
      if (isAbsolute(pattern) || pattern.includes(".."))
        throw new Error("glob pattern must remain inside workspace");
      const paths: string[] = [];
      for await (const path of new Bun.Glob(pattern).scan({
        cwd: context.workspaceRoot,
        onlyFiles: true,
      }))
        paths.push(path);
      paths.sort();
      const offset = Math.max(0, numberOr(args.offset, 0));
      const limit = Math.min(1000, Math.max(1, numberOr(args.limit, 200)));
      const page = paths.slice(offset, offset + limit);
      await context.workspaceReadAuthorize?.({ toolName: "glob", paths: page });
      return [
        ...page,
        paths.length > offset + limit
          ? `... ${paths.length - offset - limit} more; use offset=${offset + limit}`
          : "",
      ]
        .filter(Boolean)
        .join("\n");
    },
  };
}

function grepTool(): RuntimeTool {
  return {
    name: "grep",
    description: "Search UTF-8 workspace files with a regular expression.",
    requiresApproval: false,
    parameters: {
      type: "object",
      properties: {
        pattern: { type: "string" },
        include: { type: "string" },
        limit: { type: "number" },
      },
      required: ["pattern"],
      additionalProperties: false,
    },
    async execute(input, context) {
      const args = requireObject(input);
      const expression = new RegExp(
        requireString(args.pattern, "pattern"),
        "u",
      );
      const include = optionalString(args.include) ?? "**/*";
      const limit = Math.min(1000, Math.max(1, numberOr(args.limit, 200)));
      const paths: string[] = [];
      for await (const relativePath of new Bun.Glob(include).scan({
        cwd: context.workspaceRoot,
        onlyFiles: true,
      }))
        paths.push(relativePath);
      paths.sort();
      const lines: string[] = [];
      for (const relativePath of paths) {
        if (lines.length >= limit) break;
        await context.workspaceReadAuthorize?.({
          toolName: "grep",
          paths: [relativePath],
        });
        let content: string;
        try {
          content = await readFile(
            resolve(context.workspaceRoot, relativePath),
            "utf8",
          );
        } catch {
          continue;
        }
        if (content.includes("\0")) continue;
        for (const [index, line] of content.split(/\r?\n/u).entries()) {
          expression.lastIndex = 0;
          if (!expression.test(line)) continue;
          lines.push(`${relativePath}:${index + 1}:${line}`);
          if (lines.length >= limit) break;
        }
      }
      return lines.length ? lines.join("\n") : "no matches";
    },
  };
}

type TodoItem = {
  content: string;
  status: "pending" | "in_progress" | "completed";
};

function todoReadTool(): RuntimeTool {
  return {
    name: "todo_read",
    description: "Read durable workspace todo items.",
    requiresApproval: false,
    parameters: { type: "object", properties: {}, additionalProperties: false },
    async execute(_input, context) {
      return JSON.stringify(await readTodos(context.workspaceRoot), null, 2);
    },
  };
}

function todoWriteTool(): RuntimeTool {
  return {
    name: "todo_write",
    description: "Replace durable workspace todo items.",
    requiresApproval: true,
    parameters: {
      type: "object",
      properties: { items: { type: "array" } },
      required: ["items"],
      additionalProperties: false,
    },
    async execute(input, context) {
      const args = requireObject(input);
      if (!Array.isArray(args.items)) throw new Error("items must be an array");
      const items = args.items.map((item) => {
        const value = requireObject(item);
        const status = requireString(value.status, "items.status");
        if (!["pending", "in_progress", "completed"].includes(status))
          throw new Error("items.status is invalid");
        return {
          content: requireString(value.content, "items.content"),
          status,
        } as TodoItem;
      });
      await mkdir(resolve(context.workspaceRoot, ".natalia"), {
        recursive: true,
      });
      await writeFile(
        resolve(context.workspaceRoot, ".natalia", "todos.json"),
        `${JSON.stringify(items, null, 2)}\n`,
        { mode: 0o600 },
      );
      return `saved ${items.length} todo items`;
    },
  };
}

function askUserTool(): RuntimeTool {
  return {
    name: "ask_user",
    description:
      "Ask the user a structured question and wait for their answer.",
    requiresApproval: false,
    parameters: {
      type: "object",
      properties: {
        title: { type: "string" },
        question: { type: "string" },
        options: { type: "array" },
        multiple: { type: "boolean" },
      },
      required: ["question", "options"],
      additionalProperties: false,
    },
    async execute(input, context) {
      if (!context.askQuestion)
        throw new Error("interactive question channel unavailable");
      const args = requireObject(input);
      if (!Array.isArray(args.options))
        throw new Error("options must be an array");
      const options = args.options.map((item) => ({ label: String(item) }));
      const answers = await context.askQuestion({
        title: optionalString(args.title) ?? "Question from Natalia",
        questions: [
          {
            id: "question_0",
            header: "Question",
            question: requireString(args.question, "question"),
            options,
            multiple: args.multiple === true,
            custom: true,
          },
        ],
      });
      return JSON.stringify({ answers }, null, 2);
    },
  };
}

async function readTodos(workspaceRoot: string): Promise<TodoItem[]> {
  try {
    const parsed = JSON.parse(
      await readFile(resolve(workspaceRoot, ".natalia", "todos.json"), "utf8"),
    ) as TodoItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

function readFileTool(): RuntimeTool {
  return {
    name: "read_file",
    description: "Read a UTF-8 text file inside the workspace.",
    requiresApproval: false,
    parameters: {
      type: "object",
      properties: { path: { type: "string" } },
      required: ["path"],
      additionalProperties: false,
    },
    async execute(input, context) {
      const args = requireObject(input);
      const path = workspacePath(
        context.workspaceRoot,
        requireString(args.path, "path"),
      );
      return await readFile(path, "utf8");
    },
  };
}

function writeFileTool(): RuntimeTool {
  return {
    name: "write_file",
    description: "Write a UTF-8 text file inside the workspace.",
    requiresApproval: true,
    parameters: {
      type: "object",
      properties: {
        path: { type: "string" },
        content: { type: "string" },
        mode: { type: "number" },
      },
      required: ["path", "content"],
      additionalProperties: false,
    },
    async execute(input, context) {
      const args = requireObject(input);
      const path = workspacePath(
        context.workspaceRoot,
        requireString(args.path, "path"),
      );
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, requireString(args.content, "content"));
      if (typeof args.mode === "number") await chmod(path, args.mode);
      return `wrote ${relative(context.workspaceRoot, path)}`;
    },
  };
}

function editFileTool(): RuntimeTool {
  return {
    name: "edit_file",
    description: "Replace exact text inside a UTF-8 workspace file.",
    requiresApproval: true,
    parameters: {
      type: "object",
      properties: {
        path: { type: "string" },
        oldText: { type: "string" },
        newText: { type: "string" },
      },
      required: ["path", "oldText", "newText"],
      additionalProperties: false,
    },
    async execute(input, context) {
      const args = requireObject(input);
      const path = workspacePath(
        context.workspaceRoot,
        requireString(args.path, "path"),
      );
      const oldText = requireString(args.oldText, "oldText");
      const current = await readFile(path, "utf8");
      if (!current.includes(oldText)) throw new Error("oldText not found");
      const next = current.replace(
        oldText,
        requireString(args.newText, "newText"),
      );
      await writeFile(path, next);
      return `edited ${relative(context.workspaceRoot, path)}`;
    },
  };
}

function runShellTool(): RuntimeTool {
  return {
    name: "run_shell",
    description:
      "Run a shell command inside the workspace with output capture. The shell is always bash-compatible (Git Bash on Windows, native bash on Linux/Mac) — use POSIX syntax, not cmd.exe.",
    requiresApproval: true,
    timeoutSec: 120,
    parameters: {
      type: "object",
      properties: {
        command: { type: "string" },
        timeoutSec: { type: "number" },
      },
      required: ["command"],
      additionalProperties: false,
    },
    async execute(input, context) {
      const args = requireObject(input);
      return await runShell(
        requireString(args.command, "command"),
        context,
        numberOr(args.timeoutSec, 120),
      );
    },
  };
}

function webFetchTool(): RuntimeTool {
  return {
    name: "web_fetch",
    description: "Fetch an HTTP or HTTPS URL and return text content.",
    requiresApproval: false,
    timeoutSec: 30,
    parameters: {
      type: "object",
      properties: { url: { type: "string" }, maxBytes: { type: "number" } },
      required: ["url"],
      additionalProperties: false,
    },
    async execute(input, context) {
      const args = requireObject(input);
      const url = requireString(args.url, "url");
      if (!/^https?:\/\//iu.test(url))
        throw new Error("web_fetch requires http(s) URL");
      assertNetworkURL(url, context);
      const response = await fetch(url, { signal: context.signal });
      const text = await response.text();
      return [
        `status=${response.status}`,
        `content-type=${response.headers.get("content-type") ?? "unknown"}`,
        text.slice(0, numberOr(args.maxBytes, 20000)),
      ].join("\n");
    },
  };
}

function webSearchTool(): RuntimeTool {
  return {
    name: "web_search",
    description:
      "Search the web through a configured endpoint, or DuckDuckGo HTML when no endpoint is configured.",
    requiresApproval: false,
    timeoutSec: 30,
    parameters: {
      type: "object",
      properties: { query: { type: "string" }, maxBytes: { type: "number" } },
      required: ["query"],
      additionalProperties: false,
    },
    async execute(input, context) {
      const args = requireObject(input);
      const search = selectWebSearchSource({
        endpoint:
          context.settings?.webSearchEndpoint ??
          process.env.NATALIA_WEB_SEARCH_URL,
        priority: context.settings?.webSearchProviderPriority,
      });
      const endpoint = search.endpoint;
      const url = new URL(endpoint);
      url.searchParams.set("q", requireString(args.query, "query"));
      assertNetworkURL(url.href, context);
      const response = await fetch(url, {
        headers: { "user-agent": "Natalia-TS7-Search/0.1" },
        signal: context.signal,
      });
      const text = await response.text();
      if (!response.ok)
        throw new Error(
          `web_search failed: HTTP ${response.status} from ${url.origin}`,
        );
      return [
        `status=${response.status}`,
        `content-type=${response.headers.get("content-type") ?? "unknown"}`,
        `source=${search.label}`,
        text.slice(0, numberOr(args.maxBytes, 20000)),
      ].join("\n");
    },
  };
}

function selectWebSearchSource(input: {
  endpoint?: string;
  priority?: string[];
}) {
  const priority = input.priority?.length
    ? input.priority
    : input.endpoint
      ? ["configured", "duckduckgo"]
      : ["duckduckgo"];
  for (const provider of priority) {
    if (provider === "configured" && input.endpoint)
      return { endpoint: input.endpoint, label: "configured endpoint" };
    if (provider === "duckduckgo")
      return {
        endpoint: "https://html.duckduckgo.com/html/",
        label: "DuckDuckGo HTML",
      };
  }
  if (input.endpoint)
    return {
      endpoint: input.endpoint,
      label: "configured endpoint (priority fallback)",
    };
  return {
    endpoint: "https://html.duckduckgo.com/html/",
    label: "DuckDuckGo HTML (priority fallback)",
  };
}

function readMediaFileTool(): RuntimeTool {
  return {
    name: "read_media_file",
    description:
      "Read binary/media file metadata inside the workspace without injecting raw bytes into context.",
    requiresApproval: false,
    parameters: {
      type: "object",
      properties: { path: { type: "string" } },
      required: ["path"],
      additionalProperties: false,
    },
    async execute(input, context) {
      const path = workspacePath(
        context.workspaceRoot,
        requireString(requireObject(input).path, "path"),
      );
      const info = await stat(path);
      const data = await readFile(path);
      return JSON.stringify(
        {
          path: relative(context.workspaceRoot, path),
          size: info.size,
          mode: info.mode.toString(8),
          sha256: createHash("sha256").update(data).digest("hex"),
          kind: mediaKind(data),
        },
        null,
        2,
      );
    },
  };
}

function browserVisitTool(): RuntimeTool {
  return {
    name: "browser_visit",
    description:
      "Visit an HTTP(S) page through the TS runtime fetch-based browser adapter and return document metadata/text preview.",
    requiresApproval: false,
    timeoutSec: 30,
    parameters: {
      type: "object",
      properties: { url: { type: "string" }, maxBytes: { type: "number" } },
      required: ["url"],
      additionalProperties: false,
    },
    async execute(input, context) {
      if (context.settings?.browserEnabled === false)
        throw new Error("browser tools are disabled by runtime configuration");
      const args = requireObject(input);
      const url = requireString(args.url, "url");
      if (!/^https?:\/\//iu.test(url))
        throw new Error("browser_visit requires http(s) URL");
      assertNetworkURL(url, context);
      const response = await fetch(url, {
        headers: {
          "user-agent":
            context.settings?.browserUserAgent || "Natalia-TS7-Browser/0.1",
          ...context.settings?.browserHeaders,
        },
        signal: context.signal,
      });
      const html = await response.text();
      return JSON.stringify(
        {
          url: response.url,
          status: response.status,
          title: html.match(/<title[^>]*>([\s\S]*?)<\/title>/iu)?.[1]?.trim(),
          textPreview: html
            .replace(/<script[\s\S]*?<\/script>/giu, " ")
            .replace(/<style[\s\S]*?<\/style>/giu, " ")
            .replace(/<[^>]+>/gu, " ")
            .replace(/\s+/gu, " ")
            .trim()
            .slice(0, numberOr(args.maxBytes, 12000)),
          contentType: response.headers.get("content-type") ?? "unknown",
        },
        null,
        2,
      );
    },
  };
}

function browserScreenshotTool(): RuntimeTool {
  return {
    name: "browser_screenshot",
    description:
      "Capture a real page screenshot through a Chrome/Chromium binary when available; otherwise emit an explicit TS diagnostic.",
    requiresApproval: true,
    timeoutSec: 60,
    parameters: {
      type: "object",
      properties: {
        url: { type: "string" },
        path: { type: "string" },
        width: { type: "number" },
        height: { type: "number" },
      },
      required: ["url", "path"],
      additionalProperties: false,
    },
    async execute(input, context) {
      if (context.settings?.browserEnabled === false)
        throw new Error("browser tools are disabled by runtime configuration");
      const args = requireObject(input);
      const url = requireString(args.url, "url");
      const output = workspacePath(
        context.workspaceRoot,
        requireString(args.path, "path"),
      );
      await mkdir(dirname(output), { recursive: true });
      const chrome =
        context.settings?.browserBinary ??
        process.env.NATALIA_CHROME_BIN ??
        (await firstExecutable([
          "chromium",
          "chromium-browser",
          "google-chrome",
          "chrome",
          "msedge",
        ]));
      if (!chrome)
        throw new Error(
          "browser_screenshot requires Chrome/Chromium; set NATALIA_CHROME_BIN to enable the TS native browser adapter",
        );
      assertNetworkURL(url, context);
      const profile = context.settings?.browserPersistentProfile
        ? context.settings.browserProfileDir
          ? ` --user-data-dir=${shellQuote(workspacePath(context.workspaceRoot, context.settings.browserProfileDir))}`
          : ""
        : "";
      const locale = context.settings?.browserLocale
        ? ` --lang=${shellQuote(context.settings.browserLocale)}`
        : "";
      const timezone = context.settings?.browserTimezone
        ? ` --timezone=${shellQuote(context.settings.browserTimezone)}`
        : "";
      await runShell(
        `${shellQuote(chrome)} --headless=new --disable-gpu --no-sandbox --window-size=${Math.trunc(numberOr(args.width, 1280))},${Math.trunc(numberOr(args.height, 720))}${profile}${locale}${timezone} --screenshot=${shellQuote(output)} ${shellQuote(url)}`,
        context,
        60,
      );
      return JSON.stringify({ path: relative(context.workspaceRoot, output) });
    },
  };
}

async function runShell(
  command: string,
  context: ToolExecutionContext,
  timeoutSec: number,
) {
  await stat(context.workspaceRoot);
  const shell = profileShellCommand(command);
  return await new Promise<string>((resolvePromise, reject) => {
    const child = spawn(shell.executable, shell.args, {
      cwd: context.workspaceRoot,
      detached: true,
      stdio: ["ignore", "pipe", "pipe"],
      env: safeToolEnv(context.settings?.envAllowlist),
    });
    let settled = false;
    const finish = (result: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      context.signal?.removeEventListener("abort", abort);
      result();
    };
    const abort = () => {
      terminateChildProcessTree(child.pid);
      finish(() =>
        reject(context.signal?.reason ?? new Error("command cancelled")),
      );
    };
    const timer = setTimeout(() => {
      terminateChildProcessTree(child.pid);
      finish(() => reject(new Error(`command timed out after ${timeoutSec}s`)));
    }, timeoutSec * 1000);
    context.signal?.addEventListener("abort", abort, { once: true });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => (stdout += String(chunk)));
    child.stderr.on("data", (chunk) => (stderr += String(chunk)));
    child.on("error", (error) => {
      finish(() => reject(error));
    });
    child.on("close", (code) => {
      const output = [
        `exit=${code}`,
        stdout && `stdout:\n${stdout}`,
        stderr && `stderr:\n${stderr}`,
      ]
        .filter(Boolean)
        .join("\n");
      if (code === 0) finish(() => resolvePromise(output));
      else finish(() => reject(new Error(output)));
    });
  });
}

function assertNetworkURL(input: string, context: ToolExecutionContext) {
  const url = new URL(input);
  const allowedSchemes = context.settings?.allowedSchemes ?? ["https", "http"];
  if (!allowedSchemes.includes(url.protocol.slice(0, -1)))
    throw new Error(`network scheme is not allowed: ${url.protocol}`);
  const host = url.hostname.toLowerCase();
  const allowed = context.settings?.allowedHosts ?? [];
  const allowedGroups = context.settings?.allowedHostGroups ?? [allowed];
  const denied = context.settings?.deniedHosts ?? [];
  if (denied.some((pattern) => hostMatches(host, pattern)))
    throw new Error(`network host denied: ${host}`);
  if (
    allowedGroups.some(
      (group) =>
        group.length && !group.some((pattern) => hostMatches(host, pattern)),
    )
  )
    throw new Error(`network host is not allowed: ${host}`);
  const localhost =
    host === "localhost" || host === "::1" || host.startsWith("127.");
  if (localhost && context.settings?.allowLocalhost === false)
    throw new Error(`localhost network access is not allowed: ${host}`);
  const privateAddress = /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/u.test(
    host,
  );
  if (privateAddress && context.settings?.allowPrivate === false)
    throw new Error(`private network access is not allowed: ${host}`);
}

function hostMatches(host: string, pattern: string) {
  const normalized = pattern.toLowerCase();
  return normalized.startsWith("*.")
    ? host.endsWith(normalized.slice(1))
    : host === normalized;
}

function mediaKind(data: Uint8Array) {
  const hex = [...data.slice(0, 12)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  if (hex.startsWith("89504e47")) return "png";
  if (hex.startsWith("ffd8ff")) return "jpeg";
  if (hex.startsWith("25504446")) return "pdf";
  if (hex.startsWith("47494638")) return "gif";
  return "binary";
}

async function firstExecutable(names: string[]) {
  // Resolved without a shell. The previous `bash -lc "command -v"` probe was
  // the one call site that bypassed the platform shell helper, and on Windows
  // a bare `bash` is the WSL launcher rather than Git bash, so the lookup ran
  // inside a Linux distro and could never see a Windows browser. Bun.which
  // performs the same PATH resolution on POSIX without spawning anything.
  for (const name of names) {
    const resolved = Bun.which(name);
    if (resolved) return resolved;
  }
  // Windows installers do not put browsers on PATH, so PATH resolution alone
  // never finds an installed Chrome or Edge. POSIX has no such well-known
  // locations and skips this entirely.
  if (!isWindows()) return undefined;
  const env = process.env;
  const roots = [
    env.LOCALAPPDATA,
    env.ProgramFiles,
    env.ProgramW6432,
    env["ProgramFiles(x86)"],
  ].filter((root): root is string => Boolean(root));
  const relative = [
    join("Google", "Chrome", "Application", "chrome.exe"),
    join("Chromium", "Application", "chrome.exe"),
    join("Microsoft", "Edge", "Application", "msedge.exe"),
  ];
  for (const root of roots)
    for (const suffix of relative) {
      const candidate = join(root, suffix);
      if (existsSync(candidate)) return candidate;
    }
  return undefined;
}
