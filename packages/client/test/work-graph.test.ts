import { expect, test } from "bun:test";
import { mkdtemp, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { RuntimeEvent } from "@natalia/contracts";
import type { ProviderStreamRequest } from "@natalia/runtime";
import {
  projectedWorkGraphEdges,
  projectedWorkGraphNodes,
} from "@natalia/session";
import { workGraphEdgeSchema, workGraphNodeSchema } from "@natalia/contracts";
import { createRealRuntimeClient } from "../src";
import {
  agentActionNodeID,
  approvalNodeID,
  toolCallNodeID,
} from "../src/work-graph";

/**
 * The Work Graph shipped as schema, projector, query and a TUI dialog with no
 * production writer, so every query returned an empty graph. These tests exist to
 * make that impossible to regress into: they drive a real runtime and assert the
 * graph has content, rather than asserting the projector can filter events a test
 * handed it.
 */

async function workspace(name: string) {
  const root = await mkdtemp(join(tmpdir(), `natalia-wg-${name}-`));
  await mkdir(join(root, ".natalia"), { recursive: true });
  return root;
}

test("a real turn with a tool call produces a connected graph", async () => {
  const root = await workspace("turn");
  await writeFile(join(root, "notes.md"), "hello\n");
  const events: RuntimeEvent[] = [];
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_wg_turn",
    permissionMode: "auto",
    provider: {
      provider: "test",
      model: "test",
      async *stream(request: ProviderStreamRequest) {
        if (
          request.messages.some(
            (message: { role: string }) => message.role === "tool",
          )
        ) {
          yield { type: "done" as const };
          return;
        }
        yield {
          type: "tool_call" as const,
          calls: [
            {
              id: "call_1",
              name: "read_file",
              arguments: JSON.stringify({ path: "notes.md" }),
            },
          ],
        };
      },
    },
  });
  client.start((event) => events.push(event));
  const submitted = await client.submit("read the notes");

  const nodes = projectedWorkGraphNodes(events);
  const edges = projectedWorkGraphEdges(events);

  // The empty pipeline is closed: production emitted nodes.
  expect(nodes.length).toBeGreaterThan(0);

  const action = nodes.find(
    (node) => node.nodeID === agentActionNodeID(submitted.id),
  );
  expect(action).toMatchObject({ kind: "agent_action", turnID: submitted.id });

  const tool = nodes.find(
    (node) => node.nodeID === toolCallNodeID(submitted.id, "call_1"),
  );
  expect(tool).toMatchObject({ kind: "tool_call", actor: "read_file" });
  expect(tool?.summary).toContain("succeeded");

  // The graph is connected: the tool call is attributable to the turn that caused
  // it, which is the whole point of recording it.
  expect(
    edges.some(
      (edge) =>
        edge.sourceID === agentActionNodeID(submitted.id) &&
        edge.targetID === toolCallNodeID(submitted.id, "call_1") &&
        edge.kind === "caused",
    ),
  ).toBe(true);

  await client.dispose?.();
}, 60_000);

test("runtime startup records the effective tool catalogue as metadata", async () => {
  const root = await workspace("registered-tools");
  const events: RuntimeEvent[] = [];
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_wg_registered_tools",
    provider: {
      provider: "test",
      model: "test",
      async *stream() {
        yield { type: "done" as const };
      },
    },
  });
  let resolveReady!: () => void;
  const ready = new Promise<void>((resolve) => {
    resolveReady = resolve;
  });
  client.start((event) => {
    events.push(event);
    if (event.type === "session.ready") resolveReady();
  });
  await ready;

  const registered = events.filter(
    (event): event is Extract<RuntimeEvent, { type: "tool.registered" }> =>
      event.type === "tool.registered",
  );
  expect(registered.length).toBeGreaterThan(0);
  expect(registered.find((event) => event.name === "read_file")).toMatchObject({
    owner: "natalia-runtime",
    scope: "session",
    recovery: "fail_closed",
  });
  expect(registered.some((event) => "description" in event)).toBe(false);
  expect(new Set(registered.map((event) => event.id)).size).toBe(
    registered.length,
  );
  await client.dispose?.();
}, 60_000);

test("a failed tool call is recorded as a fact too", async () => {
  const root = await workspace("failed");
  const events: RuntimeEvent[] = [];
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_wg_failed",
    permissionMode: "auto",
    provider: {
      provider: "test",
      model: "test",
      async *stream(request: ProviderStreamRequest) {
        if (
          request.messages.some(
            (message: { role: string }) => message.role === "tool",
          )
        ) {
          yield { type: "done" as const };
          return;
        }
        yield {
          type: "tool_call" as const,
          calls: [
            {
              id: "call_1",
              name: "read_file",
              arguments: JSON.stringify({ path: "does-not-exist.md" }),
            },
          ],
        };
      },
    },
  });
  client.start((event) => events.push(event));
  const submitted = await client.submit("read a missing file");

  const tool = projectedWorkGraphNodes(events).find(
    (node) => node.nodeID === toolCallNodeID(submitted.id, "call_1"),
  );
  expect(tool?.summary).toContain("failed");
  await client.dispose?.();
}, 60_000);

test("the graph carries no arguments, output, prompt or error text", async () => {
  // The graph is replayable and shareable, so anything sensitive that reached it
  // would be permanent. This asserts on the serialized nodes rather than on the
  // fields a reader happens to check.
  const root = await workspace("redaction");
  const secretPath = "credentials-SECRETPATH.md";
  await writeFile(join(root, secretPath), "TOKEN-SECRETBODY\n");
  const events: RuntimeEvent[] = [];
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_wg_redaction",
    permissionMode: "auto",
    provider: {
      provider: "test",
      model: "test",
      async *stream(request: ProviderStreamRequest) {
        if (
          request.messages.some(
            (message: { role: string }) => message.role === "tool",
          )
        ) {
          yield { type: "done" as const };
          return;
        }
        yield { type: "thinking" as const, text: "SECRETREASONING" };
        yield {
          type: "tool_call" as const,
          calls: [
            {
              id: "call_1",
              name: "read_file",
              arguments: JSON.stringify({ path: secretPath }),
            },
          ],
        };
      },
    },
  });
  client.start((event) => events.push(event));
  await client.submit("read SECRETPROMPT now");

  const graph = JSON.stringify([
    ...projectedWorkGraphNodes(events),
    ...projectedWorkGraphEdges(events),
  ]);
  expect(graph).not.toContain("SECRETPROMPT");
  expect(graph).not.toContain("SECRETREASONING");
  expect(graph).not.toContain("SECRETBODY");
  expect(graph).not.toContain("SECRETPATH");
  // It still says something useful.
  expect(graph).toContain("read_file");
  await client.dispose?.();
}, 60_000);

test("an approval decision is recorded and attributed to the user", async () => {
  const root = await workspace("approval");
  const events: RuntimeEvent[] = [];
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_wg_approval",
    permissionMode: "ask",
    provider: {
      provider: "test",
      model: "test",
      async *stream(request: ProviderStreamRequest) {
        if (
          request.messages.some(
            (message: { role: string }) => message.role === "tool",
          )
        ) {
          yield { type: "done" as const };
          return;
        }
        yield {
          type: "tool_call" as const,
          calls: [
            {
              id: "call_1",
              name: "write_file",
              arguments: JSON.stringify({
                path: "out.txt",
                content: "hello",
              }),
            },
          ],
        };
      },
    },
  });
  client.start((event) => {
    events.push(event);
    if (event.type === "approval.request")
      client.respondApproval({ requestID: event.id, decision: "once" });
  });
  const submitted = await client.submit("write the file");

  const approvalRequest = events.find(
    (event) => event.type === "approval.request",
  );
  expect(approvalRequest).toBeDefined();
  const approval = projectedWorkGraphNodes(events).find(
    (node) =>
      node.nodeID ===
      approvalNodeID(
        (approvalRequest as Extract<RuntimeEvent, { type: "approval.request" }>)
          .id,
      ),
  );
  // Who authorized the side effect is exactly what the graph is for.
  expect(approval).toMatchObject({ kind: "approval", actor: "user" });
  expect(approval?.summary).toContain("once");
  expect(
    projectedWorkGraphEdges(events).some(
      (edge) =>
        edge.sourceID === toolCallNodeID(submitted.id, "call_1") &&
        edge.targetID ===
          approvalNodeID(
            (
              approvalRequest as Extract<
                RuntimeEvent,
                { type: "approval.request" }
              >
            ).id,
          ) &&
        edge.kind === "approved_by",
    ),
  ).toBe(true);
  await client.dispose?.();
}, 60_000);

test("a rejected approval links to a rejected tool-call fact", async () => {
  const root = await workspace("approval-rejected");
  const events: RuntimeEvent[] = [];
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_wg_approval_rejected",
    permissionMode: "ask",
    provider: {
      provider: "test",
      model: "test",
      async *stream(request: ProviderStreamRequest) {
        if (
          request.messages.some(
            (message: { role: string }) => message.role === "tool",
          )
        ) {
          yield { type: "done" as const };
          return;
        }
        yield {
          type: "tool_call" as const,
          calls: [
            {
              id: "call_1",
              name: "write_file",
              arguments: JSON.stringify({
                path: "out.txt",
                content: "must not be written",
              }),
            },
          ],
        };
      },
    },
  });
  client.start((event) => {
    events.push(event);
    if (event.type === "approval.request")
      client.respondApproval({ requestID: event.id, decision: "reject" });
  });
  const submitted = await client.submit("do not approve this");

  const toolID = toolCallNodeID(submitted.id, "call_1");
  const tool = projectedWorkGraphNodes(events).find(
    (node) => node.nodeID === toolID,
  );
  expect(tool?.summary).toContain("rejected");

  const approvalRequest = events.find(
    (event): event is Extract<RuntimeEvent, { type: "approval.request" }> =>
      event.type === "approval.request",
  );
  expect(approvalRequest).toBeDefined();
  expect(
    projectedWorkGraphEdges(events).some(
      (edge) =>
        edge.sourceID === toolID &&
        edge.targetID === approvalNodeID(approvalRequest!.id) &&
        edge.kind === "rejected_by",
    ),
  ).toBe(true);
  await client.dispose?.();
}, 60_000);

test("read-only policy records the tool call as rejected", async () => {
  const root = await workspace("read-only");
  const events: RuntimeEvent[] = [];
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_wg_read_only",
    permissionMode: "read_only",
    provider: {
      provider: "test",
      model: "test",
      async *stream(request: ProviderStreamRequest) {
        if (
          request.messages.some(
            (message: { role: string }) => message.role === "tool",
          )
        ) {
          yield { type: "done" as const };
          return;
        }
        yield {
          type: "tool_call" as const,
          calls: [
            {
              id: "call_1",
              name: "write_file",
              arguments: JSON.stringify({
                path: "out.txt",
                content: "must not be written",
              }),
            },
          ],
        };
      },
    },
  });
  client.start((event) => events.push(event));
  const submitted = await client.submit("try a write in read-only mode");

  const tool = projectedWorkGraphNodes(events).find(
    (node) => node.nodeID === toolCallNodeID(submitted.id, "call_1"),
  );
  expect(tool?.summary).toContain("rejected");
  await client.dispose?.();
}, 60_000);

test("the episode id rides along as the graph's correlation field", async () => {
  // The ruling was explicit: `epi_*` participates in the existing node vocabulary
  // as a correlation field, with no parallel identity system. It arrives via the
  // same `publish()` stamp every other event gets, which is why nothing here has
  // to know about episodes.
  const root = await workspace("episode");
  await writeFile(join(root, "a.md"), "x\n");
  const events: RuntimeEvent[] = [];
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_wg_episode",
    episodeID: "epi_headless_1",
    permissionMode: "auto",
    provider: {
      provider: "test",
      model: "test",
      async *stream(request: ProviderStreamRequest) {
        if (
          request.messages.some(
            (message: { role: string }) => message.role === "tool",
          )
        ) {
          yield { type: "done" as const };
          return;
        }
        yield {
          type: "tool_call" as const,
          calls: [
            {
              id: "call_1",
              name: "read_file",
              arguments: JSON.stringify({ path: "a.md" }),
            },
          ],
        };
      },
    },
  });
  client.start((event) => events.push(event));
  await client.submit("read it");

  const nodes = projectedWorkGraphNodes(events);
  const edges = projectedWorkGraphEdges(events);
  expect(nodes.length).toBeGreaterThan(0);
  for (const fact of [...nodes, ...edges])
    expect(fact.episodeID).toBe("epi_headless_1");
  await client.dispose?.();
}, 60_000);

test("every emitted fact validates against the canonical WG1 schema", async () => {
  // `workGraphNodeSchema` / `workGraphEdgeSchema` existed but were referenced
  // nowhere, so they documented a vocabulary without enforcing it — which is how
  // this writer's first version shipped `AgentAction` instead of `agent_action`
  // and `authorized_by` instead of `approved_by`. Validating here makes the schema
  // the contract rather than decoration.
  const root = await workspace("schema");
  await writeFile(join(root, "a.md"), "x\n");
  const events: RuntimeEvent[] = [];
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_wg_schema",
    permissionMode: "auto",
    provider: {
      provider: "test",
      model: "test",
      async *stream(request: ProviderStreamRequest) {
        if (
          request.messages.some(
            (message: { role: string }) => message.role === "tool",
          )
        ) {
          yield { type: "done" as const };
          return;
        }
        yield {
          type: "tool_call" as const,
          calls: [
            {
              id: "call_1",
              name: "read_file",
              arguments: JSON.stringify({ path: "a.md" }),
            },
          ],
        };
      },
    },
  });
  client.start((event) => events.push(event));
  await client.submit("read it");

  const nodes = projectedWorkGraphNodes(events);
  const edges = projectedWorkGraphEdges(events);
  expect(nodes.length).toBeGreaterThan(0);
  expect(edges.length).toBeGreaterThan(0);

  for (const node of nodes) {
    // The schema names the node identity `id`; the journal event carries it as
    // `nodeID` plus its own event `id`.
    const parsed = workGraphNodeSchema.safeParse({
      ...node,
      id: node.nodeID,
    });
    expect(parsed.success).toBe(true);
  }
  for (const edge of edges) {
    const parsed = workGraphEdgeSchema.safeParse(edge);
    expect(parsed.success).toBe(true);
  }
  await client.dispose?.();
}, 60_000);

test("a workspace change is attributable to the call and turn that made it", async () => {
  // This is the question the Work Graph exists to answer: why did this file
  // change, and who authorized it.
  const root = await workspace("change");
  const events: RuntimeEvent[] = [];
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_wg_change",
    permissionMode: "auto",
    provider: {
      provider: "test",
      model: "test",
      async *stream(request: ProviderStreamRequest) {
        if (
          request.messages.some(
            (message: { role: string }) => message.role === "tool",
          )
        ) {
          yield { type: "done" as const };
          return;
        }
        yield {
          type: "tool_call" as const,
          calls: [
            {
              id: "call_1",
              name: "write_file",
              arguments: JSON.stringify({
                path: "notes.md",
                content: "SECRETFILEBODY",
              }),
            },
          ],
        };
      },
    },
  });
  client.start((event) => events.push(event));
  const submitted = await client.submit("write the notes");

  const nodes = projectedWorkGraphNodes(events);
  const change = nodes.find((node) => node.kind === "workspace_change");
  expect(change).toMatchObject({
    target: "notes.md",
    actor: "write_file",
    turnID: submitted.id,
  });

  // Walk the chain a reader would: change -> call -> turn.
  const edges = projectedWorkGraphEdges(events);
  const modified = edges.find(
    (edge) => edge.kind === "modified" && edge.targetID === change!.nodeID,
  );
  expect(modified?.sourceID).toBe(toolCallNodeID(submitted.id, "call_1"));
  expect(
    edges.some(
      (edge) =>
        edge.kind === "caused" &&
        edge.sourceID === agentActionNodeID(submitted.id) &&
        edge.targetID === modified!.sourceID,
    ),
  ).toBe(true);

  // The path is the fact; the content written is not.
  const graph = JSON.stringify([...nodes, ...edges]);
  expect(graph).toContain("notes.md");
  expect(graph).not.toContain("SECRETFILEBODY");
  await client.dispose?.();
}, 60_000);

test("a write that failed records no workspace change", async () => {
  // A graph that claims a change which never happened sends a reader looking for
  // something that is not there.
  const root = await workspace("change-failed");
  const events: RuntimeEvent[] = [];
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_wg_change_failed",
    permissionMode: "auto",
    provider: {
      provider: "test",
      model: "test",
      async *stream(request: ProviderStreamRequest) {
        if (
          request.messages.some(
            (message: { role: string }) => message.role === "tool",
          )
        ) {
          yield { type: "done" as const };
          return;
        }
        yield {
          type: "tool_call" as const,
          calls: [
            {
              id: "call_1",
              name: "write_file",
              arguments: JSON.stringify({
                path: "../outside-the-workspace.md",
                content: "nope",
              }),
            },
          ],
        };
      },
    },
  });
  client.start((event) => events.push(event));
  await client.submit("write outside the workspace");

  const nodes = projectedWorkGraphNodes(events);
  expect(nodes.some((node) => node.kind === "workspace_change")).toBe(false);
  // The attempt is still recorded as a settled call.
  expect(nodes.some((node) => node.kind === "tool_call")).toBe(true);
  await client.dispose?.();
}, 60_000);

test("a write that throws during execution records no workspace change", async () => {
  // The previous test is blocked by policy before the tool runs. This one reaches
  // the tool and fails inside it, which is a different code path — mutation
  // testing showed the policy case alone did not cover it.
  const root = await workspace("change-threw");
  await mkdir(join(root, "occupied"), { recursive: true });
  const events: RuntimeEvent[] = [];
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_wg_change_threw",
    permissionMode: "auto",
    provider: {
      provider: "test",
      model: "test",
      async *stream(request: ProviderStreamRequest) {
        if (
          request.messages.some(
            (message: { role: string }) => message.role === "tool",
          )
        ) {
          yield { type: "done" as const };
          return;
        }
        yield {
          type: "tool_call" as const,
          calls: [
            {
              id: "call_1",
              name: "write_file",
              // A directory already occupies this path, so the write throws.
              arguments: JSON.stringify({
                path: "occupied",
                content: "nope",
              }),
            },
          ],
        };
      },
    },
  });
  client.start((event) => events.push(event));
  const submitted = await client.submit("write onto a directory");

  const nodes = projectedWorkGraphNodes(events);
  const tool = nodes.find(
    (node) => node.nodeID === toolCallNodeID(submitted.id, "call_1"),
  );
  // The call is recorded as failed, and no change is claimed.
  expect(tool?.summary).toContain("failed");
  expect(nodes.some((node) => node.kind === "workspace_change")).toBe(false);
  await client.dispose?.();
}, 60_000);

test("a read records no workspace change", async () => {
  const root = await workspace("change-read");
  await writeFile(join(root, "a.md"), "x\n");
  const events: RuntimeEvent[] = [];
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_wg_change_read",
    permissionMode: "auto",
    provider: {
      provider: "test",
      model: "test",
      async *stream(request: ProviderStreamRequest) {
        if (
          request.messages.some(
            (message: { role: string }) => message.role === "tool",
          )
        ) {
          yield { type: "done" as const };
          return;
        }
        yield {
          type: "tool_call" as const,
          calls: [
            {
              id: "call_1",
              name: "read_file",
              arguments: JSON.stringify({ path: "a.md" }),
            },
          ],
        };
      },
    },
  });
  client.start((event) => events.push(event));
  await client.submit("read it");
  expect(
    projectedWorkGraphNodes(events).some(
      (node) => node.kind === "workspace_change",
    ),
  ).toBe(false);
  await client.dispose?.();
}, 60_000);
