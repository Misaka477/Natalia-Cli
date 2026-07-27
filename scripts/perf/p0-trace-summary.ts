import { readFile } from "node:fs/promises";

const path = process.argv[2];
if (!path) throw new Error("usage: p0-trace-summary.ts <trace.jsonl>");
const samples = (await readFile(path, "utf8"))
  .split("\n")
  .filter(Boolean)
  .map((line) => JSON.parse(line) as Sample);
if (!samples.length) throw new Error("trace contains no samples");

const groups = Map.groupBy(samples, (sample) =>
  sample.runID ? `${sample.processID}:${sample.runID}` : "legacy",
);
console.log(
  JSON.stringify(
    {
      runs: [...groups.entries()].map(([run, entries]) =>
        summarize(run, entries!),
      ),
    },
    null,
    2,
  ),
);

type Sample = {
  processID?: number;
  runID?: string;
  elapsedMs: number;
  eventLoopLagMs: number;
  events: Record<string, number>;
  publishMaxMs?: number;
  phaseMaxMs?: number;
  sinkMaxMs?: number;
  pluginMaxMs?: number;
  flushMaxMs?: number;
  queueHighWater?: number;
  memory: {
    rss: number;
    heapUsed: number;
    external: number;
    arrayBuffers: number;
  };
  activeResources?: Record<string, number>;
  heapSnapshot?: string;
};

function summarize(run: string, samples: Sample[]) {
  const first = samples[0]!;
  const last = samples.at(-1)!;
  const events = new Map<string, number>();
  for (const sample of samples)
    for (const [type, count] of Object.entries(sample.events))
      events.set(type, (events.get(type) ?? 0) + count);
  return {
    run,
    samples: samples.length,
    elapsedMs: last.elapsedMs - first.elapsedMs,
    rssDeltaBytes: last.memory.rss - first.memory.rss,
    heapUsedDeltaBytes: last.memory.heapUsed - first.memory.heapUsed,
    externalDeltaBytes: last.memory.external - first.memory.external,
    arrayBuffersDeltaBytes:
      last.memory.arrayBuffers - first.memory.arrayBuffers,
    maxEventLoopLagMs: Math.max(
      ...samples.map((sample) => sample.eventLoopLagMs),
    ),
    maxPublishMs: max(samples.map((sample) => sample.publishMaxMs)),
    maxPhaseMs: max(samples.map((sample) => sample.phaseMaxMs)),
    maxSinkMs: max(samples.map((sample) => sample.sinkMaxMs)),
    maxPluginMs: max(samples.map((sample) => sample.pluginMaxMs)),
    maxTuiFlushMs: max(samples.map((sample) => sample.flushMaxMs)),
    maxTuiQueueDepth: max(samples.map((sample) => sample.queueHighWater)),
    events: Object.fromEntries(
      [...events.entries()].sort(([left], [right]) =>
        left.localeCompare(right),
      ),
    ),
    heapSnapshots: samples
      .map((sample) => sample.heapSnapshot)
      .filter((path): path is string => Boolean(path)),
    finalActiveResources: last.activeResources ?? {},
  };
}

function max(values: Array<number | undefined>) {
  return Math.max(
    0,
    ...values.filter((value): value is number => value !== undefined),
  );
}
