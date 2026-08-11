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
  pendingOperations?: string[];
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
      pendingOperations: [...(context.pendingOperations ?? [])],
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
    pendingOperations: [...(context.pendingOperations ?? [])],
    redacted: true,
  };
}

export function parseEvaluatorResult(
  input: string,
  conditionIDs: string[],
): EvaluatorResult {
  let value: unknown;
  try {
    value = JSON.parse(extractEvaluatorJson(input));
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
 * Recovers a JSON object from free-form model output: fenced code blocks and
 * surrounding prose are stripped, and the first `{...}` span is used. This
 * only ever narrows the text handed to the schema, so a strictly correct
 * answer passes through unchanged.
 */
function extractEvaluatorJson(input: string): string {
  const text = input.trim();
  if (!text) return text;
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/u);
  const candidate = fenced?.[1] ?? text;
  const trimmed = candidate.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) return trimmed;
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) return trimmed.slice(start, end + 1);
  return trimmed;
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
  /** Durable config provider key used for cross-provider consent checks. */
  providerIdentity?: string;
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
      data: {
        reason,
        evaluatorProvider: input.providerIdentity ?? input.selection.provider,
      },
    });
    return { outcome: "blocked", reason };
  };
  if (
    input.provider.provider !== input.selection.provider ||
    input.provider.model !== input.selection.model
  )
    return block("evaluator provider selection does not match the task");
  if (
    input.executionProvider !==
      (input.providerIdentity ?? input.selection.provider) &&
    (!input.consent ||
      input.consent.provider !==
        (input.providerIdentity ?? input.selection.provider))
  )
    return block(
      "cross-provider evaluator requires confirmed consent for the evaluator provider",
    );
  if (redacted.pendingOperations?.length)
    return block(
      `platform completion floor found unresolved operations: ${redacted.pendingOperations.join("; ")}`,
    );
  let result: EvaluatorResult;
  try {
    let content = "";
    for await (const chunk of input.provider.stream({
      messages: [
        {
          role: "system",
          content:
            "You are the flow module completion evaluator. Evaluate only whether the module's declared completion conditions are satisfied by the given evidence. Return exactly one JSON object: no Markdown, no prose, no tool calls. The object must match this schema exactly (any extra key is rejected):\n" +
            JSON.stringify({
              schemaVersion: 1,
              outcome: "complete | incomplete | blocked",
              conditions: [
                {
                  id: "condition ID from the module context",
                  status: "missing | partial | satisfied",
                  reason: "short justification tied to the evidence",
                  evidenceRefs: [
                    "evidence refs from the module context; empty when none apply",
                  ],
                },
              ],
              gaps: [
                "what still prevents the conditions from being satisfied; empty when complete",
              ],
              forbiddenRepeats: [
                "actions that must not be repeated; empty when none",
              ],
              recommendedActions: [
                "concrete next steps; empty when the module is complete",
              ],
              idealOutcome: "missing | partial | satisfied",
            }) +
            "\nUse the exact condition IDs and evidence refs listed in the module context. Every declared condition must appear exactly once in conditions.",
        },
        { role: "user", content: JSON.stringify(redacted) },
      ],
    })) {
      if (chunk.type === "content") content += chunk.text;
      if (chunk.type === "tool_call")
        return block("evaluator emitted a forbidden tool call");
    }
    result = parseEvaluatorResult(content, redacted.conditionIDs);
    for (const condition of result.conditions)
      input.store.validateModuleEvidenceRefs({
        invocationID: input.invocationID,
        attempt: input.attempt,
        flowID: redacted.flowID,
        moduleID: redacted.moduleID,
        refs: condition.evidenceRefs,
      });
  } catch (error) {
    return block(
      `evaluator unavailable or invalid: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  try {
    input.store.evaluateModule({
      invocationID: input.invocationID,
      attempt: input.attempt,
      flowID: redacted.flowID,
      moduleID: redacted.moduleID,
      outcome: result.outcome,
      data: {
        evaluatorProvider: input.providerIdentity ?? input.selection.provider,
        evaluatorModel: input.selection.model,
        result,
      },
    });
  } catch (error) {
    // The evaluator answered, and the platform floor overruled it. Saying so
    // plainly matters: "evaluator invalid" would send an operator to look at
    // the wrong thing, when the stage simply never did what its type requires.
    return block(
      `platform completion floor rejected the evaluator outcome: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  return result.outcome === "blocked"
    ? { outcome: "blocked", reason: "evaluator marked the module blocked" }
    : { outcome: result.outcome, result };
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
