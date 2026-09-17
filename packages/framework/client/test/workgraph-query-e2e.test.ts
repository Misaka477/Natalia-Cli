import { expect, test } from "bun:test";
import type { SessionID } from "@natalia/contracts";
import type { ProviderStreamRequest } from "@natalia/runtime";
import { createRealRuntimeClient } from "../src";
import { officialPluginWorkspace } from "./plugin-test-helpers";

const SESSION = "ses_e2e_workgraph_query" as SessionID;

type GraphResult = {
  total: number;
  truncated: boolean;
  nodes: Array<{ kind: string }>;
  nextCursor?: string;
};

test("Phase 3 E2E: work_graph_query filters by nodeKind and reports truncation", async () => {
  const root = await officialPluginWorkspace("workgraph-query-e2e");
  const results: string[] = [];
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: SESSION,
    permissionMode: "auto",
    provider: {
      provider: "test",
      model: "test",
      async *stream(request: ProviderStreamRequest) {
        const toolResult = (
          request as {
            messages: Array<{ role: string; content: string; toolCallID?: string }>;
          }
        ).messages
          .filter(
            (message) =>
              message.role === "tool" &&
              String(message.toolCallID ?? "").startsWith("call_graph"),
          )
          .at(-1);
        if (toolResult) {
          results.push(String(toolResult.content ?? ""));
          if (results.length === 1) {
            // nodeKind filter — only decision nodes.
            yield {
              type: "tool_call" as const,
              calls: [
                {
                  id: "call_graph",
                  name: "work_graph_query",
                  arguments: JSON.stringify({ nodeKind: "decision", limit: 50 }),
                },
              ],
            };
            yield { type: "done" as const };
            return;
          }
          if (results.length === 2) {
            // Two precise queries at once — a usage error.
            yield {
              type: "tool_call" as const,
              calls: [
                {
                  id: "call_graph",
                  name: "work_graph_query",
                  arguments: JSON.stringify({ path: "plans/x.md", findingID: "DF-1" }),
                },
              ],
            };
            yield { type: "done" as const };
            return;
          }
          if (results.length === 3) {
            // Invalid cursor — a usage error.
            yield {
              type: "tool_call" as const,
              calls: [
                {
                  id: "call_graph",
                  name: "work_graph_query",
                  arguments: JSON.stringify({ cursor: "not-a-number" }),
                },
              ],
            };
            yield { type: "done" as const };
            return;
          }
          yield { type: "content" as const, text: "graph queried" };
          yield { type: "done" as const };
          return;
        }
        // First: a limit-1 query over the whole graph -> truncated + nextCursor.
        yield {
          type: "tool_call" as const,
          calls: [
            {
              id: "call_graph",
              name: "work_graph_query",
              arguments: JSON.stringify({ limit: 1 }),
            },
          ],
        };
        yield { type: "done" as const };
      },
    },
  });
  client.start(() => undefined);
  await client.sessionAttach!(SESSION);
  // A decision node in the graph.
  await client.recordDecision!({ decision: "append runtime context" }, SESSION);
  await client.submitAndWait!("query the graph");

  expect(results.length).toBeGreaterThanOrEqual(4);

  // 1. limit 1 over a multi-node graph -> truncated + nextCursor.
  const whole = JSON.parse(results[0]!) as GraphResult;
  expect(whole.total).toBeGreaterThan(1);
  expect(whole.nodes).toHaveLength(1);
  expect(whole.truncated).toBe(true);
  expect(whole.nextCursor).toBe("1");

  // 2. nodeKind filter -> only decision nodes.
  const decisions = JSON.parse(results[1]!) as GraphResult;
  expect(decisions.nodes.length).toBeGreaterThan(0);
  expect(decisions.nodes.every((node) => node.kind === "decision")).toBe(true);

  // 3. Two precise queries -> usage error string (not a JSON result).
  expect(results[2]).toContain("fill exactly one precise query");

  // 4. Invalid cursor -> usage error string.
  expect(results[3]).toContain("invalid cursor");

  await client.dispose?.();
}, 30_000);


test("Phase 3 E2E: work_graph_query returns an empty (not error) result for a non-matching query", async () => {
  const root = await officialPluginWorkspace("workgraph-query-empty");
  const results: string[] = [];
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: SESSION,
    permissionMode: "auto",
    provider: {
      provider: "test",
      model: "test",
      async *stream(request: ProviderStreamRequest) {
        const messages = (
          request as { messages: Array<{ role: string; content: string; toolCallID?: string }> }
        ).messages;
        const graphResult = messages
          .filter(
            (message) =>
              message.role === "tool" &&
              String(message.toolCallID ?? "").startsWith("call_graph"),
          )
          .at(-1);
        if (graphResult) {
          results.push(String(graphResult.content ?? ""));
          if (results.length === 1) {
            // A findingID precise query with no matching chain.
            yield {
              type: "tool_call" as const,
              calls: [
                {
                  id: "call_graph",
                  name: "work_graph_query",
                  arguments: JSON.stringify({ findingID: "DF-nonexistent" }),
                },
              ],
            };
            yield { type: "done" as const };
            return;
          }
          yield { type: "content" as const, text: "queried" };
          yield { type: "done" as const };
          return;
        }
        // First: a nodeKind with no nodes in this session.
        yield {
          type: "tool_call" as const,
          calls: [
            {
              id: "call_graph",
              name: "work_graph_query",
              arguments: JSON.stringify({ nodeKind: "goal" }),
            },
          ],
        };
        yield { type: "done" as const };
      },
    },
  });
  client.start(() => undefined);
  await client.sessionAttach!(SESSION);
  await client.submitAndWait!("query the graph");

  expect(results.length).toBeGreaterThanOrEqual(2);
  // A non-matching nodeKind filter is a success with an empty result, not an
  // error string.
  const byKind = JSON.parse(results[0]!) as GraphResult;
  expect(byKind).toMatchObject({ total: 0, truncated: false, nodes: [] });
  // A findingID precise query with no matching chain is likewise empty success.
  const byFinding = JSON.parse(results[1]!) as GraphResult;
  expect(byFinding).toMatchObject({ total: 0, truncated: false, nodes: [] });
  await client.dispose?.();
}, 30_000);
