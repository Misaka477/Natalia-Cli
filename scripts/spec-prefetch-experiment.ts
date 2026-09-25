import { $ } from "bun";
import {
  buildCurve,
  emptyStats,
  foldTurn,
  measureAcceptance,
  predictPrefetch,
  readTurnReads,
} from "../packages/domains/engineering-intelligence/src/prefetch-predictor";
import { createLocalSessionService } from "../packages/framework/session-store/src/local-session-service";

/**
 * The spec-exec pillar's prefetch EXPERIMENT (the study's §2.1, its
 * first predictor) on TWO corpora:
 *
 *   1. the repository's own COMMIT history — each commit is a "turn"
 *      whose reads are the files it touched (the co-CHANGE proxy the
 *      first verdict was measured on);
 *   2. the workspace's real JOURNAL — every session's every turn, its
 *      reads read back through the same predictor seam
 *      (`readTurnReads` → the run-scorer's own turn segmentation →
 *      the streamed tool arguments). This is the study's 翻案条件②
 *      ("provider 接通、真实 turn 语料存在"): the OFF verdict had no
 *      direct evidence on real turns — the co-change proxy was the
 *      only corpus. Here the corpus is what real turns READ.
 *
 * Both modes run the SAME leave-one-out loop (predict BEFORE the
 * turn, measure against it) so the two verdicts compare directly.
 * The verdict is what the three iron laws make of the curve (the
 * study's discipline 3: a predictor without its numbers is not a
 * predictor; a curve that justifies no depth switches it off).
 *
 *   bun run scripts/spec-prefetch-experiment.ts [history-depth]
 *   bun run scripts/spec-prefetch-experiment.ts --journal [workspace]
 */

type Turn = { turnID: string; files: string[] };

/** Both corpora answer the same shape: the loop is shared verbatim. */
function runCurve(turns: Turn[]) {
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
  return buildCurve(measurements);
}

function reportCurve(curve: ReturnType<typeof buildCurve>) {
  console.log(
    "--- the per-position acceptance curve (the study's discipline 4) ---",
  );
  console.log(`rounds: ${curve.rounds}`);
  for (const position of curve.perPosition) {
    const bar = "#".repeat(Math.round(position.rate * 40));
    console.log(
      `position ${position.position}: ${position.hits}/${position.offered} = ${(position.rate * 100).toFixed(0)}% ${bar}`,
    );
  }
  console.log(`top-hit rate: ${(curve.topHitRate * 100).toFixed(0)}%`);
  console.log(`justified depth: ${curve.justifiedDepth}`);
  console.log(
    `verdict: ${curve.rounds === 0 ? "no_reads_to_measure" : curve.justifiedDepth === 0 ? "off — the curve justifies no depth" : `on — offer ${curve.justifiedDepth} file(s)`}`,
  );
}

if (process.argv.includes("--journal")) {
  /**
   * The real-turn corpus. Same corpus rule as the commit mode (a
   * corpus turn is one that touched files), same loop, same bench:
   * the co-change proxy's verdict and the real co-read verdict must
   * be readable side by side. Read-less turns are noise for BOTH
   * sides (the predictor cannot predict from an empty previous
   * turn) — they are dropped before the loop, as empty commits are.
   */
  const workspace = process.argv[process.argv.indexOf("--journal") + 1];
  const service = createLocalSessionService(workspace ?? process.cwd());
  const rows = (await service.list()).sort((left, right) =>
    left.createdAt === right.createdAt
      ? left.id.localeCompare(right.id)
      : left.createdAt.localeCompare(right.createdAt),
  );
  const turns: Turn[] = [];
  let sessions = 0;
  for (const row of rows) {
    const events = await service.events(row.id).catch(() => undefined);
    if (!events) continue;
    const reads = readTurnReads(events).filter((turn) => turn.files.length > 0);
    if (reads.length === 0) continue;
    sessions += 1;
    turns.push(...reads);
  }
  console.log(`corpus: ${turns.length} read-turns from ${sessions} sessions`);
  if (turns.length === 0) {
    console.log("no real turns with file reads — nothing to measure");
    process.exit(0);
  }
  const perTurn = turns.map((turn) => turn.files.length);
  console.log(
    `files per turn: min ${Math.min(...perTurn)}, max ${Math.max(...perTurn)}, mean ${(perTurn.reduce((a, b) => a + b, 0) / perTurn.length).toFixed(1)}`,
  );
  reportCurve(runCurve(turns));
} else {
  const HISTORY_DEPTH = Number(process.argv[2] ?? "60");
  const out =
    await $`git log --reverse --name-only --pretty=format:%h -n ${HISTORY_DEPTH}`
      .text()
      .catch(() => "");
  if (!out.trim()) {
    console.log("no git history here — the experiment has no corpus");
    process.exit(0);
  }
  /** The log's shape: a sha line, then that commit's files (name-only). */
  function parseCommitTurns(log: string): Turn[] {
    const turns: Turn[] = [];
    let current: Turn | undefined;
    for (const raw of log.split("\n")) {
      const line = raw.trim();
      if (!line) continue;
      if (/^[0-9a-f]{6,40}$/.test(line)) {
        current = { turnID: line, files: [] };
        turns.push(current);
        continue;
      }
      current?.files.push(line);
    }
    return turns;
  }

  const withFiles = parseCommitTurns(out).filter(
    (turn) => turn.files.length > 0,
  );
  console.log(`corpus: ${withFiles.length} commits with files`);
  const perCommit = withFiles.map((turn) => turn.files.length);
  console.log(
    `files per commit: min ${Math.min(...perCommit)}, max ${Math.max(...perCommit)}, mean ${(perCommit.reduce((a, b) => a + b, 0) / perCommit.length).toFixed(1)}`,
  );
  reportCurve(runCurve(withFiles));
}
