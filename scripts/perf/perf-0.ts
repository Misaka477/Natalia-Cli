import { mkdir, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { cpus, platform, release } from "node:os";
import { join, resolve } from "node:path";
import { createRealRuntimeClient } from "../../packages/client/src";
import type { RuntimeEvent, SessionID } from "../../packages/contracts/src";

import {
  createSessionRecord,
  JsonSessionStore,
  projectSessionMessages,
  SqliteSessionStore,
} from "../../packages/session/src";
import type { StreamingProvider } from "../../packages/runtime/src";
import {
  boundHistoryCache,
  historyCacheLimit,
} from "../../apps/tui/src/history-page-cache";
import { groupTimelineBlocks } from "../../apps/tui/src/routes/session/timeline-virtualizer";

type Sample = {
  elapsedMs: number;
  memory: NodeJS.MemoryUsage;
};
type Scenario = {
  name: string;
  samples: Sample[];
  result?: Record<string, number | string | boolean>;
};

const output = outputPath(process.argv.slice(2));
const tempRoot = await mkdtemp("/tmp/natalia-perf-0-");

try {
  const scenarios = await Promise.all([
    runtimeStartupScenario(tempRoot),
    sqlitePagedRecoveryScenario(tempRoot),
    sqliteHistoryScenario(tempRoot),
    sqliteSequentialWriteScenario(tempRoot),
    sqliteBatchedWriteScenario(tempRoot),
    sqliteWriterReaderContentionScenario(tempRoot),
    jsonSessionSaveScenario(tempRoot),
    projectionScenario(),
    tuiProjectionScenario(),
    tuiHistoryCacheScenario(),
    tuiHistoryScrollReloadScenario(),
  ]);
  const report = {
    version: 1,
    recordedAt: new Date().toISOString(),
    environment: {
      platform: platform(),
      release: release(),
      cpuCount: cpus().length,
      bun: Bun.version,
      node: process.version,
    },
    scenarios: scenarios.map((scenario) => ({
      ...scenario,
      summary: summarize(scenario.samples),
    })),
  };
  const serialized = `${JSON.stringify(report, null, 2)}\n`;
  if (output) {
    await mkdir(resolve(output, ".."), { recursive: true });
    await writeFile(output, serialized);
  }
  console.log(serialized);
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}

async function runtimeStartupScenario(root: string): Promise<Scenario> {
  const samples: Sample[] = [];
  let dirtyRows = 0;
  let dirtyCells = 0;
  for (let index = 0; index < 3; index++) {
    const workspace = join(root, `startup-${index}`);
    const start = performance.now();
    const client = createRealRuntimeClient({
      workspaceRoot: workspace,
      sessionID: `ses_perf_start_${index}` as SessionID,
      provider: scriptedProvider(),
    });
    await new Promise<void>((resolveReady) => {
      client.start((event) => {
        if (event.type === "session.ready") resolveReady();
      });
    });
    samples.push({
      elapsedMs: performance.now() - start,
      memory: process.memoryUsage(),
    });
    await client.dispose?.();
  }
  return {
    name: "runtime_start_cold_then_warm",
    samples,
    result: {
      coldElapsedMs: samples[0]?.elapsedMs ?? 0,
      warmP50ElapsedMs: percentile(
        samples.slice(1).map((sample) => sample.elapsedMs),
        0.5,
      ),
    },
  };
}

async function sqlitePagedRecoveryScenario(root: string): Promise<Scenario> {
  const workspace = join(root, "paged-recovery");
  const databasePath = join(workspace, ".natalia", "sessions.db");
  await mkdir(resolve(databasePath, ".."), { recursive: true });
  const store = new SqliteSessionStore(databasePath);
  const sessionID = "ses_perf_paged_recovery" as SessionID;
  store.create(sessionID, "Paged recovery");
  for (let index = 0; index < 1_000; index++) {
    const id = `turn_${index}`;
    store.appendEvents(sessionID, [
      {
        type: "turn.submitted",
        id,
        text: `fixture prompt ${index}`,
        byteLength: 16,
        lineCount: 1,
        sha256: "fixture",
      },
      { type: "content.done", id, text: "fixture response" },
      { type: "turn.finished", id, stopReason: "done" },
    ]);
  }
  store.appendEvent(sessionID, {
    type: "context.checkpoint",
    id: "epoch_perf_paged_recovery",
    snapshot: {
      entries: [],
      resources: [],
      journalOffset: 3_000,
      step: 1_000,
      tokenEstimate: 0,
      compactionGeneration: 0,
    },
  });
  store.close();
  const samples: Sample[] = [];
  for (let index = 0; index < 3; index++) {
    const client = createRealRuntimeClient({
      workspaceRoot: workspace,
      sessionID,
      provider: scriptedProvider(),
      useSqliteStore: true,
    });
    const start = performance.now();
    await new Promise<void>((resolveReady) => {
      client.start(
        async (event) => {
          if (event.type !== "session.ready") return;
          const page = await client.messages?.({ limit: 100 });
          if (page?.data.length !== 100)
            throw new Error("paged recovery fixture page incomplete");
          resolveReady();
        },
        { replay: "none" },
      );
    });
    samples.push({
      elapsedMs: performance.now() - start,
      memory: process.memoryUsage(),
    });
    await client.dispose?.();
  }
  return {
    name: "sqlite_1000_turn_replay_none_ready_and_first_page",
    samples,
  };
}

async function sqliteHistoryScenario(root: string): Promise<Scenario> {
  const path = join(root, "sessions.db");
  const store = new SqliteSessionStore(path);
  const sessionID = "ses_perf_history" as SessionID;
  store.create(sessionID, "PERF history");
  const events = Array.from({ length: 2_500 }, (_, index) => {
    const id = `turn_${index}`;
    return [
      {
        type: "turn.submitted" as const,
        id,
        text: `fixture prompt ${index}`,
        byteLength: 16,
        lineCount: 1,
        sha256: "fixture",
      },
      { type: "content.delta" as const, id, text: "fixture response" },
      { type: "content.done" as const, id, text: "fixture response" },
      { type: "turn.finished" as const, id, stopReason: "done" as const },
    ];
  }).flat();
  const appendStart = performance.now();
  store.appendEvents(sessionID, events);
  const append = {
    elapsedMs: performance.now() - appendStart,
    memory: process.memoryUsage(),
  };
  const samples = [append];
  for (let index = 0; index < 3; index++) {
    const start = performance.now();
    const page = store.loadEventPage(sessionID, { after: 9_000, limit: 100 });
    samples.push({
      elapsedMs: performance.now() - start,
      memory: process.memoryUsage(),
    });
    if (page.events.length !== 100)
      throw new Error("SQLite PERF-0 page fixture incomplete");
  }
  for (let index = 0; index < 3; index++) {
    const start = performance.now();
    const page = store.loadMessagePage(sessionID, { limit: 100 });
    samples.push({
      elapsedMs: performance.now() - start,
      memory: process.memoryUsage(),
    });
    if (page.data.length !== 100)
      throw new Error("SQLite PERF-0 message page fixture incomplete");
  }
  store.close();
  return {
    name: "sqlite_10000_events_append_event_and_message_page",
    samples,
    result: { eventCount: events.length, appendElapsedMs: append.elapsedMs },
  };
}

async function sqliteSequentialWriteScenario(root: string): Promise<Scenario> {
  const store = new SqliteSessionStore(join(root, "sequential.db"));
  const sessionID = "ses_perf_sequential" as SessionID;
  store.create(sessionID, "Sequential writes");
  const samples: Sample[] = [];
  for (let run = 0; run < 3; run++) {
    const start = performance.now();
    for (let index = 0; index < 250; index++)
      await store.appendEventAsync(sessionID, {
        type: "diagnostic",
        level: "info",
        message: `sequential ${run}:${index}`,
        at: "2026-07-24T00:00:00.000Z",
      });
    samples.push({
      elapsedMs: performance.now() - start,
      memory: process.memoryUsage(),
    });
  }
  store.close();
  return {
    name: "sqlite_250_sequential_durable_writes",
    samples,
    result: { writesPerRun: 250 },
  };
}

async function sqliteBatchedWriteScenario(root: string): Promise<Scenario> {
  const store = new SqliteSessionStore(join(root, "batched.db"));
  const sessionID = "ses_perf_batched" as SessionID;
  store.create(sessionID, "Batched writes");
  const samples: Sample[] = [];
  for (let run = 0; run < 3; run++) {
    const start = performance.now();
    for (let index = 0; index < 250; index++)
      store.enqueueEvent(sessionID, {
        type: "diagnostic",
        level: "info",
        message: `batched ${run}:${index}`,
        at: "2026-07-24T00:00:00.000Z",
      });
    await store.flushPendingWrites(sessionID);
    samples.push({
      elapsedMs: performance.now() - start,
      memory: process.memoryUsage(),
    });
  }
  const eventCount = store.eventCount(sessionID);
  store.close();
  return {
    name: "sqlite_250_batched_durable_writes",
    samples,
    result: { writesPerRun: 250, eventCount, maxBatchSize: 100 },
  };
}

async function sqliteWriterReaderContentionScenario(
  root: string,
): Promise<Scenario> {
  const path = join(root, "contention.db");
  const writer = new SqliteSessionStore(path);
  const sessionID = "ses_perf_contention" as SessionID;
  writer.create(sessionID, "contention");
  const readers = Array.from({ length: 3 }, () => new SqliteSessionStore(path));
  const samples: Sample[] = [];
  try {
    for (let run = 0; run < 3; run++) {
      const start = performance.now();
      for (let index = 0; index < 100; index++) {
        writer.enqueueEvent(sessionID, {
          type: "diagnostic",
          level: "info",
          message: `contention ${run}:${index}`,
          at: "2026-07-25T00:00:00.000Z",
        });
        for (const reader of readers) reader.eventCount(sessionID);
      }
      await writer.flushPendingWrites(sessionID);
      samples.push({
        elapsedMs: performance.now() - start,
        memory: process.memoryUsage(),
      });
    }
    const checkpointStart = performance.now();
    const checkpoint = writer.checkpoint();
    const checkpointMs = performance.now() - checkpointStart;
    samples.push({ elapsedMs: checkpointMs, memory: process.memoryUsage() });
    return {
      name: "sqlite_writer_three_readers_contention",
      samples,
      result: {
        writesPerRun: 100,
        readerCount: readers.length,
        checkpointMs,
        checkpoint,
      },
    };
  } finally {
    for (const reader of readers) reader.close();
    writer.close();
  }
}

async function jsonSessionSaveScenario(root: string): Promise<Scenario> {
  const store = new JsonSessionStore(join(root, "json-sessions"));
  const session = createSessionRecord(
    "ses_perf_json" as SessionID,
    "JSON PERF",
  );
  session.events = Array.from({ length: 1_000 }, (_, index) => ({
    type: "diagnostic" as const,
    level: "info" as const,
    message: `json fixture event ${index}`,
    at: "2026-07-24T00:00:00.000Z",
  }));
  const samples: Sample[] = [];
  for (let index = 0; index < 3; index++) {
    const start = performance.now();
    await store.save(session);
    samples.push({
      elapsedMs: performance.now() - start,
      memory: process.memoryUsage(),
    });
  }
  const bytes = (await stat(join(store.dir, `${session.id}.json`))).size;
  return {
    name: "json_session_full_save_1000_events",
    samples,
    result: { eventCount: session.events.length, fileBytes: bytes },
  };
}

async function projectionScenario(): Promise<Scenario> {
  const session = createSessionRecord(
    "ses_perf_projection" as SessionID,
    "Projection",
  );
  for (let index = 0; index < 1_000; index++) {
    const id = `turn_${index}`;
    session.events.push(
      {
        type: "turn.submitted",
        id,
        text: `fixture prompt ${index}`,
        byteLength: 16,
        lineCount: 1,
        sha256: "fixture",
      },
      { type: "content.delta", id, text: "x".repeat(300) },
      { type: "content.done", id, text: "x".repeat(300) },
      { type: "turn.finished", id, stopReason: "done" },
    );
  }
  const samples: Sample[] = [];
  for (let index = 0; index < 3; index++) {
    const start = performance.now();
    const page = projectSessionMessages(session, { limit: 100, order: "desc" });
    samples.push({
      elapsedMs: performance.now() - start,
      memory: process.memoryUsage(),
    });
    if (page.data.length !== 100)
      throw new Error("message projection fixture incomplete");
  }
  return { name: "project_1000_turns_4000_events", samples };
}

async function tuiProjectionScenario(): Promise<Scenario> {
  const markdown = [
    "# PERF-0",
    "",
    "- item".repeat(2_000),
    "",
    "```ts",
    "x".repeat(40_000),
    "```",
  ].join("\n");
  const blocks = Array.from({ length: 2_000 }, (_, index) => ({
    id: `turn_${Math.floor(index / 4)}:${index}`,
    role: index % 4 === 0 ? "assistant" : "tool",
    text: index === 0 ? markdown : `tool fixture ${index}`,
  }));
  const samples: Sample[] = [];
  for (let index = 0; index < 3; index++) {
    const start = performance.now();
    const groups = groupTimelineBlocks(blocks, 12);
    samples.push({
      elapsedMs: performance.now() - start,
      memory: process.memoryUsage(),
    });
    if (!groups.length) throw new Error("TUI grouping fixture incomplete");
  }
  return {
    name: "tui_long_markdown_and_500_tool_cards",
    samples,
    result: { messageBlocks: blocks.length, toolCards: 500 },
  };
}

async function tuiHistoryCacheScenario(): Promise<Scenario> {
  const samples: Sample[] = [];
  let cachedMessages = 0;
  for (let run = 0; run < 3; run++) {
    const messages = Array.from({ length: 2_000 }, (_, index) => [
      {
        id: `turn_${index}:user`,
        role: "user" as const,
        text: `user ${index}`,
      },
      {
        id: `turn_${index}:assistant`,
        role: "assistant" as const,
        text: `assistant ${index}`,
      },
    ]).flat();
    const start = performance.now();
    const result = boundHistoryCache(messages, "older");
    samples.push({
      elapsedMs: performance.now() - start,
      memory: process.memoryUsage(),
    });
    cachedMessages = result.messages.length;
    if (!result.evicted || cachedMessages > historyCacheLimit)
      throw new Error("TUI history cache fixture was not bounded");
  }
  return {
    name: "tui_2000_turn_history_cache_bound",
    samples,
    result: { sourceMessages: 4_000, cachedMessages, historyCacheLimit },
  };
}

async function tuiHistoryScrollReloadScenario(): Promise<Scenario> {
  const turns = Array.from({ length: 2_000 }, (_, index) => [
    { id: `turn_${index}:user`, role: "user" as const, text: `user ${index}` },
    {
      id: `turn_${index}:assistant`,
      role: "assistant" as const,
      text: `assistant ${index}`,
    },
  ]).flat();
  const samples: Sample[] = [];
  let cached = turns.slice(-240);
  for (let run = 0; run < 3; run++) {
    const start = performance.now();
    for (let page = 0; page < 20; page++) {
      const older = turns.slice(
        Math.max(0, turns.length - 240 - (page + 1) * 100),
        Math.max(0, turns.length - 240 - page * 100),
      );
      cached = boundHistoryCache([...older, ...cached], "older").messages;
      cached = boundHistoryCache(
        [...cached, ...turns.slice(-100)],
        "newer",
      ).messages;
    }
    samples.push({
      elapsedMs: performance.now() - start,
      memory: process.memoryUsage(),
    });
    if (cached.length > historyCacheLimit)
      throw new Error("history scroll reload fixture exceeded cache limit");
  }
  return {
    name: "tui_10k_events_2k_blocks_history_scroll_reload",
    samples,
    result: {
      sourceBlocks: turns.length,
      cachedBlocks: cached.length,
      pageCycles: 20,
    },
  };
}

function scriptedProvider(): StreamingProvider {
  return {
    provider: "perf-scripted",
    model: "perf-scripted",
    async *stream() {
      yield { type: "content", text: "ready" };
      yield { type: "done" };
    },
  };
}

function summarize(samples: Sample[]) {
  const elapsed = samples
    .map((sample) => sample.elapsedMs)
    .toSorted((a, b) => a - b);
  const rss = samples.map((sample) => sample.memory.rss);
  const heapUsed = samples.map((sample) => sample.memory.heapUsed);
  return {
    runs: samples.length,
    elapsedMs: {
      min: elapsed[0] ?? 0,
      p50: percentile(elapsed, 0.5),
      p95: percentile(elapsed, 0.95),
      max: elapsed.at(-1) ?? 0,
    },
    memoryBytes: {
      rssMax: Math.max(...rss),
      heapUsedMax: Math.max(...heapUsed),
    },
  };
}

function percentile(values: number[], percentile: number) {
  const sorted = values.toSorted((left, right) => left - right);
  return (
    sorted[
      Math.min(sorted.length - 1, Math.floor(sorted.length * percentile))
    ] ?? 0
  );
}

function outputPath(args: string[]) {
  const index = args.indexOf("--output");
  return index >= 0 && args[index + 1] ? resolve(args[index + 1]!) : undefined;
}
