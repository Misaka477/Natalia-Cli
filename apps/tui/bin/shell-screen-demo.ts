import type {
  RuntimeClient,
  RuntimeEvent,
  SubmittedTurn,
} from "@natalia/contracts";
import { lineCount, makeDigest } from "@natalia/testing";
import { runTuiShell } from "../src/app/runtime";

const output = [
  "\u001b[36mChecking formatting...\u001b[0m",
  "All matched files use Prettier code style!",
  "Type checking workspace packages...",
  "apps/tui passed",
  "packages/runtime passed",
  "packages/tools passed",
  "Running package tests...",
  "221 package tests passed",
  "Running TUI tests...",
  "114 TUI tests passed",
  "Import guard passed",
  "Verification completed in 52.4s",
].join("\n");

const handle = await runTuiShell({
  backend: makeDemoBackend(),
  initialPrompt: "Run the workspace verification suite",
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
        sessionID: "ses_shell_demo" as never,
        title: "Verifying the workspace",
      });
      sink({ type: "session.ready", sessionID: "ses_shell_demo" as never });
      sink({
        type: "status.snapshot",
        model: "local-model",
        provider: "local",
        context: "18.2k/200k 9%",
        step: "1/1000",
        permissions: "ask",
        cwd: process.cwd(),
        background: "none",
      });
    },
    async submit(text) {
      submission = {
        type: "turn.submitted",
        id: "turn_shell_demo",
        text,
        byteLength: Buffer.byteLength(text),
        lineCount: lineCount(text),
        sha256: makeDigest(text),
      };
      sink?.(submission);
      const startedAt = Date.now() - 52_400;
      sink?.({
        type: "tool.update",
        id: submission.id,
        name: "run_shell",
        callID: "verify_workspace",
        status: "receiving_arguments",
        summary: "Preparing command",
        argumentsDelta: JSON.stringify({
          command: "npm run verify",
          workdir: "~/Development/Natalia_Project/natalia-cli",
        }),
        metadata: { kind: "shell" },
        startedAt,
      });
      sink?.({
        type: "tool.update",
        id: submission.id,
        name: "run_shell",
        callID: "verify_workspace",
        status: "succeeded",
        summary: "Workspace verification passed",
        result: output,
        metadata: { kind: "shell" },
        startedAt,
        endedAt: Date.now(),
      });
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
}
