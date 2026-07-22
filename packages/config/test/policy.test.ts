import { expect, test } from "bun:test";
import { modelSelectionStatus, evaluatePolicy } from "../src/policy";
import { configV2Schema } from "@natalia/contracts";

test("provider policy defaults to the caller fallback", () => {
  expect(evaluatePolicy([], "provider.use", "anthropic", "allow")).toBe(
    "allow",
  );
});

test("model selection distinguishes configured, usable, policy allowed and selected", () => {
  const config = configV2Schema.parse({
    version: 2,
    providers: { company: { type: "openai", apiKey: "local" } },
    models: {
      stable: { provider: "company", model: "company-stable" },
      experimental: { provider: "company", model: "company-experimental-fast" },
      disabled: {
        provider: "company",
        model: "company-disabled",
        enabled: false,
      },
    },
    experimental: {
      policies: [
        { effect: "deny", action: "provider.use", resource: "company/*" },
        {
          effect: "allow",
          action: "provider.use",
          resource: "company/company-stable",
        },
      ],
    },
  });
  expect(modelSelectionStatus(config, "stable")).toMatchObject({
    configured: true,
    usable: true,
    policyAllowed: true,
    selected: true,
  });
  expect(modelSelectionStatus(config, "experimental")).toMatchObject({
    usable: true,
    policyAllowed: false,
    reason: "provider_policy_denied",
  });
  expect(modelSelectionStatus(config, "disabled")).toMatchObject({
    usable: false,
    reason: "model_disabled",
  });
});

test("provider policy applies the last matching wildcard rule", () => {
  const rules = [
    { effect: "deny" as const, action: "provider.use", resource: "*" },
    { effect: "allow" as const, action: "provider.use", resource: "company-*" },
    {
      effect: "deny" as const,
      action: "provider.use",
      resource: "company-experimental-*",
    },
  ];
  expect(evaluatePolicy(rules, "provider.use", "company-stable", "allow")).toBe(
    "allow",
  );
  expect(
    evaluatePolicy(rules, "provider.use", "company-experimental-fast", "allow"),
  ).toBe("deny");
  expect(evaluatePolicy(rules, "provider.use", "openai", "allow")).toBe("deny");
});
