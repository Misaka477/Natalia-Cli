import type { GoalOperation, GoalSnapshot } from "@anthelia/contracts";

/**
 * Live goal projection: the durable snapshot plus facts derived from the
 * session log. `activation` is process-local: a projection folded from the log
 * (restart, resume, fork, replay) is always `disarmed`, so opening a session
 * never starts work by itself.
 */
export type GoalView = GoalSnapshot & {
  /** Highest admitted goal round. */
  roundsStarted: number;
  /** ISO timestamp of the create mutation. */
  createdAt: string;
  /** ISO timestamp of the latest mutation. */
  updatedAt: string;
  /** Process-local continuation eligibility; never persisted. */
  activation: "armed" | "disarmed";
};

/** Mutations accepted by the domain (the `clear` tombstone is its own event). */
export type GoalMutation = Exclude<GoalOperation, "clear">;

export type { GoalSnapshot };
