import { mkdir, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { cpus, platform, release } from "node:os";
import { join, resolve } from "node:path";
import { createRealRuntimeClient } from "../../packages/client/src";
import type { RuntimeEvent, SessionID } from "../../packages/contracts/src";
import {
  XtermTerminalEmulator,
  applyTerminalScreenUpdate,
  diffTerminalScreens,
  scanTerminalScreenPatch,
  terminalScreenPatchBytes,
  terminalScreenSnapshotBytes,
  terminalScreenUpdateStats,
} from "../../packages/terminal/src";
import {
  createSessionRecord,
  JsonSessionStore,
  projectSessionMessages,
  SqliteSessionStore,
} from "../../packages/session/src";
import type { StreamingProvider } from "../../packages/runtime/src";
import { TerminalRegistry } from "../../packages/terminal/src";
import {
  TerminalScreenRenderCache,
  terminalScreenRenderModel,
} from "../../apps/tui/src/component/terminal-screen-model";
import { createTerminalInputQueue } from "../../apps/tui/src/terminal-input-queue";
import {
  boundHistoryCache,
  historyCacheLimit,
} from "../../apps/tui/src/history-page-cache";
import { groupTimelineBlocks } from "../../apps/tui/src/routes/session/timeline-virtualizer";

type TerminalPhase =
  | "xtermWriteMs"
  | "snapshotMs"
  | "diffScanMs"
  | "patchApplyMs"
  | "structuralSizingMs";
type Sample = {
  elapsedMs: number;
  memory: NodeJS.MemoryUsage;
  phases?: Record<TerminalPhase, number>;
  terminal?: {
    mode: "patch" | "full";
    dirtyRows: number;
    dirtyCells: number;
    patchBytes: number;
    fullBytes: number;
    patchToFullRatio: number;
  };
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
    terminalSparseMutationScenario(),
    terminalDenseMutationScenario(),
    terminalResizeFullFrameScenario(),
    terminalAlternateBufferTransitionScenario(),
    terminalWriteSnapshotDiffApplyScenario(),
    terminalRenderUniformWorkSetScenario(),
    terminalRenderFragmentedWorkSetScenario(),
    terminalRenderBoundedViewportScenario(),
    terminalRenderCachedSparsePatchScenario(),
    terminalCustomRendererScenario(),
    terminalJsxRendererScenario(),
    terminalInputDispatchScenario(),
    terminalViewerWriteObserveScenario(tempRoot),
    terminalViewerCadenceScenario(tempRoot),
    terminalStopCleanupScenario(tempRoot),
    terminalViewerReconnectScenario(tempRoot),
    terminalRepeatedRedrawMemoryScenario(),
    terminalMetadataOnlyDiffScenario(),
    terminalStructuralSizingScenario(),
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

async function terminalSparseMutationScenario(): Promise<Scenario> {
  return terminalPhasedScenario(
    "terminal_sparse_mutation_120x36",
    async (terminal, index) => {
      await terminal.write(`\x1b[${index + 1};1Hsparse-${index}`);
      await terminal.write(`\x1b[${index + 13};40Hcell-${index}`);
    },
  );
}

async function terminalDenseMutationScenario(): Promise<Scenario> {
  return terminalPhasedScenario(
    "terminal_dense_mutation_120x36",
    async (terminal, index) => {
      const row = String(index).repeat(120).slice(0, 120);
      await terminal.write(`\x1b[H\x1b[2J${`${row}\r\n`.repeat(36)}`);
    },
  );
}

async function terminalResizeFullFrameScenario(): Promise<Scenario> {
  return terminalPhasedScenario(
    "terminal_resize_full_frame_120x36",
    async (terminal) => {
      terminal.resize(35, 119);
    },
  );
}

async function terminalAlternateBufferTransitionScenario(): Promise<Scenario> {
  return terminalPhasedScenario(
    "terminal_alternate_buffer_transition",
    async (terminal, index) => {
      await terminal.write(
        `\x1b[?1049h\x1b[Halternate-${index}\r\n${"redraw\r\n".repeat(35)}`,
      );
    },
  );
}

async function terminalWriteSnapshotDiffApplyScenario(): Promise<Scenario> {
  return terminalPhasedScenario(
    "terminal_write_snapshot_diff_apply_120x36",
    async (terminal, index) => {
      await terminal.write(`\x1b[${index + 2};10Hwrite-snapshot-${index}`);
    },
  );
}

async function terminalRenderUniformWorkSetScenario(): Promise<Scenario> {
  return terminalRenderWorkSetScenario(
    "terminal_render_uniform_work_set_120x36",
    async (terminal) => {
      await terminal.write(`\x1b[2J\x1b[H${"U".repeat(120)}\r\n`.repeat(36));
    },
  );
}

async function terminalRenderFragmentedWorkSetScenario(): Promise<Scenario> {
  return terminalRenderWorkSetScenario(
    "terminal_render_style_fragmented_work_set_120x36",
    async (terminal) => {
      const row = Array.from({ length: 60 }, () => "\x1b[31mA\x1b[32mB").join(
        "",
      );
      await terminal.write(`\x1b[2J\x1b[H${`${row}\r\n`.repeat(36)}`);
    },
  );
}

async function terminalRenderBoundedViewportScenario(): Promise<Scenario> {
  return terminalRenderWorkSetScenario(
    "terminal_render_bounded_viewport_120x36",
    async (terminal) => {
      const row = Array.from({ length: 60 }, () => "\x1b[31mA\x1b[32mB").join(
        "",
      );
      await terminal.write(`\x1b[2J\x1b[H${`${row}\r\n`.repeat(36)}`);
    },
    8,
  );
}

async function terminalRenderCachedSparsePatchScenario(): Promise<Scenario> {
  const terminal = new XtermTerminalEmulator(36, 120);
  const row = Array.from({ length: 60 }, () => "\x1b[31mA\x1b[32mB").join("");
  await terminal.write(`\x1b[2J\x1b[H${`${row}\r\n`.repeat(36)}`);
  const cache = new TerminalScreenRenderCache();
  let current = terminal.snapshot();
  cache.model(current);
  const samples: Sample[] = [];
  let result: Record<string, number | string | boolean> | undefined;
  for (let index = 0; index < 3; index++) {
    await terminal.write(`\x1b[${index + 1};1HZ`);
    const next = terminal.snapshot();
    const update = diffTerminalScreens({
      base: current,
      next,
      baseRevision: index,
      revision: index + 1,
    });
    current = applyTerminalScreenUpdate(current, update, index)!;
    const start = performance.now();
    const model = cache.model(current);
    samples.push({
      elapsedMs: performance.now() - start,
      memory: process.memoryUsage(),
    });
    result = {
      visibleRows: model.visibleRows,
      visibleCells: model.visibleCells,
      styleRuns: model.styleRuns,
      estimatedJsxNodes: model.estimatedJsxNodes,
      dirtyRows: terminalScreenUpdateStats(update).dirtyRows,
      dirtyCells: terminalScreenUpdateStats(update).dirtyCells,
    };
  }
  terminal.dispose();
  return {
    name: "terminal_render_cached_sparse_patch_120x36",
    samples,
    result,
  };
}

async function terminalCustomRendererScenario(): Promise<Scenario> {
  return terminalRendererScenario(
    "terminal_custom_cell_renderer_sparse_patch_120x36",
    "bin/terminal-cell-renderer-perf.ts",
  );
}

async function terminalJsxRendererScenario(): Promise<Scenario> {
  return terminalRendererScenario(
    "terminal_jsx_renderer_sparse_patch_120x36",
    "bin/terminal-jsx-renderer-perf.tsx",
  );
}

async function terminalRendererScenario(
  name: string,
  script: string,
): Promise<Scenario> {
  const child = Bun.spawn({
    cmd: [process.execPath, script],
    cwd: resolve("apps/tui"),
    stdout: "pipe",
    stderr: "pipe",
  });
  const stdout = await new Response(child.stdout).text();
  const stderr = await new Response(child.stderr).text();
  if ((await child.exited) !== 0)
    throw new Error(`${name} fixture failed: ${stderr}`);
  const result = JSON.parse(stdout) as {
    samples: Array<{
      elapsedMs: number;
      nativeFrameCount: number;
      nativeLastFrameTime: number;
      nativeAverageFrameTime: number;
      cellsUpdated: number;
    }>;
  };
  return {
    name,
    samples: result.samples.map((sample) => ({
      elapsedMs: sample.elapsedMs,
      memory: process.memoryUsage(),
    })),
    result: {
      nativeFrameCount: result.samples.at(-1)?.nativeFrameCount ?? 0,
      // OpenTUI NativeRenderStats reports frame durations in microseconds.
      nativeLastFrameTimeMs:
        (result.samples.at(-1)?.nativeLastFrameTime ?? 0) / 1_000,
      nativeAverageFrameTimeMs:
        (result.samples.at(-1)?.nativeAverageFrameTime ?? 0) / 1_000,
      cellsUpdated: result.samples.at(-1)?.cellsUpdated ?? 0,
    },
  };
}

async function terminalInputDispatchScenario(): Promise<Scenario> {
  const samples: Sample[] = [];
  for (let index = 0; index < 3; index++) {
    const invoked: number[] = [];
    const queue = createTerminalInputQueue({
      async write() {
        invoked.push(performance.now());
      },
      onError(cause) {
        throw cause;
      },
    });
    const start = performance.now();
    queue.queue("a");
    queue.queue("b");
    await Promise.resolve();
    await queue.idle();
    samples.push({
      elapsedMs: performance.now() - start,
      memory: process.memoryUsage(),
    });
    if (invoked.length !== 1) throw new Error("terminal input batching failed");
  }
  return {
    name: "terminal_input_queue_dispatch",
    samples,
    result: { sameTickWrites: 2, backendInvocations: 1 },
  };
}

async function terminalViewerWriteObserveScenario(
  root: string,
): Promise<Scenario> {
  const registry = new TerminalRegistry(join(root, "viewer-latency"));
  const session = await registry.start({
    command: "cat",
    cwd: root,
    rows: 36,
    cols: 120,
  });
  const viewerID = "perf_viewer";
  registry.registerViewer(session.id, { viewerID, kind: "embedded" });
  registry.takeoverViewer(session.id, viewerID);
  const samples: Sample[] = [];
  let result: Record<string, number | string | boolean> | undefined;
  try {
    for (let index = 0; index < 3; index++) {
      const revision = registry.get(session.id).revision;
      const observation = registry.observe(session.id, {
        afterRevision: revision,
        timeoutMs: 2_000,
        differential: true,
      });
      const start = performance.now();
      await registry.viewerWrite(session.id, viewerID, `latency-${index}\r`);
      const observed = await observation;
      samples.push({
        elapsedMs: performance.now() - start,
        memory: process.memoryUsage(),
      });
      if (!observed.changed || observed.reason !== "changed")
        throw new Error(
          "terminal viewer write did not produce a revision update",
        );
      result = {
        observationMode: observed.screenDelivery?.mode ?? "none",
        dirtyRows: observed.screenDelivery?.mode === "patch" ? 1 : 0,
        revisionDelta: observed.session.revision - revision,
        inputOwner: registry.get(session.id).inputOwner.type,
      };
    }
  } finally {
    await registry.stop(session.id);
    registry.dispose();
  }
  return {
    name: "terminal_viewer_write_to_differential_observe_cat",
    samples,
    result,
  };
}

async function terminalRouteLatencyScenario(): Promise<Scenario> {
  const child = Bun.spawn({
    cmd: [process.execPath, "bin/terminal-route-latency-perf.ts"],
    cwd: resolve("apps/tui"),
    stdout: "pipe",
    stderr: "pipe",
  });
  await new Response(child.stdout).text();
  const stderr = await new Response(child.stderr).text();
  if ((await child.exited) !== 0)
    throw new Error(`terminal route fixture failed: ${stderr}`);
  const result = JSON.parse(stderr) as {
    samples: Array<{
      writeToObserveMs: number;
      observeToRenderModelMs: number;
      writeToRenderModelMs: number;
    }>;
  };
  return {
    name: "terminal_route_key_to_render_model",
    samples: result.samples.map((sample) => ({
      elapsedMs: sample.writeToRenderModelMs,
      memory: process.memoryUsage(),
    })),
    result: {
      writeToObserveP50Ms: percentile(
        result.samples.map((sample) => sample.writeToObserveMs),
        0.5,
      ),
      observeToRenderModelP50Ms: percentile(
        result.samples.map((sample) => sample.observeToRenderModelMs),
        0.5,
      ),
      keyToRenderModelP50Ms: percentile(
        result.samples.map((sample) => sample.writeToRenderModelMs),
        0.5,
      ),
    },
  };
}

async function terminalViewerCadenceScenario(root: string): Promise<Scenario> {
  const registry = new TerminalRegistry(join(root, "viewer-cadence"));
  const session = await registry.start({ command: "cat", cwd: root });
  const samples: Sample[] = [];
  try {
    for (const mode of ["foreground", "hidden"] as const) {
      const viewerID = `cadence_${mode}`;
      registry.registerViewer(session.id, { viewerID, kind: "embedded" });
      if (mode === "foreground") registry.takeoverViewer(session.id, viewerID);
      const before = process.memoryUsage();
      const start = performance.now();
      for (let index = 0; index < 20; index++) {
        const revision = registry.get(session.id).revision;
        const observed = registry.observe(session.id, {
          afterRevision: revision,
          timeoutMs: 2_000,
          differential: mode === "foreground",
        });
        if (mode === "foreground")
          await registry.viewerWrite(
            session.id,
            viewerID,
            `cadence-${index}\r`,
          );
        else await registry.write(session.id, `cadence-${index}`);
        await observed;
      }
      const after = process.memoryUsage();
      samples.push({
        elapsedMs: performance.now() - start,
        memory: {
          ...after,
          rss: after.rss - before.rss,
          heapUsed: after.heapUsed - before.heapUsed,
        },
      });
      if (mode === "foreground")
        registry.releaseInputViewer(session.id, viewerID);
      await registry.unregisterViewer(session.id, viewerID);
    }
  } finally {
    await registry.stop(session.id);
    registry.dispose();
  }
  return {
    name: "terminal_foreground_hidden_viewer_cadence",
    samples,
    result: {
      updatesPerMode: 20,
      foregroundRssDeltaBytes: samples[0]?.memory.rss ?? 0,
      hiddenRssDeltaBytes: samples[1]?.memory.rss ?? 0,
      foregroundHeapDeltaBytes: samples[0]?.memory.heapUsed ?? 0,
      hiddenHeapDeltaBytes: samples[1]?.memory.heapUsed ?? 0,
    },
  };
}

async function terminalStopCleanupScenario(root: string): Promise<Scenario> {
  const samples: Sample[] = [];
  for (let run = 0; run < 3; run++) {
    const registry = new TerminalRegistry(join(root, `stop-cleanup-${run}`));
    const session = await registry.start({ command: "cat", cwd: root });
    const viewerID = `cleanup_viewer_${run}`;
    registry.registerViewer(session.id, { viewerID, kind: "embedded" });
    registry.takeoverViewer(session.id, viewerID);
    const controller = new AbortController();
    const waiter = registry.observe(session.id, {
      afterRevision: registry.get(session.id).revision,
      timeoutMs: 2_000,
      signal: controller.signal,
    });
    const start = performance.now();
    controller.abort(new Error("fixture cleanup"));
    await waiter.catch(() => undefined);
    await registry.unregisterViewer(session.id, viewerID);
    await registry.stop(session.id);
    samples.push({
      elapsedMs: performance.now() - start,
      memory: process.memoryUsage(),
    });
    if (registry.runningCount() !== 0)
      throw new Error("terminal stop cleanup left a running terminal");
    registry.dispose();
  }
  return {
    name: "terminal_stop_unregister_waiter_cleanup",
    samples,
    result: {
      viewerUnregistered: true,
      runningCountAfterStop: 0,
      waiterAborted: true,
    },
  };
}

async function terminalViewerReconnectScenario(
  root: string,
): Promise<Scenario> {
  const samples: Sample[] = [];
  for (let run = 0; run < 3; run++) {
    const registry = new TerminalRegistry(join(root, `reconnect-${run}`), {
      viewerTimeoutMs: 300,
      watchdogIntervalMs: 25,
    });
    const session = await registry.start({ command: "cat", cwd: root });
    try {
      registry.registerViewer(session.id, {
        viewerID: "old",
        kind: "embedded",
      });
      registry.takeoverViewer(session.id, "old");
      await Bun.sleep(350);
      const start = performance.now();
      registry.registerViewer(session.id, {
        viewerID: "new",
        kind: "embedded",
      });
      registry.takeoverViewer(session.id, "new");
      registry.heartbeatViewer(session.id, "new");
      const revision = registry.get(session.id).revision;
      const observed = registry.observe(session.id, {
        afterRevision: revision,
        differential: true,
        timeoutMs: 2_000,
      });
      await registry.viewerWrite(session.id, "new", `reconnect-${run}\r`);
      const result = await observed;
      samples.push({
        elapsedMs: performance.now() - start,
        memory: process.memoryUsage(),
      });
      if (
        !result.changed ||
        registry.get(session.id).inputOwner.type !== "viewer"
      )
        throw new Error("reconnected viewer did not regain terminal ownership");
    } finally {
      await registry.stop(session.id);
      registry.dispose();
    }
  }
  return {
    name: "terminal_viewer_crash_reconnect",
    samples,
    result: { watchdogReclaimMs: 300, replacementViewer: true },
  };
}

async function terminalRepeatedRedrawMemoryScenario(): Promise<Scenario> {
  const terminal = new XtermTerminalEmulator(36, 120);
  const samples: Sample[] = [];
  const row = Array.from({ length: 60 }, () => "\x1b[31mA\x1b[32mB").join("");
  for (let index = 0; index < 3; index++) {
    const start = performance.now();
    for (let frame = 0; frame < 60; frame++) {
      await terminal.write(`\x1b[H\x1b[2J${`${row}\r\n`.repeat(36)}`);
      terminal.snapshot();
    }
    samples.push({
      elapsedMs: performance.now() - start,
      memory: process.memoryUsage(),
    });
  }
  terminal.dispose();
  return {
    name: "terminal_repeated_fragmented_redraw_memory_120x36",
    samples,
    result: {
      framesPerSample: 60,
      rssDeltaBytes:
        (samples.at(-1)?.memory.rss ?? 0) - (samples[0]?.memory.rss ?? 0),
      heapUsedDeltaBytes:
        (samples.at(-1)?.memory.heapUsed ?? 0) -
        (samples[0]?.memory.heapUsed ?? 0),
    },
  };
}

async function terminalRenderWorkSetScenario(
  name: string,
  setup: (terminal: XtermTerminalEmulator) => Promise<void>,
  maxRows?: number,
): Promise<Scenario> {
  const terminal = new XtermTerminalEmulator(36, 120);
  await setup(terminal);
  const screen = terminal.snapshot();
  const samples: Sample[] = [];
  let result: Record<string, number | string | boolean> | undefined;
  for (let index = 0; index < 3; index++) {
    const start = performance.now();
    const model = terminalScreenRenderModel(screen, maxRows);
    samples.push({
      elapsedMs: performance.now() - start,
      memory: process.memoryUsage(),
    });
    result = {
      visibleRows: model.visibleRows,
      visibleCells: model.visibleCells,
      styleRuns: model.styleRuns,
      estimatedJsxNodes: model.estimatedJsxNodes,
      maxRows: maxRows ?? screen.rows,
    };
  }
  terminal.dispose();
  return { name, samples, result };
}

async function terminalPhasedScenario(
  name: string,
  mutate: (terminal: XtermTerminalEmulator, index: number) => Promise<void>,
): Promise<Scenario> {
  const samples: Sample[] = [];
  for (let index = 0; index < 3; index++) {
    const terminal = new XtermTerminalEmulator(36, 120);
    await terminal.write("baseline terminal content\r\n".repeat(200));
    const base = terminal.snapshot();
    const writeStart = performance.now();
    await mutate(terminal, index);
    const xtermWriteMs = performance.now() - writeStart;
    const snapshotStart = performance.now();
    const next = terminal.snapshot();
    const snapshotMs = performance.now() - snapshotStart;
    const diffStart = performance.now();
    const patch = scanTerminalScreenPatch({
      base,
      next,
      baseRevision: 1,
      revision: 2,
    });
    const diffScanMs = performance.now() - diffStart;
    const sizingStart = performance.now();
    const fullBytes = terminalScreenSnapshotBytes(next);
    const patchBytes = patch ? terminalScreenPatchBytes(patch) : fullBytes;
    const structuralSizingMs = performance.now() - sizingStart;
    const update = diffTerminalScreens({
      base,
      next,
      baseRevision: 1,
      revision: 2,
    });
    const patchApplyStart = performance.now();
    const applied = applyTerminalScreenUpdate(base, update, 1);
    const patchApplyMs = performance.now() - patchApplyStart;
    if (JSON.stringify(applied) !== JSON.stringify(next))
      throw new Error(
        `${name} patch application did not reconstruct the frame`,
      );
    const stats = terminalScreenUpdateStats(update);
    samples.push({
      elapsedMs:
        xtermWriteMs +
        snapshotMs +
        diffScanMs +
        patchApplyMs +
        structuralSizingMs,
      memory: process.memoryUsage(),
      phases: {
        xtermWriteMs,
        snapshotMs,
        diffScanMs,
        patchApplyMs,
        structuralSizingMs,
      },
      terminal: {
        mode: stats.mode,
        dirtyRows: stats.dirtyRows,
        dirtyCells: stats.dirtyCells,
        patchBytes,
        fullBytes,
        patchToFullRatio: patchBytes / fullBytes,
      },
    });
    terminal.dispose();
  }
  return { name, samples, result: summarizeTerminalSamples(samples) };
}

async function terminalMetadataOnlyDiffScenario(): Promise<Scenario> {
  const terminal = new XtermTerminalEmulator(36, 120);
  await terminal.write("stable terminal content\r\n".repeat(200));
  let base = terminal.snapshot();
  const samples: Sample[] = [];
  for (let index = 0; index < 3; index++) {
    await terminal.write(`\x1b[${index + 1};1H`);
    const next = terminal.snapshot();
    const start = performance.now();
    const update = diffTerminalScreens({
      base,
      next,
      baseRevision: index,
      revision: index + 1,
    });
    samples.push({
      elapsedMs: performance.now() - start,
      memory: process.memoryUsage(),
    });
    if (update.kind !== "patch" || update.patch.changes.length)
      throw new Error(
        "terminal metadata-only diff fixture produced cell changes",
      );
    base = next;
  }
  terminal.dispose();
  return { name: "terminal_metadata_only_diff_120x36", samples };
}

async function terminalStructuralSizingScenario(): Promise<Scenario> {
  const terminal = new XtermTerminalEmulator(36, 120);
  await terminal.write("sizing baseline\r\n".repeat(200));
  const base = terminal.snapshot();
  await terminal.write("\x1b[1;1Hpatch");
  const next = terminal.snapshot();
  const update = diffTerminalScreens({
    base,
    next,
    baseRevision: 1,
    revision: 2,
  });
  const samples: Sample[] = [];
  for (let index = 0; index < 3; index++) {
    const start = performance.now();
    terminalScreenSnapshotBytes(next);
    if (update.kind === "patch") terminalScreenPatchBytes(update.patch);
    samples.push({
      elapsedMs: performance.now() - start,
      memory: process.memoryUsage(),
    });
  }
  terminal.dispose();
  return { name: "terminal_structural_delivery_sizing_120x36", samples };
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

function summarizeTerminalSamples(samples: Sample[]) {
  const terminal = samples.map((sample) => sample.terminal!);
  const phases = samples.map((sample) => sample.phases!);
  return {
    firstRunMode: terminal[0]?.mode ?? "unknown",
    firstRunElapsedMs: samples[0]?.elapsedMs ?? 0,
    warmElapsedP50Ms: percentile(
      samples.slice(1).map((sample) => sample.elapsedMs),
      0.5,
    ),
    warmModes: terminal
      .slice(1)
      .map((sample) => sample.mode)
      .join(","),
    dirtyRows: terminal.map((sample) => sample.dirtyRows).join(","),
    dirtyCells: terminal.map((sample) => sample.dirtyCells).join(","),
    patchToFullRatioP50: percentile(
      terminal.map((sample) => sample.patchToFullRatio),
      0.5,
    ),
    xtermWriteP50Ms: percentile(
      phases.map((sample) => sample.xtermWriteMs),
      0.5,
    ),
    snapshotP50Ms: percentile(
      phases.map((sample) => sample.snapshotMs),
      0.5,
    ),
    diffScanP50Ms: percentile(
      phases.map((sample) => sample.diffScanMs),
      0.5,
    ),
    patchApplyP50Ms: percentile(
      phases.map((sample) => sample.patchApplyMs),
      0.5,
    ),
    structuralSizingP50Ms: percentile(
      phases.map((sample) => sample.structuralSizingMs),
      0.5,
    ),
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
