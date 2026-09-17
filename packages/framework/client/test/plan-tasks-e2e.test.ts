import { expect, test } from "bun:test";
import type { SessionID } from "@natalia/contracts";
import { createRealRuntimeClient } from "../src";
import { officialPluginWorkspace } from "./plugin-test-helpers";
import { createScriptedProvider } from "./e2e-harness";

const SESSION = "ses_e2e_plan_tasks" as SessionID;

test("Phase 4 E2E: plan checkboxes project to evidence-first task states", async () => {
  const root = await officialPluginWorkspace("plan-tasks-e2e");
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: SESSION,
    permissionMode: "auto",
    provider: createScriptedProvider({
      main: [{ text: "standby" }],
      navi: [{ text: "standby" }],
      nia: [{ text: "standby" }],
    }),
  });
  client.start(() => undefined);
  await client.sessionAttach!(SESSION);

  await client.planDocWrite!({
    path: "plans/e2e-tasks.md",
    content: [
      "# E2E tasks",
      "",
      "- [x] add the parser",
      "- [x] wire the runtime client",
      "- [ ] ship the docs",
      "- [~] legacy cleanup",
    ].join("\n"),
    title: "E2E tasks",
  });
  const marked = await client.planDocMark!({ path: "plans/e2e-tasks.md", title: "E2E tasks" });
  const planID = marked.planID;
  await client.planDocActivate!(planID);

  // Record a completion whose objective references "add the parser" — the fact
  // source that backs that one checked task.
  await client.recordCompletion!(
    {
      taskID: "plan:e2e:tasks",
      objective: "add the parser tests",
      changeSummary: "added parser unit tests",
      validations: [{ command: "bun test", result: "passed", safeSummary: "green" }],
      knownGaps: [],
      rollbackState: "clean",
    },
    SESSION,
  );

  const states = await client.planTaskStates!({ planID }, SESSION);
  const byText = new Map(states.map((task) => [task.text, task.state]));
  // Checked + evidence -> verified.
  expect(byText.get("add the parser")).toBe("verified");
  // Checked + no evidence -> gap (never verified without backing).
  expect(byText.get("wire the runtime client")).toBe("gap");
  // Open + no evidence -> pending.
  expect(byText.get("ship the docs")).toBe("pending");
  // Skipped stays visible.
  expect(byText.get("legacy cleanup")).toBe("skipped");
  await client.dispose?.();
}, 30_000);
