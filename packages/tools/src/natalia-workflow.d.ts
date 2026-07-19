/**
 * Minimal type declarations for @natalia/workflow.
 * Used by workflow-tools.ts via dynamic import() to avoid
 * a circular tsconfig project reference.
 */
declare module "@natalia/workflow" {
  export type WorkflowEvent = {
    runID: string;
    type: string;
    at: string;
    stepID?: string;
    result?: string;
    error?: string;
  };

  export type WorkflowDocument = {
    version: number;
    name: string;
    description?: string;
    steps: unknown[];
  };

  export type WorkflowRun = {
    id: string;
    workflow: string;
    status: string;
    values: Record<string, string>;
    completedStepIDs: string[];
    events: WorkflowEvent[];
  };

  export class JsonlWorkflowStore {
    constructor(dir: string);
    append(event: WorkflowEvent): Promise<void>;
    events(runID: string): Promise<WorkflowEvent[]>;
  }

  export class WorkflowRuntime {
    constructor(tools: Map<string, unknown>, store: JsonlWorkflowStore);
    run(
      document: WorkflowDocument,
      context: { workspaceRoot: string; signal?: AbortSignal },
      runID?: string,
    ): Promise<WorkflowRun>;
  }

  export function parseWorkflowJSON(input: string): WorkflowDocument;
  export function parseWorkflowYAML(input: string): WorkflowDocument;
}
