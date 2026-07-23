import { createMockKeys } from "@opentui/core/testing";
import type {
  RuntimeClient,
  RuntimeEvent,
  SubmittedTurn,
} from "@natalia/contracts";
import { lineCount, makeDigest } from "@natalia/testing";
import { runTuiShell } from "../src/app/runtime";

const submissions: string[] = [];
const attachmentSubmissions: Array<{
  text: string;
  attachments?: string[];
  agents?: Array<{ name: string }>;
  resources?: Array<{ server: string; uri: string; name: string }>;
}> = [];
const workspaceFiles = [{ path: "src/mentioned.ts", type: "file" as const }];
const selectedAgents: Array<string | undefined> = [];
const forkCalls: Array<{ id: string; turnID: string }> = [];
let statusLoads = 0;
const statusLoadCount = () => statusLoads;
const handle = await runTuiShell({
  backend: makeBackend(),
  closeAfterInitialTurn: false,
  rendererSize: { width: 100, height: 28 },
});
const keys = createMockKeys(handle.renderer, { kittyKeyboard: true });
await Bun.sleep(100);

await keys.typeText("hello");
keys.pressEnter();
await Bun.sleep(200);

if (submissions[0] !== "hello")
  throw new Error(`Submit failed: got ${JSON.stringify(submissions[0])}`);

await keys.typeText("a");
keys.pressKey("j", { ctrl: true });
await keys.typeText("b");
keys.pressEnter();
await Bun.sleep(200);

if (submissions[1] !== "a\nb")
  throw new Error(
    `Ctrl+J newline failed: got ${JSON.stringify(submissions[1])}`,
  );

keys.pressArrow("up");
await Bun.sleep(40);
keys.pressEnter();
await Bun.sleep(200);

if (submissions[2] !== "a\nb")
  throw new Error(
    `Empty composer history failed: got ${JSON.stringify(submissions[2])}`,
  );

await keys.typeText("stashed prompt");
keys.pressKey("s", { ctrl: true, shift: true });
await Bun.sleep(80);
keys.pressKey("p", { ctrl: true, shift: true });
await Bun.sleep(80);
keys.pressEnter();
await Bun.sleep(80);
keys.pressEnter();
await Bun.sleep(200);

if (submissions[3] !== "stashed prompt")
  throw new Error(
    `Prompt stash restore failed: got ${JSON.stringify(submissions[3])}`,
  );

keys.pressKey("a", { ctrl: true, shift: true });
await Bun.sleep(80);
await keys.typeText("fixtures/sample.png");
keys.pressEnter();
await Bun.sleep(150);
await keys.pasteBracketedText("with attachment");
await Bun.sleep(80);
keys.pressEnter();
await Bun.sleep(200);

if (attachmentSubmissions[0]?.text !== "with attachment")
  throw new Error(
    `Attachment submit text failed: got ${JSON.stringify(attachmentSubmissions[0])}`,
  );
if (attachmentSubmissions[0]?.attachments?.[0] !== "fixtures/sample.png")
  throw new Error(
    `Attachment submit paths failed: got ${JSON.stringify(attachmentSubmissions[0])}`,
  );

await keys.typeText("/mod");
await Bun.sleep(80);
keys.pressEnter();
await Bun.sleep(80);
keys.pressEnter();
await Bun.sleep(200);

if (submissions[5] !== "/models")
  throw new Error(
    `Slash autocomplete submit failed: got ${JSON.stringify(submissions[5])}`,
  );

await keys.pasteBracketedText("review @ment");
await Bun.sleep(200);
keys.pressEnter();
await Bun.sleep(100);
await keys.pasteBracketedText("please inspect");
keys.pressEnter();
await Bun.sleep(200);

if (
  attachmentSubmissions[1]?.text !== "review @src/mentioned.ts please inspect"
)
  throw new Error(
    `File mention text failed: got ${JSON.stringify(attachmentSubmissions[1])}`,
  );
if (attachmentSubmissions[1]?.attachments?.[0] !== "src/mentioned.ts")
  throw new Error(
    `File mention attachment failed: got ${JSON.stringify(attachmentSubmissions[1])}`,
  );

keys.pressKey("f", { ctrl: true, shift: true });
await Bun.sleep(80);
await keys.pasteBracketedText("needle");
keys.pressEnter();
await Bun.sleep(150);
keys.pressEnter();
await Bun.sleep(80);
await keys.pasteBracketedText("search result");
keys.pressEnter();
await Bun.sleep(200);

if (attachmentSubmissions[2]?.text !== "@src/mentioned.ts:4 search result")
  throw new Error(
    `Workspace search mention failed: got ${JSON.stringify(attachmentSubmissions[2])}`,
  );
if (attachmentSubmissions[2]?.attachments?.[0] !== "src/mentioned.ts")
  throw new Error(
    `Workspace search attachment failed: got ${JSON.stringify(attachmentSubmissions[2])}`,
  );

await keys.typeText("@rev");
await Bun.sleep(100);
keys.pressEnter();
await Bun.sleep(80);
keys.pressEnter();
await Bun.sleep(200);

if (attachmentSubmissions[3]?.agents?.[0]?.name !== "reviewer")
  throw new Error(
    `Agent mention metadata failed: got ${JSON.stringify(attachmentSubmissions[3])}`,
  );

await keys.typeText("@gui");
await Bun.sleep(100);
keys.pressEnter();
await Bun.sleep(80);
keys.pressEnter();
await Bun.sleep(200);

if (attachmentSubmissions[4]?.resources?.[0]?.uri !== "docs://guide")
  throw new Error(
    `Resource mention metadata failed: got ${JSON.stringify(attachmentSubmissions[4])}`,
  );

keys.pressKey("x", { ctrl: true });
await Bun.sleep(30);
keys.pressKey("a");
await Bun.sleep(100);
keys.pressKey("d");
await Bun.sleep(100);
keys.pressEscape();
await Bun.sleep(80);
keys.pressEscape();
await Bun.sleep(80);
if (selectedAgents.length !== 0)
  throw new Error(
    "agent detail dialog selected an agent while opening details",
  );

keys.pressKey("p", { ctrl: true });
await Bun.sleep(80);
await keys.typeText("status");
await Bun.sleep(80);
keys.pressEnter();
for (let attempts = 0; attempts < 20 && statusLoadCount() !== 1; attempts++)
  await Bun.sleep(25);
if (statusLoadCount() !== 1)
  throw new Error(`expected runtime status load, got ${statusLoadCount()}`);
keys.pressKey("r");
for (let attempts = 0; attempts < 20 && statusLoadCount() !== 2; attempts++)
  await Bun.sleep(25);
if (statusLoadCount() !== 2)
  throw new Error(`expected runtime status refresh, got ${statusLoadCount()}`);
keys.pressEscape();
await Bun.sleep(80);

keys.pressKey("g", { ctrl: true, shift: true });
await Bun.sleep(120);
if (
  JSON.stringify(forkCalls) !==
  JSON.stringify([
    {
      id: "ses_keyboard_smoke",
      turnID: `turn_keyboard_${submissions.length}`,
    },
  ])
)
  throw new Error(`Session fork shortcut failed: ${JSON.stringify(forkCalls)}`);
keys.pressCtrlC();
await Bun.sleep(80);

const destroyed = new Promise<void>((resolve) =>
  handle.renderer.once("destroy", resolve),
);
keys.pressCtrlC();
await Promise.race([
  destroyed,
  Bun.sleep(3_000).then(() => {
    throw new Error("Ctrl+C did not destroy the idle renderer");
  }),
]);

console.log("keyboard smoke passed");

function makeBackend(): RuntimeClient {
  let sink: ((event: RuntimeEvent) => void) | undefined;
  let lastSubmission: SubmittedTurn | undefined;
  return {
    start(onEvent) {
      sink = onEvent;
      sink({
        type: "session.created",
        sessionID: "ses_keyboard_smoke" as never,
        title: "Keyboard smoke",
      });
      sink({ type: "session.ready", sessionID: "ses_keyboard_smoke" as never });
    },
    async submit(text) {
      submissions.push(text);
      const id = `turn_keyboard_${submissions.length}`;
      lastSubmission = {
        type: "turn.submitted",
        id,
        text,
        byteLength: Buffer.byteLength(text),
        lineCount: lineCount(text),
        sha256: makeDigest(text),
      };
      sink?.(lastSubmission);
      sink?.({ type: "turn.finished", id, stopReason: "done" });
      return lastSubmission;
    },
    async submitInput(input) {
      attachmentSubmissions.push({
        text: input.text,
        attachments: input.attachments,
        agents: input.agents,
        resources: input.resources,
      });
      return await this.submit(input.text);
    },
    async workspaceFiles(input) {
      const query = input?.query?.toLowerCase() ?? "";
      return workspaceFiles.filter((file) =>
        file.path.toLowerCase().includes(query),
      );
    },
    async agents() {
      return [
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
        {
          name: "reviewer",
          description: "Review changes",
          mode: "subagent",
          hidden: false,
        },
      ];
    },
    selectAgent(name) {
      selectedAgents.push(name);
    },
    async runtimeStatus() {
      statusLoads++;
      return {
        type: "status.snapshot",
        model: "scripted-model",
        provider: "fixture",
        context: "0 tokens",
        step: "0",
        permissions: "ask",
        cwd: "/workspace",
        background: "0 running",
      };
    },
    async mcpCatalog() {
      return {
        prompts: [],
        resources: [
          {
            server: "docs",
            uri: "docs://guide",
            name: "Guide",
            mimeType: "text/plain",
          },
        ],
      };
    },
    async workspaceSearch() {
      return [{ path: "src/mentioned.ts", line: 4, text: "needle" }];
    },
    async sessionFork(id, turnID) {
      forkCalls.push({ id, turnID });
      return {
        id: "ses_keyboard_fork",
        title: "Keyboard smoke (fork)",
        createdAt: "2026-07-23T00:00:00.000Z",
        pinned: false,
        events: 0,
        pendingInputs: 0,
        cancelled: false,
        resumable: true,
      };
    },
    cancel() {},
    snapshot() {
      return { type: "snapshot.created", id: "keyboard", files: [] };
    },
    diagnostic() {},
    lastSubmission: () => lastSubmission,
    respondApproval() {},
    respondQuestion() {},
  };
}
