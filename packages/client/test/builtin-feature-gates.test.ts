import { expect, test } from "bun:test";
import { computeBuiltinFeatureGates } from "../src/builtin-feature-gates";

function gates(config: any, hasCustomTools = false) {
  return computeBuiltinFeatureGates({
    config,
    hasCustomTools,
    extensionEnabled: () => true,
  });
}

test("a custom tool registry disables every built-in family", () => {
  const all = gates({ tools: { enabled: {} }, plugins: { enabled: {} } }, true);
  for (const [name, enabled] of Object.entries(all)) {
    // pdf is gated by the plugins extension flag, not by the tool registry.
    if (name === "pdfEnabled") continue;
    expect(enabled).toBe(false);
  }
});

test("an explicit tools.enabled=false gate disables the family regardless of plugins", () => {
  const result = gates({
    tools: { enabled: { ask: false } },
    plugins: { enabled: { "natalia-tool-ask": true } },
  });
  expect(result.askEnabled).toBe(false);
  // A family that is never explicitly disabled stays on by default.
  expect(result.todoEnabled).toBe(true);
});

test("an explicit plugins.enabled=false gate disables the family", () => {
  const result = gates({
    tools: { enabled: {} },
    plugins: { enabled: { "natalia-tool-todo": false } },
  });
  expect(result.todoEnabled).toBe(false);
  expect(result.askEnabled).toBe(true);
});

test("pdf is gated by the plugins extension flag", () => {
  const config: any = { plugins: { enabled: { "natalia-tool-pdf": true } } };
  expect(
    computeBuiltinFeatureGates({
      config,
      hasCustomTools: false,
      extensionEnabled: () => false,
    }).pdfEnabled,
  ).toBe(false);
});

test("gates default on when the config is absent", () => {
  const all = gates(undefined);
  for (const enabled of Object.values(all)) expect(enabled).toBe(true);
});
