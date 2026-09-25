import type { RuntimeEvent } from "@anthelia/contracts";
import { segmentTurns, type TurnWindow } from "./run-scorer";

/**
 * The spec-exec pillar's first block (the study's §2.1 speculative
 * prefetch), as an EXPERIMENT: an online-statistics predictor that
 * learns a workspace's file-visiting patterns from the journal and
 * predicts the next turn's reads, measured by a PER-POSITION ACCEPTANCE
 * CURVE (the study's discipline 4 — position-2+'s rate caps the depth).
 *
 * The three iron laws, each structural here:
 *  1. **no persistent state** — the stats live in this process only;
 *     nothing lands in a durable store. A kill forgets everything, which
 *     is the correct behaviour for a speculative heat source.
 *  2. **read-only admission** — the predictor's only input is the
 *     journal's COMPLETED reads (events that already exist); the
 *     prefetch's output (a cache warming) is read-only by construction.
 *  3. **measurable and off-able** — every prediction records its basis,
 *     and the curve is the verdict. A predictor whose curve never
 *     justifies its cost is switched off (its owner reads the curve).
 *
 * The statistics (the study's §2c default, zero training): a co-read
 * graph (which files share a turn), visit frequency, and a recency
 * decay (later turns weigh more). The prediction is the top-K by
 * score, excluding what the current turn already read.
 */

/** One turn's file reads, in the journal's own shape. */
export type TurnReads = {
  turnID: string;
  /** The files read (the tool arguments' `path`, deduped in order). */
  files: string[];
};

/** The read tools whose arguments carry a `path`. */
const READ_TOOLS = new Set(["workspaceRead", "read", "readFile", "fs"]);

/**
 * The journal's file reads per turn. The tool.update events carry NO
 * turn identity (the runtime-status's event shape) — the turn
 * membership comes from the journal's own segmentation (the
 * run-scorer's turn windows), which is the same segmentation every
 * other reader uses. Inside a window, a read's call arguments are
 * streamed as `argumentsDelta` fragments, so the path is reconstructed
 * by accumulating the deltas per call and parsing at the call's
 * terminal status. Unparseable fragments are skipped (a partial JSON is
 * not a path) — the statistics lose nothing but a malformed record.
 */
export function collectTurnReads(windows: readonly TurnWindow[]): TurnReads[] {
  const turns: TurnReads[] = [];
  for (const window of windows) {
    const deltas = new Map<string, string>();
    const files = new Set<string>();
    for (const event of window.events) {
      if (event.type !== "tool.update") continue;
      if (!READ_TOOLS.has(event.name)) continue;
      const callID = event.callID ?? event.id;
      if (event.argumentsDelta)
        deltas.set(callID, (deltas.get(callID) ?? "") + event.argumentsDelta);
      const terminal =
        event.status === "succeeded" || event.status === "failed";
      if (!terminal) continue;
      const args = deltas.get(callID);
      deltas.delete(callID);
      if (!args) continue;
      try {
        const parsed = JSON.parse(args) as { path?: unknown };
        if (typeof parsed.path === "string" && parsed.path)
          files.add(parsed.path);
      } catch {
        // A partial stream: the read happened, its path is not legible
        // from this record — skip it rather than invent one.
      }
    }
    turns.push({ turnID: window.turnID, files: [...files] });
  }
  return turns;
}

/** The events → turn windows → per-turn reads (one call for callers). */
export function readTurnReads(events: readonly RuntimeEvent[]): TurnReads[] {
  return collectTurnReads(segmentTurns(events));
}

/** The online statistics a workspace's reads have accumulated. */
export type PrefetchStats = {
  /** How often each file was read. */
  visits: Map<string, number>;
  /** The co-read graph: file → the files read in the same turn. */
  coReads: Map<string, Map<string, number>>;
  /** The turn index each file was last read in (for the recency weight). */
  lastTurn: Map<string, number>;
  /** How many turns the stats have folded. */
  turns: number;
};

export function emptyStats(): PrefetchStats {
  return {
    visits: new Map(),
    coReads: new Map(),
    lastTurn: new Map(),
    turns: 0,
  };
}

/** Fold one turn's reads into the stats (recency = the turn's index). */
export function foldTurn(stats: PrefetchStats, turn: TurnReads): PrefetchStats {
  stats.turns += 1;
  for (const file of turn.files) {
    stats.visits.set(file, (stats.visits.get(file) ?? 0) + 1);
    stats.lastTurn.set(file, stats.turns);
    const co = stats.coReads.get(file) ?? new Map<string, number>();
    for (const other of turn.files) {
      if (other === file) continue;
      co.set(other, (co.get(other) ?? 0) + 1);
    }
    stats.coReads.set(file, co);
  }
  return stats;
}

/** The recency decay: a file read long ago predicts less (half-life). */
const RECENCY_HALF_LIFE = 4;

/** One prediction: the file, its score, and the basis it came from. */
export type PrefetchPrediction = {
  position: number;
  file: string;
  score: number;
  /** The files the co-read graph would carry with it. */
  basis: string[];
};

/**
 * The prediction: the top-K files by (co-read strength with the
 * current turn's reads) × (recency weight), excluding the already-read.
 * The basis rides along — a prediction without its basis is an assertion
 * (the study's discipline 3: a predictor records why).
 */
export function predictPrefetch(
  stats: PrefetchStats,
  currentReads: readonly string[],
  k: number,
): PrefetchPrediction[] {
  const seen = new Set(currentReads);
  const candidates = new Map<string, { score: number; basis: string[] }>();
  for (const file of currentReads) {
    const co = stats.coReads.get(file);
    if (!co) continue;
    for (const [other, count] of co) {
      if (seen.has(other)) continue;
      const recency =
        Math.pow(
          0.5,
          (stats.turns - (stats.lastTurn.get(other) ?? 0)) / RECENCY_HALF_LIFE,
        ) || 1;
      const entry = candidates.get(other) ?? { score: 0, basis: [] };
      entry.score += count * recency;
      entry.basis.push(file);
      candidates.set(other, entry);
    }
  }
  const ranked = [...candidates.entries()]
    .map(([file, entry]) => ({ file, ...entry }))
    .sort((left, right) => right.score - left.score)
    .slice(0, Math.max(0, k));
  return ranked.map((entry, index) => ({
    position: index + 1,
    file: entry.file,
    score: entry.score,
    basis: entry.basis,
  }));
}

/** The curve's one measurement: the predictions and the actual reads. */
export type AcceptanceMeasurement = {
  turnID: string;
  /** The files the turn actually read. */
  actual: string[];
  /** Per position: was the prediction hit. */
  hits: boolean[];
  /** The position of the first hit (0 = none) — the curve's useful unit. */
  firstHitPosition: number;
};

/** Measure one round: predictions against the turn's actual reads. */
export function measureAcceptance(
  turnID: string,
  predictions: readonly PrefetchPrediction[],
  actual: readonly string[],
): AcceptanceMeasurement {
  const actualSet = new Set(actual);
  const hits = predictions.map((prediction) => actualSet.has(prediction.file));
  const first = hits.findIndex((hit) => hit);
  return {
    turnID,
    actual: [...actual],
    hits,
    firstHitPosition: first === -1 ? 0 : first + 1,
  };
}

/** The per-position acceptance curve across rounds. */
export type AcceptanceCurve = {
  rounds: number;
  /** Per position: how often a prediction at that position was hit. */
  perPosition: Array<{
    position: number;
    offered: number;
    hits: number;
    rate: number;
  }>;
  /** The depth the curve justifies (the last position with a useful rate). */
  justifiedDepth: number;
  /** The overall hit rate of the top prediction. */
  topHitRate: number;
};

/** The floor under which a position stops justifying its cost. */
const MIN_POSITION_RATE = 0.2;

export function buildCurve(
  measurements: readonly AcceptanceMeasurement[],
): AcceptanceCurve {
  const perPosition = new Map<number, { offered: number; hits: number }>();
  for (const measurement of measurements) {
    for (const [index, hit] of measurement.hits.entries()) {
      const position = index + 1;
      const entry = perPosition.get(position) ?? { offered: 0, hits: 0 };
      entry.offered += 1;
      if (hit) entry.hits += 1;
      perPosition.set(position, entry);
    }
  }
  const positions = [...perPosition.entries()]
    .sort((left, right) => left[0] - right[0])
    .map(([position, entry]) => ({
      position,
      offered: entry.offered,
      hits: entry.hits,
      rate: entry.offered ? entry.hits / entry.offered : 0,
    }));
  // The justified depth: the highest position whose rate clears the
  // floor, stopping at the first miss (the study's depth cap).
  let justifiedDepth = 0;
  for (const position of positions) {
    if (position.rate < MIN_POSITION_RATE) break;
    justifiedDepth = position.position;
  }
  const first = measurements.filter(
    (measurement) => measurement.hits[0] !== undefined,
  );
  const topHits = first.filter((measurement) => measurement.hits[0]).length;
  return {
    rounds: measurements.length,
    perPosition: positions,
    justifiedDepth,
    topHitRate: first.length ? topHits / first.length : 0,
  };
}
