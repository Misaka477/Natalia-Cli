import { expect, test } from "bun:test";
import type { RuntimeEvent } from "@natalia/contracts";
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

test("provider-hidden reasoning is still hidden once the turn finishes", () => {
  // A finished turn settles its reasoning block: it commits the buffer, marks it
  // completed and lifts it above the answer. That pass used to also rewrite the
  // block with the stream's raw text and mark it visible, so reasoning the
  // provider forbade showing was printed the moment the turn ended — and the row
  // is copyable. Settling must not change who may read the text.
  const secret = "SECRET-CHAIN-OF-THOUGHT";
  let state = structuredClone(initialState);
  const events: RuntimeEvent[] = [
    {
      type: "turn.submitted",
      id: "turn_hidden_end",
      text: "hi",
      byteLength: 2,
      lineCount: 1,
      sha256: "sha",
    },
    {
      type: "thinking.delta",
      id: "turn_hidden_end",
      // No trailing blank line: a chunk that reaches no markdown boundary is the
      // common shape, and it is the one the leak survived in, because nothing was
      // written to the transcript for the settle pass to check the policy on.
      text: secret,
      visible: false,
    },
    {
      type: "thinking.delta",
      id: "turn_hidden_end",
      text: `${secret}-more`,
      visible: false,
    },
    { type: "content.delta", id: "turn_hidden_end", text: "the answer\n\n" },
    { type: "turn.finished", id: "turn_hidden_end", stopReason: "done" },
  ];
  for (const event of events) state = reduceState(state, event);

  const thinking = state.messages.find((item) => item.role === "thinking");
  expect(thinking?.text).toBe("Thinking details hidden by provider policy.");
  expect(thinking?.providerPolicy).toBe("hidden");
  // The streams are released at turn end, so by now the text must be gone from
  // every slice of the state, not merely absent from the rendered block.
  expect(JSON.stringify(state)).not.toContain(secret);
  // Visible output is untouched, and the reasoning row still settles above it.
  expect(state.messages.find((item) => item.role === "assistant")?.text).toBe(
    "the answer\n\n",
  );
  expect(thinking?.status).toBe("completed");
});

test("streaming tail is rendered once while markdown is incomplete", () => {
  let state = reduceState(structuredClone(initialState), {
    type: "content.delta",
    id: "turn_pending_once",
    text: "an incomplete streaming tail",
  });
  const block = state.messages.find(
    (item) => item.id === "turn_pending_once:assistant",
  );
  expect(block?.text).toBe("");
  expect(block?.pendingText).toBe("an incomplete streaming tail");
});

test("content.done hydrates a durable assistant settlement without live deltas", () => {
  let state = reduceState(initialState, {
    type: "turn.submitted",
    id: "turn_durable_page",
    text: "restored prompt",
    byteLength: 15,
    lineCount: 1,
    sha256: "fixture",
  });
  state = reduceState(state, {
    type: "content.done",
    id: "turn_durable_page",
    text: "restored durable response",
  });
  // The synthesized block must live in the same key family the streaming
  // deltas use, otherwise a later done cannot detect it and duplicates it.
  expect(state.messages).toContainEqual(
    expect.objectContaining({
      id: "turn_durable_page:assistant",
      role: "assistant",
      text: "restored durable response",
    }),
  );
});

test("a tool-first turn renders the final answer exactly once", () => {
  let state = reduceState(initialState, {
    type: "turn.submitted",
    id: "turn_tool_first",
    text: "call a tool then answer",
    byteLength: 22,
    lineCount: 1,
    sha256: "fixture",
  });
  // No assistant text before the tool: the stream must stay on segment 0 so
  // the content.done guard can match what the deltas committed.
  state = reduceState(state, {
    type: "tool.update",
    id: "call_1",
    turnID: "turn_tool_first",
    name: "read",
    status: "completed",
  } as never);
  state = reduceState(state, {
    type: "content.delta",
    id: "turn_tool_first",
    text: "the final answer",
  } as never);
  state = reduceState(state, {
    type: "content.done",
    id: "turn_tool_first",
    text: "the final answer",
  });
  const assistant = state.messages.filter(
    (block) => block.role === "assistant",
  );
  expect(assistant).toHaveLength(1);
  expect(assistant[0]?.text).toBe("the final answer");
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
  expect(text).toContain("Retry exhausted after 3/3");
  expect(text).not.toContain("sk-");
});

test("a final failure is not reported as spent retries", () => {
  let state = structuredClone(initialState);
  state = reduceState(state, {
    type: "step.retry.exhausted",
    id: "turn_quota",
    operation: "llm_step",
    step: 1,
    attempts: 1,
    maxAttempts: 3,
    reason: "quota",
    statusCode: 402,
    message: "quota (402)",
    retryable: false,
  });
  const text =
    state.messages.find((item) => item.id === "turn_quota:retry:exhausted")
      ?.text ?? "";
  // Stopping after one of three attempts is a final failure, not used-up
  // retries, and the reader is told what to do about it.
  expect(text).toContain("Not retryable after 1/3");
  expect(text).toContain("out of credit");
  expect(text).not.toContain("Retry exhausted");
});

test("Terminal events stay out of chat while Sandbox renders stable blocks", () => {
  let state = structuredClone(initialState);
  const target = {
    kind: "sandbox" as const,
    sandboxID: "box_m11",
    root: "/tmp/box",
    isolationLevel: "workspace" as const,
  };
  state = reduceState(state, {
    type: "terminal.update",
    id: "pty_1",
    command: "bash",
    cwd: "/tmp/box",
    status: "running",
    attached: true,
    rows: 24,
    cols: 80,
    prompt: "$",
    activity: "waiting",
    tail: "ready\n$",
    lastAction: "submit",
    target,
  });
  state = reduceState(state, {
    type: "sandbox.update",
    id: "box_m11",
    status: "changed",
    root: "/tmp/box",
    isolationLevel: "workspace",
    changedFiles: 2,
    runningResources: 1,
    target,
    resourcePolicy: "workspace isolation only",
  });
  state = reduceState(state, {
    type: "sandbox.diff",
    id: "box_m11",
    changes: [
      { kind: "rename", oldPath: "a.ts", path: "b.ts" },
      { kind: "mode", path: "script.sh", mode: "100755" },
    ],
  });
  state = reduceState(state, {
    type: "sandbox.audit",
    id: "box_m11",
    action: "skill-script",
    target,
    approvalRequired: true,
    checkpointPolicy: "sandbox_manifest",
    message: "sandbox is not container security",
  });
  expect(
    state.messages.find((item) => item.id === "terminal:pty_1"),
  ).toBeUndefined();
  expect(state.facts.terminals.pty_1?.tail).toBe("ready\n$");
  expect(
    state.messages.find((item) => item.id === "sandbox:box_m11")?.text,
  ).toContain("isolation=workspace");
  expect(
    state.messages.find((item) => item.id === "sandbox:box_m11:diff")?.text,
  ).toContain("a.ts -> b.ts");
  expect(
    state.messages.find((item) => item.id.includes("audit"))?.text,
  ).toContain("approval: required");
});

test("model-owned terminal persists approval wait and action timeline for fixed pane", () => {
  let state = structuredClone(initialState);
  const target = { kind: "host" as const, cwd: "/workspace" };
  state = reduceState(state, {
    type: "terminal.update",
    id: "pty_model",
    command: "bash",
    cwd: "/workspace",
    status: "awaiting_approval",
    attached: true,
    rows: 32,
    cols: 120,
    prompt: "$",
    activity: "waiting",
    tail: "Natalia model terminal\n$",
    target,
    ownership: "model",
    approvalID: "apr_pty_model_1",
  });
  state = reduceState(state, {
    type: "terminal.timeline",
    id: "pty_model",
    actor: "model",
    action: "submit",
    status: "awaiting_approval",
    summary: "package installation requires approval",
    at: "2026-07-17T12:00:00Z",
  });
  state = reduceState(state, {
    type: "terminal.approval",
    id: "pty_model",
    approvalID: "apr_pty_model_1",
    state: "awaiting",
    action: "submit",
    reason: "install requires approval",
    target,
  });
  expect(state.facts.terminals.pty_model?.ownership).toBe("model");
  expect(state.facts.terminals.pty_model?.approvalID).toBe("apr_pty_model_1");
  expect(state.facts.terminalTimeline.pty_model?.[0]?.status).toBe(
    "awaiting_approval",
  );
  expect(state.footer).toContain("awaiting");
  expect(
    state.messages.some((message) => message.id.startsWith("terminal:")),
  ).toBe(false);
});

test("terminal pane selects among unlimited sessions and closes active view after model exit", () => {
  let state = structuredClone(initialState);
  const target = { kind: "host" as const, cwd: "/workspace" };
  for (const id of ["pty_a", "pty_b"]) {
    state = reduceState(state, {
      type: "terminal.update",
      id,
      command: "bash",
      cwd: "/workspace",
      status: "waiting",
      attached: true,
      rows: 24,
      cols: 80,
      activity: "waiting",
      tail: "$",
      target,
      ownership: "model",
    });
  }
  expect(state.terminalPane.selectedID).toBe("pty_b");
  state = reduceState(state, { type: "terminal.pane.select", id: "pty_a" });
  expect(state.terminalPane.selectedID).toBe("pty_a");
  state = reduceState(state, { type: "terminal.pane.focus", focus: "chat" });
  expect(state.terminalPane.focus).toBe("chat");
  state = reduceState(state, {
    type: "terminal.pane.focus",
    focus: "terminal",
  });
  expect(state.terminalPane.focus).toBe("terminal");
  state = reduceState(state, {
    type: "terminal.update",
    id: "pty_a",
    command: "bash",
    cwd: "/workspace",
    status: "exited",
    attached: false,
    rows: 24,
    cols: 80,
    activity: "waiting",
    tail: "exit 0",
    lastAction: "exit",
    target,
    ownership: "model",
  });
  expect(state.terminalPane.selectedID).toBe("pty_b");
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

test("tool boundary flushes buffered thinking and content before tool projection", () => {
  let state = structuredClone(initialState);
  state = reduceState(state, {
    type: "thinking.delta",
    id: "turn_tool_order",
    text: "reasoning before tool",
  });
  state = reduceState(state, {
    type: "content.delta",
    id: "turn_tool_order",
    text: "assistant preface",
  });
  state = reduceState(state, {
    type: "tool.update",
    id: "turn_tool_order",
    name: "read_file",
    callID: "call_order",
    status: "queued",
    summary: "queued",
  });
  const thinking = state.messages.find(
    (item) => item.id === "turn_tool_order:thinking",
  );
  const content = state.messages.find(
    (item) => item.id === "turn_tool_order:assistant",
  );
  const toolIndex = state.messages.findIndex(
    (item) => item.id === "turn_tool_order:tool:call_order",
  );
  expect(thinking?.text).toBe("reasoning before tool");
  expect(content?.text).toBe("assistant preface");
  expect(state.messages.indexOf(thinking!)).toBeLessThan(toolIndex);
  expect(state.messages.indexOf(content!)).toBeLessThan(toolIndex);
});

test("provider text after a tool starts a new stream segment below that tool", () => {
  let state = structuredClone(initialState);
  state = reduceState(state, {
    type: "thinking.delta",
    id: "turn_post_tool",
    text: "first reasoning\n",
  });
  state = reduceState(state, {
    type: "tool.update",
    id: "turn_post_tool",
    name: "read_file",
    callID: "call_post_tool",
    status: "succeeded",
    summary: "done",
    result: "file content",
  });
  state = reduceState(state, {
    type: "thinking.delta",
    id: "turn_post_tool",
    text: "next reasoning\n",
  });
  state = reduceState(state, { type: "thinking.done", id: "turn_post_tool" });
  const first = state.messages.find(
    (item) => item.id === "turn_post_tool:thinking",
  );
  const second = state.messages.find(
    (item) => item.id === "turn_post_tool:thinking:segment:1",
  );
  const toolIndex = state.messages.findIndex(
    (item) => item.id === "turn_post_tool:tool:call_post_tool",
  );
  expect(first?.text).toBe("first reasoning\n");
  expect(second?.text).toBe("next reasoning\n");
  expect(state.messages.indexOf(second!)).toBeGreaterThan(toolIndex);
});

test("runtime tool ids still advance post-tool stream segments", () => {
  let state = structuredClone(initialState);
  state = reduceState(state, {
    type: "thinking.delta",
    id: "turn_runtime_tool",
    text: "before terminal tool\n",
  });
  state = reduceState(state, {
    type: "tool.update",
    id: "turn_runtime_tool:terminal_observe_1",
    name: "terminal_observe",
    callID: "terminal_observe_1",
    status: "succeeded",
    summary: "terminal observed",
    result: "observe complete",
  });
  state = reduceState(state, {
    type: "thinking.delta",
    id: "turn_runtime_tool",
    text: "after terminal tool\n",
  });
  state = reduceState(state, {
    type: "thinking.done",
    id: "turn_runtime_tool",
  });

  const first = state.messages.find(
    (item) => item.id === "turn_runtime_tool:thinking",
  );
  const toolIndex = state.messages.findIndex(
    (item) => item.id === "turn_runtime_tool:tool:terminal_observe_1",
  );
  const second = state.messages.find(
    (item) => item.id === "turn_runtime_tool:thinking:segment:1",
  );

  expect(first?.text).toBe("before terminal tool\n");
  expect(toolIndex).toBeGreaterThan(-1);
  expect(second?.text).toBe("after terminal tool\n");
  expect(state.messages.indexOf(second!)).toBeGreaterThan(toolIndex);
});

test("visible reasoning renders in arrival order before its tool boundary", () => {
  let state = structuredClone(initialState);
  state = reduceState(state, {
    type: "turn.submitted",
    id: "turn_atomic_reasoning",
    text: "run a tool",
    byteLength: 10,
    lineCount: 1,
    sha256: "test",
  });
  state = reduceState(state, {
    type: "thinking.delta",
    id: "turn_atomic_reasoning",
    text: "reasoning before tool",
    visible: true,
  });
  expect(
    state.messages.find((item) => item.id === "turn_atomic_reasoning:thinking")
      ?.pendingText,
  ).toBe("reasoning before tool");
  state = reduceState(state, {
    type: "tool.update",
    id: "turn_atomic_reasoning",
    name: "read_file",
    callID: "call_atomic_reasoning",
    status: "queued",
    summary: "queued",
  });
  const thinkingIndex = state.messages.findIndex(
    (item) => item.id === "turn_atomic_reasoning:thinking",
  );
  const toolIndex = state.messages.findIndex(
    (item) => item.id === "turn_atomic_reasoning:tool:call_atomic_reasoning",
  );
  expect(state.messages[thinkingIndex]?.text).toBe("reasoning before tool");
  expect(thinkingIndex).toBeLessThan(toolIndex);
});

test("alternating model output and tools keep their original event order", () => {
  let state = structuredClone(initialState);
  const turnID = "turn_strict_order";
  state = reduceState(state, {
    type: "thinking.delta",
    id: turnID,
    text: "first thought",
  });
  state = reduceState(state, {
    type: "tool.update",
    id: turnID,
    name: "read_file",
    callID: "read_1",
    status: "succeeded",
    summary: "done",
  });
  state = reduceState(state, {
    type: "content.delta",
    id: turnID,
    text: "first answer",
  });
  state = reduceState(state, {
    type: "thinking.delta",
    id: turnID,
    text: "second thought",
  });
  state = reduceState(state, {
    type: "content.delta",
    id: turnID,
    text: "final answer",
  });
  state = reduceState(state, { type: "content.done", id: turnID });

  expect(state.messages.map((item) => [item.role, item.text])).toEqual([
    ["thinking", "first thought"],
    ["tool", expect.any(String)],
    ["assistant", "first answer"],
    ["thinking", "second thought"],
    ["assistant", "final answer"],
  ]);
});

test("deferred reasoning remains above the final assistant response", () => {
  let state = reduceState(structuredClone(initialState), {
    type: "turn.submitted",
    id: "turn_final_reasoning_order",
    text: "answer directly",
    byteLength: 15,
    lineCount: 1,
    sha256: "test",
  });
  state = reduceState(state, {
    type: "thinking.delta",
    id: "turn_final_reasoning_order",
    text: "reasoning before the answer",
    visible: true,
  });
  state = reduceState(state, {
    type: "content.delta",
    id: "turn_final_reasoning_order",
    text: "final answer",
  });
  state = reduceState(state, {
    type: "turn.finished",
    id: "turn_final_reasoning_order",
    stopReason: "done",
  });
  const thinkingIndex = state.messages.findIndex(
    (item) => item.id === "turn_final_reasoning_order:thinking",
  );
  const assistantIndex = state.messages.findIndex(
    (item) => item.id === "turn_final_reasoning_order:assistant",
  );
  expect(state.messages[thinkingIndex]?.text).toBe(
    "reasoning before the answer",
  );
  expect(state.messages[assistantIndex]?.text).toBe("final answer");
  expect(thinkingIndex).toBeLessThan(assistantIndex);
});

test("typed subagent updates remain available outside transcript text", () => {
  const state = reduceState(structuredClone(initialState), {
    type: "subagent.update",
    id: "agent_a",
    status: "running",
    attached: true,
    event: "status",
    task: "Audit stream ownership",
    text: "Inspecting the local adapter",
  });
  expect(state.facts.subagents.agent_a).toMatchObject({
    status: "running",
    attached: true,
    task: "Audit stream ownership",
  });
});

test("todo tool arguments project into shared sidebar state", () => {
  const state = reduceState(structuredClone(initialState), {
    type: "tool.update",
    id: "turn_todo",
    name: "todo_write",
    callID: "todo_a",
    status: "succeeded",
    summary: "saved",
    argumentsDelta: JSON.stringify({
      items: [
        { content: "Patch ownership", status: "in_progress" },
        { content: "Run smoke", status: "pending" },
      ],
    }),
    result: "saved 2 todo items",
  });
  expect(state.todos).toEqual([
    { content: "Patch ownership", status: "in_progress" },
    { content: "Run smoke", status: "pending" },
  ]);
});

test("turn finished returns the TUI to idle so Ctrl+C can exit demos", () => {
  let state = reduceState(structuredClone(initialState), {
    type: "turn.submitted",
    id: "turn_demo",
    text: "demo",
    byteLength: 4,
    lineCount: 1,
    sha256: "sha",
  });
  expect(state.activeTurn).toBe("turn_demo");
  state = reduceState(state, {
    type: "turn.finished",
    id: "turn_demo",
    stopReason: "done",
  });
  expect(state.activeTurn).toBeUndefined();
  expect(state.footer).toBe("本轮任务已完成");
  expect(state.messages.some((item) => item.id === "turn_demo:finished")).toBe(
    false,
  );
  expect(Object.keys(state.streams)).toHaveLength(0);
});

test("turn settlement releases all transient streaming buffers", () => {
  let state = reduceState(initialState, {
    type: "turn.submitted",
    id: "turn_release",
    text: "release buffers",
    byteLength: 15,
    lineCount: 1,
    sha256: "fixture",
  });
  state = reduceState(state, {
    type: "thinking.delta",
    id: "turn_release",
    text: "reasoning tail without a final boundary",
  });
  state = reduceState(state, {
    type: "content.delta",
    id: "turn_release",
    text: "assistant tail without a final boundary",
  });
  expect(Object.keys(state.streams)).toHaveLength(2);
  state = reduceState(state, {
    type: "turn.finished",
    id: "turn_release",
    stopReason: "done",
  });
  expect(state.activeTurn).toBeUndefined();
  expect(state.streams).toEqual({});
  expect(state.messages).toContainEqual(
    expect.objectContaining({ id: "turn_release:assistant" }),
  );
});

test("failed turns show an explicit terminal message", () => {
  let state = reduceState(structuredClone(initialState), {
    type: "turn.submitted",
    id: "turn_failed",
    text: "run tools",
    byteLength: 9,
    lineCount: 1,
    sha256: "sha",
  });
  state = reduceState(state, {
    type: "turn.finished",
    id: "turn_failed",
    stopReason: "error",
  });
  expect(state.activeTurn).toBeUndefined();
  expect(state.footer).toBe("本轮任务执行失败");
  expect(state.messages.at(-1)).toMatchObject({
    role: "system",
    text: "本轮任务执行失败，请查看上方错误信息。",
    status: "failed",
  });
});

test("missing final model responses remain completed with a system notice", () => {
  let state = reduceState(structuredClone(initialState), {
    type: "turn.submitted",
    id: "turn_missing_final",
    text: "run tools",
    byteLength: 9,
    lineCount: 1,
    sha256: "sha",
  });
  state = reduceState(state, {
    type: "turn.finished",
    id: "turn_missing_final",
    stopReason: "done",
    reason: "missing_final_response",
  });
  expect(state.status).toBe("ready");
  expect(state.footer).toBe("任务已完成，模型未提供最终回复");
  expect(state.messages.at(-1)).toMatchObject({
    role: "system",
    text: "任务已执行完成，但模型未提供最终回复。工具执行结果已保留。",
    status: "completed",
  });
});

test("a response arriving only in content.done is not lost", () => {
  // Some providers return a whole message without streaming a single delta.
  // `turn.submitted` still opens a stream, so the flush on `content.done` and
  // again on `turn.finished` used to rewrite the block that `content.done` had
  // just filled, wiping the reply. A stream that produced nothing must leave
  // that block alone.
  let state = structuredClone(initialState);
  const events: RuntimeEvent[] = [
    {
      type: "turn.submitted",
      id: "t1",
      text: "hi",
      byteLength: 2,
      lineCount: 1,
      sha256: "x",
    },
    { type: "content.done", id: "t1", text: "the whole answer" },
    { type: "turn.finished", id: "t1", stopReason: "done" },
  ];
  for (const event of events) state = reduceState(state, event);

  const assistant = state.messages.filter(
    (block) => block.role === "assistant",
  );
  expect(assistant).toHaveLength(1);
  expect(assistant[0]!.text).toBe("the whole answer");
});

test("an empty content.done still does not invent a block", () => {
  let state = structuredClone(initialState);
  const events: RuntimeEvent[] = [
    {
      type: "turn.submitted",
      id: "t1",
      text: "hi",
      byteLength: 2,
      lineCount: 1,
      sha256: "x",
    },
    { type: "content.done", id: "t1", text: "" },
    { type: "turn.finished", id: "t1", stopReason: "done" },
  ];
  for (const event of events) state = reduceState(state, event);
  expect(state.messages.filter((block) => block.role === "assistant")).toEqual(
    [],
  );
});
