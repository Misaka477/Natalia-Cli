import { expect, test } from "bun:test";
import type {
  RuntimeClient,
  RuntimeEvent,
  SubmittedTurn,
} from "@natalia/contracts";
import { createRuntimeHttpServer } from "@natalia/transport";
import { createNataliaSDK } from "../src";

test("SDK uses the TS RPC transport rather than runtime internals", async () => {
  let sink: ((event: RuntimeEvent) => void) | undefined;
  const approvalResponses: unknown[] = [];
  const questionResponses: unknown[] = [];
  const prompts: string[] = [];
  const selectedAgents: Array<string | undefined> = [];
  const selectedModels: Array<{ modelID?: string; variant?: string }> = [];
  const client: RuntimeClient = {
    start(handler) {
      sink = handler;
    },
    async submit(text) {
      prompts.push(text);
      const event = {
        type: "turn.submitted",
        id: "turn_sdk",
        text,
        byteLength: text.length,
        lineCount: 1,
        sha256: "sdk",
      } satisfies SubmittedTurn;
      sink?.(event);
      return event;
    },
    cancel() {},
    pause() {},
    resume() {},
    selectAgent(name) {
      selectedAgents.push(name);
    },
    async modelCatalog() {
      return [
        { id: "alpha", name: "alpha", provider: "fixture", variants: ["fast"] },
      ];
    },
    async modelSelection() {
      return { modelID: "alpha", variant: "fast" };
    },
    async selectModel(modelID, variant) {
      selectedModels.push({ modelID, variant });
    },
    async skills() {
      return [
        {
          name: "release",
          qualifiedName: "project:release",
          description: "Prepare release evidence",
          source: "project",
          requireApproval: true,
          sandboxRequired: false,
        },
      ];
    },
    async workspaceFiles() {
      return [{ path: "src/model.ts", type: "file" }];
    },
    async workspaceSearch() {
      return [{ path: "src/model.ts", line: 2, text: "needle" }];
    },
    async workspaceList() {
      return [{ path: "src/", type: "directory" }];
    },
    async workspaceRead() {
      return {
        path: "src/model.ts",
        content: "export {}\n",
        encoding: "utf8",
        mime: "text/typescript",
      };
    },
    async workspaceGlob() {
      return [{ path: "src/model.ts", type: "file" }];
    },
    async mcpCatalog() {
      return {
        prompts: [{ server: "fixture", name: "review" }],
        resources: [{ server: "fixture", uri: "file:///guide", name: "guide" }],
      };
    },
    async getMcpPrompt(server, name, arguments_) {
      return { server, name, arguments: arguments_ };
    },
    async readMcpResource(server, uri) {
      return { server, uri };
    },
    async plugins() {
      return [
        {
          id: "demo.plugin",
          version: "1.0.0",
          name: "Demo",
          description: "",
          capabilities: ["tools"],
        },
      ];
    },
    async runtimeStatus() {
      return {
        type: "status.snapshot",
        model: "test",
        provider: "fixture",
        context: "0 tokens",
        step: "0",
        permissions: "ask",
        cwd: "/tmp",
        background: "0 running",
      };
    },
    async diagnostics() {
      return [
        {
          type: "diagnostic",
          level: "info",
          message: "safe",
          at: "2026-07-22T00:00:00.000Z",
        },
      ];
    },
    snapshot: () => ({ type: "snapshot.created", id: "snap_sdk", files: [] }),
    diagnostic() {},
    lastSubmission: () => undefined,
    respondApproval(response) {
      approvalResponses.push(response);
    },
    respondQuestion(response) {
      questionResponses.push(response);
    },
  };
  const server = createRuntimeHttpServer({ client, token: "sdk-token" });
  const sdk = createNataliaSDK({ baseURL: server.url, token: "sdk-token" });
  expect(await sdk.health()).toEqual({ ok: true });
  expect(await sdk.prompt("sdk prompt")).toMatchObject({
    id: "turn_sdk",
    text: "sdk prompt",
  });
  expect(await sdk.snapshot()).toMatchObject({ id: "snap_sdk" });
  expect(await sdk.mcpCatalog()).toMatchObject({
    prompts: [{ server: "fixture", name: "review" }],
  });
  expect(await sdk.mcpPrompt("fixture", "review", { scope: "local" })).toEqual({
    server: "fixture",
    name: "review",
    arguments: { scope: "local" },
  });
  expect(await sdk.mcpResource("fixture", "file:///guide")).toEqual({
    server: "fixture",
    uri: "file:///guide",
  });
  expect(await sdk.plugins()).toMatchObject([
    { id: "demo.plugin", capabilities: ["tools"] },
  ]);
  expect(await sdk.runtimeStatus()).toMatchObject({ provider: "fixture" });
  expect(await sdk.diagnostics(1)).toMatchObject([{ message: "safe" }]);
  await sdk.pause("sdk pause");
  await sdk.resume();
  await sdk.selectAgent("reviewer");
  expect(await sdk.modelCatalog()).toMatchObject([
    { id: "alpha", variants: ["fast"] },
  ]);
  expect(await sdk.modelSelection()).toEqual({
    modelID: "alpha",
    variant: "fast",
  });
  await sdk.selectModel("alpha", "fast");
  expect(await sdk.skills()).toMatchObject([
    { qualifiedName: "project:release" },
  ]);
  expect(await sdk.workspaceFiles({ query: "model" })).toEqual([
    { path: "src/model.ts", type: "file" },
  ]);
  expect(await sdk.workspaceSearch({ query: "needle" })).toEqual([
    { path: "src/model.ts", line: 2, text: "needle" },
  ]);
  expect(await sdk.workspaceList()).toEqual([
    { path: "src/", type: "directory" },
  ]);
  expect(await sdk.workspaceRead({ path: "src/model.ts" })).toMatchObject({
    encoding: "utf8",
  });
  expect(await sdk.workspaceGlob({ pattern: "**/*.ts" })).toEqual([
    { path: "src/model.ts", type: "file" },
  ]);
  await sdk.respondApproval({ requestID: "approval_1", decision: "once" });
  await sdk.respondQuestion({ requestID: "question_1", answers: [["yes"]] });
  await sdk.checkpoint();
  await sdk.checkpoints(2);
  await sdk.rollback("checkpoint_1", { dryRun: true });
  expect(approvalResponses).toContainEqual({
    requestID: "approval_1",
    decision: "once",
  });
  expect(questionResponses).toContainEqual({
    requestID: "question_1",
    answers: [["yes"]],
    rejected: false,
  });
  expect(selectedAgents).toEqual(["reviewer"]);
  expect(selectedModels).toEqual([{ modelID: "alpha", variant: "fast" }]);
  expect(prompts).toEqual(
    expect.arrayContaining([
      "/checkpoint",
      "/checkpoints --limit 2",
      "/rollback checkpoint_1 --dry-run",
    ]),
  );
  const events = sdk.events({ since: 4 });
  await sdk.prompt("event prompt");
  const first = await events[Symbol.asyncIterator]().next();
  expect(first.value).toMatchObject({
    type: "turn.submitted",
    text: "event prompt",
  });
  server.stop(true);
});
