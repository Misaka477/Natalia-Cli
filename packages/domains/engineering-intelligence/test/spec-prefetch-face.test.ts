import { expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { RuntimeEvent, SessionID } from "@anthelia/contracts";
import { sessionFactStateFromEvents } from "@anthelia/session";
import { createTestContext } from "@anthelia/runtime-services";
import type {
  RuntimeContext,
  SessionExecutionState,
} from "@anthelia/substrate";
import { sessionStoreController } from "@anthelia/session-store";
import { createIntelligenceSurface } from "../src/intelligence";

/**
 * The prefetch experiment's FACE: the journal replayed through the
 * predictor, answered as the per-position curve plus the verdict. The
 * three iron laws hold by construction: the stats live in this call
 * (nothing durable), the journal's completed reads are the only input,
 * and the verdict is what switches the predictor on or off.
 */

const dirs: string[] = [];
process.on("exit", () => {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
});

function readCall(callID: string, path: string): RuntimeEvent {
  return {
    type: "tool.update",
    id: `u_${callID}`,
    name: "read_file",
    callID,
    status: "succeeded",
    summary: "read",
    argumentsDelta: JSON.stringify({ path }),
  } as unknown as RuntimeEvent;
}

function turn(turnID: string, paths: string[]): RuntimeEvent[] {
  return [
    {
      type: "turn.started",
      id: turnID,
      at: new Date().toISOString(),
    } as unknown as RuntimeEvent,
    ...paths.map((path, index) => readCall(`${turnID}_${index}`, path)),
  ];
}

const JOURNAL: RuntimeEvent[] = [
  ...turn("t1", ["src/a.ts", "src/b.ts"]),
  ...turn("t2", ["src/a.ts", "src/c.ts"]),
  ...turn("t3", ["src/b.ts", "src/d.ts"]),
  ...turn("t4", ["src/a.ts", "src/b.ts"]),
];

function harness(events: RuntimeEvent[]) {
  const dir = mkdtempSync(join(tmpdir(), "prefetch-face-"));
  dirs.push(dir);
  const sessionID = "ses_prefetch" as SessionID;
  const exec = {
    session: { id: sessionID, events } as never,
    factStateComplete: false,
    factState: sessionFactStateFromEvents(events),
  } as unknown as SessionExecutionState;
  const ctx = {
    ports: {
      getReady: async () => undefined,
      getSessionID: () => sessionID,
      getExecutionBySession: () => new Map([[sessionID, exec]]) as never,
      getActiveExec: () => exec,
      ensureExecution: async (id: unknown) =>
        id === sessionID ? exec : undefined,
      getSessionPersistenceForSession: () => Promise.resolve(undefined),
      planDocRuntime: {
        planDocActive: async () => undefined,
        planDocRead: async () => ({ content: "" }),
      },
      publishForSession: () => undefined,
      nextCompletionSequence: () => 1,
    },
    state: {
      pluginStoreRoot: dir,
      serviceDirectory: createTestContext([
        sessionStoreController.mock({
          history: (_id: `ses_${string}`, fallback: RuntimeEvent[]) =>
            Promise.resolve({
              events: fallback.map((event, seq) => ({ seq, event })),
              hasMore: false,
            }),
          flush: () => Promise.resolve(),
        } as unknown as Parameters<typeof sessionStoreController.mock>[0]),
      ]),
    },
  } as unknown as RuntimeContext;
  return createIntelligenceSurface(ctx, {});
}

test("the face answers the curve with the verdict, and the empty session says so", async () => {
  const surface = harness(JOURNAL);
  const report = await surface.specPrefetchReport!(
    undefined,
    "ses_prefetch" as never,
  );
  expect(report.rounds).toBe(3);
  expect(report.perPosition.length).toBeGreaterThan(0);
  expect(report.verdict).toMatch(/^(on: offer \d+ file|off:)/u);

  const empty = await surface.specPrefetchReport!(
    undefined,
    "ses_nothing" as never,
  );
  expect(empty).toMatchObject({ rounds: 0, verdict: "no_session" });
});
