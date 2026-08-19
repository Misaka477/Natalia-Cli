import type {
  SubagentID,
  SubagentStatus,
  SubagentRecord,
  SubagentPhase,
  SubagentHealth,
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

const DEFAULT_STALL_MS = 30_000;

export type StopResult =
  | { outcome: "stopped"; id: string }
  | { outcome: "not_found"; id: string }
  | { outcome: "not_running"; id: string; status: SubagentStatus }
  | {
      outcome: "protected";
      id: string;
      health: "active" | "quiet";
      retryAfterMs: number;
    };

export class SubagentRegistry {
  readonly store: SubagentStore;
  private readonly runner: RunnerCallback;
  private readonly clock: () => number;
  private readonly stallThresholdMs: number;
  private records = new Map<SubagentID, SubagentRecord>();
  private running = new Map<SubagentID, AbortController>();
  private subscribers = new Set<(event: SubagentEvent) => void>();
  private auditEntries: AuditEntry[] = [];
  private auditSeq = 0;
  private nextID = 1;
  private readonly maxAudit = 1000;
  private activityThrottle = new Map<SubagentID, number>();

  constructor(opts: SubagentRegistryOptions) {
    this.runner = opts.runner;
    this.clock = opts.clock ?? (() => Date.now());
    this.stallThresholdMs = opts.stallThresholdMs ?? DEFAULT_STALL_MS;
    this.store = new SubagentStore(opts.workDir);
  }

  async load(): Promise<void> {
    const records = await this.store.load();
    let recovered = false;
    const now = this.clock();
    for (const rec of records) {
      if (rec.status === "running" || rec.status === "paused") {
        rec.status = "stopped";
        rec.updatedAt = now;
        rec.endedAt = now;
        rec.phase = "finalizing";
        rec.lastActivityAt = now;
        rec.activityDetail = "runtime restarted";
        rec.outputs.push({
          step: rec.outputs.length + 1,
          text: "subagent stopped because the owning runtime restarted; resubmit the task to continue",
          timestamp: now,
        });
        recovered = true;
      }
      if (!rec.phase) rec.phase = derivePhase(rec);
      if (rec.lastActivityAt === undefined) rec.lastActivityAt = rec.updatedAt;
      if (!rec.startedAt) rec.startedAt = rec.createdAt;
      this.records.set(rec.id, rec as SubagentRecord);
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
    const now = this.clock();
    const record: SubagentRecord = {
      id,
      task,
      mode: options.mode ?? "code",
      status: "idle",
      attached: true,
      modelProfile: options.modelProfile ?? "",
      allowedTools: options.allowedTools ?? [],
      excludeTools: options.excludeTools ?? [],
      writePaths: options.writePaths,
      outputs: [],
      createdAt: now,
      updatedAt: now,
      parentSessionID: options.parentSessionID,
      parentAgentID: options.parentAgentID,
      continuation: 0,
      phase: "queued",
      lastActivityAt: now,
      activityDetail: "spawned",
      startedAt: now,
    };

    this.records.set(id, record);
    await this.save();

    await this.start(record, options.signal);
    return record;
  }

  health(id: SubagentID): SubagentHealth {
    const record = this.records.get(id);
    if (!record) return "terminal";
    if (["completed", "failed", "stopped"].includes(record.status))
      return "terminal";
    if (record.phase === "waiting") return "active";
    const elapsed = this.clock() - record.lastActivityAt;
    const quietGrace = Math.min(5_000, this.stallThresholdMs * 0.5);
    if (elapsed < quietGrace) return "active";
    if (elapsed < this.stallThresholdMs) return "quiet";
    return "stalled";
  }

  reportActivity(id: SubagentID, phase: SubagentPhase, detail: string) {
    const record = this.records.get(id);
    if (!record) return;
    const now = this.clock();
    const prevThrottle = this.activityThrottle.get(id) ?? 0;
    if (now - prevThrottle < 500 && phase !== record.phase) {
      this.activityThrottle.set(id, now);
    } else if (now - prevThrottle < 5_000) {
      return;
    } else {
      this.activityThrottle.set(id, now);
    }
    record.lastActivityAt = now;
    record.phase = phase;
    record.activityDetail = detail;
    if (phase !== "queued" && record.status === "idle") {
      record.status = "running";
      record.startedAt = now;
    }
    this.emit({
      agentId: id,
      event: "activity",
      status: record.status,
      attached: record.attached,
      timestamp: now,
      phase,
      activityDetail: detail,
    });
  }

  requestStop(id: SubagentID, reason: string, force = false): StopResult {
    const record = this.records.get(id);
    if (!record) return { outcome: "not_found", id };
    if (!["running", "paused"].includes(record.status))
      return { outcome: "not_running", id, status: record.status };
    const h = this.health(id);
    if (h === "terminal")
      return { outcome: "not_running", id, status: record.status };
    if (h !== "stalled" && !force) {
      const retryAfterMs = Math.max(
        0,
        this.stallThresholdMs - (this.clock() - record.lastActivityAt),
      );
      return { outcome: "protected", id, health: h, retryAfterMs };
    }
    this.doStop(id, reason, force);
    return { outcome: "stopped", id };
  }

  async retry(id: SubagentID): Promise<SubagentRecord | undefined> {
    const record = this.records.get(id);
    if (!record || !["stopped", "failed"].includes(record.status))
      return undefined;
    record.continuation = (record.continuation ?? 0) + 1;
    record.updatedAt = this.clock();
    record.lastActivityAt = this.clock();
    record.activityDetail = "retry";
    record.phase = "queued";
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
    const now = this.clock();
    record.status = "running";
    record.updatedAt = now;
    record.startedAt = now;
    record.lastActivityAt = now;
    record.phase = "provider";
    record.activityDetail = "starting";
    this.emit({
      agentId: id,
      event: "activity",
      status: record.status,
      attached: record.attached,
      timestamp: now,
      phase: "provider",
      activityDetail: "starting",
    });

    const ctx: RunnerContext = {
      agentId: id,
      log: (text: string) => {
        const entry: OutputEntry = {
          step: record.outputs.length + 1,
          text,
          timestamp: this.clock(),
        };
        record.outputs.push(entry);
        record.updatedAt = this.clock();
        record.lastActivityAt = this.clock();
        this.emit({
          agentId: id,
          event: "log",
          text,
          status: record.status,
          attached: record.attached,
          timestamp: this.clock(),
        });
      },
      setStatus: (s: string) => {
        (record as any).status = s;
        record.updatedAt = this.clock();
        record.lastActivityAt = this.clock();
        this.addAudit({
          agentId: id,
          action: "status",
          status: s,
          attached: record.attached,
          timestamp: this.clock(),
        });
        this.emit({
          agentId: id,
          event: "status",
          status: s,
          attached: record.attached,
          timestamp: this.clock(),
        });
      },
      signal: anySignal(abortController.signal, signal),
      reportActivity: (phase, detail) => {
        this.reportActivity(id, phase, detail);
      },
    };

    this.addAudit({
      agentId: id,
      action: "created",
      status: record.status,
      attached: record.attached,
      timestamp: this.clock(),
    });
    this.emit({
      agentId: id,
      event: "created",
      status: record.status,
      attached: record.attached,
      timestamp: this.clock(),
    });

    const runPromise = Promise.resolve().then(async () => {
      try {
        await this.runner(record.task, ctx);
        const finalStatus = abortController.signal.aborted
          ? "stopped"
          : "completed";
        (record as any).status = finalStatus;
        record.phase = "finalizing";
        record.activityDetail = finalStatus;
        record.endedAt = this.clock();
        record.lastActivityAt = this.clock();
        this.emit({
          agentId: id,
          event: finalStatus === "completed" ? "done" : "stopped",
          status: finalStatus,
          attached: record.attached,
          timestamp: this.clock(),
          phase: "finalizing",
          activityDetail: finalStatus,
        });
      } catch (err) {
        const finalStatus =
          (err as Error)?.name === "AbortError" ||
          abortController.signal.aborted
            ? "stopped"
            : "failed";
        (record as any).status = finalStatus;
        record.phase = "finalizing";
        record.activityDetail =
          finalStatus === "stopped" ? "aborted" : String(err);
        record.endedAt = this.clock();
        record.lastActivityAt = this.clock();
        if (finalStatus === "failed") {
          record.outputs.push({
            step: record.outputs.length + 1,
            text: String(err),
            timestamp: this.clock(),
          });
        }
        this.emit({
          agentId: id,
          event: finalStatus === "stopped" ? "stopped" : "done",
          status: finalStatus,
          attached: record.attached,
          timestamp: this.clock(),
          phase: "finalizing",
          activityDetail: record.activityDetail,
        });
      } finally {
        record.updatedAt = this.clock();
        this.running.delete(id);
        this.activityThrottle.delete(id);
        this.addAudit({
          agentId: id,
          action: "done",
          status: record.status,
          attached: record.attached,
          timestamp: this.clock(),
        });
        await this.save();
      }
    });

    runPromise.catch(() => {});
  }

  list(): SubagentRecord[] {
    return [...this.records.values()];
  }

  runningCount(): number {
    return this.running.size;
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

  private doStop(id: SubagentID, reason: string, force: boolean) {
    const record = this.records.get(id);
    if (!record) return;
    const ctrl = this.running.get(id);
    if (ctrl) {
      ctrl.abort();
      record.status = "stopped";
      record.updatedAt = this.clock();
      record.phase = "finalizing";
      record.activityDetail = reason;
      record.endedAt = this.clock();
      record.lastActivityAt = this.clock();
      this.addAudit({
        agentId: id,
        action: "stop",
        status: "stopped",
        attached: record.attached,
        timestamp: this.clock(),
        stopReason: reason,
        requestedBy: "model",
        force,
      });
      this.emit({
        agentId: id,
        event: "stopped",
        status: "stopped",
        attached: record.attached,
        timestamp: this.clock(),
        phase: "finalizing",
        activityDetail: reason,
        stopReason: reason,
        requestedBy: "model",
        force,
      });
      void this.save();
    }
  }

  stop(id: SubagentID): boolean {
    return (
      this.requestStop(id, "model requested stop", false).outcome === "stopped"
    );
  }

  async resume(id: SubagentID): Promise<boolean> {
    const record = this.records.get(id);
    if (!record) return false;
    if (record.status !== "paused") return false;
    if (this.running.has(id)) return false;
    record.status = "running";
    record.updatedAt = this.clock();
    record.lastActivityAt = this.clock();
    record.phase = "queued";
    record.activityDetail = "resume";
    this.addAudit({
      agentId: id,
      action: "resume",
      status: "running",
      attached: record.attached,
      timestamp: this.clock(),
    });
    this.emit({
      agentId: id,
      event: "resumed",
      status: "running",
      attached: record.attached,
      timestamp: this.clock(),
    });
    await this.save();
    await this.start(record);
    return true;
  }

  attach(id: SubagentID): boolean {
    const record = this.records.get(id);
    if (!record) return false;
    record.attached = true;
    record.updatedAt = this.clock();
    this.addAudit({
      agentId: id,
      action: "attach",
      status: record.status,
      attached: true,
      timestamp: this.clock(),
    });
    this.emit({
      agentId: id,
      event: "attached",
      status: record.status,
      attached: true,
      timestamp: this.clock(),
    });
    return true;
  }

  detach(id: SubagentID): boolean {
    const record = this.records.get(id);
    if (!record) return false;
    record.attached = false;
    record.updatedAt = this.clock();
    this.addAudit({
      agentId: id,
      action: "detach",
      status: record.status,
      attached: false,
      timestamp: this.clock(),
    });
    this.emit({
      agentId: id,
      event: "detached",
      status: record.status,
      attached: false,
      timestamp: this.clock(),
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
          timestamp: this.clock(),
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
          stop_reason: e.stopReason,
          requested_by: e.requestedBy,
          force: e.force,
          time: new Date(e.timestamp).toISOString(),
        })),
        null,
        2,
      );
    }
    return entries
      .map(
        (e) =>
          `${new Date(e.timestamp).toISOString()} event_id=${e.eventId} agent_id=${e.agentId} action=${e.action} status=${e.status} attached=${e.attached}${e.stopReason ? ` stop_reason=${JSON.stringify(e.stopReason)} requested_by=${e.requestedBy} force=${e.force}` : ""}`,
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
    lines.push(`  phase: ${rec.phase}`);
    lines.push(
      `  last_activity: ${new Date(rec.lastActivityAt).toISOString()}`,
    );
    lines.push(`  activity: ${rec.activityDetail}`);
    lines.push(`  created: ${new Date(rec.createdAt).toISOString()}`);
    lines.push(`  updated: ${new Date(rec.updatedAt).toISOString()}`);
    lines.push(`  started: ${new Date(rec.startedAt).toISOString()}`);
    if (rec.endedAt)
      lines.push(`  ended: ${new Date(rec.endedAt).toISOString()}`);
    for (const o of rec.outputs) {
      lines.push(`  [step ${o.step}] ${truncate(o.text, 200)}`);
    }
    return lines.join("\n");
  }

  wait(
    ids: string[],
    until: "all_terminal" | "any_terminal",
    timeoutMs: number,
    signal?: AbortSignal,
  ): Promise<Record<string, { status: SubagentStatus; phase: SubagentPhase }>> {
    return new Promise((resolve) => {
      const deadline = this.clock() + timeoutMs;
      const terminalStatuses = new Set(["completed", "failed", "stopped"]);

      const check = (): boolean => {
        const results: Record<
          string,
          { status: SubagentStatus; phase: SubagentPhase }
        > = {};
        let terminalCount = 0;
        for (const id of ids) {
          const rec = this.records.get(id);
          const status = rec?.status ?? "idle";
          const phase = rec?.phase ?? "idle";
          results[id] = { status, phase };
          if (terminalStatuses.has(status)) terminalCount++;
        }
        if (
          until === "all_terminal"
            ? terminalCount === ids.length
            : terminalCount > 0
        ) {
          resolve(results);
          return true;
        }
        return false;
      };

      if (check()) return;

      const unsub = this.subscribe((event) => {
        if (!ids.includes(event.agentId)) return;
        if (check()) unsub();
      });

      const timer = setInterval(() => {
        if (this.clock() >= deadline) {
          clearInterval(timer);
          unsub();
          const results: Record<
            string,
            { status: SubagentStatus; phase: SubagentPhase }
          > = {};
          for (const id of ids) {
            const rec = this.records.get(id);
            results[id] = {
              status: rec?.status ?? "idle",
              phase: rec?.phase ?? "idle",
            };
          }
          resolve(results);
        }
      }, 200);

      signal?.addEventListener(
        "abort",
        () => {
          clearInterval(timer);
          unsub();
          const results: Record<
            string,
            { status: SubagentStatus; phase: SubagentPhase }
          > = {};
          for (const id of ids) {
            const rec = this.records.get(id);
            results[id] = {
              status: rec?.status ?? "idle",
              phase: rec?.phase ?? "idle",
            };
          }
          resolve(results);
        },
        { once: true },
      );
    });
  }

  getAuditEntries(): AuditEntry[] {
    return this.auditEntries;
  }

  private emit(event: SubagentEvent) {
    const record = this.records.get(event.agentId);
    if (record) {
      event.parentSessionID = record.parentSessionID;
      event.parentAgentID = record.parentAgentID;
      event.continuation = record.continuation;
      event.phase = event.phase ?? record.phase;
      event.activityDetail = event.activityDetail ?? record.activityDetail;
    }
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
    stopReason?: string;
    requestedBy?: "model" | "user" | "parent" | "runtime";
    force?: boolean;
  }) {
    this.auditSeq++;
    const auditEntry: AuditEntry = {
      eventId: `aevt_${this.auditSeq}`,
      agentId: entry.agentId,
      action: entry.action,
      status: entry.status,
      attached: entry.attached,
      timestamp: entry.timestamp,
      stopReason: entry.stopReason,
      requestedBy: entry.requestedBy,
      force: entry.force,
    };
    this.auditEntries.push(auditEntry);
    if (this.auditEntries.length > this.maxAudit) {
      this.auditEntries = this.auditEntries.slice(
        this.auditEntries.length - this.maxAudit,
      );
    }
  }
}

function derivePhase(rec: { status: string }): SubagentPhase {
  const s = rec.status;
  if (s === "idle") return "idle";
  if (s === "paused") return "waiting";
  if (s === "completed" || s === "failed" || s === "stopped")
    return "finalizing";
  return "provider";
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
