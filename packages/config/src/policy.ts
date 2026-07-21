import type { PolicyStatement } from "@natalia/contracts";

export type PolicyEffect = PolicyStatement["effect"];

export function evaluatePolicy(
  statements: readonly PolicyStatement[],
  action: string,
  resource: string,
  fallback: PolicyEffect,
): PolicyEffect {
  for (let index = statements.length - 1; index >= 0; index--) {
    const statement = statements[index]!;
    if (matches(action, statement.action) && matches(resource, statement.resource)) {
      return statement.effect;
    }
  }
  return fallback;
}

function matches(value: string, pattern: string) {
  const expression = pattern
    .split("*")
    .map((part) => part.replace(/[|\\{}()[\]^$+?.]/gu, "\\$&"))
    .join(".*");
  return new RegExp(`^${expression}$`, "u").test(value);
}
