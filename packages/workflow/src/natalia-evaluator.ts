import {
  evaluatorResultSchema,
  type EvaluatorResult,
} from "@natalia/contracts";
import type { StreamingProvider } from "@natalia/runtime";
import { NataliaTaskStateStore } from "./natalia-task-state-store";

export type EvaluatorModuleContext = {
  flowID: string;
  moduleID: string;
  conditionIDs: string[];
  messages: string[];
  toolRecords: string[];
  terminalOutput: string[];
  executionRecords: string[];
  secureInput?: boolean;
};

export type RedactedEvaluatorModuleContext = Omit<
  EvaluatorModuleContext,
  "messages" | "toolRecords" | "terminalOutput" | "executionRecords"
> & {
  messages: string[];
  toolRecords: string[];
  terminalOutput: string[];
  executionRecords: string[];
  redacted: true;
};

export type EvaluatorSelection = {
  provider: string;
  model: string;
};

export type EvaluatorConsent = {
  provider: string;
  confirmedAt: string;
};

export type EvaluatorExecutionResult =
  | { outcome: "complete" | "incomplete"; result: EvaluatorResult }
  | { outcome: "blocked"; reason: string };

export function buildRedactedEvaluatorContext(
  context: EvaluatorModuleContext,
): RedactedEvaluatorModuleContext {
  if (context.secureInput)
    return {
      flowID: context.flowID,
      moduleID: context.moduleID,
      conditionIDs: [...context.conditionIDs],
      messages: ["[secure input omitted]"],
      toolRecords: ["[secure input omitted]"],
      terminalOutput: ["[secure input omitted]"],
      executionRecords: ["[secure input omitted]"],
      redacted: true,
    };
  return {
    flowID: context.flowID,
    moduleID: context.moduleID,
    conditionIDs: [...context.conditionIDs],
    messages: context.messages.map(redactEvaluatorText),
    toolRecords: context.toolRecords.map(redactEvaluatorText),
    terminalOutput: context.terminalOutput.map(redactEvaluatorText),
    executionRecords: context.executionRecords.map(redactEvaluatorText),
    redacted: true,
  };
}

export function parseEvaluatorResult(
  input: string,
  conditionIDs: string[],
): EvaluatorResult {
  let value: unknown;
  try {
    value = JSON.parse(input);
  } catch {
    throw new Error("evaluator result must be valid schema JSON");
  }
  const parsed = evaluatorResultSchema.safeParse(value);
  if (!parsed.success)
    throw new Error(
      `invalid evaluator result: ${parsed.error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join("; ")}`,
    );
  const ids = parsed.data.conditions.map((condition) => condition.id);
  if (
    ids.length !== conditionIDs.length ||
    new Set(ids).size !== ids.length ||
    conditionIDs.some((id) => !ids.includes(id))
  )
    throw new Error(
      "evaluator result must include each declared condition exactly once",
    );
  return parsed.data;
}

/**
 * Evaluator failures are a module block, never a fallback approval or task
 * success. The state transition requires a prior flow_module_complete claim.
 */
export async function evaluateAndRecordModule(input: {
  store: NataliaTaskStateStore;
  invocationID: string;
  attempt: number;
  executionProvider: string;
  selection: EvaluatorSelection;
  consent?: EvaluatorConsent;
  provider: StreamingProvider;
  context: EvaluatorModuleContext;
}): Promise<EvaluatorExecutionResult> {
  const redacted = buildRedactedEvaluatorContext(input.context);
  const block = (reason: string): EvaluatorExecutionResult => {
    input.store.evaluateModule({
      invocationID: input.invocationID,
      attempt: input.attempt,
      flowID: redacted.flowID,
      moduleID: redacted.moduleID,
      outcome: "blocked",
      data: { reason, evaluatorProvider: input.selection.provider },
    });
    return { outcome: "blocked", reason };
  };
  if (
    input.provider.provider !== input.selection.provider ||
    input.provider.model !== input.selection.model
  )
    return block("evaluator provider selection does not match the task");
  if (
    input.executionProvider !== input.selection.provider &&
    (!input.consent || input.consent.provider !== input.selection.provider)
  )
    return block(
      "cross-provider evaluator requires confirmed consent for the evaluator provider",
    );
  try {
    let content = "";
    for await (const chunk of input.provider.stream({
      messages: [
        {
          role: "system",
          content:
            "Return only one evaluator result JSON object matching schemaVersion 1. Do not call tools or write Markdown.",
        },
        { role: "user", content: JSON.stringify(redacted) },
      ],
    })) {
      if (chunk.type === "content") content += chunk.text;
      if (chunk.type === "tool_call")
        return block("evaluator emitted a forbidden tool call");
    }
    const result = parseEvaluatorResult(content, redacted.conditionIDs);
    input.store.evaluateModule({
      invocationID: input.invocationID,
      attempt: input.attempt,
      flowID: redacted.flowID,
      moduleID: redacted.moduleID,
      outcome: result.outcome,
      data: {
        evaluatorProvider: input.selection.provider,
        evaluatorModel: input.selection.model,
        result,
      },
    });
    return result.outcome === "blocked"
      ? { outcome: "blocked", reason: "evaluator marked the module blocked" }
      : { outcome: result.outcome, result };
  } catch (error) {
    return block(
      `evaluator unavailable or invalid: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function redactEvaluatorText(text: string): string {
  return text
    .replace(
      /(?:api[_-]?key|token|secret|password)\s*[:=]\s*[^\s"']+/giu,
      "$1=[redacted]",
    )
    .replace(/\b(?:sk|ghp|github_pat)_[A-Za-z0-9_-]+\b/gu, "[redacted]")
    .replace(
      /\b[A-Za-z0-9_-]{24,}\.[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{20,}\b/gu,
      "[redacted]",
    );
}
