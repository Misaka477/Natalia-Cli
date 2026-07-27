import type {
  RuntimeClient,
  RuntimeEvent,
  RuntimeProjectedMessage,
} from "@natalia/contracts";
import { runTuiShell } from "../src/app/runtime";

const pages = Array.from({ length: 20 }, (_, page) =>
  Array.from({ length: 50 }, (_, index) => {
    const turn = page * 50 + index;
    const submitted = {
      type: "turn.submitted" as const,
      id: `turn_${turn}`,
      text: `user ${turn} ${"x".repeat(80)}`,
      byteLength: 86,
      lineCount: 1,
      sha256: `fixture_${turn}`,
    };
    return {
      id: `turn_${turn}`,
      turnID: `turn_${turn}`,
      submitted,
      rows: [
        {
          id: `turn_${turn}:user`,
          turnID: `turn_${turn}`,
          kind: "user" as const,
          event: submitted,
        },
        {
          id: `turn_${turn}:assistant`,
          turnID: `turn_${turn}`,
          kind: "assistant" as const,
          event: {
            type: "content.done" as const,
            id: `turn_${turn}`,
            text: `assistant ${turn} ${"x".repeat(80)}`,
          },
        },
      ],
    } satisfies RuntimeProjectedMessage;
  }),
);
let controls:
  | { loadOlder(): Promise<void>; loadNewer(): Promise<void> }
  | undefined;
let pageCalls = 0;
const backend: RuntimeClient = {
  start(onEvent: (event: RuntimeEvent) => void) {
    onEvent({
      type: "session.created",
      sessionID: "ses_history_shell" as never,
      title: "History perf",
    });
    onEvent({ type: "session.ready", sessionID: "ses_history_shell" as never });
  },
  async messages(input = {}) {
    pageCalls++;
    const index = input.cursor ? Number(input.cursor) : pages.length - 1;
    const data = pages[index] ?? [];
    return {
      data,
      cursor: {
        next: index > 0 ? String(index - 1) : undefined,
        previous: index < pages.length - 1 ? String(index + 1) : undefined,
      },
    };
  },
  cancel() {},
  async submit(text) {
    return {
      type: "turn.submitted" as const,
      id: "turn_shell",
      text,
      byteLength: text.length,
      lineCount: 1,
      sha256: "fixture",
    };
  },
  snapshot() {
    return { type: "snapshot.created" as const, id: "history", files: [] };
  },
  diagnostic() {},
  lastSubmission: () => undefined,
  respondApproval() {},
  respondQuestion() {},
};
const before = process.memoryUsage();
const startedAt = performance.now();
const handle = await runTuiShell({
  backend,
  closeAfterInitialTurn: false,
  rendererSize: { width: 120, height: 36 },
  onHistoryControls(value) {
    controls = value;
  },
});
try {
  await waitFor(() => controls && pageCalls >= 1);
  const older: number[] = [];
  for (let index = 0; index < 12; index++) {
    const start = performance.now();
    await controls!.loadOlder();
    older.push(performance.now() - start);
  }
  const newer: number[] = [];
  for (let index = 0; index < 12; index++) {
    const start = performance.now();
    await controls!.loadNewer();
    newer.push(performance.now() - start);
  }
  const after = process.memoryUsage();
  process.stderr.write(
    JSON.stringify({
      fixture: {
        turns: 1000,
        blocks: 2000,
        pages: pages.length,
        pageSize: 100,
      },
      pageCalls,
      initialMs: performance.now() - startedAt,
      olderMs: older,
      newerMs: newer,
      rssDeltaBytes: after.rss - before.rss,
      heapUsedDeltaBytes: after.heapUsed - before.heapUsed,
    }) + "\n",
  );
} finally {
  handle.stop();
}

async function waitFor(predicate: () => unknown, timeoutMs = 3_000) {
  const deadline = performance.now() + timeoutMs;
  while (!predicate()) {
    if (performance.now() > deadline)
      throw new Error("history shell fixture timed out");
    await Bun.sleep(5);
  }
}
