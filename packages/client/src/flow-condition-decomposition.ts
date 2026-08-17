import { agentsFromConfig } from "@natalia/agent";
import {
  buildModelCatalog,
  modelSelectionStatus,
  resolveEffectiveModel,
} from "@natalia/config";
import {
  flowConditionDecompositionSchema,
  modelRefKey,
  parseModelRef,
  type ConfigV3,
  type FlowConditionDecomposition,
} from "@natalia/contracts";
import { providerForModel, type StreamingProvider } from "@natalia/runtime";

export type FlowConditionModel = {
  modelID: string;
  providerID: string;
  model: string;
};

export function flowConditionModels(config: ConfigV3): FlowConditionModel[] {
  return buildModelCatalog(config)
    .flatMap((provider) =>
      provider.models
        .filter(
          (entry) =>
            modelSelectionStatus(
              config,
              modelRefKey({ provider: provider.id, model: entry.id }),
            ).selected,
        )
        .map((entry) => ({
          modelID: modelRefKey({ provider: provider.id, model: entry.id }),
          providerID: provider.id,
          model: entry.id,
        })),
    )
    .sort((left, right) => left.modelID.localeCompare(right.modelID));
}

export function defaultExecutionProviderID(config: ConfigV3) {
  const agent = agentsFromConfig(config).default();
  const candidate =
    agent?.model ??
    (config.defaultModel ? modelRefKey(config.defaultModel) : undefined);
  if (!candidate) return undefined;
  return resolveEffectiveModel(config, candidate)?.providerID;
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
  config?: ConfigV3;
  modelID: string;
  objective: string;
  provider?: StreamingProvider;
}): Promise<FlowConditionDecomposition> {
  const objective = input.objective.trim();
  if (!objective) throw new Error("a completion objective is required");
  const ref = parseModelRef(input.modelID);
  const effective = input.config
    ? resolveEffectiveModel(input.config, ref)
    : undefined;
  const provider =
    input.provider ??
    (input.config ? providerForModel(input.config, ref) : undefined);
  if (!provider) throw new Error("condition evaluator provider is unavailable");
  if (
    effective &&
    (provider.model !== effective.ref.model ||
      provider.provider !== effective.driver)
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
