import { expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { discoverLegacyProviderConfig } from "../src/legacy-provider";

test("discovers the active Go profile provider without exposing it in diagnostics", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-legacy-provider-"));
  const configPath = join(root, "config.yaml");
  try {
    await writeFile(
      configPath,
      [
        "default_profile: code",
        "providers:",
        "  gateway:",
        "    base_url: https://gateway.example/v1",
        "    api_key: legacy-secret-value",
        "profiles:",
        "  code:",
        "    provider: gateway",
        "    model: test-model",
      ].join("\n"),
      { mode: 0o600 },
    );
    const result = await discoverLegacyProviderConfig({ configPath });
    expect(result).toMatchObject({
      status: "found",
      config: {
        providerName: "gateway",
        baseURL: "https://gateway.example/v1",
        model: "test-model",
      },
    });
    if (result.status === "found")
      expect(result.config.apiKey).toBe("legacy-secret-value");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("discovers Go profiles and providers with spaces and Go YAML indentation", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-legacy-spaced-provider-"));
  const configPath = join(root, "config.yaml");
  try {
    await writeFile(
      configPath,
      [
        "default_profile: step ai",
        "providers:",
        "    step ai:",
        "        base_url: https://api.stepfun.example/v1/chat/completions",
        "        api_key: spaced-profile-secret",
        "profiles:",
        "    step ai:",
        "        provider: step ai",
        "        model: step-3.7-flash",
        "        temperature: 0.2",
        "        max_tokens: 4096",
        "        top_p: 0.9",
        "        reasoning_effort: high",
        "        thinking_enabled: true",
        "        timeout_sec: 90",
        "        max_steps: 25",
        "        work_dir: /tmp/step-workspace",
        "        auto_approve: ask",
      ].join("\n"),
      { mode: 0o600 },
    );
    const result = await discoverLegacyProviderConfig({ configPath });
    expect(result).toMatchObject({
      status: "found",
      config: {
        providerName: "step ai",
        model: "step-3.7-flash",
        baseURL: "https://api.stepfun.example/v1/chat/completions",
      },
    });
    if (result.status === "found")
      expect(result.config).toMatchObject({
        temperature: 0.2,
        maxTokens: 4096,
        topP: 0.9,
        reasoningEffort: "high",
        thinkingEnabled: true,
        timeoutSec: 90,
        maxSteps: 25,
        workDir: "/tmp/step-workspace",
        autoApprove: "ask",
      });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("reports invalid active legacy provider configuration without source content", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-legacy-invalid-"));
  const configPath = join(root, "config.yaml");
  try {
    await writeFile(
      configPath,
      "default_profile: missing\napi_key: leaked-value\n",
    );
    const result = await discoverLegacyProviderConfig({ configPath });
    expect(result).toMatchObject({ status: "invalid" });
    if (result.status === "invalid") {
      expect(result.message).not.toContain("leaked-value");
      expect(result.message).toContain("not usable");
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
