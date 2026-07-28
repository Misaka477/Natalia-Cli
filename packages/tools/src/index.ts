import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { chmod, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { SubagentRegistry } from "@natalia/subagent";
import {
  TerminalRegistry,
  type TerminalSessionInfo,
  type TerminalSessionUpdate,
} from "@natalia/terminal";
import {
  NativeTerminalRegistry,
  type NativeTerminalSession,
} from "@natalia/native-terminal";
import { WorkspaceSandboxManager } from "@natalia/sandbox";

import { createWorkflowTools } from "./workflow-tools";
export { createWorkflowTools };
export { validateToolParameters, assertValidToolParameters } from "./validate";
export {
  boundToolOutput,
  cleanupToolOutput,
  MAX_TOOL_OUTPUT_BYTES,
  MAX_TOOL_OUTPUT_LINES,
  TOOL_OUTPUT_RETENTION_MS,
} from "./output";
export { materializeTools } from "./invocation";
export type {
  ToolInvocation,
  ToolMaterialization,
  ToolSettlement,
} from "./invocation";
export type ToolExecutionBoundary = {
  name: string;
  requiresApproval: boolean;
  timeoutSec?: number;
};

export type ToolSchema = {
  type: "object";
  properties: Record<string, unknown>;
  required?: string[];
  additionalProperties?: boolean;
};

export type RuntimeTool = ToolExecutionBoundary & {
  description: string;
  parameters: ToolSchema;
  execute(input: unknown, context: ToolExecutionContext): Promise<string>;
};

export type ToolExecutionContext = {
  workspaceRoot: string;
  signal?: AbortSignal;
  askQuestion?: (input: {
    title: string;
    questions: Array<{
      id: string;
      header: string;
      question: string;
      options: Array<{ label: string; description?: string }>;
      multiple?: boolean;
      custom?: boolean;
    }>;
  }) => Promise<string[][]>;
  subagents?: SubagentRegistry;
  terminalRegistry?: TerminalRegistry;
  nativeTerminal?: NativeTerminalRegistry;
  onPTYUpdate?: (session: TerminalSessionUpdate) => void;
  onPTYAction?: (
    session: TerminalSessionInfo,
    action:
      | "write"
      | "submit"
      | "special_key"
      | "resize"
      | "attach"
      | "detach"
      | "exit",
    redacted: boolean,
  ) => void;
  sandboxes?: WorkspaceSandboxManager;
  workspaceReadAuthorize?: (input: {
    toolName: "glob" | "grep";
    paths: string[];
  }) => Promise<void>;
  sandboxMergeAuthorize?: (input: {
    id: string;
    paths: string[];
  }) => Promise<void>;
  onSandboxEvent?: (event: { type: string; [key: string]: unknown }) => void;
  settings?: {
    webSearchEndpoint?: string;
    webSearchProviderPriority?: string[];
    browserBinary?: string;
    browserEnabled?: boolean;
    browserUserAgent?: string;
    browserHeaders?: Record<string, string>;
    browserPersistentProfile?: boolean;
    browserProfileDir?: string;
    browserLocale?: string;
    browserTimezone?: string;
    allowedHosts?: string[];
    allowedSchemes?: string[];
    allowLocalhost?: boolean;
    allowPrivate?: boolean;
    deniedHosts?: string[];
    envAllowlist?: string[];
  };
  parentSessionID?: string;
  parentAgentID?: string;
  maxSubagentDepth?: number;
  onWorkflowEvent?: (event: {
    runID: string;
    workflow: string;
    status: "running" | "completed" | "failed" | "cancelled";
    event:
      | "run_started"
      | "run_completed"
      | "run_cancelled"
      | "step_started"
      | "step_completed"
      | "step_failed";
    stepID?: string;
    result?: string;
    error?: string;
  }) => void;
  workflowAuthorize?: (request: {
    kind: "tool" | "script";
    stepID: string;
    toolName?: string;
    arguments?: unknown;
    command?: string;
    timeoutMs?: number;
  }) => Promise<void>;
};

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

export type ManagedProcessStatus = "running" | "exited" | "failed" | "stopped";

export type ManagedProcessInfo = {
  id: string;
  command: string;
  cwd: string;
  status: ManagedProcessStatus;
  attached: boolean;
  persistent: boolean;
  pid?: number;
  exitCode?: number | null;
  startedAt: string;
  endedAt?: string;
  output: string;
  ready?: boolean;
  readyPattern?: string;
  maxOutputBytes?: number;
  stopTimeoutMs?: number;
  maxRuntimeMs?: number;
  deadlineAt?: string;
};

export class ManagedProcessRegistry {
  private processes = new Map<string, Map<string, ManagedProcessRuntime>>();
  private deadlines = new Map<string, ReturnType<typeof setTimeout>>();
  private sequences = new Map<string, number>();
  private loadedRoots = new Set<string>();

  async start(
    command: string,
    context: ToolExecutionContext,
    id?: string,
    options: {
      readyPattern?: string;
      maxOutputBytes?: number;
      stopTimeoutMs?: number;
      maxRuntimeMs?: number;
    } = {},
  ) {
    await this.load(context);
    const processes = this.workspaceProcesses(context);
    const processID = id ?? `proc_${this.nextSequence(context).toString(36)}`;
    if (processes.has(processID))
      throw new Error(`process already exists: ${processID}`);
    const processDir = resolve(context.workspaceRoot, ".natalia", "processes");
    await mkdir(processDir, { recursive: true });
    const outputPath = resolve(processDir, `${processID}.log`);
    const launcher = Bun.spawn(
      [
        "bash",
        "-lc",
        `setsid bash -c ${shellQuote(command)} > ${shellQuote(outputPath)} 2>&1 & echo $!`,
      ],
      {
        cwd: context.workspaceRoot,
        env: safeToolEnv(context.settings?.envAllowlist),
        stdout: "pipe",
        stderr: "pipe",
      },
    );
    const pid = Number((await new Response(launcher.stdout).text()).trim());
    const stderr = await new Response(launcher.stderr).text();
    const launcherExit = await launcher.exited;
    if (!Number.isFinite(pid) || launcherExit !== 0)
      throw new Error(`failed to start process: ${stderr}`);
    const info: ManagedProcessRuntime = {
      id: processID,
      command,
      cwd: context.workspaceRoot,
      status: "running",
      attached: true,
      persistent: true,
      pid,
      startedAt: new Date().toISOString(),
      output: "",
      outputPath,
      ready: false,
      readyPattern: options.readyPattern,
      maxOutputBytes: options.maxOutputBytes ?? 20000,
      stopTimeoutMs: options.stopTimeoutMs ?? 1000,
      maxRuntimeMs: options.maxRuntimeMs,
      deadlineAt: options.maxRuntimeMs
        ? new Date(Date.now() + options.maxRuntimeMs).toISOString()
        : undefined,
      ...(await processFingerprint(pid)),
    };
    processes.set(processID, info);
    await this.save(context);
    this.scheduleDeadline(info, context);
    return publicProcessInfo(info);
  }

  async list(context: ToolExecutionContext) {
    await this.load(context);
    return [...this.workspaceProcesses(context).values()].map((info) =>
      publicProcessInfo(refreshProcessStatus(info)),
    );
  }

  async runningCount(context: ToolExecutionContext): Promise<number> {
    await this.load(context);
    return [...this.workspaceProcesses(context).values()].filter(
      (info) => refreshProcessStatus(info).status === "running",
    ).length;
  }

  async get(id: string, context: ToolExecutionContext) {
    await this.load(context);
    const info = this.workspaceProcesses(context).get(id);
    if (!info) throw new Error(`process not found: ${id}`);
    return publicProcessInfo(refreshProcessStatus(info));
  }

  async output(id: string, context: ToolExecutionContext) {
    await this.load(context);
    const info = this.workspaceProcesses(context).get(id);
    if (!info) throw new Error(`process not found: ${id}`);
    const rawOutput = await readOptionalFile(info.outputPath);
    info.output = truncateProcessOutput(rawOutput, info.maxOutputBytes);
    if (info.readyPattern && new RegExp(info.readyPattern).test(rawOutput))
      info.ready = true;
    refreshProcessStatus(info);
    return info.output;
  }

  async stop(id: string, context: ToolExecutionContext) {
    await this.load(context);
    const info = this.workspaceProcesses(context).get(id);
    if (!info) throw new Error(`process not found: ${id}`);
    this.clearDeadline(this.deadlineKey(context, id));
    if (info.status === "running" && info.pid)
      await stopProcessTree(
        info.pid,
        info.stopTimeoutMs ?? 1000,
        info.pidStartTicks,
      );
    info.status = "stopped";
    info.endedAt = new Date().toISOString();
    await this.save(context);
    return publicProcessInfo(info);
  }

  async restart(id: string, context: ToolExecutionContext) {
    const current = await this.get(id, context);
    if (current.status === "running") await this.stop(id, context);
    this.workspaceProcesses(context).delete(id);
    return await this.start(current.command, context, id, {
      readyPattern: current.readyPattern,
      maxOutputBytes: current.maxOutputBytes,
      stopTimeoutMs: current.stopTimeoutMs,
      maxRuntimeMs: current.maxRuntimeMs,
    });
  }

  async attach(id: string, context: ToolExecutionContext) {
    await this.load(context);
    const info = this.workspaceProcesses(context).get(id);
    if (!info) throw new Error(`process not found: ${id}`);
    info.attached = true;
    await this.save(context);
    return publicProcessInfo(refreshProcessStatus(info));
  }

  async detach(id: string, context: ToolExecutionContext) {
    await this.load(context);
    const info = this.workspaceProcesses(context).get(id);
    if (!info) throw new Error(`process not found: ${id}`);
    info.attached = false;
    await this.save(context);
    return publicProcessInfo(refreshProcessStatus(info));
  }

  async cleanup(context: ToolExecutionContext) {
    await this.load(context);
    let removed = 0;
    const processes = this.workspaceProcesses(context);
    for (const [id, info] of processes) {
      refreshProcessStatus(info);
      if (info.status !== "running") {
        processes.delete(id);
        this.clearDeadline(this.deadlineKey(context, id));
        removed++;
      }
    }
    await this.save(context);
    return { removed, remaining: processes.size };
  }

  async audit(context: ToolExecutionContext) {
    await this.load(context);
    return {
      root: resolve(context.workspaceRoot),
      processes: [...this.workspaceProcesses(context).values()].map((info) =>
        publicProcessInfo(refreshProcessStatus(info)),
      ),
    };
  }

  async waitForReady(
    id: string,
    context: ToolExecutionContext,
    timeoutMs = 30000,
  ) {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      await this.output(id, context);
      const info = this.workspaceProcesses(context).get(id)!;
      if (!info.readyPattern || info.ready) return publicProcessInfo(info);
      if (info.status !== "running")
        throw new Error(`process exited before ready: ${id}`);
      await Bun.sleep(50);
    }
    throw new Error(`process ready timeout: ${id}`);
  }

  private async load(context: ToolExecutionContext) {
    const root = resolve(context.workspaceRoot);
    if (this.loadedRoots.has(root)) return;
    this.loadedRoots.add(root);
    try {
      const parsed = JSON.parse(
        await readFile(
          resolve(root, ".natalia", "processes", "processes.json"),
          "utf8",
        ),
      ) as { processes?: ManagedProcessRuntime[] };
      for (const info of parsed.processes ?? []) {
        if (!info.id || !info.command || !info.outputPath) continue;
        const restored = await refreshPersistedProcessStatus(info);
        this.workspaceProcesses(context).set(restored.id, restored);
        if (
          restored.status === "running" &&
          restored.deadlineAt &&
          new Date(restored.deadlineAt).getTime() <= Date.now()
        )
          await this.stop(restored.id, context);
        else this.scheduleDeadline(restored, context);
        const match = info.id.match(/^proc_([0-9a-z]+)$/u);
        if (match)
          this.sequences.set(
            root,
            Math.max(this.sequences.get(root) ?? 0, parseInt(match[1]!, 36)),
          );
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }

  private async save(context: ToolExecutionContext) {
    const processDir = resolve(context.workspaceRoot, ".natalia", "processes");
    await mkdir(processDir, { recursive: true, mode: 0o700 });
    await writeFile(
      resolve(processDir, "processes.json"),
      `${JSON.stringify({ processes: [...this.workspaceProcesses(context).values()] }, null, 2)}\n`,
      { mode: 0o600 },
    );
  }

  private scheduleDeadline(
    info: ManagedProcessRuntime,
    context: ToolExecutionContext,
  ) {
    this.clearDeadline(this.deadlineKey(context, info.id));
    if (info.status !== "running" || !info.deadlineAt) return;
    const delay = new Date(info.deadlineAt).getTime() - Date.now();
    if (!Number.isFinite(delay)) return;
    const timer = setTimeout(
      () => void this.stop(info.id, context),
      Math.max(0, delay),
    );
    timer.unref();
    this.deadlines.set(this.deadlineKey(context, info.id), timer);
  }

  private clearDeadline(key: string) {
    const timer = this.deadlines.get(key);
    if (timer) clearTimeout(timer);
    this.deadlines.delete(key);
  }

  private workspaceProcesses(context: ToolExecutionContext) {
    const root = resolve(context.workspaceRoot);
    let processes = this.processes.get(root);
    if (!processes) {
      processes = new Map();
      this.processes.set(root, processes);
    }
    return processes;
  }

  private nextSequence(context: ToolExecutionContext) {
    const root = resolve(context.workspaceRoot);
    const next = (this.sequences.get(root) ?? 0) + 1;
    this.sequences.set(root, next);
    return next;
  }

  private deadlineKey(context: ToolExecutionContext, id: string) {
    return `${resolve(context.workspaceRoot)}\0${id}`;
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
  let registryRef: ToolRegistry | undefined;
  const lazyWorkflowTools = createWorkflowTools(() => {
    if (!registryRef) throw new Error("tool registry not initialized");
    return registryRef;
  });

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
    processStartTool(processRegistry),
    processListTool(processRegistry),
    processStatusTool(processRegistry),
    processOutputTool(processRegistry),
    processReadyTool(processRegistry),
    processStopTool(processRegistry),
    processRestartTool(processRegistry),
    processAttachTool(processRegistry),
    processDetachTool(processRegistry),
    processCleanupTool(processRegistry),
    processAuditTool(processRegistry),
    backgroundStartTool(processRegistry),
    backgroundListTool(processRegistry),
    backgroundOutputTool(processRegistry),
    backgroundStopTool(processRegistry),
    backgroundRestartTool(processRegistry),
    backgroundCleanupTool(processRegistry),
    backgroundAuditTool(processRegistry),
    webFetchTool(),
    webSearchTool(),
    readMediaFileTool(),
    browserVisitTool(),
    browserScreenshotTool(),
    ...lazyWorkflowTools,
  ];

  registryRef = new ToolRegistry(tools.map((t) => [t.name, t]));
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

function requireTerminalRegistry(context: ToolExecutionContext) {
  if (!context.terminalRegistry)
    throw new Error("interactive terminal runtime unavailable");
  return context.terminalRegistry;
}

function requireNativeTerminal(context: ToolExecutionContext) {
  if (!context.nativeTerminal)
    throw new Error(
      "Native Terminal Host is unavailable. Install the Natalia WezTerm distribution to start an interactive terminal.",
    );
  return context.nativeTerminal;
}

function notifyPTY(
  context: ToolExecutionContext,
  session: TerminalSessionInfo,
  action?:
    | "write"
    | "submit"
    | "special_key"
    | "resize"
    | "attach"
    | "detach"
    | "exit",
  redacted = false,
) {
  context.onPTYUpdate?.(session);
  if (action) context.onPTYAction?.(session, action, redacted);
  return JSON.stringify(modelTerminalInfo(session), null, 2);
}

function modelTerminalInfo(session: TerminalSessionInfo) {
  const { lines: _lines, ...screen } = session.screen;
  return {
    ...session,
    screen,
  };
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
      "Start a real interactive Terminal session inside the workspace.",
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

export function nativeTerminalSearchPage(
  text: string,
  input: {
    query: string;
    startLine: number;
    endLine: number;
    requestedEndLine?: number;
    maxMatches: number;
  },
) {
  const lines = text.split("\n");
  if (lines.at(-1) === "") lines.pop();
  const matches = lines
    .flatMap((line, index) =>
      line.includes(input.query)
        ? [{ line: input.startLine + index, text: truncateTerminalLine(line) }]
        : [],
    )
    .slice(0, input.maxMatches);
  const scannedEndLine = input.startLine + Math.max(0, lines.length - 1);
  return {
    query: input.query,
    searchedRange: {
      startLine: input.startLine,
      endLine: Math.min(input.endLine, scannedEndLine),
      scannedLines: lines.length,
    },
    matches,
    truncatedMatches: matches.length === input.maxMatches,
    nextCursor:
      lines.length === 200 &&
      (input.requestedEndLine === undefined ||
        scannedEndLine < input.requestedEndLine)
        ? {
            startLine: scannedEndLine + 1,
            ...(input.requestedEndLine === undefined
              ? {}
              : { endLine: input.requestedEndLine }),
          }
        : undefined,
  };
}

function truncateTerminalLine(line: string) {
  return nativeTerminalReadPage(line, {}, 1_024).text;
}

export function nativeTerminalReadPage(
  text: string,
  input: { startLine?: number; endLine?: number },
  maxBytes = 16_384,
) {
  const bytes = Buffer.from(text);
  const totalBytes = bytes.byteLength;
  if (totalBytes <= maxBytes)
    return {
      text,
      totalBytes,
      truncated: false,
      deliveredLines: deliveredLineCount(text),
      endLine:
        input.startLine === undefined
          ? undefined
          : input.startLine + deliveredLineCount(text) - 1,
      nextStartLine: undefined,
    };
  let end = maxBytes;
  while (end > 0 && (bytes[end]! & 0xc0) === 0x80) end--;
  const boundary = bytes.subarray(0, end).toString("utf8");
  const newline = boundary.lastIndexOf("\n");
  const pageText = newline >= 0 ? boundary.slice(0, newline + 1) : boundary;
  const deliveredLines = deliveredLineCount(pageText);
  return {
    text: pageText,
    totalBytes,
    truncated: true,
    deliveredLines,
    endLine:
      input.startLine === undefined
        ? undefined
        : input.startLine + deliveredLines - 1,
    nextStartLine:
      input.startLine === undefined || deliveredLines === 0
        ? undefined
        : input.startLine + deliveredLines,
  };
}

function deliveredLineCount(text: string) {
  if (!text) return 0;
  const lines = text.split("\n");
  return lines.at(-1) === "" ? lines.length - 1 : lines.length;
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
        if (context.nativeTerminal) {
          const snapshot = await context.nativeTerminal.snapshot(id);
          return JSON.stringify({
            id,
            host: "wezterm",
            revision: snapshot.revision,
            currentRevision: snapshot.revision,
            afterRevision,
            changed: snapshot.revision > afterRevision,
            reason: snapshot.revision > afterRevision ? "changed" : "timeout",
            cursorX: snapshot.cursorX,
            cursorY: snapshot.cursorY,
            rows: snapshot.rows,
            cols: snapshot.cols,
            mode,
            text: truncateProcessOutput(snapshot.text, 16_384),
          });
        }
        const registry = requireTerminalRegistry(context);
        const info = registry.get(id);
        const { lines: _lines, ...screen } = info.screen;
        const { id: _id, ...rest } = info;
        return JSON.stringify({
          id,
          ...rest,
          screen,
          revision: info.revision,
          currentRevision: info.revision,
          afterRevision,
          changed: info.revision > afterRevision,
          reason: info.revision > afterRevision ? "changed" : "timeout",
          mode,
        });
      }
      if (context.nativeTerminal) {
        await context.nativeTerminal.reconcile();
        const observation = await context.nativeTerminal.observe(
          id,
          afterRevision,
          {
            maxLines: Math.max(
              1,
              Math.min(numberOr(args.scrollbackRows, 60), 200),
            ),
            timeoutMs: Math.max(
              1_000,
              Math.min(numberOr(args.timeoutMs, 5_000), 30_000),
            ),
          },
        );
        let text = observation.text;
        const session = context.nativeTerminal.session(id);
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
        context.nativeTerminal.markObserved(
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
      }
      const registry = requireTerminalRegistry(context);
      const ptyObservation = await registry.observe(id, {
        afterRevision,
        timeoutMs: numberOr(args.timeoutMs, 30_000),
        signal: context.signal,
      });
      if (ptyObservation.session.screen)
        context.onPTYUpdate?.(
          ptyObservation.session as import("@natalia/terminal").TerminalSessionInfo,
        );
      const ptySession = registry.session(id);
      let ptyText = ptySession.transcript || "";
      const previousPtyText = ptySession.lastObservedText;
      if (mode === "tail") {
        const lines = ptyText.split("\n");
        if (lines.at(-1) === "") lines.pop();
        const tailLines = Math.max(
          1,
          Math.min(numberOr(args.scrollbackRows, 60), 200),
        );
        ptyText = lines.slice(-tailLines).join("\n");
      } else if (mode === "cursor") {
        const lines = ptyText.split("\n");
        if (lines.at(-1) === "") lines.pop();
        const cursorY = ptyObservation.session.screen?.cursor?.row ?? 0;
        const contextLines = 10;
        const startLine = Math.max(0, cursorY - contextLines);
        const endLine = Math.min(lines.length, cursorY + contextLines + 1);
        ptyText = lines.slice(startLine, endLine).join("\n");
      } else if (mode === "new_only") {
        if (previousPtyText && ptyText.startsWith(previousPtyText)) {
          ptyText = ptyText.slice(previousPtyText.length);
        }
      }
      registry.markObserved(
        id,
        ptySession.transcript,
        ptyObservation.session.revision,
      );
      const scrollbackRows = Math.max(
        0,
        Math.min(numberOr(args.scrollbackRows, 0), 200),
      );
      return JSON.stringify(
        {
          ...ptyObservation,
          session: ptyObservation.session.screen
            ? modelTerminalInfo(
                ptyObservation.session as import("@natalia/terminal").TerminalSessionInfo,
              )
            : ptyObservation.session,
          text: truncateProcessOutput(ptyText, 16_384),
          mode,
          currentRevision: ptyObservation.session.revision,
          ...(scrollbackRows
            ? {
                scrollback: modelTerminalScrollback(
                  registry.scrollback(ptyObservation.session.id, {
                    maxRows: scrollbackRows,
                  }),
                ),
              }
            : {}),
        },
        null,
        2,
      );
    },
  };
}

function modelTerminalScrollback(
  scrollback: ReturnType<TerminalRegistry["scrollback"]>,
) {
  const { lines: _lines, ...summary } = scrollback;
  return summary;
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
      "Unified input for the native terminal pane. Prefer this over interactive_terminal_write, interactive_terminal_send_line, and interactive_terminal_keys. Examples: vim paste -> text='hello', paste=true; vim normal mode -> keys=[{key:'Escape'}]; shell command -> text='ls -la' (submit=true by default); quit interactive app -> keys=[{key:'q'}]. Use submit=false to prevent automatic Enter. Use paste=true for large text blocks in editors like vim (wraps text in bracketed paste escape sequences).",
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

type TerminalKeyInput = {
  key?: unknown;
  text?: unknown;
  modifiers?: unknown;
  repeat?: unknown;
};

export function encodeTerminalKey(input: TerminalKeyInput) {
  const modifiers = normalizeTerminalModifiers(input.modifiers);
  const repeat = input.repeat === undefined ? 1 : requireRepeat(input.repeat);
  const text =
    input.text === undefined ? undefined : requireString(input.text, "text");
  if (text !== undefined) {
    if (modifiers.size)
      throw new Error("UTF-8 committed text cannot have terminal modifiers");
    return text.repeat(repeat);
  }
  const rawKey = requireString(input.key, "key");
  const key = normalizeTerminalKey(rawKey);
  if (key.length === 1 && key >= "A" && key <= "Z" && !modifiers.has("shift"))
    modifiers.add("shift");
  const bytes = encodeTerminalKeyOnce(key, modifiers);
  return bytes.repeat(repeat);
}

function normalizeTerminalModifiers(value: unknown) {
  if (value === undefined) return new Set<string>();
  if (!Array.isArray(value)) throw new Error("modifiers must be an array");
  const modifiers = new Set(value.map((item) => String(item).toLowerCase()));
  for (const modifier of modifiers)
    if (!["ctrl", "alt", "shift"].includes(modifier))
      throw new Error(`unsupported terminal modifier: ${modifier}`);
  return modifiers;
}

function requireRepeat(value: unknown) {
  if (
    !Number.isInteger(value) ||
    (value as number) < 1 ||
    (value as number) > 100
  )
    throw new Error("repeat must be an integer between 1 and 100");
  return value as number;
}

function normalizeTerminalKey(value: string) {
  const aliases: Record<string, string> = {
    enter: "Enter",
    esc: "Esc",
    escape: "Esc",
    backspace: "Backspace",
    delete: "Delete",
    tab: "Tab",
    "ctrl-c": "CtrlC",
    "ctrl-d": "CtrlD",
    arrowup: "ArrowUp",
    arrowdown: "ArrowDown",
    arrowleft: "ArrowLeft",
    arrowright: "ArrowRight",
    home: "Home",
    end: "End",
    pageup: "PageUp",
    pagedown: "PageDown",
    insert: "Insert",
  };
  const canonical = aliases[value.toLowerCase()] ?? value;
  if (/^F(?:[1-9]|1[0-2])$/u.test(canonical)) return canonical;
  if ([...canonical].length === 1) return canonical;
  if (canonical === "CtrlC" || canonical === "CtrlD") return canonical;
  if (
    [
      "Enter",
      "Esc",
      "Backspace",
      "Delete",
      "Tab",
      "ArrowUp",
      "ArrowDown",
      "ArrowLeft",
      "ArrowRight",
      "Home",
      "End",
      "PageUp",
      "PageDown",
      "Insert",
    ].includes(canonical)
  )
    return canonical;
  throw new Error(`unsupported terminal key: ${value}`);
}

function encodeTerminalKeyOnce(key: string, modifiers: Set<string>) {
  if (key === "CtrlC") return "\x03";
  if (key === "CtrlD") return "\x04";
  const modifier = terminalModifierCode(modifiers);
  const plain = modifiers.size === 0;
  const base: Record<string, string> = {
    Enter: "\r",
    Esc: "\x1b",
    Tab: "\t",
    Backspace: "\x7f",
    Delete: "\x1b[3~",
    Insert: "\x1b[2~",
    Home: "\x1b[H",
    End: "\x1b[F",
    PageUp: "\x1b[5~",
    PageDown: "\x1b[6~",
    ArrowUp: "\x1b[A",
    ArrowDown: "\x1b[B",
    ArrowRight: "\x1b[C",
    ArrowLeft: "\x1b[D",
    F1: "\x1bOP",
    F2: "\x1bOQ",
    F3: "\x1bOR",
    F4: "\x1bOS",
    F5: "\x1b[15~",
    F6: "\x1b[17~",
    F7: "\x1b[18~",
    F8: "\x1b[19~",
    F9: "\x1b[20~",
    F10: "\x1b[21~",
    F11: "\x1b[23~",
    F12: "\x1b[24~",
  };
  if (key in base) {
    if (plain) return base[key]!;
    if (["Enter", "Esc", "Tab", "Backspace"].includes(key))
      throw new Error(`terminal modifiers are not encodable for ${key}`);
    return applyTerminalModifier(base[key]!, modifier);
  }
  if (key.length !== 1) throw new Error(`unsupported terminal key: ${key}`);
  if (modifiers.has("ctrl")) {
    const code = key.toUpperCase().codePointAt(0)!;
    if (code < 0x40 || code > 0x5f)
      throw new Error(`Ctrl modifier is not encodable for ${key}`);
    return `${modifiers.has("alt") ? "\x1b" : ""}${String.fromCharCode(code - 0x40)}`;
  }
  return `${modifiers.has("alt") ? "\x1b" : ""}${key}`;
}

function terminalModifierCode(modifiers: Set<string>) {
  return (
    1 +
    Number(modifiers.has("shift")) +
    Number(modifiers.has("alt")) * 2 +
    Number(modifiers.has("ctrl")) * 4
  );
}

function applyTerminalModifier(bytes: string, modifier: number) {
  if (bytes.startsWith("\x1bO")) return `\x1b[1;${modifier}${bytes.at(-1)}`;
  if (bytes.endsWith("~")) return `${bytes.slice(0, -1)};${modifier}~`;
  return `${bytes.slice(0, -1)}1;${modifier}${bytes.at(-1)}`;
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
      if (context.nativeTerminal) {
        const snapshot = await context.nativeTerminal.snapshot(id);
        return JSON.stringify({
          id,
          host: "wezterm",
          ...snapshot,
        });
      }
      const registry = requireTerminalRegistry(context);
      const info = registry.get(id);
      const { lines: _lines, ...screen } = info.screen;
      const { id: _id, ...rest } = info;
      return JSON.stringify({
        id,
        ...rest,
        screen,
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
      if (context.nativeTerminal)
        return JSON.stringify(
          modelNativeTerminalInfo(
            await context.nativeTerminal.resize(id, rows, cols),
          ),
          null,
          2,
        );
      return notifyPTY(
        context,
        await requireTerminalRegistry(context).resize(id, rows, cols),
        "resize",
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

function interactiveTool(
  name: string,
  description: string,
  requiresApproval: boolean,
  action: (
    registry: TerminalRegistry,
    args: Record<string, unknown>,
  ) => Promise<TerminalSessionInfo>,
  requiresID: boolean,
  extra: Record<string, unknown> = {},
  required: string[] = requiresID ? ["id"] : [],
): RuntimeTool {
  return {
    name,
    description,
    requiresApproval,
    parameters: {
      type: "object",
      properties: { id: { type: "string" }, ...extra },
      required,
      additionalProperties: false,
    },
    async execute(input, context) {
      const args = requireObject(input);
      const session = await action(requireTerminalRegistry(context), args);
      const ptyAction =
        name === "interactive_terminal_write"
          ? args.submit === false
            ? "write"
            : "submit"
          : name === "interactive_terminal_keys"
            ? "special_key"
            : name === "interactive_terminal_resize"
              ? "resize"
              : name === "interactive_terminal_stop"
                ? "exit"
                : undefined;
      return notifyPTY(context, session, ptyAction, args.sensitive === true);
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
      "Run a shell command inside the workspace with output capture.",
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

function processStartTool(registry: ManagedProcessRegistry): RuntimeTool {
  return {
    name: "process_start",
    description: "Start a long-running shell process in the workspace.",
    requiresApproval: true,
    parameters: {
      type: "object",
      properties: {
        command: { type: "string" },
        id: { type: "string" },
        readyPattern: { type: "string" },
        maxOutputBytes: { type: "number" },
        stopTimeoutMs: { type: "number" },
        maxRuntimeMs: { type: "number" },
      },
      required: ["command"],
      additionalProperties: false,
    },
    async execute(input, context) {
      const args = requireObject(input);
      return JSON.stringify(
        await registry.start(
          requireString(args.command, "command"),
          context,
          optionalString(args.id),
          {
            readyPattern: optionalString(args.readyPattern),
            maxOutputBytes: positiveNumberOr(args.maxOutputBytes, 20000),
            stopTimeoutMs: positiveNumberOr(args.stopTimeoutMs, 1000),
            maxRuntimeMs: positiveNumberOrUndefined(args.maxRuntimeMs),
          },
        ),
        null,
        2,
      );
    },
  };
}

function processListTool(registry: ManagedProcessRegistry): RuntimeTool {
  return {
    name: "process_list",
    description: "List managed workspace processes.",
    requiresApproval: false,
    parameters: { type: "object", properties: {}, additionalProperties: false },
    async execute(_input, context) {
      return JSON.stringify(await registry.list(context), null, 2);
    },
  };
}

function processStatusTool(registry: ManagedProcessRegistry): RuntimeTool {
  return {
    name: "process_status",
    description: "Return status for a managed process.",
    requiresApproval: false,
    parameters: {
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"],
      additionalProperties: false,
    },
    async execute(input, context) {
      const args = requireObject(input);
      return JSON.stringify(
        await registry.get(requireString(args.id, "id"), context),
        null,
        2,
      );
    },
  };
}

function processOutputTool(registry: ManagedProcessRegistry): RuntimeTool {
  return {
    name: "process_output",
    description: "Return retained output for a managed process.",
    requiresApproval: false,
    parameters: {
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"],
      additionalProperties: false,
    },
    async execute(input, context) {
      const args = requireObject(input);
      return await registry.output(requireString(args.id, "id"), context);
    },
  };
}

function processReadyTool(registry: ManagedProcessRegistry): RuntimeTool {
  return {
    name: "process_ready",
    description:
      "Wait until a managed process output matches its ready pattern.",
    requiresApproval: false,
    parameters: {
      type: "object",
      properties: { id: { type: "string" }, timeoutMs: { type: "number" } },
      required: ["id"],
      additionalProperties: false,
    },
    async execute(input, context) {
      const args = requireObject(input);
      return JSON.stringify(
        await registry.waitForReady(
          requireString(args.id, "id"),
          context,
          numberOr(args.timeoutMs, 30000),
        ),
        null,
        2,
      );
    },
  };
}

function processStopTool(registry: ManagedProcessRegistry): RuntimeTool {
  return {
    name: "process_stop",
    description: "Stop a managed process.",
    requiresApproval: true,
    parameters: {
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"],
      additionalProperties: false,
    },
    async execute(input, context) {
      const args = requireObject(input);
      return JSON.stringify(
        await registry.stop(requireString(args.id, "id"), context),
        null,
        2,
      );
    },
  };
}

function processRestartTool(registry: ManagedProcessRegistry): RuntimeTool {
  return processControlTool(
    "process_restart",
    "Restart a managed process.",
    true,
    (id, context) => registry.restart(id, context),
  );
}

function processAttachTool(registry: ManagedProcessRegistry): RuntimeTool {
  return processControlTool(
    "process_attach",
    "Mark a managed process as attached.",
    false,
    (id, context) => registry.attach(id, context),
  );
}

function processDetachTool(registry: ManagedProcessRegistry): RuntimeTool {
  return processControlTool(
    "process_detach",
    "Mark a managed process as detached.",
    false,
    (id, context) => registry.detach(id, context),
  );
}

function processCleanupTool(registry: ManagedProcessRegistry): RuntimeTool {
  return {
    name: "process_cleanup",
    description: "Remove stopped or exited managed processes.",
    requiresApproval: true,
    parameters: { type: "object", properties: {}, additionalProperties: false },
    async execute(_input, context) {
      return JSON.stringify(await registry.cleanup(context), null, 2);
    },
  };
}

function processAuditTool(registry: ManagedProcessRegistry): RuntimeTool {
  return {
    name: "process_audit",
    description: "Return managed process audit state.",
    requiresApproval: false,
    parameters: { type: "object", properties: {}, additionalProperties: false },
    async execute(_input, context) {
      return JSON.stringify(await registry.audit(context), null, 2);
    },
  };
}

function backgroundStartTool(registry: ManagedProcessRegistry): RuntimeTool {
  return aliasTool(
    "background_start",
    "Start a background workspace process.",
    true,
    (input, context) => processStartTool(registry).execute(input, context),
  );
}

function backgroundListTool(registry: ManagedProcessRegistry): RuntimeTool {
  return aliasTool(
    "background_list",
    "List background processes.",
    false,
    async (_input, context) =>
      JSON.stringify(await registry.list(context), null, 2),
  );
}

function backgroundOutputTool(registry: ManagedProcessRegistry): RuntimeTool {
  return aliasTool(
    "background_output",
    "Return background process output.",
    false,
    (input, context) => processOutputTool(registry).execute(input, context),
  );
}

function backgroundStopTool(registry: ManagedProcessRegistry): RuntimeTool {
  return aliasTool(
    "background_stop",
    "Stop a background process.",
    true,
    (input, context) => processStopTool(registry).execute(input, context),
  );
}

function backgroundRestartTool(registry: ManagedProcessRegistry): RuntimeTool {
  return aliasTool(
    "background_restart",
    "Restart a background process.",
    true,
    (input, context) => processRestartTool(registry).execute(input, context),
  );
}

function backgroundCleanupTool(registry: ManagedProcessRegistry): RuntimeTool {
  return aliasTool(
    "background_cleanup",
    "Cleanup background process registry.",
    true,
    async (_input, context) =>
      JSON.stringify(await registry.cleanup(context), null, 2),
  );
}

function backgroundAuditTool(registry: ManagedProcessRegistry): RuntimeTool {
  return aliasTool(
    "background_audit",
    "Return background process audit state.",
    false,
    async (_input, context) =>
      JSON.stringify(await registry.audit(context), null, 2),
  );
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

function processControlTool(
  name: string,
  description: string,
  requiresApproval: boolean,
  action: (
    id: string,
    context: ToolExecutionContext,
  ) => Promise<ManagedProcessInfo>,
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
      const args = requireObject(input);
      return JSON.stringify(
        await action(requireString(args.id, "id"), context),
        null,
        2,
      );
    },
  };
}

function aliasTool(
  name: string,
  description: string,
  requiresApproval: boolean,
  execute: RuntimeTool["execute"],
): RuntimeTool {
  return {
    name,
    description,
    requiresApproval,
    parameters: {
      type: "object",
      properties: {
        id: { type: "string" },
        command: { type: "string" },
      },
      additionalProperties: true,
    },
    execute,
  };
}

async function runShell(
  command: string,
  context: ToolExecutionContext,
  timeoutSec: number,
) {
  await stat(context.workspaceRoot);
  return await new Promise<string>((resolvePromise, reject) => {
    const child = spawn("bash", ["-lc", command], {
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
  const denied = context.settings?.deniedHosts ?? [];
  if (denied.some((pattern) => hostMatches(host, pattern)))
    throw new Error(`network host denied: ${host}`);
  if (allowed.length && !allowed.some((pattern) => hostMatches(host, pattern)))
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

function safeToolEnv(allowlist?: string[]) {
  const defaults = ["PATH", "HOME", "TMPDIR", "LANG", "LC_ALL", "TERM"];
  const allowed = new Set([...defaults, ...(allowlist ?? [])]);
  return Object.fromEntries(
    [...allowed]
      .map((key) => [key, process.env[key]] as const)
      .filter(
        (entry): entry is [string, string] => typeof entry[1] === "string",
      ),
  );
}

function terminateChildProcessTree(pid: number | undefined) {
  if (!pid) return;
  try {
    process.kill(-pid, "SIGTERM");
    const escalation = setTimeout(() => {
      try {
        process.kill(-pid, "SIGKILL");
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
      }
    }, 2_000);
    escalation.unref();
    return;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ESRCH") return;
  }
  try {
    process.kill(pid, "SIGTERM");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
  }
}

function workspacePath(root: string, inputPath: string) {
  const path = resolve(root, inputPath);
  const rel = relative(resolve(root), path);
  if (isAbsolute(rel) || rel.startsWith(".."))
    throw new Error(`path escapes workspace: ${inputPath}`);
  return path;
}

function requireObject(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new Error("tool arguments must be an object");
  return input as Record<string, unknown>;
}

function requireString(value: unknown, name: string) {
  if (typeof value !== "string") throw new Error(`${name} must be a string`);
  return value;
}

function optionalString(value: unknown) {
  if (value === undefined) return undefined;
  if (typeof value !== "string")
    throw new Error("optional value must be a string");
  return value;
}

function numberOr(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function positiveNumberOrUndefined(value: unknown) {
  if (value === undefined) return undefined;
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0)
    throw new Error("value must be a positive number");
  return value;
}

function positiveNumberOr(value: unknown, fallback: number) {
  if (value === undefined) return fallback;
  return positiveNumberOrUndefined(value) ?? fallback;
}

function optionalInteger(value: unknown, name: string): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "number" || !Number.isInteger(value))
    throw new Error(`${name} must be an integer`);
  return value;
}

function truncateProcessOutput(output: string, maxBytes = 20000) {
  const bytes = Buffer.from(output);
  if (bytes.byteLength <= maxBytes) return output;
  let start = bytes.byteLength - maxBytes;
  while (start < bytes.byteLength && (bytes[start]! & 0xc0) === 0x80) start++;
  return bytes.subarray(start).toString("utf8");
}

type ManagedProcessRuntime = ManagedProcessInfo & {
  outputPath: string;
  pidStartTicks?: string;
  commandLine?: string;
  deadlineAt?: string;
};

async function refreshPersistedProcessStatus(info: ManagedProcessRuntime) {
  refreshProcessStatus(info);
  if (info.status !== "running" || !info.pid || !info.pidStartTicks)
    return info;
  const current = await processFingerprint(info.pid);
  if (current.pidStartTicks === info.pidStartTicks) return info;
  info.status = "failed";
  info.endedAt = new Date().toISOString();
  info.output =
    `${info.output}\nmanaged process ownership lost: PID ${info.pid} no longer matches its persisted process fingerprint`.trim();
  return info;
}

async function processFingerprint(pid: number) {
  if (process.platform !== "linux") return {};
  try {
    const [statLine, commandLine] = await Promise.all([
      readFile(`/proc/${pid}/stat`, "utf8"),
      readFile(`/proc/${pid}/cmdline`, "utf8"),
    ]);
    const fields = statLine.trim().split(/\s+/u);
    return {
      pidStartTicks: fields[21],
      commandLine: commandLine.replace(/\0/gu, " ").trim(),
    };
  } catch {
    return {};
  }
}

function refreshProcessStatus(info: ManagedProcessRuntime) {
  if (info.status !== "running" || !info.pid) return info;
  try {
    process.kill(info.pid, 0);
  } catch {
    info.status = "exited";
    info.endedAt = new Date().toISOString();
  }
  return info;
}

async function stopProcessTree(
  pid: number,
  timeoutMs: number,
  pidStartTicks?: string,
) {
  if (!(await ownsProcess(pid, pidStartTicks))) return;
  sendProcessSignal(pid, "SIGTERM");
  const deadline = Date.now() + Math.max(0, timeoutMs);
  while (Date.now() < deadline) {
    if (!(await ownsProcess(pid, pidStartTicks))) return;
    await Bun.sleep(25);
  }
  if (await ownsProcess(pid, pidStartTicks)) sendProcessSignal(pid, "SIGKILL");
}

function sendProcessSignal(pid: number, signal: NodeJS.Signals) {
  try {
    // Managed processes start through setsid, so the negative PID addresses
    // their owned process group and includes background children.
    if (process.platform !== "win32") process.kill(-pid, signal);
    else process.kill(pid, signal);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
    try {
      process.kill(pid, signal);
    } catch (fallbackError) {
      if ((fallbackError as NodeJS.ErrnoException).code !== "ESRCH")
        throw fallbackError;
    }
  }
}

function isProcessRunning(pid: number) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function ownsProcess(pid: number, pidStartTicks?: string) {
  if (!pidStartTicks) return isProcessRunning(pid);
  return (await processFingerprint(pid)).pidStartTicks === pidStartTicks;
}

async function readOptionalFile(path: string) {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return "";
    throw error;
  }
}

function shellQuote(value: string) {
  return `'${value.replace(/'/gu, `'\\''`)}'`;
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
  for (const name of names) {
    const result = Bun.spawn(
      ["bash", "-lc", `command -v ${shellQuote(name)}`],
      {
        stdout: "pipe",
        stderr: "ignore",
      },
    );
    const path = (await new Response(result.stdout).text()).trim();
    if ((await result.exited) === 0 && path) return path;
  }
  return undefined;
}

function publicProcessInfo(info: ManagedProcessRuntime): ManagedProcessInfo {
  return {
    id: info.id,
    command: info.command,
    cwd: info.cwd,
    status: info.status,
    attached: info.attached,
    persistent: info.persistent,
    pid: info.pid,
    exitCode: info.exitCode,
    startedAt: info.startedAt,
    endedAt: info.endedAt,
    output: info.output,
    ready: info.ready,
    readyPattern: info.readyPattern,
    maxOutputBytes: info.maxOutputBytes,
    stopTimeoutMs: info.stopTimeoutMs,
    maxRuntimeMs: info.maxRuntimeMs,
    deadlineAt: info.deadlineAt,
  };
}
