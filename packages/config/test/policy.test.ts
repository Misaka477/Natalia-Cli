import { expect, test } from "bun:test";
import { evaluatePolicy } from "../src/policy";

test("provider policy defaults to the caller fallback", () => {
  expect(evaluatePolicy([], "provider.use", "anthropic", "allow")).toBe("allow");
});

test("provider policy applies the last matching wildcard rule", () => {
  const rules = [
    { effect: "deny" as const, action: "provider.use", resource: "*" },
    { effect: "allow" as const, action: "provider.use", resource: "company-*" },
    { effect: "deny" as const, action: "provider.use", resource: "company-experimental-*" },
  ];
  expect(evaluatePolicy(rules, "provider.use", "company-stable", "allow")).toBe("allow");
  expect(evaluatePolicy(rules, "provider.use", "company-experimental-fast", "allow")).toBe("deny");
  expect(evaluatePolicy(rules, "provider.use", "openai", "allow")).toBe("deny");
});
