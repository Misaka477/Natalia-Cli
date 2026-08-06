import { agentsFromConfig } from "@natalia/agent";
import {
  flowConditionDecompositionSchema,
  type ConfigV2,
  type FlowConditionDecomposition,
} from "@natalia/contracts";
import { providerForModel, type StreamingProvider } from "@natalia/runtime";

export type FlowConditionModel = {
  modelID: string;
  providerID: string;
  model: string;
};

export function flowConditionModels(config: ConfigV2): FlowConditionModel[] {
  return Object.entries(config.models)
    .filter(([modelID]) => Boolean(providerForModel(config, modelID)))
    .map(([modelID, model]) => ({
      modelID,
      providerID: model.provider,
      model: model.model,
    }));
}

export function defaultExecutionProviderID(config: ConfigV2) {
  const agent = agentsFromConfig(config).default();
  const modelID = agent?.model ?? config.defaultModel;
  return config.models[modelID]?.provider;
}

export function parseFlowConditionDecomposition(
  input: string,
): FlowConditionDecomposition {
  let value: unknown;
  try {
    value = JSON.parse(input);
  } catch {
    throw new Error("condition evaluator result must be valid schema JSON");
  }
  const parsed = flowConditionDecompositionSchema.safeParse(value);
  if (!parsed.success)
    throw new Error(
      `invalid condition evaluator result: ${parsed.error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join("; ")}`,
    );
  const normalized = parsed.data.conditions.map((condition) =>
    condition.text.replace(/\s+/gu, " ").trim(),
  );
  if (new Set(normalized).size !== normalized.length)
    throw new Error("condition evaluator result contains duplicate conditions");
  return {
    schemaVersion: 1,
    conditions: normalized.map((text) => ({ text })),
  };
}

export async function decomposeFlowConditions(input: {
  config?: ConfigV2;
  modelID: string;
  objective: string;
  provider?: StreamingProvider;
}): Promise<FlowConditionDecomposition> {
  const objective = input.objective.trim();
  if (!objective) throw new Error("a completion objective is required");
  const model = input.config?.models[input.modelID];
  const provider =
    input.provider ??
    (input.config ? providerForModel(input.config, input.modelID) : undefined);
  if (!provider) throw new Error("condition evaluator provider is unavailable");
  if (
    model &&
    (provider.model !== model.model ||
      provider.provider !== input.config?.providers[model.provider]?.type)
  )
    throw new Error("condition evaluator provider does not match the model");
  let content = "";
  for await (const chunk of provider.stream({
    messages: [
      {
        role: "system",
        content:
          'Split the user\'s completion objective into concise, independently auditable conditions. Return only JSON matching {"schemaVersion":1,"conditions":[{"text":"..."}]}. Do not call tools, add IDs, write Markdown, or add requirements not present in the objective.',
      },
      { role: "user", content: objective },
    ],
  })) {
    if (chunk.type === "content") content += chunk.text;
    if (chunk.type === "tool_call")
      throw new Error("condition evaluator emitted a forbidden tool call");
  }
  return parseFlowConditionDecomposition(content);
}
