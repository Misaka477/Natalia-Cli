import type { ConfigV2, PolicyStatement } from "@natalia/contracts";

export type PolicyEffect = PolicyStatement["effect"];

export function evaluatePolicy(
  statements: readonly PolicyStatement[],
  action: string,
  resource: string,
  fallback: PolicyEffect,
): PolicyEffect {
  for (let index = statements.length - 1; index >= 0; index--) {
    const statement = statements[index]!;
    if (
      matches(action, statement.action) &&
      matches(resource, statement.resource)
    ) {
      return statement.effect;
    }
  }
  return fallback;
}

export type ModelSelectionStatus = {
  modelID: string;
  configured: boolean;
  usable: boolean;
  policyAllowed: boolean;
  selected: boolean;
  reason?: string;
};

export function modelSelectionStatus(
  config: ConfigV2,
  modelID: string,
): ModelSelectionStatus {
  const model = config.models[modelID];
  if (!model)
    return {
      modelID,
      configured: false,
      usable: false,
      policyAllowed: false,
      selected: false,
      reason: "model_not_configured",
    };
  const provider = config.providers[model.provider];
  if (!provider)
    return {
      modelID,
      configured: true,
      usable: false,
      policyAllowed: false,
      selected: false,
      reason: "provider_not_configured",
    };
  if (!model.enabled)
    return {
      modelID,
      configured: true,
      usable: false,
      policyAllowed: false,
      selected: false,
      reason: "model_disabled",
    };
  if (!provider.enabled)
    return {
      modelID,
      configured: true,
      usable: false,
      policyAllowed: false,
      selected: false,
      reason: "provider_disabled",
    };
  if (!provider.apiKey)
    return {
      modelID,
      configured: true,
      usable: false,
      policyAllowed: false,
      selected: false,
      reason: "provider_credentials_unavailable",
    };
  const policy = evaluateModelPolicy(
    config.experimental.policies,
    model.provider,
    model.model,
  );
  if (policy !== "allow")
    return {
      modelID,
      configured: true,
      usable: true,
      policyAllowed: false,
      selected: false,
      reason: "provider_policy_denied",
    };
  return {
    modelID,
    configured: true,
    usable: true,
    policyAllowed: true,
    selected: true,
  };
}

export function evaluateModelPolicy(
  statements: readonly PolicyStatement[],
  provider: string,
  model: string,
) {
  const providerPolicy = evaluatePolicy(
    statements,
    "provider.use",
    provider,
    "allow",
  );
  const modelRules = statements.filter(
    (statement) =>
      statement.action === "provider.use" && statement.resource.includes("/"),
  );
  return evaluatePolicy(
    modelRules,
    "provider.use",
    `${provider}/${model}`,
    providerPolicy,
  );
}

function matches(value: string, pattern: string) {
  const expression = pattern
    .split("*")
    .map((part) => part.replace(/[|\\{}()[\]^$+?.]/gu, "\\$&"))
    .join(".*");
  return new RegExp(`^${expression}$`, "u").test(value);
}
