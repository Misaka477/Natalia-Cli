import { appendFile, mkdir, readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { join, resolve } from "node:path";
import type {
  WorkflowDocument,
  WorkflowEvent,
  WorkflowRun,
  WorkflowStep,
} from "./types";
import { checkUniqueIDs } from "./parser";
import { evaluateCondition, walkValues } from "./eval";

export type WorkflowExecutionContext = {
  workspaceRoot: string;
  signal?: AbortSignal;
};

export type WorkflowToolRegistry = {
  get(name: string):
    | {
        execute(
          input: unknown,
          context: WorkflowExecutionContext,
        ): Promise<string>;
      }
    | undefined;
};

export type * from "./types";
export { parseWorkflowJSON, parseWorkflowYAML } from "./parser";
export { evaluateCondition, interpolate } from "./eval";

export class JsonlWorkflowStore {
  readonly dir: string;

  constructor(dir = ".natalia/workflow-runs") {
    this.dir = resolve(dir);
  }

  async append(event: WorkflowEvent) {
    await mkdir(this.dir, { recursive: true, mode: 0o700 });
    await appendFile(
      join(this.dir, `${event.runID}.jsonl`),
      `${JSON.stringify(event)}\n`,
      { mode: 0o600 },
    );
  }

  async events(runID: string) {
    try {
      return (await readFile(join(this.dir, `${runID}.jsonl`), "utf8"))
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line) as WorkflowEvent);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
  }
}

function rebuildValues(
  steps: WorkflowStep[],
  completedStepIDs: string[],
): Record<string, string> {
  const values: Record<string, string> = {};
  const walk = (s: WorkflowStep) => {
    if (s.kind === "set" && completedStepIDs.includes(s.id)) {
      values[s.key] = s.value;
      return;
    }
    if (s.kind === "branch") {
      if (!completedStepIDs.includes(s.id)) return;
      for (const b of s.branches) for (const ss of b.steps) walk(ss);
      return;
    }
    if (s.kind === "retry") {
      if (!completedStepIDs.includes(s.id)) return;
      walk(s.step);
      return;
    }
    if (s.kind === "timeout") {
      if (!completedStepIDs.includes(s.id)) return;
      walk(s.step);
      return;
    }
    if (s.kind === "parallel") {
      if (!completedStepIDs.includes(s.id)) return;
      for (const b of s.branches) for (const ss of b.steps) walk(ss);
      return;
    }
    if (s.kind === "each") {
      if (!completedStepIDs.includes(s.id)) return;
      for (const ss of s.steps) walk(ss);
      return;
    }
  };
  for (const s of steps) walk(s);
  return values;
}

export class WorkflowRuntime {
  constructor(
    private readonly tools: WorkflowToolRegistry,
    private readonly store: JsonlWorkflowStore,
    private readonly onEvent?: (event: WorkflowEvent, run: WorkflowRun) => void,
  ) {}

  async run(
    document: WorkflowDocument,
    context: WorkflowExecutionContext,
    runID = `wf_${Date.now().toString(36)}`,
  ) {
    checkUniqueIDs(document.steps);

    const prior = await this.store.events(runID);
    const completedStepIDs: string[] = prior
      .filter((event) => event.type === "step_completed" && event.stepID)
      .map((event) => event.stepID!);

    const run: WorkflowRun = {
      id: runID,
      workflow: document.name,
      status: "running",
      values: rebuildValues(document.steps, completedStepIDs),
      completedStepIDs,
      events: prior,
    };

    if (!prior.length)
      await this.record(run, {
        runID,
        type: "run_started",
        at: new Date().toISOString(),
      });

    await this.executeSteps(document.steps, run, context);

    if (run.status === "running") {
      run.status = "completed";
      await this.record(run, {
        runID,
        type: "run_completed",
        at: new Date().toISOString(),
      });
    }

    return run;
  }

  private async executeSteps(
    steps: WorkflowStep[],
    run: WorkflowRun,
    context: WorkflowExecutionContext,
  ): Promise<void> {
    if (context.signal?.aborted) {
      if (run.status === "running") {
        run.status = "cancelled";
        await this.record(run, {
          runID: run.id,
          type: "run_cancelled",
          at: new Date().toISOString(),
        });
      }
      return;
    }

    for (const step of steps) {
      if (run.completedStepIDs.includes(step.id)) continue;

      if (context.signal?.aborted) {
        run.status = "cancelled";
        await this.record(run, {
          runID: run.id,
          type: "run_cancelled",
          at: new Date().toISOString(),
          stepID: step.id,
        });
        return;
      }

      await this.record(run, {
        runID: run.id,
        type: "step_started",
        at: new Date().toISOString(),
        stepID: step.id,
      });

      try {
        await this.executeStep(step, run, context);
        run.completedStepIDs.push(step.id);
        await this.record(run, {
          runID: run.id,
          type: "step_completed",
          at: new Date().toISOString(),
          stepID: step.id,
          result: `completed ${step.kind}`,
        });
      } catch (error) {
        if (context.signal?.aborted) {
          run.status = "cancelled";
          await this.record(run, {
            runID: run.id,
            type: "run_cancelled",
            at: new Date().toISOString(),
            stepID: step.id,
          });
          return;
        }
        run.status = "failed";
        await this.record(run, {
          runID: run.id,
          type: "step_failed",
          at: new Date().toISOString(),
          stepID: step.id,
          error: error instanceof Error ? error.message : String(error),
        });
        return;
      }
    }
  }

  private async executeStep(
    step: WorkflowStep,
    run: WorkflowRun,
    context: WorkflowExecutionContext,
  ): Promise<string> {
    switch (step.kind) {
      case "set":
        run.values[step.key] = step.value;
        return step.value;

      case "wait":
        await Bun.sleep(step.ms);
        return `waited ${step.ms}ms`;

      case "script":
        return await this.executeScript(step, context);

      case "tool": {
        const tool = this.tools.get(step.tool);
        if (!tool) throw new Error(`workflow tool not found: ${step.tool}`);
        const args = walkValues(step.arguments, run.values);
        return await tool.execute(args, context);
      }

      case "branch":
        return await this.executeBranch(step, run, context);

      case "retry":
        return await this.executeRetry(step, run, context);

      case "timeout":
        return await this.executeTimeout(step, run, context);

      case "parallel":
        return await this.executeParallel(step, run, context);

      case "each":
        return await this.executeEach(step, run, context);

      default:
        throw new Error(`unknown step kind: ${(step as WorkflowStep).kind}`);
    }
  }

  private async executeBranch(
    step: {
      id: string;
      kind: "branch";
      branches: Array<{ condition?: string; steps: WorkflowStep[] }>;
    },
    run: WorkflowRun,
    context: WorkflowExecutionContext,
  ): Promise<string> {
    for (const branch of step.branches) {
      if (branch.condition === undefined) {
        await this.executeSteps(branch.steps, run, context);
        if (run.status !== "running")
          throw new Error(`branch "${step.id}" default failed`);
        return `branch ${step.id} default executed`;
      }

      const matched = evaluateCondition(branch.condition, run.values);
      if (matched) {
        await this.executeSteps(branch.steps, run, context);
        if (run.status !== "running")
          throw new Error(`branch "${step.id}" condition failed`);
        return `branch ${step.id} condition matched "${branch.condition}"`;
      }
    }

    return `branch ${step.id} no branch matched (no default)`;
  }

  private async executeScript(
    step: { id: string; kind: "script"; command: string; timeoutMs?: number },
    context: WorkflowExecutionContext,
  ) {
    return await new Promise<string>((resolvePromise, reject) => {
      const child = spawn(
        process.env.SHELL ?? "/usr/bin/bash",
        ["-lc", step.command],
        {
          cwd: context.workspaceRoot,
          stdio: ["ignore", "pipe", "pipe"],
          env: safeWorkflowEnv(process.env),
        },
      );
      const abort = () => child.kill("SIGTERM");
      context.signal?.addEventListener("abort", abort, { once: true });
      const timer = step.timeoutMs
        ? setTimeout(() => child.kill("SIGTERM"), step.timeoutMs)
        : undefined;
      let stdout = "";
      let stderr = "";
      child.stdout.on("data", (chunk) => (stdout += String(chunk)));
      child.stderr.on("data", (chunk) => (stderr += String(chunk)));
      child.on("error", reject);
      child.on("close", (exitCode) => {
        if (timer) clearTimeout(timer);
        context.signal?.removeEventListener("abort", abort);
        const output = [stdout, stderr]
          .filter(Boolean)
          .join("\n")
          .slice(0, 12000);
        if (exitCode !== 0)
          reject(new Error(`script ${step.id} failed: ${output}`));
        else resolvePromise(output || `script ${step.id} exited 0`);
      });
    });
  }

  private async executeRetry(
    step: {
      id: string;
      kind: "retry";
      maxAttempts: number;
      step: WorkflowStep;
    },
    run: WorkflowRun,
    context: WorkflowExecutionContext,
  ): Promise<string> {
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= step.maxAttempts; attempt++) {
      const attemptStepID = `${step.id}/attempt-${attempt}`;
      if (run.completedStepIDs.includes(attemptStepID)) {
        return `retry ${step.id} already completed on attempt ${attempt}`;
      }

      await this.record(run, {
        runID: run.id,
        type: "step_started",
        at: new Date().toISOString(),
        stepID: attemptStepID,
      });

      try {
        await this.executeStep(step.step, run, context);
        // Also persist inner step completion for value reconstruction on resume
        if (!run.completedStepIDs.includes(step.step.id)) {
          run.completedStepIDs.push(step.step.id);
          await this.record(run, {
            runID: run.id,
            type: "step_completed",
            at: new Date().toISOString(),
            stepID: step.step.id,
            result: `completed ${step.step.kind}`,
          });
        }
        run.completedStepIDs.push(attemptStepID);
        await this.record(run, {
          runID: run.id,
          type: "step_completed",
          at: new Date().toISOString(),
          stepID: attemptStepID,
          result: `retry attempt ${attempt} succeeded`,
        });
        return `retry ${step.id} succeeded on attempt ${attempt}`;
      } catch (error) {
        await this.record(run, {
          runID: run.id,
          type: "step_failed",
          at: new Date().toISOString(),
          stepID: attemptStepID,
          error: error instanceof Error ? error.message : String(error),
        });
        lastError = error instanceof Error ? error : new Error(String(error));
        if (attempt < step.maxAttempts) {
          const delay = Math.min(1000 * 2 ** (attempt - 1), 10000);
          await Bun.sleep(delay);
        }
      }
    }

    throw (
      lastError ??
      new Error(`retry ${step.id} exhausted ${step.maxAttempts} attempts`)
    );
  }

  private async executeTimeout(
    step: { id: string; kind: "timeout"; ms: number; step: WorkflowStep },
    run: WorkflowRun,
    context: WorkflowExecutionContext,
  ): Promise<string> {
    const result = await Promise.race([
      this.executeStep(step.step, run, context),
      new Promise<never>((_, reject) => {
        const timer = setTimeout(() => {
          reject(new Error(`timeout ${step.id} exceeded ${step.ms}ms`));
        }, step.ms);
        if (timer.unref) timer.unref();
      }),
    ]);
    if (!run.completedStepIDs.includes(step.step.id)) {
      run.completedStepIDs.push(step.step.id);
      await this.record(run, {
        runID: run.id,
        type: "step_completed",
        at: new Date().toISOString(),
        stepID: step.step.id,
        result: `completed ${step.step.kind}`,
      });
    }
    return result;
  }

  private async executeParallel(
    step: {
      id: string;
      kind: "parallel";
      branches: Array<{ id: string; steps: WorkflowStep[] }>;
    },
    run: WorkflowRun,
    context: WorkflowExecutionContext,
  ): Promise<string> {
    const results = await Promise.allSettled(
      step.branches.map(async (branch) => {
        const branchCompleted = branch.steps.every((s) =>
          run.completedStepIDs.includes(s.id),
        );
        if (branchCompleted) return `branch ${branch.id} already completed`;

        await this.executeSteps(branch.steps, run, context);
        return `branch ${branch.id} completed`;
      }),
    );

    const failures = results.filter((r) => r.status === "rejected");
    if (failures.length > 0) {
      const messages = failures
        .map(
          (f) =>
            (f as PromiseRejectedResult).reason?.message ??
            String((f as PromiseRejectedResult).reason),
        )
        .join("; ");
      throw new Error(
        `parallel ${step.id} had ${failures.length} failure(s): ${messages}`,
      );
    }

    return `parallel ${step.id} completed ${step.branches.length} branches`;
  }

  private async executeEach(
    step: {
      id: string;
      kind: "each";
      over: string;
      as: string;
      steps: WorkflowStep[];
    },
    run: WorkflowRun,
    context: WorkflowExecutionContext,
  ): Promise<string> {
    const overValue = run.values[step.over];
    if (overValue === undefined)
      throw new Error(`each "${step.id}": value "${step.over}" is not set`);

    let items: string[];
    try {
      const parsed = JSON.parse(overValue);
      if (Array.isArray(parsed)) {
        items = parsed.map(String);
      } else {
        items = overValue
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
      }
    } catch {
      items = overValue
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    }

    let iterIndex = 0;
    for (const item of items) {
      const iterStepID = `${step.id}/iter-${iterIndex}`;
      if (run.completedStepIDs.includes(iterStepID)) {
        iterIndex++;
        // Restore the iteration value from the completed step's result
        run.values[step.as] = item;
        continue;
      }

      run.values[step.as] = item;

      await this.record(run, {
        runID: run.id,
        type: "step_started",
        at: new Date().toISOString(),
        stepID: iterStepID,
      });

      await this.executeSteps(step.steps, run, context);
      if (run.status !== "running") {
        delete run.values[step.as];
        return `each "${step.id}" aborted at iteration ${iterIndex}`;
      }

      run.completedStepIDs.push(iterStepID);
      await this.record(run, {
        runID: run.id,
        type: "step_completed",
        at: new Date().toISOString(),
        stepID: iterStepID,
        result: `each iteration ${iterIndex}`,
      });
      iterIndex++;
    }

    delete run.values[step.as];
    return `each ${step.id} completed ${items.length} iterations`;
  }

  private async record(run: WorkflowRun, event: WorkflowEvent) {
    run.events.push(event);
    await this.store.append(event);
    this.onEvent?.(event, run);
  }
}

export function createWorkflowRuntime(
  tools: WorkflowToolRegistry,
  store: JsonlWorkflowStore,
  onEvent?: (event: WorkflowEvent, run: WorkflowRun) => void,
) {
  return new WorkflowRuntime(tools, store, onEvent);
}

function safeWorkflowEnv(env: NodeJS.ProcessEnv) {
  return safeExecutionEnv(env);
}

function safeExecutionEnv(env: NodeJS.ProcessEnv) {
  return Object.fromEntries(
    ["PATH", "HOME", "TMPDIR", "LANG", "LC_ALL", "TERM"]
      .map((key) => [key, env[key]] as const)
      .filter(
        (entry): entry is [string, string] => typeof entry[1] === "string",
      ),
  );
}
