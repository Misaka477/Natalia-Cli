/**
 * Long-lived processes a model started, and the tools that manage them.
 *
 * The registry is the only durable state in this family: a process outlives the
 * turn and session that started it, so it is persisted per workspace and
 * re-adopted on load.
 */
/**
 * Long-lived processes a model started, and the tools that manage them.
 *
 * The registry is the only durable state in this package: a process outlives the
 * turn that started it and the session that started it, so it is persisted per
 * workspace and re-adopted on load. That is why identity is checked before any
 * signal is sent — a recorded PID may belong to something else by now — and why
 * deadlines survive a restart rather than being forgotten with the process that
 * set them.
 *
 * The `background_*` tools are aliases over the same registry with a shorter
 * vocabulary, not a second implementation.
 */
import { existsSync } from "node:fs";
import { chmod, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import {
  detachedShellPrefix,
  shellQuote,
  startDetachedProcess,
} from "@natalia/platform";
import {
  isProcessRunning,
  ownsProcess,
  processFingerprint,
  readOptionalFile,
  safeToolEnv,
  sendProcessSignal,
  stopProcessTree,
  truncateProcessOutput,
} from "@natalia/tools";
import { boundToolOutput } from "@natalia/tools";
import {
  numberOr,
  optionalInteger,
  optionalString,
  positiveNumberOr,
  positiveNumberOrUndefined,
  requireObject,
  requireString,
} from "@natalia/tools";
import type {
  RuntimeTool,
  ToolExecutionContext,
  ToolFamily,
} from "@natalia/tools";

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
    const { pid } = await startDetachedProcess({
      command,
      posixScript: `${detachedShellPrefix()}bash -c ${shellQuote(command)} > ${shellQuote(outputPath)} 2>&1 & echo $!`,
      cwd: context.workspaceRoot,
      outputPath,
      env: safeToolEnv(context.settings?.envAllowlist),
    });
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

function processStartTool(registry: ManagedProcessRegistry): RuntimeTool {
  return {
    name: "process_start",
    description:
      "Start a long-running shell process in the workspace. The shell is always bash-compatible (Git Bash on Windows, native bash on Linux/Mac).",
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
    output: {
      schema: {
        type: "object",
        properties: { id: { type: "string" } },
        required: ["id"],
        additionalProperties: false,
      },
      presentCall(args) {
        return {
          kind: "terminal",
          title: requireObject(args).command as string,
          summary: "start",
        };
      },
      presentResult(args, value) {
        const command = requireObject(args).command as string;
        const id = JSON.parse(value)?.id as string | undefined;
        return {
          kind: "terminal",
          title: command,
          summary: id ? `started ${id}` : "started",
          meta: id ? [["id", id]] : [],
        };
      },
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
    "Start a background workspace process. Uses a bash-compatible shell on all platforms (Git Bash on Windows).",
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

/**
 * Every tool that manages a long-lived process, over one registry.
 *
 * Assembled here rather than listed in the barrel so the family owns both its
 * state and the surface that reaches it: adding a process tool is one edit in one
 * file.
 */
export function managedProcessTools(
  registry: ManagedProcessRegistry,
): RuntimeTool[] {
  return [
    processStartTool(registry),
    processListTool(registry),
    processStatusTool(registry),
    processOutputTool(registry),
    processReadyTool(registry),
    processStopTool(registry),
    processRestartTool(registry),
    processAttachTool(registry),
    processDetachTool(registry),
    processCleanupTool(registry),
    processAuditTool(registry),
    backgroundStartTool(registry),
    backgroundListTool(registry),
    backgroundOutputTool(registry),
    backgroundStopTool(registry),
    backgroundRestartTool(registry),
    backgroundCleanupTool(registry),
    backgroundAuditTool(registry),
  ];
}

/**
 * Session scope: the tools are meaningful only while the session using them is
 * alive, even though the processes they manage outlive it.
 */
export function processToolFamily(
  processRegistry = new ManagedProcessRegistry(),
): ToolFamily {
  return {
    id: "process",
    name: "Managed Process Tools",
    version: "1.0.0",
    description: "Long-running background processes.",
    scope: "session",
    tools: [...managedProcessTools(processRegistry)],
  };
}
