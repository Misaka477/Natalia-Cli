import type {
  RuntimeClient,
  RuntimeEvent,
  SubmittedTurn,
} from "@natalia/contracts";
import { lineCount, makeDigest } from "@natalia/testing";
import { runTuiShell } from "../src/app/runtime";

const handle = await runTuiShell({
  backend: makeDemoBackend(),
  initialPrompt: "Inspect config files and update the runtime defaults",
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
        sessionID: "ses_file_tools_demo" as never,
        title: "Updating runtime defaults",
      });
      sink({
        type: "session.ready",
        sessionID: "ses_file_tools_demo" as never,
      });
      sink({
        type: "status.snapshot",
        model: "local-model",
        provider: "local",
        context: "22.4k/200k 11%",
        step: "2/1000",
        permissions: "ask",
        cwd: process.cwd(),
        background: "none",
      });
    },
    async submit(text) {
      submission = {
        type: "turn.submitted",
        id: "turn_file_tools_demo",
        text,
        byteLength: Buffer.byteLength(text),
        lineCount: lineCount(text),
        sha256: makeDigest(text),
      };
      sink?.(submission);
      emitTool(
        "glob",
        "glob_config",
        { pattern: "**/*.json" },
        ["package.json", "tsconfig.json", "apps/tui/package.json"].join("\n"),
      );
      emitTool(
        "grep",
        "grep_defaults",
        { pattern: "defaultModel", include: "packages/config/**/*.ts" },
        [
          "packages/config/src/defaults.ts:14: defaultModel: ''",
          "packages/config/src/schema.ts:82: defaultModel: z.string()",
        ].join("\n"),
      );
      emitTool(
        "read_file",
        "read_defaults",
        { path: "packages/config/src/defaults.ts" },
        "export const defaults = { defaultModel: '', maxSteps: 1000 };",
      );
      emitTool(
        "write_file",
        "write_defaults",
        {
          path: "packages/config/src/defaults.ts",
          content: [
            "export const defaults = {",
            "  defaultModel: '',",
            "  maxSteps: 1000,",
            "  followBottom: true,",
            "};",
          ].join("\n"),
        },
        "wrote packages/config/src/defaults.ts",
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
  ) {
    const startedAt = Date.now() - 40;
    sink?.({
      type: "tool.update",
      id: submission!.id,
      name,
      callID,
      status: "receiving_arguments",
      summary: `Preparing ${name}`,
      argumentsDelta: JSON.stringify(input),
      metadata: {},
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
      metadata: {},
      startedAt,
      endedAt: Date.now(),
    });
  }
}
