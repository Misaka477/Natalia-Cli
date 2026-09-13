import { expect, test } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createAttachmentService } from "@natalia/attachments";
import type { RuntimeEvent, SessionID } from "@natalia/contracts";
import type {
  ProviderStreamRequest,
  StreamingProvider,
} from "@natalia/runtime";
import { createSessionStoreController } from "@natalia/session-store";
import { createRealRuntimeClient } from "../src/runtime/main";

const provider: StreamingProvider = {
  provider: "goal-status-test",
  model: "goal-status-test-model",
  async *stream(_request: ProviderStreamRequest) {
    yield { type: "done" as const };
  },
};

/**
 * Regression: the fast startup path attaches to the runtime's already-selected
 * session without replaying the durable journal, so an existing goal never
 * reached the status bar. Attach must re-seed it from `recovery_goal` and emit
 * a live `goal.status`.
 */
test("same-id attach re-publishes an existing goal as a live goal.status", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-goal-status-"));
  const sessionID = "ses_goal_status" as SessionID;

  const seeder = createSessionStoreController({
    workspaceRoot: root,
    sessionID: () => sessionID,
    useSqliteStore: true,
    attachments: createAttachmentService(root),
  });
  await seeder.init();
  await seeder.create({ id: sessionID, title: "Goal status" });
  const record = (await seeder.load(sessionID)).session;
  const goalEvent: RuntimeEvent = {
    type: "goal.changed",
    id: "goal_evt_seed",
    operation: "create",
    snapshot: {
      goalID: "goal_seed",
      revision: 1,
      objective: "resume the plan",
      phase: "active",
      maxGoalRounds: 256,
    },
    roundsStarted: 0,
    at: "2026-01-01T00:00:00.000Z",
  };
  record.events.push(goalEvent);
  await seeder.appendEvent(record, goalEvent);
  await seeder.flush(sessionID);
  await seeder.close();

  const events: RuntimeEvent[] = [];
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID,
    useSqliteStore: true,
    provider,
  });
  try {
    client.start((event) => events.push(event));
    await client.sessionAttach?.(sessionID);
    const deadline = Date.now() + 2000;
    while (
      Date.now() < deadline &&
      !events.some((event) => event.type === "goal.status")
    )
      await Bun.sleep(20);

    const status = events.find((event) => event.type === "goal.status");
    expect(status).toMatchObject({
      type: "goal.status",
      goal: {
        goalID: "goal_seed",
        revision: 1,
        objective: "resume the plan",
        phase: "active",
        roundsStarted: 0,
      },
    });

    // Status-bar controls go through the real client surface, not the model.
    // Regression: `goalControl` was routed over RPC but never exposed on the
    // client surface, so every button click resolved to undefined.
    const waitForGoalEvent = async (
      predicate: (event: RuntimeEvent) => boolean,
    ) => {
      const waitUntil = Date.now() + 2000;
      while (Date.now() < waitUntil && !events.some(predicate))
        await Bun.sleep(20);
      return events.filter(predicate);
    };

    const edited = await client.goalEdit?.(
      { goalID: "goal_seed", revision: 1, objective: "edited objective" },
      sessionID,
    );
    expect(edited).toMatchObject({ ok: true, action: "edit" });
    const editEvents = await waitForGoalEvent(
      (event) => event.type === "goal.changed" && event.operation === "edit",
    );
    expect(editEvents).toHaveLength(1);
    expect(editEvents[0]).toMatchObject({
      type: "goal.changed",
      operation: "edit",
      snapshot: { objective: "edited objective", revision: 2 },
    });

    // Compare-and-set: a stale revision is refused, not applied.
    const stale = await client.goalEdit?.(
      { goalID: "goal_seed", revision: 1, objective: "stale objective" },
      sessionID,
    );
    expect(stale).toMatchObject({ ok: false, action: "edit" });

    const paused = await client.goalControl?.("pause", sessionID);
    expect(paused).toMatchObject({ ok: true, action: "pause" });
    expect(
      await waitForGoalEvent(
        (event) => event.type === "goal.changed" && event.operation === "pause",
      ),
    ).toHaveLength(1);

    const resumed = await client.goalControl?.("resume", sessionID);
    expect(resumed).toMatchObject({ ok: true, action: "resume" });
    expect(
      await waitForGoalEvent(
        (event) =>
          event.type === "goal.changed" && event.operation === "resume",
      ),
    ).toHaveLength(1);

    const cleared = await client.goalControl?.("clear", sessionID);
    expect(cleared).toMatchObject({ ok: true, action: "clear" });
    expect(
      await waitForGoalEvent(
        (event) => event.type === "goal.changed" && event.operation === "clear",
      ),
    ).toHaveLength(1);
  } finally {
    await client.dispose?.();
  }
});

/**
 * The status-bar toggle and inline editor must act on the *running* round:
 * `pause` hard-stops it (not just the next round), and `edit` steers it at the
 * next step while the durable edit makes the next round use the new objective.
 */
test("pause hard-stops the running goal round and edit steers it", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-goal-steer-"));
  const sessionID = "ses_goal_steer" as SessionID;

  const seeder = createSessionStoreController({
    workspaceRoot: root,
    sessionID: () => sessionID,
    useSqliteStore: true,
    attachments: createAttachmentService(root),
  });
  await seeder.init();
  await seeder.create({ id: sessionID, title: "Goal steer" });
  const record = (await seeder.load(sessionID)).session;
  const goalEvent: RuntimeEvent = {
    type: "goal.changed",
    id: "goal_evt_steer",
    operation: "create",
    snapshot: {
      goalID: "goal_steer",
      revision: 1,
      objective: "steady the boat",
      phase: "active",
      maxGoalRounds: 256,
    },
    roundsStarted: 0,
    at: new Date().toISOString(),
  };
  record.events.push(goalEvent);
  await seeder.appendEvent(record, goalEvent);
  await seeder.flush(sessionID);
  await seeder.close();

  // Provider call 0 blocks (round 1 step 1) so the round stays in flight while
  // the human edits/pauses; call 2 blocks (round 2 step 1) for the hard-stop.
  let calls = 0;
  const releases = new Map<number, () => void>();
  const provider: StreamingProvider = {
    provider: "goal-steer-test",
    model: "goal-steer-test-model",
    async *stream(request: ProviderStreamRequest) {
      const index = calls++;
      if (index === 0 || index === 2) {
        await new Promise<void>((resolve) => {
          releases.set(index, resolve);
          request.signal?.addEventListener("abort", () => resolve(), {
            once: true,
          });
        });
      }
      yield { type: "done" as const };
    },
  };

  const events: RuntimeEvent[] = [];
  const waitUntil = async (
    predicate: () => boolean,
    label: string,
    timeoutMs = 5000,
  ) => {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (predicate()) return;
      await Bun.sleep(20);
    }
    throw new Error(`timed out waiting for ${label}`);
  };

  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID,
    useSqliteStore: true,
    provider,
  });
  try {
    client.start((event) => events.push(event));
    await client.sessionAttach?.(sessionID);

    // Arm + drive a round: the seeded goal starts disarmed by design.
    await client.goalControl?.("pause", sessionID);
    await client.goalControl?.("resume", sessionID);
    await waitUntil(
      () =>
        events.some((event) => event.type === "goal.round" && event.round === 1),
      "goal round 1 admission",
    );
    await waitUntil(
      () =>
        events.some(
          (event) =>
            event.type === "turn.started" && event.id.includes("round_1"),
        ),
      "round 1 turn start",
    );

    // Edit while round 1 is in flight: durable edit + a next-step steering note.
    const goalRevision = events
      .filter(
        (event): event is Extract<RuntimeEvent, { type: "goal.changed" }> =>
          event.type === "goal.changed",
      )
      .at(-1)!.snapshot!.revision;
    const edited = await client.goalEdit?.(
      {
        goalID: "goal_steer",
        revision: goalRevision,
        objective: "steady the NEW boat",
      },
      sessionID,
    );
    expect(edited).toMatchObject({ ok: true, action: "edit" });
    expect(
      events.some(
        (event) => event.type === "goal.changed" && event.operation === "edit",
      ),
    ).toBe(true);

    releases.get(0)?.();
    await waitUntil(
      () =>
        events.some(
          (event) =>
            event.type === "turn.input" &&
            event.internal === true &&
            event.text.includes("goal edited by user"),
        ),
      "next-step steering note",
    );

    // The edit preserves continuation authority, so round 2 is driven and its
    // first provider call blocks. Pausing then hard-stops that in-flight round.
    await waitUntil(
      () =>
        events.some((event) => event.type === "goal.round" && event.round === 2),
      "goal round 2 admission",
    );
    await waitUntil(
      () =>
        events.some(
          (event) =>
            event.type === "turn.started" && event.id.includes("round_2"),
        ),
      "round 2 turn start",
    );
    const paused = await client.goalControl?.("pause", sessionID);
    expect(paused).toMatchObject({ ok: true, action: "pause" });
    await waitUntil(
      () =>
        events.some(
          (event) =>
            event.type === "turn.cancelled" && event.id.includes("round_2"),
        ),
      "round 2 hard-stop",
    );
    expect(
      events.some(
        (event) => event.type === "goal.changed" && event.operation === "pause",
      ),
    ).toBe(true);
  } finally {
    for (const release of releases.values()) release();
    await client.dispose?.();
  }
});
