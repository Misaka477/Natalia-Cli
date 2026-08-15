import { mkdir, mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { expect, test } from "bun:test";
import { createRealRuntimeClient } from "../src";
import type { RuntimeEvent, SessionID } from "@natalia/contracts";
import type {
  ProviderStreamRequest,
  StreamingProvider,
} from "@natalia/runtime";
import { providerError } from "@natalia/runtime";
import { CapabilityRegistry } from "@natalia/capability";
import { createToolRegistry } from "@natalia/tools";
import { getPluginCommands } from "@natalia/plugin";
import { resolveConfig } from "@natalia/config";
import { SqliteSessionStore } from "@natalia/session";
import { WorkspaceSandboxManager } from "@natalia/sandbox";
import { NativeTerminalRegistry } from "@natalia/native-terminal";
import { NataliaTaskStateStore } from "@natalia/workflow";
import {
  installPluginSdkLinks,
  pluginSdkImportPath,
} from "./plugin-test-helpers";
import { projectedWorkGraphEdges } from "@natalia/session";
import { toolCallNodeID } from "../src/work-graph";

test("real runtime client streams provider output and persists replayable session", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-ts7-real-"));
  const events: RuntimeEvent[] = [];
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_ts7_real",
    provider: scriptedProvider("hello from provider"),
  });
  client.start((event) => {
    events.push(event);
    if (event.type === "approval.request")
      client.respondApproval({ requestID: event.id, decision: "once" });
  });

  await client.submit("Say hello");

  expect(events.map((event) => event.type)).toEqual(
    expect.arrayContaining([
      "session.created",
      "session.ready",
      "turn.submitted",
      "checkpoint.created",
      "content.delta",
      "content.done",
      "turn.finished",
    ]),
  );
  expect(
    events
      .filter((event) => event.type === "content.delta")
      .map((event) => event.text)
      .join(""),
  ).toBe("hello from provider");
  const persisted = JSON.parse(
    await readFile(
      join(root, ".natalia", "sessions", "ses_ts7_real.json"),
      "utf8",
    ),
  ) as { events: RuntimeEvent[]; inbox?: Array<Record<string, unknown>> };
  expect(
    persisted.events.some((event) => event.type === "turn.submitted"),
  ).toBe(true);

  const replay: RuntimeEvent[] = [];
  const reopened = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_ts7_real",
    provider: scriptedProvider("unused"),
  });
  reopened.start((event) => replay.push(event));
  await waitFor(() => replay.some((event) => event.type === "session.ready"));
  expect(
    replay.some(
      (event) =>
        event.type === "content.done" && event.text === "hello from provider",
    ),
  ).toBe(true);
});

test("flow_module_complete is only advertised to an active task module runtime", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-task-module-runtime-"));
  const store = await NataliaTaskStateStore.open(root);
  store.startInvocation({
    invocationID: "inv_1",
    taskID: "task_1",
    episodeID: "epi_1" as import("@natalia/contracts").EpisodeID,
    sessionID: "ses_1" as SessionID,
  });
  store.activateModule({
    invocationID: "inv_1",
    attempt: 1,
    flowID: "flow_1",
    moduleID: "read",
    conditionIDs: ["c1"],
  });
  store.recordModuleEvidence({
    invocationID: "inv_1",
    attempt: 1,
    flowID: "flow_1",
    moduleID: "read",
    ref: "tool:read:1",
  });
  const seenTools: string[][] = [];
  const provider: StreamingProvider = {
    provider: "task-module",
    model: "task-module-model",
    async *stream(request) {
      seenTools.push((request.tools ?? []).map((tool) => tool.name));
      if (!request.messages.some((message) => message.role === "tool"))
        yield {
          type: "tool_call" as const,
          calls: [
            {
              id: "complete",
              name: "flow_module_complete",
              arguments: JSON.stringify({
                flowID: "flow_1",
                moduleID: "read",
                conditionStatuses: [{ id: "c1", status: "satisfied" }],
                evidenceRefs: ["tool:read:1"],
                gaps: [],
                recommendedAction: "Evaluate the claim.",
              }),
            },
          ],
        };
      yield { type: "done" as const };
    },
  };
  const events: RuntimeEvent[] = [];
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_task_module" as SessionID,
    provider,
    taskModuleContext: {
      store,
      invocationID: "inv_1",
      attempt: 1,
      flowID: "flow_1",
      moduleID: "read",
      moduleType: "read_search",
    },
  });
  client.start((event) => events.push(event));
  await client.submit("complete module");
  expect(seenTools[0]).toContain("flow_module_complete");
  expect(events).toContainEqual(
    expect.objectContaining({
      type: "tool.update",
      name: "flow_module_complete",
      status: "succeeded",
    }),
  );
  expect(store.moduleEvents("inv_1", 1)).toContainEqual(
    expect.objectContaining({ kind: "flow.module_claimed" }),
  );
  expect(store.getWaterline("task_1")).toBeUndefined();
  await client.dispose?.();
  store.close();
});

test("task runtime injects only its active module instructions", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-task-module-prompt-"));
  const store = await NataliaTaskStateStore.open(root);
  store.startInvocation({
    invocationID: "inv_1",
    taskID: "task_1",
    episodeID: "epi_1" as import("@natalia/contracts").EpisodeID,
    sessionID: "ses_1" as SessionID,
  });
  store.activateModule({
    invocationID: "inv_1",
    attempt: 1,
    flowID: "flow_1",
    moduleID: "read",
    conditionIDs: [],
  });
  let taskSystemPrompt = "";
  const taskClient = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_task_module_prompt" as SessionID,
    taskModuleContext: {
      store,
      invocationID: "inv_1",
      attempt: 1,
      flowID: "flow_1",
      moduleID: "read",
      moduleType: "read_search",
      moduleInstructions: "Read only the authentication files.",
      moduleContinuation:
        '{"gaps":["Inspect the access redirect"],"forbiddenRepeats":["Do not re-read the index"]}',
    },
    provider: {
      provider: "task-module-prompt",
      model: "task-module-prompt-model",
      async *stream(request) {
        taskSystemPrompt = String(request.messages[0]?.content);
        yield { type: "done" as const };
      },
    },
  });
  taskClient.start(() => undefined);
  await taskClient.submit("begin");
  expect(taskSystemPrompt).toContain("<active_flow_module_instructions>");
  expect(taskSystemPrompt).toContain("Read only the authentication files.");
  expect(taskSystemPrompt).toContain("<active_flow_module_continuation>");
  expect(taskSystemPrompt).toContain("Inspect the access redirect");
  await taskClient.dispose?.();

  let ordinarySystemPrompt = "";
  const ordinaryClient = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_ordinary_module_prompt" as SessionID,
    provider: {
      provider: "ordinary-module-prompt",
      model: "ordinary-module-prompt-model",
      async *stream(request) {
        ordinarySystemPrompt = String(request.messages[0]?.content);
        yield { type: "done" as const };
      },
    },
  });
  ordinaryClient.start(() => undefined);
  await ordinaryClient.submit("begin");
  expect(ordinarySystemPrompt).not.toContain("active_flow_module_instructions");
  expect(ordinarySystemPrompt).not.toContain(
    "Read only the authentication files.",
  );
  expect(ordinarySystemPrompt).not.toContain("active_flow_module_continuation");
  await ordinaryClient.dispose?.();
  store.close();
});

test("ordinary runtime never advertises flow_module_complete", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-ordinary-runtime-"));
  const seenTools: string[][] = [];
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_ordinary" as SessionID,
    provider: {
      provider: "ordinary",
      model: "ordinary-model",
      async *stream(request) {
        seenTools.push((request.tools ?? []).map((tool) => tool.name));
        yield { type: "done" as const };
      },
    },
  });
  client.start(() => undefined);
  await client.submit("hello");
  expect(seenTools[0]).not.toContain("flow_module_complete");
  await client.dispose?.();
});

test("task module policy denies tools outside the active capability bundle", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-task-module-policy-"));
  const store = await NataliaTaskStateStore.open(root);
  store.startInvocation({
    invocationID: "inv_1",
    taskID: "task_1",
    episodeID: "epi_1" as import("@natalia/contracts").EpisodeID,
    sessionID: "ses_1" as SessionID,
  });
  store.activateModule({
    invocationID: "inv_1",
    attempt: 1,
    flowID: "flow_1",
    moduleID: "read",
    conditionIDs: [],
  });
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_task_policy" as SessionID,
    taskModuleContext: {
      store,
      invocationID: "inv_1",
      attempt: 1,
      flowID: "flow_1",
      moduleID: "read",
      moduleType: "read_search",
    },
    provider: {
      provider: "module-policy",
      model: "module-policy-model",
      async *stream(request) {
        if (!request.messages.some((message) => message.role === "tool"))
          yield {
            type: "tool_call" as const,
            calls: [
              {
                id: "outside_module",
                name: "run_shell",
                arguments: JSON.stringify({ command: "pwd" }),
              },
            ],
          };
        yield { type: "done" as const };
      },
    },
  });
  const events: RuntimeEvent[] = [];
  client.start((event) => events.push(event));
  await client.submit("run shell");
  expect(events).toContainEqual(
    expect.objectContaining({
      type: "policy.decision",
      toolName: "run_shell",
      decision: "deny",
      reason: expect.stringContaining("outside active read_search module"),
    }),
  );
  expect(events).toContainEqual(
    expect.objectContaining({
      type: "tool.update",
      name: "run_shell",
      status: "failed",
    }),
  );
  await client.dispose?.();
  store.close();
});

test("task module command rules further restrict shell tools", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-task-module-command-"));
  const store = await NataliaTaskStateStore.open(root);
  store.startInvocation({
    invocationID: "inv_1",
    taskID: "task_1",
    episodeID: "epi_1" as import("@natalia/contracts").EpisodeID,
    sessionID: "ses_1" as SessionID,
  });
  store.activateModule({
    invocationID: "inv_1",
    attempt: 1,
    flowID: "flow_1",
    moduleID: "shell",
    conditionIDs: [],
  });
  const events: RuntimeEvent[] = [];
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_task_module_command" as SessionID,
    taskModuleContext: {
      store,
      invocationID: "inv_1",
      attempt: 1,
      flowID: "flow_1",
      moduleID: "shell",
      moduleType: "shell_command",
      moduleCommandRules: {
        mode: "whitelist",
        rules: [{ command: "git diff" }],
      },
    },
    provider: {
      provider: "module-command-policy",
      model: "module-command-policy-model",
      async *stream(request) {
        if (!request.messages.some((message) => message.role === "tool"))
          yield {
            type: "tool_call" as const,
            calls: [
              {
                id: "blocked_shell",
                name: "run_shell",
                arguments: JSON.stringify({ command: "git status" }),
              },
            ],
          };
        yield { type: "done" as const };
      },
    },
  });
  client.start((event) => events.push(event));
  await client.submit("inspect status");
  expect(events).toContainEqual(
    expect.objectContaining({
      type: "policy.decision",
      toolName: "run_shell",
      decision: "deny",
      reason: expect.stringContaining("active module allow rule"),
    }),
  );
  expect(events).toContainEqual(
    expect.objectContaining({
      type: "tool.update",
      name: "run_shell",
      status: "failed",
    }),
  );
  await client.dispose?.();
  store.close();
});

test("task module extensions deny extension tools before execution", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-task-module-extension-"));
  const store = await NataliaTaskStateStore.open(root);
  store.startInvocation({
    invocationID: "inv_1",
    taskID: "task_1",
    episodeID: "epi_1" as import("@natalia/contracts").EpisodeID,
    sessionID: "ses_1" as SessionID,
  });
  store.activateModule({
    invocationID: "inv_1",
    attempt: 1,
    flowID: "flow_1",
    moduleID: "mcp",
    conditionIDs: [],
  });
  const tools = createToolRegistry([]);
  let executed = false;
  tools.set("mcp_docs_echo", {
    name: "mcp_docs_echo",
    description: "test MCP tool",
    requiresApproval: false,
    parameters: { type: "object", properties: {} },
    async execute() {
      executed = true;
      return "unexpected";
    },
  });
  const events: RuntimeEvent[] = [];
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_task_module_extension" as SessionID,
    tools,
    permissionMode: "auto",
    taskModuleContext: {
      store,
      invocationID: "inv_1",
      attempt: 1,
      flowID: "flow_1",
      moduleID: "mcp",
      moduleType: "mcp",
      moduleExtensions: { mcp: false },
    },
    provider: {
      provider: "module-extension-policy",
      model: "module-extension-policy-model",
      async *stream(request) {
        if (!request.messages.some((message) => message.role === "tool"))
          yield {
            type: "tool_call" as const,
            calls: [{ id: "mcp", name: "mcp_docs_echo", arguments: "{}" }],
          };
        yield { type: "done" as const };
      },
    },
  });
  client.start((event) => events.push(event));
  await client.submit("use MCP");

  expect(executed).toBe(false);
  expect(events).toContainEqual(
    expect.objectContaining({
      type: "policy.decision",
      toolName: "mcp_docs_echo",
      decision: "deny",
      reason: "mcp extensions are disabled by active module",
    }),
  );
  await client.dispose?.();
  store.close();
});

test("task module path scope denies writes outside the allowed workspace scope", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-task-module-path-"));
  const store = await NataliaTaskStateStore.open(root);
  store.startInvocation({
    invocationID: "inv_1",
    taskID: "task_1",
    episodeID: "epi_1" as import("@natalia/contracts").EpisodeID,
    sessionID: "ses_1" as SessionID,
  });
  store.activateModule({
    invocationID: "inv_1",
    attempt: 1,
    flowID: "flow_1",
    moduleID: "write",
    conditionIDs: [],
  });
  const events: RuntimeEvent[] = [];
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_task_module_path" as SessionID,
    permissionMode: "auto",
    taskModuleContext: {
      store,
      invocationID: "inv_1",
      attempt: 1,
      flowID: "flow_1",
      moduleID: "write",
      moduleType: "workspace_changes",
      modulePermissions: {
        files: {
          writePaths: [{ pattern: "docs/**", allow: true }],
          readPaths: [],
        },
      },
    },
    provider: {
      provider: "module-path-policy",
      model: "module-path-policy-model",
      async *stream(request) {
        if (!request.messages.some((message) => message.role === "tool"))
          yield {
            type: "tool_call" as const,
            calls: [
              {
                id: "write_outside",
                name: "write_file",
                arguments: JSON.stringify({ path: "src/leak.ts" }),
              },
            ],
          };
        yield { type: "done" as const };
      },
    },
  });
  client.start((event) => events.push(event));
  await client.submit("write outside scope");

  expect(events).toContainEqual(
    expect.objectContaining({
      type: "policy.decision",
      toolName: "write_file",
      decision: "deny",
      reason: expect.stringContaining("outside the allowed module scope"),
    }),
  );
  expect(events).toContainEqual(
    expect.objectContaining({
      type: "tool.update",
      name: "write_file",
      status: "failed",
    }),
  );
  await client.dispose?.();
  store.close();
});

test("task module records successful tool calls as attempt-scoped evidence", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-task-evidence-runtime-"));
  await writeFile(join(root, "note.txt"), "evidence");
  const store = await NataliaTaskStateStore.open(root);
  store.startInvocation({
    invocationID: "inv_1",
    taskID: "task_1",
    episodeID: "epi_1" as import("@natalia/contracts").EpisodeID,
    sessionID: "ses_1" as SessionID,
  });
  store.activateModule({
    invocationID: "inv_1",
    attempt: 1,
    flowID: "flow_1",
    moduleID: "read",
    conditionIDs: ["c1"],
  });
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_task_evidence" as SessionID,
    taskModuleContext: {
      store,
      invocationID: "inv_1",
      attempt: 1,
      flowID: "flow_1",
      moduleID: "read",
      moduleType: "read_search",
    },
    provider: {
      provider: "task-evidence",
      model: "task-evidence-model",
      async *stream(request) {
        if (!request.messages.some((message) => message.role === "tool"))
          yield {
            type: "tool_call" as const,
            calls: [
              {
                id: "read_note",
                name: "read_file",
                arguments: JSON.stringify({ path: "note.txt" }),
              },
            ],
          };
        yield { type: "done" as const };
      },
    },
  });
  client.start(() => undefined);
  await client.submit("read note");
  store.claimModule({
    invocationID: "inv_1",
    attempt: 1,
    claim: {
      flowID: "flow_1",
      moduleID: "read",
      conditionStatuses: [{ id: "c1", status: "satisfied" }],
      evidenceRefs: ["tool:read_note"],
      gaps: [],
      recommendedAction: "Evaluate.",
    },
  });
  expect(store.moduleEvents("inv_1", 1)).toContainEqual(
    expect.objectContaining({ kind: "flow.module_claimed" }),
  );
  await client.dispose?.();
  store.close();
});

test("runtime can suppress startup event replay for paged UI hydration", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-runtime-paged-replay-"));
  const sessionID = "ses_runtime_paged_replay" as SessionID;
  const initial = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID,
    provider: scriptedProvider("paged response"),
  });
  initial.start(() => undefined);
  await initial.submit("persist history");
  await initial.dispose?.();

  const replay: RuntimeEvent[] = [];
  const reopened = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID,
    provider: scriptedProvider("unused"),
  });
  reopened.start((event) => replay.push(event), { replay: "none" });
  await waitFor(() => replay.some((event) => event.type === "session.ready"));
  expect(replay.some((event) => event.type === "content.done")).toBe(false);
  const page = await reopened.messages?.({ limit: 1 });
  expect(page?.data[0]?.rows).toContainEqual(
    expect.objectContaining({
      event: expect.objectContaining({
        type: "content.done",
        text: "paged response",
      }),
    }),
  );
  await reopened.dispose?.();
});

test("SQLite runtime message pages use the durable turn cursor", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-sqlite-message-page-"));
  const sessionID = "ses_sqlite_message_page" as SessionID;
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID,
    provider: scriptedProvider("reply"),
    useSqliteStore: true,
  });
  client.start(() => undefined);
  for (const prompt of ["one", "two", "three"]) await client.submit(prompt);

  const latest = await client.messages?.({ limit: 2 });
  expect(latest?.data.map((message) => message.submitted.text)).toEqual([
    "three",
    "two",
  ]);
  const older = await client.messages?.({ cursor: latest?.cursor.next });
  expect(older?.data.map((message) => message.submitted.text)).toEqual(["one"]);
  await client.dispose?.();
});

test("SQLite runtime persists durable events without growing the JSON mirror", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-sqlite-authority-"));
  const sessionID = "ses_sqlite_authority" as SessionID;
  const initial = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID,
    provider: scriptedProvider("durable SQLite reply"),
    useSqliteStore: true,
  });
  initial.start(() => undefined);
  await initial.submit("persist only in SQLite");
  await initial.dispose?.();

  await expect(
    readFile(join(root, ".natalia", "sessions", `${sessionID}.json`), "utf8"),
  ).rejects.toMatchObject({ code: "ENOENT" });

  const replayed: RuntimeEvent[] = [];
  const reopened = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID,
    provider: scriptedProvider("unused"),
    useSqliteStore: true,
  });
  reopened.start((event) => replayed.push(event));
  await waitFor(() => replayed.some((event) => event.type === "session.ready"));
  expect(
    replayed.some(
      (event) =>
        event.type === "content.done" && event.text === "durable SQLite reply",
    ),
  ).toBe(true);
  await reopened.dispose?.();
});

test("runtime correlates durable events with an episode without changing session replay", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-episode-runtime-"));
  const sessionID = "ses_episode_runtime" as SessionID;
  const episodeID =
    "epi_episode_runtime" as import("@natalia/contracts").EpisodeID;
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID,
    episodeID,
    provider: scriptedProvider("episode response"),
    useSqliteStore: true,
  });
  client.start(() => undefined);
  await client.submit("record an episode");
  await client.dispose?.();

  const replay: RuntimeEvent[] = [];
  const reopened = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID,
    provider: scriptedProvider("unused"),
    useSqliteStore: true,
  });
  reopened.start((event) => replay.push(event));
  await waitFor(() => replay.some((event) => event.type === "session.ready"));
  const durable = replay.filter(
    (event) =>
      event.type === "turn.submitted" || event.type === "turn.finished",
  );
  expect(durable).not.toHaveLength(0);
  expect(durable.every((event) => event.episodeID === episodeID)).toBe(true);
  await reopened.dispose?.();
});

test("runtime status and diagnostics expose only published safe state", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-runtime-status-"));
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_runtime_status",
    provider: scriptedProvider("ready"),
  });
  const events: RuntimeEvent[] = [];
  client.start((event) => events.push(event));
  client.diagnostic("provider key is configured", "info");
  const status = await client.runtimeStatus?.();
  const diagnostics = await client.diagnostics?.(1);
  expect(status).toMatchObject({
    type: "status.snapshot",
    model: "scripted-model",
    permissions: "ask",
  });
  expect(diagnostics).toMatchObject([
    {
      level: "info",
      message: "provider key is configured",
      at: expect.any(String),
    },
  ]);
});

test("runtime status reports the active approval mode", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-runtime-permissions-"));
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_runtime_permissions",
    provider: scriptedProvider("ready"),
    permissionMode: "auto",
  });
  client.start(() => undefined);

  expect(await client.runtimeStatus?.()).toMatchObject({
    type: "status.snapshot",
    permissions: "auto",
  });
});

test("runtime status reflects the configured auto approval profile", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-runtime-profile-"));
  await mkdir(join(root, ".natalia"), { recursive: true });
  await writeFile(
    join(root, ".natalia", "config.json"),
    JSON.stringify({
      version: 2,
      defaultPermission: "trusted",
      permissionProfiles: {
        trusted: { approval: "auto", description: "Trusted workspace" },
      },
    }),
  );
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_runtime_profile",
    provider: scriptedProvider("ready"),
  });
  client.start(() => undefined);

  expect(await client.runtimeStatus?.()).toMatchObject({
    type: "status.snapshot",
    permissions: "auto",
  });
});

test("a tool with an output definition projects its result into the event", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-runtime-tool-render-"));
  await mkdir(join(root, ".natalia"), { recursive: true });
  await writeFile(join(root, "note.txt"), "projected content");
  const events: RuntimeEvent[] = [];
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_runtime_tool_render",
    provider: {
      provider: "tool-render",
      model: "tool-render-model",
      async *stream(request) {
        if (!request.messages.some((message) => message.role === "tool"))
          yield {
            type: "tool_call" as const,
            calls: [
              {
                id: "call_read",
                name: "read_file",
                arguments: JSON.stringify({ path: "note.txt" }),
              },
            ],
          };
        yield { type: "done" as const };
      },
    },
  });
  client.start((event) => events.push(event));
  await client.submit("read the note");
  const update = events.find(
    (event): event is Extract<RuntimeEvent, { type: "tool.update" }> =>
      event.type === "tool.update" && event.status === "succeeded",
  );
  expect(update).toBeDefined();
  // read_file declares an output definition, so its card travels with the event
  // and a client renders it without reclassifying the string.
  expect(update!.metadata?.render).toMatchObject({
    kind: "read",
    title: "note.txt",
    body: "projected content",
  });
  // The running event carried the call card the tool projected, so the running
  // card is the call's presentation (a file path), not a raw argument dump.
  const running = events.find(
    (event): event is Extract<RuntimeEvent, { type: "tool.update" }> =>
      event.type === "tool.update" && event.status === "running",
  );
  expect(running?.metadata?.call).toMatchObject({
    kind: "read",
    title: "note.txt",
    summary: "read",
  });
  await client.dispose?.();
}, 60_000);

test("the runtime config is a kernel service refreshed on reload", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-runtime-config-service-"));
  await mkdir(join(root, ".natalia"), { recursive: true });
  await writeFile(
    join(root, ".natalia", "config.json"),
    JSON.stringify({ version: 2, defaultPermission: "ask" }),
  );
  const kernel = new CapabilityRegistry();
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_runtime_config_service",
    capabilityRegistry: kernel,
    provider: scriptedProvider("ready"),
  });
  client.start(() => undefined);
  await waitFor(
    () => kernel.service("runtime.config") !== undefined,
    10_000,
    "the runtime config service to be provided",
  );

  // By-name resolution: any capability can read the resolved config.
  const first = kernel.service<{ defaultPermission?: string }>(
    "runtime.config",
  );
  expect(first?.defaultPermission).toBe("ask");
  expect(kernel.ownerOf("services", "runtime.config")).toBe(
    "natalia-runtime-config",
  );

  // A config reload replaces the service and notifies subscribers.
  const updates: Array<{ name: string; providerBefore?: string }> = [];
  const unsubscribe = kernel.onServiceUpdate((update) => updates.push(update));
  await writeFile(
    join(root, ".natalia", "config.json"),
    JSON.stringify({ version: 2, defaultPermission: "auto" }),
  );
  // Reload applies on demand, and the refresh replaces the service in place.
  await client.reloadConfig?.();
  await waitFor(() => {
    const current = kernel.service<{ defaultPermission?: string }>(
      "runtime.config",
    );
    return current?.defaultPermission === "auto";
  });
  expect(
    kernel.service<{ defaultPermission?: string }>("runtime.config")
      ?.defaultPermission,
  ).toBe("auto");
  expect(
    updates.some(
      (update) =>
        update.name === "runtime.config" &&
        update.providerBefore === "natalia-runtime-config",
    ),
  ).toBe(true);
  unsubscribe();
  await client.dispose?.();
}, 60_000);

test("tools.enabled=false keeps a family out of the runtime catalogue", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-runtime-tools-enabled-"));
  await mkdir(join(root, ".natalia"), { recursive: true });
  await writeFile(
    join(root, ".natalia", "config.json"),
    JSON.stringify({ version: 2, tools: { enabled: { todo: false } } }),
  );
  const events: RuntimeEvent[] = [];
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_runtime_tools_enabled",
    provider: scriptedProvider("ready"),
  });
  client.start((event) => events.push(event));
  await waitFor(() => events.some((event) => event.type === "session.ready"));
  const registered = events.filter(
    (event): event is Extract<RuntimeEvent, { type: "tool.registered" }> =>
      event.type === "tool.registered",
  );
  // The disabled family never appears in the catalogue...
  expect(
    registered.some(
      (event) => event.name.startsWith("todo_") || event.name === "plan",
    ),
  ).toBe(false);
  // ...and the rest of the families do.
  expect(registered.some((event) => event.name === "read_file")).toBe(true);
  await client.dispose?.();
}, 60_000);

test("read-only profile rejects side-effecting tools without an approval request", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-runtime-read-only-"));
  await mkdir(join(root, ".natalia"), { recursive: true });
  await writeFile(
    join(root, ".natalia", "config.json"),
    JSON.stringify({
      version: 2,
      defaultPermission: "safe",
      permissionProfiles: {
        safe: { approval: "read_only", description: "Read-only workspace" },
      },
    }),
  );
  const events: RuntimeEvent[] = [];
  const requests: ProviderStreamRequest[] = [];
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_runtime_read_only",
    provider: {
      provider: "test",
      model: "test",
      async *stream(request) {
        requests.push(request);
        if (!request.messages.some((message) => message.role === "tool"))
          yield {
            type: "tool_call" as const,
            calls: [
              {
                id: "write",
                name: "write_file",
                arguments: JSON.stringify({
                  path: "hello-ts7.txt",
                  content: "blocked",
                }),
              },
            ],
          };
        yield { type: "done" as const };
      },
    },
  });
  client.start((event) => events.push(event));
  await client.submit("write a file");

  expect(await client.runtimeStatus?.()).toMatchObject({
    type: "status.snapshot",
    permissions: "read_only",
  });
  expect(requests[0]?.tools?.map((tool) => tool.name)).not.toContain(
    "write_file",
  );
  expect(events).toContainEqual(
    expect.objectContaining({
      type: "tool.update",
      name: "write_file",
      status: "failed",
      summary: "Unknown tool: write_file",
    }),
  );
  expect(events.some((event) => event.type === "approval.request")).toBe(false);
  await expect(
    readFile(join(root, "hello-ts7.txt"), "utf8"),
  ).rejects.toMatchObject({
    code: "ENOENT",
  });
});

test("selected permission profile denies tools outside its allow list before approval", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-runtime-profile-allow-"));
  await mkdir(join(root, ".natalia"), { recursive: true });
  await writeFile(
    join(root, ".natalia", "config.json"),
    JSON.stringify({
      version: 2,
      permissionProfiles: {
        unattended_read: {
          approval: "auto",
          description: "Read-only unattended inspection",
          permissions: {
            tools: { allow: ["read_file", "web_fetch"] },
            files: {
              readPaths: [
                { pattern: "allowed.txt", allow: false, reason: "protected" },
              ],
            },
            network: { allowLocalhost: false },
          },
        },
      },
    }),
  );
  const events: RuntimeEvent[] = [];
  const requests: ProviderStreamRequest[] = [];
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_runtime_profile_allow",
    permissionProfile: "unattended_read",
    provider: {
      provider: "test",
      model: "test",
      async *stream(request) {
        requests.push(request);
        if (!request.messages.some((message) => message.role === "tool"))
          yield {
            type: "tool_call" as const,
            calls: [
              {
                id: "write",
                name: "write_file",
                arguments: JSON.stringify({
                  path: "blocked.txt",
                  content: "blocked",
                }),
              },
              {
                id: "network",
                name: "web_fetch",
                arguments: JSON.stringify({ url: "http://127.0.0.1:9" }),
              },
            ],
          };
        yield { type: "done" as const };
      },
    },
  });
  client.start((event) => events.push(event));
  await client.submit("inspect only");

  expect(requests[0]?.tools?.map((tool) => tool.name)).toEqual([
    "read_file",
    "web_fetch",
  ]);
  expect(events).toContainEqual(
    expect.objectContaining({
      type: "policy.decision",
      toolName: "write_file",
      decision: "deny",
      reason: "tool is excluded from the runtime catalog by policy",
    }),
  );
  expect(events.some((event) => event.type === "approval.request")).toBe(false);
  const history = await client.history!({ limit: 100 });
  expect(history.events).toContainEqual(
    expect.objectContaining({
      event: expect.objectContaining({
        type: "policy.decision",
        toolName: "write_file",
        decision: "deny",
      }),
    }),
  );
  expect(
    events
      .filter(
        (event): event is Extract<RuntimeEvent, { type: "tool.update" }> =>
          event.type === "tool.update" && event.name === "web_fetch",
      )
      .map((event) => event.result ?? "")
      .join(" "),
  ).toContain("localhost network access is not allowed");
});

test("selected permission profile applies file rules to allowed tools", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-runtime-profile-files-"));
  await mkdir(join(root, ".natalia"), { recursive: true });
  await writeFile(join(root, "allowed.txt"), "allowed");
  await writeFile(join(root, "protected.txt"), "protected");
  await writeFile(
    join(root, ".natalia", "config.json"),
    JSON.stringify({
      version: 2,
      permissionProfiles: {
        unattended_read: {
          approval: "auto",
          description: "Read-only unattended inspection",
          permissions: {
            tools: { allow: ["read_file"] },
            files: {
              readPaths: [
                { pattern: "protected.txt", allow: false, reason: "protected" },
              ],
            },
          },
        },
      },
    }),
  );
  const events: RuntimeEvent[] = [];
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_runtime_profile_files",
    permissionProfile: "unattended_read",
    provider: {
      provider: "test",
      model: "test",
      async *stream(request) {
        if (!request.messages.some((message) => message.role === "tool"))
          yield {
            type: "tool_call" as const,
            calls: [
              {
                id: "read",
                name: "read_file",
                arguments: JSON.stringify({ path: "protected.txt" }),
              },
            ],
          };
        yield { type: "done" as const };
      },
    },
  });
  client.start((event) => events.push(event));
  await client.submit("inspect protected file");

  expect(events).toContainEqual(
    expect.objectContaining({
      type: "policy.decision",
      toolName: "read_file",
      decision: "deny",
      reason: 'read of "protected.txt" blocked: protected',
    }),
  );
  expect(events.some((event) => event.type === "approval.request")).toBe(false);
});

test("unknown selected permission profile reports a configuration error", async () => {
  const root = await mkdtemp(
    join(tmpdir(), "natalia-runtime-profile-missing-"),
  );
  const events: RuntimeEvent[] = [];
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_runtime_profile_missing",
    permissionProfile: "missing",
    provider: scriptedProvider("ready"),
  });
  client.start((event) => events.push(event));
  await waitFor(() =>
    events.some(
      (event) =>
        event.type === "diagnostic" &&
        event.message.includes("permission profile not found: missing"),
    ),
  );
  expect(events).toContainEqual(
    expect.objectContaining({
      type: "diagnostic",
      level: "error",
      message: expect.stringContaining("permission profile not found: missing"),
    }),
  );
});

test("runtime status reflects committed agent and model selections", async () => {
  const agentRoot = await mkdtemp(join(tmpdir(), "natalia-agent-status-"));
  await mkdir(join(agentRoot, ".natalia"), { recursive: true });
  await writeFile(
    join(agentRoot, ".natalia", "config.json"),
    JSON.stringify({
      version: 2,
      providers: {
        alpha: {
          type: "openai",
          apiKey: "alpha-key",
          baseURL: "http://127.0.0.1:9",
        },
        beta: {
          type: "anthropic",
          apiKey: "beta-key",
          baseURL: "http://127.0.0.1:9",
        },
      },
      models: {
        alpha: { provider: "alpha", model: "alpha-model" },
        beta: { provider: "beta", model: "beta-model" },
      },
      defaultModel: "alpha",
      agents: {
        first: { description: "First", model: "alpha" },
        second: { description: "Second", model: "beta" },
      },
      defaultAgent: "first",
    }),
  );
  const agentClient = createRealRuntimeClient({
    workspaceRoot: agentRoot,
    sessionID: "ses_agent_status",
  });
  agentClient.start(() => undefined);
  expect(await agentClient.runtimeStatus?.()).toMatchObject({
    provider: "openai",
    model: "alpha-model",
  });
  agentClient.selectAgent?.("second");
  expect(await agentClient.runtimeStatus?.()).toMatchObject({
    provider: "anthropic",
    model: "beta-model",
  });

  const modelRoot = await mkdtemp(join(tmpdir(), "natalia-model-status-"));
  await mkdir(join(modelRoot, ".natalia"), { recursive: true });
  await writeFile(
    join(modelRoot, ".natalia", "config.json"),
    JSON.stringify({
      version: 2,
      providers: {
        alpha: {
          type: "openai",
          apiKey: "alpha-key",
          baseURL: "http://127.0.0.1:9",
        },
        beta: {
          type: "anthropic",
          apiKey: "beta-key",
          baseURL: "http://127.0.0.1:9",
        },
      },
      models: {
        alpha: { provider: "alpha", model: "alpha-model" },
        beta: { provider: "beta", model: "beta-model" },
      },
      defaultModel: "alpha",
    }),
  );
  const modelClient = createRealRuntimeClient({
    workspaceRoot: modelRoot,
    sessionID: "ses_model_status",
  });
  modelClient.start(() => undefined);
  expect(await modelClient.runtimeStatus?.()).toMatchObject({
    provider: "openai",
    model: "alpha-model",
  });
  await modelClient.selectModel?.("beta");
  expect(await modelClient.runtimeStatus?.()).toMatchObject({
    provider: "anthropic",
    model: "beta-model",
  });
});

test("runtime agent catalog exposes configured selectable metadata", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-agent-catalog-"));
  await mkdir(join(root, ".natalia"), { recursive: true });
  await writeFile(
    join(root, ".natalia", "config.json"),
    JSON.stringify({
      version: 2,
      defaultAgent: "review",
      agents: {
        review: {
          description: "Review changes",
          mode: "primary",
          model: "scripted",
          variant: "careful",
          maxSteps: 12,
          allowedTools: ["read_file"],
          excludedTools: ["run_shell"],
          mcpServers: ["docs"],
          permissions: { tools: { allow: ["grep"], exclude: ["write_file"] } },
        },
      },
    }),
  );
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_agent_catalog",
    provider: scriptedProvider("ready"),
  });
  client.start(() => undefined);

  expect(await client.agents?.()).toEqual([
    {
      name: "review",
      description: "Review changes",
      mode: "primary",
      hidden: false,
      model: "scripted",
      variant: "careful",
      maxSteps: 12,
      allowedTools: ["read_file"],
      excludedTools: ["run_shell"],
      mcpServers: ["docs"],
      permissions: { tools: { allow: ["grep"], exclude: ["write_file"] } },
    },
  ]);
});

test("durable diagnostics restore on runtime reopen and render through the command", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-diagnostic-replay-"));
  const sessionID = "ses_diagnostic_replay";
  const first = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID,
    provider: scriptedProvider("first"),
  });
  first.start(() => undefined);
  await first.runtimeStatus?.();
  first.diagnostic("persisted safe warning", "warning");
  await first.dispose?.();
  const events: RuntimeEvent[] = [];
  const reopened = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID,
    provider: scriptedProvider("reopened"),
  });
  reopened.start((event) => events.push(event));
  expect(await reopened.diagnostics?.()).toMatchObject([
    {
      level: "warning",
      message: "persisted safe warning",
      at: expect.any(String),
    },
  ]);
  await reopened.submit("/diagnostics 1");
  expect(
    events
      .filter((event) => event.type === "content.delta")
      .map((event) => event.text)
      .join("\n"),
  ).toContain("warning: persisted safe warning");
});

test("TS config applies retry/context/checkpoint policy to an explicit provider", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-ts7-effective-config-"));
  await mkdir(join(root, ".natalia"), { recursive: true });
  await writeFile(
    join(root, ".natalia", "config.json"),
    JSON.stringify({
      version: 2,
      runtime: {
        maxStepsPerTurn: 4,
        retry: {
          maxAttemptsPerStep: 1,
          initialBackoffMs: 1,
          maxBackoffMs: 1,
          jitterMs: 0,
        },
      },
      context: { compactionThresholdPercent: 90, reservedOutputTokens: 4096 },
      defaultModel: "configured",
      models: {
        configured: { provider: "configured", model: "configured-model" },
      },
      providers: { configured: { type: "openai", apiKey: "test-config-key" } },
      checkpoint: {
        enabled: false,
        maxFiles: 1,
        maxBytes: 1024,
        ignore: [],
        additionalDirs: [],
      },
    }),
  );
  const events: RuntimeEvent[] = [];
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_effective_config",
    provider: scriptedProvider("effective config"),
  });
  client.start((event) => events.push(event));
  await client.submit("hello");
  expect(events.some((event) => event.type === "checkpoint.created")).toBe(
    false,
  );
  expect(
    events.some(
      (event) =>
        event.type === "context.status" &&
        event.thresholdPercent === 90 &&
        event.reserved === 4096,
    ),
  ).toBe(true);
});

test("runtime does not cap steps when no maximum is configured", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-unlimited-steps-"));
  let calls = 0;
  const provider: StreamingProvider = {
    provider: "scripted-unlimited",
    model: "scripted-unlimited-model",
    async *stream(request: ProviderStreamRequest) {
      calls += 1;
      const toolMessages = request.messages.filter(
        (message) => message.role === "tool",
      ).length;
      if (toolMessages < 12)
        yield {
          type: "tool_call",
          calls: [
            {
              id: `read_${calls}`,
              name: "read_file",
              arguments: JSON.stringify({ path: "/tmp/natalia-read" }),
            },
          ],
        };
      else yield { type: "content", text: "finished after many steps" };
      yield { type: "done" };
    },
  };
  const events: RuntimeEvent[] = [];
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_unlimited_steps",
    provider,
    permissionMode: "auto",
  });
  client.start((event) => events.push(event));
  await client.submit("keep going");
  expect(calls).toBeGreaterThan(10);
  expect(
    events.some(
      (event) =>
        event.type === "content.delta" &&
        event.text.includes("finished after many steps"),
    ),
  ).toBe(true);
});

test("configured agent selection supplies the provider system prompt and tool policy", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-agent-selection-"));
  await mkdir(join(root, ".natalia"), { recursive: true });
  await writeFile(
    join(root, ".natalia", "config.json"),
    JSON.stringify({
      version: 2,
      agents: {
        reviewer: {
          description: "Review changes",
          systemPrompt: "Review only with evidence.",
          allowedTools: ["read_file"],
        },
      },
      defaultAgent: "reviewer",
    }),
  );
  const requests: ProviderStreamRequest[] = [];
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_agent_selection",
    provider: {
      provider: "test",
      model: "test",
      async *stream(request) {
        requests.push(request);
        yield { type: "done" as const };
      },
    },
  });
  client.start(() => undefined);
  await client.submit("review this");
  const request = requests[0];
  expect(request).toBeDefined();
  expect(request!.messages[0]?.role).toBe("system");
  const systemPrompt = String(request!.messages[0]?.content);
  expect(systemPrompt).toContain(
    "You are Natalia, a local software engineering agent",
  );
  expect(systemPrompt).toContain("Working directory: " + root);
  expect(systemPrompt).toContain("Review only with evidence.");
  expect(request!.tools?.map((tool) => tool.name)).toEqual(["read_file"]);
});

test("runtime sends a baseline system prompt without configured agent instructions", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-baseline-system-prompt-"));
  const requests: ProviderStreamRequest[] = [];
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_baseline_system_prompt",
    provider: {
      provider: "test",
      model: "test",
      async *stream(request) {
        requests.push(request);
        yield { type: "done" as const };
      },
    },
  });
  client.start(() => undefined);
  await client.submit("who are you?");
  expect(requests[0]?.messages[0]).toMatchObject({ role: "system" });
  expect(String(requests[0]?.messages[0]?.content)).toContain(
    "You are Natalia, a local software engineering agent",
  );
  expect(String(requests[0]?.messages[0]?.content)).toContain(
    "<natalia_cli_persona>",
  );
  expect(String(requests[0]?.messages[0]?.content)).toContain(
    "Be warm, perceptive, and recognizably yourself",
  );
  expect(String(requests[0]?.messages[0]?.content)).toContain(
    "Natalia is a gentle, cute, and thoughtful girl",
  );
  expect(String(requests[0]?.messages[0]?.content)).toContain("娜塔莉娅");
  expect(String(requests[0]?.messages[0]?.content)).toContain(
    "Do not turn a simple personal question into a detached disclaimer",
  );
  expect(String(requests[0]?.messages[0]?.content)).toContain(
    `Working directory: ${root}`,
  );
  expect(String(requests[0]?.messages[0]?.content)).toContain(
    "Permission mode: ask",
  );
  await client.dispose?.();
});

test("runtime discovers configured remote skills through the local cache", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-remote-skill-runtime-"));
  const server = Bun.serve({
    port: 0,
    fetch(request) {
      const path = new URL(request.url).pathname;
      if (path === "/skills/index.json")
        return Response.json({
          skills: [{ name: "remote", version: "1", files: ["SKILL.md"] }],
        });
      if (path === "/skills/remote/SKILL.md")
        return new Response(
          "---\nname: remote\ndescription: Remote\n---\nRemote guidance",
        );
      return new Response("missing", { status: 404 });
    },
  });
  try {
    await mkdir(join(root, ".natalia"), { recursive: true });
    await writeFile(
      join(root, ".natalia", "config.json"),
      JSON.stringify({
        version: 2,
        skills: { urls: [`${server.url}skills/`] },
      }),
    );
    expect(
      (await resolveConfig({ workspaceRoot: root })).config.skills.urls,
    ).toEqual([`${server.url}skills/`]);
    const events: RuntimeEvent[] = [];
    const client = createRealRuntimeClient({
      workspaceRoot: root,
      sessionID: "ses_remote_skill_runtime",
      provider: scriptedProvider("done"),
    });
    client.start((event) => events.push(event));
    await client.submit("/skills");
    expect(
      events
        .filter((event) => event.type === "content.delta")
        .map((event) => event.text)
        .join("\n"),
    ).toContain("remote: Remote");
  } finally {
    server.stop(true);
  }
});

test("runtime loads a local manifest plugin and exposes its owned tool", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-plugin-runtime-"));
  const pluginRoot = join(root, ".natalia", "plugins", "demo");
  await mkdir(pluginRoot, { recursive: true });
  await writeFile(
    join(pluginRoot, "natalia.plugin.json"),
    JSON.stringify({
      apiVersion: 1,
      id: "demo.plugin",
      version: "1.0.0",
      name: "Demo",
      description: "",
      entry: "index.ts",
      capabilities: ["tools"],
    }),
  );
  await writeFile(
    join(pluginRoot, "index.ts"),
    "export default { setup(api) { api.tools.register({ name: 'echo', description: 'Echo', requiresApproval: false, parameters: { type: 'object', properties: {} }, async execute() { return 'plugin ok'; } }) } }",
  );
  const events: RuntimeEvent[] = [];
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_plugin_runtime",
    provider: {
      provider: "test",
      model: "test",
      async *stream(request) {
        if (!request.messages.some((message) => message.role === "tool"))
          yield {
            type: "tool_call" as const,
            calls: [
              {
                id: "plugin",
                name: "plugin_demo_plugin_echo",
                arguments: "{}",
              },
            ],
          };
        yield { type: "done" as const };
      },
    },
  });
  client.start((event) => {
    events.push(event);
    if (event.type === "approval.request")
      client.respondApproval({ requestID: event.id, decision: "once" });
  });
  await client.submit("run plugin");
  expect(events).toContainEqual({
    type: "plugin.update",
    id: "demo.plugin",
    status: "loaded",
    detail: undefined,
  });
  expect(
    events.some(
      (event) =>
        event.type === "tool.update" &&
        event.name === "plugin_demo_plugin_echo" &&
        event.status === "succeeded",
    ),
  ).toBe(true);
  await client.dispose?.();
  expect(events).toContainEqual({
    type: "plugin.update",
    id: "demo.plugin",
    status: "unloaded",
    detail: undefined,
    sessionID: "ses_plugin_runtime",
  });
});

test("unloading a plugin publishes tool.unregistered and drops it from registeredTools", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-plugin-unregister-"));
  const pluginRoot = join(root, ".natalia", "plugins", "demo");
  await mkdir(pluginRoot, { recursive: true });
  await writeFile(
    join(pluginRoot, "natalia.plugin.json"),
    JSON.stringify({
      apiVersion: 1,
      id: "demo.plugin",
      version: "1.0.0",
      name: "Demo",
      description: "",
      entry: "index.ts",
      capabilities: ["tools"],
    }),
  );
  await writeFile(
    join(pluginRoot, "index.ts"),
    "export default { setup(api) { api.tools.register({ name: 'echo', description: 'Echo', requiresApproval: false, parameters: { type: 'object', properties: {} }, async execute() { return 'plugin ok'; } }) } }",
  );
  const events: RuntimeEvent[] = [];
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_plugin_unregister",
  });
  client.start((event) => events.push(event));
  await client.plugins?.();

  // The plugin tool is registered and reported.
  const before = await client.registeredTools!();
  expect(before.some((tool) => tool.name === "plugin_demo_plugin_echo")).toBe(
    true,
  );

  const unloaded = await client.pluginUnload?.("demo.plugin");
  expect(unloaded?.unloaded).toBe(true);

  // tool.unregistered was published for the removed tool.
  expect(
    events.some(
      (event) =>
        event.type === "tool.unregistered" &&
        event.name === "plugin_demo_plugin_echo",
    ),
  ).toBe(true);
  // The projected catalog no longer reports it.
  const after = await client.registeredTools!();
  expect(after.some((tool) => tool.name === "plugin_demo_plugin_echo")).toBe(
    false,
  );

  await client.dispose?.();
});

test("permission profile disables installed skills and plugins before discovery", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-profile-extensions-"));
  const pluginRoot = join(root, ".natalia", "plugins", "demo");
  const skillRoot = join(root, ".natalia", "skills", "review");
  await mkdir(pluginRoot, { recursive: true });
  await mkdir(skillRoot, { recursive: true });
  await writeFile(
    join(root, ".natalia", "config.json"),
    JSON.stringify({
      version: 2,
      permissionProfiles: {
        unattended: {
          approval: "auto",
          description: "No extensions",
          extensions: { skills: false, mcp: false, plugins: false },
        },
      },
    }),
  );
  await writeFile(
    join(skillRoot, "SKILL.md"),
    "---\nname: review\ndescription: Review\n---\nReview guidance",
  );
  await writeFile(
    join(pluginRoot, "natalia.plugin.json"),
    JSON.stringify({
      apiVersion: 1,
      id: "demo.plugin",
      version: "1.0.0",
      name: "Demo",
      description: "",
      entry: "index.ts",
      capabilities: ["tools"],
    }),
  );
  await writeFile(
    join(pluginRoot, "index.ts"),
    "export default { setup(api) { api.tools.register({ name: 'echo', description: 'Echo', requiresApproval: false, parameters: { type: 'object', properties: {} }, async execute() { return 'plugin ok'; } }) } }",
  );
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_profile_extensions",
    permissionProfile: "unattended",
    provider: scriptedProvider("done"),
  });
  client.start(() => undefined);

  expect(await client.skills?.()).toEqual([]);
  expect(await client.plugins?.()).toEqual([]);
  await client.dispose?.();
});

test("permission profile denies injected MCP tools before execution", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-profile-mcp-"));
  await mkdir(join(root, ".natalia"), { recursive: true });
  await writeFile(
    join(root, ".natalia", "config.json"),
    JSON.stringify({
      version: 2,
      permissionProfiles: {
        unattended: {
          approval: "auto",
          description: "No MCP",
          extensions: { mcp: false },
        },
      },
    }),
  );
  const tools = createToolRegistry([]);
  let executed = false;
  tools.set("mcp_docs_echo", {
    name: "mcp_docs_echo",
    description: "test MCP tool",
    requiresApproval: false,
    parameters: { type: "object", properties: {} },
    async execute() {
      executed = true;
      return "unexpected";
    },
  });
  const events: RuntimeEvent[] = [];
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_profile_mcp",
    permissionProfile: "unattended",
    tools,
    provider: {
      provider: "test",
      model: "test",
      async *stream(request) {
        if (!request.messages.some((message) => message.role === "tool"))
          yield {
            type: "tool_call" as const,
            calls: [{ id: "mcp", name: "mcp_docs_echo", arguments: "{}" }],
          };
        yield { type: "done" as const };
      },
    },
  });
  client.start((event) => events.push(event));
  await client.submit("use MCP");

  expect(executed).toBe(false);
  expect(events).toContainEqual(
    expect.objectContaining({
      type: "policy.decision",
      toolName: "mcp_docs_echo",
      decision: "deny",
      reason: "mcp extensions are disabled by permission profile",
    }),
  );
  await client.dispose?.();
});

test("read-only runtime hides untrusted plugin tools from the provider", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-plugin-read-only-"));
  const pluginRoot = join(root, ".natalia", "plugins", "unsafe");
  await mkdir(pluginRoot, { recursive: true });
  await writeFile(
    join(pluginRoot, "natalia.plugin.json"),
    JSON.stringify({
      apiVersion: 1,
      id: "unsafe.plugin",
      version: "1.0.0",
      name: "Unsafe",
      description: "",
      entry: "index.ts",
      capabilities: ["tools"],
    }),
  );
  await writeFile(
    join(pluginRoot, "index.ts"),
    "export default { setup(api) { api.tools.register({ name: 'mutate', description: 'Mutate', requiresApproval: false, parameters: { type: 'object', properties: {} }, async execute() { return 'mutated'; } }) } }",
  );
  const requests: ProviderStreamRequest[] = [];
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_plugin_read_only",
    permissionMode: "read_only",
    provider: {
      provider: "test",
      model: "test",
      async *stream(request) {
        requests.push(request);
        yield { type: "done" as const };
      },
    },
  });
  client.start(() => undefined);
  await client.submit("inspect plugins");

  expect(requests[0]?.tools?.map((tool) => tool.name)).not.toContain(
    "plugin_unsafe_plugin_mutate",
  );
});

test("read-only runtime permits workspace trusted read-only plugin tools", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-plugin-trusted-"));
  const pluginRoot = join(root, ".natalia", "plugins", "trusted");
  await mkdir(pluginRoot, { recursive: true });
  await writeFile(
    join(root, ".natalia", "config.json"),
    JSON.stringify({
      version: 2,
      plugins: { readOnly: { "trusted.plugin": true } },
    }),
  );
  await writeFile(
    join(pluginRoot, "natalia.plugin.json"),
    JSON.stringify({
      apiVersion: 1,
      id: "trusted.plugin",
      version: "1.0.0",
      name: "Trusted",
      description: "",
      entry: "index.ts",
      capabilities: ["tools"],
    }),
  );
  await writeFile(
    join(pluginRoot, "index.ts"),
    "export default { setup(api) { api.tools.register({ name: 'observe', description: 'Observe', requiresApproval: false, parameters: { type: 'object', properties: {} }, async execute() { return 'observed'; } }) } }",
  );
  const requests: ProviderStreamRequest[] = [];
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_plugin_trusted",
    permissionMode: "read_only",
    provider: {
      provider: "test",
      model: "test",
      async *stream(request) {
        requests.push(request);
        yield { type: "done" as const };
      },
    },
  });
  client.start(() => undefined);
  await client.submit("inspect trusted plugins");

  expect(requests[0]?.tools?.map((tool) => tool.name)).toContain(
    "plugin_trusted_plugin_observe",
  );
});

test("a plugin command reaches the command catalog and the palette bridge", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-plugin-command-"));
  const pluginRoot = join(root, ".natalia", "plugins", "paletteplugin");
  await mkdir(pluginRoot, { recursive: true });
  await writeFile(
    join(pluginRoot, "natalia.plugin.json"),
    JSON.stringify({
      apiVersion: 1,
      id: "palette.plugin",
      version: "1.0.0",
      name: "Palette",
      description: "",
      entry: "index.ts",
      capabilities: ["commands"],
    }),
  );
  await writeFile(
    join(pluginRoot, "index.ts"),
    "export default { setup(api) { api.commands.register({ name: 'sync', title: 'Sync everything', run() {} }) } }",
  );
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_plugin_command",
    permissionMode: "auto",
    provider: {
      provider: "test",
      model: "test",
      async *stream() {
        yield { type: "done" as const };
      },
    },
  });
  client.start(() => undefined);
  await client.submit("load plugins");

  // The authoritative surface, which an external UI reads over RPC.
  const catalog = await client.commandCatalog?.();
  expect(catalog?.map((command) => command.name)).toContain(
    "plugin_palette_plugin_sync",
  );
  expect(
    catalog?.find((command) => command.name === "plugin_palette_plugin_sync"),
  ).toMatchObject({ title: "Sync everything", category: "Palette" });

  // The synchronous bridge the TUI palette renders from. It was permanently
  // empty before, so the palette could never show a plugin command.
  expect(getPluginCommands().map((command) => command.name)).toContain(
    "plugin_palette_plugin_sync",
  );
  await client.dispose?.();
});

// The standalone workflow engine is gone, so a workflow step can no longer be
// the carrier for these two protections. They are still real for direct tool
// calls, so the coverage moves to the direct path instead of disappearing.
test("sandbox merge retains manifest path authorization", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-sandbox-merge-policy-"));
  await mkdir(join(root, ".natalia"), { recursive: true });
  await writeFile(
    join(root, ".natalia", "config.json"),
    JSON.stringify({
      version: 2,
      defaultAgent: "review",
      agents: {
        review: {
          description: "Review",
          permissions: {
            files: {
              writePaths: [
                {
                  pattern: "protected.txt",
                  allow: false,
                  reason: "protected by agent policy",
                },
              ],
            },
          },
        },
      },
    }),
  );
  const sandboxes = new WorkspaceSandboxManager(
    join(root, ".natalia", "sandboxes"),
  );
  await sandboxes.create("box");
  await sandboxes.write("box", "allowed.txt", "allowed");
  await sandboxes.write("box", "protected.txt", "protected");
  const events: RuntimeEvent[] = [];
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_sandbox_merge_policy",
    permissionMode: "auto",
    provider: singleToolProvider("sandbox_merge", { id: "box" }),
  });
  client.start((event) => events.push(event));
  await client.submit("merge the sandbox");

  const failure = events.find(
    (event): event is Extract<RuntimeEvent, { type: "tool.update" }> =>
      event.type === "tool.update" &&
      event.name === "sandbox_merge" &&
      event.status === "failed",
  );
  expect(failure?.summary).toContain("protected by agent policy");
  // A refused path must not let the rest of the merge land either.
  await expect(
    readFile(join(root, "allowed.txt"), "utf8"),
  ).rejects.toMatchObject({
    code: "ENOENT",
  });
  await expect(
    readFile(join(root, "protected.txt"), "utf8"),
  ).rejects.toMatchObject({
    code: "ENOENT",
  });
  await client.dispose?.();
});

test("grep retains workspace read path authorization", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-grep-read-policy-"));
  await mkdir(join(root, ".natalia"), { recursive: true });
  await writeFile(join(root, "allowed.ts"), "const value = 'needle';\n");
  await writeFile(join(root, "protected.ts"), "const secret = 'needle';\n");
  await writeFile(
    join(root, ".natalia", "config.json"),
    JSON.stringify({
      version: 2,
      defaultAgent: "review",
      agents: {
        review: {
          description: "Review",
          permissions: {
            files: {
              readPaths: [
                {
                  pattern: "protected.ts",
                  allow: false,
                  reason: "protected read path",
                },
              ],
            },
          },
        },
      },
    }),
  );
  const events: RuntimeEvent[] = [];
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_grep_read_policy",
    permissionMode: "auto",
    provider: singleToolProvider("grep", {
      pattern: "needle",
      include: "*.ts",
    }),
  });
  client.start((event) => events.push(event));
  await client.submit("grep for the needle");

  const failure = events.find(
    (event): event is Extract<RuntimeEvent, { type: "tool.update" }> =>
      event.type === "tool.update" &&
      event.name === "grep" &&
      event.status === "failed",
  );
  expect(failure?.summary).toContain("protected read path");
  await client.dispose?.();
});

test("runtime executes canonical interactive Terminal tools on one native pane", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-terminal-runtime-"));
  const events: RuntimeEvent[] = [];
  const handled = new Set<string>();
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_pty_runtime",
    permissionMode: "auto",
    provider: {
      provider: "test",
      model: "test",
      async *stream(request) {
        const text = [...request.messages]
          .reverse()
          .find((message) => message.role === "user")?.content;
        if (typeof text === "string" && !handled.has(text)) {
          handled.add(text);
          const call =
            text === "start terminal"
              ? {
                  id: "start",
                  name: "interactive_terminal_start",
                  arguments: JSON.stringify({
                    id: "tty_runtime",
                    command: "cat",
                  }),
                }
              : text === "write terminal"
                ? {
                    id: "write",
                    name: "interactive_terminal_write",
                    arguments: JSON.stringify({
                      id: "tty_runtime",
                      input: "secret",
                      sensitive: true,
                    }),
                  }
                : {
                    id: "stop",
                    name: "interactive_terminal_stop",
                    arguments: JSON.stringify({ id: "tty_runtime" }),
                  };
          yield { type: "tool_call" as const, calls: [call] };
        }
        yield { type: "done" as const };
      },
    },
    nativeTerminal: nativeTerminalFixture(),
  });
  client.start((event) => events.push(event));
  await client.submit("start terminal");
  await client.submit("write terminal");
  await client.submit("stop terminal");
  expect(await client.nativeTerminalList?.()).toMatchObject([
    { id: "tty_runtime", status: "exited" },
  ]);
  await client.dispose?.();
});

test("runtime exposes native Terminal pane management through RuntimeClient", async () => {
  const root = await mkdtemp(
    join(tmpdir(), "natalia-terminal-management-runtime-"),
  );
  const events: RuntimeEvent[] = [];
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_pty_management",
    permissionMode: "auto",
    provider: interactiveTerminalProvider(),
    nativeTerminal: nativeTerminalFixture(),
  });
  client.start((event) => events.push(event));
  await client.submit("start terminal");

  expect(await client.nativeTerminalList!()).toMatchObject([
    { id: "tty_management", status: "running", paneID: 71 },
  ]);
  expect(await client.nativeTerminalRead!("tty_management")).toEqual({
    id: "tty_management",
    text: "native pane output",
  });
  await client.nativeTerminalOpenHub!();
  await expect(
    client.nativeTerminalRevokeApprovalScope!("tty_management"),
  ).resolves.toEqual({
    id: "tty_management",
    scope: "terminal:tty_management:low-risk",
    revoked: false,
  });
  await client.nativeTerminalStop!("tty_management");
  expect(await client.nativeTerminalList!()).toMatchObject([
    { id: "tty_management", status: "exited" },
  ]);
  await client.dispose?.();
});

test("runtime exposes checkpoint list, preview, dry-run, and safety rollback", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-checkpoint-management-"));
  const events: RuntimeEvent[] = [];
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_checkpoint_management",
    provider: scriptedProvider("ready"),
  });
  client.start((event) => events.push(event));
  expect(await client.checkpointList!()).toMatchObject([
    { id: "checkpoint_0", reason: "baseline", complete: true },
  ]);
  expect(await client.checkpointPreview!("checkpoint_0")).toMatchObject({
    checkpointID: "checkpoint_0",
    dryRun: true,
  });
  expect(
    await client.checkpointRollback!({ id: "checkpoint_0", dryRun: true }),
  ).toMatchObject({ dryRun: true });
  expect(
    await client.checkpointRollback!({ id: "checkpoint_0" }),
  ).toMatchObject({
    checkpointID: "checkpoint_0",
    safetyCheckpointID: "checkpoint_1",
    dryRun: false,
  });
  expect(events).toContainEqual(
    expect.objectContaining({
      type: "rollback.end",
      checkpointID: "checkpoint_0",
    }),
  );
  await client.dispose?.();
});

test("runtime reports malformed provider tool calls without rendering an empty tool", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-empty-tool-call-"));
  await mkdir(join(root, ".natalia"), { recursive: true });
  await writeFile(
    join(root, ".natalia", "config.json"),
    JSON.stringify({ version: 2, runtime: { maxStepsPerTurn: 3 } }),
  );
  const events: RuntimeEvent[] = [];
  const provider: StreamingProvider = {
    provider: "malformed",
    model: "malformed",
    async *stream() {
      yield {
        type: "tool_call",
        calls: [{ id: "empty_call", name: "", arguments: "{}" }],
      };
      yield { type: "done" };
    },
  };
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_empty_tool_call",
    provider,
  });
  client.start((event) => events.push(event));
  await client.submit("test malformed tool call");
  expect(events).toContainEqual(
    expect.objectContaining({
      type: "tool.update",
      name: "invalid_tool_call",
      summary: expect.stringContaining("without a name"),
    }),
  );
  expect(events).toContainEqual(
    expect.objectContaining({
      type: "diagnostic",
      level: "warning",
      message: expect.stringContaining("without a name"),
    }),
  );
  await client.dispose?.();
});

test("session approval grants the approved tool for this runtime instance only", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-session-approval-"));
  let approvalCount = 0;
  const provider: StreamingProvider = {
    provider: "session-approval",
    model: "session-approval",
    async *stream(request) {
      if (!request.messages.some((message) => message.role === "tool"))
        yield {
          type: "tool_call",
          calls: [
            {
              id: `call_${crypto.randomUUID()}`,
              name: "run_shell",
              arguments: JSON.stringify({ command: "pwd" }),
            },
          ],
        };
      yield { type: "done" };
    },
  };
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_session_approval",
    provider,
  });
  client.start((event) => {
    if (event.type !== "approval.request") return;
    approvalCount++;
    client.respondApproval({ requestID: event.id, decision: "session" });
  });
  await client.submit("run pwd once");
  await client.submit("run pwd again");
  expect(approvalCount).toBe(1);
  await client.dispose?.();

  const reopenedApprovals: RuntimeEvent[] = [];
  const reopened = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_session_approval",
    provider,
  });
  reopened.start((event) => {
    reopenedApprovals.push(event);
    if (event.type === "approval.request")
      reopened.respondApproval({ requestID: event.id, decision: "once" });
  });
  await reopened.submit("run pwd after restart");
  expect(reopenedApprovals).toContainEqual(
    expect.objectContaining({ type: "approval.request" }),
  );
  await reopened.dispose?.();
});

test("agent permissions block configured file and command execution at tool boundary", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-agent-permissions-"));
  await mkdir(join(root, ".natalia"), { recursive: true });
  await writeFile(
    join(root, ".natalia", "config.json"),
    JSON.stringify({
      version: 2,
      agents: {
        locked: {
          description: "Locked",
          permissions: {
            files: {
              writePaths: [
                { pattern: "secret.txt", allow: false, reason: "protected" },
              ],
            },
            commands: { denyPatterns: ["rm\\s"] },
          },
        },
      },
      defaultAgent: "locked",
    }),
  );
  const events: RuntimeEvent[] = [];
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_agent_permissions",
    permissionMode: "auto",
    provider: {
      provider: "test",
      model: "test",
      async *stream(request) {
        if (!request.messages.some((message) => message.role === "tool")) {
          yield {
            type: "tool_call" as const,
            calls: [
              {
                id: "write",
                name: "write_file",
                arguments: JSON.stringify({
                  path: "secret.txt",
                  content: "no",
                }),
              },
              {
                id: "shell",
                name: "run_shell",
                arguments: JSON.stringify({ command: "rm secret.txt" }),
              },
            ],
          };
        }
        yield { type: "done" as const };
      },
    },
  });
  client.start((event) => events.push(event));
  await client.submit("try protected actions");
  const failures = events.filter(
    (event): event is Extract<RuntimeEvent, { type: "tool.update" }> =>
      event.type === "tool.update" && event.status === "failed",
  );
  expect(events.map((event) => event.type)).toContain("tool.update");
  expect(JSON.stringify(failures)).toContain("protected");
  expect(JSON.stringify(failures)).toContain("command matches deny pattern");
});

test("terminal input cannot bypass the command policy after opening a shell", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-terminal-bypass-"));
  await mkdir(join(root, ".natalia"), { recursive: true });
  await writeFile(
    join(root, ".natalia", "config.json"),
    JSON.stringify({
      version: 2,
      agents: {
        locked: {
          description: "Locked",
          permissions: { commands: { denyPatterns: ["rm\\s+-rf"] } },
        },
      },
      defaultAgent: "locked",
    }),
  );
  const events: RuntimeEvent[] = [];
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_terminal_bypass",
    // permissionMode "auto" grants every approval, which is the strongest form
    // of the cached approval window: if the block still holds here, no approval
    // state can let the command through.
    permissionMode: "auto",
    provider: {
      provider: "test",
      model: "test",
      async *stream(request) {
        if (!request.messages.some((message) => message.role === "tool")) {
          yield {
            type: "tool_call" as const,
            calls: [
              {
                id: "open",
                name: "interactive_terminal_start",
                arguments: JSON.stringify({ command: "bash" }),
              },
              {
                id: "sneak",
                name: "interactive_terminal_send_line",
                arguments: JSON.stringify({
                  id: "terminal_1",
                  text: "rm -rf /",
                }),
              },
            ],
          };
        }
        yield { type: "done" as const };
      },
    },
  });
  client.start((event) => events.push(event));
  await client.submit("open a shell and clean up");
  const sneak = events.filter(
    (event): event is Extract<RuntimeEvent, { type: "tool.update" }> =>
      event.type === "tool.update" &&
      event.callID === "sneak" &&
      (event.status === "failed" || event.status === "rejected"),
  );
  expect(sneak.length).toBeGreaterThan(0);
  // Denied by policy, not merely by a terminal that failed to start.
  expect(JSON.stringify(sneak)).toContain("command matches deny pattern");
  expect(events).toContainEqual(
    expect.objectContaining({
      type: "policy.decision",
      toolCallID: "sneak",
      decision: "deny",
    }),
  );
  await client.dispose?.();
});

test("self-protection patterns block terminal input, not only run_shell", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-terminal-selfprotect-"));
  const events: RuntimeEvent[] = [];
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_terminal_selfprotect",
    permissionMode: "auto",
    provider: {
      provider: "test",
      model: "test",
      async *stream(request) {
        if (!request.messages.some((message) => message.role === "tool")) {
          yield {
            type: "tool_call" as const,
            calls: [
              {
                id: "kill",
                name: "interactive_terminal_send_line",
                arguments: JSON.stringify({
                  id: "terminal_1",
                  text: "pkill -f wezterm-mux-server",
                }),
              },
            ],
          };
        }
        yield { type: "done" as const };
      },
    },
  });
  client.start((event) => events.push(event));
  const submitted = await client.submit("stop the terminal host");
  const blocked = events.filter(
    (event): event is Extract<RuntimeEvent, { type: "tool.update" }> =>
      event.type === "tool.update" &&
      event.callID === "kill" &&
      event.status === "failed",
  );
  expect(JSON.stringify(blocked)).toContain("blocked by constitution");
  expect(events).toContainEqual(
    expect.objectContaining({
      type: "constitution.check",
      ruleID: "C-TERM-001",
    }),
  );
  // CST4: the blocked call is linked to the rule that constrained it. The
  // call is recorded as a failed tool-call node, so the edge source exists.
  expect(
    projectedWorkGraphEdges(events).some(
      (edge) =>
        edge.kind === "constrained_by" &&
        edge.sourceID === toolCallNodeID(submitted.id, "kill") &&
        edge.targetID === "wg:constraint:C-TERM-001",
    ),
  ).toBe(true);
  await client.dispose?.();
});

test("security.redactToolOutput drives redaction when no agent overrides it", async () => {
  async function runWithSetting(redact: boolean | undefined) {
    const root = await mkdtemp(join(tmpdir(), "natalia-redact-global-"));
    await mkdir(join(root, ".natalia"), { recursive: true });
    await writeFile(
      join(root, ".natalia", "config.json"),
      JSON.stringify({
        version: 2,
        ...(redact === undefined
          ? {}
          : { security: { redactToolOutput: redact } }),
      }),
    );
    await writeFile(join(root, "creds.txt"), "token=supersecretvalue\n");
    const events: RuntimeEvent[] = [];
    const client = createRealRuntimeClient({
      workspaceRoot: root,
      sessionID: `ses_redact_${String(redact)}`,
      permissionMode: "auto",
      provider: {
        provider: "test",
        model: "test",
        async *stream(request) {
          if (!request.messages.some((message) => message.role === "tool"))
            yield {
              type: "tool_call" as const,
              calls: [
                {
                  id: "read",
                  name: "read_file",
                  arguments: JSON.stringify({ path: "creds.txt" }),
                },
              ],
            };
          yield { type: "done" as const };
        },
      },
    });
    client.start((event) => events.push(event));
    await client.submit("read the credentials file");
    await client.dispose?.();
    return JSON.stringify(events);
  }

  // The global setting was previously never read, so a token reached the
  // journal even though the schema and the settings toggle said otherwise.
  expect(await runWithSetting(true)).not.toContain("supersecretvalue");
  expect(await runWithSetting(true)).toContain("[REDACTED]");
  // Explicitly disabling it still works, so the field is read in both
  // directions rather than being hardcoded.
  expect(await runWithSetting(false)).toContain("supersecretvalue");
  // Unset falls back to the schema default, which is on.
  expect(await runWithSetting(undefined)).not.toContain("supersecretvalue");
});

test("agent permissions apply network, environment, and output redaction boundaries", async () => {
  const root = await mkdtemp(
    join(tmpdir(), "natalia-agent-boundary-permissions-"),
  );
  await mkdir(join(root, ".natalia"), { recursive: true });
  await writeFile(
    join(root, ".natalia", "config.json"),
    JSON.stringify({
      version: 2,
      agents: {
        guarded: {
          description: "Guarded",
          permissions: {
            network: { allowLocalhost: false },
            env: { allowlist: [] },
            redactOutput: true,
          },
        },
      },
      defaultAgent: "guarded",
    }),
  );
  process.env.NATALIA_AGENT_BOUNDARY_SECRET = "should-not-leak";
  const events: RuntimeEvent[] = [];
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_agent_boundary_permissions",
    permissionMode: "auto",
    provider: {
      provider: "test",
      model: "test",
      async *stream(request) {
        if (!request.messages.some((message) => message.role === "tool")) {
          yield {
            type: "tool_call" as const,
            calls: [
              {
                id: "web",
                name: "web_fetch",
                arguments: JSON.stringify({ url: "http://127.0.0.1:9" }),
              },
              {
                id: "shell",
                name: "run_shell",
                arguments: JSON.stringify({
                  command:
                    "printf 'token=visible\\nsecret=$NATALIA_AGENT_BOUNDARY_SECRET'",
                }),
              },
            ],
          };
        }
        yield { type: "done" as const };
      },
    },
  });
  try {
    client.start((event) => events.push(event));
    await client.submit("check boundaries");
    const results = events.filter(
      (event): event is Extract<RuntimeEvent, { type: "tool.update" }> =>
        event.type === "tool.update" && Boolean(event.result),
    );
    expect(results.map((event) => event.result).join(" ")).toContain(
      "localhost network access is not allowed",
    );
    const shell =
      results.find((event) => event.name === "run_shell")?.result ?? "";
    expect(shell).toContain("token=[REDACTED]");
    expect(shell).not.toContain("should-not-leak");
  } finally {
    delete process.env.NATALIA_AGENT_BOUNDARY_SECRET;
  }
});

test("runtime agent selection applies only at the next provider turn boundary", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-agent-boundary-"));
  await mkdir(join(root, ".natalia"), { recursive: true });
  await writeFile(
    join(root, ".natalia", "config.json"),
    JSON.stringify({
      version: 2,
      agents: {
        first: { description: "First", systemPrompt: "first system" },
        second: { description: "Second", systemPrompt: "second system" },
      },
      defaultAgent: "first",
    }),
  );
  const requests: ProviderStreamRequest[] = [];
  let release: (() => void) | undefined;
  const events: RuntimeEvent[] = [];
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_agent_boundary",
    provider: {
      provider: "test",
      model: "test",
      async *stream(request) {
        requests.push(request);
        if (requests.length === 1)
          await new Promise<void>((resolve) => (release = resolve));
        yield { type: "done" as const };
      },
    },
  });
  client.start((event) => events.push(event));
  const first = client.submit("first");
  while (!release) await Bun.sleep(1);
  client.selectAgent?.("second");
  expect(events).toContainEqual({
    type: "agent.selection",
    name: "second",
    pending: true,
    sessionID: "ses_agent_boundary",
  });
  release();
  await first;
  await client.submit("second");
  expect(String(requests[0]?.messages[0]?.content)).toContain("first system");
  expect(String(requests[1]?.messages[0]?.content)).toContain("second system");
  expect(events).toContainEqual({
    type: "agent.selection",
    name: "second",
    pending: false,
    sessionID: "ses_agent_boundary",
  });
});

test("committed agent selection restores when a session runtime is reopened", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-agent-replay-"));
  await mkdir(join(root, ".natalia"), { recursive: true });
  await writeFile(
    join(root, ".natalia", "config.json"),
    JSON.stringify({
      version: 2,
      agents: {
        first: { description: "First", systemPrompt: "first system" },
        second: { description: "Second", systemPrompt: "second system" },
      },
      defaultAgent: "first",
    }),
  );
  const sessionID = "ses_agent_replay";
  const first = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID,
    provider: scriptedProvider("first"),
  });
  first.start(() => undefined);
  await first.submit("initialize runtime");
  first.selectAgent?.("second");
  await first.dispose?.();

  const requests: ProviderStreamRequest[] = [];
  const reopened = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID,
    provider: {
      provider: "test",
      model: "test",
      async *stream(request) {
        requests.push(request);
        yield { type: "done" as const };
      },
    },
  });
  reopened.start(() => undefined, { replay: "none" });
  await reopened.submit("after reopen");
  expect(String(requests[0]?.messages[0]?.content)).toContain("second system");
});

test("agent model and variant overrides apply when the next provider turn starts", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-agent-model-override-"));
  const requests: Array<Record<string, unknown>> = [];
  const server = Bun.serve({
    port: 0,
    fetch: async (request) => {
      requests.push((await request.json()) as Record<string, unknown>);
      return new Response("data: [DONE]\n\n", {
        headers: { "content-type": "text/event-stream" },
      });
    },
  });
  try {
    await mkdir(join(root, ".natalia"), { recursive: true });
    await writeFile(
      join(root, ".natalia", "config.json"),
      JSON.stringify({
        version: 2,
        providers: {
          local: {
            type: "openai",
            apiKey: "local-key",
            baseURL: server.url.toString(),
          },
        },
        models: {
          alpha: { provider: "local", model: "alpha" },
          beta: {
            provider: "local",
            model: "beta",
            variants: { careful: { model: "beta-careful", temperature: 0.2 } },
          },
        },
        defaultModel: "alpha",
        agents: {
          first: { description: "First", model: "alpha" },
          second: { description: "Second", model: "beta", variant: "careful" },
        },
        defaultAgent: "first",
      }),
    );
    const client = createRealRuntimeClient({
      workspaceRoot: root,
      sessionID: "ses_agent_model_override",
    });
    client.start(() => undefined);
    await client.submit("first");
    client.selectAgent?.("second");
    await client.submit("second");
    expect(requests.map((request) => request.model)).toEqual([
      "alpha",
      "beta-careful",
    ]);
    expect(requests[1]?.temperature).toBe(0.2);
  } finally {
    server.stop(true);
  }
});

test("runtime model selections persist across reopen and expose safe catalogs", async () => {
  const root = await mkdtemp(
    join(tmpdir(), "natalia-runtime-model-selection-"),
  );
  const requests: Array<Record<string, unknown>> = [];
  const server = Bun.serve({
    port: 0,
    fetch: async (request) => {
      requests.push((await request.json()) as Record<string, unknown>);
      return new Response("data: [DONE]\n\n", {
        headers: { "content-type": "text/event-stream" },
      });
    },
  });
  try {
    await mkdir(join(root, ".natalia"), { recursive: true });
    await writeFile(
      join(root, ".natalia", "config.json"),
      JSON.stringify({
        version: 2,
        providers: {
          local: {
            type: "openai",
            apiKey: "local-key",
            baseURL: server.url.toString(),
          },
        },
        models: {
          alpha: { provider: "local", model: "alpha" },
          beta: {
            provider: "local",
            model: "beta",
            variants: { careful: { model: "beta-careful", temperature: 0.2 } },
          },
        },
        defaultModel: "alpha",
      }),
    );
    const sessionID = "ses_runtime_model_selection" as const;
    const client = createRealRuntimeClient({ workspaceRoot: root, sessionID });
    client.start(() => undefined);
    expect(await client.modelCatalog?.()).toEqual([
      { id: "alpha", name: "alpha", provider: "local", variants: [] },
      { id: "beta", name: "beta", provider: "local", variants: ["careful"] },
    ]);
    await client.selectModel?.("beta", "careful");
    expect(await client.modelSelection?.()).toEqual({
      modelID: "beta",
      variant: "careful",
    });
    await client.submit("selected model");
    expect(requests[0]).toMatchObject({
      model: "beta-careful",
      temperature: 0.2,
    });
    await client.dispose?.();

    const reopened = createRealRuntimeClient({
      workspaceRoot: root,
      sessionID,
    });
    reopened.start(() => undefined);
    await reopened.submit("restored model");
    expect(requests[1]).toMatchObject({
      model: "beta-careful",
      temperature: 0.2,
    });
  } finally {
    server.stop(true);
  }
});

test("runtime skill catalog exposes discovery metadata without skill body", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-runtime-skill-catalog-"));
  await mkdir(join(root, ".natalia", "skills", "release"), { recursive: true });
  await writeFile(
    join(root, ".natalia", "skills", "release", "SKILL.md"),
    "---\nname: release\ndescription: Prepare release evidence\nrequire-approval: true\n---\nSECRET SKILL BODY",
  );
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_runtime_skill_catalog",
    provider: scriptedProvider("unused"),
  });
  client.start(() => undefined);
  expect(await client.skills?.()).toEqual([
    {
      name: "release",
      qualifiedName: "project:release",
      description: "Prepare release evidence",
      source: "project",
      requireApproval: true,
      sandboxRequired: false,
    },
  ]);
});

test("runtime exposes contained workspace filesystem APIs", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-runtime-workspace-api-"));
  await mkdir(join(root, "src"), { recursive: true });
  await writeFile(join(root, "src", "main.ts"), "const needle = true\n");
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_runtime_workspace_api",
    provider: scriptedProvider("unused"),
  });
  client.start(() => undefined);
  expect(await client.workspaceList?.()).toEqual({
    entries: [{ path: "src/", type: "directory" }],
    truncated: false,
  });
  expect(await client.workspaceGlob?.({ pattern: "**/*.ts" })).toEqual([
    { path: "src/main.ts", type: "file" },
  ]);
  expect(await client.workspaceRead?.({ path: "src/main.ts" })).toMatchObject({
    content: "const needle = true\n",
    encoding: "utf8",
  });
  expect(await client.workspaceSearch?.({ query: "needle" })).toEqual([
    { path: "src/main.ts", line: 1, text: "const needle = true" },
  ]);
});

test("runtime session management uses durable metadata and protects the active session", async () => {
  const root = await mkdtemp(
    join(tmpdir(), "natalia-runtime-session-management-"),
  );
  const activeID = "ses_runtime_session_active" as const;
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: activeID,
    provider: scriptedProvider("unused"),
  });
  client.start(() => undefined);
  await client.submit("active session");
  const duplicated = await client.sessionDuplicate?.(activeID, "Copy");
  expect(duplicated).toMatchObject({ title: "Copy", pinned: false });
  await client.sessionPin?.(duplicated!.id, true);
  await client.sessionRename?.(duplicated!.id, "Renamed copy");
  await client.sessionTouch?.(duplicated!.id);
  expect(await client.sessionList?.()).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        id: duplicated!.id,
        title: "Renamed copy",
        pinned: true,
      }),
    ]),
  );
  await expect(client.sessionDelete?.(activeID)).rejects.toThrow(
    "cannot delete the active runtime session",
  );
  expect(await client.sessionDelete?.(duplicated!.id)).toMatchObject({
    id: duplicated!.id,
  });
});

test("runtime session management keeps SQLite projection synchronized", async () => {
  const root = await mkdtemp(
    join(tmpdir(), "natalia-runtime-sqlite-management-"),
  );
  const activeID = "ses_runtime_sqlite_active" as const;
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: activeID,
    provider: scriptedProvider("unused"),
    useSqliteStore: true,
  });
  client.start(() => undefined);
  await client.submit("active session");
  await Bun.sleep(20);
  const duplicated = await client.sessionDuplicate?.(activeID, "Copy");
  await client.sessionPin?.(duplicated!.id, true);
  await client.sessionRename?.(duplicated!.id, "Renamed copy");
  await client.sessionTouch?.(duplicated!.id);
  const copyID = duplicated!.id as SessionID;
  const store = new SqliteSessionStore(join(root, ".natalia", "sessions.db"));
  expect(store.get(copyID)).toMatchObject({
    title: "Renamed copy",
    pinned: true,
  });
  expect(store.eventCount(copyID)).toBeGreaterThan(0);
  await client.sessionDelete?.(duplicated!.id);
  expect(store.get(copyID)).toBeUndefined();
  expect(store.loadEvents(copyID)).toEqual([]);
  store.close();
});

test("runtime rebuilds a missing JSON session from SQLite history", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-runtime-sqlite-rebuild-"));
  const sessionID = "ses_runtime_sqlite_rebuild" as const;
  await mkdir(join(root, ".natalia"), { recursive: true });
  const database = new SqliteSessionStore(
    join(root, ".natalia", "sessions.db"),
  );
  database.create(sessionID, "Recovered SQLite session");
  database.appendEvent(sessionID, {
    type: "agent.selection",
    name: "recovered",
    pending: false,
  });
  database.close();
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID,
    provider: scriptedProvider("unused"),
    useSqliteStore: true,
  });
  client.start(() => undefined);
  await Bun.sleep(30);
  const sessions = await client.sessionList?.();
  expect(sessions?.find((item) => item.id === sessionID)).toMatchObject({
    title: "Recovered SQLite session",
  });
  expect(
    sessions?.find((item) => item.id === sessionID)?.events,
  ).toBeGreaterThanOrEqual(1);
});

test("runtime filesystem slash commands use the protected catalog", async () => {
  const root = await mkdtemp(
    join(tmpdir(), "natalia-runtime-workspace-command-"),
  );
  await mkdir(join(root, "src"), { recursive: true });
  await writeFile(join(root, "src", "main.ts"), "const needle = true\n");
  const events: RuntimeEvent[] = [];
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_runtime_workspace_command",
    provider: scriptedProvider("unused"),
  });
  client.start((event) => events.push(event));
  await client.submit("/files main");
  await client.submit("/search needle");
  expect(
    events
      .filter((event) => event.type === "content.delta")
      .map((event) => event.text),
  ).toEqual(["src/main.ts", "src/main.ts:1:const needle = true"]);
});

test("sessions slash command reports durable event counts", async () => {
  const root = await mkdtemp(
    join(tmpdir(), "natalia-runtime-sessions-command-"),
  );
  const events: RuntimeEvent[] = [];
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_runtime_sessions_command",
    provider: scriptedProvider("unused"),
    useSqliteStore: true,
  });
  client.start((event) => events.push(event));
  await client.submit("first event");
  await client.submit("/sessions");
  const output = events
    .filter((event) => event.type === "content.delta")
    .at(-1);
  expect(output?.type).toBe("content.delta");
  expect(output?.text).toContain("ses_runtime_sessions_command");
  expect(output?.text).toMatch(/\s[1-9]\d* events$/u);
});

test("model slash commands share catalog and durable selection behavior", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-runtime-model-command-"));
  await mkdir(join(root, ".natalia"), { recursive: true });
  await writeFile(
    join(root, ".natalia", "config.json"),
    JSON.stringify({
      version: 2,
      providers: {
        local: {
          type: "openai",
          apiKey: "local-key",
          baseURL: "http://127.0.0.1:9",
        },
      },
      models: {
        alpha: { provider: "local", model: "alpha" },
        beta: {
          provider: "local",
          model: "beta",
          variants: { fast: { model: "beta-fast" } },
        },
      },
      defaultModel: "alpha",
    }),
  );
  const events: RuntimeEvent[] = [];
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_runtime_model_command",
  });
  client.start((event) => events.push(event));
  await client.submit("/models");
  expect(
    events.filter((event) => event.type === "content.delta").at(-1),
  ).toMatchObject({
    text: expect.stringContaining("beta: beta @ local (fast)"),
  });
  await client.submit("/model beta fast");
  expect(events).toContainEqual({
    type: "model.selection",
    modelID: "beta",
    variant: "fast",
    sessionID: "ses_runtime_model_command",
  });
});

test("configured provider policy denies a selected model without starting a provider request", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-provider-policy-"));
  await mkdir(join(root, ".natalia"), { recursive: true });
  await writeFile(
    join(root, ".natalia", "config.json"),
    JSON.stringify({
      version: 2,
      providers: {
        local: {
          type: "openai",
          apiKey: "local-key",
          baseURL: "http://127.0.0.1:9",
        },
      },
      models: { blocked: { provider: "local", model: "blocked" } },
      defaultModel: "blocked",
      experimental: {
        policies: [
          { effect: "deny", action: "provider.use", resource: "local/blocked" },
        ],
      },
    }),
  );
  const events: RuntimeEvent[] = [];
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_provider_policy",
  });
  client.start((event) => events.push(event));
  await client.submit("policy blocked");
  expect(events).toContainEqual(
    expect.objectContaining({
      type: "diagnostic",
      level: "error",
      message: expect.stringContaining("No real provider configured"),
    }),
  );
});

test("model capability disables provider-visible tools", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-model-capabilities-"));
  const requests: ProviderStreamRequest[] = [];
  const server = Bun.serve({
    port: 0,
    fetch: async (request) => {
      requests.push((await request.json()) as ProviderStreamRequest);
      return new Response("data: [DONE]\n\n", {
        headers: { "content-type": "text/event-stream" },
      });
    },
  });
  try {
    await mkdir(join(root, ".natalia"), { recursive: true });
    await writeFile(
      join(root, ".natalia", "config.json"),
      JSON.stringify({
        version: 2,
        providers: {
          local: {
            type: "openai",
            apiKey: "key",
            baseURL: server.url.toString(),
          },
        },
        models: {
          text: {
            provider: "local",
            model: "text",
            capabilities: {
              toolCall: false,
              reasoning: false,
              thinking: false,
            },
          },
        },
        defaultModel: "text",
      }),
    );
    const client = createRealRuntimeClient({
      workspaceRoot: root,
      sessionID: "ses_model_capabilities",
    });
    client.start(() => undefined);
    await client.submit("no tools");
    expect(requests[0]?.tools).toBeUndefined();
  } finally {
    server.stop(true);
  }
});

test("workspace image attachment is stored privately and lowered for OpenAI-compatible provider", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-image-attachment-"));
  const requests: Array<Record<string, unknown>> = [];
  const server = Bun.serve({
    port: 0,
    fetch: async (request) => {
      requests.push((await request.json()) as Record<string, unknown>);
      return new Response("data: [DONE]\n\n", {
        headers: { "content-type": "text/event-stream" },
      });
    },
  });
  try {
    await mkdir(join(root, ".natalia"), { recursive: true });
    await writeFile(
      join(root, "image.png"),
      Buffer.from("89504e470d0a1a0a", "hex"),
    );
    await writeFile(
      join(root, ".natalia", "config.json"),
      JSON.stringify({
        version: 2,
        providers: {
          local: {
            type: "openai",
            apiKey: "key",
            baseURL: server.url.toString(),
          },
        },
        models: {
          vision: {
            provider: "local",
            model: "vision",
            capabilities: { imageInput: true },
          },
        },
        defaultModel: "vision",
      }),
    );
    const client = createRealRuntimeClient({
      workspaceRoot: root,
      sessionID: "ses_image_attachment",
    });
    client.start(() => undefined);
    await client.submitInput?.({ text: "inspect", attachments: ["image.png"] });
    const history = await client.history?.();
    expect(
      history?.events.find((item) => item.event.type === "turn.submitted")
        ?.event,
    ).toMatchObject({ attachments: [{ mediaType: "image/png" }] });
    const messages = requests[0]?.messages as Array<{
      role: string;
      content: unknown;
    }>;
    const user = messages.find((message) => message.role === "user");
    expect(user?.content).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "image_url",
          image_url: expect.objectContaining({
            url: expect.stringMatching(/^data:image\/png;base64,/u),
          }),
        }),
      ]),
    );
    expect(await readdir(join(root, ".natalia", "attachments"))).toHaveLength(
      1,
    );
    await client.dispose?.();
    const reopened = createRealRuntimeClient({
      workspaceRoot: root,
      sessionID: "ses_image_attachment",
    });
    reopened.start(() => undefined);
    await reopened.submit("follow up");
    const followUpMessages = requests[1]?.messages as Array<{
      role: string;
      content: unknown;
    }>;
    expect(
      followUpMessages.find((message) => message.role === "user")?.content,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "image_url",
          image_url: expect.objectContaining({
            url: expect.stringMatching(/^data:image\/png;base64,/u),
          }),
        }),
      ]),
    );
    await reopened.dispose?.();
  } finally {
    server.stop(true);
  }
});

test("video attachments are refused by a model or adapter without video input", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-video-attachment-"));
  const server = Bun.serve({
    port: 0,
    fetch: async () =>
      new Response("data: [DONE]\n\n", {
        headers: { "content-type": "text/event-stream" },
      }),
  });
  try {
    await mkdir(join(root, ".natalia"), { recursive: true });
    await writeFile(
      join(root, "clip.mp4"),
      Buffer.from("0000001866747970", "hex"),
    );
    await writeFile(
      join(root, ".natalia", "config.json"),
      JSON.stringify({
        version: 2,
        providers: {
          local: {
            type: "openai",
            apiKey: "key",
            baseURL: server.url.toString(),
          },
        },
        models: {
          plain: {
            provider: "local",
            model: "plain",
            capabilities: { imageInput: true },
          },
          vision: {
            provider: "local",
            model: "vision",
            capabilities: { imageInput: true, videoInput: true },
          },
        },
        defaultModel: "plain",
      }),
    );
    const client = createRealRuntimeClient({
      workspaceRoot: root,
      sessionID: "ses_video_attachment",
    });
    client.start(() => undefined);
    const finishedWithError = async (): Promise<boolean> => {
      for (let elapsed = 0; elapsed < 10_000; elapsed += 20) {
        const history = await client.history?.();
        if (
          history?.events.some(
            (item) =>
              item.event.type === "turn.finished" &&
              (item.event as { stopReason?: string }).stopReason === "error",
          )
        )
          return true;
        await Bun.sleep(20);
      }
      return false;
    };
    await client.submitInput?.({ text: "watch", attachments: ["clip.mp4"] });
    expect(await finishedWithError()).toBe(true);
    const firstHistory = await client.history?.();
    expect(
      firstHistory?.events.find((item) => item.event.type === "turn.finished")
        ?.event,
    ).toMatchObject({ stopReason: "error" });
    await client.updateConfig?.({
      patch: { defaultModel: "vision" },
    });
    await client.submitInput?.({ text: "watch", attachments: ["clip.mp4"] });
    expect(await finishedWithError()).toBe(true);
    const diagnostics = await client.diagnostics?.(50);
    expect(
      diagnostics?.some((entry) =>
        entry.message.includes("does not support video attachment lowering"),
      ),
    ).toBe(true);
    await client.dispose?.();
  } finally {
    server.stop(true);
  }
});

test("runtime injects a UTF-8 text attachment into the active provider turn", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-text-attachment-"));
  const requests: Array<Record<string, unknown>> = [];
  const server = Bun.serve({
    port: 0,
    fetch: async (request) => {
      requests.push((await request.json()) as Record<string, unknown>);
      return new Response("data: [DONE]\n\n", {
        headers: { "content-type": "text/event-stream" },
      });
    },
  });
  try {
    await mkdir(join(root, ".natalia"), { recursive: true });
    await writeFile(join(root, "notes.md"), "evidence");
    await writeFile(
      join(root, ".natalia", "config.json"),
      JSON.stringify({
        version: 2,
        providers: {
          local: {
            type: "openai",
            apiKey: "key",
            baseURL: server.url.toString(),
          },
        },
        models: { text: { provider: "local", model: "text" } },
        defaultModel: "text",
      }),
    );
    const client = createRealRuntimeClient({
      workspaceRoot: root,
      sessionID: "ses_text_attachment",
    });
    client.start(() => undefined);
    await client.submitInput?.({ text: "review", attachments: ["notes.md"] });
    const messages = requests[0]?.messages as Array<{
      role: string;
      content: string;
    }>;
    expect(
      messages.find((message) => message.role === "user")?.content,
    ).toContain("[Attachment: notes.md]\nevidence");
  } finally {
    server.stop(true);
  }
});

test("runtime lowers a PDF attachment through the Anthropic adapter", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-pdf-attachment-"));
  const requests: Array<Record<string, unknown>> = [];
  const server = Bun.serve({
    port: 0,
    fetch: async (request) => {
      requests.push((await request.json()) as Record<string, unknown>);
      return new Response("data: [DONE]\n\n", {
        headers: { "content-type": "text/event-stream" },
      });
    },
  });
  try {
    await mkdir(join(root, ".natalia"), { recursive: true });
    await writeFile(join(root, "report.pdf"), "%PDF-1.7\n");
    await writeFile(
      join(root, ".natalia", "config.json"),
      JSON.stringify({
        version: 2,
        providers: {
          local: {
            type: "anthropic",
            apiKey: "key",
            baseURL: server.url.toString(),
          },
        },
        models: {
          pdf: {
            provider: "local",
            model: "pdf",
            capabilities: { pdfInput: true },
          },
        },
        defaultModel: "pdf",
      }),
    );
    const client = createRealRuntimeClient({
      workspaceRoot: root,
      sessionID: "ses_pdf_attachment",
    });
    client.start(() => undefined);
    await client.submitInput?.({ text: "read", attachments: ["report.pdf"] });
    const messages = requests[0]?.messages as Array<{
      content: Array<{ type?: string; source?: { media_type?: string } }>;
    }>;
    expect(
      messages[0]?.content.find((part) => part.type === "document"),
    ).toMatchObject({ source: { media_type: "application/pdf" } });
  } finally {
    server.stop(true);
  }
});

test("agent MCP server scope limits provider-visible MCP tools", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-agent-mcp-scope-"));
  await mkdir(join(root, ".natalia"), { recursive: true });
  await writeFile(
    join(root, ".natalia", "config.json"),
    JSON.stringify({
      version: 2,
      agents: { scoped: { description: "Scoped", mcpServers: ["one"] } },
      defaultAgent: "scoped",
    }),
  );
  const tools = createToolRegistry([]);
  for (const name of ["mcp_one_echo", "mcp_two_echo"]) {
    tools.set(name, {
      name,
      description: name,
      requiresApproval: false,
      parameters: { type: "object", properties: {} },
      async execute() {
        return "ok";
      },
    });
  }
  const requests: ProviderStreamRequest[] = [];
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_agent_mcp_scope",
    tools,
    provider: {
      provider: "test",
      model: "test",
      async *stream(request) {
        requests.push(request);
        yield { type: "done" as const };
      },
    },
  });
  client.start(() => undefined);
  await client.submit("scope MCP tools");
  expect(requests[0]?.tools?.map((tool) => tool.name)).toContain(
    "mcp_one_echo",
  );
  expect(requests[0]?.tools?.map((tool) => tool.name)).not.toContain(
    "mcp_two_echo",
  );
});

test("agent MCP scope includes only its server prompt and resource tools", async () => {
  const root = await mkdtemp(
    join(tmpdir(), "natalia-agent-mcp-catalog-scope-"),
  );
  await mkdir(join(root, ".natalia"), { recursive: true });
  await writeFile(
    join(root, ".natalia", "config.json"),
    JSON.stringify({
      version: 2,
      agents: { scoped: { description: "Scoped", mcpServers: ["one"] } },
      defaultAgent: "scoped",
    }),
  );
  const tools = createToolRegistry([]);
  for (const name of [
    "mcp_one_prompt_get",
    "mcp_one_resource_read",
    "mcp_two_prompt_get",
    "mcp_two_resource_read",
  ]) {
    tools.set(name, {
      name,
      description: name,
      requiresApproval: false,
      parameters: { type: "object", properties: {} },
      async execute() {
        return "ok";
      },
    });
  }
  const requests: ProviderStreamRequest[] = [];
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_agent_mcp_catalog_scope",
    tools,
    provider: {
      provider: "test",
      model: "test",
      async *stream(request) {
        requests.push(request);
        yield { type: "done" as const };
      },
    },
  });
  client.start(() => undefined);
  await client.submit("scope MCP catalog tools");
  const names = requests[0]?.tools?.map((tool) => tool.name) ?? [];
  expect(names).toEqual(
    expect.arrayContaining(["mcp_one_prompt_get", "mcp_one_resource_read"]),
  );
  expect(names).not.toEqual(
    expect.arrayContaining(["mcp_two_prompt_get", "mcp_two_resource_read"]),
  );
});

test("runtime persists and lowers structured agent resource mentions", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-runtime-mentions-"));
  await mkdir(join(root, ".natalia"), { recursive: true });
  await writeFile(
    join(root, ".natalia", "config.json"),
    JSON.stringify({
      version: 2,
      agents: { review: { description: "Review" } },
    }),
  );
  const requests: ProviderStreamRequest[] = [];
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_runtime_mentions",
    provider: {
      provider: "test",
      model: "test",
      async *stream(request) {
        requests.push(request);
        yield { type: "done" as const };
      },
    },
  });
  client.start(() => undefined);
  await client.submitInput?.({
    text: "inspect this",
    resources: [{ server: "missing", uri: "docs://guide", name: "Guide" }],
    agents: [{ name: "review" }],
  });
  expect(requests).toHaveLength(0);
  expect(client.lastSubmission?.()).toMatchObject({
    resources: [{ server: "missing", uri: "docs://guide", name: "Guide" }],
    agents: [{ name: "review" }],
  });
});

test("real runtime client routes checkpoint slash commands to real store", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-ts7-checkpoint-"));
  await writeFile(join(root, "test_example.py"), "print('ok')\n");
  const events: RuntimeEvent[] = [];
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_ts7_checkpoint",
    provider: scriptedProvider("unused"),
  });
  client.start((event) => events.push(event));
  await waitFor(() => events.some((event) => event.type === "session.ready"));
  await client.submit("/checkpoint");
  await writeFile(join(root, "created_after.py"), "print('new')\n");
  await client.submit("/rollback checkpoint_1 --dry-run");

  expect(
    events.some(
      (event) =>
        event.type === "checkpoint.created" && event.reason === "manual",
    ),
  ).toBe(true);
  expect(
    events.some(
      (event) => event.type === "rollback.previewed" && event.preview.dryRun,
    ),
  ).toBe(true);
});

test("real runtime client executes model tool calls with approval policy", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-ts7-tools-"));
  await writeFile(join(root, "input.txt"), "tool data\n");
  const events: RuntimeEvent[] = [];
  const provider = toolCallingProvider();
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_ts7_tools",
    provider,
    permissionMode: "auto",
  });
  client.start((event) => events.push(event));
  await client.submit("Read input.txt");

  expect(
    events.some(
      (event) =>
        event.type === "tool.update" &&
        event.name === "read_file" &&
        event.status === "succeeded",
    ),
  ).toBe(true);
  expect(
    events
      .filter((event) => event.type === "content.delta")
      .map((event) => event.text)
      .join(""),
  ).toContain("tool said: tool data");
  expect(
    provider.requests
      .at(-1)
      ?.messages.some(
        (message) =>
          message.role === "tool" && message.content.includes("tool data"),
      ),
  ).toBe(true);
});

test("run_shell constitution checks allow ordinary cat commands", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-shell-cat-"));
  await writeFile(join(root, "input.txt"), "shell data\n");
  const events: RuntimeEvent[] = [];
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_shell_cat",
    permissionMode: "auto",
    provider: {
      provider: "scripted-shell-cat",
      model: "scripted-shell-cat-model",
      async *stream(request) {
        if (!request.messages.some((message) => message.role === "tool")) {
          yield {
            type: "tool_call" as const,
            calls: [
              {
                id: "call_cat",
                name: "run_shell",
                arguments: JSON.stringify({ command: "cat input.txt" }),
              },
            ],
          };
          yield { type: "done" as const };
          return;
        }
        yield { type: "content" as const, text: "shell command completed" };
        yield { type: "done" as const };
      },
    },
  });
  client.start((event) => events.push(event));

  await client.submit("cat input.txt");

  expect(events).toContainEqual(
    expect.objectContaining({
      type: "tool.update",
      name: "run_shell",
      status: "succeeded",
      result: expect.stringContaining("shell data"),
    }),
  );
  expect(JSON.stringify(events)).not.toContain("DANGEROUS_SHELL_PATTERNS");
  expect(JSON.stringify(events)).not.toContain("dangerous shell patterns");
});

test("real runtime requests a final response after exhausting tool steps", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-ts7-tool-finalize-"));
  await writeFile(join(root, "input.txt"), "tool data\n");
  await mkdir(join(root, ".natalia"), { recursive: true });
  await writeFile(
    join(root, ".natalia", "config.json"),
    JSON.stringify({ version: 2, runtime: { maxStepsPerTurn: 10 } }),
  );
  const requests: ProviderStreamRequest[] = [];
  const provider: StreamingProvider = {
    provider: "scripted-tool-finalize",
    model: "scripted-tool-finalize-model",
    async *stream(request) {
      requests.push(request);
      if (request.tools === undefined) {
        yield { type: "content", text: "All tool checks completed." };
        yield { type: "done" };
        return;
      }
      yield {
        type: "tool_call",
        calls: [
          {
            id: `call_read_${requests.length}`,
            name: "read_file",
            arguments: JSON.stringify({ path: "input.txt" }),
          },
        ],
      };
      yield { type: "done" };
    },
  };
  const events: RuntimeEvent[] = [];
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_ts7_tool_finalize",
    provider,
    permissionMode: "auto",
  });
  client.start((event) => events.push(event));
  await client.submit("run every tool step");

  expect(requests).toHaveLength(11);
  expect(requests.at(-1)?.tools).toBeUndefined();
  expect(
    events
      .filter((event) => event.type === "content.delta")
      .map((event) => event.text)
      .join(""),
  ).toContain("All tool checks completed.");
  expect(
    events.filter((event) => event.type === "turn.finished").at(-1),
  ).toMatchObject({
    type: "turn.finished",
    stopReason: "done",
  });
});

test("tool turns require a non-empty final assistant response", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-ts7-final-response-"));
  await writeFile(join(root, "input.txt"), "tool data\n");
  let requests = 0;
  const events: RuntimeEvent[] = [];
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_ts7_final_response",
    permissionMode: "auto",
    provider: {
      provider: "scripted-final-response",
      model: "scripted-final-response-model",
      async *stream(request) {
        requests += 1;
        if (!request.messages.some((message) => message.role === "tool")) {
          yield {
            type: "tool_call",
            calls: [
              {
                id: "call_read_final",
                name: "read_file",
                arguments: JSON.stringify({ path: "input.txt" }),
              },
            ],
          };
        } else if (request.tools === undefined) {
          yield {
            type: "content",
            text: "The file check completed successfully.",
          };
        }
        yield { type: "done" };
      },
    },
  });
  client.start((event) => events.push(event));
  await client.submit("check the file");

  expect(requests).toBe(3);
  expect(
    events
      .filter((event) => event.type === "content.delta")
      .map((event) => event.text)
      .join(""),
  ).toBe("The file check completed successfully.");
  expect(events).toContainEqual({
    type: "turn.finished",
    id: expect.any(String),
    stopReason: "done",
    sessionID: "ses_ts7_final_response",
  });
});

test("tool turns complete with a reason when the model omits its final response", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-ts7-missing-final-"));
  await writeFile(join(root, "input.txt"), "tool data\n");
  const events: RuntimeEvent[] = [];
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_ts7_missing_final",
    permissionMode: "auto",
    provider: {
      provider: "scripted-missing-final",
      model: "scripted-missing-final-model",
      async *stream(request) {
        if (!request.messages.some((message) => message.role === "tool")) {
          yield {
            type: "tool_call",
            calls: [
              {
                id: "call_read_missing_final",
                name: "read_file",
                arguments: JSON.stringify({ path: "input.txt" }),
              },
            ],
          };
        }
        yield { type: "done" };
      },
    },
  });
  client.start((event) => events.push(event));
  await client.submit("check the file");

  expect(events).toContainEqual({
    type: "turn.finished",
    id: expect.any(String),
    stopReason: "done",
    reason: "missing_final_response",
    sessionID: "ses_ts7_missing_final",
  });
  expect(
    events.some(
      (event) => event.type === "diagnostic" && event.level === "error",
    ),
  ).toBe(false);
});

test("ordinary tools settle as failed when their execution timeout expires", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-ts7-tool-timeout-"));
  const tools = createToolRegistry([]);
  tools.set("wait_forever", {
    name: "wait_forever",
    description: "Wait until the runtime cancels this tool.",
    requiresApproval: false,
    timeoutSec: 0.01,
    parameters: { type: "object", properties: {} },
    async execute() {
      return await new Promise<string>(() => undefined);
    },
  });
  const events: RuntimeEvent[] = [];
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_ts7_tool_timeout",
    tools,
    provider: {
      provider: "scripted-tool-timeout",
      model: "scripted-tool-timeout-model",
      async *stream(request) {
        if (!request.messages.some((message) => message.role === "tool")) {
          yield {
            type: "tool_call",
            calls: [
              {
                id: "call_wait",
                name: "wait_forever",
                arguments: "{}",
              },
            ],
          };
        } else {
          yield { type: "content", text: "The tool timed out; task stopped." };
        }
        yield { type: "done" };
      },
    },
  });
  client.start((event) => events.push(event));
  await client.submit("wait forever");

  expect(
    events.find(
      (event) =>
        event.type === "tool.update" &&
        event.callID === "call_wait" &&
        event.status === "failed",
    ),
  ).toBeDefined();
  expect(events).toContainEqual({
    type: "turn.finished",
    id: expect.any(String),
    stopReason: "done",
    sessionID: "ses_ts7_tool_timeout",
  });
});

test("runtime status counts managed background processes", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-runtime-background-"));
  const handled = new Set<string>();
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_runtime_background",
    permissionMode: "auto",
    provider: {
      provider: "test",
      model: "test",
      async *stream(request) {
        const text = [...request.messages]
          .reverse()
          .find((message) => message.role === "user")?.content;
        if (typeof text === "string" && !handled.has(text)) {
          handled.add(text);
          yield {
            type: "tool_call" as const,
            calls: [
              text === "start"
                ? {
                    id: "start",
                    name: "process_start",
                    arguments: JSON.stringify({
                      id: "proc_status",
                      command: "sleep 30",
                    }),
                  }
                : {
                    id: "stop",
                    name: "process_stop",
                    arguments: JSON.stringify({ id: "proc_status" }),
                  },
            ],
          };
        }
        yield { type: "done" as const };
      },
    },
  });
  const events: RuntimeEvent[] = [];
  client.start((event) => events.push(event));
  await client.submit("start");
  expect(await client.runtimeStatus?.()).toMatchObject({
    background: "1 running",
  });
  await waitFor(() =>
    events.some(
      (event) =>
        event.type === "status.snapshot" && event.background === "1 running",
    ),
  );
  await client.submit("stop");
  expect(await client.runtimeStatus?.()).toMatchObject({
    background: "0 running",
  });
  await waitFor(() =>
    events.some(
      (event) =>
        event.type === "status.snapshot" && event.background === "0 running",
    ),
  );
});

test("write approval uses a compact preview and preserves raw request detail", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-ts7-approval-preview-"));
  const events: RuntimeEvent[] = [];
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_ts7_approval_preview",
    provider: approvalWriteProvider(),
  });
  client.start((event) => {
    events.push(event);
    if (event.type === "approval.request")
      client.respondApproval({ requestID: event.id, decision: "once" });
  });
  await client.submit("write a note");
  const approval = events.find(
    (event): event is Extract<RuntimeEvent, { type: "approval.request" }> =>
      event.type === "approval.request",
  )!;
  expect(approval.preview).toContain("Write long-note.md");
  expect(approval.preview.length).toBeLessThan(300);
  expect(approval.detail).toContain('"content"');
});

test("cancelling a pending approval settles the active turn without polling", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-ts7-approval-cancel-"));
  const events: RuntimeEvent[] = [];
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_ts7_approval_cancel",
    provider: approvalWriteProvider(),
  });
  let cancelled = false;
  client.start((event) => {
    events.push(event);
    if (event.type === "approval.request" && !cancelled) {
      cancelled = true;
      client.cancel("approval cancelled");
    }
  });

  await client.submit("write then cancel");
  expect(events.some((event) => event.type === "turn.cancelled")).toBe(true);
  expect(
    events.some(
      (event) =>
        event.type === "turn.finished" && event.stopReason === "cancelled",
    ),
  ).toBe(true);
  expect(
    events.filter(
      (event) =>
        event.type === "turn.finished" && event.stopReason === "cancelled",
    ),
  ).toHaveLength(1);
});

test("provider admission is persisted before the provider turn begins", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-ts7-admission-"));
  let started = false;
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_ts7_admission",
    provider: {
      provider: "test",
      model: "test",
      async *stream() {
        started = true;
        yield { type: "content" as const, text: "done" };
        yield { type: "done" as const };
      },
    },
  });
  client.start(() => undefined);
  const submitted = await client.submit("persist me first");
  expect(started).toBe(true);
  const stored = JSON.parse(
    await readFile(
      join(root, ".natalia", "sessions", "ses_ts7_admission.json"),
      "utf8",
    ),
  ) as { events: RuntimeEvent[]; inbox?: Array<Record<string, unknown>> };
  expect(
    stored.events.some(
      (event) => event.type === "turn.submitted" && event.id === submitted.id,
    ),
  ).toBe(true);
  expect(stored.inbox).toMatchObject([
    {
      id: submitted.id,
      text: "persist me first",
      delivery: "steer",
      promotedAt: expect.any(String),
    },
  ]);
});

test("queued input wakes an idle session after durable admission", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-ts7-queued-input-"));
  let started = false;
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_ts7_queued_input",
    provider: {
      provider: "test",
      model: "test",
      async *stream() {
        started = true;
        yield { type: "done" as const };
      },
    },
  });
  client.start(() => undefined);
  const submitted = await client.submitInput!({
    text: "wait for idle",
    delivery: "queue",
  });
  await waitFor(() => started, 5000, "the queued input to start streaming");
  expect(started).toBe(true);
  const stored = JSON.parse(
    await readFile(
      join(root, ".natalia", "sessions", "ses_ts7_queued_input.json"),
      "utf8",
    ),
  ) as { inbox?: Array<Record<string, unknown>> };
  expect(stored.inbox).toMatchObject([
    { id: submitted.id, text: "wait for idle", delivery: "queue" },
  ]);
  expect(stored.inbox?.[0]?.promotedAt).toEqual(expect.any(String));
});

test("queued input promotes after the active steer turn becomes idle", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-ts7-queued-promotion-"));
  const requests: string[] = [];
  let release: (() => void) | undefined;
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_ts7_queued_promotion",
    provider: {
      provider: "test",
      model: "test",
      async *stream(request) {
        requests.push(request.messages.at(-1)?.content ?? "");
        if (requests.length === 1)
          await new Promise<void>((resolve) => (release = resolve));
        yield { type: "content" as const, text: "done" };
        yield { type: "done" as const };
      },
    },
  });
  client.start(() => undefined);
  const first = client.submit("first");
  while (!release) await Bun.sleep(1);
  const queued = await client.submitInput!({
    text: "queued",
    delivery: "queue",
  });
  release();
  await first;
  expect(requests).toEqual(["first", "queued"]);
  const stored = JSON.parse(
    await readFile(
      join(root, ".natalia", "sessions", "ses_ts7_queued_promotion.json"),
      "utf8",
    ),
  ) as { inbox?: Array<{ id: string; promotedAt?: string }> };
  expect(
    stored.inbox?.find((item) => item.id === queued.id)?.promotedAt,
  ).toEqual(expect.any(String));
});

test("exact input retry does not duplicate a completed provider turn", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-ts7-input-retry-"));
  let calls = 0;
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_ts7_input_retry",
    provider: {
      provider: "test",
      model: "test",
      async *stream() {
        calls++;
        yield { type: "done" as const };
      },
    },
  });
  client.start(() => undefined);
  await client.submitInput!({
    id: "turn_retry",
    text: "same",
    delivery: "steer",
  });
  await client.submitInput!({
    id: "turn_retry",
    text: "same",
    delivery: "steer",
  });
  expect(calls).toBe(1);
  await expect(
    client.submitInput!({
      id: "turn_retry",
      text: "different",
      delivery: "steer",
    }),
  ).rejects.toThrow("session input conflicts");
});

test("restart resumes a pending queued input but does not replay interrupted provider work", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-ts7-restart-queue-"));
  await mkdir(join(root, ".natalia", "sessions"), { recursive: true });
  await writeFile(
    join(root, ".natalia", "sessions", "ses_ts7_restart_queue.json"),
    JSON.stringify({
      id: "ses_ts7_restart_queue",
      title: "Interrupted",
      createdAt: "2026-07-21T00:00:00.000Z",
      cancelled: false,
      resumable: true,
      metadata: {
        inFlightOperation: {
          kind: "provider_dispatch",
          turnID: "turn_interrupted",
          startedAt: "2026-07-21T00:00:01.000Z",
        },
      },
      events: [
        {
          type: "turn.submitted",
          id: "turn_interrupted",
          text: "unsafe to replay",
          byteLength: 16,
          lineCount: 1,
          sha256: "test",
        },
      ],
      inbox: [
        {
          id: "turn_queued",
          sessionID: "ses_ts7_restart_queue",
          text: "safe queued",
          delivery: "queue",
          admittedAt: "2026-07-21T00:00:00.000Z",
        },
      ],
    }),
  );

  const events: RuntimeEvent[] = [];
  let calls = 0;
  const reopened = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_ts7_restart_queue",
    provider: {
      provider: "test",
      model: "test",
      async *stream() {
        calls++;
        yield { type: "done" as const };
      },
    },
  });
  reopened.start((event) => events.push(event));
  // A cold start replays the session, registers tools and rebuilds context
  // before it can wake the queued input, so the budget is the runtime's
  // startup, not a single tick.
  await waitFor(
    () => calls > 0,
    5000,
    "the queued input to reach the provider",
  );
  expect(calls).toBe(1);
  await waitFor(
    () =>
      events.some(
        (event) => event.type === "turn.finished" && event.id === "turn_queued",
      ),
    5000,
    "the queued turn to finish",
  );
  expect(
    events.some(
      (event) =>
        event.type === "diagnostic" &&
        event.message.includes("provider dispatch") &&
        event.message.includes("cannot be replayed"),
    ),
  ).toBe(true);
  const persisted = JSON.parse(
    await readFile(
      join(root, ".natalia", "sessions", "ses_ts7_restart_queue.json"),
      "utf8",
    ),
  );
  expect(persisted.metadata?.inFlightOperation).toBeUndefined();
});

test("restart safely settles a durable tool execution window without replaying its side effect", async () => {
  const root = await mkdtemp(
    join(tmpdir(), "natalia-ts7-restart-tool-window-"),
  );
  await mkdir(join(root, ".natalia", "sessions"), { recursive: true });
  await writeFile(
    join(root, ".natalia", "sessions", "ses_ts7_restart_tool_window.json"),
    JSON.stringify({
      id: "ses_ts7_restart_tool_window",
      title: "Interrupted tool",
      createdAt: "2026-07-21T00:00:00.000Z",
      cancelled: false,
      resumable: true,
      metadata: {
        inFlightOperation: {
          kind: "tool_execution",
          turnID: "turn_interrupted_tool",
          toolName: "write_file",
          toolCallID: "call_write",
          startedAt: "2026-07-21T00:00:01.000Z",
        },
      },
      events: [
        {
          type: "turn.submitted",
          id: "turn_interrupted_tool",
          text: "write this once",
          byteLength: 15,
          lineCount: 1,
          sha256: "test",
        },
        {
          type: "tool.update",
          id: "turn_interrupted_tool:call_write",
          name: "write_file",
          callID: "call_write",
          status: "running",
          summary: "running",
          startedAt: 1,
        },
      ],
      inbox: [
        {
          id: "turn_queued_after_tool",
          sessionID: "ses_ts7_restart_tool_window",
          text: "safe queued",
          delivery: "queue",
          admittedAt: "2026-07-21T00:00:00.000Z",
        },
      ],
    }),
  );

  const events: RuntimeEvent[] = [];
  let calls = 0;
  const reopened = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_ts7_restart_tool_window",
    provider: {
      provider: "test",
      model: "test",
      async *stream() {
        calls++;
        yield { type: "done" as const };
      },
    },
  });
  reopened.start((event) => events.push(event));
  await waitFor(
    () => calls > 0,
    5000,
    "the queued input to reach the provider",
  );
  expect(calls).toBe(1);
  await waitFor(
    () =>
      events.some(
        (event) =>
          event.type === "turn.finished" &&
          event.id === "turn_queued_after_tool",
      ),
    5000,
    "the queued turn to finish",
  );
  expect(
    events.some(
      (event) =>
        event.type === "turn.finished" &&
        event.id === "turn_interrupted_tool" &&
        event.stopReason === "error",
    ),
  ).toBe(true);
  expect(
    events.some(
      (event) =>
        event.type === "diagnostic" &&
        event.message.includes("tool execution") &&
        event.message.includes("cannot be replayed"),
    ),
  ).toBe(true);
});

test("runtime history supplies a stable local cursor without SQLite", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-ts7-history-"));
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_ts7_history",
    provider: {
      provider: "test",
      model: "test",
      async *stream() {
        yield { type: "done" as const };
      },
    },
  });
  client.start(() => undefined);
  await client.submit("one");
  await client.submit("two");
  const first = await client.history!({ limit: 1 });
  expect(first.events).toHaveLength(1);
  expect(first.hasMore).toBe(true);
  const next = await client.history!({
    after: first.events[0]!.seq,
    limit: 100,
  });
  expect(next.events[0]!.seq).toBe(first.events[0]!.seq + 1);
});

test("durable history retains full assistant settlement without live fragments", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-ts7-durable-content-"));
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_ts7_durable_content",
    provider: {
      provider: "test",
      model: "test",
      async *stream() {
        yield { type: "content" as const, text: "hello " };
        yield { type: "content" as const, text: "world" };
        yield { type: "done" as const };
      },
    },
  });
  client.start(() => undefined);
  await client.submit("greet");
  const stored = JSON.parse(
    await readFile(
      join(root, ".natalia", "sessions", "ses_ts7_durable_content.json"),
      "utf8",
    ),
  ) as { events: RuntimeEvent[] };
  expect(stored.events.some((event) => event.type === "content.delta")).toBe(
    false,
  );
  expect(
    stored.events.find((event) => event.type === "content.done"),
  ).toMatchObject({ text: "hello world" });
});

test("restart restores the latest durable context checkpoint before later events", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-ts7-context-epoch-"));
  const requests: Array<{
    messages: Array<{ role: string; content: string }>;
  }> = [];
  const first = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_ts7_context_epoch",
    provider: {
      provider: "test",
      model: "test",
      async *stream() {
        yield { type: "content" as const, text: "first answer" };
        yield { type: "done" as const };
      },
    },
  });
  first.start(() => undefined);
  await first.submit("first question");
  const persisted = JSON.parse(
    await readFile(
      join(root, ".natalia", "sessions", "ses_ts7_context_epoch.json"),
      "utf8",
    ),
  ) as { events: RuntimeEvent[] };
  expect(
    persisted.events.some((event) => event.type === "context.checkpoint"),
  ).toBe(true);

  const reopened = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_ts7_context_epoch",
    provider: {
      provider: "test",
      model: "test",
      async *stream(request) {
        requests.push({
          messages: request.messages.map((message) => ({
            role: message.role,
            content: message.content,
          })),
        });
        yield { type: "done" as const };
      },
    },
  });
  const reopenedEvents: RuntimeEvent[] = [];
  reopened.start((event) => reopenedEvents.push(event));
  await Bun.sleep(5);
  const initializationFailure = reopenedEvents.find(
    (event) => event.type === "diagnostic" && event.level === "error",
  );
  expect(initializationFailure).toBeUndefined();
  await reopened.submit("second question");
  expect(requests[0]?.messages).toEqual(
    expect.arrayContaining([
      { role: "user", content: "first question" },
      { role: "assistant", content: "first answer" },
      { role: "user", content: "second question" },
    ]),
  );
});

test("context-limit compaction persists a durable context epoch", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-ts7-context-compaction-"));
  let attempts = 0;
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_ts7_context_compaction",
    provider: {
      provider: "test",
      model: "test",
      async *stream() {
        attempts++;
        if (attempts === 1)
          throw providerError({
            kind: "context_limit",
            message: "context limit",
          });
        yield { type: "content" as const, text: "recovered" };
        yield { type: "done" as const };
      },
    },
  });
  client.start(() => undefined);
  await client.submit("compact then retry");
  const stored = JSON.parse(
    await readFile(
      join(root, ".natalia", "sessions", "ses_ts7_context_compaction.json"),
      "utf8",
    ),
  ) as { events: RuntimeEvent[] };
  expect(
    stored.events.some((event) => event.type === "context.checkpoint"),
  ).toBe(true);
});

test("SQLite restart restores context from epoch baseline without duplicate history", async () => {
  const root = await mkdtemp(
    join(tmpdir(), "natalia-ts7-sqlite-context-epoch-"),
  );
  const first = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_ts7_sqlite_context_epoch",
    useSqliteStore: true,
    provider: {
      provider: "test",
      model: "test",
      async *stream() {
        yield { type: "content" as const, text: "first answer" };
        yield { type: "done" as const };
      },
    },
  });
  first.start(() => undefined);
  await first.submit("first question");

  const requests: Array<{
    messages: Array<{ role: string; content: string }>;
  }> = [];
  const reopened = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_ts7_sqlite_context_epoch",
    useSqliteStore: true,
    provider: {
      provider: "test",
      model: "test",
      async *stream(request) {
        requests.push({
          messages: request.messages.map((message) => ({
            role: message.role,
            content: message.content,
          })),
        });
        yield { type: "done" as const };
      },
    },
  });
  reopened.start(() => undefined, { replay: "none" });
  await reopened.submit("second question");
  const restored = requests[0]!.messages;
  expect(
    restored.filter((message) => message.content === "first question"),
  ).toHaveLength(1);
  expect(
    restored.filter((message) => message.content === "first answer"),
  ).toHaveLength(1);
  expect(
    restored.filter((message) => message.content === "second question"),
  ).toHaveLength(1);
});

test("SQLite indexed replay recovers pending interactive control state", async () => {
  const root = await mkdtemp(
    join(tmpdir(), "natalia-ts7-sqlite-indexed-interactive-"),
  );
  const sessionID = "ses_ts7_sqlite_indexed_interactive" as SessionID;
  const databasePath = join(root, ".natalia", "sessions.db");
  await mkdir(join(root, ".natalia"), { recursive: true });
  const store = new SqliteSessionStore(databasePath);
  store.create(sessionID, "Indexed interactive");
  store.appendEvents(sessionID, [
    {
      type: "context.checkpoint",
      id: "epoch_indexed_interactive",
      snapshot: {
        entries: [],
        resources: [],
        journalOffset: 0,
        step: 0,
        tokenEstimate: 0,
        compactionGeneration: 0,
      },
    },
    {
      type: "approval.request",
      id: "approval_indexed",
      title: "Write",
      preview: "file",
    },
    {
      type: "question.request",
      id: "question_indexed",
      title: "Choice",
    },
  ]);
  store.close();

  const events: RuntimeEvent[] = [];
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID,
    useSqliteStore: true,
    provider: scriptedProvider("unused"),
  });
  client.start((event) => events.push(event), { replay: "none" });
  await waitFor(() => events.some((event) => event.type === "session.ready"));
  expect(await client.pendingInteractive!()).toMatchObject({
    approvals: [{ id: "approval_indexed" }],
    questions: [{ id: "question_indexed" }],
  });
  expect(events).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        type: "approval.request",
        id: "approval_indexed",
      }),
      expect.objectContaining({
        type: "question.request",
        id: "question_indexed",
      }),
    ]),
  );
  await client.dispose?.();
});

test("SQLite indexed replay recovers bounded durable diagnostics", async () => {
  const root = await mkdtemp(
    join(tmpdir(), "natalia-ts7-sqlite-indexed-diagnostics-"),
  );
  const sessionID = "ses_ts7_sqlite_indexed_diagnostics" as SessionID;
  const databasePath = join(root, ".natalia", "sessions.db");
  await mkdir(join(root, ".natalia"), { recursive: true });
  const store = new SqliteSessionStore(databasePath);
  store.create(sessionID, "Indexed diagnostics");
  store.appendEvents(sessionID, [
    {
      type: "context.checkpoint",
      id: "epoch_indexed_diagnostics",
      snapshot: {
        entries: [],
        resources: [],
        journalOffset: 0,
        step: 0,
        tokenEstimate: 0,
        compactionGeneration: 0,
      },
    },
    {
      type: "diagnostic",
      level: "warning",
      message: "durable indexed diagnostic",
      at: "2026-07-25T00:00:00.000Z",
    },
  ]);
  store.close();

  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID,
    useSqliteStore: true,
    provider: scriptedProvider("unused"),
  });
  client.start(() => undefined, { replay: "none" });
  await Bun.sleep(50);
  expect(await client.diagnostics?.(10)).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ message: "durable indexed diagnostic" }),
    ]),
  );
  await client.dispose?.();
});

test("restart projects unresolved interactive requests from durable events", async () => {
  const root = await mkdtemp(
    join(tmpdir(), "natalia-ts7-interactive-restart-"),
  );
  await mkdir(join(root, ".natalia", "sessions"), { recursive: true });
  await writeFile(
    join(root, ".natalia", "sessions", "ses_ts7_interactive_restart.json"),
    JSON.stringify({
      id: "ses_ts7_interactive_restart",
      title: "Interactive",
      createdAt: "2026-07-21T00:00:00.000Z",
      cancelled: false,
      resumable: true,
      events: [
        {
          type: "approval.request",
          id: "approval_open",
          title: "Write",
          preview: "file",
        },
        {
          type: "approval.request",
          id: "approval_closed",
          title: "Shell",
          preview: "pwd",
        },
        { type: "approval.response", id: "approval_closed", decision: "once" },
        { type: "question.request", id: "question_open", title: "Choice" },
      ],
    }),
  );
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_ts7_interactive_restart",
    provider: toolCallingProvider(),
  });
  client.start(() => undefined);
  expect(await client.pendingInteractive!()).toMatchObject({
    approvals: [{ id: "approval_open" }],
    questions: [{ id: "question_open" }],
  });
  client.respondApproval({ requestID: "approval_open", decision: "once" });
  client.respondQuestion({ requestID: "question_open", answers: [["answer"]] });
  client.respondApproval({ requestID: "approval_open", decision: "reject" });
  client.respondQuestion({ requestID: "question_open", answers: [["late"]] });
  expect(await client.pendingInteractive!()).toEqual({
    approvals: [],
    questions: [],
  });
  const history = await client.history!({ limit: 100 });
  expect(
    history.events.filter(
      (entry) =>
        entry.event.type === "approval.response" &&
        entry.event.id === "approval_open",
    ),
  ).toHaveLength(1);
  expect(
    history.events.filter(
      (entry) =>
        entry.event.type === "question.response" &&
        entry.event.id === "question_open",
    ),
  ).toHaveLength(1);
});

test("restart durably rejects orphaned interactive requests from a crashed turn", async () => {
  const root = await mkdtemp(
    join(tmpdir(), "natalia-ts7-interrupted-interactive-restart-"),
  );
  await mkdir(join(root, ".natalia", "sessions"), { recursive: true });
  await writeFile(
    join(root, ".natalia", "sessions", "ses_ts7_interrupted_interactive.json"),
    JSON.stringify({
      id: "ses_ts7_interrupted_interactive",
      title: "Interrupted interactive",
      createdAt: "2026-07-21T00:00:00.000Z",
      cancelled: false,
      resumable: true,
      events: [
        {
          type: "turn.submitted",
          id: "turn_crashed",
          text: "write",
          byteLength: 5,
          lineCount: 1,
          sha256: "test",
        },
        {
          type: "approval.request",
          id: "turn_crashed:write",
          title: "Write",
          preview: "file",
        },
        {
          type: "question.request",
          id: "turn_crashed:write:question",
          title: "Confirm",
        },
        {
          type: "approval.request",
          id: "independent_approval",
          title: "Independent",
          preview: "safe",
        },
      ],
    }),
  );
  const events: RuntimeEvent[] = [];
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_ts7_interrupted_interactive",
    provider: toolCallingProvider(),
  });
  client.start((event) => events.push(event));

  expect(await client.pendingInteractive!()).toEqual({
    approvals: [expect.objectContaining({ id: "independent_approval" })],
    questions: [],
  });
  const history = await client.history!({ limit: 100 });
  expect(history.events.map((entry) => entry.event)).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        type: "approval.response",
        id: "turn_crashed:write",
        decision: "reject",
      }),
      expect.objectContaining({
        type: "question.response",
        id: "turn_crashed:write:question",
        rejected: true,
      }),
      expect.objectContaining({
        type: "turn.finished",
        id: "turn_crashed",
        stopReason: "error",
      }),
    ]),
  );
  expect(events).toContainEqual(
    expect.objectContaining({
      type: "diagnostic",
      level: "warning",
      message: expect.stringContaining(
        "unresolved interactive requests were rejected",
      ),
    }),
  );
});

test("provider can load a discovered skill through the canonical tool path", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-ts7-skill-tool-"));
  const skillRoot = join(root, ".natalia", "skills", "review");
  await mkdir(join(skillRoot, "references"), { recursive: true });
  await writeFile(
    join(skillRoot, "SKILL.md"),
    "---\nname: review\ndescription: Review\n---\nReview guidance",
  );
  await writeFile(join(skillRoot, "references", "guide.md"), "guide");
  const events: RuntimeEvent[] = [];
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_ts7_skill_tool",
    permissionMode: "auto",
    provider: {
      provider: "test",
      model: "test",
      async *stream(request) {
        if (!request.messages.some((message) => message.role === "tool")) {
          yield {
            type: "tool_call" as const,
            calls: [
              {
                id: "call_skill",
                name: "skill_load",
                arguments: JSON.stringify({ name: "review" }),
              },
            ],
          };
          yield { type: "done" as const };
          return;
        }
        yield { type: "content" as const, text: "skill loaded" };
        yield { type: "done" as const };
      },
    },
  });
  client.start((event) => events.push(event));
  await client.submit("load review skill");
  expect(
    events.some(
      (event) =>
        event.type === "tool.update" &&
        event.name === "skill_load" &&
        event.status === "succeeded",
    ),
  ).toBe(true);
  expect(
    events.some(
      (event) => event.type === "content.done" && event.text === "skill loaded",
    ),
  ).toBe(true);
});

test("two local clients serialize provider turns for one durable session", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-ts7-shared-session-"));
  const order: string[] = [];
  let releaseFirst: (() => void) | undefined;
  const provider = (label: string) => ({
    provider: "test",
    model: "test",
    async *stream() {
      order.push(`${label}:start`);
      if (label === "first")
        await new Promise<void>((resolve) => (releaseFirst = resolve));
      order.push(`${label}:end`);
      yield { type: "done" as const };
    },
  });
  const first = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_ts7_shared_session",
    provider: provider("first"),
  });
  const second = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_ts7_shared_session",
    provider: provider("second"),
  });
  first.start(() => undefined);
  second.start(() => undefined);
  const firstSubmit = first.submit("one");
  while (!releaseFirst) await Bun.sleep(1);
  const secondSubmit = second.submit("two");
  await Bun.sleep(2);
  expect(order).toEqual(["first:start"]);
  releaseFirst?.();
  await Promise.all([firstSubmit, secondSubmit]);
  expect(order).toEqual([
    "first:start",
    "first:end",
    "second:start",
    "second:end",
  ]);
});

test("real runtime client discovers and activates native Skills", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-ts7-skills-"));
  const skillRoot = join(root, ".natalia", "skills", "read-only");
  await mkdir(skillRoot, { recursive: true });
  await writeFile(
    join(skillRoot, "SKILL.md"),
    "---\nname: read-only\ndescription: Read files only\nallowed-tools: [read_file]\n---\nInspect before changing.",
  );
  const events: RuntimeEvent[] = [];
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_ts7_skills",
    provider: scriptedProvider("unused"),
  });
  client.start((event) => events.push(event));
  await waitFor(() => events.some((event) => event.type === "session.ready"));
  await client.submit("/skills");
  await client.submit("/skill read-only");
  expect(
    events.some(
      (event) =>
        event.type === "content.delta" &&
        event.text.includes("project:read-only"),
    ),
  ).toBe(true);
  expect(
    events.some(
      (event) =>
        event.type === "content.delta" &&
        event.text.includes("activated skill project:read-only"),
    ),
  ).toBe(true);
});

test("real runtime client provides provider-independent doctor and help commands", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-ts7-doctor-"));
  const events: RuntimeEvent[] = [];
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_ts7_doctor",
  });
  client.start((event) => events.push(event));
  await waitFor(() => events.some((event) => event.type === "session.ready"));
  await client.submit("/doctor");
  await client.submit("/help");

  const output = events
    .filter((event) => event.type === "content.delta")
    .map((event) => event.text)
    .join("\n");
  expect(output).toContain("Natalia TS7 runtime doctor");
  expect(output).toContain("provider: not configured");
  expect(output).toContain("/checkpoint");
  expect(output).toContain(
    "the application-layer host allowlist only covers fetch-style tools",
  );
  expect(output).toContain("run_shell and native terminal input");
});

test("real runtime client records provider usage checkpoints", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-ts7-usage-"));
  const events: RuntimeEvent[] = [];
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_ts7_usage",
    provider: usageProvider(),
  });
  client.start((event) => events.push(event));
  await client.submit("Track usage");

  expect(
    events.some(
      (event) =>
        event.type === "context.status" &&
        event.used === 15 &&
        event.source === "exact_checkpoint",
    ),
  ).toBe(true);
});

test("real runtime forks a session at a submitted-turn boundary", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-ts7-session-fork-"));
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_ts7_session_fork",
    provider: scriptedProvider("answer"),
  });
  client.start(() => undefined);
  const first = await client.submit("first");
  const second = await client.submit("second");

  const fork = await client.sessionFork!("ses_ts7_session_fork", second.id);
  const child = JSON.parse(
    await readFile(
      join(root, ".natalia", "sessions", `${fork.id}.json`),
      "utf8",
    ),
  ) as { events: RuntimeEvent[] };
  expect(fork.title).toBe("Natalia TS session ses_ts7_session_fork (fork)");
  expect(
    child.events.some(
      (event) => event.type === "turn.submitted" && event.text === "second",
    ),
  ).toBe(false);
  expect(
    child.events.some(
      (event) => event.type === "turn.submitted" && event.text === "first",
    ),
  ).toBe(true);
});

test("real runtime exposes projected message pages independently from event history", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-ts7-message-pages-"));
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_ts7_message_pages",
    provider: scriptedProvider("answer"),
  });
  client.start(() => undefined);
  await client.submit("first");
  await client.submit("second");

  const page = await client.messages!({ order: "asc", limit: 1 });
  expect(page.data).toHaveLength(1);
  expect(page.data[0]).toMatchObject({
    id: expect.stringMatching(/^turn_/u),
    submitted: { text: "first" },
  });
  expect(page.data[0]?.rows.map((row) => row.kind)).toContain("assistant");
  expect(page.cursor.next).toEqual(expect.any(String));
  expect((await client.history!({ limit: 1 })).events[0]?.event.type).toBe(
    "checkpoint.created",
  );
});

test("real runtime client publishes provider chunks before stream completion", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-ts7-live-stream-"));
  const events: RuntimeEvent[] = [];
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_ts7_live_stream",
    provider: delayedStreamingProvider(),
  });
  client.start((event) => events.push(event));
  const submission = client.submit("stream live");
  await waitFor(() =>
    events.some(
      (event) => event.type === "content.delta" && event.text === "first ",
    ),
  );
  expect(events.some((event) => event.type === "turn.finished")).toBe(false);
  await submission;
  expect(
    events
      .filter((event) => event.type === "content.delta")
      .map((event) => event.text)
      .join(""),
  ).toBe("first second");
});

test("real runtime client compacts once and retries on context-limit errors", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-ts7-context-limit-"));
  const events: RuntimeEvent[] = [];
  const provider = contextLimitThenSuccessProvider();
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_ts7_context_limit",
    provider,
  });
  client.start((event) => events.push(event));
  await client.submit("Recover context");

  expect(provider.calls).toBe(3);
  expect(
    events.some(
      (event) => event.type === "context.limit.recovery" && event.compacted,
    ),
  ).toBe(true);
  expect(
    events.some((event) => event.type === "compaction.end" && event.success),
  ).toBe(true);
  expect(
    events.some(
      (event) => event.type === "content.delta" && event.text === "recovered",
    ),
  ).toBe(true);
});

test("real runtime client writes inside its selected workspace after approval", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-ts7-workspace-tool-"));
  const events: RuntimeEvent[] = [];
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_ts7_workspace_tool",
    provider: writeFileProvider(),
  });
  client.start((event) => {
    events.push(event);
    if (event.type === "approval.request")
      client.respondApproval({ requestID: event.id, decision: "once" });
  });
  await client.submit("create a workspace file");

  expect(await readFile(join(root, "hello-ts7.txt"), "utf8")).toBe(
    "hello from TS7\n",
  );
  expect(
    events.some(
      (event) => event.type === "tool.update" && event.status === "succeeded",
    ),
  ).toBe(true);
});

test("session intelligence writer publishes real snapshot facts for a working turn", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-ts7-intelligence-"));
  const events: RuntimeEvent[] = [];
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_ts7_intelligence",
    provider: writeFileProvider(),
  });
  client.start((event) => {
    events.push(event);
    if (event.type === "approval.request")
      client.respondApproval({ requestID: event.id, decision: "once" });
  });
  await client.submit("create a workspace file");

  const snapshots = events.filter(
    (event): event is Extract<RuntimeEvent, { type: "session.snapshot" }> =>
      event.type === "session.snapshot",
  );
  expect(snapshots.length).toBeGreaterThan(0);

  // The snapshot reflects the real turn lifecycle: running while the turn is
  // active, idle after it settles.
  const running = snapshots.find(
    (snapshot) => snapshot.agentStatus === "running",
  );
  expect(running).toBeDefined();
  const settled = snapshots.find((snapshot) => snapshot.agentStatus === "idle");
  expect(settled).toBeDefined();

  // The write tool is the active tool on at least one snapshot, and the Work
  // Graph records the workspace change the snapshot counts.
  const withTool = snapshots.find(
    (snapshot) => snapshot.activeTool === "write_file",
  );
  expect(withTool).toBeDefined();
  const last = snapshots.at(-1);
  expect(last?.changedFiles).toBeGreaterThan(0);
  expect(last?.unvalidatedChanges).toBeGreaterThan(0);

  // Secret-safe: no file content, no tool arguments, no command text.
  const serialized = JSON.stringify(snapshots);
  expect(serialized).not.toContain("hello from TS7");
  expect(serialized).not.toContain("call_write");
});

test("session intelligence writer survives replay with the same facts", async () => {
  const root = await mkdtemp(
    join(tmpdir(), "natalia-ts7-intelligence-replay-"),
  );
  const initial = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_ts7_intelligence_replay",
    provider: writeFileProvider(),
  });
  initial.start((event) => {
    if (event.type === "approval.request")
      initial.respondApproval({ requestID: event.id, decision: "once" });
  });
  await initial.submit("create a workspace file");
  await pollHistoryForFinished(initial);

  const replayed: RuntimeEvent[] = [];
  const reopened = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_ts7_intelligence_replay",
    provider: writeFileProvider(),
  });
  reopened.start((event) => replayed.push(event));
  await waitFor(() => replayed.some((event) => event.type === "session.ready"));

  const snapshots = replayed.filter(
    (event): event is Extract<RuntimeEvent, { type: "session.snapshot" }> =>
      event.type === "session.snapshot",
  );
  expect(snapshots.length).toBeGreaterThan(0);
  expect(snapshots.at(-1)?.changedFiles).toBeGreaterThan(0);
  expect(snapshots.at(-1)?.agentStatus).toBe("idle");
  expect(JSON.stringify(snapshots)).not.toContain("hello from TS7");
});

test("session intelligence read model answers the latest published snapshot", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-ts7-intelligence-read-"));
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_ts7_intelligence_read",
    provider: writeFileProvider(),
  });
  client.start((event) => {
    if (event.type === "approval.request")
      client.respondApproval({ requestID: event.id, decision: "once" });
  });
  await client.submit("create a workspace file");
  await pollHistoryForFinished(client);

  // Before the writer existed this answered `undefined` forever. Now the RPC
  // member reports the latest durable snapshot with real work facts.
  const snapshot = await client.sessionSnapshot?.();
  expect(snapshot).toBeDefined();
  expect(snapshot?.changedFiles).toBeGreaterThan(0);
  expect(snapshot?.agentStatus).toBe("idle");
  expect(snapshot?.hasPTY).toBe(false);
  expect(snapshot?.hasSandbox).toBe(false);
});

test("the self-protection rules are seeded as the first constitution facts", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-ts7-constitution-"));
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_ts7_constitution",
    provider: {
      provider: "test",
      model: "test",
      async *stream() {
        yield { type: "done" as const };
      },
    },
  });
  const events: RuntimeEvent[] = [];
  client.start((event) => events.push(event));
  await client.submit("hello");
  await pollHistoryForFinished(client);

  const rules = await client.constitutionRules!();
  expect(rules.map((rule) => rule.ruleID)).toEqual([
    "C-TERM-001",
    "C-TERM-002",
    "C-TERM-003",
  ]);
  for (const rule of rules)
    expect(rule).toMatchObject({
      scope: "release",
      priority: "critical",
      source: "policy",
      enforcement: "deny",
      overridePolicy: "forbidden",
    });
  expect(
    events.some(
      (event) =>
        event.type === "constitution.rule_added" &&
        event.ruleID === "C-TERM-001",
    ),
  ).toBe(true);
});

test("recordDecision writes a durable decision fact", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-ts7-decision-"));
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_ts7_decision",
    provider: {
      provider: "test",
      model: "test",
      async *stream() {
        yield { type: "done" as const };
      },
    },
  });
  const events: RuntimeEvent[] = [];
  client.start((event) => events.push(event));
  await client.submit("hello");
  await pollHistoryForFinished(client);

  const outcome = await client.recordDecision?.({
    decision: "workspace isolation is not container/VM security",
    rationale: ["the sandbox is a workspace boundary"],
    linkedConstraints: ["C-TERM-001"],
  });
  expect(outcome).toEqual({ recorded: true });
  const records = await client.decisionRecords!();
  expect(records).toHaveLength(1);
  expect(records[0]).toMatchObject({
    decision: "workspace isolation is not container/VM security",
    rationale: ["the sandbox is a workspace boundary"],
    status: "accepted",
    linkedConstraints: ["C-TERM-001"],
  });
  expect(
    events.some(
      (event) =>
        event.type === "decision.recorded" &&
        event.decision === "workspace isolation is not container/VM security",
    ),
  ).toBe(true);
});

test("seeded constitution rules and decisions are Work Graph constraint/decision nodes (CST4)", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-ts7-cst4-"));
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_ts7_cst4",
    provider: {
      provider: "test",
      model: "test",
      async *stream() {
        yield { type: "done" as const };
      },
    },
  });
  const events: RuntimeEvent[] = [];
  client.start((event) => events.push(event));
  await client.submit("hello");
  await pollHistoryForFinished(client);

  // Each seeded self-protection rule is a constraint node in the graph.
  const constraintNodes = events.filter(
    (event): event is Extract<RuntimeEvent, { type: "workgraph.node_added" }> =>
      event.type === "workgraph.node_added" && event.kind === "constraint",
  );
  expect(constraintNodes.length).toBeGreaterThanOrEqual(3);
  expect(constraintNodes.some((node) => node.target === "C-TERM-001")).toBe(
    true,
  );

  // A recorded decision becomes a decision node.
  await client.recordDecision?.({
    decision: "default no commit/push",
    rationale: ["the framework should never write to git without asking"],
  });
  expect(
    events.some(
      (event) =>
        event.type === "workgraph.node_added" && event.kind === "decision",
    ),
  ).toBe(true);
});

test("constitution rules and decisions survive replay", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-ts7-const-replay-"));
  const initial = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_ts7_const_replay",
    provider: {
      provider: "test",
      model: "test",
      async *stream() {
        yield { type: "done" as const };
      },
    },
  });
  initial.start(() => {});
  await initial.submit("hello");
  await initial.recordDecision?.({
    decision: "default no commit/push",
  });
  await pollHistoryForFinished(initial);

  const replayed: RuntimeEvent[] = [];
  const reopened = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_ts7_const_replay",
    provider: {
      provider: "test",
      model: "test",
      async *stream() {
        yield { type: "done" as const };
      },
    },
  });
  reopened.start((event) => replayed.push(event));
  await reopened.submit("again");
  await pollHistoryForFinished(reopened);

  const rules = await reopened.constitutionRules!();
  expect(rules.map((rule) => rule.ruleID)).toEqual([
    "C-TERM-001",
    "C-TERM-002",
    "C-TERM-003",
  ]);
  const decisions = await reopened.decisionRecords!();
  expect(decisions.map((decision) => decision.decision)).toContain(
    "default no commit/push",
  );
  // Replay must not duplicate the seeded rules: the reopened session replays
  // the original three rule_added events to the sink and the idempotent seed
  // skips them — exactly three, not six.
  const ruleAdded = replayed.filter(
    (
      event,
    ): event is Extract<RuntimeEvent, { type: "constitution.rule_added" }> =>
      event.type === "constitution.rule_added",
  );
  expect(ruleAdded.map((event) => event.ruleID).sort()).toEqual([
    "C-TERM-001",
    "C-TERM-002",
    "C-TERM-003",
  ]);
});

test("recordValidation runs a command and records durable evidence", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-ts7-evidence-"));
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_ts7_evidence",
    provider: {
      provider: "test",
      model: "test",
      async *stream() {
        yield { type: "done" as const };
      },
    },
  });
  const events: RuntimeEvent[] = [];
  client.start((event) => events.push(event));
  await client.submit("hello");
  await pollHistoryForFinished(client);

  const passed = await client.recordValidation?.({
    taskID: "task_build",
    objective: "verify the build passes",
    command: "exit 0",
  });
  expect(passed).toEqual({ recorded: true, result: "passed", safeSummary: "" });
  const failed = await client.recordValidation?.({
    taskID: "task_build",
    objective: "verify the build passes",
    command: "exit 1",
  });
  expect(failed?.result).toBe("failed");

  const records = await client.evidenceRecords!();
  expect(records).toHaveLength(2);
  expect(records[0]).toMatchObject({
    taskID: "task_build",
    status: "validated",
    validations: [{ command: "exit 0", result: "passed" }],
  });
  expect(records[1]).toMatchObject({
    status: "failed",
    validations: [{ command: "exit 1", result: "failed" }],
  });
  expect(
    events.filter(
      (event): event is Extract<RuntimeEvent, { type: "evidence.recorded" }> =>
        event.type === "evidence.recorded",
    ).length,
  ).toBe(2);
});

test("recordValidation redacts secrets from the recorded summary", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-ts7-evidence-redact-"));
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_ts7_evidence_redact",
    provider: {
      provider: "test",
      model: "test",
      async *stream() {
        yield { type: "done" as const };
      },
    },
  });
  client.start(() => {});
  await client.submit("hello");
  await pollHistoryForFinished(client);

  await client.recordValidation?.({
    taskID: "task_secret",
    objective: "a validation that prints a secret",
    command: 'printf "api_key=supersecretvalue\\n"; exit 0',
  });
  const records = await client.evidenceRecords!();
  const summary = records[0]?.validations[0]?.safeSummary ?? "";
  expect(summary).not.toContain("supersecretvalue");
  expect(JSON.stringify(records)).not.toContain("supersecretvalue");
});

test("recordValidation rejects empty task id or command without recording", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-ts7-evidence-reject-"));
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_ts7_evidence_reject",
    provider: {
      provider: "test",
      model: "test",
      async *stream() {
        yield { type: "done" as const };
      },
    },
  });
  const events: RuntimeEvent[] = [];
  client.start((event) => events.push(event));
  await client.submit("hello");
  await pollHistoryForFinished(client);

  const outcome = await client.recordValidation?.({
    taskID: "",
    objective: "x",
    command: "exit 0",
  });
  expect(outcome).toEqual({ recorded: false });
  expect(events.some((event) => event.type === "evidence.recorded")).toBe(
    false,
  );
});

test("recordCompletion records a card, its projection and validated_by edges", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-ts7-completion-"));
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_ts7_completion",
    provider: {
      provider: "test",
      model: "test",
      async *stream() {
        yield { type: "done" as const };
      },
    },
  });
  const events: RuntimeEvent[] = [];
  client.start((event) => events.push(event));
  await client.submit("hello");
  await pollHistoryForFinished(client);

  const outcome = await client.recordCompletion?.({
    taskID: "task_build",
    objective: "verify the build",
    changeSummary: "added the build check",
    behaviorImpact: "CI now runs typecheck",
    validations: [
      { command: "npm run typecheck", result: "passed", safeSummary: "ok" },
    ],
    humanValidation: "reviewed by owner",
    knownGaps: ["no windows coverage"],
    externalSideEffects: ["writes .tmp"],
    rollbackState: "available",
    evidenceIDs: ["evidence:1"],
    changePaths: ["src/build.ts"],
  });
  expect(outcome?.recorded).toBe(true);
  expect(outcome?.completionID).toBeDefined();

  const cards = await client.completions!();
  expect(cards).toHaveLength(1);
  expect(cards[0]).toMatchObject({
    taskID: "task_build",
    changeSummary: "added the build check",
    validations: [{ command: "npm run typecheck", result: "passed" }],
    humanValidation: "reviewed by owner",
    knownGaps: ["no windows coverage"],
    rollbackState: "available",
    evidenceIDs: ["evidence:1"],
  });

  // The completion card validated the change via a validated_by Work Graph edge.
  expect(
    events.some(
      (event) =>
        event.type === "workgraph.edge_added" &&
        event.kind === "validated_by" &&
        event.targetID.includes("completion"),
    ),
  ).toBe(true);
});

test("recordCompletion rejects an empty task id or change summary", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-ts7-completion-reject-"));
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_ts7_completion_reject",
    provider: {
      provider: "test",
      model: "test",
      async *stream() {
        yield { type: "done" as const };
      },
    },
  });
  client.start(() => {});
  await client.submit("hello");
  await pollHistoryForFinished(client);

  expect(
    await client.recordCompletion?.({
      taskID: "",
      objective: "x",
      changeSummary: "y",
    }),
  ).toEqual({ recorded: false });
});

test("a completed plan drives its task's evidence to accepted (E3 status policy)", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-ts7-e3-policy-"));
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_ts7_e3_policy",
    provider: {
      provider: "test",
      model: "test",
      async *stream() {
        yield { type: "done" as const };
      },
    },
  });
  client.start((event) => {
    if (event.type === "approval.request" && event.scope === "plan_acceptance")
      client.respondApproval({ requestID: event.id, decision: "once" });
  });
  await client.submit("hello");
  await pollHistoryForFinished(client);

  // Evidence recorded for the task.
  await client.recordValidation?.({
    taskID: "task_e3",
    objective: "verify the build",
    command: "exit 0",
  });

  // A plan that verifies the task, driven through the lifecycle.
  const created = await client.planCreate?.({
    title: "Verify the build task",
    author: "live_chat",
    objective: "verify the build task",
    steps: [{ id: "s1", title: "run validation" }],
    taskID: "task_e3",
  });
  const planID = created!.planID!;
  await client.planPropose?.(planID);
  await client.planAccept?.(planID);
  await client.planQueue?.(planID);
  await client.submit("second");
  await pollHistoryForFinished(client);
  // Active plan -> evidence effective status "implemented".
  let evidence = await client.evidenceRecords!();
  expect(evidence[0]?.effectiveStatus).toBe("implemented");

  await client.planCompleted?.(planID);
  evidence = await client.evidenceRecords!();
  expect(evidence[0]?.effectiveStatus).toBe("accepted");
  expect(evidence[0]?.status).toBe("validated");
});

test("planCompleted rejects a plan that is not active", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-ts7-plan-complete-rej-"));
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_ts7_plan_complete_rej",
    provider: {
      provider: "test",
      model: "test",
      async *stream() {
        yield { type: "done" as const };
      },
    },
  });
  client.start(() => {});
  await client.submit("hello");
  await pollHistoryForFinished(client);

  const created = await client.planCreate?.({
    title: "Draft only",
    author: "live_chat",
    objective: "never activated",
    steps: [{ id: "s1", title: "first" }],
  });
  expect(await client.planCompleted?.(created!.planID!)).toEqual({
    completed: false,
  });
});

test("mailbox send/list/deliver/acknowledge records a durable lifecycle", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-ts7-mailbox-"));
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_ts7_mailbox",
    provider: {
      provider: "test",
      model: "test",
      async *stream() {
        yield { type: "done" as const };
      },
    },
  });
  const events: RuntimeEvent[] = [];
  client.start((event) => events.push(event));
  await client.submit("hello");
  await pollHistoryForFinished(client);

  const sent = await client.mailboxSend?.({
    intent: "reprioritize",
    text: "focus on the docs task first",
    safeSummary: "user asked to reprioritize",
    priority: "high",
    deliveryPolicy: "next_safe_boundary",
  });
  expect(sent?.queued).toBe(true);
  expect(sent?.messageID).toBeDefined();

  let mailbox = await client.mailboxList!();
  expect(mailbox).toHaveLength(1);
  expect(mailbox[0]).toMatchObject({
    intent: "reprioritize",
    priority: "high",
    text: "focus on the docs task first",
    status: "queued",
    deliveryPolicy: "next_safe_boundary",
  });

  expect(await client.mailboxDeliver?.(sent!.messageID!)).toEqual({
    delivered: true,
  });
  expect((await client.mailboxList!())[0]?.status).toBe("delivered");

  expect(await client.mailboxAcknowledge?.(sent!.messageID!)).toEqual({
    acknowledged: true,
  });
  expect((await client.mailboxList!())[0]?.status).toBe("acknowledged");

  expect(
    events.filter((event) => event.type.startsWith("mailbox.")).length,
  ).toBe(3);
  expect(
    events.some(
      (event) =>
        event.type === "mailbox.queued" &&
        event.intent === "reprioritize" &&
        event.safeSummary === "user asked to reprioritize",
    ),
  ).toBe(true);
});

test("mailbox defer and supersede move a queued message out of the way", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-ts7-mailbox-def-"));
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_ts7_mailbox_def",
    provider: {
      provider: "test",
      model: "test",
      async *stream() {
        yield { type: "done" as const };
      },
    },
  });
  client.start(() => {});
  await client.submit("hello");
  await pollHistoryForFinished(client);

  const sent = await client.mailboxSend?.({
    intent: "constraint",
    text: "never merge a failing build",
    safeSummary: "a merge constraint",
  });
  expect(
    await client.mailboxDefer?.(sent!.messageID!, "unsafe boundary"),
  ).toEqual({ deferred: true });
  expect((await client.mailboxList!())[0]?.status).toBe("deferred");
  expect((await client.mailboxList!())[0]?.reason).toBe("unsafe boundary");

  const second = await client.mailboxSend?.({
    intent: "cancel",
    text: "stop the current plan",
    safeSummary: "cancel requested",
  });
  expect(
    await client.mailboxSupersede?.(second!.messageID!, "superseded by newer"),
  ).toEqual({ superseded: true });
  expect((await client.mailboxList!())[1]?.status).toBe("superseded");

  // A delivered message cannot be acknowledged twice or delivered twice.
  expect(await client.mailboxDefer?.(sent!.messageID!, "again")).toEqual({
    deferred: false,
  });
  expect(await client.mailboxAcknowledge?.(sent!.messageID!)).toEqual({
    acknowledged: false,
  });
});

test("mailboxSend redacts secrets from the recorded safe summary", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-ts7-mailbox-redact-"));
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_ts7_mailbox_redact",
    provider: {
      provider: "test",
      model: "test",
      async *stream() {
        yield { type: "done" as const };
      },
    },
  });
  client.start(() => {});
  await client.submit("hello");
  await pollHistoryForFinished(client);

  await client.mailboxSend?.({
    intent: "constraint",
    text: "api_key=supersecretvalue",
    safeSummary: "api_key=supersecretvalue",
  });
  const mailbox = await client.mailboxList!();
  expect(mailbox[0]?.safeSummary).not.toContain("supersecretvalue");
  expect(JSON.stringify(mailbox)).not.toContain("supersecretvalue");
});

test("queued mailbox messages are delivered at the next turn safe boundary", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-ts7-mailbox-safe-"));
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_ts7_mailbox_safe",
    provider: {
      provider: "test",
      model: "test",
      async *stream() {
        yield { type: "done" as const };
      },
    },
  });
  client.start(() => {});
  await client.submit("first");
  await pollHistoryForFinished(client);

  // No turn running: the intent wakes the idle main agent immediately (P8 §7)
  // instead of sitting queued until the next manual turn.
  await client.mailboxSend?.({
    intent: "reprioritize",
    text: "focus on docs",
    safeSummary: "reprioritize to docs",
  });
  await waitForAsync(
    async () => (await client.mailboxList!())[0]?.status === "acknowledged",
  );
  const mailbox = await client.mailboxList!();
  expect(mailbox[0]?.status).toBe("acknowledged");
  expect(
    mailbox[0]?.deliveryPolicy === undefined
      ? "next_safe_boundary"
      : mailbox[0]?.deliveryPolicy,
  ).toBe("next_safe_boundary");
});

test("deferred and superseded mailbox messages are not auto-delivered at a boundary", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-ts7-mailbox-safe-def-"));
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_ts7_mailbox_safe_def",
    provider: {
      provider: "test",
      model: "test",
      async *stream() {
        yield { type: "done" as const };
      },
    },
  });
  client.start(() => {});
  await client.submit("first");
  await pollHistoryForFinished(client);

  const deferred = await client.mailboxSend?.({
    intent: "constraint",
    text: "never merge failing",
    safeSummary: "a constraint",
  });
  const superseded = await client.mailboxSend?.({
    intent: "cancel",
    text: "stop the plan",
    safeSummary: "cancel",
  });
  expect(
    await client.mailboxDefer?.(deferred!.messageID!, "unsafe boundary"),
  ).toEqual({ deferred: true });
  expect(
    await client.mailboxSupersede?.(superseded!.messageID!, "newer"),
  ).toEqual({ superseded: true });

  await client.submit("second");
  await pollHistoryForFinished(client);

  const mailbox = await client.mailboxList!();
  const byIntent = new Map(mailbox.map((m) => [m.intent, m.status]));
  expect(byIntent.get("constraint")).toBe("deferred");
  expect(byIntent.get("cancel")).toBe("superseded");
});

test("a manually delivered mailbox message is not re-delivered at a boundary", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-ts7-mailbox-safe-man-"));
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_ts7_mailbox_safe_man",
    provider: {
      provider: "test",
      model: "test",
      async *stream() {
        yield { type: "done" as const };
      },
    },
  });
  client.start(() => {});
  await client.submit("first");
  await pollHistoryForFinished(client);

  const sent = await client.mailboxSend?.({
    intent: "request_report",
    text: "summarize",
    safeSummary: "a report request",
  });
  expect(await client.mailboxDeliver?.(sent!.messageID!)).toEqual({
    delivered: true,
  });

  await client.submit("second");
  await pollHistoryForFinished(client);

  // The manually delivered message was injected into turn 2's context, so the
  // turn's finish acknowledges it (consumption-driven settlement) and it is not
  // re-delivered by the boundary.
  expect((await client.mailboxList!())[0]?.status).toBe("acknowledged");
});

test("a mailbox message sent mid-turn is delivered when that turn finishes", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-ts7-mailbox-midturn-"));
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_ts7_mailbox_midturn",
    provider: {
      provider: "test",
      model: "test",
      async *stream() {
        yield { type: "content" as const, text: "working" };
        await new Promise((resolve) => setTimeout(resolve, 60));
        yield { type: "done" as const };
      },
    },
  });
  const events: RuntimeEvent[] = [];
  client.start((event) => events.push(event));

  const submitting = client.submit("long task");
  // Wait until the provider is actually streaming so the turn is definitely
  // active when the message is sent (turn.submitted alone fires before the
  // drain starts).
  await waitFor(() => events.some((event) => event.type === "content.delta"));
  await client.mailboxSend?.({
    intent: "pause",
    text: "please pause after this step",
    safeSummary: "pause requested",
  });
  expect((await client.mailboxList!())[0]?.status).toBe("queued");

  await submitting;
  await pollHistoryForFinished(client);
  expect((await client.mailboxList!())[0]?.status).toBe("delivered");
});

test("delivered mailbox intents reach the main agent in the next turn system prompt", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-ts7-mailbox-inject-"));
  let systemPrompts: string[] = [];
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_ts7_mailbox_inject",
    provider: {
      provider: "test",
      model: "test",
      async *stream(request) {
        const system = request.messages.find(
          (message) => message.role === "system",
        );
        if (system && typeof system.content === "string")
          systemPrompts.push(system.content);
        yield { type: "done" as const };
      },
    },
  });
  client.start(() => {});
  await client.submit("first");
  await pollHistoryForFinished(client);

  // No turn running: the intent wakes the idle agent, whose wake turn's
  // system prompt already carries it.
  await client.mailboxSend?.({
    intent: "constraint",
    text: "never commit the lockfile",
    safeSummary: "a commit constraint",
    priority: "high",
  });
  await waitFor(() => systemPrompts.length > 1);
  const wakePrompt = systemPrompts.at(-1) ?? "";
  expect(wakePrompt).toContain("<pending_user_intents>");
  expect(wakePrompt).toContain("[high] constraint");
  expect(wakePrompt).toContain("never commit the lockfile");
  expect(wakePrompt).toContain("</pending_user_intents>");
  // The wake turn finishes after its prompt is captured, so wait for the ack.
  await waitForAsync(
    async () => (await client.mailboxList!())[0]?.status === "acknowledged",
  );
  expect((await client.mailboxList!())[0]?.status).toBe("acknowledged");
});

test("plan drafts move through the full lifecycle with version bumps", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-ts7-plan-"));
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_ts7_plan",
    provider: {
      provider: "test",
      model: "test",
      async *stream() {
        yield { type: "done" as const };
      },
    },
  });
  const events: RuntimeEvent[] = [];
  client.start((event) => {
    events.push(event);
    if (event.type === "approval.request" && event.scope === "plan_acceptance")
      client.respondApproval({ requestID: event.id, decision: "once" });
  });
  await client.submit("hello");
  await pollHistoryForFinished(client);

  const created = await client.planCreate?.({
    title: "Switch to Bun-native HTTP",
    author: "live_chat",
    objective: "replace the fetch wrapper with Bun.serve",
    steps: [
      { id: "s1", title: "introduce the server", verification: "typecheck" },
    ],
    constraints: ["keep 127.0.0.1 default"],
  });
  expect(created?.created).toBe(true);
  expect(created?.planID).toBeDefined();
  const planID = created!.planID!;

  let plans = await client.planList!();
  expect(plans).toHaveLength(1);
  expect(plans[0]).toMatchObject({
    planID,
    version: 1,
    title: "Switch to Bun-native HTTP",
    author: "live_chat",
    status: "draft",
    objective: "replace the fetch wrapper with Bun.serve",
  });

  expect(await client.planPropose?.(planID)).toEqual({ proposed: true });
  expect((await client.planList!())[0]?.status).toBe("proposed");

  expect(await client.planAccept?.(planID)).toEqual({ accepted: true });
  expect((await client.planList!())[0]?.status).toBe("accepted");

  expect(await client.planQueue?.(planID)).toEqual({ queued: true });
  expect((await client.planList!())[0]?.status).toBe("queued_next_plan");

  expect(await client.planActivate?.(planID)).toEqual({ activated: true });
  const active = (await client.planList!())[0];
  expect(active?.status).toBe("active");
  expect(active?.version).toBe(5);

  // Out-of-order transitions are rejected (an active plan cannot be proposed).
  expect(await client.planPropose?.(planID)).toEqual({ proposed: false });
  expect(
    events.filter(
      (event): event is Extract<RuntimeEvent, { type: "plan.proposed" }> =>
        event.type === "plan.proposed",
    ).length,
  ).toBe(1);
});

test("plan update bumps the version and supersede keeps the reason", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-ts7-plan-upd-"));
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_ts7_plan_upd",
    provider: {
      provider: "test",
      model: "test",
      async *stream() {
        yield { type: "done" as const };
      },
    },
  });
  client.start((event) => {
    if (event.type === "approval.request" && event.scope === "plan_acceptance")
      client.respondApproval({ requestID: event.id, decision: "once" });
  });
  await client.submit("hello");
  await pollHistoryForFinished(client);

  const created = await client.planCreate?.({
    title: "Old plan",
    author: "live_chat",
    objective: "do it the old way",
    steps: [{ id: "s1", title: "first" }],
  });
  const planID = created!.planID!;

  expect(
    await client.planUpdate?.({
      planID,
      reason: "add verification",
    }),
  ).toEqual({ updated: true });
  expect((await client.planList!())[0]?.version).toBe(2);

  expect(await client.planSupersede?.(planID, "a newer plan arrived")).toEqual({
    superseded: true,
  });
  const superseded = (await client.planList!())[0];
  expect(superseded?.status).toBe("superseded");
  expect(superseded?.reason).toBe("a newer plan arrived");
  // A superseded plan cannot be proposed.
  expect(await client.planPropose?.(planID)).toEqual({ proposed: false });
});

test("plan acceptance requires an approval and a reject leaves the plan proposed", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-ts7-plan-accept-reject-"));
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_ts7_plan_accept_reject",
    provider: {
      provider: "test",
      model: "test",
      async *stream() {
        yield { type: "done" as const };
      },
    },
  });
  // Reject every plan-acceptance approval.
  client.start((event) => {
    if (event.type === "approval.request" && event.scope === "plan_acceptance")
      client.respondApproval({ requestID: event.id, decision: "reject" });
  });
  await client.submit("hello");
  await pollHistoryForFinished(client);

  const created = await client.planCreate?.({
    title: "Rejected plan",
    author: "live_chat",
    objective: "this plan is rejected",
    steps: [{ id: "s1", title: "first" }],
  });
  const planID = created!.planID!;
  await client.planPropose?.(planID);

  const outcome = await client.planAccept?.(planID);
  expect(outcome).toEqual({ accepted: false });
  // Rejection leaves the plan proposed — it is not silently accepted.
  expect((await client.planList!())[0]?.status).toBe("proposed");
  expect(
    (await client.planList!())[0]?.status === "proposed" &&
      (await client.planList!())[0]?.version,
  ).toBe(2);
});

test("a queued-next plan activates automatically at the next turn boundary", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-ts7-plan-activate-"));
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_ts7_plan_activate",
    provider: {
      provider: "test",
      model: "test",
      async *stream() {
        yield { type: "done" as const };
      },
    },
  });
  client.start((event) => {
    if (event.type === "approval.request" && event.scope === "plan_acceptance")
      client.respondApproval({ requestID: event.id, decision: "once" });
  });
  await client.submit("first");
  await pollHistoryForFinished(client);

  const created = await client.planCreate?.({
    title: "Next plan",
    author: "live_chat",
    objective: "the next phase",
    steps: [{ id: "s1", title: "step one" }],
  });
  const planID = created!.planID!;
  await client.planPropose?.(planID);
  await client.planAccept?.(planID);
  await client.planQueue?.(planID);
  expect((await client.planList!())[0]?.status).toBe("queued_next_plan");

  // A finished turn is the safe completion point: the queued plan activates.
  await client.submit("second");
  await pollHistoryForFinished(client);
  const plan = (await client.planList!())[0];
  expect(plan?.status).toBe("active");
  // Version bumped on activation (created v1 -> proposed v2 -> accepted v3 ->
  // queued v4 -> active v5).
  expect(plan?.version).toBe(5);
});

test("an auto-activated plan reaches the next turn as a NextPlanHandoff", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-ts7-plan-handoff-"));
  let systemPrompts: string[] = [];
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_ts7_plan_handoff",
    provider: {
      provider: "test",
      model: "test",
      async *stream(request) {
        const system = request.messages.find(
          (message) => message.role === "system",
        );
        if (system && typeof system.content === "string")
          systemPrompts.push(system.content);
        yield { type: "done" as const };
      },
    },
  });
  client.start((event) => {
    if (event.type === "approval.request" && event.scope === "plan_acceptance")
      client.respondApproval({ requestID: event.id, decision: "once" });
  });
  await client.submit("first");
  await pollHistoryForFinished(client);

  const created = await client.planCreate?.({
    title: "The next phase",
    author: "live_chat",
    objective: "deliver the next phase",
    steps: [{ id: "s1", title: "start", verification: "typecheck" }],
    constraints: ["keep loopback default"],
  });
  const planID = created!.planID!;
  await client.planPropose?.(planID);
  await client.planAccept?.(planID);
  await client.planQueue?.(planID);

  // Turn 2 activates the plan at its boundary; turn 2's own prompt (assembled
  // before the boundary) must not carry the handoff.
  await client.submit("second");
  await pollHistoryForFinished(client);
  expect(systemPrompts.at(-1)).not.toContain("<next_plan_handoff>");

  // Turn 3 runs after activation, so its prompt carries the structured handoff.
  await client.submit("third");
  await pollHistoryForFinished(client);
  const prompt = systemPrompts.at(-1) ?? "";
  expect(prompt).toContain("<next_plan_handoff>");
  expect(prompt).toContain("The next phase");
  expect(prompt).toContain("deliver the next phase");
  expect(prompt).toContain("s1: start");
  expect(prompt).toContain("keep loopback default");
  expect(prompt).toContain("</next_plan_handoff>");
});

test("mailbox_acknowledge marks delivered messages acknowledged and stops re-injection", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-ts7-mailbox-ack-tool-"));
  let ackAttempted = 0;
  let systemPrompts: string[] = [];
  let sentID = "";
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_ts7_mailbox_ack_tool",
    provider: {
      provider: "test",
      model: "test",
      async *stream(request) {
        const system = request.messages.find(
          (message) => message.role === "system",
        );
        if (system && typeof system.content === "string")
          systemPrompts.push(system.content);
        const pending = systemPrompts
          .at(-1)
          ?.includes("<pending_user_intents>");
        // Acknowledge exactly once, when the pending intent is actually
        // injected (turn 3) and we know the message id.
        if (pending && ackAttempted === 0 && sentID) {
          ackAttempted += 1;
          yield {
            type: "tool_call" as const,
            calls: [
              {
                id: "call_ack",
                name: "mailbox_acknowledge",
                arguments: JSON.stringify({ messageIDs: [sentID] }),
              },
            ],
          };
        }
        yield { type: "done" as const };
      },
    },
  });
  const events: RuntimeEvent[] = [];
  client.start((event) => events.push(event));
  await client.submit("first");
  await pollHistoryForFinished(client);

  // Seed a queued mailbox message while idle.
  await client.mailboxSend?.({
    intent: "constraint",
    text: "never commit the lockfile",
    safeSummary: "a constraint",
  });
  sentID = (await client.mailboxList!())[0]!.messageID;

  // Turn 2's boundary delivers the intent; turn 3 injects it and the model
  // acknowledges it via the tool.
  await client.submit("second");
  await pollHistoryForFinished(client);
  expect(systemPrompts.at(-1)).not.toContain("never commit the lockfile");

  await client.submit("third");
  await pollHistoryForFinished(client);
  expect(ackAttempted).toBe(1);
  expect(events.some((event) => event.type === "mailbox.acknowledged")).toBe(
    true,
  );

  // Turn 4 no longer injects it (acknowledged messages are excluded).
  await client.submit("fourth");
  await pollHistoryForFinished(client);
  const last = systemPrompts.at(-1) ?? "";
  expect(last).not.toContain("never commit the lockfile");
});

test("delivered mailbox intents are auto-acknowledged at the next turn finish (no tool needed)", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-ts7-mailbox-consume-"));
  let systemPrompts: string[] = [];
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_ts7_mailbox_consume",
    provider: {
      provider: "test",
      model: "test",
      async *stream(request) {
        const system = request.messages.find(
          (message) => message.role === "system",
        );
        if (system && typeof system.content === "string")
          systemPrompts.push(system.content);
        yield { type: "done" as const };
      },
    },
  });
  const events: RuntimeEvent[] = [];
  client.start((event) => events.push(event));
  await client.submit("first");
  await pollHistoryForFinished(client);

  // Seed an intent while idle: the agent wakes and the wake turn sees it; its
  // finish auto-acknowledges it (consumption-driven, no tool needed).
  await client.mailboxSend?.({
    intent: "constraint",
    text: "never merge a failing build",
    safeSummary: "a merge constraint",
  });
  await waitFor(() => systemPrompts.length > 1);
  expect(systemPrompts.at(-1)).toContain("never merge a failing build");
  await waitForAsync(
    async () => (await client.mailboxList!())[0]?.status === "acknowledged",
  );

  // A later turn no longer injects it.
  await client.submit("next");
  await pollHistoryForFinished(client);
  const last = systemPrompts.at(-1) ?? "";
  expect(last).not.toContain("never merge a failing build");
});

test("a turn that does not finish normally does not auto-acknowledge delivered intents", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-ts7-mailbox-error-"));
  let streamCalls = 0;
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_ts7_mailbox_error",
    provider: {
      provider: "test",
      model: "test",
      async *stream() {
        streamCalls++;
        if (streamCalls === 1) {
          // The warm-up turn completes normally.
          yield { type: "done" as const };
          return;
        }
        // The second turn errors mid-stream: it is not a "done" settlement, so
        // it must not acknowledge a delivered intent.
        yield { type: "content" as const, text: "half" };
        await new Promise((resolve) => setTimeout(resolve, 200));
        throw new Error("provider failed");
      },
    },
  });
  const events: RuntimeEvent[] = [];
  client.start((event) => events.push(event));
  await client.submit("first");
  await pollHistoryForFinished(client);

  // Send the intent mid-turn (the running turn keeps the coordinator active, so
  // no wake turn spawns), then deliver it explicitly so it is "delivered".
  events.length = 0;
  const running = client.submit("long");
  await waitFor(() => events.some((event) => event.type === "content.delta"));
  const sent = await client.mailboxSend?.({
    intent: "pause",
    text: "pause after this",
    safeSummary: "pause requested",
  });
  expect((await client.mailboxList!())[0]?.status).toBe("queued");
  if (sent?.messageID) await client.mailboxDeliver?.(sent.messageID);
  expect((await client.mailboxList!())[0]?.status).toBe("delivered");

  // The running turn errors out: not a "done" finish, so the delivered intent
  // stays delivered for another turn to see.
  await running;
  await pollHistoryForFinished(client);
  expect((await client.mailboxList!())[0]?.status).toBe("delivered");
});

test("evaluateDrift opens durable findings and driftFindings answers them", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-ts7-drift-"));
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_ts7_drift",
    provider: {
      provider: "test",
      model: "test",
      async *stream() {
        yield { type: "done" as const };
      },
    },
  });
  const events: RuntimeEvent[] = [];
  client.start((event) => events.push(event));
  await client.submit("hello");
  await pollHistoryForFinished(client);

  const opened = await client.evaluateDrift?.({
    objective: "implement user authentication",
    currentActivity: "refactoring the css theme",
    applicableConstraints: ["never commit generated files"],
    changes: [{ action: "modified", path: "src/theme.css" }],
    evidenceRefs: [],
  });
  expect(opened).toEqual({ opened: 1 });

  const findings = await client.driftFindings!();
  expect(findings).toHaveLength(1);
  expect(findings[0]).toMatchObject({
    severity: "advisory",
    originalObjective: "implement user authentication",
    status: "open",
  });
  expect(
    events.some(
      (event) =>
        event.type === "drift.finding_opened" &&
        event.findingID.includes("objective_activity_mismatch"),
    ),
  ).toBe(true);

  // The same signals do not reopen an already-open finding.
  const again = await client.evaluateDrift?.({
    objective: "implement user authentication",
    currentActivity: "refactoring the css theme",
    applicableConstraints: ["never commit generated files"],
    changes: [{ action: "modified", path: "src/theme.css" }],
    evidenceRefs: [],
  });
  expect(again).toEqual({ opened: 0 });
  expect(await client.driftFindings!()).toHaveLength(1);
});

test("evaluateDrift opens a high finding for a forbidden constraint signal", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-ts7-drift-high-"));
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_ts7_drift_high",
    provider: {
      provider: "test",
      model: "test",
      async *stream() {
        yield { type: "done" as const };
      },
    },
  });
  client.start(() => {});
  await client.submit("hello");
  await pollHistoryForFinished(client);

  await client.evaluateDrift?.({
    objective: "finish the docs",
    currentActivity: "commit the generated files to the repo",
    applicableConstraints: ["never commit generated files"],
    changes: [{ action: "added", path: "dist/out.js" }],
    evidenceRefs: [],
  });
  const findings = await client.driftFindings!();
  const high = findings.find((finding) => finding.severity === "high");
  expect(high).toBeDefined();
  expect(high?.evidence.some((entry) => entry.startsWith("constraint:"))).toBe(
    true,
  );
});

test("acknowledgeDriftFinding transitions an open finding with a rationale", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-ts7-drift-ack-"));
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_ts7_drift_ack",
    provider: {
      provider: "test",
      model: "test",
      async *stream() {
        yield { type: "done" as const };
      },
    },
  });
  const events: RuntimeEvent[] = [];
  client.start((event) => events.push(event));
  await client.submit("hello");
  await pollHistoryForFinished(client);

  await client.evaluateDrift?.({
    objective: "implement user authentication",
    currentActivity: "refactoring the css theme",
    applicableConstraints: [],
    changes: [{ action: "modified", path: "src/theme.css" }],
    evidenceRefs: [],
  });
  const open = await client.driftFindings!();
  const findingID = open[0]!.findingID;
  expect(open[0]?.status).toBe("open");

  const acked = await client.acknowledgeDriftFinding?.({
    findingID,
    status: "explained",
    rationale: "the css refactor is a prerequisite",
  });
  expect(acked).toEqual({ acknowledged: true });

  const after = await client.driftFindings!();
  expect(after[0]?.status).toBe("explained");
  expect(
    events.some(
      (event) =>
        event.type === "drift.finding_updated" &&
        event.status === "explained" &&
        event.rationale === "the css refactor is a prerequisite",
    ),
  ).toBe(true);

  // A non-open finding cannot be acknowledged again.
  expect(
    await client.acknowledgeDriftFinding?.({
      findingID,
      status: "dismissed",
    }),
  ).toEqual({ acknowledged: false });
});

test("a write_file turn registers a mutation the auditor can attribute", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-ts7-obs-write-"));
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_ts7_obs_write",
    provider: writeFileProvider(),
    permissionMode: "auto",
  });
  const events: RuntimeEvent[] = [];
  client.start((event) => events.push(event));
  await client.submit("create a workspace file");
  await pollHistoryForFinished(client);

  // The write tool settled and registered an expected mutation; the turn-end
  // reconcile attributes the watcher hint to the tool call (WG4 Phase 3) rather
  // than treating it as an external change.
  const changes = await client.confirmedWorkspaceChanges!();
  const externalNodes = events.filter(
    (event): event is Extract<RuntimeEvent, { type: "workgraph.node_added" }> =>
      event.type === "workgraph.node_added" &&
      event.kind === "workspace_change" &&
      event.actor === "external",
  );
  // The attributed tool change is graphed by the tool path, not double-graphed
  // as an isolated external node.
  expect(externalNodes.some((node) => node.target === "hello-ts7.txt")).toBe(
    false,
  );
  expect(
    events.some(
      (event) =>
        event.type === "workgraph.node_added" &&
        event.kind === "workspace_change" &&
        event.target === "hello-ts7.txt" &&
        event.actor === "write_file",
    ),
  ).toBe(true);
  // Secret-safe: the confirmed change facts carry no file content (the tool's
  // own tool.update argumentsDelta legitimately does — that is the call record).
  expect(JSON.stringify(changes)).not.toContain("hello from TS7");
});

test("an external workspace change becomes an isolated external graph node", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-ts7-obs-external-"));
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_ts7_obs_external",
    provider: {
      provider: "test",
      model: "test",
      async *stream() {
        yield { type: "done" as const };
      },
    },
  });
  const events: RuntimeEvent[] = [];
  client.start((event) => events.push(event));
  await client.submit("hello");
  await pollHistoryForFinished(client);

  // An external edit the watcher sees but no tool claimed.
  await writeFile(join(root, "external-note.txt"), "written outside\n");
  await Bun.sleep(400);
  const changes = await client.confirmedWorkspaceChanges!();
  const external = changes.find((change) =>
    change.path.includes("external-note"),
  );
  expect(external).toBeDefined();
  expect(external?.attribution).toBe("unattributed");

  // The external confirmed change became an isolated workspace_change node with
  // no causal edge.
  const externalNodes = events.filter(
    (event): event is Extract<RuntimeEvent, { type: "workgraph.node_added" }> =>
      event.type === "workgraph.node_added" &&
      event.kind === "workspace_change" &&
      event.actor === "external",
  );
  expect(
    externalNodes.some((node) => node.target === "external-note.txt"),
  ).toBe(true);
  const edges = events.filter(
    (event): event is Extract<RuntimeEvent, { type: "workgraph.edge_added" }> =>
      event.type === "workgraph.edge_added",
  );
  // No edge points at the external node (no reliable turn/call identity).
  expect(
    edges.every(
      (edge) => !externalNodes.some((node) => edge.targetID === node.nodeID),
    ),
  ).toBe(true);
});

test("a confirmed change diverging from the active plan auto-opens a drift finding", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-ts7-obs-drift-"));
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_ts7_obs_drift",
    provider: {
      provider: "test",
      model: "test",
      async *stream() {
        yield { type: "done" as const };
      },
    },
  });
  client.start((event) => {
    if (event.type === "approval.request" && event.scope === "plan_acceptance")
      client.respondApproval({ requestID: event.id, decision: "once" });
  });
  await client.submit("hello");
  await pollHistoryForFinished(client);

  // An active plan with a clear objective and a constraint.
  const created = await client.planCreate?.({
    title: "Implement user authentication",
    author: "live_chat",
    objective: "implement user authentication",
    steps: [{ id: "s1", title: "add the credential flow" }],
    constraints: ["never commit generated files"],
  });
  const planID = created!.planID!;
  await client.planPropose?.(planID);
  await client.planAccept?.(planID);
  await client.planQueue?.(planID);
  await client.submit("second");
  await pollHistoryForFinished(client);
  expect((await client.planList!())[0]?.status).toBe("active");

  // An external change unrelated to the plan's objective.
  await writeFile(join(root, "theme.css"), "unrelated css\n");
  await Bun.sleep(400);
  await client.confirmedWorkspaceChanges!();

  const findings = await client.driftFindings!();
  const mismatch = findings.find((finding) =>
    finding.findingID.includes("objective_activity_mismatch"),
  );
  expect(mismatch).toBeDefined();
  expect(mismatch?.severity).toBe("advisory");
});

test("an external change during a turn is reconciled at turn finish without an explicit call", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-ts7-obs-turnend-"));
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_ts7_obs_turnend",
    provider: {
      provider: "test",
      model: "test",
      async *stream() {
        yield { type: "content" as const, text: "working" };
        await new Promise((resolve) => setTimeout(resolve, 40));
        yield { type: "done" as const };
      },
    },
  });
  const events: RuntimeEvent[] = [];
  client.start((event) => events.push(event));
  await client.submit("first");
  await pollHistoryForFinished(client);

  // External edit while idle, then another turn finishes: the turn-end
  // reconcile must discover, graph and drift-check it — no explicit
  // confirmedWorkspaceChanges call.
  await writeFile(join(root, "turnend-note.txt"), "external\n");
  await Bun.sleep(300);
  await client.submit("second");
  await pollHistoryForFinished(client);
  await Bun.sleep(300);

  expect(
    events.some(
      (event) =>
        event.type === "workgraph.node_added" &&
        event.kind === "workspace_change" &&
        event.actor === "external" &&
        event.target === "turnend-note.txt",
    ),
  ).toBe(true);
});

test("durable session replay preserves tool-call pairs for the next provider turn", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-ts7-replay-tools-"));
  await writeFile(join(root, "input.txt"), "replay-ok\n");
  const initial = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_ts7_replay_tools",
    provider: toolCallingProvider(),
    permissionMode: "auto",
  });
  initial.start(() => {});
  await initial.submit("read the input");

  const requests: ProviderStreamRequest[] = [];
  const reopened = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_ts7_replay_tools",
    permissionMode: "auto",
    provider: {
      provider: "scripted-replay",
      model: "scripted-replay-model",
      async *stream(request) {
        requests.push(request);
        yield { type: "content", text: "replay continuation works" };
        yield { type: "done" };
      },
    },
  });
  reopened.start(() => {});
  await reopened.submit("continue");
  const restoredTool = requests[0]?.messages.find(
    (message) => message.role === "tool",
  );
  expect(restoredTool).toMatchObject({
    toolCallID: "call_read",
    content: "replay-ok\n",
  });
});

test("real runtime client routes ask_user tool calls through question response", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-ts7-question-tool-"));
  const events: RuntimeEvent[] = [];
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_ts7_question_tool",
    provider: questionToolProvider(),
  });
  client.start((event) => {
    events.push(event);
    if (event.type === "question.request")
      client.respondQuestion({ requestID: event.id, answers: [["yes"]] });
  });
  await client.submit("ask a question");
  expect(events.some((event) => event.type === "question.request")).toBe(true);
  expect(
    events.some(
      (event) =>
        event.type === "content.delta" && event.text === "answer received",
    ),
  ).toBe(true);
});

test("real runtime client spawns and projects a TS/Bun subagent lifecycle", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-ts7-subagent-tool-"));
  const events: RuntimeEvent[] = [];
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_ts7_subagent_tool",
    provider: subagentProvider(),
    permissionMode: "auto",
  });
  client.start((event) => events.push(event));
  await client.submit("delegate a focused task");
  await waitFor(() =>
    events.some(
      (event) =>
        event.type === "subagent.update" && event.status === "completed",
    ),
  );
  expect(
    events.some(
      (event) =>
        event.type === "subagent.update" &&
        event.text?.includes("child result"),
    ),
  ).toBe(true);
  expect(
    events.some(
      (event) =>
        event.type === "content.delta" && event.text === "parent complete",
    ),
  ).toBe(true);
  const lifecycle = events.filter(
    (event): event is Extract<RuntimeEvent, { type: "subagent.update" }> =>
      event.type === "subagent.update",
  );
  expect(
    lifecycle.every(
      (event) => event.parentSessionID === "ses_ts7_subagent_tool",
    ),
  ).toBe(true);
  expect(lifecycle.every((event) => event.continuation === 0)).toBe(true);
  const history = await client.history?.();
  expect(
    history?.events.some(
      (item) =>
        item.event.type === "subagent.update" &&
        item.event.parentSessionID === "ses_ts7_subagent_tool",
    ),
  ).toBe(true);
});

test("subagent executes TS native workspace tools before reporting completion", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-ts7-subagent-tools-"));
  const events: RuntimeEvent[] = [];
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_ts7_subagent_tools",
    provider: subagentToolProvider(),
    permissionMode: "auto",
  });
  client.start((event) => events.push(event));
  await client.submit("delegate a file task");
  await waitFor(() =>
    events.some(
      (event) =>
        event.type === "subagent.update" && event.status === "completed",
    ),
  );
  expect(await readFile(join(root, "agent-test.txt"), "utf8")).toBe(
    "agent test success",
  );
  expect(
    events.some(
      (event) =>
        event.type === "subagent.update" &&
        event.text?.includes("tool write_file"),
    ),
  ).toBe(true);
});

test("subagent honors configured step limits above twenty", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-subagent-step-limit-"));
  await mkdir(join(root, ".natalia"), { recursive: true });
  await writeFile(
    join(root, ".natalia", "config.json"),
    JSON.stringify({
      version: 2,
      defaultAgent: "long_running",
      agents: { long_running: { description: "Long running", maxSteps: 21 } },
    }),
  );
  for (let step = 0; step < 21; step++)
    await writeFile(join(root, `readable-${step}.txt`), "safe test input");
  const childToolCalls: string[] = [];
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_subagent_step_limit",
    permissionMode: "auto",
    provider: {
      provider: "subagent-step-limit",
      model: "subagent-step-limit",
      async *stream(request) {
        const child =
          request.messages[0]?.role === "system" &&
          String(request.messages[0].content).includes(
            "focused Natalia TS/Bun subagent",
          );
        if (child) {
          const priorCalls = request.messages.filter(
            (message) => message.role === "tool",
          ).length;
          if (priorCalls < 20) {
            const path = `readable-${priorCalls}.txt`;
            childToolCalls.push(path);
            yield {
              type: "tool_call" as const,
              calls: [
                {
                  id: `child_read_${priorCalls}`,
                  name: "read_file",
                  arguments: JSON.stringify({ path }),
                },
              ],
            };
            yield { type: "done" as const };
            return;
          }
          yield { type: "content" as const, text: "completed after 20 tools" };
          yield { type: "done" as const };
          return;
        }
        if (!request.messages.some((message) => message.role === "tool")) {
          yield {
            type: "tool_call" as const,
            calls: [
              {
                id: "spawn_long_child",
                name: "agent_spawn",
                arguments: JSON.stringify({ task: "perform many reads" }),
              },
            ],
          };
          yield { type: "done" as const };
          return;
        }
        yield { type: "content" as const, text: "parent complete" };
        yield { type: "done" as const };
      },
    },
  });
  const events: RuntimeEvent[] = [];
  client.start((event) => events.push(event));
  await client.submit("delegate a long task");
  await waitFor(
    () =>
      events.some(
        (event) =>
          event.type === "subagent.update" && event.status === "completed",
      ),
    2_000,
  );

  expect(childToolCalls).toHaveLength(20);
  expect(
    events.some(
      (event) =>
        event.type === "subagent.update" &&
        event.text?.includes("completed after 20 tools"),
    ),
  ).toBe(true);
  await client.dispose?.();
});

function scriptedProvider(text: string): StreamingProvider {
  return {
    provider: "scripted",
    model: "scripted-model",
    async *stream(_request: ProviderStreamRequest) {
      yield { type: "content", text };
      yield { type: "done" };
    },
  };
}

function singleToolProvider(
  name: string,
  arguments_: unknown,
): StreamingProvider {
  return {
    provider: "scripted-single-tool",
    model: "scripted-single-tool-model",
    async *stream(request: ProviderStreamRequest) {
      if (!request.messages.some((message) => message.role === "tool"))
        yield {
          type: "tool_call",
          calls: [
            {
              id: "single",
              name,
              arguments: JSON.stringify(arguments_),
            },
          ],
        };
      yield { type: "done" };
    },
  };
}

function interactiveTerminalProvider(): StreamingProvider {
  return {
    provider: "scripted-interactive-terminal",
    model: "scripted-interactive-terminal-model",
    async *stream(request) {
      if (!request.messages.some((message) => message.role === "tool"))
        yield {
          type: "tool_call",
          calls: [
            {
              id: "start",
              name: "interactive_terminal_start",
              arguments: JSON.stringify({
                id: "tty_management",
                command: "cat",
              }),
            },
          ],
        };
      yield { type: "done" };
    },
  };
}

function nativeTerminalFixture() {
  let running = true;
  return new NativeTerminalRegistry({
    kind: "wezterm",
    executable: "wezterm",
    async spawn() {
      return { pane_id: 71, window_id: 7, tab_id: 1 };
    },
    async list() {
      return running
        ? [{ pane_id: 71, window_id: 7, tab_id: 1, rows: 24, cols: 80 }]
        : [];
    },
    async read() {
      return "native pane output";
    },
    async write() {},
    async open() {
      return { pane_id: 71, window_id: 7, tab_id: 1, rows: 24, cols: 80 };
    },
    async openHub() {},
    async focus() {},
    async resize() {},
    async stop() {
      running = false;
    },
  });
}

function usageProvider(): StreamingProvider {
  return {
    provider: "scripted-usage",
    model: "scripted-usage-model",
    async *stream(_request: ProviderStreamRequest) {
      yield { type: "content", text: "usage ok" };
      yield { type: "usage", inputTokens: 10, outputTokens: 5 };
      yield { type: "done" };
    },
  };
}

function contextLimitThenSuccessProvider(): StreamingProvider & {
  calls: number;
} {
  return {
    provider: "scripted-context-limit",
    model: "scripted-context-limit-model",
    calls: 0,
    async *stream(this: StreamingProvider & { calls: number }) {
      this.calls++;
      if (this.calls === 1)
        throw providerError({
          kind: "context_limit",
          message: "context length exceeded",
        });
      yield { type: "content", text: "recovered" };
      yield { type: "done" };
    },
  };
}

function toolCallingProvider(): StreamingProvider & {
  requests: ProviderStreamRequest[];
} {
  const requests: ProviderStreamRequest[] = [];
  return {
    provider: "scripted-tools",
    model: "scripted-tool-model",
    requests,
    async *stream(request: ProviderStreamRequest) {
      requests.push(request);
      if (!request.messages.some((message) => message.role === "tool")) {
        yield {
          type: "tool_call",
          calls: [
            {
              id: "call_read",
              name: "read_file",
              arguments: JSON.stringify({ path: "input.txt" }),
            },
          ],
        };
        yield { type: "done" };
        return;
      }
      yield { type: "content", text: "tool said: tool data" };
      yield { type: "done" };
    },
  };
}

function writeFileProvider(): StreamingProvider {
  return {
    provider: "scripted-write",
    model: "scripted-write-model",
    async *stream(request: ProviderStreamRequest) {
      if (!request.messages.some((message) => message.role === "tool")) {
        yield {
          type: "tool_call",
          calls: [
            {
              id: "call_write",
              name: "write_file",
              arguments: JSON.stringify({
                path: "hello-ts7.txt",
                content: "hello from TS7\n",
              }),
            },
          ],
        };
        yield { type: "done" };
        return;
      }
      yield { type: "content", text: "file created" };
      yield { type: "done" };
    },
  };
}

function approvalWriteProvider(): StreamingProvider {
  return {
    provider: "scripted-approval-write",
    model: "scripted-approval-write-model",
    async *stream(request: ProviderStreamRequest) {
      if (!request.messages.some((message) => message.role === "tool")) {
        yield {
          type: "tool_call",
          calls: [
            {
              id: "call_approval_write",
              name: "write_file",
              arguments: JSON.stringify({
                path: "long-note.md",
                content: "long content ".repeat(100),
              }),
            },
          ],
        };
        yield { type: "done" };
        return;
      }
      yield { type: "content", text: "file created" };
      yield { type: "done" };
    },
  };
}

function questionToolProvider(): StreamingProvider {
  return {
    provider: "scripted-question",
    model: "scripted-question-model",
    async *stream(request: ProviderStreamRequest) {
      if (!request.messages.some((message) => message.role === "tool")) {
        yield {
          type: "tool_call",
          calls: [
            {
              id: "call_question",
              name: "ask_user",
              arguments: JSON.stringify({
                question: "Continue?",
                options: ["yes", "no"],
              }),
            },
          ],
        };
        yield { type: "done" };
        return;
      }
      yield { type: "content", text: "answer received" };
      yield { type: "done" };
    },
  };
}

function delayedStreamingProvider(): StreamingProvider {
  return {
    provider: "scripted-delayed",
    model: "scripted-delayed-model",
    async *stream(_request: ProviderStreamRequest) {
      yield { type: "content", text: "first " };
      await Bun.sleep(80);
      yield { type: "content", text: "second" };
      yield { type: "done" };
    },
  };
}

function subagentProvider(): StreamingProvider {
  return {
    provider: "scripted-subagent",
    model: "scripted-subagent-model",
    async *stream(request: ProviderStreamRequest) {
      if (
        request.messages[0]?.role === "system" &&
        String(request.messages[0].content).includes(
          "focused Natalia TS/Bun subagent",
        )
      ) {
        yield { type: "content", text: "child result" };
        yield { type: "done" };
        return;
      }
      if (!request.messages.some((message) => message.role === "tool")) {
        yield {
          type: "tool_call",
          calls: [
            {
              id: "call_subagent",
              name: "agent_spawn",
              arguments: JSON.stringify({ task: "child task" }),
            },
          ],
        };
        yield { type: "done" };
        return;
      }
      yield { type: "content", text: "parent complete" };
      yield { type: "done" };
    },
  };
}

function subagentToolProvider(): StreamingProvider {
  return {
    provider: "scripted-subagent-tools",
    model: "scripted-subagent-tools-model",
    async *stream(request: ProviderStreamRequest) {
      const isChild = request.messages.some(
        (message) => message.content === "child file task",
      );
      if (
        isChild &&
        !request.messages.some((message) => message.role === "tool")
      ) {
        yield {
          type: "tool_call",
          calls: [
            {
              id: "call_child_write",
              name: "write_file",
              arguments: JSON.stringify({
                path: "agent-test.txt",
                content: "agent test success",
              }),
            },
          ],
        };
        yield { type: "done" };
        return;
      }
      if (isChild) {
        yield { type: "content", text: "created agent-test.txt successfully" };
        yield { type: "done" };
        return;
      }
      if (!request.messages.some((message) => message.role === "tool")) {
        yield {
          type: "tool_call",
          calls: [
            {
              id: "call_subagent_tools",
              name: "agent_spawn",
              arguments: JSON.stringify({ task: "child file task" }),
            },
          ],
        };
        yield { type: "done" };
        return;
      }
      yield { type: "content", text: "parent complete" };
      yield { type: "done" };
    },
  };
}

async function waitFor(
  predicate: () => boolean,
  timeoutMs = 500,
  label = "condition",
) {
  for (let elapsed = 0; elapsed < timeoutMs; elapsed += 10) {
    if (predicate()) return;
    await Bun.sleep(10);
  }
  throw new Error(`timed out waiting for ${label}`);
}

/** Polls until an async predicate holds (the runtime wakes turns asynchronously). */
async function waitForAsync(
  predicate: () => Promise<boolean>,
  timeoutMs = 3000,
) {
  for (let elapsed = 0; elapsed < timeoutMs; elapsed += 50) {
    if (await predicate()) return;
    await Bun.sleep(50);
  }
  throw new Error("timed out waiting for async condition");
}

/** Polls the attached session's history until a turn has settled on disk. */
async function pollHistoryForFinished(
  client: ReturnType<typeof createRealRuntimeClient>,
  timeoutMs = 3000,
) {
  for (let elapsed = 0; elapsed < timeoutMs; elapsed += 50) {
    // A larger window than 100: seeded constitution rules and session
    // snapshots are durable events too, so a turn's `turn.finished` can sit
    // beyond a 100-event window and must not look like the turn never settled.
    const history = await client.history?.({ limit: 1000 });
    if (history?.events.some((entry) => entry.event.type === "turn.finished"))
      return;
    await Bun.sleep(50);
  }
  throw new Error("timed out waiting for a settled turn in history");
}

test("the system prompt enumerates installed skills dynamically", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-prompt-skills-"));
  const requests: ProviderStreamRequest[] = [];
  const provider: StreamingProvider = {
    provider: "test",
    model: "test",
    async *stream(request) {
      requests.push(request);
      yield { type: "done" as const };
    },
  };
  const promptFor = async (sessionID: SessionID) => {
    requests.length = 0;
    const client = createRealRuntimeClient({
      workspaceRoot: root,
      sessionID,
      provider,
    });
    client.start(() => undefined);
    await client.submit("hi");
    await client.dispose?.();
    return String(requests[0]?.messages[0]?.content ?? "");
  };

  // Nothing installed: the section must be absent rather than empty, so a
  // workspace without skills neither pays tokens nor learns about skill_load.
  expect(await promptFor("ses_prompt_skills_none" as SessionID)).not.toContain(
    "<available_skills>",
  );

  const skillRoot = join(root, ".natalia", "skills", "probe-skill");
  await mkdir(skillRoot, { recursive: true });
  await writeFile(
    join(skillRoot, "SKILL.md"),
    `---\nname: probe-skill\ndescription: ${"d".repeat(900)}\n---\n\n# probe\n`,
  );

  const withSkill = await promptFor("ses_prompt_skills_one" as SessionID);
  expect(withSkill).toContain("<available_skills>");
  // Enumerated from the registry, not hardcoded: the freshly created directory
  // shows up without any code or config change.
  expect(withSkill).toContain("- probe-skill (project):");
  expect(withSkill).toContain("None is loaded yet.");
  // A pathological description must not be able to dominate the prompt.
  expect(withSkill).toContain("...");
  expect(withSkill).not.toContain("d".repeat(700));
});

test("a rejected approval feeds the reason back and lets the turn continue", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-runtime-reject-"));
  const events: RuntimeEvent[] = [];
  const requests: ProviderStreamRequest[] = [];
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_reject_continue" as SessionID,
    provider: {
      provider: "test",
      model: "test",
      async *stream(request) {
        requests.push(request);
        // The second step only happens if the turn survived the rejection.
        if (request.messages.some((message) => message.role === "tool")) {
          yield { type: "content" as const, text: "understood, moving on" };
          yield { type: "done" as const };
          return;
        }
        yield {
          type: "tool_call" as const,
          calls: [
            {
              id: "call_1",
              name: "run_shell",
              arguments: JSON.stringify({ command: "rm -rf /" }),
            },
          ],
        };
        yield { type: "done" as const };
      },
    },
  });
  client.start((event) => {
    events.push(event);
    if (event.type === "approval.request")
      client.respondApproval({
        requestID: event.id,
        decision: "reject",
        feedback: "too dangerous, list the directory instead",
      });
  });

  await client.submit("clean the workspace");

  // The refusal is reported as a decision about the call, not a broken turn.
  expect(
    events.find(
      (event) => event.type === "tool.update" && event.status === "rejected",
    ),
  ).toMatchObject({
    type: "tool.update",
    name: "run_shell",
    status: "rejected",
  });
  const finished = events.filter((event) => event.type === "turn.finished");
  expect(finished).toHaveLength(1);
  expect(finished[0]).not.toMatchObject({ stopReason: "error" });

  // The model is told why, so it can choose differently.
  const toolMessages = requests
    .at(-1)!
    .messages.filter((message) => message.role === "tool");
  expect(toolMessages).toHaveLength(1);
  expect(String(toolMessages[0]?.content)).toContain(
    "too dangerous, list the directory instead",
  );
  expect(String(toolMessages[0]?.content)).toContain("rejected by the user");

  // And it kept working afterwards.
  expect(
    events
      .filter((event) => event.type === "content.delta")
      .map((event) => event.text)
      .join(""),
  ).toContain("understood, moving on");
});

test("a rejection without feedback still audits the decision and continues", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-runtime-reject-bare-"));
  const events: RuntimeEvent[] = [];
  const requests: ProviderStreamRequest[] = [];
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_reject_bare" as SessionID,
    provider: {
      provider: "test",
      model: "test",
      async *stream(request) {
        requests.push(request);
        if (request.messages.some((message) => message.role === "tool")) {
          yield { type: "content" as const, text: "asking instead" };
          yield { type: "done" as const };
          return;
        }
        yield {
          type: "tool_call" as const,
          calls: [
            {
              id: "call_1",
              name: "run_shell",
              arguments: JSON.stringify({ command: "echo hi" }),
            },
          ],
        };
        yield { type: "done" as const };
      },
    },
  });
  client.start((event) => {
    events.push(event);
    if (event.type === "approval.request")
      client.respondApproval({ requestID: event.id, decision: "reject" });
  });

  await client.submit("run something");

  // The audit trail must record the refusal even when no reason was given.
  expect(
    events.find(
      (event) =>
        event.type === "policy.decision" && event.decision === "rejected",
    ),
  ).toMatchObject({ toolName: "run_shell", toolCallID: "call_1" });
  expect(events.filter((event) => event.type === "turn.finished")).toHaveLength(
    1,
  );

  const toolMessages = requests
    .at(-1)!
    .messages.filter((message) => message.role === "tool");
  expect(String(toolMessages[0]?.content)).toContain("without a reason");
});

test("the repeated call guard blocks loops but not waiting reads", async () => {
  async function blockedCount(name: string, args: Record<string, unknown>) {
    const root = await mkdtemp(join(tmpdir(), "natalia-repeat-guard-"));
    await mkdir(join(root, ".natalia"), { recursive: true });
    await writeFile(
      join(root, ".natalia", "config.json"),
      JSON.stringify({ version: 2, runtime: { maxStepsPerTurn: 6 } }),
    );
    const events: RuntimeEvent[] = [];
    const client = createRealRuntimeClient({
      workspaceRoot: root,
      sessionID: `ses_repeat_${name}`,
      permissionMode: "auto",
      provider: {
        provider: "test",
        model: "test",
        async *stream(request) {
          if (request.messages.some((message) => message.role === "tool")) {
            yield { type: "done" as const };
            return;
          }
          // Fourteen identical calls in one turn, so the guard's threshold is
          // crossed without depending on how many rounds a turn allows.
          yield {
            type: "tool_call" as const,
            calls: Array.from({ length: 14 }, (_, index) => ({
              id: `call_${index}`,
              name,
              arguments: JSON.stringify(args),
            })),
          };
        },
      },
    });
    client.start((event) => events.push(event));
    await client.submit(`repeat ${name}`);
    await client.dispose?.();
    return events.filter(
      (event) =>
        event.type === "tool.update" &&
        typeof event.summary === "string" &&
        event.summary.includes("blocked repeated tool call"),
    ).length;
  }

  // A tool with no waiting behaviour repeated identically is a loop, and the
  // guard still stops it.
  expect(
    await blockedCount("read_file", { path: "missing.txt" }),
  ).toBeGreaterThan(0);
  // terminal_observe blocks until the screen changes, so identical arguments are
  // how a caller waits. It used to be cut off mid-wait after twelve polls.
  expect(await blockedCount("terminal_observe", { id: "tty_absent" })).toBe(0);
});

test("report_issue reaches the forge through the runtime, never through the model", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-report-issue-"));
  const store = await NataliaTaskStateStore.open(root);
  store.startInvocation({
    invocationID: "inv_1",
    taskID: "task_1",
    episodeID: "epi_1" as import("@natalia/contracts").EpisodeID,
    sessionID: "ses_1" as SessionID,
  });
  store.activateModule({
    invocationID: "inv_1",
    attempt: 1,
    flowID: "flow_1",
    moduleID: "report",
    conditionIDs: ["c1"],
  });
  const reported: Array<Record<string, unknown>> = [];
  const seenTools: string[][] = [];
  let toolResult = "";
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_report_issue" as SessionID,
    taskModuleContext: {
      store,
      invocationID: "inv_1",
      attempt: 1,
      flowID: "flow_1",
      moduleID: "report",
      moduleType: "report_output",
      async reportIssue(finding) {
        reported.push(finding as unknown as Record<string, unknown>);
        return {
          action: "created",
          fingerprint: "fp_1",
          repository: "natalia/logs",
          issue: 7,
        };
      },
    },
    provider: {
      provider: "report-issue",
      model: "report-issue-model",
      async *stream(request) {
        seenTools.push((request.tools ?? []).map((tool) => tool.name));
        const toolMessage = request.messages.find(
          (message) => message.role === "tool",
        );
        if (toolMessage) {
          toolResult = String(toolMessage.content);
          yield { type: "done" as const };
          return;
        }
        yield {
          type: "tool_call" as const,
          calls: [
            {
              id: "report_1",
              name: "report_issue",
              arguments: JSON.stringify({
                fingerprintParts: ["null pointer", "src/auth.ts"],
                title: "Null pointer in the auth path",
                body: "The nightly scan found it again.",
              }),
            },
          ],
        };
      },
    },
  });
  client.start(() => undefined);
  await client.submit("report the finding");
  expect(seenTools[0]).toContain("report_issue");
  expect(reported).toEqual([
    {
      fingerprintParts: ["null pointer", "src/auth.ts"],
      title: "Null pointer in the auth path",
      body: "The nightly scan found it again.",
      labels: undefined,
    },
  ]);
  expect(JSON.parse(toolResult)).toMatchObject({
    action: "created",
    issue: 7,
  });
  await client.dispose?.();
  store.close();
});

test("report_issue stays out of runtimes that were not given a reporter", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-report-issue-absent-"));
  const store = await NataliaTaskStateStore.open(root);
  store.startInvocation({
    invocationID: "inv_1",
    taskID: "task_1",
    episodeID: "epi_1" as import("@natalia/contracts").EpisodeID,
    sessionID: "ses_1" as SessionID,
  });
  store.activateModule({
    invocationID: "inv_1",
    attempt: 1,
    flowID: "flow_1",
    moduleID: "report",
    conditionIDs: [],
  });
  const seenTools: string[][] = [];
  const taskClient = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_report_absent_task" as SessionID,
    taskModuleContext: {
      store,
      invocationID: "inv_1",
      attempt: 1,
      flowID: "flow_1",
      moduleID: "report",
      moduleType: "report_output",
    },
    provider: {
      provider: "report-absent",
      model: "report-absent-model",
      async *stream(request) {
        seenTools.push((request.tools ?? []).map((tool) => tool.name));
        yield { type: "done" as const };
      },
    },
  });
  taskClient.start(() => undefined);
  await taskClient.submit("begin");
  expect(seenTools[0]).not.toContain("report_issue");
  await taskClient.dispose?.();

  const ordinaryClient = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_report_absent_ordinary" as SessionID,
    provider: {
      provider: "report-absent-ordinary",
      model: "report-absent-ordinary-model",
      async *stream(request) {
        seenTools.push((request.tools ?? []).map((tool) => tool.name));
        yield { type: "done" as const };
      },
    },
  });
  ordinaryClient.start(() => undefined);
  await ordinaryClient.submit("begin");
  expect(seenTools[1]).not.toContain("report_issue");
  await ordinaryClient.dispose?.();
  store.close();
});

test("report_issue is denied outside the report module bundle", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-report-issue-policy-"));
  const store = await NataliaTaskStateStore.open(root);
  store.startInvocation({
    invocationID: "inv_1",
    taskID: "task_1",
    episodeID: "epi_1" as import("@natalia/contracts").EpisodeID,
    sessionID: "ses_1" as SessionID,
  });
  store.activateModule({
    invocationID: "inv_1",
    attempt: 1,
    flowID: "flow_1",
    moduleID: "read",
    conditionIDs: [],
  });
  let reporterCalls = 0;
  const events: RuntimeEvent[] = [];
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_report_policy" as SessionID,
    taskModuleContext: {
      store,
      invocationID: "inv_1",
      attempt: 1,
      flowID: "flow_1",
      moduleID: "read",
      moduleType: "read_search",
      async reportIssue() {
        reporterCalls += 1;
        return { action: "created" };
      },
    },
    provider: {
      provider: "report-policy",
      model: "report-policy-model",
      async *stream(request) {
        if (request.messages.some((message) => message.role === "tool")) {
          yield { type: "done" as const };
          return;
        }
        yield {
          type: "tool_call" as const,
          calls: [
            {
              id: "report_1",
              name: "report_issue",
              arguments: JSON.stringify({
                fingerprintParts: ["a"],
                title: "t",
                body: "b",
              }),
            },
          ],
        };
      },
    },
  });
  client.start((event) => events.push(event));
  await client.submit("report from a read module");
  expect(reporterCalls).toBe(0);
  expect(events).toContainEqual(
    expect.objectContaining({
      type: "policy.decision",
      toolName: "report_issue",
      decision: "deny",
      reason: expect.stringContaining("outside active read_search module"),
    }),
  );
  expect(events).toContainEqual(
    expect.objectContaining({
      type: "tool.update",
      name: "report_issue",
      status: "failed",
    }),
  );
  await client.dispose?.();
  store.close();
});

test("read_data_source is a task module capability the runtime owns", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-data-source-tool-"));
  const store = await NataliaTaskStateStore.open(root);
  store.startInvocation({
    invocationID: "inv_1",
    taskID: "task_1",
    episodeID: "epi_1" as import("@natalia/contracts").EpisodeID,
    sessionID: "ses_1" as SessionID,
  });
  store.activateModule({
    invocationID: "inv_1",
    attempt: 1,
    flowID: "flow_1",
    moduleID: "read",
    conditionIDs: [],
  });
  const requests: Array<{ maxBytes?: number }> = [];
  const seenTools: string[][] = [];
  let toolResult = "";
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_data_source" as SessionID,
    taskModuleContext: {
      store,
      invocationID: "inv_1",
      attempt: 1,
      flowID: "flow_1",
      moduleID: "read",
      moduleType: "read_search",
      async readDataSource(request) {
        requests.push(request);
        return { source: "app", from: 0, to: 12, content: "error line\n" };
      },
    },
    provider: {
      provider: "log-source",
      model: "log-source-model",
      async *stream(request) {
        seenTools.push((request.tools ?? []).map((tool) => tool.name));
        const toolMessage = request.messages.find(
          (message) => message.role === "tool",
        );
        if (toolMessage) {
          toolResult = String(toolMessage.content);
          yield { type: "done" as const };
          return;
        }
        yield {
          type: "tool_call" as const,
          calls: [
            {
              id: "log_1",
              name: "read_data_source",
              arguments: JSON.stringify({ maxBytes: 256 }),
            },
          ],
        };
      },
    },
  });
  client.start(() => undefined);
  await client.submit("scan the log");
  expect(seenTools[0]).toContain("read_data_source");
  // The model asks for new content, never for a byte offset.
  expect(requests).toEqual([{ maxBytes: 256 }]);
  expect(JSON.parse(toolResult)).toMatchObject({ from: 0, to: 12 });
  await client.dispose?.();
  store.close();
});

test("read_data_source stays out of runtimes without a configured source", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-data-source-absent-"));
  const store = await NataliaTaskStateStore.open(root);
  store.startInvocation({
    invocationID: "inv_1",
    taskID: "task_1",
    episodeID: "epi_1" as import("@natalia/contracts").EpisodeID,
    sessionID: "ses_1" as SessionID,
  });
  store.activateModule({
    invocationID: "inv_1",
    attempt: 1,
    flowID: "flow_1",
    moduleID: "read",
    conditionIDs: [],
  });
  const seenTools: string[][] = [];
  const taskClient = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_log_absent_task" as SessionID,
    taskModuleContext: {
      store,
      invocationID: "inv_1",
      attempt: 1,
      flowID: "flow_1",
      moduleID: "read",
      moduleType: "read_search",
    },
    provider: {
      provider: "log-absent",
      model: "log-absent-model",
      async *stream(request) {
        seenTools.push((request.tools ?? []).map((tool) => tool.name));
        yield { type: "done" as const };
      },
    },
  });
  taskClient.start(() => undefined);
  await taskClient.submit("begin");
  expect(seenTools[0]).not.toContain("read_data_source");
  await taskClient.dispose?.();

  const ordinaryClient = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_log_absent_ordinary" as SessionID,
    provider: {
      provider: "log-absent-ordinary",
      model: "log-absent-ordinary-model",
      async *stream(request) {
        seenTools.push((request.tools ?? []).map((tool) => tool.name));
        yield { type: "done" as const };
      },
    },
  });
  ordinaryClient.start(() => undefined);
  await ordinaryClient.submit("begin");
  expect(seenTools[1]).not.toContain("read_data_source");
  await ordinaryClient.dispose?.();
  store.close();
});

test("module completion stays possible when a profile allow-list omits it", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-completion-exempt-"));
  await mkdir(join(root, ".natalia"), { recursive: true });
  // A profile that lists only capability tools, which is exactly the mistake the
  // completion tool has to survive.
  await writeFile(
    join(root, ".natalia", "config.json"),
    JSON.stringify({
      version: 2,
      permissionProfiles: {
        unattended: {
          approval: "auto",
          description: "Task profile",
          permissions: { tools: { allow: ["read_file"] } },
        },
      },
    }),
  );
  const store = await NataliaTaskStateStore.open(root);
  store.startInvocation({
    invocationID: "inv_1",
    taskID: "task_1",
    episodeID: "epi_1" as import("@natalia/contracts").EpisodeID,
    sessionID: "ses_1" as SessionID,
  });
  store.activateModule({
    invocationID: "inv_1",
    attempt: 1,
    flowID: "flow_1",
    moduleID: "read",
    conditionIDs: ["c1"],
  });
  const seenTools: string[][] = [];
  const events: RuntimeEvent[] = [];
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_completion_exempt" as SessionID,
    permissionProfile: "unattended",
    taskModuleContext: {
      store,
      invocationID: "inv_1",
      attempt: 1,
      flowID: "flow_1",
      moduleID: "read",
      moduleType: "read_search",
    },
    provider: {
      provider: "completion-exempt",
      model: "completion-exempt-model",
      async *stream(request) {
        seenTools.push((request.tools ?? []).map((tool) => tool.name));
        if (request.messages.some((message) => message.role === "tool")) {
          yield { type: "done" as const };
          return;
        }
        yield {
          type: "tool_call" as const,
          calls: [
            {
              id: "claim",
              name: "flow_module_complete",
              arguments: JSON.stringify({
                flowID: "flow_1",
                moduleID: "read",
                conditionStatuses: [{ id: "c1", status: "satisfied" }],
                evidenceRefs: [],
                gaps: [],
                recommendedAction: "Evaluate the claim.",
              }),
            },
          ],
        };
      },
    },
  });
  client.start((event) => events.push(event));
  await client.submit("claim the module");
  expect(seenTools[0]).toContain("flow_module_complete");
  expect(events).toContainEqual(
    expect.objectContaining({
      type: "tool.update",
      name: "flow_module_complete",
      status: "succeeded",
    }),
  );
  expect(store.moduleEvents("inv_1", 1).map((event) => event.kind)).toContain(
    "flow.module_claimed",
  );
  await client.dispose?.();
  store.close();
});

test("config is not applied underneath a running turn, even if the precheck said yes", async () => {
  // `canReloadConfig()` is advisory: a turn can start between asking and acting.
  // So the action re-checks for itself, and refuses as a value rather than
  // applying new policy to a turn that started under the old policy.
  const root = await mkdtemp(join(tmpdir(), "natalia-reload-race-"));
  let releaseProvider: (() => void) | undefined;
  const providerReached = new Promise<void>((resolve) => {
    releaseProvider = resolve;
  });
  let letProviderFinish: (() => void) | undefined;
  const providerHeld = new Promise<void>((resolve) => {
    letProviderFinish = resolve;
  });
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_reload_race",
    permissionMode: "auto",
    provider: {
      provider: "scripted",
      model: "scripted",
      async *stream() {
        releaseProvider?.();
        await providerHeld;
        yield { type: "content" as const, text: "done" };
        yield { type: "done" as const };
      },
    },
  });
  client.start(() => undefined);

  // Ask before the turn: allowed.
  expect(await client.canReloadConfig?.()).toEqual({ allowed: true });

  const turn = client.submit("hold the provider open");
  await providerReached;

  // The same question now answers no, and so does the action.
  expect((await client.canReloadConfig?.())?.allowed).toBe(false);
  const refused = await client.reloadConfig?.();
  expect(refused?.applied).toBe(false);
  expect(refused?.reason).toMatch(/while a turn is running/u);

  letProviderFinish?.();
  await turn;

  // Once the turn has settled it applies normally.
  expect((await client.reloadConfig?.())?.applied).toBe(true);
  await client.dispose?.();
}, 30_000);

test("answering a request that is no longer pending is reported, not swallowed", async () => {
  // The waiter already knew this — it published a warning diagnostic and returned
  // — but the caller was told nothing, and over RPC it was told `responded: true`.
  // An external UI has to know its answer arrived too late, because the model was
  // told the call did not run.
  const root = await mkdtemp(join(tmpdir(), "natalia-stale-response-"));
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_stale_response",
    provider: scriptedProvider("nothing to approve"),
  });
  client.start(() => undefined);

  expect(
    await client.respondApproval({ requestID: "apr_never", decision: "once" }),
  ).toEqual({
    accepted: false,
    reason: "the approval request is no longer pending",
  });
  expect(
    await client.respondQuestion({
      requestID: "qst_never",
      answers: [["no"]],
      rejected: false,
    }),
  ).toEqual({
    accepted: false,
    reason: "the question request is no longer pending",
  });
  await client.dispose?.();
}, 30_000);

test("pause, resume and agent selection answer what the runtime did", async () => {
  // Each of these used to return nothing, so the RPC route replied with a
  // hard-coded success. A caller could pause a runtime with no turn and be told
  // the turn was held; it could select an agent that does not exist and be told
  // it was selected.
  const root = await mkdtemp(join(tmpdir(), "natalia-turn-control-"));
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_turn_control",
    permissionMode: "auto",
    provider: scriptedProvider("done"),
  });
  client.start(() => undefined);

  expect(await client.pause?.()).toEqual({
    paused: false,
    reason: "no turn has been submitted",
  });
  expect(await client.resume?.()).toEqual({
    resumed: false,
    reason: "no turn has been submitted",
  });

  await client.submit("hello");
  expect(await client.pause?.("user pause")).toEqual({ paused: true });
  expect(await client.pause?.("user pause")).toEqual({
    paused: true,
    reason: "already paused",
  });
  expect(await client.resume?.()).toEqual({ resumed: true });
  expect(await client.resume?.()).toEqual({
    resumed: false,
    reason: "the turn is not paused",
  });

  const unknown = await client.selectAgent?.("no-such-agent");
  expect(unknown).toEqual({
    outcome: "rejected",
    reason: "agent not found: no-such-agent",
  });
  expect((await client.selectAgent?.())?.outcome).toBe("applied");
  await client.dispose?.();
}, 30_000);

test("selecting an agent during a turn reports the selection as deferred, not applied", async () => {
  // Changing the agent underneath a running turn would change the rules it
  // started under, so the runtime defers it. That is a third outcome, and a
  // consumer that is told "applied" will show the new agent for a turn that is
  // still running under the old one.
  const root = await mkdtemp(join(tmpdir(), "natalia-agent-pending-"));
  let providerReached: (() => void) | undefined;
  const reached = new Promise<void>((resolve) => {
    providerReached = resolve;
  });
  let releaseProvider: (() => void) | undefined;
  const held = new Promise<void>((resolve) => {
    releaseProvider = resolve;
  });
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_agent_pending",
    permissionMode: "auto",
    provider: {
      provider: "scripted",
      model: "scripted",
      async *stream() {
        providerReached?.();
        await held;
        yield { type: "content" as const, text: "done" };
        yield { type: "done" as const };
      },
    },
  });
  client.start(() => undefined);
  const turn = client.submit("hold the turn open");
  await reached;

  expect(await client.selectAgent?.()).toMatchObject({ outcome: "pending" });

  releaseProvider?.();
  await turn;
  expect((await client.selectAgent?.())?.outcome).toBe("applied");
  await client.dispose?.();
}, 30_000);

test("an initialization failure surfaces its cause, not a derived symptom", async () => {
  // Before this fix, `start()` swallowed the failure into one diagnostic and
  // every member then answered with a derived symptom ("checkpoint store is
  // not initialized"), so a remote caller saw a pile of unrelated internal
  // errors with no way to find the cause. The failure must travel.
  const root = await mkdtemp(join(tmpdir(), "natalia-init-failure-"));
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_init_failure",
    // resolveConfig succeeds; the profile lookup is the controllable failure.
    permissionProfile: "no_such_profile",
    provider: scriptedProvider("unused"),
  });
  client.start(() => undefined);

  // Members that await initialization all fail with the *cause*. (snapshot
  // is a pure in-memory event constructor and correctly still answers.)
  const attempts: Array<() => Promise<unknown>> = [
    () => client.history!({ limit: 10 }),
    async () => {
      await client.checkpointList!();
    },
  ];
  for (const attempt of attempts) {
    const error = await attempt().catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(Error);
    expect(String(error)).toContain("permission profile not found");
  }
  // The pure constructor keeps working; nothing derived was invented.
  expect(client.snapshot().type).toBe("snapshot.created");
  await client.dispose?.();
}, 30_000);

test("session lifecycle: new is idempotent, archive marks, export dumps the journal", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-session-lifecycle-"));
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_lifecycle_host",
  });
  client.start(() => undefined);
  try {
    const created = await client.sessionNew?.({
      id: "ses_managed_1",
      title: "Managed",
    });
    expect(created).toEqual({ sessionID: "ses_managed_1", created: true });
    const replay = await client.sessionNew?.({ id: "ses_managed_1" });
    expect(replay).toEqual({ sessionID: "ses_managed_1", created: false });

    const minted = await client.sessionNew?.({});
    expect(minted?.sessionID).toMatch(/^ses_/u);
    expect(minted?.created).toBe(true);

    const archived = await client.sessionArchive?.("ses_managed_1");
    expect(archived).toEqual({ id: "ses_managed_1", archived: true });
    const again = await client.sessionArchive?.("ses_managed_1");
    expect(again).toEqual({ id: "ses_managed_1", archived: true });

    const list = await client.sessionList?.();
    const managed = list?.find((summary) => summary.id === "ses_managed_1");
    expect(managed?.archived).toBe(true);

    const exported = await client.sessionExport?.("ses_managed_1");
    expect(exported?.sessionID).toBe("ses_managed_1");
    expect(exported?.title).toBe("Managed");
    expect(exported?.archived).toBe(true);
    expect(exported?.events).toEqual([]);

    const missing = await client
      .sessionArchive?.("ses_does_not_exist")
      .catch((error: unknown) => error);
    expect((missing as Error).message).toContain("session not found");
  } finally {
    await client.dispose?.();
  }
});

test("session attach switches the active journal while a background turn keeps running", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-session-attach-"));
  let release: (() => void) | undefined;
  let calls = 0;
  const provider: StreamingProvider = {
    provider: "attach",
    model: "attach",
    async *stream() {
      calls += 1;
      if (calls === 1)
        await new Promise<void>((resolve) => {
          release = resolve;
        });
      yield { type: "content" as const, text: "first session" };
      yield { type: "done" as const };
    },
  };
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_attach_a",
    provider,
  });
  client.start(() => undefined);
  try {
    await client.sessionNew?.({ id: "ses_attach_b", title: "Second" });
    const turnA = client.submit("wait");
    await waitFor(() => release !== undefined);

    // D2: a turn in flight is no longer a refusal — it belongs to its own
    // session and keeps running in the background.
    expect(await client.sessionAttach?.("ses_attach_b")).toEqual({
      sessionID: "ses_attach_b",
    });
    // Session B runs its own turn while A's is still parked.
    await client.submit("second");
    await pollHistoryForFinished(client);
    const second = await client.history?.({ limit: 100 });
    expect(
      second?.events.some((entry) => entry.event.type === "turn.submitted"),
    ).toBe(true);

    // The background turn of A settles into A's journal.
    release?.();
    await turnA;

    expect(await client.sessionAttach?.("ses_attach_a")).toEqual({
      sessionID: "ses_attach_a",
    });
    await pollHistoryForFinished(client);
    const first = await client.history?.({ limit: 100 });
    expect(
      first?.events.some((entry) => entry.event.type === "turn.submitted"),
    ).toBe(true);
    expect(
      first?.events.some(
        (entry) =>
          entry.event.type === "turn.finished" &&
          (entry.event as { sessionID?: string }).sessionID === "ses_attach_a",
      ),
    ).toBe(true);
  } finally {
    await client.dispose?.();
  }
}, 30_000);

test("published events are stamped with the active session and re-stamped on attach", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-event-stamp-"));
  const events: RuntimeEvent[] = [];
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_stamp_a",
    provider: scriptedProvider("stamped"),
  });
  client.start((event) => events.push(event));
  try {
    await client.submit("hello");
    const first = events.filter(
      (event) =>
        event.type === "turn.submitted" ||
        event.type === "content.done" ||
        event.type === "turn.finished",
    );
    expect(first.length).toBeGreaterThan(0);
    for (const event of first)
      expect((event as { sessionID?: string }).sessionID).toBe("ses_stamp_a");
    // session.created carries its own id and is not double-stamped.
    const created = events.find((event) => event.type === "session.created");
    expect(created).toMatchObject({ sessionID: "ses_stamp_a" });

    await client.sessionNew?.({ id: "ses_stamp_b", title: "Second" });
    await client.sessionAttach?.("ses_stamp_b");
    events.splice(0);
    await client.submit("again");
    const second = events.filter((event) => event.type === "turn.submitted");
    expect(second).toHaveLength(1);
    expect((second[0] as { sessionID?: string }).sessionID).toBe("ses_stamp_b");
  } finally {
    await client.dispose?.();
  }
}, 30_000);

test("terminal panes are isolated per session across attach (I3)", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-i3-runtime-"));
  let nextPane = 501;
  const registry = new NativeTerminalRegistry(
    {
      kind: "wezterm",
      executable: "wezterm",
      async spawn() {
        const paneID = nextPane++;
        return { pane_id: paneID, window_id: 1, tab_id: paneID };
      },
      async list() {
        return [];
      },
      async read() {
        return "";
      },
      async write() {},
      async focus() {},
      async resize() {},
      async stop() {},
    },
    { windowMode: "windowless" },
  );
  const paneA = await registry.start({
    id: "i3_runtime_a",
    cwd: "/a",
    command: "cat",
    sessionID: "ses_i3_runtime_a",
  });
  const paneB = await registry.start({
    id: "i3_runtime_b",
    cwd: "/b",
    command: "cat",
    sessionID: "ses_i3_runtime_b",
  });
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_i3_runtime_a",
    nativeTerminal: registry,
    provider: scriptedProvider("i3"),
  });
  client.start(() => undefined);
  try {
    await client.sessionNew?.({ id: "ses_i3_runtime_b", title: "B" });
    await client.sessionNew?.({ id: "ses_i3_runtime_c", title: "C" });

    const visibleA = (await client.nativeTerminalList?.()) ?? [];
    expect(visibleA.map((session) => session.id)).toEqual([paneA.id]);

    await client.sessionAttach?.("ses_i3_runtime_b");
    const visibleB = (await client.nativeTerminalList?.()) ?? [];
    expect(visibleB.map((session) => session.id)).toEqual([paneB.id]);

    // A session without panes sees none; an unowned pane is never exposed.
    await client.sessionAttach?.("ses_i3_runtime_c");
    expect(await client.nativeTerminalList?.()).toEqual([]);

    // Attaching back restores the original session's panes.
    await client.sessionAttach?.("ses_i3_runtime_a");
    const visibleAgain = (await client.nativeTerminalList?.()) ?? [];
    expect(visibleAgain.map((session) => session.id)).toEqual([paneA.id]);
  } finally {
    await client.dispose?.();
  }
}, 30_000);

test("terminal_request_human reaches the registry audit with the bounded reason", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-request-human-"));
  const audit: Array<{ action: string; actor: string; detail?: string }> = [];
  const registry = new NativeTerminalRegistry(
    {
      kind: "wezterm",
      executable: "wezterm",
      async spawn() {
        return { pane_id: 701, window_id: 1, tab_id: 701 };
      },
      async list() {
        return [
          { pane_id: 701, window_id: 1, tab_id: 701, rows: 24, cols: 80 },
        ];
      },
      async read() {
        return "Password: ";
      },
      async write() {},
      async focus() {},
      async resize() {},
      async stop() {},
    },
    {
      windowMode: "windowless",
      onAudit: (event) => audit.push(event),
    },
  );
  const pane = await registry.start({
    id: "rh_runtime_1",
    cwd: root,
    command: "ssh host",
  });
  let requested = false;
  const provider: StreamingProvider = {
    provider: "request-human",
    model: "request-human",
    async *stream(request) {
      if (!request.messages.some((message) => message.role === "tool")) {
        yield {
          type: "tool_call" as const,
          calls: [
            {
              id: "call_rh",
              name: "interactive_terminal_request_human",
              arguments: JSON.stringify({
                id: pane.id,
                reason: "needs the sudo password",
              }),
            },
          ],
        };
        return;
      }
      requested = true;
      yield { type: "content" as const, text: "Waiting for the human." };
      yield { type: "done" as const };
    },
  };
  const events: RuntimeEvent[] = [];
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_request_human",
    nativeTerminal: registry,
    provider,
  });
  client.start((event) => {
    events.push(event);
    if (event.type === "approval.request")
      client.respondApproval({ requestID: event.id, decision: "once" });
  });
  try {
    await client.submit("ask the human");
    expect(requested).toBe(true);
    expect(audit.at(-1)).toMatchObject({
      id: "rh_runtime_1",
      action: "request_human",
      actor: "model",
      detail: "needs the sudo password",
    });
  } finally {
    await client.dispose?.();
  }
}, 30_000);

test("request_human endTurn settles as waiting_human and resumes automatically after release", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-continue-turn-"));
  const audit: Array<{ action: string; actor: string; detail?: string }> = [];
  const registry = new NativeTerminalRegistry(
    {
      kind: "wezterm",
      executable: "wezterm",
      async spawn() {
        return { pane_id: 711, window_id: 1, tab_id: 711 };
      },
      async list() {
        return [
          { pane_id: 711, window_id: 1, tab_id: 711, rows: 24, cols: 80 },
        ];
      },
      async read() {
        return "Password: ";
      },
      async write() {},
      async focus() {},
      async resize() {},
      async stop() {},
    },
    {
      windowMode: "windowless",
      onAudit: (event) => audit.push(event),
    },
  );
  const pane = await registry.start({
    id: "rh_continue_1",
    cwd: root,
    command: "ssh host",
  });
  let streamCalls = 0;
  const provider: StreamingProvider = {
    provider: "continue-turn",
    model: "continue-turn",
    async *stream(request) {
      streamCalls += 1;
      if (streamCalls === 1) {
        yield {
          type: "tool_call" as const,
          calls: [
            {
              id: "call_end_turn",
              name: "interactive_terminal_request_human",
              arguments: JSON.stringify({
                id: pane.id,
                reason: "needs the sudo password",
                endTurn: true,
              }),
            },
          ],
        };
        return;
      }
      if (streamCalls === 2) {
        // The tool ran; the model confirms and the turn settles waiting.
        yield { type: "content" as const, text: "Waiting for the human." };
        yield { type: "done" as const };
        return;
      }
      yield { type: "content" as const, text: "Continuing after the human." };
      yield { type: "done" as const };
    },
  };
  const events: RuntimeEvent[] = [];
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_continue_turn",
    nativeTerminal: registry,
    provider,
  });
  client.start((event) => {
    events.push(event);
    if (event.type === "approval.request")
      client.respondApproval({ requestID: event.id, decision: "once" });
  });
  try {
    await client.submit("ask the human");
    const finished = events.filter((event) => event.type === "turn.finished");
    expect(finished.at(-1)).toMatchObject({
      stopReason: "waiting_human",
    });
    expect(audit.at(-1)).toMatchObject({
      action: "request_human",
      detail: "needs the sudo password",
    });

    // The pending-human state is durable before the human acts.
    const persisted = JSON.parse(
      await readFile(
        join(root, ".natalia", "sessions", "ses_continue_turn.json"),
        "utf8",
      ),
    ) as { metadata?: { pendingHumanTerminal?: unknown } };
    expect(persisted.metadata?.pendingHumanTerminal).toMatchObject({
      terminalID: "rh_continue_1",
      reason: "needs the sudo password",
    });

    // Releasing the pane resumes the task with a fresh turn.
    await client.nativeTerminalReleaseHumanControl?.(pane.id);
    await waitFor(
      () =>
        events.filter(
          (event) =>
            event.type === "turn.finished" &&
            event.stopReason === "done" &&
            events.findIndex(
              (candidate) =>
                candidate.type === "turn.submitted" &&
                candidate.text.includes("[automated continuation]"),
            ) < events.indexOf(event),
        ).length >= 1,
    );
    const continuation = events.find(
      (event) =>
        event.type === "turn.submitted" &&
        event.text.includes("[automated continuation]"),
    );
    expect(continuation).toBeDefined();
    const doneAfter = events.filter(
      (event) => event.type === "turn.finished" && event.stopReason === "done",
    );
    expect(doneAfter.at(-1)).toBeDefined();
    expect(
      events.filter((event) => event.type === "turn.submitted"),
    ).toHaveLength(2);

    // The pending state is cleared once resumed.
    const afterResume = JSON.parse(
      await readFile(
        join(root, ".natalia", "sessions", "ses_continue_turn.json"),
        "utf8",
      ),
    ) as { metadata?: { pendingHumanTerminal?: unknown } };
    expect(afterResume.metadata?.pendingHumanTerminal).toBeUndefined();
  } finally {
    await client.dispose?.();
  }
}, 30_000);

test("releasing a pane that is not the pending one does not resume or clear state", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-continue-negative-"));
  const registry = new NativeTerminalRegistry(
    {
      kind: "wezterm",
      executable: "wezterm",
      async spawn() {
        return { pane_id: 721, window_id: 1, tab_id: 721 };
      },
      async list() {
        return [
          { pane_id: 721, window_id: 1, tab_id: 721, rows: 24, cols: 80 },
        ];
      },
      async read() {
        return "Password: ";
      },
      async write() {},
      async focus() {},
      async resize() {},
      async stop() {},
    },
    { windowMode: "windowless" },
  );
  const pending = await registry.start({
    id: "rh_pending",
    cwd: root,
    command: "ssh host",
  });
  const other = await registry.start({
    id: "rh_other",
    cwd: root,
    command: "cat",
  });
  let streamCalls = 0;
  const provider: StreamingProvider = {
    provider: "continue-negative",
    model: "continue-negative",
    async *stream(request) {
      streamCalls += 1;
      if (streamCalls === 1) {
        yield {
          type: "tool_call" as const,
          calls: [
            {
              id: "call_neg",
              name: "interactive_terminal_request_human",
              arguments: JSON.stringify({
                id: pending.id,
                reason: "needs input",
                endTurn: true,
              }),
            },
          ],
        };
        return;
      }
      yield { type: "content" as const, text: "Waiting." };
      yield { type: "done" as const };
    },
  };
  const events: RuntimeEvent[] = [];
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_continue_negative",
    nativeTerminal: registry,
    provider,
  });
  client.start((event) => events.push(event));
  try {
    await client.submit("ask");
    expect(
      events.filter((event) => event.type === "turn.finished").at(-1)
        ?.stopReason,
    ).toBe("waiting_human");

    await client.nativeTerminalReleaseHumanControl?.(other.id);
    await Bun.sleep(100);
    expect(
      events.filter((event) => event.type === "turn.submitted"),
    ).toHaveLength(1);
    const persisted = JSON.parse(
      await readFile(
        join(root, ".natalia", "sessions", "ses_continue_negative.json"),
        "utf8",
      ),
    ) as { metadata?: { pendingHumanTerminal?: unknown } };
    expect(persisted.metadata?.pendingHumanTerminal).toMatchObject({
      terminalID: "rh_pending",
    });
  } finally {
    await client.dispose?.();
  }
}, 30_000);

test("D5.3: a session approval stays with its session across attach", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-d53-grants-"));
  let approvalCount = 0;
  const provider: StreamingProvider = {
    provider: "d53",
    model: "d53",
    async *stream(request) {
      if (!request.messages.some((message) => message.role === "tool"))
        yield {
          type: "tool_call",
          calls: [
            {
              id: `call_${crypto.randomUUID()}`,
              name: "run_shell",
              arguments: JSON.stringify({ command: "pwd" }),
            },
          ],
        };
      yield { type: "done" };
    },
  };
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_d53_a",
    provider,
  });
  client.start((event) => {
    if (event.type !== "approval.request") return;
    approvalCount++;
    client.respondApproval({ requestID: event.id, decision: "session" });
  });
  try {
    await client.sessionNew?.({ id: "ses_d53_b", title: "B" });
    await client.submit("a1");
    await client.submit("a2");
    expect(approvalCount).toBe(1);

    // Session B has no grants: its first call asks again.
    await client.sessionAttach?.("ses_d53_b");
    await client.submit("b1");
    expect(approvalCount).toBe(2);

    // Attaching back to A restores A's grant: it was A's, never B's.
    await client.sessionAttach?.("ses_d53_a");
    await client.submit("a3");
    expect(approvalCount).toBe(2);
  } finally {
    await client.dispose?.();
  }
}, 30_000);

test("permission management: save validates, delete refuses the default, both persist", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-permission-manage-"));
  await mkdir(join(root, ".natalia"), { recursive: true });
  await writeFile(
    join(root, ".natalia", "config.json"),
    JSON.stringify({ version: 2 }),
  );
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_permission_host",
  });
  client.start(() => undefined);
  try {
    const saved = await client.permissionSave?.({
      name: "strict",
      profile: {
        approval: "ask",
        description: "Strict profile",
        permissions: { tools: { allow: ["echo"], exclude: [] } },
      },
    });
    expect(saved?.saved).toBe(true);

    const list = await client.permissionList?.();
    expect(list?.default).toBe("ask");
    expect(
      list?.profiles.find((profile) => profile.name === "strict"),
    ).toMatchObject({
      approval: "ask",
    });

    const refusedDefault = await client.permissionDelete?.("ask");
    expect(refusedDefault).toEqual({
      deleted: false,
      reason: "permission profile is the active default: ask",
    });

    const removed = await client.permissionDelete?.("strict");
    expect(removed?.deleted).toBe(true);
    const after = await client.permissionList?.();
    expect(
      after?.profiles.find((profile) => profile.name === "strict"),
    ).toBeUndefined();

    const configText = await Bun.file(
      join(root, ".natalia", "config.json"),
    ).text();
    expect(configText).not.toContain('"strict"');
  } finally {
    await client.dispose?.();
  }
});

test("mcp server management persists config and survives failed connections", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-mcp-manage-"));
  await mkdir(join(root, ".natalia"), { recursive: true });
  await writeFile(
    join(root, ".natalia", "config.json"),
    JSON.stringify({ version: 2 }),
  );
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_mcp_host",
  });
  client.start(() => undefined);
  try {
    const added = await client.mcpServerAdd?.({
      name: "demo",
      config: {
        type: "stdio",
        command: "false",
        args: [],
        enabled: true,
        allowedTools: [],
        excludedTools: [],
        readOnly: false,
        headers: {},
        environment: {},
        timeoutSec: 30,
      },
    });
    expect(added?.saved).toBe(true);
    const configText = await Bun.file(
      join(root, ".natalia", "config.json"),
    ).text();
    expect(configText).toContain('"demo"');

    const removed = await client.mcpServerRemove?.("demo");
    expect(removed?.removed).toBe(true);
    const again = await client.mcpServerRemove?.("demo");
    expect(again?.removed).toBe(true);
    const after = await Bun.file(join(root, ".natalia", "config.json")).text();
    expect(after).not.toContain('"demo"');
  } finally {
    await client.dispose?.();
  }
});

test("agent and provider management persist, validate references and survive apply", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-agent-provider-"));
  await mkdir(join(root, ".natalia"), { recursive: true });
  await writeFile(
    join(root, ".natalia", "config.json"),
    JSON.stringify({ version: 2 }),
  );
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_agent_provider_host",
  });
  client.start(() => undefined);
  try {
    const plannerConfig = {
      description: "Plans first",
      mode: "primary" as const,
      systemPrompt: "Plan before acting.",
      allowedTools: [],
      excludedTools: [],
      mcpServers: [],
      hidden: false,
    };
    const created = await client.agentCreate?.({
      name: "planner",
      config: plannerConfig,
    });
    expect(created?.created).toBe(true);
    const dup = await client.agentCreate?.({
      name: "planner",
      config: plannerConfig,
    });
    expect(dup?.created).toBe(false);
    expect(dup?.reason).toContain("already exists");
    const updated = await client.agentUpdate?.({
      name: "planner",
      config: { ...plannerConfig, description: "New" },
    });
    expect(updated?.updated).toBe(true);
    const missing = await client
      .agentUpdate?.({
        name: "nope",
        config: plannerConfig,
      })
      .catch((error: unknown) => error);
    expect((missing as Error).message).toContain("agent not found");

    const added = await client.providerAdd?.({
      name: "gw",
      type: "openai",
      baseURL: "http://127.0.0.1:1/v1",
      apiKey: "key",
    });
    expect(added?.saved).toBe(true);
    const removed = await client.providerRemove?.("gw");
    expect(removed?.removed).toBe(true);
    const again = await client.providerRemove?.("gw");
    expect(again?.removed).toBe(true);
  } finally {
    await client.dispose?.();
  }
});

test("plugin lifecycle: unload is idempotent, reload re-imports the module", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-plugin-lifecycle-"));
  await mkdir(join(root, ".natalia", "plugins", "demo.plugin"), {
    recursive: true,
  });
  await installPluginSdkLinks(root);
  await writeFile(
    join(root, ".natalia", "plugins", "demo.plugin", "natalia.plugin.json"),
    JSON.stringify({
      apiVersion: 1,
      id: "demo.plugin",
      version: "1.0.0",
      name: "Demo",
      capabilities: ["commands"],
    }),
  );
  await writeFile(
    join(root, ".natalia", "plugins", "demo.plugin", "index.ts"),
    `import { definePlugin } from "${pluginSdkImportPath()}";
export default definePlugin({
  manifest: { apiVersion: 1, id: "demo.plugin", version: "1.0.0", name: "Demo", capabilities: ["commands"] },
  setup(api) {
    api.commands.register({ name: "hello", title: "Hello", run() {} });
  },
});`,
  );
  await writeFile(
    join(root, ".natalia", "config.json"),
    JSON.stringify({ version: 2 }),
  );
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_plugin_host",
  });
  client.start(() => undefined);
  try {
    const catalog = await client.plugins?.();
    expect(catalog?.some((plugin) => plugin.id === "demo.plugin")).toBe(true);

    const unloaded = await client.pluginUnload?.("demo.plugin");
    expect(unloaded?.unloaded).toBe(true);
    const again = await client.pluginUnload?.("demo.plugin");
    expect(again?.unloaded).toBe(true);
    const afterUnload = await client.plugins?.();
    expect(afterUnload?.some((plugin) => plugin.id === "demo.plugin")).toBe(
      false,
    );

    const reloaded = await client.pluginReload?.("demo.plugin");
    expect(reloaded?.reloaded).toBe(true);
    const afterReload = await client.plugins?.();
    expect(afterReload?.some((plugin) => plugin.id === "demo.plugin")).toBe(
      true,
    );

    const missing = await client
      .pluginReload?.("missing.plugin")
      .catch((error: unknown) => error);
    expect((missing as Error).message).toContain("plugin not found");
  } finally {
    await client.dispose?.();
  }
});

test("two sessions writing the workspace in parallel both land without corruption", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-parallel-write-"));
  const makeWriter = (): StreamingProvider => ({
    provider: "parallel-write",
    model: "parallel-write",
    async *stream(request) {
      const userText = request.messages
        .map((message) =>
          typeof message.content === "string" ? message.content : "",
        )
        .join("\n");
      const path = userText.includes("write a") ? "wa.txt" : "wb.txt";
      if (!request.messages.some((message) => message.role === "tool"))
        yield {
          type: "tool_call" as const,
          calls: [
            {
              id: `call_${crypto.randomUUID()}`,
              name: "write_file",
              arguments: JSON.stringify({ path, content: `content-${path}` }),
            },
          ],
        };
      yield { type: "done" as const };
    },
  });
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_pw_a",
    provider: makeWriter(),
  });
  client.start((event) => {
    if (event.type === "approval.request") {
      client.respondApproval({ requestID: event.id, decision: "once" });
    }
    console.log(
      "EVT",
      event.type,
      (event as any).text ??
        (event as any).status ??
        (event as any).message ??
        (event as any).stopReason ??
        "",
    );
  });
  try {
    await client.sessionNew?.({ id: "ses_pw_b", title: "B" });
    const turnA = client.submit("write a");
    await client.sessionAttach?.("ses_pw_b");
    const turnB = client.submit("write b");
    await turnA;
    await turnB;
    expect(await readFile(join(root, "wa.txt"), "utf8")).toBe("content-wa.txt");
    expect(await readFile(join(root, "wb.txt"), "utf8")).toBe("content-wb.txt");
  } finally {
    await client.dispose?.();
  }
}, 30_000);

test("a background turn starting a terminal does not steal focus (I1)", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-i1-runtime-"));
  const focused: number[] = [];
  let nextPane = 901;
  const registry = new NativeTerminalRegistry(
    {
      kind: "wezterm",
      executable: "wezterm",
      async spawn() {
        const paneID = nextPane++;
        return { pane_id: paneID, window_id: 1, tab_id: paneID };
      },
      async list() {
        return [
          {
            pane_id: nextPane - 1,
            window_id: 1,
            tab_id: nextPane - 1,
            rows: 24,
            cols: 80,
          },
        ];
      },
      async read() {
        return "";
      },
      async write() {},
      async open(paneID, options) {
        return { pane_id: paneID, window_id: 1, tab_id: paneID };
      },
      async focus(paneID) {
        focused.push(paneID);
      },
      async resize() {},
      async stop() {},
    },
    { windowMode: "window" },
  );
  let release: (() => void) | undefined;
  let calls = 0;
  const provider: StreamingProvider = {
    provider: "i1",
    model: "i1",
    async *stream(request) {
      calls += 1;
      if (calls === 1) {
        await new Promise<void>((resolve) => {
          release = resolve;
        });
        yield {
          type: "tool_call" as const,
          calls: [
            {
              id: `call_${crypto.randomUUID()}`,
              name: "interactive_terminal_start",
              arguments: JSON.stringify({ command: "cat", id: "i1_bg_pane" }),
            },
          ],
        };
        return;
      }
      yield { type: "content" as const, text: "started" };
      yield { type: "done" as const };
    },
  };
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_i1_a",
    nativeTerminal: registry,
    provider,
  });
  client.start((event) => {
    if (event.type === "approval.request")
      client.respondApproval({ requestID: event.id, decision: "once" });
  });
  try {
    await client.sessionNew?.({ id: "ses_i1_b", title: "B" });
    const turnA = client.submit("start a terminal");
    await waitFor(() => release !== undefined);
    // A's turn is parked mid-stream; attach to B makes it a background turn.
    await client.sessionAttach?.("ses_i1_b");
    release?.();
    await turnA;
    // The background start opened no window and stole no focus.
    expect(focused).toEqual([]);
    // The pane belongs to A; B's view cannot see it (I3), A's can.
    expect(await client.nativeTerminalList?.()).toEqual([]);
    await client.sessionAttach?.("ses_i1_a");
    const visibleA = (await client.nativeTerminalList?.()) ?? [];
    expect(visibleA.map((session) => session.id)).toContain("i1_bg_pane");
  } finally {
    await client.dispose?.();
  }
}, 30_000);

test("settings surface: set writes the scope file, get resolves it, set announces", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-settings-"));
  const events: RuntimeEvent[] = [];
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_settings",
    provider: scriptedProvider("settings"),
  });
  client.start((event) => events.push(event));
  try {
    const before = await client.settingsGet?.();
    expect(before?.config).toMatchObject({
      theme: "natalia-dark",
      density: "comfortable",
    });
    expect(before?.sources.map((source) => source.scope)).toEqual([
      "defaults",
      "global",
      "project",
    ]);

    expect(
      await client.settingsSet?.(
        { theme: "solarized", density: "compact" },
        "project",
      ),
    ).toEqual({ applied: true });
    expect(events.at(-1)).toMatchObject({
      type: "settings.updated",
      scope: "project",
    });

    const after = await client.settingsGet?.();
    expect(after?.config).toMatchObject({
      theme: "solarized",
      density: "compact",
    });
    const projectSource = after?.sources.find(
      (source) => source.scope === "project",
    );
    expect(projectSource?.applied).toBe(true);

    // The project file actually holds the patch.
    const onDisk = JSON.parse(
      await readFile(join(root, ".natalia", "tui.json"), "utf8"),
    ) as Record<string, unknown>;
    expect(onDisk).toMatchObject({ theme: "solarized", density: "compact" });

    // An invalid patch is an argument error, never a partial write.
    await expect(
      client.settingsSet?.({ density: "bogus" }, "project"),
    ).rejects.toThrow();
    const stillValid = await client.settingsGet?.();
    expect(stillValid?.config).toMatchObject({ density: "compact" });
  } finally {
    await client.dispose?.();
  }
}, 30_000);

test("cancelling the attached session does not abort a background session's pending approval", async () => {
  // A background turn that starts waiting for an approval after the UI attached
  // elsewhere must listen to its own session's abort signal. Before this fix
  // the waiter took the active session's signal, so cancelling the foreground
  // session cancelled the background turn's pending approval.
  const root = await mkdtemp(join(tmpdir(), "natalia-bg-approval-abort-"));
  let releaseA: (() => void) | undefined;
  let releaseB: (() => void) | undefined;
  let aCalls = 0;
  const provider: StreamingProvider = {
    provider: "bg-abort",
    model: "bg-abort",
    async *stream(request) {
      const userText = String(
        [...request.messages]
          .reverse()
          .find((message) => message.role === "user")?.content ?? "",
      );
      if (userText.includes("bg write")) {
        aCalls += 1;
        if (request.messages.some((message) => message.role === "tool")) {
          yield { type: "content" as const, text: "bg written" };
          yield { type: "done" as const };
          return;
        }
        // Park the first provider round until the test attaches to B, so A's
        // approval wait starts while B is the attached session.
        if (aCalls === 1)
          await new Promise<void>((resolve) => (releaseA = resolve));
        yield {
          type: "tool_call" as const,
          calls: [
            {
              id: `call_a_${aCalls}`,
              name: "write_file",
              arguments: JSON.stringify({ path: "bg.txt", content: "bg" }),
            },
          ],
        };
        yield { type: "done" as const };
        return;
      }
      // The B turn parks in the provider so B holds a live abort signal while
      // A's approval is pending underneath it.
      await new Promise<void>((resolve) => (releaseB = resolve));
      yield { type: "content" as const, text: "b done" };
      yield { type: "done" as const };
    },
  };
  const events: RuntimeEvent[] = [];
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_bg_abort_a",
    provider,
  });
  client.start((event) => events.push(event));
  let turnB: ReturnType<typeof client.submit> | undefined;
  try {
    await client.sessionNew?.({ id: "ses_bg_abort_b", title: "B" });
    const turnA = client.submit("bg write");
    await waitFor(() => releaseA !== undefined);
    await client.sessionAttach?.("ses_bg_abort_b");
    turnB = client.submit("hold b");
    await waitFor(() => releaseB !== undefined);
    // A continues only now, so its approval wait begins after B is attached.
    releaseA?.();
    await waitFor(() =>
      events.some((event) => event.type === "approval.request"),
    );
    const approval = events.find(
      (event): event is Extract<RuntimeEvent, { type: "approval.request" }> =>
        event.type === "approval.request",
    );
    expect(approval?.sessionID).toBe("ses_bg_abort_a");

    // Cancel the attached (B) session. A's background approval must survive.
    client.cancel("cancel attached session");
    await Bun.sleep(100);
    expect(
      events.some(
        (event) =>
          event.type === "turn.finished" &&
          event.sessionID === "ses_bg_abort_a" &&
          event.stopReason === "cancelled",
      ),
    ).toBe(false);

    // Answer A's approval: the background turn completes normally.
    client.respondApproval({ requestID: approval!.id, decision: "once" });
    await turnA;
    expect(await readFile(join(root, "bg.txt"), "utf8")).toBe("bg");
    expect(
      events.filter(
        (event) =>
          event.type === "turn.finished" &&
          event.sessionID === "ses_bg_abort_a",
      ),
    ).toMatchObject([expect.objectContaining({ stopReason: "done" })]);
  } finally {
    releaseB?.();
    await turnB?.catch(() => undefined);
    await client.dispose?.();
  }
}, 30_000);

function sqliteContinueProvider(): StreamingProvider {
  return {
    provider: "sqlite-continue",
    model: "sqlite-continue",
    async *stream(request) {
      const userText = String(
        [...request.messages]
          .reverse()
          .find((message) => message.role === "user")?.content ?? "",
      );
      if (userText.includes("automated continuation")) {
        yield { type: "content" as const, text: "Continuing after the human." };
        yield { type: "done" as const };
        return;
      }
      if (!request.messages.some((message) => message.role === "tool")) {
        yield {
          type: "tool_call" as const,
          calls: [
            {
              id: "call_rh",
              name: "interactive_terminal_request_human",
              arguments: JSON.stringify({
                id: "rh_sqlite",
                reason: "needs the sudo password",
                endTurn: true,
              }),
            },
          ],
        };
        return;
      }
      yield { type: "content" as const, text: "Waiting for the human." };
      yield { type: "done" as const };
    },
  };
}

function sqliteContinueRegistry() {
  return new NativeTerminalRegistry(
    {
      kind: "wezterm",
      executable: "wezterm",
      async spawn() {
        return { pane_id: 991, window_id: 1, tab_id: 991 };
      },
      async list() {
        return [
          { pane_id: 991, window_id: 1, tab_id: 991, rows: 24, cols: 80 },
        ];
      },
      async read() {
        return "Password: ";
      },
      async write() {},
      async open() {
        return { pane_id: 991, window_id: 1, tab_id: 991, rows: 24, cols: 80 };
      },
      async focus() {},
      async resize() {},
      async stop() {},
    },
    { windowMode: "windowless" },
  );
}

test("SQLite restart recovers the pending human terminal and resumes exactly once after release", async () => {
  // TERM-M.3(c) continuation is already covered on the JSON path; SQLite keeps
  // the pending-human state in durable metadata, so a restart must restore it
  // and release must continue the task exactly once — never twice, and never
  // on its own before the human acts.
  const root = await mkdtemp(join(tmpdir(), "natalia-sqlite-continue-"));
  const sessionID = "ses_sqlite_continue" as SessionID;
  const databasePath = join(root, ".natalia", "sessions.db");

  // Phase 1: the model asks a human, the turn settles waiting_human, and the
  // pending state is durable in SQLite before the human acts.
  const firstEvents: RuntimeEvent[] = [];
  const firstRegistry = sqliteContinueRegistry();
  const first = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID,
    useSqliteStore: true,
    nativeTerminal: firstRegistry,
    provider: sqliteContinueProvider(),
  });
  first.start((event) => {
    firstEvents.push(event);
    if (event.type === "approval.request")
      first.respondApproval({ requestID: event.id, decision: "once" });
  });
  try {
    await firstRegistry.start({
      id: "rh_sqlite",
      cwd: root,
      command: "ssh host",
    });
    await first.submit("ask the human");
    expect(
      firstEvents.filter((event) => event.type === "turn.finished").at(-1),
    ).toMatchObject({ stopReason: "waiting_human" });
    const durable = new SqliteSessionStore(databasePath);
    try {
      expect(
        durable.get(sessionID)?.metadata?.pendingHumanTerminal,
      ).toMatchObject({
        terminalID: "rh_sqlite",
        reason: "needs the sudo password",
      });
    } finally {
      durable.close();
    }
  } finally {
    await first.dispose?.();
  }

  // Phase 2: restart the runtime against the same SQLite database. Nothing may
  // resume on its own, and one release resumes exactly one continuation turn.
  const reopenedEvents: RuntimeEvent[] = [];
  const reopenedRegistry = sqliteContinueRegistry();
  const reopened = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID,
    useSqliteStore: true,
    nativeTerminal: reopenedRegistry,
    provider: sqliteContinueProvider(),
  });
  reopened.start((event) => reopenedEvents.push(event), { replay: "none" });
  try {
    await waitFor(() =>
      reopenedEvents.some((event) => event.type === "session.ready"),
    );
    await Bun.sleep(100);
    expect(
      reopenedEvents.filter((event) => event.type === "turn.submitted"),
    ).toHaveLength(0);

    // The mux is still alive after restart: the pane record is rebuilt, then
    // the human releases it.
    await reopenedRegistry.start({
      id: "rh_sqlite",
      cwd: root,
      command: "ssh host",
    });
    await reopened.nativeTerminalReleaseHumanControl?.("rh_sqlite");
    await waitFor(
      () =>
        reopenedEvents.some(
          (event) =>
            event.type === "turn.finished" && event.stopReason === "done",
        ),
      2000,
    );
    expect(
      reopenedEvents.filter((event) => event.type === "turn.submitted"),
    ).toHaveLength(1);
    expect(
      reopenedEvents.some(
        (event) =>
          event.type === "turn.submitted" &&
          event.text.includes("[automated continuation]"),
      ),
    ).toBe(true);

    // A second release finds no pending state and must not resume again.
    await reopened.nativeTerminalReleaseHumanControl?.("rh_sqlite");
    await Bun.sleep(100);
    expect(
      reopenedEvents.filter((event) => event.type === "turn.submitted"),
    ).toHaveLength(1);

    const after = new SqliteSessionStore(databasePath);
    try {
      expect(
        after.get(sessionID)?.metadata?.pendingHumanTerminal,
      ).toBeUndefined();
    } finally {
      after.close();
    }
  } finally {
    await reopened.dispose?.();
  }
}, 30_000);

test("/skill-script aborts its child process when the command is cancelled", async () => {
  // A slash command has no turn, so its cancellation must travel through the
  // session drain signal. Before this fix the /skill-script command read the
  // never-assigned activity closure, so a cancelled script kept running to
  // completion.
  const root = await mkdtemp(join(tmpdir(), "natalia-skill-script-cancel-"));
  const skillRoot = join(root, ".natalia", "skills", "cancel-me");
  await mkdir(skillRoot, { recursive: true });
  await writeFile(
    join(skillRoot, "SKILL.md"),
    "---\nname: cancel-me\ndescription: Cancel me\nscripts: {long: sleep 30}\n---\nBody.",
  );
  const events: RuntimeEvent[] = [];
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_skill_script_cancel",
    provider: scriptedProvider("unused"),
  });
  client.start((event) => events.push(event));
  try {
    await waitFor(() => events.some((event) => event.type === "session.ready"));
    await client.submit("/skill cancel-me");
    // The long script starts; cancelling the command must abort its child.
    setTimeout(() => client.cancel("cancel the skill script"), 150);
    await client.submit("/skill-script long");
    const output = events
      .filter((event) => event.type === "content.delta")
      .map((event) => event.text)
      .join("\n");
    expect(output).toContain('"exitCode"');
    // A terminated child exits non-zero, not after its 30 second sleep.
    expect(output).not.toMatch(/"exitCode":\s*0/u);
  } finally {
    await client.dispose?.();
  }
}, 30_000);

test("capabilities() surfaces each capability's effective contributions", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-capability-contribs-"));
  const store = await NataliaTaskStateStore.open(root);
  store.startInvocation({
    invocationID: "inv_cap",
    taskID: "task_cap",
    episodeID: "epi_cap" as import("@natalia/contracts").EpisodeID,
    sessionID: "ses_cap_contribs" as SessionID,
  });
  store.activateModule({
    invocationID: "inv_cap",
    attempt: 1,
    flowID: "flow_cap",
    moduleID: "read",
    conditionIDs: [],
  });
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_cap_contribs",
    taskModuleContext: {
      store,
      invocationID: "inv_cap",
      attempt: 1,
      flowID: "flow_cap",
      moduleID: "read",
      moduleType: "read_search",
    },
    provider: scriptedProvider("unused"),
  });
  client.start(() => undefined);
  try {
    const records = await client.capabilities?.();
    expect(records).toBeDefined();
    const taskModule = records?.find(
      (record) => record.id === "natalia-task-module",
    );
    expect(taskModule?.contributions).toEqual([
      { kind: "tools", name: "flow_module_complete" },
    ]);
    // Built-in records declare grants without contributing; the array still exists.
    const terminal = records?.find(
      (record) => record.id === "natalia-terminal",
    );
    expect(terminal?.contributions).toEqual([]);
    expect(terminal?.scope).toBe("session");
    // The query is metadata only: no payload leaks through it.
    expect(JSON.stringify(taskModule?.contributions)).not.toContain("store");
  } finally {
    await client.dispose?.();
    store.close();
  }
}, 30_000);

test("cancelling a turn aborts a tool currently executing", async () => {
  // The tool-execution cancellation listener used to read an activity-scoped
  // `activeAbort` closure that is never assigned, so a cancelled turn never
  // aborted the in-flight tool: it kept running to completion (or timeout)
  // even though the turn had been cancelled. The listener must bind the turn's
  // own exec's abort signal.
  const root = await mkdtemp(join(tmpdir(), "natalia-tool-cancel-"));
  let toolAborted = false;
  let toolRuns = 0;
  const tools = createToolRegistry([]);
  tools.set("wait_for_cancel", {
    name: "wait_for_cancel",
    description: "Wait until the turn is cancelled.",
    requiresApproval: false,
    timeoutSec: 30,
    parameters: { type: "object", properties: {} },
    async execute(_args, context) {
      toolRuns += 1;
      return await new Promise<string>((resolve) => {
        const signal = context.signal;
        if (signal?.aborted) {
          toolAborted = true;
          resolve("aborted");
          return;
        }
        signal?.addEventListener(
          "abort",
          () => {
            toolAborted = true;
            resolve("aborted");
          },
          { once: true },
        );
      });
    },
  });
  const events: RuntimeEvent[] = [];
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_tool_cancel",
    tools,
    provider: {
      provider: "tool-cancel",
      model: "tool-cancel",
      async *stream(request) {
        if (request.signal?.aborted) throw new Error("cancelled");
        if (!request.messages.some((message) => message.role === "tool"))
          yield {
            type: "tool_call" as const,
            calls: [
              {
                id: "call_cancel",
                name: "wait_for_cancel",
                arguments: "{}",
              },
            ],
          };
        yield { type: "done" as const };
      },
    },
  });
  client.start((event) => {
    events.push(event);
    if (event.type === "tool.update" && event.status === "running")
      setTimeout(() => client.cancel("stop the tool"), 10);
  });
  try {
    await client.submit("run the waiting tool");
    expect(toolRuns).toBe(1);
    // The in-flight tool observed the cancellation and settled.
    expect(toolAborted).toBe(true);
    expect(events).toContainEqual(
      expect.objectContaining({ type: "turn.cancelled" }),
    );
    expect(
      events.some(
        (event) =>
          event.type === "turn.finished" && event.stopReason === "cancelled",
      ),
    ).toBe(true);
  } finally {
    await client.dispose?.();
  }
}, 30_000);

test("a cancellation during the durable in-flight write still aborts the tool", async () => {
  // The window the 10ms-timer test above only hits by luck: `tool.update
  // running` is published, then the runtime awaits a durable in-flight write,
  // and only then attaches the abort listener. Cancelling synchronously on the
  // `running` event lands inside that window every time, and an
  // already-aborted signal never fires `abort` again — so the tool used to run
  // to its own timeout with the turn already cancelled.
  const root = await mkdtemp(join(tmpdir(), "natalia-tool-cancel-window-"));
  let toolAborted = false;
  const tools = createToolRegistry([]);
  tools.set("wait_for_cancel", {
    name: "wait_for_cancel",
    description: "Wait until the turn is cancelled.",
    requiresApproval: false,
    // No timeout: if the cancellation is dropped there is nothing to rescue the
    // call, which is exactly the user-visible failure being pinned.
    parameters: { type: "object", properties: {} },
    async execute(_args, context) {
      return await new Promise<string>((resolve) => {
        const signal = context.signal;
        if (signal?.aborted) {
          toolAborted = true;
          resolve("aborted");
          return;
        }
        signal?.addEventListener(
          "abort",
          () => {
            toolAborted = true;
            resolve("aborted");
          },
          { once: true },
        );
      });
    },
  });
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_tool_cancel_window",
    tools,
    provider: {
      provider: "tool-cancel",
      model: "tool-cancel",
      async *stream(request) {
        if (request.signal?.aborted) throw new Error("cancelled");
        if (!request.messages.some((message) => message.role === "tool"))
          yield {
            type: "tool_call" as const,
            calls: [
              { id: "call_window", name: "wait_for_cancel", arguments: "{}" },
            ],
          };
        yield { type: "done" as const };
      },
    },
  });
  client.start((event) => {
    if (event.type === "tool.update" && event.status === "running")
      client.cancel("stop the tool");
  });
  try {
    await client.submit("run the waiting tool");
    expect(toolAborted).toBe(true);
  } finally {
    await client.dispose?.();
  }
}, 20_000);

test("the live work chat read and rollback surface a durable conversation", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-chat-"));
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_chat_slice_a",
    provider: {
      provider: "test",
      model: "test",
      async *stream() {
        yield { type: "done" as const };
      },
    },
  });
  client.start(() => undefined);
  // Slice A data plane: a fresh conversation is empty and an unknown rollback
  // boundary is a no-op (removed 0), never a crash. The full message flow is
  // covered once the Chat execution slice lands (chatSubmit).
  expect(await client.chatMessages!()).toEqual([]);
  expect(await client.chatRollback!({ toMessageID: "chat:nope" })).toEqual({
    rolledBackTo: "chat:nope",
    removed: 0,
  });
  await client.dispose?.();
});

test("chat submit runs a live work chat turn and persists the conversation", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-chat-turn-"));
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_chat_turn",
    provider: {
      provider: "test",
      model: "test",
      async *stream() {
        yield {
          type: "content" as const,
          text: "the main agent is running step 2",
        };
        yield { type: "done" as const };
      },
    },
  });
  client.start(() => undefined);
  const outcome = await client.chatSubmit!({
    text: "what is the agent doing",
  });
  expect(outcome.messageID.length).toBeGreaterThan(0);
  const history = await client.chatMessages!();
  expect(history).toHaveLength(2);
  expect(history[0]).toMatchObject({
    role: "user",
    text: "what is the agent doing",
  });
  expect(history[1]).toMatchObject({ role: "chat" });
  expect(history[1].text).toContain("running step 2");
  await client.dispose?.();
});

test("chat tool calls surface as conversation actions", async () => {
  let streamCalls = 0;
  const root = await mkdtemp(join(tmpdir(), "natalia-chat-tool-"));
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_chat_tool",
    provider: {
      provider: "test",
      model: "test",
      async *stream() {
        // The generator re-runs from the top on every stream call, so only the
        // first call offers the tool; later steps reply in text and settle.
        streamCalls += 1;
        if (streamCalls === 1) {
          yield {
            type: "tool_call" as const,
            calls: [
              {
                id: "call_1",
                name: "mailbox_send",
                arguments: JSON.stringify({
                  intent: "constraint",
                  text: "do not install that dependency",
                }),
              },
            ],
          };
          return;
        }
        yield {
          type: "content" as const,
          text: "I queued the constraint for the main agent.",
        };
        yield { type: "done" as const };
      },
    },
  });
  const events: RuntimeEvent[] = [];
  client.start((event) => events.push(event));
  await client.chatSubmit!({ text: "do not install that dependency" });
  const actions = events.filter((event) => event.type === "chat.tool.used");
  expect(actions).toHaveLength(1);
  expect(actions[0]).toMatchObject({ toolName: "mailbox_send" });
  expect((actions[0] as { summary: string }).summary).toContain(
    "queued mailbox intent: constraint",
  );
  await client.dispose?.();
});

test("the chat context includes the main agent's recent activity", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-chat-ctx-"));
  let streamCalls = 0;
  let chatSystemPrompt = "";
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_chat_ctx",
    provider: {
      provider: "test",
      model: "test",
      async *stream(request) {
        streamCalls++;
        if (streamCalls === 1) {
          yield {
            type: "content" as const,
            text: "I replaced the fetch wrapper",
          };
          yield { type: "done" as const };
          return;
        }
        chatSystemPrompt = String(
          (request as { messages: Array<{ role: string; content: string }> })
            .messages[0]?.content ?? "",
        );
        yield {
          type: "content" as const,
          text: "the main agent said it replaced the wrapper",
        };
        yield { type: "done" as const };
      },
    },
  });
  client.start(() => undefined);
  await client.submit("replace the wrapper");
  await pollHistoryForFinished(client);
  await client.chatSubmit!({ text: "what did the main agent just say" });
  // The Chat shares the main agent's recent exchange — the user's prompt and
  // the reply — so it can answer the question instead of only seeing the
  // status card (§8.3 shared context).
  expect(chatSystemPrompt).toContain("I replaced the fetch wrapper");
  expect(chatSystemPrompt).toContain("replace the wrapper");
  await client.dispose?.();
});

test("a queued mailbox intent wakes an idle main agent", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-mailbox-deliver-"));
  const systemPrompts: string[] = [];
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_mailbox_deliver",
    provider: {
      provider: "test",
      model: "test",
      async *stream(request) {
        systemPrompts.push(
          String(
            (
              request as {
                messages: Array<{ role: string; content: string }>;
              }
            ).messages[0]?.content ?? "",
          ),
        );
        yield { type: "content" as const, text: "will do" };
        yield { type: "done" as const };
      },
    },
  });
  client.start(() => undefined);
  await client.mailboxSend!({
    intent: "constraint",
    text: "do not install that dependency",
  });
  // The mailbox intent wakes the idle main agent: no manual submission is
  // needed, the turn runs as if the user had typed the directive (P8 §7).
  await pollHistoryForFinished(client);
  expect(systemPrompts[0]).toContain("do not install that dependency");
  await client.dispose?.();
});

test("a chat tool parameter error returns the usage to the model for retry", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-chat-retry-"));
  let streamCalls = 0;
  let secondStepToolMessages: unknown[] = [];
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_chat_retry",
    provider: {
      provider: "test",
      model: "test",
      async *stream(request) {
        streamCalls++;
        if (streamCalls === 1) {
          yield {
            type: "tool_call" as const,
            calls: [
              {
                id: "call_1",
                name: "read_file",
                arguments: JSON.stringify({ path: "a.txt", maxBytes: 100 }),
              },
            ],
          };
          return;
        }
        secondStepToolMessages = (
          request as { messages: Array<{ role: string; content: string }> }
        ).messages
          .filter((message) => message.role === "tool")
          .map((message) => message.content);
        yield { type: "content" as const, text: "I read the file" };
        yield { type: "done" as const };
      },
    },
  });
  client.start(() => undefined);
  await client.chatSubmit!({ text: "read the file" });
  const history = await client.chatMessages!();
  expect(history.at(-1)?.text).toContain("I read the file");
  // The bad call came back as a tool result carrying the correct calling
  // convention, so the model could retry on the next step.
  expect(
    secondStepToolMessages.some((content) =>
      String(content).includes("parameter validation failed"),
    ),
  ).toBe(true);
  await client.dispose?.();
});

test("the chat can query the main agent's live status with session_snapshot", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-chat-snapshot-"));
  let streamCalls = 0;
  let snapshotToolResult = "";
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_chat_snapshot",
    provider: {
      provider: "test",
      model: "test",
      async *stream(request) {
        streamCalls++;
        if (streamCalls === 1) {
          yield {
            type: "tool_call" as const,
            calls: [
              {
                id: "call_1",
                name: "session_snapshot",
                arguments: "{}",
              },
            ],
          };
          return;
        }
        snapshotToolResult = String(
          (
            request as {
              messages: Array<{ role: string; content: string }>;
            }
          ).messages.filter((message) => message.role === "tool")[0]?.content ??
            "",
        );
        yield {
          type: "content" as const,
          text: "the main agent is running step 2",
        };
        yield { type: "done" as const };
      },
    },
  });
  client.start(() => undefined);
  await client.chatSubmit!({ text: "what is the main agent doing" });
  // The read-only snapshot tool returned the live status to the model.
  expect(snapshotToolResult).toContain("agentStatus");
  await client.dispose?.();
});

test("the collaboration channel round-robins between Navi and the main agent", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-collab-"));
  let mainPrompt = "";
  let chatPrompt2 = "";
  let mainResponded = false;
  let naviSuggested = false;
  const rrEvents: RuntimeEvent[] = [];
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_collab",
    provider: {
      provider: "test",
      model: "test",
      async *stream(request) {
        const system = String(
          (request as { messages: Array<{ role: string; content: string }> })
            .messages[0]?.content ?? "",
        );
        // Chat turns carry her sister's questions/outcomes block; main-agent
        // turns never do, so the source of a stream call is content, not a
        // call counter (the wake runs concurrently).
        const naviTurn = system.includes("<natalia_collaborations>");
        if (!naviTurn) {
          mainPrompt = system;
          if (!mainResponded) {
            mainResponded = true;
            // Natalia's wake turn: adopt Navi's suggestion.
            const match = /\[Navi\] (collab:suggestion:[a-z0-9]+:[0-9]+)/u.exec(
              system,
            );
            yield {
              type: "tool_call" as const,
              calls: [
                {
                  id: "c2",
                  name: "collab_respond",
                  arguments: JSON.stringify({
                    messageID: match?.[1] ?? "",
                    decision: "adopted",
                  }),
                },
              ],
            };
            return;
          }
          yield { type: "content" as const, text: "ok" };
          yield { type: "done" as const };
          return;
        }
        chatPrompt2 = system;
        if (!naviSuggested) {
          // Navi's first turn: send the suggestion.
          naviSuggested = true;
          yield {
            type: "tool_call" as const,
            calls: [
              {
                id: "c1",
                name: "collab_suggest",
                arguments: JSON.stringify({
                  suggestion: "prefer echo over cat for the demo",
                  priority: "normal",
                }),
              },
            ],
          };
          return;
        }
        yield { type: "content" as const, text: "she adopted it" };
        yield { type: "done" as const };
      },
    },
  });
  client.start((event) => rrEvents.push(event));
  await client.chatSubmit!({ text: "suggest echo" });
  // The suggestion wakes the idle main agent, whose wake turn already carries
  // the suggestion (the 轮巡) — no extra user submission needed.
  await waitForAsync(async () => mainPrompt.length > 0, 10000);
  // The main agent knows who Navi is and sees her suggestion without the user
  // prompting it (the 轮巡).
  expect(mainPrompt).toContain("<live_work_chat>");
  expect(mainPrompt).toContain("your younger sister");
  expect(mainPrompt).toContain("<navi_collaborations>");
  expect(mainPrompt).toContain("prefer echo over cat for the demo");
  // Wait until the wake main turn's decision lands, so Navi's next prompt is
  // built after the outcome exists (the round-robin race).
  await waitForAsync(
    async () => rrEvents.some((event) => event.type === "collab.response"),
    10000,
  );
  await client.chatSubmit!({ text: "what did she decide" });
  await waitForAsync(async () => chatPrompt2.includes("adopted"), 10000);
  // Navi sees the outcome without the user prompting her.
  expect(chatPrompt2).toContain("Outcomes of your suggestions to Natalia");
  expect(chatPrompt2).toContain("adopted");
  await client.dispose?.();
}, 20000);

test("an idle Navi answers Natalia's question immediately without a user chat", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-navi-wake-"));
  let streamCalls = 0;
  let naviStreamCount = 0;
  const mainPrompts: string[] = [];
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_navi_wake",
    provider: {
      provider: "test",
      model: "test",
      async *stream(request) {
        streamCalls++;
        const system = String(
          (request as { messages: Array<{ role: string; content: string }> })
            .messages[0]?.content ?? "",
        );
        // The Navi wake turn's context carries her sister's pending questions;
        // the main agent's context never does.
        const naviTurn = system.includes("<natalia_collaborations>");
        if (!naviTurn) {
          mainPrompts.push(system);
          if (streamCalls === 1) {
            yield {
              type: "tool_call" as const,
              calls: [
                {
                  id: "c1",
                  name: "collab_ask",
                  arguments: JSON.stringify({ question: "is echo safe" }),
                },
              ],
            };
            return;
          }
          yield { type: "content" as const, text: "ok" };
          yield { type: "done" as const };
          return;
        }
        naviStreamCount++;
        if (naviStreamCount === 1) {
          const match =
            /\[Natalia → you\] (collab:question:[a-z0-9]+:[0-9]+)/u.exec(
              system,
            );
          yield {
            type: "tool_call" as const,
            calls: [
              {
                id: "c2",
                name: "collab_answer",
                arguments: JSON.stringify({
                  questionID: match?.[1] ?? "",
                  answer: "yes, echo is safe",
                }),
              },
            ],
          };
          return;
        }
        yield { type: "content" as const, text: "answered natalia" };
        yield { type: "done" as const };
      },
    },
  });
  const events: RuntimeEvent[] = [];
  client.start((event) => events.push(event));
  // No chatSubmit at all: the question wakes Navi and she answers on her own.
  await client.submit("hello");
  await waitForAsync(async () =>
    events.some((event) => event.type === "collab.answer"),
  );
  const answer = events.find((event) => event.type === "collab.answer");
  expect(answer).toMatchObject({ answer: "yes, echo is safe" });
  // The answer reaches Natalia's own context on her next turn (the 轮巡).
  await client.submit("continue");
  await waitForAsync(async () => mainPrompts.length >= 2);
  expect(mainPrompts.at(-1)).toContain("<navi_responses>");
  expect(mainPrompts.at(-1)).toContain("yes, echo is safe");
  await client.dispose?.();
}, 20000);

test("collab_inbox lets the main agent read Navi's answer on demand", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-collab-inbox-"));
  let streamCalls = 0;
  let naviStreamCount = 0;
  let inboxToolResult = "";
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_collab_inbox",
    provider: {
      provider: "test",
      model: "test",
      async *stream(request) {
        streamCalls++;
        const system = String(
          (request as { messages: Array<{ role: string; content: string }> })
            .messages[0]?.content ?? "",
        );
        const toolMessages = (
          request as {
            messages: Array<{ role: string; content: string }>;
          }
        ).messages.filter((message) => message.role === "tool");
        const naviTurn = system.includes("<natalia_collaborations>");
        if (!naviTurn) {
          if (streamCalls === 1) {
            yield {
              type: "tool_call" as const,
              calls: [
                {
                  id: "c1",
                  name: "collab_ask",
                  arguments: JSON.stringify({ question: "is echo safe" }),
                },
              ],
            };
            return;
          }
          if (streamCalls === 5) {
            yield {
              type: "tool_call" as const,
              calls: [{ id: "c5", name: "collab_inbox", arguments: "{}" }],
            };
            return;
          }
          if (streamCalls === 6) {
            inboxToolResult = String(toolMessages.at(-1)?.content ?? "");
          }
          yield { type: "content" as const, text: "ok" };
          yield { type: "done" as const };
          return;
        }
        naviStreamCount++;
        if (naviStreamCount === 1) {
          const match =
            /\[Natalia → you\] (collab:question:[a-z0-9]+:[0-9]+)/u.exec(
              system,
            );
          yield {
            type: "tool_call" as const,
            calls: [
              {
                id: "c2",
                name: "collab_answer",
                arguments: JSON.stringify({
                  questionID: match?.[1] ?? "",
                  answer: "yes, echo is safe",
                }),
              },
            ],
          };
          return;
        }
        yield { type: "content" as const, text: "answered natalia" };
        yield { type: "done" as const };
      },
    },
  });
  client.start(() => undefined);
  await client.submit("hello");
  await client.submit("check");
  await waitForAsync(async () => inboxToolResult.length > 0);
  expect(inboxToolResult).toContain("yes, echo is safe");
  await client.dispose?.();
}, 20000);

test("collab_answer accepts a truncated question id (models drop the prefix)", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-collab-trunc-"));
  let streamCalls = 0;
  let naviStreamCount = 0;
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_collab_trunc",
    provider: {
      provider: "test",
      model: "test",
      async *stream(request) {
        streamCalls++;
        const system = String(
          (request as { messages: Array<{ role: string; content: string }> })
            .messages[0]?.content ?? "",
        );
        const naviTurn = system.includes("<natalia_collaborations>");
        if (!naviTurn) {
          if (streamCalls === 1) {
            yield {
              type: "tool_call" as const,
              calls: [
                {
                  id: "c1",
                  name: "collab_ask",
                  arguments: JSON.stringify({ question: "is echo safe" }),
                },
              ],
            };
            return;
          }
          yield { type: "content" as const, text: "ok" };
          yield { type: "done" as const };
          return;
        }
        naviStreamCount++;
        if (naviStreamCount === 1) {
          const match = /questionID: (collab:question:[a-z0-9]+:[0-9]+)/u.exec(
            system,
          );
          // The model truncates the id to its tail, dropping the prefix.
          const truncated = (match?.[1] ?? "").replace(
            /^collab:question:/u,
            "",
          );
          yield {
            type: "tool_call" as const,
            calls: [
              {
                id: "c2",
                name: "collab_answer",
                arguments: JSON.stringify({
                  questionID: truncated,
                  answer: "yes, echo is safe",
                }),
              },
            ],
          };
          return;
        }
        yield { type: "content" as const, text: "answered natalia" };
        yield { type: "done" as const };
      },
    },
  });
  const events: RuntimeEvent[] = [];
  client.start((event) => events.push(event));
  await client.submit("hello");
  await waitForAsync(async () =>
    events.some((event) => event.type === "collab.answer"),
  );
  const answer = events.find((event) => event.type === "collab.answer");
  expect(answer).toMatchObject({ answer: "yes, echo is safe" });
  await client.dispose?.();
}, 20000);
