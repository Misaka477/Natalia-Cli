import { expect, test } from "bun:test";
import type { SessionID } from "@natalia/contracts";
import { createRealRuntimeClient } from "../src";
import { officialPluginWorkspace } from "./plugin-test-helpers";
import { createScriptedProvider } from "./e2e-harness";

const SESSION = "ses_e2e_workgraph_integrity" as SessionID;

test("Phase 3 E2E: work graph integrity reports a stable graph and unattributed changes", async () => {
  const root = await officialPluginWorkspace("workgraph-integrity-e2e");
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

  // A decision node in the graph (well-formed, with session correlation).
  await client.recordDecision!({ decision: "append runtime context" }, SESSION);

  // 1. Integrity: the graph rebuilt from the journal is stable.
  const integrity = await client.workGraphIntegrity!(SESSION);
  expect(integrity.nodeCount).toBeGreaterThan(0);
  expect(integrity.stable).toBe(true);
  expect(integrity.danglingEdges).toEqual([]);
  expect(integrity.duplicateNodeIDs).toEqual([]);
  // Every node the runtime wrote carries session correlation.
  expect(integrity.incompleteNodes).toEqual([]);

  // 2. Unattributed changes: none yet (nothing external reconciled).
  const before = await client.unattributedChanges!(SESSION);
  expect(before).toEqual([]);

  await client.dispose?.();
}, 30_000);
