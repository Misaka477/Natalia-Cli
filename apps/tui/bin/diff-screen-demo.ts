import type {
  RuntimeClient,
  RuntimeEvent,
  SubmittedTurn,
} from "@natalia/contracts";
import { lineCount, makeDigest } from "@natalia/testing";
import { runTuiShell } from "../src/app/runtime";

const diff = `--- a/app/Actions/Fortify/CreateNewUser.php
+++ b/app/Actions/Fortify/CreateNewUser.php
@@ -19,7 +19,8 @@
 public function create(array $input): User
 {
     Validator::make($input, [
-        'name' => ['required', 'string', 'max:255'],
+        'name' => ['required', 'string', 'date', 'before_or_equal:'.now()->subYears(18)->format('Y-m-d')],
         'email' => ['required', 'string', 'email', 'max:255'],
         'password' => $this->passwordRules(),
+        'date_of_birth.before_or_equal' => 'You must be at least 18 years old to register.',
     ])->validate();
@@ -34,6 +37,7 @@
     return User::create([
         'name' => $input['name'],
+        'date_of_birth' => $input['date_of_birth'],
         'email' => $input['email'],
         'password' => $input['password'],
     ]);
 }`;

const handle = await runTuiShell({
  backend: makeDemoBackend(),
  initialPrompt: "Add age validation and persist date of birth",
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
        sessionID: "ses_diff_demo" as never,
        title: "Implementing profile age validation",
      });
      sink({ type: "session.ready", sessionID: "ses_diff_demo" as never });
      sink({
        type: "status.snapshot",
        model: "local-model",
        provider: "local",
        context: "31.8k/200k 16%",
        step: "1/1000",
        permissions: "ask",
        cwd: process.cwd(),
        background: "none",
      });
    },
    async submit(text) {
      submission = {
        type: "turn.submitted",
        id: "turn_diff_demo",
        text,
        byteLength: Buffer.byteLength(text),
        lineCount: lineCount(text),
        sha256: makeDigest(text),
      };
      sink?.(submission);
      const startedAt = Date.now();
      sink?.({
        type: "tool.update",
        id: submission.id,
        name: "apply_patch",
        callID: "patch_signup",
        status: "receiving_arguments",
        summary: "Preparing patch",
        argumentsDelta: JSON.stringify({
          path: "app/Actions/Fortify/CreateNewUser.php",
        }),
        metadata: { kind: "diff" },
        startedAt,
      });
      sink?.({
        type: "tool.update",
        id: submission.id,
        name: "apply_patch",
        callID: "patch_signup",
        status: "succeeded",
        summary: "Updated profile validation",
        result: diff,
        metadata: { kind: "diff" },
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
