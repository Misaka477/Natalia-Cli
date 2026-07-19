import type {
  RuntimeClient,
  RuntimeEvent,
  SubmittedTurn,
} from "@natalia/contracts";
import { lineCount, makeDigest } from "@natalia/testing";
import { runTuiShell } from "../src/app/runtime";

const handle = await runTuiShell({
  backend: makeDemoBackend(),
  initialPrompt: "Research the runtime issue and coordinate the fix",
  closeAfterInitialTurn: false,
});

process.on("SIGINT", () => handle.stop());
await new Promise<void>((resolve) => handle.renderer.once("destroy", resolve));

function makeDemoBackend(): RuntimeClient {
  let sink: ((event: RuntimeEvent) => void) | undefined;
  let submission: SubmittedTurn | undefined;
  return {
    start(onEvent) {
      sink = onEvent;
      sink({
        type: "session.created",
        sessionID: "ses_interaction_tools_demo" as never,
        title: "Coordinating the runtime fix",
      });
      sink({
        type: "session.ready",
        sessionID: "ses_interaction_tools_demo" as never,
      });
      sink({
        type: "status.snapshot",
        model: "local-model",
        provider: "local",
        context: "28.6k/200k 14%",
        step: "4/1000",
        permissions: "ask",
        cwd: process.cwd(),
        background: "none",
      });
    },
    async submit(text) {
      submission = {
        type: "turn.submitted",
        id: "turn_interaction_tools_demo",
        text,
        byteLength: Buffer.byteLength(text),
        lineCount: lineCount(text),
        sha256: makeDigest(text),
      };
      sink?.(submission);
      emitTool(
        "web_search",
        "search_runtime",
        { query: "Bun subprocess stream backpressure" },
        "status=200\nsource=DuckDuckGo HTML\nresult body",
      );
      emitTool(
        "web_fetch",
        "fetch_docs",
        { url: "https://bun.sh/docs/api/spawn" },
        "status=200\ncontent-type=text/html\nBun.spawn documentation",
      );
      emitTool(
        "agent_spawn",
        "spawn_analysis",
        {
          task: "Audit stream ownership and propose a minimal fix",
          mode: "Explore",
        },
        JSON.stringify({ id: "agent_stream_audit", status: "completed" }),
      );
      sink?.({
        type: "subagent.update",
        id: "agent_stream_audit",
        status: "completed",
        attached: true,
        event: "done",
        task: "Audit stream ownership and propose a minimal fix",
        text: "Ownership handoff can be fixed in the local runtime adapter.",
      });
      emitTool("execute", "execute_checks", {}, "child calls completed", {
        toolCalls: [
          {
            tool: "grep",
            status: "completed",
            input: { pattern: "streamOwner" },
          },
          {
            tool: "read_file",
            status: "completed",
            input: { path: "packages/runtime/src/turn.ts" },
          },
        ],
      });
      emitTool(
        "todo_write",
        "update_todos",
        {
          items: [
            { content: "Reproduce the stream stall", status: "completed" },
            { content: "Patch ownership handoff", status: "in_progress" },
            { content: "Run PTY recovery smoke", status: "pending" },
          ],
        },
        "saved 3 todo items",
      );
      emitTool(
        "ask_user",
        "confirm_scope",
        {
          question: "Apply the fix only to local runtime sessions?",
          options: ["Local runtime only", "All transports"],
        },
        JSON.stringify({ answers: [["Local runtime only"]] }),
      );
      emitTool(
        "skill_load",
        "load_diagnostics",
        { name: "runtime-diagnostics" },
        "skill loaded",
      );
      sink?.({ type: "turn.finished", id: submission.id, stopReason: "done" });
      return submission;
    },
    cancel() {},
    snapshot() {
      return { type: "snapshot.created", id: "demo", files: [] };
    },
    diagnostic(message, level = "info") {
      sink?.({ type: "diagnostic", message, level });
    },
    lastSubmission: () => submission,
    respondApproval() {},
    respondQuestion() {},
  };

  function emitTool(
    name: string,
    callID: string,
    input: Record<string, unknown>,
    result: string,
    metadata: Record<string, unknown> = {},
  ) {
    const startedAt = Date.now() - 80;
    sink?.({
      type: "tool.update",
      id: submission!.id,
      name,
      callID,
      status: "receiving_arguments",
      summary: `Preparing ${name}`,
      argumentsDelta: JSON.stringify(input),
      metadata,
      startedAt,
    });
    sink?.({
      type: "tool.update",
      id: submission!.id,
      name,
      callID,
      status: "succeeded",
      summary: `${name} completed`,
      result,
      metadata,
      startedAt,
      endedAt: Date.now(),
    });
  }
}
