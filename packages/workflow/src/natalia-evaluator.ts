import {
  evaluatorResultSchema,
  type EvaluatorResult,
} from "@natalia/contracts";

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
