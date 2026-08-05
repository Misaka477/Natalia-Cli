import { expect, test } from "bun:test";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { modelSelectionStatus, evaluatePolicy } from "../src/policy";
import { configV2Schema } from "@natalia/contracts";
import { resolveConfig } from "../src/service";

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

test("a rejected configuration file reports why, not just that it failed", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-config-invalid-"));
  await mkdir(join(root, ".natalia"), { recursive: true });
  await writeFile(
    join(root, ".natalia", "config.json"),
    JSON.stringify({
      version: 2,
      permissionProfiles: {
        unattended: {
          approval: "auto",
          permissions: { files: { writePaths: ["docs/**"] } },
        },
      },
    }),
  );
  const resolved = await resolveConfig({
    workspaceRoot: root,
    globalPath: join(root, "absent-global.json"),
  });
  const project = resolved.sources.find(
    (source) => source.scope === "project",
  )!;
  expect(project.applied).toBe(false);
  // The operator has to be able to find the offending field: an ignored file
  // silently drops the profiles and command rules they thought were in effect.
  expect(project.diagnostic).toContain("invalid_config:");
  expect(project.diagnostic).toContain("writePaths");
  expect(resolved.config.permissionProfiles.unattended).toBeUndefined();
});
