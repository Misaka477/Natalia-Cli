/**
 * Same-session goal round driver.
 *
 * Turns an active, armed goal into sequential `<goal_round>` turns through a
 * small host interface (admission, idle/queue observation, flush, publish), so
 * it stays independent of the concrete agent loop — the same split dsh uses
 * between `goal`, `goal-round-driver` and `tool-goal`.
 *
 * This is what replaces "wake an auditor every turn to prod the model": the
 * driver itself continues the goal while work remains, and stops explicitly on
 * completion, cancellation, error, a provider budget stop or the round cap.
 */
import { buildGoalRound, type GoalRoundEvent } from "./builders";
import type { GoalBlockReason } from "@natalia/contracts";
import type { GoalService } from "./service";
import type { GoalView } from "./types";

/** Renders one retained goal-round instruction (dsh's `<goal_round>` block). */
export function renderGoalRoundPrompt(goal: GoalView, round: number): string {
  const cap =
    goal.maxGoalRounds === 0 ? "unlimited" : String(goal.maxGoalRounds);
  return (
    "<goal_round>\n" +
    `Objective: ${JSON.stringify(goal.objective)}\n` +
    `Round: ${round}/${cap}\n\n` +
    "Continue working toward the objective in this same session. Treat the current " +
    "workspace, tool results, and durable session state as authoritative; inspect them " +
    "instead of assuming earlier narration is still current. Make concrete progress and " +
    "verify the result. Before claiming completion, gather evidence that the whole " +
    "objective is achieved, read the current goal, and mark it complete. If work remains, " +
    "leave the goal active for the next round. If you must stop for a human decision, use " +
    "ask_user. Follow the goal-tool policy before reporting a blocked goal.\n" +
    "</goal_round>"
  );
}

export type GoalRoundStop = "done" | "error" | "cancelled" | "max-tokens";

/** Everything the driver needs from the runtime, injected for testability. */
export type GoalRoundHost = {
  /** Current goal view (folded snapshot + live activation). */
  current(sessionID: string): GoalView | undefined;
  /** No active turn, not paused, no queued drain. */
  isIdle(sessionID: string): boolean;
  /** A human (non-goal) input is queued, so automatic work must yield. */
  hasCompetingInput(sessionID: string): boolean;
  /** Durability checkpoint before reserving a round. */
  flush(sessionID: string): Promise<void>;
  /** Admits the goal round; false when admission was refused. */
  admit(
    sessionID: string,
    input: { id: string; text: string },
  ): Promise<boolean>;
  /** Persists and publishes a durable goal event. */
  publish(
    sessionID: string,
    event: GoalRoundEvent | import("./builders").GoalChangedEvent,
  ): void;
  now(): string;
  nextEventId(): string;
  /** Optional debug sink (`[goal-driver] ...`); runs only when provided. */
  log?(event: string, detail?: Record<string, unknown>): void;
};

type Reservation = {
  goalID: string;
  revision: number;
  round: number;
  messageID: string;
};

export class GoalRoundDriver {
  private readonly reservations = new Map<string, Reservation>();
  private readonly chains = new Map<string, Promise<void>>();

  constructor(
    private readonly service: GoalService,
    private readonly host: GoalRoundHost,
  ) {}

  /** True when this turn id belongs to a round this driver reserved. */
  isGoalRound(sessionID: string, turnID: string): boolean {
    return this.reservations.get(sessionID)?.messageID === turnID;
  }

  /** Coalesces triggers onto one per-session serialized drive. */
  async drive(sessionID: string): Promise<void> {
    const previous = this.chains.get(sessionID) ?? Promise.resolve();
    const run = previous
      .catch(() => undefined)
      .then(() => this.driveOnce(sessionID));
    this.chains.set(sessionID, run);
    try {
      await run;
    } finally {
      if (this.chains.get(sessionID) === run) this.chains.delete(sessionID);
    }
  }

  private trace(event: string, detail: Record<string, unknown> = {}): void {
    this.host.log?.(event, detail);
  }

  private async driveOnce(sessionID: string): Promise<void> {
    if (this.reservations.has(sessionID)) {
      this.trace("skip", { sessionID, reason: "round-already-reserved" });
      return;
    }
    const idle = this.host.isIdle(sessionID);
    const competing = this.host.hasCompetingInput(sessionID);
    if (!idle || competing) {
      this.trace("skip", {
        sessionID,
        reason: !idle ? "not-idle" : "human-input-pending",
      });
      return;
    }
    const goal = this.host.current(sessionID);
    if (!goal || goal.phase !== "active" || goal.activation !== "armed") {
      this.trace("skip", {
        sessionID,
        reason: goal
          ? `phase=${goal.phase} activation=${goal.activation}`
          : "no-goal",
      });
      return;
    }
    this.trace("drive", {
      sessionID,
      goalID: goal.goalID,
      revision: goal.revision,
      round: goal.roundsStarted + 1,
    });
    if (goal.maxGoalRounds !== 0 && goal.roundsStarted >= goal.maxGoalRounds) {
      this.stop(sessionID, goal, {
        code: "round-limit",
        message: `Goal reached its configured limit of ${goal.maxGoalRounds} rounds.`,
      });
      return;
    }
    const round = goal.roundsStarted + 1;
    const reservation: Reservation = {
      goalID: goal.goalID,
      revision: goal.revision,
      round,
      messageID: `goal_${goal.goalID}_round_${round}`,
    };
    this.reservations.set(sessionID, reservation);
    try {
      // Durability obligation before reserving work, then recheck everything
      // the await could have changed.
      await this.host.flush(sessionID);
    } catch {
      this.reservations.delete(sessionID);
      this.service.disarm(sessionID);
      this.trace("disarm", { sessionID, reason: "flush-failed" });
      return;
    }
    if (
      !this.host.isIdle(sessionID) ||
      this.host.hasCompetingInput(sessionID)
    ) {
      this.reservations.delete(sessionID);
      this.trace("reservation-dropped", { sessionID, reason: "stale-input" });
      return;
    }
    const latest = this.host.current(sessionID);
    if (
      !latest ||
      latest.goalID !== goal.goalID ||
      latest.revision !== goal.revision ||
      latest.phase !== "active" ||
      latest.activation !== "armed"
    ) {
      // A mutation, a human prompt or a disarm won the race: drop the
      // reservation without charging a round.
      this.reservations.delete(sessionID);
      this.trace("reservation-dropped", { sessionID, reason: "stale-goal" });
      return;
    }
    this.trace("admit", {
      sessionID,
      round,
      messageID: reservation.messageID,
    });
    let admitted = false;
    try {
      admitted = await this.host.admit(sessionID, {
        id: reservation.messageID,
        text: renderGoalRoundPrompt(latest, round),
      });
    } catch {
      admitted = false;
    }
    if (!admitted) {
      this.reservations.delete(sessionID);
      this.trace("admit-failed", { sessionID, round });
      this.stop(sessionID, latest, {
        code: "queue-failed",
        message: `Could not queue goal round ${round}.`,
      });
      return;
    }
    // The round is admitted: record it durably so replay counts it.
    this.trace("round-admitted", { sessionID, goalID: goal.goalID, round });
    this.host.publish(
      sessionID,
      buildGoalRound({
        id: this.host.nextEventId(),
        at: this.host.now(),
        goalID: goal.goalID,
        revision: goal.revision,
        round,
      }),
    );
  }

  /** Classifies a finished turn and stops continuation when appropriate. */
  settle(sessionID: string, turnID: string, stopReason: GoalRoundStop): void {
    const reservation = this.reservations.get(sessionID);
    const wasGoalRound = reservation?.messageID === turnID;
    if (wasGoalRound) this.reservations.delete(sessionID);
    const goal = this.host.current(sessionID);
    if (!goal) return;
    this.trace("settle", {
      sessionID,
      turnID,
      stopReason,
      goalRound: wasGoalRound,
    });
    if (!wasGoalRound) {
      // A broad cancellation of UNRELATED work must not let the goal
      // auto-restart: drop process-local continuation authority. The durable
      // phase is unchanged, so a human `/goal resume` re-arms it.
      if (stopReason === "cancelled") {
        // Pause (durable, visible) so the status bar shows the goal stopped,
        // and disarm so even a failed pause cannot restart it.
        this.stop(
          sessionID,
          goal,
          {
            code: "cancelled",
            message: "automatic continuation was cancelled",
          },
          true,
        );
      }
      return;
    }
    switch (stopReason) {
      case "cancelled":
        this.stop(
          sessionID,
          goal,
          { code: "cancelled", message: "the goal round was cancelled" },
          true,
        );
        return;
      case "error":
        this.stop(sessionID, goal, {
          code: "turn-error",
          message: "the goal round ended with an error",
        });
        return;
      case "max-tokens":
        this.stop(sessionID, goal, {
          code: "max-tokens",
          message: "the goal round exhausted its token budget",
        });
        return;
      default:
        // `done`: the next idle drive decides whether to continue.
        return;
    }
  }

  private stop(
    sessionID: string,
    goal: GoalView,
    reason: GoalBlockReason,
    pause = false,
  ): void {
    this.trace("stop", {
      sessionID,
      action: pause ? "pause" : "block",
      code: reason.code,
    });
    try {
      const result = pause
        ? this.service.pause(sessionID, goal, reason)
        : this.service.block(sessionID, goal, reason);
      this.host.publish(sessionID, result.event);
    } catch {
      // A refused/failed stop must never leave cancelled work able to restart.
      this.service.disarm(sessionID);
    }
  }
}
