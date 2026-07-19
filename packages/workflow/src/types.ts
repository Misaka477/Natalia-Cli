export type SetStep = {
  id: string;
  kind: "set";
  key: string;
  value: string;
};

export type ToolStep = {
  id: string;
  kind: "tool";
  tool: string;
  arguments: Record<string, unknown>;
};

export type WaitStep = {
  id: string;
  kind: "wait";
  ms: number;
};

export type ScriptStep = {
  id: string;
  kind: "script";
  command: string;
  timeoutMs?: number;
};

export type BranchCase = {
  condition?: string;
  steps: WorkflowStep[];
};

export type BranchStep = {
  id: string;
  kind: "branch";
  branches: BranchCase[];
};

export type RetryStep = {
  id: string;
  kind: "retry";
  maxAttempts: number;
  step: WorkflowStep;
};

export type TimeoutStep = {
  id: string;
  kind: "timeout";
  ms: number;
  step: WorkflowStep;
};

export type ParallelBranch = {
  id: string;
  steps: WorkflowStep[];
};

export type ParallelStep = {
  id: string;
  kind: "parallel";
  branches: ParallelBranch[];
};

export type EachStep = {
  id: string;
  kind: "each";
  over: string;
  as: string;
  steps: WorkflowStep[];
};

export type WorkflowStep =
  | SetStep
  | ToolStep
  | WaitStep
  | ScriptStep
  | BranchStep
  | RetryStep
  | TimeoutStep
  | ParallelStep
  | EachStep;

export type WorkflowDocument = {
  version: 1;
  name: string;
  description?: string;
  steps: WorkflowStep[];
};

export type WorkflowEventType =
  | "run_started"
  | "run_completed"
  | "run_cancelled"
  | "step_started"
  | "step_completed"
  | "step_failed";

export type WorkflowEvent = {
  runID: string;
  type: WorkflowEventType;
  at: string;
  stepID?: string;
  result?: string;
  error?: string;
};

export type WorkflowRunStatus =
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export type WorkflowRun = {
  id: string;
  workflow: string;
  status: WorkflowRunStatus;
  values: Record<string, string>;
  completedStepIDs: string[];
  events: WorkflowEvent[];
};

export type YamlError = {
  message: string;
  line: number;
  column: number;
};

export class YamlParseError extends Error {
  readonly errors: YamlError[];

  constructor(errors: YamlError[]) {
    super(
      errors
        .map((e) => `YAML error at line ${e.line}:${e.column}: ${e.message}`)
        .join("\n"),
    );
    this.name = "YamlParseError";
    this.errors = errors;
  }
}
