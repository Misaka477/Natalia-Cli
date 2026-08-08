import { expect, test } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { RuntimeEvent } from "@natalia/contracts";
import {
  createRealRuntimeClient,
  installExampleDocuments,
} from "@natalia/client";
import { createRuntimeHttpServer } from "@natalia/transport/host";
import { projectEvents, displayText, type AppState } from "@natalia/view-store";
import { createNataliaSDK } from "../src";

/**
 * Consumer conformance fixture (mainline plan P12).
 *
 * This is the test an externally built UI author effectively runs: it drives a
 * real runtime over the real HTTP transport using **only** the packages §2.1
 * allows a consumer to depend on —
 *
 *   @natalia/contracts   types
 *   @natalia/sdk         talking to a runtime
 *   @natalia/view-store  turning events into displayable state
 *   @natalia/client      public exports only (to host the runtime under test)
 *
 * It deliberately imports nothing from `@natalia/runtime`, `@natalia/session`,
 * `@natalia/tools`, any package internal, or any UI framework. `guard:imports`
 * enforces most of that statically; this proves the surface is actually
 * *sufficient*, which no static rule can show.
 *
 * If a future change makes a UI impossible to build from this surface, this test
 * is where it should fail — not in someone's project.
 *
 * `@natalia/transport/host` is used to stand the server up. That is the one
 * host-side import, and it is what a consumer would replace with a URL pointing
 * at a runtime somebody else runs.
 */

async function withRuntime<T>(
  scenario: (input: {
    baseURL: string;
    events: RuntimeEvent[];
    root: string;
  }) => Promise<T>,
  options: { withDocuments?: boolean } = {},
): Promise<T> {
  const root = await mkdtemp(join(tmpdir(), "natalia-consumer-"));
  if (options.withDocuments)
    await installExampleDocuments({ workspaceRoot: root, includeTasks: true });
  const events: RuntimeEvent[] = [];
  const runtime = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_consumer",
    permissionMode: "auto",
    provider: {
      provider: "scripted",
      model: "scripted",
      async *stream(request) {
        const answered = request.messages.some(
          (message) => message.role === "tool",
        );
        if (!answered) {
          yield { type: "thinking" as const, text: "checking the workspace" };
          yield { type: "content" as const, text: "Reading the file now. " };
          yield {
            type: "tool_call" as const,
            calls: [
              {
                id: "call_1",
                name: "write_file",
                arguments: JSON.stringify({
                  path: "notes.md",
                  content: "hello",
                }),
              },
            ],
          };
          return;
        }
        yield { type: "content" as const, text: "Wrote notes.md." };
        yield { type: "done" as const };
      },
    },
  });
  runtime.start((event) => events.push(event));

  const server = createRuntimeHttpServer({ client: runtime, token: "secret" });
  try {
    return await scenario({ baseURL: server.url, events, root });
  } finally {
    server.stop();
    await runtime.dispose?.();
  }
}

test("a consumer can drive a turn and render it from the public surface alone", async () => {
  await withRuntime(async ({ baseURL, events }) => {
    const sdk = createNataliaSDK({ baseURL, token: "secret" });

    const submitted = await sdk.prompt("write notes.md");
    expect(submitted.text).toBe("write notes.md");

    // Poll the durable history the way a reconnecting UI would, rather than
    // relying on the in-process sink.
    const deadline = Date.now() + 15_000;
    let history: Array<{ seq: number; event: RuntimeEvent }> = [];
    while (Date.now() < deadline) {
      history = (await sdk.history({ limit: 500 })).events;
      if (
        history.some(
          (entry) =>
            entry.event.type === "turn.finished" &&
            entry.event.id === submitted.id,
        )
      )
        break;
      await Bun.sleep(50);
    }

    const finished = history.find(
      (entry) => entry.event.type === "turn.finished",
    );
    expect(finished).toBeDefined();

    // The consumer's whole rendering path: fold the durable event stream.
    const state: AppState = projectEvents(history.map((entry) => entry.event));

    const transcript = state.messages.map((block) => ({
      role: block.role,
      text: displayText(block),
    }));

    expect(transcript.find((row) => row.role === "user")?.text).toBe(
      "write notes.md",
    );
    expect(
      transcript.some(
        (row) => row.role === "assistant" && row.text.includes("Reading"),
      ),
    ).toBe(true);
    // Durable history carries no `content.delta` — deltas are live-only — so a
    // replaying consumer must still recover every model message from the
    // per-step `content.done` events.
    expect(
      transcript.some(
        (row) =>
          row.role === "assistant" && row.text.includes("Wrote notes.md"),
      ),
    ).toBe(true);
    // Order must survive replay: the tool card sits between the two messages.
    const order = transcript.map((row) => row.role);
    expect(order).toEqual(["user", "assistant", "tool", "assistant"]);

    // A tool call has to be visible as structured data, not only as prose, or a
    // consumer cannot build a tool card.
    const tools = Object.values(state.tools);
    expect(tools).toHaveLength(1);
    expect(tools[0]).toMatchObject({ name: "write_file", status: "succeeded" });

    expect(state.activeTurn).toBeUndefined();
    expect(state.lastStopReason).toBe("done");

    // Resource and status surfaces must be readable from the projection too, or
    // a UI still has to parse raw events to render anything but the transcript.
    expect(Object.keys(state.capabilities).length).toBeGreaterThan(0);
    expect(state.checkpoints.length).toBeGreaterThan(0);
    expect(state.policyDecisions.length).toBeGreaterThan(0);
    expect(state.statusSegments.some((s) => s.startsWith("model:"))).toBe(true);
    // Every slice a consumer indexes into exists even when nothing filled it.
    expect(state.terminals).toBeDefined();
    expect(state.sandboxes).toBeDefined();
    expect(state.subagents).toBeDefined();
    expect(state.mcp).toBeDefined();
    expect(state.todos).toBeDefined();

    // Note for consumers: `RuntimeClient.start()` holds a single sink, and the
    // HTTP server claims it. Fan-out to more than one observer is the server's
    // job (SSE `/events`), not the client's, so `events` here is not asserted.
    void events;
  });
}, 60_000);

test("a consumer can read catalogues and workspace facts over the SDK", async () => {
  await withRuntime(async ({ baseURL }) => {
    const sdk = createNataliaSDK({ baseURL, token: "secret" });

    // These are the surfaces a UI needs before it can render anything useful.
    expect(Array.isArray(await sdk.agents())).toBe(true);
    expect(Array.isArray(await sdk.modelCatalog())).toBe(true);
    expect(Array.isArray(await sdk.skills())).toBe(true);
    expect(Array.isArray(await sdk.workspaceFiles({ limit: 5 }))).toBe(true);

    const status = await sdk.runtimeStatus?.();
    if (status) expect(status.type).toBe("status.snapshot");
  });
}, 60_000);

test("a consumer can inspect real unattended work over the SDK", async () => {
  await withRuntime(
    async ({ baseURL }) => {
      const sdk = createNataliaSDK({ baseURL, token: "secret" });

      // Scheduled tasks and flows were previously reachable only by running the
      // CLI, so a remote integration could not list unattended work at all.
      // Assert against installed documents, because empty lists would pass
      // whether the routes worked or not.
      const tasks = await sdk.taskOverview();
      expect(tasks.tasks.length).toBeGreaterThan(0);
      expect(tasks.unreadable).toEqual([]);
      const task = tasks.tasks[0]!;
      expect(task.taskID).toBeString();
      expect(task.flowID).toBeString();
      expect(task.permissionProfile).toBeString();

      const flows = await sdk.flowOverview();
      expect(flows.flows.length).toBeGreaterThan(0);
      expect(flows.flows[0]!.stages.length).toBeGreaterThan(0);
      // A flow reports which tasks run it, so an integration can show impact.
      expect(Array.isArray(flows.flows[0]!.usedBy)).toBe(true);

      // The catalog is for launching, so it lists every task but only flows that
      // declare `directRun` — a flow without one cannot be run on its own. The
      // example flows have no `directRun`, which is why only tasks appear here.
      const catalog = await sdk.documentCatalog();
      expect(catalog.some((entry) => entry.kind === "task")).toBe(true);
      expect(catalog.every((entry) => entry.id.length > 0)).toBe(true);
      expect(catalog.length).toBe(tasks.tasks.length);
    },
    { withDocuments: true },
  );
}, 60_000);

test("a consumer can discover contributed commands", async () => {
  await withRuntime(async ({ baseURL }) => {
    const sdk = createNataliaSDK({ baseURL, token: "secret" });
    // The catalog is the surface a UI renders a palette from, and it exists even
    // when nothing has contributed yet, so a consumer never indexes into undefined.
    const commands = await sdk.commandCatalog();
    expect(Array.isArray(commands)).toBe(true);
    for (const command of commands) {
      expect(command.name).toBeString();
      expect(command.title).toBeString();
    }
  });
}, 60_000);

test("an unauthenticated consumer is refused", async () => {
  await withRuntime(async ({ baseURL }) => {
    const sdk = createNataliaSDK({ baseURL, token: "wrong" });
    // The transport must not be usable without the token a deployment issued.
    await expect(sdk.prompt("should not run")).rejects.toThrow();
  });
}, 60_000);
