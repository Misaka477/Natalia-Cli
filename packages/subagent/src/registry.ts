import type {
  SubagentID,
  SubagentStatus,
  SubagentRecord,
  OutputEntry,
  AuditEntry,
  SubagentEvent,
  SubagentRegistryOptions,
  SpawnOptions,
  RunnerContext,
  RunnerCallback,
} from "./types";
import { SubagentStore } from "./store";
import { formatStatusCounts, truncate } from "./format";

export class SubagentRegistry {
  readonly store: SubagentStore;
  private readonly runner: RunnerCallback;
  private records = new Map<SubagentID, SubagentRecord>();
  private running = new Map<SubagentID, AbortController>();
  private subscribers = new Set<(event: SubagentEvent) => void>();
  private auditEntries: AuditEntry[] = [];
  private auditSeq = 0;
  private nextID = 1;
  private readonly maxAudit = 1000;

  constructor(opts: SubagentRegistryOptions) {
    this.runner = opts.runner;
    this.store = new SubagentStore(opts.workDir);
  }

  async load(): Promise<void> {
    const records = await this.store.load();
    let recovered = false;
    for (const rec of records) {
      // A runner is process-local. Never pretend a previous process still owns it.
      if (rec.status === "running" || rec.status === "paused") {
        rec.status = "stopped";
        rec.updatedAt = Date.now();
        rec.outputs.push({
          step: rec.outputs.length + 1,
          text: "subagent stopped because the owning runtime restarted; resubmit the task to continue",
          timestamp: rec.updatedAt,
        });
        recovered = true;
      }
      this.records.set(rec.id, rec);
      const n = parseInt(rec.id.slice(1), 10);
      if (n >= this.nextID) this.nextID = n + 1;
    }
    if (recovered) await this.save();
  }

  async save(): Promise<void> {
    await this.store.save([...this.records.values()]);
  }

  async spawn(
    task: string,
    options: SpawnOptions = {},
  ): Promise<SubagentRecord> {
    if (!task) throw new Error("task is required");
    this.assertDepth(options.parentAgentID, options.maxDepth);

    const id = `a${this.nextID++}` as SubagentID;
    const now = Date.now();
    const record: SubagentRecord = {
      id,
      task,
      mode: options.mode ?? "code",
      status: "idle",
      attached: true,
      modelProfile: options.modelProfile ?? "",
      allowedTools: options.allowedTools ?? [],
      excludeTools: options.excludeTools ?? [],
      outputs: [],
      createdAt: now,
      updatedAt: now,
      parentSessionID: options.parentSessionID,
      parentAgentID: options.parentAgentID,
      continuation: 0,
    };

    this.records.set(id, record);
    await this.save();

    await this.start(record, options.signal);
    return record;
  }

  async retry(id: SubagentID): Promise<SubagentRecord | undefined> {
    const record = this.records.get(id);
    if (!record || !["stopped", "failed"].includes(record.status))
      return undefined;
    record.continuation = (record.continuation ?? 0) + 1;
    record.updatedAt = Date.now();
    record.outputs.push({
      step: record.outputs.length + 1,
      text: `retrying continuation ${record.continuation}`,
      timestamp: record.updatedAt,
    });
    await this.save();
    await this.start(record);
    return record;
  }

  private async start(record: SubagentRecord, signal?: AbortSignal) {
    const id = record.id;
    const abortController = new AbortController();
    this.running.set(id, abortController);

    const ctx: RunnerContext = {
      agentId: id,
      log: (text: string) => {
        const entry: OutputEntry = {
          step: record.outputs.length + 1,
          text,
          timestamp: Date.now(),
        };
        record.outputs.push(entry);
        record.updatedAt = Date.now();
        this.emit({
          agentId: id,
          event: "log",
          text,
          status: record.status,
          attached: record.attached,
          timestamp: Date.now(),
        });
      },
      setStatus: (s: string) => {
        (record as any).status = s;
        record.updatedAt = Date.now();
        this.addAudit({
          agentId: id,
          action: "status",
          status: s,
          attached: record.attached,
          timestamp: Date.now(),
        });
        this.emit({
          agentId: id,
          event: "status",
          status: s,
          attached: record.attached,
          timestamp: Date.now(),
        });
      },
      get signal() {
        return anySignal(abortController.signal, signal);
      },
    };

    this.addAudit({
      agentId: id,
      action: "created",
      status: record.status,
      attached: record.attached,
      timestamp: Date.now(),
    });
    this.emit({
      agentId: id,
      event: "created",
      status: record.status,
      attached: record.attached,
      timestamp: Date.now(),
    });

    const runPromise = Promise.resolve().then(async () => {
      try {
        ctx.setStatus("running");
        await this.runner(record.task, ctx);
        (record as any).status = abortController.signal.aborted
          ? "stopped"
          : "completed";
      } catch (err) {
        if (
          (err as Error)?.name === "AbortError" ||
          abortController.signal.aborted
        ) {
          (record as any).status = "stopped";
        } else {
          (record as any).status = "failed";
          record.outputs.push({
            step: record.outputs.length + 1,
            text: String(err),
            timestamp: Date.now(),
          });
        }
      } finally {
        record.updatedAt = Date.now();
        this.running.delete(id);
        this.emit({
          agentId: id,
          event: "done",
          status: record.status,
          attached: record.attached,
          timestamp: Date.now(),
        });
        this.addAudit({
          agentId: id,
          action: "done",
          status: record.status,
          attached: record.attached,
          timestamp: Date.now(),
        });
        await this.save();
      }
    });

    runPromise.catch(() => {});
  }

  list(): SubagentRecord[] {
    return [...this.records.values()];
  }

  get(id: SubagentID): SubagentRecord | undefined {
    return this.records.get(id);
  }

  status(id: SubagentID): SubagentStatus | undefined {
    return this.records.get(id)?.status;
  }

  output(id: SubagentID): OutputEntry[] | undefined {
    return this.records.get(id)?.outputs;
  }

  stop(id: SubagentID): boolean {
    const record = this.records.get(id);
    if (!record) return false;
    if (record.status !== "running") return false;
    const ctrl = this.running.get(id);
    if (ctrl) {
      ctrl.abort();
      record.status = "stopped";
      record.updatedAt = Date.now();
      this.addAudit({
        agentId: id,
        action: "stop",
        status: "stopped",
        attached: record.attached,
        timestamp: Date.now(),
      });
      this.emit({
        agentId: id,
        event: "stopped",
        status: "stopped",
        attached: record.attached,
        timestamp: Date.now(),
      });
    }
    return true;
  }

  resume(id: SubagentID): boolean {
    const record = this.records.get(id);
    if (!record) return false;
    if (record.status !== "paused") return false;
    record.status = "running";
    record.updatedAt = Date.now();
    this.addAudit({
      agentId: id,
      action: "resume",
      status: "running",
      attached: record.attached,
      timestamp: Date.now(),
    });
    this.emit({
      agentId: id,
      event: "resumed",
      status: "running",
      attached: record.attached,
      timestamp: Date.now(),
    });
    return true;
  }

  attach(id: SubagentID): boolean {
    const record = this.records.get(id);
    if (!record) return false;
    record.attached = true;
    record.updatedAt = Date.now();
    this.addAudit({
      agentId: id,
      action: "attach",
      status: record.status,
      attached: true,
      timestamp: Date.now(),
    });
    this.emit({
      agentId: id,
      event: "attached",
      status: record.status,
      attached: true,
      timestamp: Date.now(),
    });
    return true;
  }

  detach(id: SubagentID): boolean {
    const record = this.records.get(id);
    if (!record) return false;
    record.attached = false;
    record.updatedAt = Date.now();
    this.addAudit({
      agentId: id,
      action: "detach",
      status: record.status,
      attached: false,
      timestamp: Date.now(),
    });
    this.emit({
      agentId: id,
      event: "detached",
      status: record.status,
      attached: false,
      timestamp: Date.now(),
    });
    return true;
  }

  cleanup(dryRun = false): string[] {
    const affected: SubagentID[] = [];
    for (const [id, rec] of this.records) {
      if (
        rec.status === "completed" ||
        rec.status === "failed" ||
        rec.status === "stopped"
      ) {
        affected.push(id);
      }
    }
    if (!dryRun) {
      for (const id of affected) {
        this.records.delete(id);
        this.addAudit({
          agentId: id,
          action: "cleanup",
          status: "completed",
          attached: false,
          timestamp: Date.now(),
        });
      }
      this.save();
    }
    return affected;
  }

  audit(tail?: number, format?: string): string {
    let entries = this.auditEntries;
    if (tail && tail > 0 && tail < entries.length) {
      entries = entries.slice(entries.length - tail);
    }
    if (entries.length === 0) return "<no agent audit entries>";
    if (format === "json") {
      return JSON.stringify(
        entries.map((e) => ({
          event_id: e.eventId,
          resource_type: "subagent",
          resource_id: e.agentId,
          agent_id: e.agentId,
          action: e.action,
          status: e.status,
          time: new Date(e.timestamp).toISOString(),
        })),
        null,
        2,
      );
    }
    return entries
      .map(
        (e) =>
          `${new Date(e.timestamp).toISOString()} event_id=${e.eventId} agent_id=${e.agentId} action=${e.action} status=${e.status} attached=${e.attached}`,
      )
      .join("\n");
  }

  subscribe(fn: (event: SubagentEvent) => void): () => void {
    this.subscribers.add(fn);
    return () => this.subscribers.delete(fn);
  }

  async formatList(): Promise<string> {
    const all = this.list();
    if (all.length === 0) return "no subagents";
    const lines = all.map((rec) => {
      const parts = [`${rec.id} [${rec.status}] attached=${rec.attached}`];
      if (rec.modelProfile) parts.push(`model_profile=${rec.modelProfile}`);
      parts.push(rec.task);
      const last =
        rec.outputs.length > 0
          ? truncate(rec.outputs[rec.outputs.length - 1].text, 40)
          : "";
      if (last) parts.push(`→ ${last}`);
      parts.push(`(${rec.outputs.length} steps)`);
      return parts.join(" ");
    });
    return `${lines.join("\n")}\n${formatStatusCounts(all)}`;
  }

  async formatOutput(id: SubagentID, verbose = false): Promise<string> {
    const rec = this.records.get(id);
    if (!rec) throw new Error(`subagent ${id} not found`);
    if (rec.outputs.length === 0) return "no output";
    if (!verbose) {
      const last = rec.outputs[rec.outputs.length - 1]!;
      return `${rec.id} [${rec.status}]\n${truncate(last.text, 1200)}`;
    }
    return rec.outputs
      .map((o) => `[${rec.id}] step=${o.step} ${o.text}`)
      .join("\n");
  }

  async formatStatus(id: SubagentID): Promise<string> {
    const rec = this.records.get(id);
    if (!rec) throw new Error(`subagent ${id} not found`);
    const lines = [
      `${rec.id} [${rec.status}] attached=${rec.attached} ${rec.task}`,
    ];
    if (rec.modelProfile) lines.push(`  model_profile: ${rec.modelProfile}`);
    lines.push(`  mode: ${rec.mode}`);
    lines.push(`  created: ${new Date(rec.createdAt).toISOString()}`);
    lines.push(`  updated: ${new Date(rec.updatedAt).toISOString()}`);
    for (const o of rec.outputs) {
      lines.push(`  [step ${o.step}] ${truncate(o.text, 200)}`);
    }
    return lines.join("\n");
  }

  getAuditEntries(): AuditEntry[] {
    return this.auditEntries;
  }

  private emit(event: SubagentEvent) {
    const record = this.records.get(event.agentId);
    event.parentSessionID = record?.parentSessionID;
    event.parentAgentID = record?.parentAgentID;
    event.continuation = record?.continuation;
    for (const fn of this.subscribers) {
      try {
        fn(event);
      } catch {
        // subscriber error ignored
      }
    }
  }

  private assertDepth(parentID: SubagentID | undefined, maxDepth = 1) {
    let depth = 1;
    let parent = parentID ? this.records.get(parentID) : undefined;
    while (parent) {
      depth++;
      parent = parent.parentAgentID
        ? this.records.get(parent.parentAgentID)
        : undefined;
    }
    if (depth > maxDepth)
      throw new Error(
        `subagent depth limit reached (${maxDepth}); increase runtime.subagentDepth to allow nested subagents`,
      );
  }

  private addAudit(entry: {
    agentId: SubagentID;
    action: string;
    status: string;
    attached: boolean;
    timestamp: number;
  }) {
    this.auditSeq++;
    const auditEntry: AuditEntry = {
      eventId: `aevt_${this.auditSeq}`,
      agentId: entry.agentId,
      action: entry.action,
      status: entry.status,
      attached: entry.attached,
      timestamp: entry.timestamp,
    };
    this.auditEntries.push(auditEntry);
    if (this.auditEntries.length > this.maxAudit) {
      this.auditEntries = this.auditEntries.slice(
        this.auditEntries.length - this.maxAudit,
      );
    }
  }
}

function anySignal(...signals: (AbortSignal | undefined)[]): AbortSignal {
  const cleanSignals = signals.filter(Boolean) as AbortSignal[];
  if (cleanSignals.length === 0) return new AbortController().signal;
  if (cleanSignals.length === 1) return cleanSignals[0];
  const ctrl = new AbortController();
  for (const sig of cleanSignals) {
    if (sig.aborted) {
      ctrl.abort(sig.reason);
      return ctrl.signal;
    }
    sig.addEventListener("abort", () => ctrl.abort(sig.reason), { once: true });
  }
  return ctrl.signal;
}
