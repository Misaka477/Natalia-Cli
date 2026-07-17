import { expect, test } from "bun:test";
import {
  splitMarkdownAtSafeBoundary,
  parseToolArguments,
  resultView,
} from "@natalia/ui-model";
import { reduceState, initialState } from "../src/context/state";

test("stream chunk boundaries preserve markdown fences lists and unicode", () => {
  const first = splitMarkdownAtSafeBoundary(
    "# 标题\n\n- item one\n```ts\nconst emoji = '🙂';\n",
  );
  expect(first.committed).toBe("# 标题\n\n- item one\n");
  expect(first.tail).toContain("```ts");

  const second = splitMarkdownAtSafeBoundary(
    first.tail + "const cjk = '你好';\n```\n\nfinal e\u0301\n",
  );
  expect(second.committed).toContain("const cjk");
  expect(second.tail).toBe("final e\u0301\n");
});

test("thinking and final streams remain separate with provider-safe hidden mode", () => {
  let state = structuredClone(initialState);
  state = reduceState(state, {
    type: "turn.submitted",
    id: "turn_a",
    text: "hello",
    byteLength: 5,
    lineCount: 1,
    sha256: "sha",
  });
  state = reduceState(state, {
    type: "thinking.delta",
    id: "turn_a",
    text: "private chain\n\n",
    visible: false,
  });
  state = reduceState(state, {
    type: "content.delta",
    id: "turn_a",
    text: "final answer\n\n",
  });

  const thinking = state.messages.find((item) => item.id === "turn_a:thinking");
  const final = state.messages.find((item) => item.id === "turn_a:assistant");
  expect(thinking?.text).toBe("Thinking details hidden by provider policy.");
  expect(thinking?.providerPolicy).toBe("hidden");
  expect(final?.text).toBe("final answer\n\n");
});

test("retry rollback drops transient tail without duplicate committed content", () => {
  let state = structuredClone(initialState);
  state = reduceState(state, {
    type: "turn.submitted",
    id: "turn_retry",
    text: "/retry",
    byteLength: 6,
    lineCount: 1,
    sha256: "sha",
  });
  state = reduceState(state, {
    type: "content.delta",
    id: "turn_retry",
    attempt: 1,
    text: "# Retry demo\n\npartial tail",
  });
  state = reduceState(state, {
    type: "turn.retry",
    id: "turn_retry",
    attempt: 2,
    maxAttempts: 3,
    reason: "timeout",
    retryAfterMs: 10,
  });
  state = reduceState(state, {
    type: "content.delta",
    id: "turn_retry",
    attempt: 2,
    text: "# Retry demo\n\npartial tail replaced\n",
  });
  state = reduceState(state, {
    type: "content.done",
    id: "turn_retry",
    attempt: 2,
  });

  const final = state.messages.find(
    (item) => item.id === "turn_retry:assistant",
  );
  const retryIndex = state.messages.findIndex(
    (item) => item.id === "turn_retry:retry:2",
  );
  const finalIndex = state.messages.findIndex(
    (item) => item.id === "turn_retry:assistant",
  );
  expect(final?.text).toBe("# Retry demo\n\npartial tail replaced\n");
  expect(retryIndex).toBeLessThan(finalIndex);
});

test("typed step retry shows live banner, clears after success, and drops failed attempt tail", () => {
  let state = structuredClone(initialState);
  state = reduceState(state, {
    type: "turn.submitted",
    id: "turn_step_retry",
    text: "/retry",
    byteLength: 6,
    lineCount: 1,
    sha256: "sha",
  });
  state = reduceState(state, {
    type: "content.delta",
    id: "turn_step_retry",
    attempt: 1,
    text: "failed transient tail",
  });
  state = reduceState(state, {
    type: "step.retry",
    id: "turn_step_retry",
    operation: "llm_step",
    step: 1,
    attempt: 2,
    maxAttempts: 3,
    waitMs: 1200,
    reason: "timeout",
    statusCode: 504,
  });
  expect(state.retryBanner).toContain("attempt 2/3");
  expect(state.retryBanner).toContain("504");
  expect(
    state.messages.find((item) => item.id === "turn_step_retry:retry:live")
      ?.text,
  ).toContain("waiting 1.2s");
  state = reduceState(state, {
    type: "content.delta",
    id: "turn_step_retry",
    attempt: 2,
    text: "clean final",
  });
  state = reduceState(state, {
    type: "content.done",
    id: "turn_step_retry",
    attempt: 2,
  });
  state = reduceState(state, {
    type: "step.retry.cleared",
    id: "turn_step_retry",
    operation: "llm_step",
    step: 1,
    attempts: 2,
  });
  expect(state.retryBanner).toBeUndefined();
  expect(
    state.messages.find((item) => item.id === "turn_step_retry:retry:live"),
  ).toBeUndefined();
  expect(
    state.messages.find((item) => item.id === "turn_step_retry:assistant")
      ?.text,
  ).toBe("clean final");
});

test("retry exhausted summary redacts provider detail", () => {
  let state = structuredClone(initialState);
  state = reduceState(state, {
    type: "step.retry.exhausted",
    id: "turn_exhausted",
    operation: "llm_step",
    step: 1,
    attempts: 3,
    maxAttempts: 3,
    reason: "rate_limit",
    statusCode: 429,
    message: "rate_limit (429)",
  });
  const text =
    state.messages.find((item) => item.id === "turn_exhausted:retry:exhausted")
      ?.text ?? "";
  expect(text).toContain("retry exhausted after 3/3");
  expect(text).not.toContain("sk-");
});

test("partial tool arguments are hidden until complete and sensitive keys redact", () => {
  expect(parseToolArguments('{"path":"a",').complete).toBe(false);
  const parsed = parseToolArguments(
    JSON.stringify({ path: "apps/tui", token: "secret", limit: 5 }),
  );
  expect(parsed.complete).toBe(true);
  expect(parsed.redactedJson).toContain("[REDACTED]");
  expect(parsed.keyArguments).toContain("path=apps/tui");

  let state = structuredClone(initialState);
  state = reduceState(state, {
    type: "tool.update",
    id: "turn_tool",
    name: "fake_tool",
    callID: "call_1",
    status: "receiving_arguments",
    summary: "receiving",
    argumentsDelta: '{"path":"apps/tui",',
  });
  expect(state.tools["turn_tool:tool:call_1"].argumentsComplete).toBe(false);
  state = reduceState(state, {
    type: "tool.update",
    id: "turn_tool",
    name: "fake_tool",
    callID: "call_1",
    status: "queued",
    summary: "queued",
    argumentsDelta: '"password":"secret"}',
  });
  expect(state.tools["turn_tool:tool:call_1"].argumentsComplete).toBe(true);
  expect(state.tools["turn_tool:tool:call_1"].redactedArguments).toContain(
    "[REDACTED]",
  );
});

test("tool result truncation keeps full detail separate from UI preview", () => {
  const result = resultView(
    Array.from({ length: 20 }, (_, i) => `line ${i}`).join("\n"),
    3,
    80,
  );
  expect(result.truncated).toBe(true);
  expect(result.preview).not.toContain("line 19");
  expect(result.detail).toContain("line 19");
});
