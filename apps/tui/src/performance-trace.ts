import { appendFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";
import type { RuntimeEvent } from "@natalia/contracts";

/**
 * Opt-in TUI-side aggregate tracing. It deliberately never retains event text,
 * terminal output, prompts, or message blocks.
 */
export class TuiPerformanceTrace {
  private readonly destination = process.env.NATALIA_TUI_PERF_TRACE_FILE;
  private readonly enabled = Boolean(this.destination);
  private readonly startedAt = performance.now();
  private readonly runID = randomUUID();
  private expectedAt = performance.now() + 1_000;
  private timer?: ReturnType<typeof setInterval>;
  private writes = Promise.resolve();
  private events = new Map<string, number>();
  private batches = 0;
  private batchEvents = 0;
  private queueHighWater = 0;
  private flushTotalMs = 0;
  private flushMaxMs = 0;

  constructor() {
    if (this.enabled) this.timer = setInterval(() => this.flush(), 1_000);
  }

  enqueue(event: RuntimeEvent, queueLength: number) {
    if (!this.enabled) return;
    this.events.set(event.type, (this.events.get(event.type) ?? 0) + 1);
    this.queueHighWater = Math.max(this.queueHighWater, queueLength);
  }

  batch(count: number, durationMs: number) {
    if (!this.enabled) return;
    this.batches += 1;
    this.batchEvents += count;
    this.flushTotalMs += durationMs;
    this.flushMaxMs = Math.max(this.flushMaxMs, durationMs);
  }

  async stop() {
    if (!this.enabled) return;
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
    this.flush();
    await this.writes;
  }

  private flush() {
    if (!this.enabled || !this.destination) {
      this.expectedAt += 1_000;
      return;
    }
    const now = performance.now();
    const sample = {
      at: new Date().toISOString(),
      processID: process.pid,
      runID: this.runID,
      elapsedMs: Math.round(now - this.startedAt),
      eventLoopLagMs: round(Math.max(0, now - this.expectedAt)),
      events: Object.fromEntries(this.events),
      batches: this.batches,
      batchEvents: this.batchEvents,
      queueHighWater: this.queueHighWater,
      flushTotalMs: round(this.flushTotalMs),
      flushMaxMs: round(this.flushMaxMs),
      memory: process.memoryUsage(),
    };
    // Rebase after recording a late tick instead of accumulating stale lag.
    this.expectedAt = now + 1_000;
    this.events.clear();
    this.batches = 0;
    this.batchEvents = 0;
    this.queueHighWater = 0;
    this.flushTotalMs = 0;
    this.flushMaxMs = 0;
    this.writes = this.writes
      .then(async () => {
        await mkdir(dirname(this.destination!), {
          recursive: true,
          mode: 0o700,
        });
        await appendFile(this.destination!, `${JSON.stringify(sample)}\n`);
      })
      .catch(() => undefined);
  }
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}
