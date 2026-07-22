import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { chmod, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { SubagentRegistry } from "@natalia/subagent";
import { InteractivePTYRegistry, type InteractivePTYInfo } from "@natalia/pty";
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
  interactivePTY?: InteractivePTYRegistry;
  onPTYUpdate?: (session: InteractivePTYInfo) => void;
  onPTYAction?: (
    session: InteractivePTYInfo,
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
  onSandboxEvent?: (event: { type: string; [key: string]: unknown }) => void;
  settings?: {
    webSearchEndpoint?: string;
    browserBinary?: string;
    allowedHosts?: string[];
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
};

export type ToolRegistry = Map<string, RuntimeTool>;

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
      { cwd: context.workspaceRoot, stdout: "pipe", stderr: "pipe" },
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
    if (info.status === "running" && info.pid)
      await stopProcessTree(info.pid, info.stopTimeoutMs ?? 1000);
    this.clearDeadline(this.deadlineKey(context, id));
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

  private scheduleDeadline(info: ManagedProcessRuntime, context: ToolExecutionContext) {
    this.clearDeadline(this.deadlineKey(context, info.id));
    if (info.status !== "running" || !info.deadlineAt) return;
    const delay = new Date(info.deadlineAt).getTime() - Date.now();
    if (!Number.isFinite(delay)) return;
    const timer = setTimeout(() => void this.stop(info.id, context), Math.max(0, delay));
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
  tools: RuntimeTool[] = defaultTools(),
): ToolRegistry {
  return new Map(tools.map((tool) => [tool.name, tool]));
}

export function defaultTools(): RuntimeTool[] {
  const processRegistry = new ManagedProcessRegistry();

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
    interactiveReadTool(),
    interactiveWriteTool(),
    interactiveKeyTool(),
    interactiveResizeTool(),
    interactiveAttachTool(),
    interactiveDetachTool(),
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

  registryRef = new Map(tools.map((t) => [t.name, t]));
  return tools;
}

function planTool(): RuntimeTool {
  return {
    name: "plan",
    description: "Create or update the durable workspace execution plan.",
    requiresApproval: false,
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
      properties: { id: { type: "string" } },
      required: ["id"],
      additionalProperties: false,
    },
    async execute(input, context) {
      const id = requireString(requireObject(input).id, "id");
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
      properties: { id: { type: "string" } },
      required: ["id"],
      additionalProperties: false,
    },
    async execute(input, context) {
      const id = requireString(requireObject(input).id, "id");
      const manager = requireSandboxes(context);
      const changes = await manager.merge(id, context.workspaceRoot);
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

function requireInteractivePTY(context: ToolExecutionContext) {
  if (!context.interactivePTY)
    throw new Error("interactive PTY runtime unavailable");
  return context.interactivePTY;
}

function notifyPTY(
  context: ToolExecutionContext,
  session: InteractivePTYInfo,
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
  return JSON.stringify(session, null, 2);
}

function interactiveStartTool(): RuntimeTool {
  return {
    name: "interactive_start",
    description:
      "Start a real interactive OS PTY session inside the workspace.",
    requiresApproval: true,
    parameters: {
      type: "object",
      properties: {
        command: { type: "string" },
        id: { type: "string" },
        rows: { type: "number" },
        cols: { type: "number" },
      },
      required: ["command"],
      additionalProperties: false,
    },
    async execute(input, context) {
      const args = requireObject(input);
      const registry = requireInteractivePTY(context);
      const session = await registry.start({
        command: requireString(args.command, "command"),
        cwd: context.workspaceRoot,
        id: optionalString(args.id),
        rows: numberOr(args.rows, 24),
        cols: numberOr(args.cols, 80),
      });
      registry.subscribe(session.id, (next) => context.onPTYUpdate?.(next));
      return notifyPTY(context, session);
    },
  };
}

function interactiveReadTool(): RuntimeTool {
  return interactiveTool(
    "interactive_read",
    "Read a bounded interactive PTY transcript slice. Use nextOffset for incremental reads.",
    false,
    async (registry, args) =>
      registry.read(requireString(args.id, "id"), {
        offset: numberOr(args.offset, 0),
        maxChars: numberOr(args.maxChars, 4000),
      }),
    true,
    { offset: { type: "number" }, maxChars: { type: "number" } },
  );
}

function interactiveWriteTool(): RuntimeTool {
  return interactiveTool(
    "interactive_write",
    "Write literal input to an interactive PTY session.",
    true,
    async (registry, args) =>
      await registry.write(
        requireString(args.id, "id"),
        requireString(args.input, "input"),
        {
          submit: args.submit !== false,
          sensitive: args.sensitive === true,
        },
      ),
    true,
    {
      input: { type: "string" },
      submit: { type: "boolean" },
      sensitive: { type: "boolean" },
    },
    ["id", "input"],
  );
}

function interactiveKeyTool(): RuntimeTool {
  return interactiveTool(
    "interactive_keys",
    "Send enter, ctrl-c, ctrl-d, tab, or esc to an interactive PTY session.",
    true,
    async (registry, args) => {
      const key = requireString(args.key, "key");
      if (!["enter", "ctrl-c", "ctrl-d", "tab", "esc"].includes(key))
        throw new Error("key must be enter, ctrl-c, ctrl-d, tab, or esc");
      return await registry.specialKey(
        requireString(args.id, "id"),
        key as "enter" | "ctrl-c" | "ctrl-d" | "tab" | "esc",
      );
    },
    true,
    { key: { type: "string" } },
    ["id", "key"],
  );
}

function interactiveResizeTool(): RuntimeTool {
  return interactiveTool(
    "interactive_resize",
    "Resize an interactive PTY session.",
    false,
    async (registry, args) =>
      await registry.resize(
        requireString(args.id, "id"),
        numberOr(args.rows, 24),
        numberOr(args.cols, 80),
      ),
    true,
    { rows: { type: "number" }, cols: { type: "number" } },
    ["id", "rows", "cols"],
  );
}

function interactiveAttachTool(): RuntimeTool {
  return interactiveTool(
    "interactive_attach",
    "Attach to an interactive PTY session.",
    false,
    async (registry, args) =>
      await registry.attach(requireString(args.id, "id")),
    true,
  );
}

function interactiveDetachTool(): RuntimeTool {
  return interactiveTool(
    "interactive_detach",
    "Detach an interactive PTY session.",
    false,
    async (registry, args) =>
      await registry.detach(requireString(args.id, "id")),
    true,
  );
}

function interactiveStopTool(): RuntimeTool {
  return interactiveTool(
    "interactive_stop",
    "Stop an interactive PTY session.",
    true,
    async (registry, args) => await registry.stop(requireString(args.id, "id")),
    true,
  );
}

function interactiveListTool(): RuntimeTool {
  return {
    name: "interactive_list",
    description: "List real interactive PTY sessions.",
    requiresApproval: false,
    parameters: { type: "object", properties: {}, additionalProperties: false },
    async execute(_input, context) {
      return JSON.stringify(requireInteractivePTY(context).list(), null, 2);
    },
  };
}

function interactiveTool(
  name: string,
  description: string,
  requiresApproval: boolean,
  action: (
    registry: InteractivePTYRegistry,
    args: Record<string, unknown>,
  ) => Promise<InteractivePTYInfo>,
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
      const session = await action(requireInteractivePTY(context), args);
      const ptyAction =
        name === "interactive_write"
          ? args.submit === false
            ? "write"
            : "submit"
          : name === "interactive_keys"
            ? "special_key"
            : name === "interactive_resize"
              ? "resize"
              : name === "interactive_attach"
                ? "attach"
                : name === "interactive_detach"
                  ? "detach"
                  : name === "interactive_stop"
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
      registry.resume(requireString(args.id, "id"))
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
      const offset = Math.max(0, numberOr(args.offset, 0));
      const limit = Math.min(1000, Math.max(1, numberOr(args.limit, 200)));
      const page = paths.sort().slice(offset, offset + limit);
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
      const lines: string[] = [];
      for await (const relativePath of new Bun.Glob(include).scan({
        cwd: context.workspaceRoot,
        onlyFiles: true,
      })) {
        if (lines.length >= limit) break;
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
      const response = await fetch(url);
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
      const endpoint =
        context.settings?.webSearchEndpoint ??
        process.env.NATALIA_WEB_SEARCH_URL ??
        "https://html.duckduckgo.com/html/";
      const url = new URL(endpoint);
      url.searchParams.set("q", requireString(args.query, "query"));
      assertNetworkURL(url.href, context);
      const response = await fetch(url, {
        headers: { "user-agent": "Natalia-TS7-Search/0.1" },
      });
      const text = await response.text();
      if (!response.ok)
        throw new Error(
          `web_search failed: HTTP ${response.status} from ${url.origin}`,
        );
      return [
        `status=${response.status}`,
        `content-type=${response.headers.get("content-type") ?? "unknown"}`,
        `source=${context.settings?.webSearchEndpoint || process.env.NATALIA_WEB_SEARCH_URL ? "configured endpoint" : "DuckDuckGo HTML"}`,
        text.slice(0, numberOr(args.maxBytes, 20000)),
      ].join("\n");
    },
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
    async execute(input) {
      const args = requireObject(input);
      const url = requireString(args.url, "url");
      if (!/^https?:\/\//iu.test(url))
        throw new Error("browser_visit requires http(s) URL");
      const response = await fetch(url, {
        headers: { "user-agent": "Natalia-TS7-Browser/0.1" },
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
      const args = requireObject(input);
      const url = requireString(args.url, "url");
      const output = workspacePath(
        context.workspaceRoot,
        requireString(args.path, "path"),
      );
      await mkdir(dirname(output), { recursive: true });
      const chrome =
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
      await runShell(
        `${shellQuote(chrome)} --headless=new --disable-gpu --no-sandbox --window-size=${Math.trunc(numberOr(args.width, 1280))},${Math.trunc(numberOr(args.height, 720))} --screenshot=${shellQuote(output)} ${shellQuote(url)}`,
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

async function stopProcessTree(pid: number, timeoutMs: number) {
  sendProcessSignal(pid, "SIGTERM");
  const deadline = Date.now() + Math.max(0, timeoutMs);
  while (Date.now() < deadline) {
    if (!isProcessRunning(pid)) return;
    await Bun.sleep(25);
  }
  if (isProcessRunning(pid)) sendProcessSignal(pid, "SIGKILL");
}

function sendProcessSignal(pid: number, signal: NodeJS.Signals) {
  try {
    // Managed processes start through setsid, so the negative PID addresses
    // their owned process group and includes background children.
    if (process.platform !== "win32") process.kill(-pid, signal);
    else process.kill(pid, signal);
  } catch {
    try {
      process.kill(pid, signal);
    } catch {}
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
  };
}
