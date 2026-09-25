/**
 * The deterministic pre-execution (the spec study's §2.2 with the
 * predictor REMOVED): after an edit lands, the project's verification
 * command (typecheck) runs in the background, so the model's next
 * "check it" call answers from a result that is already there. This is
 * not speculation — there is no coin to flip. Edit→verify is a rule, and
 * the rule's only real risk is STALENESS, which the state machine here
 * makes impossible by construction:
 *
 *   idle → running → fresh(result)
 *              ↘ stale        (any write invalidates, immediately)
 *
 * The disciplines (the study's three, minus the learning):
 *  1. nothing durable — the result lives in this process, and a restart
 *     begins idle (a killed mid-run check is a check nobody saw);
 *  2. read-only admission — the command is a read-only verification;
 *     anything with a side effect is not eligible (the caller passes the
 *     command, the state machine never invents one);
 *  3. measurable and off-able — one run at a time (deduped), the wasted
 *     work when a write lands mid-run is counted rather than hidden, and
 *     the caller can decline the whole thing by never calling it.
 *
 * A fresh result answers with the run's identity (the command, the exit
 * code, the when); a stale one answers nothing but that it is stale.
 */

export type PrecheckState =
  | { kind: "idle" }
  | { kind: "running"; startedAt: number; invalidations: number }
  | { kind: "fresh"; result: PrecheckResult; invalidations: number }
  | { kind: "stale"; invalidations: number };

export type PrecheckResult = {
  command: string;
  exitCode: number;
  /** A deterministic short digest of the output (never the body). */
  summary: string;
  finishedAt: number;
  durationMs: number;
};

export type PrecheckMachine = {
  /** The current state (a read; never throws). */
  state(): PrecheckState;
  /**
   * A write landed: any state becomes stale (a running check is counted
   * as invalidated — its result, when it lands, will be discarded).
   */
  noteWrite(): void;
  /** A run began (idle/stale only; a running check is NOT restarted —
   * one at a time is the discipline). Returns false when a run is
   * already in flight. */
  begin(now: number): boolean;
  /** The run finished: its result is fresh UNLESS a write landed while
   * it ran (then the result is discarded and the state stays stale). */
  complete(result: PrecheckResult, now: number): void;
};

export function createPrecheckMachine(): PrecheckMachine {
  let current: PrecheckState = { kind: "idle" };
  return {
    state: () => current,
    noteWrite() {
      current =
        current.kind === "running"
          ? {
              kind: "running",
              startedAt: current.startedAt,
              invalidations: current.invalidations + 1,
            }
          : {
              kind: "stale",
              invalidations:
                (current.kind === "idle" ? 0 : current.invalidations) + 1,
            };
    },
    begin(now) {
      if (current.kind === "running") return false;
      // The invalidations are PER-RUN (what landed during this run), so
      // a fresh run starts at zero — a stale's earlier invalidations must
      // not poison the next run's result.
      current = { kind: "running", startedAt: now, invalidations: 0 };
      return true;
    },
    complete(result, now) {
      if (current.kind !== "running") return;
      current =
        current.invalidations > 0
          ? { kind: "stale", invalidations: current.invalidations }
          : {
              kind: "fresh",
              result,
              invalidations: 0,
            };
      void now;
    },
  };
}

/** The answer a caller reads: the fresh result, or why there is none. */
export function readPrecheck(
  machine: PrecheckMachine,
):
  | { fresh: false; reason: "never_run" | "running" | "invalidated" }
  | { fresh: true; result: PrecheckResult } {
  const state = machine.state();
  switch (state.kind) {
    case "idle":
      return { fresh: false, reason: "never_run" };
    case "running":
      return { fresh: false, reason: "running" };
    case "fresh":
      return { fresh: true, result: state.result };
    case "stale":
      return { fresh: false, reason: "invalidated" };
  }
}

/**
 * The map from a verification's outcome to the state machine's result:
 * the command, the exit code, and a SHORT digest of the output (the
 * output's own head/tail lines — a summary a caller can reason about,
 * never an unbounded body). Pure.
 */
export function summarizeOutput(output: string, head = 8, tail = 4): string {
  const lines = output.split("\n").filter((line) => line.trim().length > 0);
  if (lines.length <= head + tail) return lines.join("\n");
  return [
    ...lines.slice(0, head),
    `… (${lines.length - head - tail} more lines)`,
    ...lines.slice(-tail),
  ].join("\n");
}
