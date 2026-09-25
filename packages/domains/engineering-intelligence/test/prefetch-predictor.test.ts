import { expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { RuntimeEvent } from "@anthelia/contracts";
import {
  buildCurve,
  collectTurnReads,
  emptyStats,
  foldTurn,
  measureAcceptance,
  predictPrefetch,
  readTurnReads,
} from "../src/prefetch-predictor";

/**
 * The spec-exec pillar's first block — the online-statistics predictor
 * and its per-position acceptance curve. The experiment runs a journal
 * fixture through the leave-one-out loop (predict BEFORE the turn,
 * measure against it) and asserts the curve's honest shape.
 */

/** A read tool's call: streamed args + a terminal status. */
function readCall(
  callID: string,
  path: string,
  name = "read_file",
): RuntimeEvent {
  return {
    type: "tool.update",
    id: `u_${callID}`,
    name,
    callID,
    status: "succeeded",
    summary: "read",
    argumentsDelta: JSON.stringify({ path }),
  } as unknown as RuntimeEvent;
}

/** A turn: its start (the segmentation's own boundary) and its reads. */
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

/** The turns the fixture replays (a real visiting pattern). */
const JOURNAL: RuntimeEvent[] = [
  ...turn("t1", ["src/a.ts", "src/b.ts"]),
  ...turn("t2", ["src/a.ts", "src/c.ts"]),
  ...turn("t3", ["src/b.ts", "src/d.ts"]),
  ...turn("t4", ["src/a.ts", "src/b.ts"]),
];

test("the journal's reads are reconstructed per turn from the streamed arguments", () => {
  const turns = readTurnReads(JOURNAL);
  expect(turns.map((turn) => turn.turnID)).toEqual(["t1", "t2", "t3", "t4"]);
  expect(turns.map((turn) => turn.files)).toEqual([
    ["src/a.ts", "src/b.ts"],
    ["src/a.ts", "src/c.ts"],
    ["src/b.ts", "src/d.ts"],
    ["src/a.ts", "src/b.ts"],
  ]);
  // A partial stream is skipped, not invented.
  expect(
    readTurnReads([
      {
        type: "turn.started",
        id: "t0",
        at: new Date().toISOString(),
      } as unknown as RuntimeEvent,
      {
        type: "tool.update",
        id: "u_partial",
        name: "read_file",
        callID: "c_partial",
        status: "succeeded",
        summary: "read",
        argumentsDelta: '{"path": "src/x.t',
      } as unknown as RuntimeEvent,
    ]),
  ).toEqual([{ turnID: "t0", files: [] }]);
});

test("the whole read family counts (read_file, read_media_file, image_read)", () => {
  // The real journal's tool names — the first draft's aliases never
  // ride a tool.update, so against a real journal the predictor read
  // zero files. The family is the fs-read plugin's three readers.
  const turns = readTurnReads([
    {
      type: "turn.started",
      id: "t0",
      at: new Date().toISOString(),
    } as unknown as RuntimeEvent,
    readCall("c1", "src/a.ts", "read_file"),
    readCall("c2", "assets/logo.png", "read_media_file"),
    readCall("c3", "assets/shot.jpg", "image_read"),
    {
      type: "tool.update",
      id: "u_shell",
      name: "run_shell",
      callID: "c4",
      status: "succeeded",
      summary: "shell",
      argumentsDelta: JSON.stringify({ command: "ls" }),
    } as unknown as RuntimeEvent,
  ]);
  expect(turns).toEqual([
    { turnID: "t0", files: ["src/a.ts", "assets/logo.png", "assets/shot.jpg"] },
  ]);
});

test("the experiment's leave-one-out loop measures the per-position curve", () => {
  const turns = readTurnReads(JOURNAL);
  let stats = emptyStats();
  const measurements = [];
  for (const [index, turn] of turns.entries()) {
    if (index > 0) {
      // Predict from the stats BEFORE this turn, then measure against it.
      const predictions = predictPrefetch(stats, turns[index - 1]!.files, 3);
      measurements.push(
        measureAcceptance(turn.turnID, predictions, turn.files),
      );
    }
    stats = foldTurn(stats, turn);
  }
  const curve = buildCurve(measurements);
  expect(curve.rounds).toBe(3);
  expect(curve.topHitRate).toBeGreaterThan(0.5);
  expect(curve.justifiedDepth).toBeGreaterThanOrEqual(1);
  for (const position of curve.perPosition) {
    expect(position.offered).toBeGreaterThan(0);
    expect(position.rate).toBeGreaterThanOrEqual(0);
    expect(position.rate).toBeLessThanOrEqual(1);
  }
});

test("the predictor's prediction carries its basis and excludes the already-read", () => {
  let stats = emptyStats();
  for (const turn of readTurnReads(JOURNAL)) stats = foldTurn(stats, turn);
  const predictions = predictPrefetch(stats, ["src/a.ts"], 2);
  expect(predictions[0]!.file).toBe("src/b.ts");
  expect(predictions[0]!.basis).toEqual(["src/a.ts"]);
  expect(predictions.map((entry) => entry.position)).toEqual([1, 2]);
  const second = predictPrefetch(stats, ["src/b.ts"], 2);
  for (const prediction of second) expect(prediction.file).not.toBe("src/b.ts");
});

test("an empty journal answers no predictions and a zero curve", () => {
  const empty = emptyStats();
  expect(predictPrefetch(empty, ["src/a.ts"], 3)).toEqual([]);
  expect(buildCurve([])).toMatchObject({
    rounds: 0,
    justifiedDepth: 0,
    topHitRate: 0,
  });
});

test("the depth floor caps the justified depth at the first weak position", () => {
  // A fixture whose second position never hits (each turn reads one
  // predictable file plus one noise file): position 1 clears the floor,
  // position 2's rate is 0 — the justified depth stops at 1 even though
  // position 3 was offered. Without this fixture the floor is
  // unobservable (every position clears it).
  const turns = [
    turn("n1", ["src/core.ts", "src/noise1.ts"]),
    turn("n2", ["src/core.ts", "src/noise2.ts"]),
    turn("n3", ["src/core.ts", "src/noise3.ts"]),
  ];
  let stats = emptyStats();
  const measurements = [];
  for (const [index, turn] of readTurnReads(
    turns.flatMap((events) => events),
  ).entries()) {
    if (index > 0) {
      const predictions = predictPrefetch(stats, ["src/core.ts"], 3);
      measurements.push(
        measureAcceptance(turn.turnID, predictions, turn.files),
      );
    }
    stats = foldTurn(stats, turn);
  }
  const curve = buildCurve(measurements);
  expect(curve.rounds).toBe(2);
  // Position 1 always predicted something (core's co-reads) but was
  // never read; position 2 was offered and never hit either.
  expect(curve.perPosition.some((position) => position.rate === 0)).toBe(true);
  expect(curve.justifiedDepth).toBe(0);
});
