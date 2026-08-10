import { expect, test } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { failureKind } from "@natalia/contracts";
import type {
  RuntimeClient,
  RuntimeDiagnostic,
  RuntimeEvent,
  RuntimeRPCError,
} from "@natalia/contracts";
import {
  createRealRuntimeClient,
  installExampleDocuments,
} from "@natalia/client";
import { callRuntimeRPC } from "@natalia/transport";
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

    // Work Graph is a public integration surface, not only an internal
    // projector. The same turn and tool must be causally connected over HTTP.
    const graphNodes = await sdk.workGraphNodes();
    const graphEdges = await sdk.workGraphEdges();
    const action = graphNodes.find(
      (node) => node.kind === "agent_action" && node.turnID === submitted.id,
    );
    const tool = graphNodes.find(
      (node) => node.kind === "tool_call" && node.turnID === submitted.id,
    );
    expect(action).toBeDefined();
    expect(tool).toMatchObject({ actor: "write_file" });
    expect(
      graphEdges.some(
        (edge) =>
          edge.sourceID === action!.nodeID &&
          edge.targetID === tool!.nodeID &&
          edge.kind === "caused",
      ),
    ).toBe(true);

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

test("a consumer can ask what this runtime implements, without guessing", async () => {
  await withRuntime(async ({ baseURL }) => {
    const sdk = createNataliaSDK({ baseURL, token: "secret" });
    const report = await sdk.availability();

    // A usable runtime says so, without the consumer probing 95 members one by one.
    expect(report.usable).toBe(true);
    expect(report.missingRequired).toEqual([]);

    const available = report.groups
      .filter((group) => group.available)
      .map((group) => group.name);
    expect(available).toContain("sessions");
    expect(available).toContain("checkpoint");
    // The xterm `terminal` group is retired; the live terminal surface is the
    // native host, which the in-process report still describes accurately.
    expect(available).toContain("nativeTerminal");
    expect(available).toContain("workGraph");

    // This capability was reported partial when the report first ran — the
    // precheck `canReloadConfig` existed and the action did not — which is what
    // led to implementing it. It is whole now, and asserting that keeps the pair
    // together: adding a precheck without its action fails here.
    expect(available).toContain("lifecycle");

    // A half-implemented capability is called out, never counted as present.
    for (const group of report.groups)
      expect(group.available && group.partial).toBe(false);

    // And the five queries that answer with nothing are named, with a reason, so an
    // empty array is not mistaken for "nothing recorded".
    expect(report.unimplemented.map((entry) => entry.member).sort()).toEqual([
      "constitutionRules",
      "decisionRecords",
      "driftFindings",
      "evidenceRecords",
      "registeredTools",
    ]);
    for (const entry of report.unimplemented)
      expect(entry.reason).toMatch(/yet/u);

    // The channel dimension (P0-B): what this connection can reach is a
    // separate fact from what the runtime implements. A consumer driving the
    // runtime over RPC must not build on the native terminal or intelligence
    // surfaces yet — the report says so instead of letting it fail at runtime.
    expect(report.channel?.name).toBe("rpc");
    const channelByMember = new Map(
      report.channel!.groups.flatMap((group) =>
        group.members.map((member) => [member.member, member.state] as const),
      ),
    );
    // P0-C closed the gap: these are routed now. The whitelist members are the
    // only implemented-but-unreachable surface left, and each says why.
    for (const member of [
      "nativeTerminalList",
      "nativeTerminalOpenHub",
      "constitutionRules",
      "capabilities",
      "submitInput",
      "sessionSnapshot",
    ])
      expect(channelByMember.get(member)).toBe("implemented_reachable");
    const nativeGroup = report.channel!.groups.find(
      (group) => group.name === "nativeTerminal",
    )!;
    expect(nativeGroup.reachable).toBe(true);
    expect(
      report.channel!.requiredMembers.find(
        (member) => member.member === "dispose",
      ),
    ).toBeUndefined();
    // What the RPC channel does reach is ordinary and healthy.
    expect(channelByMember.get("sessionList")).toBe("implemented_reachable");
    expect(channelByMember.get("history")).toBe("implemented_reachable");
  });
}, 60_000);

test("a consumer can ask whether config may be applied, and apply it", async () => {
  await withRuntime(async ({ baseURL }) => {
    const sdk = createNataliaSDK({ baseURL, token: "secret" });

    // Nothing is running, so the answer is yes...
    expect(await sdk.canReloadConfig()).toEqual({ allowed: true });
    // ...and the action reports what it did, rather than returning nothing and
    // leaving the caller to assume. A refusal would arrive the same way, as a
    // value, because "a turn is running" is an answer and not a failure.
    const applied = await sdk.reloadConfig();
    expect(applied.applied).toBe(true);
    expect(applied.reason).toBeUndefined();
  });
}, 60_000);

test("an unauthenticated consumer is refused", async () => {
  await withRuntime(async ({ baseURL }) => {
    const sdk = createNataliaSDK({ baseURL, token: "wrong" });
    // The transport must not be usable without the token a deployment issued.
    await expect(sdk.prompt("should not run")).rejects.toThrow();
  });
}, 60_000);

test("a consumer can tell the kinds of failure apart without reading messages", async () => {
  await withRuntime(async ({ baseURL, root }) => {
    const sdk = createNataliaSDK({ baseURL, token: "secret" });

    // Each kind calls for a different reaction — report a bug, hide the feature,
    // fix the call, tell the user, retry — so a consumer that cannot tell them
    // apart has to treat every failure as the worst case. Nothing below matches
    // on message text; that is the practice being replaced.

    // 1. No such method: this consumer and this runtime disagree about the protocol.
    const unknown = await callRuntimeRPC({
      url: baseURL,
      token: "secret",
      method: "no.such.method",
    }).catch((error: unknown) => error);
    expect(failureKind(unknown)).toBe("methodNotFound");

    // 2. Wrong argument: the call is fixable by the caller.
    const badArgument = await sdk
      .workspaceRead({ path: "notes.md", offset: -1 })
      .catch((error: unknown) => error);
    expect(failureKind(badArgument)).toBe("invalidParams");

    // 3. Policy says no. A path outside the workspace is a refusal, not a fault,
    // and the reason is machine-readable so a UI can explain it.
    const refused = await sdk
      .workspaceRead({ path: "../outside" })
      .catch((error: unknown) => error);
    expect(failureKind(refused)).toBe("refused");
    expect((refused as RuntimeRPCError).data).toMatchObject({
      kind: "refused",
      reason: expect.stringContaining("workspace"),
    });
    // A refusal must not describe the boundary it enforced: handing the caller the
    // absolute directory it failed to escape gives away the thing it was refused.
    expect((refused as RuntimeRPCError).message).not.toContain(root);
    expect(JSON.stringify((refused as RuntimeRPCError).data)).not.toContain(
      root,
    );
  });
}, 60_000);

test("a consumer is told when its answer or its turn control did not take effect", async () => {
  await withRuntime(async ({ baseURL }) => {
    const sdk = createNataliaSDK({ baseURL, token: "secret" });

    // An external UI answering approvals is the first integration scenario there
    // is, and it has to distinguish "your answer took effect" from "that request
    // had already timed out and the model was told the call did not run". Both
    // used to arrive as `responded: true`.
    expect(
      await sdk.respondApproval({ requestID: "apr_gone", decision: "once" }),
    ).toEqual({
      accepted: false,
      reason: "the approval request is no longer pending",
    });
    expect(
      await sdk.respondQuestion({
        requestID: "qst_gone",
        answers: [["no"]],
        rejected: false,
      }),
    ).toMatchObject({ accepted: false });

    // Same shape for turn control and agent selection: refusing is a value, so a
    // consumer never has to infer it from the absence of an exception.
    expect(await sdk.pause()).toMatchObject({ paused: false });
    expect(await sdk.resume()).toMatchObject({ resumed: false });
    expect(await sdk.selectAgent("no-such-agent")).toMatchObject({
      outcome: "rejected",
    });
  });
}, 60_000);

test("a runtime implementing only the required set still answers, and says which capability is missing", async () => {
  // The other half of "not supported": the route exists, the member does not. A
  // consumer must be able to switch off a whole feature area from one failure
  // instead of discovering it member by member — so the capability group has to
  // arrive with the error. This stub is also the proof that the required set is
  // enough to stand a server up.
  const recorded: RuntimeDiagnostic[] = [];
  const stub: RuntimeClient = {
    start() {},
    async submit(text) {
      return {
        type: "turn.submitted",
        id: "turn_stub",
        text,
        byteLength: text.length,
        lineCount: 1,
        sha256: "stub",
      };
    },
    cancel() {},
    snapshot() {
      return { type: "diagnostic", level: "info", message: "stub" };
    },
    diagnostic(message, level = "warning") {
      recorded.push({
        type: "diagnostic",
        level,
        message,
        at: new Date().toISOString(),
      });
    },
    async diagnostics() {
      return recorded;
    },
    lastSubmission() {
      return undefined;
    },
    respondApproval() {
      return { accepted: true };
    },
    respondQuestion() {
      return { accepted: true };
    },
    async sessionList() {
      // What a real runtime failure looks like: an fs error whose text carries an
      // absolute path nobody meant to publish.
      throw new Error(
        "ENOENT: no such file or directory, open '/home/someone/project/.env'",
      );
    },
  };
  const server = createRuntimeHttpServer({ client: stub, events: false });
  try {
    const sdk = createNataliaSDK({ baseURL: server.url });

    const notSupported = await sdk
      .checkpointList()
      .catch((error: unknown) => error);
    expect(failureKind(notSupported)).toBe("notSupported");
    expect((notSupported as RuntimeRPCError).data).toEqual({
      kind: "notSupported",
      member: "checkpointList",
      capability: "checkpoint",
    });

    // An unclassified failure arrives as internal and carries no detail at all.
    const internal = await sdk.sessions().catch((error: unknown) => error);
    expect(failureKind(internal)).toBe("internal");
    expect((internal as RuntimeRPCError).message).not.toContain(".env");
    const errorID = ((internal as RuntimeRPCError).data as { errorID: string })
      .errorID;
    expect(errorID).toBeString();
    // The detail is moved, not lost: a consumer already authorized to read
    // diagnostics can correlate by the ID it was handed.
    const diagnostics = await sdk.diagnostics(50);
    const entry = diagnostics.find((item) => item.message.includes(errorID));
    expect(entry).toBeDefined();
    expect(entry!.level).toBe("error");
    expect(entry!.message).toContain(".env");

    // And the runtime still answers what it can, so a consumer is never left
    // guessing whether the connection itself works.
    expect((await sdk.prompt("hello")).text).toBe("hello");
  } finally {
    server.stop();
  }
}, 60_000);

test("the P0-C route surface answers over HTTP: native terminal, intelligence, capabilities", async () => {
  await withRuntime(async ({ baseURL }) => {
    const sdk = createNataliaSDK({ baseURL, token: "secret" });
    const failureKindOr = (promise: Promise<unknown>) =>
      promise.then(
        () => undefined,
        (error: unknown) => failureKind(error),
      );

    // Native terminal without a host: every route exists (never -32601) and
    // answers either empty or a refusal/internal — the route is there, the
    // environment is not. Each call is awaited as it is made: a batch of
    // already-started promises would be reported unhandled by bun while the
    // earlier ones are still in flight.
    expect(await sdk.nativeTerminalList()).toEqual([]);
    for (const call of [
      () => sdk.nativeTerminalRead("term_x"),
      () => sdk.nativeTerminalStop("term_x"),
      () => sdk.nativeTerminalOpenHub(),
      () => sdk.nativeTerminalRevokeApprovalScope("term_x"),
      () => sdk.nativeTerminalReleaseHumanControl("term_x"),
      () => sdk.nativeTerminalBeginSecureInput("term_x"),
      () => sdk.nativeTerminalEndSecureInput("term_x"),
    ]) {
      const kind = await failureKindOr(call());
      expect(kind, "native terminal route must exist, not be -32601").not.toBe(
        "methodNotFound",
      );
    }

    // Intelligence queries and capability records: routed and answering with
    // nothing, exactly as the availability report promises via `unimplemented`.
    expect(await sdk.constitutionRules()).toEqual([]);
    expect(await sdk.decisionRecords()).toEqual([]);
    expect(await sdk.evidenceRecords()).toEqual([]);
    expect(await sdk.driftFindings()).toEqual([]);
    expect(await sdk.registeredTools()).toEqual([]);
    // Capability records: the runtime registers real ones (the MCP server, the
    // platform surface), so the shape is the assertion, not emptiness.
    const capabilityRecords = await sdk.capabilities();
    expect(capabilityRecords.length).toBeGreaterThan(0);
    for (const record of capabilityRecords) {
      expect(typeof record.id).toBe("string");
      expect(typeof record.name).toBe("string");
      expect(typeof record.version).toBe("string");
      expect(Array.isArray(record.grants)).toBe(true);
    }

    // sessionSnapshot answers undefined or a snapshot — a value either way.
    const snapshot = await sdk.sessionSnapshot();
    expect(snapshot === undefined || typeof snapshot === "object").toBe(true);

    // submitInput is a real submission with the richer input shape.
    const submitted = await sdk.submitInput({ text: "via submit.input" });
    expect(submitted.type).toBe("turn.submitted");
    expect(submitted.text).toBe("via submit.input");

    // And the report agrees: these are reachable now, whitelist members are not.
    const report = await sdk.availability();
    const byMember = new Map([
      ...report.channel!.groups.flatMap((group) =>
        group.members.map((member) => [member.member, member.state] as const),
      ),
      ...report.channel!.requiredMembers.map(
        (member) => [member.member, member.state] as const,
      ),
    ]);
    expect(byMember.get("nativeTerminalList")).toBe("implemented_reachable");
    expect(byMember.get("constitutionRules")).toBe("implemented_reachable");
    expect(byMember.get("dispose")).toBe("implemented_unreachable");
  });
}, 60_000);

test("a read-only integration renders the session and cannot write a byte", async () => {
  // P0-D on the consumer side, and the seed of the P0-F "read-only
  // integration" scenario: one server, two credentials — the operator's
  // full-write one and an integration's read-only one. The integration must
  // render everything and cause no side effect, and the report it sees must
  // say so (write surface unreachable *by authorization*, never by lie).
  const root = await mkdtemp(join(tmpdir(), "natalia-readonly-consumer-"));
  const events: RuntimeEvent[] = [];
  const runtime = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_consumer",
    permissionMode: "auto",
    provider: {
      provider: "scripted",
      model: "scripted",
      async *stream() {
        yield { type: "content" as const, text: "ready" };
        yield { type: "done" as const };
      },
    },
  });
  runtime.start((event) => events.push(event));
  const server = createRuntimeHttpServer({
    client: runtime,
    authorization: {
      credentials: [
        { token: "operator", write: true },
        { token: "integration", write: false },
      ],
    },
  });
  try {
    const integration = createNataliaSDK({
      baseURL: server.url,
      token: "integration",
    });

    // Render: read the history and the workspace.
    const submitted = await integration.prompt(
      "describe the workspace",
    ).catch(() => undefined);
    // A read-only credential cannot submit — that is the point.
    expect(submitted).toBeUndefined();
    const page = await integration.workspaceList({ path: "." });
    expect(Array.isArray(page.entries)).toBe(true);
    const report = await integration.availability();
    const byMember = new Map(
      report.channel!.groups.flatMap((group) =>
        group.members.map((member) => [member.member, member.state] as const),
      ),
    );
    expect(byMember.get("reloadConfig")).toBe("implemented_unreachable");
    expect(byMember.get("sessionList")).toBe("implemented_reachable");

    // The operator's credential still has the whole surface.
    const operator = createNataliaSDK({
      baseURL: server.url,
      token: "operator",
    });
    const turned = await operator.prompt("hello operator");
    expect(turned.text).toBe("hello operator");
  } finally {
    server.stop();
    await runtime.dispose?.();
  }
}, 60_000);
