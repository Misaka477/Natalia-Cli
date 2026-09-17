/**
 * Plan task state machine — work-ledger/plan-task-state.ts (EI §4 Phase 4).
 *
 * The plan document's markdown checkboxes are the **declaration source** (the
 * human ticks a step as done); the runtime's recorded evidence is the **fact
 * source** (what was actually verified). The state machine projects the two
 * into one judge-able state per task, evidence-first:
 *
 *   checked + evidence  -> verified   (declared and backed)
 *   checked + no evidence -> gap      (declared done but nothing backs it)
 *   open + evidence     -> in_progress (work has started, not declared done)
 *   open + no evidence  -> pending
 *   skipped             -> skipped    (explicitly not-done, still visible)
 *
 * A checked box is never `verified` without evidence (EI §2 principle 1:
 * evidence-backed, never text similarity). `gap` and `skipped` stay visible so
 * a plan cannot quietly claim completion it has not earned.
 */

/** A checkbox's declared state in the plan Markdown. */
export type PlanTaskDeclaration = "open" | "done" | "skipped";

/** One parsed checkbox task. */
export type PlanTask = {
  /** Stable id: `task:<ordinal>` (ordinal is the checkbox's document order). */
  id: string;
  /** The task text (the checkbox label, annotations trimmed). */
  text: string;
  /** The declaration the human wrote in the plan. */
  declaration: PlanTaskDeclaration;
  /** Indentation depth (0 = top-level), for nested task lists. */
  depth: number;
};

/** The projected state of a task (declaration × evidence). */
export type PlanTaskState = "pending" | "in_progress" | "verified" | "gap" | "skipped";

// A markdown task list item: optional indent, a bullet or number, a checkbox
// marker, and the label. `x`/`X` = done, `-`/`~` = skipped, space = open.
const TASK_LINE = /^(\s*)(?:[-*+]|\d+[.)])\s+\[([ xX~\-])\]\s+(.+?)\s*$/u;
/**
 * Parses a plan document's markdown checkboxes into tasks (EI §4 Phase 4).
 * Non-task lines are ignored; nested tasks keep their depth so a consumer can
 * render the hierarchy. The ordinal is document order, giving each task a
 * stable id for the document's lifetime.
 */
export function parsePlanTasks(content: string): PlanTask[] {
  const tasks: PlanTask[] = [];
  const lines = content.replace(/\r\n?/gu, "\n").split("\n");
  for (const line of lines) {
    const match = line.match(TASK_LINE);
    if (!match) continue;
    const indent = match[1] ?? "";
    const marker = match[2] ?? " ";
    const text = (match[3] ?? "").trim();
    if (!text) continue;
    const depth = Math.floor(indent.replace(/\t/gu, "  ").length / 2);
    const declaration: PlanTaskDeclaration =
      marker === "x" || marker === "X"
        ? "done"
        : marker === "-" || marker === "~"
          ? "skipped"
          : "open";
    tasks.push({
      id: `task:${tasks.length + 1}`,
      text,
      declaration,
      depth,
    });
  }
  return tasks;
}

/**
 * Projects one task's state from its declaration and whether the runtime has
 * recorded evidence for it (EI §4 Phase 4, evidence-first). `hasEvidence` is
 * true when a completion/evidence fact references the task.
 */
export function evaluatePlanTaskState(input: {
  declaration: PlanTaskDeclaration;
  hasEvidence: boolean;
}): PlanTaskState {
  if (input.declaration === "skipped") return "skipped";
  if (input.declaration === "done") return input.hasEvidence ? "verified" : "gap";
  return input.hasEvidence ? "in_progress" : "pending";
}

/**
 * Projects a plan's tasks into states, matching each task against the runtime
 * evidence. A task has evidence when a recorded fact's `taskID` equals the
 * task id, or its objective / change paths reference the task text (the model
 * records evidence with a free-form taskID, so the text reference is the
 * fallback the plan's own wording provides). Returns the tasks with their
 * projected state, preserving document order.
 */
export function projectPlanTaskStates(
  tasks: PlanTask[],
  evidence: Array<{
    taskID?: string;
    objective?: string;
    changePaths?: string[];
  }>,
): Array<PlanTask & { state: PlanTaskState }> {
  const normalized = (value: string) => value.toLowerCase();
  return tasks.map((task) => {
    const hasEvidence = evidence.some((fact) => {
      if (fact.taskID && fact.taskID === task.id) return true;
      const needle = normalized(task.text);
      if (!needle) return false;
      if (fact.objective && normalized(fact.objective).includes(needle))
        return true;
      return (fact.changePaths ?? []).some((path) =>
        normalized(path).includes(needle),
      );
    });
    return {
      ...task,
      state: evaluatePlanTaskState({
        declaration: task.declaration,
        hasEvidence,
      }),
    };
  });
}
