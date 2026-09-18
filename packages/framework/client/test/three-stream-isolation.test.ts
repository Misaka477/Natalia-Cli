import { expect, test } from "bun:test";
import type {
  ProviderStreamRequest,
  StreamingProvider,
} from "@natalia/runtime";
import type { RuntimeEvent } from "@natalia/contracts";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createRealRuntimeClient } from "../src";
import { officialPluginWorkspace } from "./plugin-test-helpers";

type ChatRequest = {
  channel: "navi" | "nia";
  request: ProviderStreamRequest;
};

type Gate = {
  promise: Promise<void>;
  release: () => void;
};

type StreamGate = Gate & {
  started: Promise<void>;
  markStarted: () => void;
};

function gate(): Gate {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}

function streamGate(): StreamGate {
  const blocked = gate();
  const entered = gate();
  return { ...blocked, started: entered.promise, markStarted: entered.release };
}

function releaseAll(gates: Map<string, StreamGate>) {
  for (const value of gates.values()) value.release();
}

async function waitForGateOrAbort(gate: Gate, signal: AbortSignal | undefined) {
  if (!signal) return gate.promise;
  if (signal.aborted) throw signal.reason ?? new Error("aborted");
  await Promise.race([
    gate.promise,
    new Promise<void>((_, reject) => {
      signal.addEventListener(
        "abort",
        () => reject(signal.reason ?? new Error("aborted")),
        { once: true },
      );
    }),
  ]);
}

function eventType(event: RuntimeEvent): string {
  return event.type;
}

function chatMessages(request: ProviderStreamRequest) {
  return request.messages
    .filter((message) => message.role !== "system")
    .map((message) => ({ role: message.role, content: message.content }));
}

function providerForChat(
  requests: ChatRequest[],
  gates: Map<string, StreamGate>,
): StreamingProvider {
  return {
    provider: "test-chat",
    model: "test-chat-model",
    async *stream(request) {
      const system = String(request.messages[0]?.content ?? "");
      const channel = system.includes("<nia_chat_persona>") ? "nia" : "navi";
      requests.push({ channel, request });
      const prompt = request.messages.findLast(
        (message) => message.role === "user",
      )?.content;
      const wait = gates.get(channel);
      yield { type: "thinking" as const, text: `${channel}-thinking:` };
      wait?.markStarted();
      if (wait) await waitForGateOrAbort(wait, request.signal);
      if (request.signal?.aborted)
        throw request.signal.reason ?? new Error("aborted");
      yield { type: "content" as const, text: `${channel}:${prompt}` };
      yield {
        type: "usage" as const,
        inputTokens: 11,
        outputTokens: 7,
      };
      yield { type: "done" as const };
    },
  };
}

async function makeClient(
  suffix: string,
  requests: ChatRequest[],
  gates: Map<string, StreamGate>,
  options?: { maxStepsPerTurn?: number },
) {
  const root = await officialPluginWorkspace(`three-stream-${suffix}`);
  if (options?.maxStepsPerTurn)
    await writeFile(
      join(root, ".natalia", "config.json"),
      JSON.stringify({
        version: 3,
        runtime: { maxStepsPerTurn: options.maxStepsPerTurn },
      }),
    );
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: `ses_three_stream_${suffix}`,
    provider: providerForChat(requests, gates),
  });
  client.start(() => undefined);
  return { client, root };
}

test("Navi and Nia run concurrently with independent event and thinking namespaces", async () => {
  const requests: ChatRequest[] = [];
  const gates = new Map<string, StreamGate>([
    ["navi", streamGate()],
    ["nia", streamGate()],
  ]);
  const { client } = await makeClient("concurrent", requests, gates);
  const events: RuntimeEvent[] = [];
  client.start((event) => events.push(event));
  try {
    const navi = client.naviChat!.submit({  text: "navi first" });
    const nia = client.niaChat!.submit({ text: "nia first" });
    await Promise.all([gates.get("navi")!.started, gates.get("nia")!.started]);
    expect(requests).toHaveLength(2);
    expect(requests.map(({ channel }) => channel)).toEqual(
      expect.arrayContaining(["navi", "nia"]),
    );
    expect(
      events.filter((event) => eventType(event).startsWith("chat.")),
    ).toEqual([]);
    expect(
      events.some((event) => eventType(event) === "navi.chat.thinking.delta"),
    ).toBe(true);
    expect(
      events.some((event) => eventType(event) === "nia.chat.thinking.delta"),
    ).toBe(true);
    gates.get("navi")!.release();
    gates.get("nia")!.release();
    await Promise.all([navi, nia]);
    expect(
      events.some((event) => eventType(event) === "navi.chat.message.delta"),
    ).toBe(true);
    expect(
      events.some((event) => eventType(event) === "nia.chat.message.delta"),
    ).toBe(true);
    expect(
      events.some((event) => eventType(event) === "navi.chat.turn.finished"),
    ).toBe(true);
    expect(
      events.some((event) => eventType(event) === "nia.chat.turn.finished"),
    ).toBe(true);
    expect(
      events
        .filter((event) => eventType(event).startsWith("navi.chat."))
        .every((event) => !eventType(event).startsWith("nia.chat.")),
    ).toBe(true);
  } finally {
    releaseAll(gates);
    await client.dispose?.();
  }
});

test("Navi and Nia provider usage feeds the session usage dashboard", async () => {
  const requests: ChatRequest[] = [];
  const { client } = await makeClient("usage", requests, new Map());
  const events: RuntimeEvent[] = [];
  client.start((event) => events.push(event));
  try {
    await client.naviChat!.submit({  text: "navi usage" });
    await client.niaChat!.submit({ text: "nia usage" });
    const naviUsage = events.filter(
      (event) => event.type === "navi.runtime.step_usage",
    );
    const niaUsage = events.filter(
      (event) => event.type === "nia.runtime.step_usage",
    );
    expect(naviUsage).toHaveLength(1);
    expect(niaUsage).toHaveLength(1);
    expect(naviUsage[0]).toMatchObject({
      type: "navi.runtime.step_usage",
      inputTokens: 11,
      outputTokens: 7,
    });
    expect(niaUsage[0]).toMatchObject({
      type: "nia.runtime.step_usage",
      inputTokens: 11,
      outputTokens: 7,
    });
  } finally {
    await client.dispose?.();
  }
});

test("pending user messages are drained only by their own stream and reach the provider", async () => {
  const requests: ChatRequest[] = [];
  const gates = new Map<string, StreamGate>([
    ["navi", streamGate()],
    ["nia", streamGate()],
  ]);
  const { client } = await makeClient("pending", requests, gates);
  try {
    const naviBusy = client.naviChat!.submit({  text: "navi busy" });
    const niaBusy = client.niaChat!.submit({ text: "nia busy" });
    await Promise.all([gates.get("navi")!.started, gates.get("nia")!.started]);
    const queuedNavi = client.naviChat!.submit({
      
      text: "navi pending",
    });
    const queuedNia = client.niaChat!.submit({
      text: "nia pending",
    });
    gates.get("navi")!.release();
    gates.get("nia")!.release();
    await Promise.all([naviBusy, niaBusy, queuedNavi, queuedNia]);
    const naviPending = requests.find(
      ({ channel, request }) =>
        channel === "navi" &&
        chatMessages(request).some(
          (message) => message.content === "navi pending",
        ),
    );
    const niaPending = requests.find(
      ({ channel, request }) =>
        channel === "nia" &&
        chatMessages(request).some(
          (message) => message.content === "nia pending",
        ),
    );
    expect(naviPending).toBeDefined();
    expect(niaPending).toBeDefined();
    expect(
      chatMessages(naviPending!.request).some(
        (message) => message.content === "nia pending",
      ),
    ).toBe(false);
    expect(
      chatMessages(niaPending!.request).some(
        (message) => message.content === "navi pending",
      ),
    ).toBe(false);
  } finally {
    releaseAll(gates);
    await client.dispose?.();
  }
});

test("identical queued Navi text is consumed once per message ID", async () => {
  const requests: ChatRequest[] = [];
  const gates = new Map<string, StreamGate>([["navi", streamGate()]]);
  const { client } = await makeClient("duplicate-pending", requests, gates);
  try {
    const busy = client.naviChat!.submit({  text: "busy" });
    await gates.get("navi")!.started;
    const first = await client.naviChat!.submit({
      
      text: "same text",
    });
    const second = await client.naviChat!.submit({
      
      text: "same text",
    });
    expect(first.messageID).not.toBe(second.messageID);
    gates.get("navi")!.release();
    await busy;
    const drained = requests.at(-1)?.request;
    expect(drained).toBeDefined();
    expect(
      chatMessages(drained!).filter(
        (message) => message.role === "user" && message.content === "same text",
      ),
    ).toHaveLength(2);
  } finally {
    releaseAll(gates);
    await client.dispose?.();
  }
});

test("a Navi message arriving after the last-step drain gets a follow-up provider step", async () => {
  const requests: ChatRequest[] = [];
  const gates = new Map<string, StreamGate>([["navi", streamGate()]]);
  const { client } = await makeClient("last-step-pending", requests, gates, {
    maxStepsPerTurn: 1,
  });
  try {
    const busy = client.naviChat!.submit({  text: "last step" });
    await gates.get("navi")!.started;
    const pending = await client.naviChat!.submit({
      
      text: "arrived after drain",
    });
    gates.get("navi")!.release();
    await busy;
    expect(pending.messageID).toBeTruthy();
    expect(requests).toHaveLength(2);
    expect(
      chatMessages(requests[1]!.request).some(
        (message) =>
          message.role === "user" && message.content === "arrived after drain",
      ),
    ).toBe(true);
  } finally {
    releaseAll(gates);
    await client.dispose?.();
  }
});

test.each([
  ["navi", "nia"],
  ["nia", "navi"],
] as const)("aborting %s does not abort %s", async (aborted, peer) => {
  const requests: ChatRequest[] = [];
  const gates = new Map<string, StreamGate>([
    [aborted, streamGate()],
    [peer, streamGate()],
  ]);
  const { client } = await makeClient(`abort-${aborted}`, requests, gates);
  try {
    const chat = aborted === "navi" ? client.naviChat! : client.niaChat!;
    const cancelled = chat.submit({
      text: `${aborted} abort`,
    });
    const survivor = (peer === "navi" ? client.naviChat! : client.niaChat!).submit({
      text: `${peer} peer`,
    });
    await Promise.all([gates.get(aborted)!.started, gates.get(peer)!.started]);
    expect(await chat.abort!()).toEqual({ aborted: true });
    gates.get(aborted)!.release();
    gates.get(peer)!.release();
    await survivor;
    await cancelled;
    expect(await (peer === "navi" ? client.naviChat! : client.niaChat!).abort!()).toEqual({ aborted: false });
    expect(requests).toHaveLength(2);
  } finally {
    releaseAll(gates);
    await client.dispose?.();
  }
});

test("Nia normal profile selects its configured model and reasoning for submit and wake", async () => {
  const requests: Array<{ path: string; body: Record<string, unknown> }> = [];
  const server = Bun.serve({
    port: 0,
    async fetch(request) {
      requests.push({
        path: new URL(request.url).pathname,
        body: (await request.json()) as Record<string, unknown>,
      });
      const openAI = new URL(request.url).pathname.endsWith(
        "/chat/completions",
      );
      return new Response(
        openAI
          ? 'data: {"choices":[{"delta":{"reasoning_content":"think","content":"ok"}}]}\n\ndata: [DONE]\n\n'
          : "event: message_stop\ndata: {}\n\n",
        { headers: { "content-type": "text/event-stream" } },
      );
    },
  });
  const root = await officialPluginWorkspace("three-stream-profiles");
  const config = {
    version: 3,
    providers: {
      grok: {
        name: "Grok",
        driver: "openai",
        connection: {
          apiKey: "test",
          baseURL: `http://127.0.0.1:${server.port}/v1`,
        },
      },
      qifengstep: {
        name: "Step",
        driver: "anthropic-compatible",
        connection: {
          apiKey: "test",
          baseURL: `http://127.0.0.1:${server.port}/v1`,
        },
      },
    },
    catalog: {
      providers: {
        grok: { models: { "grok-4.6": { name: "Grok 4.6" } } },
        qifengstep: { models: { "step-3.7-flash": { name: "Step 3.7" } } },
      },
    },
    defaultModel: { provider: "qifengstep", model: "step-3.7-flash" },
  };
  const globalConfigPath = join(root, ".natalia-test-global.json");
  await writeFile(globalConfigPath, JSON.stringify(config));
  await writeFile(
    join(root, ".natalia", "config.json"),
    JSON.stringify(config),
  );
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_three_stream_profiles",
    globalConfigPath,
  });
  client.start(() => undefined);
  try {
    await client.niaChat!.submit({ text: "establish execution" });
    expect(
      await client.niaChat!.setModelProfile!(
        { normal: { modelID: "grok/grok-4.6", reasoningEffort: "high" } },
      ),
    ).toEqual({ saved: true });
    await client.niaChat!.submit({ text: "audit" });
    await client.planDocWrite!({
      path: "plans/profile-audit.md",
      content: "# Profile audit\n",
      title: "Profile audit",
    });
    const marked = await client.planDocMark!({
      path: "plans/profile-audit.md",
    });
    await client.planDocUpdateStatus!({
      planID: marked.planID,
      status: "awaiting_audit",
    });
    await Bun.sleep(25);
    const grokRequests = requests.filter((request) =>
      request.path.endsWith("/chat/completions"),
    );
    expect(grokRequests).toHaveLength(2);
    expect(grokRequests).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          body: expect.objectContaining({
            model: "grok-4.6",
            reasoning_effort: "high",
          }),
        }),
      ]),
    );
    expect(await client.niaChat!.modelProfile!()).toMatchObject({
      normal: { modelID: "grok/grok-4.6", reasoningEffort: "high" },
    });
  } finally {
    await client.dispose?.();
    server.stop(true);
  }
});

test("awaiting audit wakes Nia through her normal profile and namespaced stream", async () => {
  const requests: ProviderStreamRequest[] = [];
  const wakeStarted = gate();
  const provider: StreamingProvider = {
    provider: "nia-wake-provider",
    model: "nia-wake-model",
    async *stream(request) {
      requests.push(request);
      if (
        request.messages.some(
          (message) =>
            message.role === "user" &&
            message.content.includes("Your audit wake request has arrived"),
        )
      )
        wakeStarted.release();
      yield { type: "thinking" as const, text: "nia-wake-thinking" };
      yield { type: "content" as const, text: "nia wake reply" };
      yield { type: "done" as const };
    },
  };
  const root = await officialPluginWorkspace("three-stream-nia-wake");
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_three_stream_nia_wake",
    provider,
  });
  const events: RuntimeEvent[] = [];
  client.start((event) => events.push(event));
  try {
    await client.niaChat!.submit({ text: "establish execution" });
    await client.niaChat!.setModelProfile!(
      { normal: { reasoningEffort: "high" } },
    );
    await client.planDocWrite!({
      path: "plans/audit-target.md",
      content: "# Audit target\n",
      title: "Audit target",
    });
    const marked = await client.planDocMark!({ path: "plans/audit-target.md" });
    expect(
      await client.planDocUpdateStatus!({
        planID: marked.planID,
        status: "awaiting_audit",
      }),
    ).toEqual({ updated: true });
    await wakeStarted.promise;
    const wake = requests.find((request) =>
      request.messages.some(
        (message) =>
          message.role === "user" &&
          message.content.includes("Your audit wake request has arrived"),
      ),
    );
    expect(wake).toBeDefined();
    expect(
      events.some((event) => eventType(event) === "nia.chat.thinking.delta"),
    ).toBe(true);
  } finally {
    await client.dispose?.();
  }
});

test("main, Navi, and Nia publish thinking in their independent namespaces", async () => {
  const requests: ChatRequest[] = [];
  const gates = new Map<string, StreamGate>();
  const { client } = await makeClient("thinking", requests, gates);
  const events: RuntimeEvent[] = [];
  client.start((event) => events.push(event));
  try {
    await client.submitAndWait!("main thinking");
    await client.naviChat!.submit({  text: "navi thinking" });
    await client.niaChat!.submit({ text: "nia thinking" });
    expect(events.some((event) => eventType(event) === "thinking.delta")).toBe(
      true,
    );
    expect(
      events.some((event) => eventType(event) === "navi.chat.thinking.delta"),
    ).toBe(true);
    expect(
      events.some((event) => eventType(event) === "nia.chat.thinking.delta"),
    ).toBe(true);
  } finally {
    await client.dispose?.();
  }
});

test("durable thinking rows replay independently and never enter later chat prompts", async () => {
  const initialRequests: ChatRequest[] = [];
  const root = await officialPluginWorkspace("three-stream-thinking-replay");
  const sessionID = "ses_three_stream_thinking_replay";
  const initial = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID,
    provider: providerForChat(initialRequests, new Map()),
  });
  initial.start(() => undefined);
  try {
    await initial.naviChat!.submit({  text: "first navi" });
    await initial.niaChat!.submit({ text: "first nia" });
    const naviRows = await initial.naviChat!.messages!();
    const niaRows = await initial.niaChat!.messages!();
    expect(naviRows).toContainEqual(
      expect.objectContaining({ kind: "thinking", text: "navi-thinking:" }),
    );
    expect(niaRows).toContainEqual(
      expect.objectContaining({ kind: "thinking", text: "nia-thinking:" }),
    );
  } finally {
    await initial.dispose?.();
  }

  const replayRequests: ChatRequest[] = [];
  const reopened = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID,
    provider: providerForChat(replayRequests, new Map()),
  });
  const reopenedReady = gate();
  reopened.start((event) => {
    if (event.type === "session.ready") reopenedReady.release();
  });
  try {
    await reopenedReady.promise;
    const naviRows = await reopened.naviChat!.messages!();
    const niaRows = await reopened.niaChat!.messages!();
    expect(naviRows.filter((row) => row.kind === "thinking")).toEqual([
      expect.objectContaining({ text: "navi-thinking:" }),
    ]);
    expect(niaRows.filter((row) => row.kind === "thinking")).toEqual([
      expect.objectContaining({ text: "nia-thinking:" }),
    ]);

    await reopened.naviChat!.submit({  text: "second navi" });
    await reopened.niaChat!.submit({ text: "second nia" });
    expect(replayRequests).toHaveLength(2);
    expect(
      replayRequests.flatMap(({ request }) =>
        request.messages.filter((message) =>
          message.content.endsWith("thinking:"),
        ),
      ),
    ).toEqual([]);
  } finally {
    await reopened.dispose?.();
  }
});

test("plan document paths are validated without masking the reason as internal", async () => {
  const root = await officialPluginWorkspace("three-stream-plan-path");
  const provider: StreamingProvider = {
    provider: "plan-path",
    model: "plan-path",
    async *stream() {},
  };
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_plan_path",
    provider,
  });
  client.start(() => undefined);
  try {
    await expect(
      client.planDocMark!({ path: "/tmp/outside-plan.md" }),
    ).rejects.toMatchObject({
      name: "RuntimeInvalidParams",
      message: expect.stringContaining("must be under .natalia/plans"),
    });
    await expect(
      client.planDocMark!({ path: ".natalia/plans/missing.md" }),
    ).rejects.toMatchObject({
      name: "RuntimeInvalidParams",
      message: expect.stringContaining("does not exist"),
    });
  } finally {
    await client.dispose?.();
  }
});
