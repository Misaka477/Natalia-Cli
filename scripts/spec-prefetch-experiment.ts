import { $ } from "bun";
import {
  buildCurve,
  emptyStats,
  foldTurn,
  measureAcceptance,
  predictPrefetch,
} from "../packages/domains/engineering-intelligence/src/prefetch-predictor";

/**
 * The spec-exec pillar's prefetch EXPERIMENT (the study's §2.1, its
 * first predictor) on a REAL corpus: the repository's own commit
 * history — each commit is a "turn" whose reads are the files it
 * touched. The co-change graph is the co-read statistics the predictor
 * learns; the leave-one-out loop measures the per-position acceptance
 * curve (the study's discipline 4), and the verdict is what the three
 * iron laws make of it (a curve that justifies no depth switches the
 * predictor off).
 *
 * This is the evidence source the study names for every later upgrade
 * decision — not a demo: a run on this repository's history is a real
 * measurement, and a miss is a result (the study's own discipline 3:
 * a predictor without its numbers is not a predictor).
 *
 *   bun run scripts/spec-prefetch-experiment.ts [history-depth]
 */

const HISTORY_DEPTH = Number(process.argv[2] ?? "60");

const out =
  await $`git log --reverse --name-only --pretty=format:%h -n ${HISTORY_DEPTH}`
    .text()
    .catch(() => "");
if (!out.trim()) {
  console.log("no git history here — the experiment has no corpus");
  process.exit(0);
}

type Turn = { turnID: string; files: string[] };
/** The log's shape: a sha line, then that commit's files (name-only). */
export function parseCommitTurns(log: string): Turn[] {
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

const withFiles = parseCommitTurns(out).filter((turn) => turn.files.length > 0);
console.log(`corpus: ${withFiles.length} commits with files`);
const perCommit = withFiles.map((turn) => turn.files.length);
console.log(
  `files per commit: min ${Math.min(...perCommit)}, max ${Math.max(...perCommit)}, mean ${(perCommit.reduce((a, b) => a + b, 0) / perCommit.length).toFixed(1)}`,
);

let stats = emptyStats();
const measurements = [];
for (const [index, turn] of withFiles.entries()) {
  if (index > 0) {
    const predictions = predictPrefetch(stats, withFiles[index - 1]!.files, 3);
    measurements.push(measureAcceptance(turn.turnID, predictions, turn.files));
  }
  stats = foldTurn(stats, turn);
}
const curve = buildCurve(measurements);
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
