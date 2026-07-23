import { expect, test } from "bun:test";
import { statusRows } from "../src/dialog/DialogLayer";
import { initialState, reduceState } from "../src/context/state";

test("runtime status dialog renders only stable snapshot fields", () => {
  expect(
    statusRows({
      type: "status.snapshot",
      model: "local-model",
      provider: "local-provider",
      context: "42 tokens",
      step: "3",
      permissions: "ask",
      cwd: "/workspace",
      background: "0 running",
    }),
  ).toEqual([
    ["Model", "local-model"],
    ["Provider", "local-provider"],
    ["Context", "42 tokens"],
    ["Step", "3"],
    ["Permissions", "ask"],
    ["Workspace", "/workspace"],
    ["Background", "0 running"],
  ]);
});

test("runtime status background count reaches the TUI sidebar state", () => {
  const state = reduceState(structuredClone(initialState), {
    type: "status.snapshot",
    model: "local-model",
    provider: "local-provider",
    context: "42 tokens",
    step: "3",
    permissions: "auto",
    cwd: "/workspace",
    background: "4 running",
  });

  expect(state.statusSegments).toContain("bg:4 running");
  expect(state.statusSegments).toContain("auto");
});
