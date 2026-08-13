import { expect, test } from "bun:test";
import {
  buildSessionIntelligenceSnapshot,
  countChangedFiles,
  countValidatedChanges,
  hasLivePTY,
  hasLiveSandbox,
  latestConfirmedOutput,
} from "../src/session-intelligence";
import type { RuntimeEvent } from "@natalia/contracts";

test("changed files count only work-graph workspace_change nodes", () => {
  const events: RuntimeEvent[] = [
    {
      type: "workgraph.node_added",
      id: "wg:action:t1",
      nodeID: "wg:action:t1",
      kind: "agent_action",
      summary: "turn",
      sessionID: "ses_1",
    },
    {
      type: "workgraph.node_added",
      id: "wg:change:t1:src/a.ts",
      nodeID: "wg:change:t1:src/a.ts",
      kind: "workspace_change",
      summary: "write_file changed",
      target: "src/a.ts",
      actor: "write_file",
      sessionID: "ses_1",
    },
    {
      type: "workgraph.node_added",
      id: "wg:change:t1:src/b.ts",
      nodeID: "wg:change:t1:src/b.ts",
      kind: "workspace_change",
      summary: "edit_file changed",
      target: "src/b.ts",
      actor: "edit_file",
      sessionID: "ses_1",
    },
  ];
  expect(countChangedFiles(events)).toBe(2);
});

test("validated changes come from evidence events, none today", () => {
  const events: RuntimeEvent[] = [
    {
      type: "evidence.recorded",
      id: "evidence_1",
      taskID: "task_1",
      objective: "objective",
      status: "validated",
      changes: [{ path: "src/a.ts", changeType: "modified", summary: "fixed" }],
    },
  ];
  expect(countValidatedChanges(events)).toBe(1);
  expect(countChangedFiles(events)).toBe(0);
});

test("latest confirmed output is the last content.done text", () => {
  const events: RuntimeEvent[] = [
    { type: "content.delta", id: "t1", text: "unconfirmed" },
    { type: "content.done", id: "t1", text: "confirmed one" },
    { type: "content.done", id: "t2", text: "final" },
  ];
  expect(latestConfirmedOutput(events)).toBe("final");
});

test("the snapshot bounds recent output to the schema's 2000-character cap", () => {
  const events: RuntimeEvent[] = [
    { type: "content.done", id: "t1", text: "x".repeat(3000) },
  ];
  const snapshot = buildSessionIntelligenceSnapshot({
    id: "snapshot:bound",
    events,
    live: { agentStatus: "idle" },
  });
  expect(snapshot.recentOutput?.length).toBe(2000);
});

test("PTY presence follows the last timeline action per pane", () => {
  const base = { target: { kind: "host", cwd: "/w" } } as const;
  const started: RuntimeEvent = {
    type: "terminal.timeline",
    id: "term_1",
    actor: "model",
    action: "started",
    status: "executed",
    summary: "started",
    at: "now",
    ...base,
  };
  const wrote: RuntimeEvent = {
    type: "terminal.timeline",
    id: "term_1",
    actor: "model",
    action: "write",
    status: "executed",
    summary: "write",
    at: "now",
    ...base,
  };
  const exited: RuntimeEvent = {
    type: "terminal.timeline",
    id: "term_1",
    actor: "model",
    action: "exit",
    status: "executed",
    summary: "exit",
    at: "now",
    ...base,
  };
  expect(hasLivePTY([started])).toBe(true);
  expect(hasLivePTY([started, wrote])).toBe(true);
  expect(hasLivePTY([started, wrote, exited])).toBe(false);
  expect(hasLivePTY([exited])).toBe(false);
});

test("sandbox presence follows the last status per sandbox", () => {
  const created: RuntimeEvent = {
    type: "sandbox.update",
    id: "sb_1",
    status: "created",
    root: "/w/.natalia/sandboxes/sb_1",
    isolationLevel: "workspace",
    changedFiles: 0,
    runningResources: 0,
    target: {
      kind: "sandbox",
      sandboxID: "sb_1",
      root: "/r",
      isolationLevel: "workspace",
    },
    resourcePolicy: "policy",
  };
  const deleted: RuntimeEvent = { ...created, status: "deleted" };
  expect(hasLiveSandbox([created])).toBe(true);
  expect(hasLiveSandbox([created, deleted])).toBe(false);
  expect(hasLiveSandbox([])).toBe(false);
});

test("snapshot builder is secret-safe and carries only derived counts", () => {
  const events: RuntimeEvent[] = [
    {
      type: "content.done",
      id: "t1",
      text: "the model reply",
    },
    {
      type: "workgraph.node_added",
      id: "wg:change:t1:src/a.ts",
      nodeID: "wg:change:t1:src/a.ts",
      kind: "workspace_change",
      summary: "write_file changed",
      target: "src/a.ts",
      actor: "write_file",
      sessionID: "ses_1",
    },
  ];
  const snapshot = buildSessionIntelligenceSnapshot({
    id: "snapshot:1",
    events,
    live: {
      agentStatus: "running",
      currentStep: "step 3",
      activeTool: "write_file",
    },
  });
  expect(snapshot).toMatchObject({
    type: "session.snapshot",
    id: "snapshot:1",
    agentStatus: "running",
    currentStep: "step 3",
    activeTool: "write_file",
    changedFiles: 1,
    unvalidatedChanges: 1,
    recentOutput: "the model reply",
    hasPTY: false,
    hasSandbox: false,
  });
  // The secret-safe boundary: no file content, no tool arguments, no results.
  expect(JSON.stringify(snapshot)).not.toContain("source code");
  expect(JSON.stringify(snapshot)).not.toContain("command");
  expect(JSON.stringify(snapshot)).not.toContain("arguments");
});
